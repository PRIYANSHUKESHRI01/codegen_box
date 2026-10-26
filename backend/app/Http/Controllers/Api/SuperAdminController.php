<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\ConfirmsSuperadminPassword;
use App\Http\Controllers\Controller;
use App\Jobs\SendAccountCredentialsEmail;
use App\Models\ActivityLog;
use App\Models\College;
use App\Models\Company;
use App\Models\ContactRequest;
use App\Models\NewsletterSubscriber;
use App\Models\FeatureFlag;
use App\Models\Plan;
use App\Models\Submission;
use App\Models\Subscription;
use App\Models\User;
use App\Services\CollegePurgeService;
use App\Services\IssuedCredentialVault;
use App\Services\Judge\JudgeStatusService;
use App\Services\LeadAssignmentService;
use App\Services\ReadinessScoreService;
use App\Services\StudentStatsService;
use App\Support\SingleMail;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Superadmin-only operations that sit a trust tier above admin_internal:
 * managing accounts of EVERY role (including other Mellow staff, and other
 * superadmins), a real segmented platform overview, and the platform's real
 * audit trail. `AdminController` deliberately cannot touch staff/superadmin
 * accounts — this is where that ceiling is lifted, for the one role trusted
 * to hold it.
 */
class SuperAdminController extends Controller
{
    use ConfirmsSuperadminPassword;

    /**
     * Every account on the platform, any role — admin_internal's own user
     * list is student-only by design, so this is the only real cross-role
     * directory. Paginated for the same reason AdminController::users() is:
     * a bulk-imported college alone can put thousands of rows in `users`.
     *
     * `roles` (comma-separated) lets a caller fetch several roles in one
     * request (e.g. the Mellow Staff tab wants admin_internal+
     * admin_marketing+superadmin at once) and takes priority over the
     * single `role` param, kept for backward compatibility. `has_college`
     * (0|1) is only meaningful for role=user — it splits Students (have a
     * college) from Mellow Direct leads (don't), see
     * User::isMellowDirectLead(). `college_id` narrows further to one
     * specific college's roster (Students tab's college filter).
     */
    public function users(Request $request)
    {
        $query = User::query()->with('college:id,name');

        $this->applySearch($query, $request);
        $this->applyRoles($query, $request);

        if ($request->has('has_college')) {
            $request->boolean('has_college')
                ? $query->whereNotNull('college_id')
                : $query->whereNull('college_id');
        }

        // Narrow to one university's roster (every role that belongs to one: students, TPOs, coordinators), or `none` for the
        // accounts that belong to no university (Mellow staff, hiring companies, individual coders).
        $this->applyCollege($query, $request);

        // One department's students (Engineering, Management, Commerce, Arts …); a student never classified counts as engineering.
        if (($department = $request->query('department')) && is_string($department)) {
            $this->applyDepartment($query, $department);
        }

        // The plan a student holds THEMSELVES (not their college's): a plan code, `paid` for any
        // paid one, `free` for Coder, or `none` for no running plan at all. This is the filter the
        // "who is on what" question needs — a college-covered student's own plan is what lapses
        // if the college does.
        $this->applyPlan($query, $request->query('plan'));

        $page = $query->latest()->paginate(50);

        // Whether a superadmin could look up the temporary password this account was issued — a presence check on one
        // page of ids, never the password and never a hash comparison (see IssuedCredentialVault::statesFor()).
        $credentialStates = app(IssuedCredentialVault::class)->statesFor($page->getCollection());

        // The readiness tier on each student row is the expensive part of this list: scored one student at a time it is
        // a dozen queries and a pile of PHP per row, which made a 50-row page take several seconds (and, on the
        // single-threaded dev server, held every other request up behind it). Scored for the whole page at once it is
        // a handful of queries — the same bulk pass the TPO roster and the placement reports use.
        app(ReadinessScoreService::class)->prime($page->getCollection()->filter(fn (User $u) => $u->role === User::ROLE_USER));

        // Real, cheap-per-row enrichment bounded to this one page (≤50 rows)
        // — same bounded-loop precedent as AdminController::colleges() and
        // MarketingLeadController::leadSummary(), never run across the whole
        // unfiltered table.
        $page->getCollection()->transform(function (User $user) use ($credentialStates) {
            $user->credential_state = $credentialStates[$user->id] ?? IssuedCredentialVault::STATE_NOT_RECORDED;
            $coverage = $user->subscriptionCoverage();
            $user->subscription_plan_name = $coverage['plan']?->name;
            $user->subscription = $coverage['plan'] ? [
                'plan_code' => $coverage['plan']->code,
                'plan_name' => $coverage['plan']->name,
                'source' => $coverage['source'],
                'days_remaining' => $coverage['days_remaining'],
                'is_trial' => $coverage['is_trial'],
                'ends_at' => $coverage['subscription']?->current_period_end,
            ] : null;
            if ($user->role === User::ROLE_USER) {
                $user->readiness_tier = $user->readinessTier();
            }

            return $user;
        });

        return $page;
    }

    private function applySearch(Builder $query, Request $request): void
    {
        if ($search = trim((string) $request->query('search'))) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('handle', 'like', "%{$search}%");
            });
        }
    }

    /** `roles` (comma-separated) wins over the single `role`; unknown values are dropped rather than rejected. */
    private function applyRoles(Builder $query, Request $request): void
    {
        if ($roles = $request->query('roles')) {
            $validRoles = array_intersect(explode(',', (string) $roles), User::ROLES);
            if ($validRoles !== []) {
                $query->whereIn('role', $validRoles);
            }
        } elseif ($role = $request->query('role')) {
            $query->where('role', $role);
        }
    }

    private function applyCollege(Builder $query, Request $request): void
    {
        $collegeId = $request->query('college_id');

        if ($collegeId === 'none') {
            $query->whereNull('college_id');
        } elseif ($collegeId !== null && $collegeId !== '' && ctype_digit((string) $collegeId)) {
            $query->where('college_id', (int) $collegeId);
        }
    }

    /**
     * What the directory's filter bar needs to be honest: how many accounts of each ROLE the current university + search
     * leaves (so picking a university shows "TPOs 1 · Coordinators 4 · Students 230" before you click anything), how
     * many accounts each UNIVERSITY has for the current role + search (so the list can say which universities have any),
     * and — for the Students tab — how many students each DEPARTMENT has under the current university + search.
     * Grouped counts only, never row data, so it stays cheap on a table of thousands.
     *
     * Every filter the list itself understands narrows these numbers the same way it narrows the list, so a count on a
     * chip or in the university picker is exactly what clicking it will show: `department` narrows the university
     * counts (students of that department only), `has_college` narrows the department counts.
     */
    public function directoryFacets(Request $request)
    {
        $department = $request->query('department');
        $department = is_string($department) && $department !== '' ? $department : null;
        // A plan only exists for students: choosing one narrows the students, the university counts and the "All" total to them.
        $plan = $request->query('plan');
        $plan = is_string($plan) && $plan !== '' ? $plan : null;

        $byRole = User::query();
        $this->applySearch($byRole, $request);
        $this->applyCollege($byRole, $request);
        $roles = $byRole->selectRaw('role, COUNT(*) as accounts')->groupBy('role')->pluck('accounts', 'role');

        // What the "All" chip would list: every account — or, with a plan chosen, only the students on it.
        $total = (int) $roles->sum();
        if ($plan !== null) {
            $students = User::query()->where('role', User::ROLE_USER);
            $this->applySearch($students, $request);
            $this->applyCollege($students, $request);
            $this->applyPlan($students, $plan);
            $total = $students->count();
            $roles = $roles->put(User::ROLE_USER, $total);
        }

        $byCollege = User::query()->whereNotNull('college_id');
        $this->applySearch($byCollege, $request);
        $this->applyRoles($byCollege, $request);
        $this->applyDepartment($byCollege, $department);
        $this->applyPlanToStudents($byCollege, $plan);
        $perCollege = $byCollege->selectRaw('college_id, COUNT(*) as accounts')->groupBy('college_id')->pluck('accounts', 'college_id');

        $noCollege = User::query()->whereNull('college_id');
        $this->applySearch($noCollege, $request);
        $this->applyRoles($noCollege, $request);
        $this->applyDepartment($noCollege, $department);
        $this->applyPlanToStudents($noCollege, $plan);

        // Students per department under the chosen university (and search). A student never classified counts under the
        // fallback department, exactly as User::scopeInDepartment() treats them, so these add up to the student total.
        $byDepartment = User::query()->where('role', User::ROLE_USER);
        $this->applySearch($byDepartment, $request);
        $this->applyCollege($byDepartment, $request);
        if ($request->has('has_college')) {
            $request->boolean('has_college')
                ? $byDepartment->whereNotNull('college_id')
                : $byDepartment->whereNull('college_id');
        }
        $fallback = (string) config('departments.fallback', 'engineering');
        $departments = [];
        foreach ($byDepartment->selectRaw('department, COUNT(*) as accounts')->groupBy('department')->get() as $row) {
            $code = $row->department ?: $fallback;
            $departments[$code] = ($departments[$code] ?? 0) + (int) $row->accounts;
        }

        return response()->json([
            'roles' => $roles,
            'total' => $total,
            'departments' => (object) $departments,
            'colleges' => College::query()
                ->orderBy('name')
                ->get(['id', 'name', 'short_code', 'city'])
                ->map(fn (College $c) => [
                    'id' => $c->id,
                    'name' => $c->name,
                    'short_code' => $c->short_code,
                    'city' => $c->city,
                    'accounts' => (int) ($perCollege[$c->id] ?? 0),
                ])
                ->values(),
            'without_college' => $noCollege->count(),
        ]);
    }

    /**
     * The plan a student holds THEMSELVES (not their college's): a plan code, `paid` for any paid one, `free` for Coder, or
     * `none` for no running plan at all. One definition, used by the list and by the counts beside its filters.
     */
    private function applyPlan(Builder $query, mixed $plan): void
    {
        if (! is_string($plan) || $plan === '') {
            return;
        }

        $running = fn ($s) => $s->where('status', Subscription::STATUS_ACTIVE)
            ->where(fn ($q) => $q->whereNull('current_period_end')->orWhere('current_period_end', '>', now()))
            ->whereHas('plan', fn ($p) => $p->where('kind', Plan::KIND_BASE));

        match ($plan) {
            'none' => $query->whereDoesntHave('subscriptions', $running),
            'paid' => $query->whereHas('subscriptions', fn ($s) => $running($s)->whereHas('plan', fn ($p) => $p->paidTier())),
            'free' => $query->whereHas('subscriptions', fn ($s) => $running($s)->whereHas('plan', fn ($p) => $p->where('list_price', 0))),
            default => $query->whereHas('subscriptions', fn ($s) => $running($s)->whereHas('plan', fn ($p) => $p->where('code', $plan))),
        };
    }

    /** A chosen plan narrows a count to the students on it (staff and companies have no plan of their own). */
    private function applyPlanToStudents(Builder $query, ?string $plan): void
    {
        if ($plan !== null) {
            $query->where('role', User::ROLE_USER);
            $this->applyPlan($query, $plan);
        }
    }

    /** One department's students — the same narrowing the list applies, kept in one place so counts and rows cannot disagree. */
    private function applyDepartment(Builder $query, ?string $department): void
    {
        if ($department !== null) {
            $query->where('role', User::ROLE_USER)->inDepartment($department);
        }
    }

    /**
     * Full drill-in detail for any single account, any role — the
     * "God mode" list at users() must always have a working drill-in to
     * back it, so this used to abort_unless(role === user) and 404 for
     * every TPO/company admin/coordinator/staff/superadmin row, which
     * contradicted that promise. role=user (student or lead) keeps its
     * original rich payload (academic profile, subscription coverage, real
     * StudentStatsService output) unchanged — every other role gets a
     * smaller but real payload built from whatever fields actually apply to
     * it. Only ever called for one record at a time from a detail drawer,
     * never per-row across a list.
     */
    public function showUser(User $user, StudentStatsService $stats)
    {
        if ($user->role !== User::ROLE_USER) {
            return response()->json(['user' => $this->staffOrTenantPayload($user)]);
        }

        $coverage = $user->subscriptionCoverage();

        return response()->json([
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'handle' => $user->handle,
                'phone' => $user->phone,
                'college' => $user->college ? ['id' => $user->college->id, 'name' => $user->college->name] : null,
                'roll_number' => $user->roll_number,
                'branch' => $user->branch,
                'cgpa' => $user->cgpa,
                'backlogs' => $user->backlogs,
                'is_blocked' => $user->is_blocked,
                'blocked_reason' => $user->blocked_reason,
                'created_at' => $user->created_at,
                'readiness_score' => $user->readinessScore(),
                'readiness_tier' => $user->readinessTier(),
                'subscription' => $coverage['plan'] ? [
                    'plan_name' => $coverage['plan']->name,
                    'source' => $coverage['source'],
                    'days_remaining' => $coverage['days_remaining'],
                ] : null,
            ],
            'stats' => [
                'solved_by_difficulty' => $stats->solvedByDifficulty($user),
                'solved_score' => $stats->solvedScore($user),
                'streak' => $stats->streak($user),
                'activity' => $stats->activityHeatmap($user),
                'recent_submissions' => $stats->recentSubmissions($user, 10),
            ],
        ]);
    }

    /**
     * Every non-student role's drill-in shape: TPO/section_coordinator get
     * their college, admin_company gets its company, admin_internal/
     * admin_marketing get their granted permissions — each field is simply
     * omitted (stays null) when it doesn't apply to this account's role,
     * rather than every role needing its own endpoint.
     */
    private function staffOrTenantPayload(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'handle' => $user->handle,
            'phone' => $user->phone,
            'role' => $user->role,
            'college' => $user->college ? ['id' => $user->college->id, 'name' => $user->college->name] : null,
            'section' => $user->section,
            'company' => $user->company ? ['id' => $user->company->id, 'name' => $user->company->name] : null,
            'permissions' => $user->permissions,
            'is_blocked' => $user->is_blocked,
            'blocked_reason' => $user->blocked_reason,
            'created_at' => $user->created_at,
        ];
    }

    /**
     * Create an account of any role except superadmin — minting a new
     * superadmin is deliberately kept off this self-service endpoint (not
     * just a frontend choice) so a compromised or careless superadmin
     * session can't silently mint peers; that stays a direct-database
     * bootstrap action.
     *
     * For admin_internal/admin_marketing hires, the caller picks exactly
     * which sections of that role's dashboard this one employee can reach
     * (see User::PERMISSIONS_INTERNAL/PERMISSIONS_MARKETING) — invalid or
     * cross-role values are silently dropped rather than rejected (same
     * lenient-filter convention as users()'s `roles` param below), and
     * anything not applicable to the chosen role is simply empty. Nothing
     * is granted by default: a superadmin must explicitly opt a new hire
     * into each capability.
     */
    public function storeUser(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'handle' => ['nullable', 'string', 'max:64', 'alpha_dash', 'unique:users,handle'],
            'role' => ['required', Rule::in([User::ROLE_ADMIN_INTERNAL, User::ROLE_ADMIN_MARKETING, User::ROLE_ADMIN_TPO, User::ROLE_USER])],
            'college_id' => [
                Rule::requiredIf(fn () => $request->input('role') === User::ROLE_ADMIN_TPO),
                'nullable',
                'integer',
                'exists:colleges,id',
            ],
            'permissions' => ['nullable', 'array'],
            'permissions.*' => ['string'],
        ]);

        // Same seat cap every other student-creation path enforces — a
        // "strict" limit has no admin-tool backdoor. Only meaningful for a
        // student account; a TPO/staff account created against a college_id
        // isn't consuming a student seat.
        if ($validated['role'] === User::ROLE_USER && ! empty($validated['college_id'])) {
            $college = College::find($validated['college_id']);

            // See StudentImportService::import() for why this must come
            // before the seat-cap check below — a null studentLimit() means
            // EITHER "active and unlimited" OR "no active subscription",
            // and those can't share one null check.
            if (! $college->hasActiveSubscription()) {
                throw ValidationException::withMessages([
                    'college_id' => ["{$college->name}'s subscription has expired. Assign a plan before adding more students."],
                ]);
            }

            $limit = $college->studentLimit();

            if ($limit !== null && $college->studentCount() >= $limit) {
                $planName = $college->activePlan()?->name ?? 'current';

                throw ValidationException::withMessages([
                    'college_id' => ["{$college->name} is already at its {$planName} plan's limit of {$limit} students. Assign a bigger plan to add more."],
                ]);
            }
        }

        $temporaryPassword = Str::password(16);
        $allowedPermissions = User::permissionCatalogForRole($validated['role']);
        $grantedPermissions = array_values(array_intersect($validated['permissions'] ?? [], $allowedPermissions));

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'handle' => $validated['handle'] ?? Str::slug($validated['name']).'-'.Str::lower(Str::random(4)),
            'password' => Hash::make($temporaryPassword),
            'must_change_password' => true,
            'role' => $validated['role'],
            'college_id' => $validated['college_id'] ?? null,
            'permissions' => $allowedPermissions !== [] ? $grantedPermissions : null,
        ]);

        app(IssuedCredentialVault::class)->keep($user, $temporaryPassword, 'created', $request->user());

        ActivityLog::record(
            $request->user(),
            "Created account (role: {$user->role})",
            'User',
            $user->name,
            ['email' => $user->email]
        );

        // Onboarding a new marketing hire is exactly when any backlog of
        // unassigned leads (e.g. signups from before any marketing employee
        // existed) should get swept in, so the new hire starts with a fair
        // share rather than zero. Never touches already-assigned leads.
        if ($user->role === User::ROLE_ADMIN_MARKETING) {
            $sweptCount = app(LeadAssignmentService::class)->assignUnassignedLeads();

            if ($sweptCount > 0) {
                ActivityLog::record(
                    $request->user(),
                    "Auto-assigned {$sweptCount} backlog lead(s) to a new marketing hire",
                    'User',
                    $user->name
                );
            }

            // Same backlog sweep, for "Talk to Our Team" contact requests —
            // its own independent queue (see LeadAssignmentService::assignContactRequest()).
            $sweptContactRequests = app(LeadAssignmentService::class)->assignUnassignedContactRequests();

            if ($sweptContactRequests > 0) {
                ActivityLog::record(
                    $request->user(),
                    "Auto-assigned {$sweptContactRequests} backlog contact request(s) to a new marketing hire",
                    'User',
                    $user->name
                );
            }
        }

        // Same backlog sweep, for converted customers waiting on an
        // internal owner — see LeadAssignmentService::assignUnassignedCustomers().
        if ($user->role === User::ROLE_ADMIN_INTERNAL) {
            $sweptCount = app(LeadAssignmentService::class)->assignUnassignedCustomers();

            if ($sweptCount > 0) {
                ActivityLog::record(
                    $request->user(),
                    "Auto-assigned {$sweptCount} backlog customer(s) to a new internal hire",
                    'User',
                    $user->name
                );
            }
        }

        $emailed = SingleMail::now(new SendAccountCredentialsEmail($user->id, $temporaryPassword));

        return response()->json([
            'user' => $user->load('college:id,name'),
            'temporary_password' => $temporaryPassword,
            'credentials_email_sent' => $emailed,
        ], 201);
    }

    /**
     * Block/unblock any account, including other staff. Guarded against
     * locking yourself out and against blocking away the platform's last
     * active superadmin — either would leave nobody able to reverse it.
     */
    public function toggleBlock(Request $request, User $user)
    {
        if ($user->id === $request->user()->id) {
            return response()->json(['message' => 'You cannot block your own account.'], 422);
        }

        if ($user->role === User::ROLE_SUPERADMIN && ! $user->is_blocked) {
            $anotherActiveSuperadminExists = User::where('role', User::ROLE_SUPERADMIN)
                ->where('id', '!=', $user->id)
                ->where('is_blocked', false)
                ->exists();

            if (! $anotherActiveSuperadminExists) {
                return response()->json(['message' => 'Cannot block the last active superadmin account.'], 422);
            }
        }

        $validated = $request->validate([
            'reason' => ['nullable', 'string', 'max:255'],
        ]);

        $user->is_blocked = ! $user->is_blocked;
        $user->blocked_at = $user->is_blocked ? now() : null;
        $user->blocked_reason = $user->is_blocked ? ($validated['reason'] ?? null) : null;
        $user->blocked_by = $user->is_blocked ? $request->user()->id : null;
        $user->save();

        ActivityLog::record(
            $request->user(),
            $user->is_blocked ? 'Blocked an account' : 'Unblocked an account',
            'User',
            $user->name,
            array_filter(['role' => $user->role, 'reason' => $validated['reason'] ?? null])
        );

        return response()->json(['user' => $user->fresh(['college:id,name'])]);
    }

    /**
     * Give an account a new password — generated here, or typed by the superadmin
     * in `new_password` — and show it to them. Passwords are stored as one-way
     * hashes, so this (and the credential lookup in SuperAdminCredentialController,
     * which covers the temporary password an account was issued) is how a superadmin
     * gets a login they can read.
     *
     * By default the new password is temporary: the owner must replace it at next
     * sign-in, and until they do the superadmin can look it up again (it is kept
     * encrypted, see IssuedCredentialVault). With `require_change` off the superadmin
     * is setting the owner's permanent password: nothing is kept, because there is no
     * "issued, not yet replaced" state to look up.
     *
     * The old password stops working immediately and every session the account
     * has open is signed out; the user must choose their own password at next
     * login. Superadmin accounts are excluded on purpose: they never get a
     * self-service reset (see PasswordResetService::requestOtp()), so letting
     * one superadmin mint and read another's password would hand out a
     * takeover of the platform's top role. The caller must re-enter their own
     * password — a stolen session token alone must not be enough to take over
     * every account on the platform.
     */
    public function resetPassword(Request $request, User $user)
    {
        $validated = $request->validate([
            'password' => ['required', 'string'],
            'send_email' => ['sometimes', 'boolean'],
            // bcrypt only reads the first 72 bytes — a longer password would silently ignore the tail.
            'new_password' => ['sometimes', 'nullable', 'string', 'min:8', 'max:72'],
            'require_change' => ['sometimes', 'boolean'],
        ]);

        $this->confirmSuperadminPassword($request, $validated['password']);

        if ($user->role === User::ROLE_SUPERADMIN) {
            return response()->json([
                'message' => 'Superadmin passwords cannot be reset or viewed here. A superadmin changes their own from Settings.',
            ], 422);
        }

        $chosen = isset($validated['new_password']) && $validated['new_password'] !== '';
        $requireChange = $request->boolean('require_change', true);

        if ($chosen && strcasecmp($validated['new_password'], $user->email) === 0) {
            throw ValidationException::withMessages(['new_password' => ['The password cannot be the same as the login email.']]);
        }

        $temporaryPassword = $chosen ? $validated['new_password'] : Str::password(16);

        DB::transaction(function () use ($user, $temporaryPassword, $requireChange, $request, $chosen) {
            $user->forceFill([
                'password' => Hash::make($temporaryPassword),
                'must_change_password' => $requireChange,
                // The credentials-email job refuses to send twice to one account; this is a new password, so it must be allowed to.
                'credentials_email_sent_at' => null,
            ])->save();

            // Sign the account out everywhere: the old password may be the very reason it is being reset.
            $user->tokens()->delete();

            $vault = app(IssuedCredentialVault::class);
            $requireChange
                ? $vault->keep($user, $temporaryPassword, $chosen ? 'set_by_superadmin' : 'reset', $request->user())
                : $vault->forget($user);
        });

        $emailed = $request->boolean('send_email')
            ? SingleMail::now(new SendAccountCredentialsEmail($user->id, $temporaryPassword))
            : null;

        // Whoever's account it is should find out an administrator changed their password — the bell is the first place they'll look.
        app(\App\Services\NotificationService::class)->notify($user, \App\Enums\NotificationType::PasswordChanged, 'An administrator changed your password', 'The AptRun team '.($chosen ? 'set a new' : 'reset your').' password for your account'.($requireChange ? ', and you will be asked to choose your own at next sign-in' : '').'. If you were not expecting this, contact support.', [
            'url' => '/settings?tab=security',
            'group_key' => 'password.admin:'.$user->id.':'.now()->format('YmdHis'),
            'actor' => $request->user(),
        ]);

        // Never the password itself — the audit trail is readable by other staff.
        ActivityLog::record(
            $request->user(),
            $chosen ? 'Set an account password' : 'Reset an account password and viewed the temporary password',
            'User',
            $user->name,
            ['role' => $user->role, 'emailed_to_user' => $emailed, 'must_change_at_next_login' => $requireChange]
        );

        return response()->json([
            'user' => $user->fresh(['college:id,name']),
            'temporary_password' => $temporaryPassword,
            'must_change_password' => $requireChange,
            // null = the superadmin chose not to email it; true/false = it was attempted.
            'credentials_email_sent' => $emailed,
        ]);
    }

    /**
     * What permanently deleting a university would remove — shown in the
     * confirmation dialog before anything is touched.
     */
    public function collegeDeletionPreview(College $college, CollegePurgeService $purge)
    {
        return response()->json([
            'college' => $college->only(['id', 'name', 'short_code']),
            'impact' => $purge->preview($college),
        ]);
    }

    /**
     * Permanently delete a university, its TPO/coordinator/student accounts and
     * everything it owns. Irreversible, so it takes THREE deliberate things: the
     * superadmin role (this route group), their own password, and the
     * university's exact name typed out. See CollegePurgeService for exactly
     * what goes and what stays. All-or-nothing: on any database refusal nothing
     * has been deleted.
     */
    public function destroyCollege(Request $request, College $college, CollegePurgeService $purge)
    {
        $validated = $request->validate([
            'password' => ['required', 'string'],
            'confirm_name' => ['required', 'string'],
        ]);

        $this->confirmSuperadminPassword($request, $validated['password']);

        if (! hash_equals($college->name, trim($validated['confirm_name']))) {
            throw ValidationException::withMessages([
                'confirm_name' => ['The name you typed does not match this university. Type it exactly, including capitals.'],
            ]);
        }

        // A large campus is a long delete (every student's data cascades). Don't let a closed tab or the
        // default time limit stop it half-way — it is one transaction, so it would roll back, but only after wasting the work.
        ignore_user_abort(true);
        @set_time_limit(0);

        $name = $college->name;

        try {
            $removed = $purge->purge($college);
        } catch (QueryException $e) {
            report($e);

            return response()->json(['message' => $this->collegePurgeFailureMessage($e)], 409);
        }

        ActivityLog::record($request->user(), 'Permanently deleted a partner university', 'College', $name, $removed);

        return response()->json(['deleted' => true, 'removed' => $removed]);
    }

    /**
     * Why a university delete was refused, in words a superadmin can act on. This endpoint is superadmin-only, so
     * naming the blocking table is fine — "still in use elsewhere" alone gave no way to tell a record that needs
     * clearing from a database that was merely busy. The full error is already in the log (report($e) above).
     */
    private function collegePurgeFailureMessage(QueryException $e): string
    {
        $driverCode = (int) ($e->errorInfo[1] ?? 0);

        // 1205 lock wait timeout, 1213 deadlock: another request held the same rows.
        if (in_array($driverCode, [1205, 1213], true)) {
            return 'The database was busy with other work on the same records. Nothing was deleted — wait a minute and try again.';
        }

        // 1451: a foreign key from a child table still points at a row being deleted.
        if ($driverCode === 1451 && preg_match('/fails \(`[^`]+`\.`([^`]+)`/', $e->getMessage(), $m) === 1) {
            return "The university could not be deleted because records in \"{$m[1]}\" still depend on it. Nothing was deleted.";
        }

        return 'The university could not be deleted because the database refused part of it (error '.($driverCode ?: 'unknown').'). Nothing was deleted; the details are in the server log.';
    }

    /**
     * Change an existing admin_internal/admin_marketing employee's granted
     * sections after the fact — access needs change as people are trusted
     * with more (or less), not just once at hire time. Only ever meaningful
     * for those two roles; any other target 422s, same pattern
     * toggleBlock()'s role allow-list already uses elsewhere in this
     * codebase. Replaces the whole set rather than patching it — the
     * frontend always sends the complete intended list, so there's no
     * ambiguity about "did they mean to remove this one".
     */
    public function updatePermissions(Request $request, User $user)
    {
        $allowedPermissions = User::permissionCatalogForRole($user->role);

        if ($allowedPermissions === []) {
            return response()->json(['message' => 'This account\'s role has no granular permissions to manage.'], 422);
        }

        $validated = $request->validate([
            'permissions' => ['required', 'array'],
            'permissions.*' => ['string'],
        ]);

        $user->permissions = array_values(array_intersect($validated['permissions'], $allowedPermissions));
        $user->save();

        ActivityLog::record(
            $request->user(),
            'Updated an employee\'s granted access',
            'User',
            $user->name,
            ['permissions' => $user->permissions]
        );

        return response()->json(['user' => $user->fresh()]);
    }

    /**
     * Real, segmented platform counts for the Overview tab — every figure
     * is a separate, unfiltered COUNT/SUM query (same pattern
     * MarketingLeadController::index() already uses for its KPIs), never
     * derived from a paginated page's data.
     */
    public function overview()
    {
        $segments = [
            'students' => User::where('role', User::ROLE_USER)->whereNotNull('college_id')->count(),
            'leads' => User::mellowDirectLeads()->count(),
            // "Talk to Our Team" contact requests — a different lead type
            // from the Mellow Direct leads above (never a User row, see
            // ContactRequest's own docblock), so its own segment.
            'contact_requests' => ContactRequest::count(),
            'unassigned_contact_requests' => ContactRequest::whereNull('assigned_marketing_id')->count(),
            'newsletter_subscribers' => NewsletterSubscriber::whereNull('unsubscribed_at')->count(),
            // A company-invited candidate is neither a student (no college)
            // nor a Mellow Direct lead (see scopeMellowDirectLeads) — its
            // own segment, rather than silently missing from this breakdown.
            'candidates' => User::where('role', User::ROLE_USER)->whereNotNull('invited_by_company_id')->count(),
            'colleges' => College::count(),
            'companies' => Company::where('account_type', Company::ACCOUNT_TYPE_HIRING_TENANT)->count(),
            'admin_tpo' => User::where('role', User::ROLE_ADMIN_TPO)->count(),
            'admin_internal' => User::where('role', User::ROLE_ADMIN_INTERNAL)->count(),
            'admin_marketing' => User::where('role', User::ROLE_ADMIN_MARKETING)->count(),
            'admin_company' => User::where('role', User::ROLE_ADMIN_COMPANY)->count(),
            'superadmin' => User::where('role', User::ROLE_SUPERADMIN)->count(),
        ];

        $individualSubs = Subscription::where('status', Subscription::STATUS_ACTIVE)
            ->where('subscriber_type', User::class)
            ->with('plan')
            ->get();

        $institutionalSubs = Subscription::where('status', Subscription::STATUS_ACTIVE)
            ->where('subscriber_type', College::class)
            ->with('plan')
            ->get();

        // Add-on rows (Project Lab) sit in the same table as plans. They are
        // revenue, but not additional "subscribers" — one student on Expert +
        // Project Lab is one paying student with two lines — so they are kept
        // out of `count` and reported separately.
        $baseSubs = $individualSubs->reject(fn (Subscription $s) => $s->plan?->isAddon());
        $addonSubs = $individualSubs->filter(fn (Subscription $s) => $s->plan?->isAddon());

        // What the student was actually charged for the line (a bundled add-on
        // is discounted), falling back to list price for rows from before
        // purchases recorded it.
        $linePrice = fn (Subscription $s): int => (int) ($s->meta['price_paid'] ?? $s->plan?->salePrice() ?? 0);

        // Individual plans are billed per term — a 30-day add-on or legacy plan, a
        // 365-day Expert, a three-year Grandmaster — so a flat sum of what was paid is NOT a
        // monthly figure. Each line is spread over its own term and expressed per
        // 30 days; a plan that never expires (free Coder) contributes nothing.
        // A plan given by hand for a custom term (SubscriptionService::grantIndividualPlan) records that
        // term, and it — not the plan's usual length — is what the money was paid for.
        $monthlyEquivalent = function (Subscription $s) use ($linePrice): float {
            $termDays = (int) ($s->meta['term_days'] ?? $s->plan?->duration_days ?? 0);

            return $termDays > 0 ? $linePrice($s) * 30 / $termDays : 0.0;
        };

        $institutionalPriced = $institutionalSubs->filter(fn (Subscription $s) => $s->plan?->annual_price !== null);

        return response()->json([
            'segments' => $segments,
            'submissions_today' => Submission::where('submitted_on', now()->toDateString())->count(),
            'signups_last_7_days' => User::where('created_at', '>=', now()->subDays(7))->count(),
            // Each individual subscription's price (what the student was charged,
            // else the plan's sale price) spread over its own billing term and
            // expressed per 30 days — so a ₹1,199 yearly plan counts as about ₹98
            // a month and a legacy ₹399 30-day plan as ₹399. Not fabricated, but
            // explicitly the price on file, not collected cash (no payment
            // gateway exists yet).
            'individual_recurring' => [
                'count' => $baseSubs->count(),
                'monthly_total' => (int) round($individualSubs->sum($monthlyEquivalent)),
                'addon_count' => $addonSubs->count(),
                'addon_monthly_total' => (int) round($addonSubs->sum($monthlyEquivalent)),
            ],
            // Institutional subs bill annually. Academic Enterprise has no
            // fixed annual_price on file (custom/enterprise sales) — those
            // are counted separately and never assigned a fabricated number.
            'institutional_recurring' => [
                'count' => $institutionalPriced->count(),
                'annual_total' => $institutionalPriced->sum(fn (Subscription $s) => $s->plan->annual_price),
                'custom_priced_count' => $institutionalSubs->count() - $institutionalPriced->count(),
            ],
            'recent_activity' => ActivityLog::with('actor:id,name')->latest()->limit(6)->get(),
        ]);
    }

    /**
     * Per-marketing-employee performance for the superadmin "Marketing
     * Performance" tab: how many leads each one was actually assigned
     * (least-loaded auto-assignment, see LeadAssignmentService), how many
     * they converted, and their conversion rate — the drill-down
     * OverviewPanel's platform-wide `segments.leads`/`admin_marketing`
     * counts can't answer on their own. Every count is a real, scoped
     * withCount() query, same bounded-per-row precedent as
     * MarketingLeadController::index()'s KPIs.
     */
    public function marketingPerformance()
    {
        $employees = User::where('role', User::ROLE_ADMIN_MARKETING)
            ->withCount([
                'assignedLeads',
                'assignedLeads as converted_leads_count' => fn ($q) => $q->where('lead_status', User::LEAD_STATUS_CONVERTED),
                'assignedLeads as new_leads_count' => fn ($q) => $q->where('lead_status', User::LEAD_STATUS_NEW),
                'assignedLeads as leads_this_week_count' => fn ($q) => $q->where('created_at', '>=', now()->subDays(7)),
            ])
            ->orderByDesc('assigned_leads_count')
            ->get();

        $totalAssigned = $employees->sum('assigned_leads_count');
        $totalConverted = $employees->sum('converted_leads_count');

        return response()->json([
            'employees' => $employees->map(fn (User $e) => [
                'id' => $e->id,
                'name' => $e->name,
                'email' => $e->email,
                'is_blocked' => $e->is_blocked,
                'assigned_count' => $e->assigned_leads_count,
                'new_count' => $e->new_leads_count,
                'converted_count' => $e->converted_leads_count,
                'assigned_this_week' => $e->leads_this_week_count,
                'conversion_rate' => $e->assigned_leads_count > 0
                    ? round(($e->converted_leads_count / $e->assigned_leads_count) * 100, 1)
                    : 0,
            ]),
            'totals' => [
                'employee_count' => $employees->count(),
                'total_assigned' => $totalAssigned,
                'total_converted' => $totalConverted,
                'overall_conversion_rate' => $totalAssigned > 0 ? round(($totalConverted / $totalAssigned) * 100, 1) : 0,
                'unassigned_leads' => User::mellowDirectLeads()
                    ->whereNull('assigned_marketing_id')
                    ->count(),
            ],
        ]);
    }

    /**
     * The platform's real admin-action trail. Every write here comes from
     * ActivityLog::record() calls placed at the actual sensitive actions
     * (college onboarding, account creation, block/unblock, flag toggles) —
     * nothing is synthesized for display. Filterable/paginated instead of a
     * hard-capped 50 rows with no way to see further back.
     */
    public function auditLogs(Request $request)
    {
        $query = ActivityLog::with('actor:id,name');

        if ($actorRole = $request->query('actor_role')) {
            $query->where('actor_role', $actorRole);
        }

        if ($targetType = $request->query('target_type')) {
            $query->where('target_type', $targetType);
        }

        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('action', 'like', "%{$search}%")
                    ->orWhere('target_label', 'like', "%{$search}%")
                    ->orWhere('actor_name', 'like', "%{$search}%");
            });
        }

        if ($from = $request->query('from')) {
            $query->whereDate('created_at', '>=', $from);
        }

        if ($to = $request->query('to')) {
            $query->whereDate('created_at', '<=', $to);
        }

        return response()->json(['logs' => $query->latest()->paginate(30)]);
    }

    /**
     * Live judge telemetry: every configured Piston node probed right now,
     * per-priority queue depths, throughput and estimated wait. Measured,
     * never stored — see JudgeStatusService.
     */
    public function judgeNodes(JudgeStatusService $status)
    {
        return response()->json($status->snapshot());
    }

    /**
     * Real, persisted platform config toggles. See FeatureFlag/the
     * create_feature_flags_table migration for what "real" does and
     * doesn't mean here — persistence yes, runtime gating not yet.
     */
    public function featureFlags()
    {
        $flags = FeatureFlag::with('updatedBy:id,name')->orderBy('category')->orderBy('name')->get();

        return response()->json(['flags' => $flags->map(fn (FeatureFlag $f) => $this->flagSummary($f))]);
    }

    public function toggleFeatureFlag(Request $request, FeatureFlag $flag)
    {
        $flag->enabled = ! $flag->enabled;
        $flag->updated_by = $request->user()->id;
        $flag->save();

        ActivityLog::record(
            $request->user(),
            $flag->enabled ? 'Enabled a feature flag' : 'Disabled a feature flag',
            'FeatureFlag',
            $flag->name
        );

        return response()->json(['flag' => $this->flagSummary($flag->fresh(['updatedBy:id,name']))]);
    }

    /**
     * Named `updated_by_name` rather than relying on the `updatedBy` relation
     * serializing under the `updated_by` key — that would silently collide
     * with (and shadow) the real `updated_by` FK column of the same name.
     */
    private function flagSummary(FeatureFlag $flag): array
    {
        return [
            'id' => $flag->id,
            'key' => $flag->key,
            'name' => $flag->name,
            'description' => $flag->description,
            'category' => $flag->category,
            'enabled' => $flag->enabled,
            'updated_by_name' => $flag->updatedBy?->name,
            'updated_at' => $flag->updated_at,
        ];
    }
}
