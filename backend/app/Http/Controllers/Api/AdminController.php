<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\SendAccountCredentialsEmail;
use App\Models\ActivityLog;
use App\Models\Article;
use App\Models\College;
use App\Models\Company;
use App\Models\Contest;
use App\Models\Interview;
use App\Models\PlacementDrive;
use App\Models\Plan;
use App\Models\Problem;
use App\Models\Submission;
use App\Models\User;
use App\Services\SectionCoordinatorService;
use App\Services\SubscriptionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * Mellow-internal-staff-only operations (role: admin_internal, superadmin).
 * A college_tpo account is blocked from every route here by the
 * role:admin_internal,superadmin middleware applied in routes/api.php —
 * that is what makes "TPOs can't see the Mellow dashboard" a server-enforced
 * fact rather than a UI convention.
 */
class AdminController extends Controller
{
    /**
     * Real, database-backed KPIs for the Mellow Ops "Overview" tab — every
     * figure is a live COUNT/SUM query, same convention as
     * SuperAdminController::overview(), just scoped to what admin_internal
     * actually manages (colleges, the individual-coder platform-user base,
     * the shared companies/contests/problems catalog) rather than the
     * superadmin-only staff/revenue breakdown. Colleges/TPOs is the only
     * segment admin_internal manages that superadmin's own overview also
     * happens to report, and deliberately reused rather than reimplemented.
     */
    public function overview()
    {
        return response()->json([
            'segments' => [
                'colleges' => College::count(),
                'platform_users' => User::where('role', User::ROLE_USER)->count(),
                'companies' => Company::count(),
                'contests' => Contest::count(),
                'interviews' => Interview::count(),
                'placement_drives' => PlacementDrive::count(),
                'problems' => Problem::count(),
                'articles' => Article::count(),
            ],
            'submissions_today' => Submission::where('submitted_on', now()->toDateString())->count(),
            'signups_last_7_days' => User::where('role', User::ROLE_USER)->where('created_at', '>=', now()->subDays(7))->count(),
            // Colleges whose institutional plan lapses within 2 weeks — a
            // real, actionable renewal-risk list, not a decorative count.
            'colleges_renewing_soon' => College::all()
                ->map(function (College $college) {
                    $subscription = $college->activeSubscription();

                    return $subscription?->isActive()
                        ? ['id' => $college->id, 'name' => $college->name, 'days_remaining' => $subscription->daysRemaining()]
                        : null;
                })
                ->filter(fn (?array $c) => $c !== null && $c['days_remaining'] <= 14)
                ->sortBy('days_remaining')
                ->values(),
        ]);
    }

    /**
     * List every partner college together with its TPO account(s), for the
     * Mellow "Partner Universities" governance screen.
     */
    public function colleges()
    {
        $colleges = College::withCount(['users as active_students_count' => function ($query) {
            $query->where('role', User::ROLE_USER);
        }])
            ->with(['users' => function ($query) {
                $query->where('role', User::ROLE_ADMIN_TPO);
            }])
            ->latest()
            ->get();

        // Attach each college's current plan status so the "Partner
        // Universities" screen can show a countdown without a per-row
        // follow-up request — not a stored column, so this can't drift.
        $colleges->each(function (College $college) {
            $subscription = $college->activeSubscription();
            $college->subscription_days_remaining = $subscription?->isActive() ? $subscription->daysRemaining() : null;
            $college->subscription_status = $subscription?->status;
            // Null legitimately means custom/Academic-Enterprise pricing with
            // no fixed number on file — never fabricated as a real figure.
            $college->plan_price = $subscription?->plan?->annual_price;
        });

        return response()->json(['colleges' => $colleges]);
    }

    /**
     * Onboard a new partner college and provision its TPO account in one step.
     */
    public function storeCollege(Request $request, SubscriptionService $subscriptionService)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'short_code' => ['nullable', 'string', 'max:20', 'unique:colleges,short_code'],
            'city' => ['nullable', 'string', 'max:255'],
            'state' => ['nullable', 'string', 'max:255'],
            'tier' => ['required', Rule::in(['Academic Enterprise', 'Pro Campus', 'Standard'])],
            'tpo_name' => ['required', 'string', 'max:255'],
            'tpo_email' => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
        ]);

        [$college, $tpo, $temporaryPassword] = DB::transaction(function () use ($validated) {
            $college = College::create([
                'name' => $validated['name'],
                'short_code' => $validated['short_code'] ?? $this->uniqueShortCode($validated['name']),
                'city' => $validated['city'] ?? null,
                'state' => $validated['state'] ?? null,
                'tier' => $validated['tier'],
            ]);

            $temporaryPassword = Str::password(16);

            $tpo = User::create([
                'name' => $validated['tpo_name'],
                'email' => $validated['tpo_email'],
                'handle' => Str::slug($validated['tpo_name']).'-'.Str::lower(Str::random(4)),
                'password' => Hash::make($temporaryPassword),
                'must_change_password' => true,
                'role' => User::ROLE_ADMIN_TPO,
                'college_id' => $college->id,
            ]);

            return [$college, $tpo, $temporaryPassword];
        });

        // The tier chosen at onboarding IS the institution plan — activate
        // it immediately so the college is subscribed from day one, rather
        // than requiring a separate follow-up step.
        $plan = Plan::where('audience', Plan::AUDIENCE_INSTITUTION)->where('name', $college->tier)->first();
        if ($plan !== null) {
            $subscriptionService->assignInstitutionPlan($college, $plan, $request->user());
        }

        ActivityLog::record(
            $request->user(),
            'Onboarded a new partner college',
            'College',
            $college->name,
            ['tier' => $college->tier, 'tpo_email' => $tpo->email]
        );

        SendAccountCredentialsEmail::dispatch($tpo->id, $temporaryPassword);

        return response()->json([
            'college' => $college,
            'tpo' => $tpo,
            'temporary_password' => $temporaryPassword,
        ], 201);
    }

    /**
     * Derives a short code from the college name when the caller didn't
     * supply one, guaranteed unique by appending a numeric suffix on
     * collision — two colleges sharing the first few letters of their name
     * (e.g. two "Indian Institute of Technology..." campuses) would
     * otherwise both derive the same truncated code and the second
     * onboarding would fail with a raw, unhandled unique-constraint DB
     * error instead of just... picking a different code.
     */
    private function uniqueShortCode(string $name): string
    {
        $base = Str::upper(Str::substr(Str::slug($name, ''), 0, 6)) ?: 'COLLEGE';
        $code = $base;
        $suffix = 1;

        while (College::where('short_code', $code)->exists()) {
            $suffix++;
            $code = "{$base}{$suffix}";
        }

        return $code;
    }

    /**
     * List TPO (and other) accounts scoped to a specific college.
     */
    public function collegeTpos(College $college)
    {
        return response()->json([
            'college' => $college,
            'tpos' => $college->tpoAdmins()->get(),
        ]);
    }

    /**
     * Assign, change or renew a college's institutional plan. Always
     * admin-triggered — a college "buys the whole sandbox" through a sales
     * conversation, never a self-serve checkout — and covers every student
     * at that college for free (see User::effectiveSubscription()).
     */
    public function assignCollegeSubscription(Request $request, College $college, SubscriptionService $subscriptionService)
    {
        $validated = $request->validate([
            'plan_code' => ['required', 'string', 'exists:plans,code'],
        ]);

        $plan = Plan::where('code', $validated['plan_code'])->first();

        if ($plan->audience !== Plan::AUDIENCE_INSTITUTION) {
            return response()->json(['message' => 'That plan is not an institution plan.'], 422);
        }

        $subscription = $subscriptionService->assignInstitutionPlan($college, $plan, $request->user());

        return response()->json([
            'college' => $college->fresh(),
            'subscription' => [
                'plan' => ['code' => $plan->code, 'name' => $plan->name],
                'days_remaining' => $subscription->daysRemaining(),
                'started_at' => $subscription->started_at,
                'current_period_end' => $subscription->current_period_end,
            ],
        ]);
    }

    /**
     * Block or unblock a TPO account. Mellow staff manage TPOs; TPOs cannot
     * touch this endpoint (blocked by the role middleware) nor each other's
     * accounts (not exposed to them at all).
     */
    public function toggleTpoBlock(Request $request, User $user)
    {
        $result = $this->toggleBlock($request, $user, [User::ROLE_ADMIN_TPO], 'This endpoint only manages college TPO accounts.');

        return $result instanceof User ? response()->json(['tpo' => $result->fresh('college')]) : $result;
    }

    /**
     * Section Coordinator management, scoped to any college Ops/superadmin
     * chooses — the escape hatch for support/onboarding scenarios a TPO
     * can't or hasn't handled themselves (TpoCoordinatorController's own
     * routes are deliberately admin_tpo-only and scoped to
     * $user->college_id, which staff accounts don't have). Every method
     * here reuses SectionCoordinatorService — the exact same account-
     * creation/section-uniqueness logic as the TPO's own self-service path,
     * so the two can never drift apart.
     */
    public function collegeCoordinators(College $college, SectionCoordinatorService $coordinators)
    {
        $list = $coordinators->listFor($college->id);

        return response()->json([
            'coordinators' => $list->map(fn (User $c) => $coordinators->payload($c, $college->id))->all(),
        ]);
    }

    public function storeCoordinatorForCollege(Request $request, College $college, SectionCoordinatorService $coordinators)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255'],
            'section' => ['required', 'string', 'max:20'],
            'phone' => ['nullable', 'string', 'max:20'],
        ]);

        $coordinator = $coordinators->create($college->id, $validated, $request->user());

        return response()->json([
            'coordinator' => $coordinators->payload($coordinator, $college->id),
        ], 201);
    }

    /** Reassign which section a coordinator covers — same as the TPO's own update(), just reachable without being that coordinator's own TPO. */
    public function updateCoordinatorSection(Request $request, User $user, SectionCoordinatorService $coordinators)
    {
        abort_unless($user->role === User::ROLE_SECTION_COORDINATOR, 404);

        $validated = $request->validate([
            'section' => ['required', 'string', 'max:20'],
            'phone' => ['nullable', 'string', 'max:20'],
        ]);

        $coordinator = $coordinators->updateSection($user, $validated);

        return response()->json(['coordinator' => $coordinators->payload($coordinator, $coordinator->college_id)]);
    }

    public function toggleCoordinatorBlock(Request $request, User $user, SectionCoordinatorService $coordinators)
    {
        $result = $this->toggleBlock($request, $user, [User::ROLE_SECTION_COORDINATOR], 'This endpoint only manages Section Coordinator accounts.');

        return $result instanceof User
            ? response()->json(['coordinator' => $coordinators->payload($result->fresh(), $result->college_id)])
            : $result;
    }

    /**
     * List student/coder ("user" role) accounts, for the Mellow "Platform
     * Users" management screen — separate from TPO accounts, which are
     * managed only via the colleges endpoints above.
     */
    /**
     * Paginated (not a bare ->get()) — a single college's bulk-imported
     * roster alone can run into the thousands, and this list spans every
     * college combined, so an unpaginated response would ship the whole
     * students table on every page load.
     */
    public function users(Request $request)
    {
        $query = User::where('role', User::ROLE_USER)->with('college:id,name');

        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('handle', 'like', "%{$search}%");
            });
        }

        return $query->latest()->paginate(50);
    }

    /**
     * Create a new student/coder account on a user's behalf (e.g. onboarding
     * someone without requiring them to self-register first, or adding a
     * single straggler to a college's roster without a full CSV re-upload).
     */
    public function storeUser(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'handle' => ['required', 'string', 'max:64', 'alpha_dash', 'unique:users,handle'],
            'college_id' => ['nullable', 'integer', 'exists:colleges,id'],
        ]);

        $temporaryPassword = Str::password(16);

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'handle' => $validated['handle'],
            'password' => Hash::make($temporaryPassword),
            'must_change_password' => true,
            'role' => User::ROLE_USER,
            'college_id' => $validated['college_id'] ?? null,
        ]);

        ActivityLog::record($request->user(), 'Created a student account', 'User', $user->name, ['email' => $user->email]);

        SendAccountCredentialsEmail::dispatch($user->id, $temporaryPassword);

        return response()->json([
            'user' => $user->load('college:id,name'),
            'temporary_password' => $temporaryPassword,
        ], 201);
    }

    /**
     * Block or unblock a student/coder account.
     */
    public function toggleUserBlock(Request $request, User $user)
    {
        $result = $this->toggleBlock($request, $user, [User::ROLE_USER], 'This endpoint only manages student/coder accounts.');

        return $result instanceof User ? response()->json(['user' => $result->fresh()]) : $result;
    }

    /**
     * Shared block/unblock logic, scoped to an allow-list of roles so Mellow
     * staff can only ever moderate TPOs and students — never other staff or
     * superadmin accounts.
     */
    private function toggleBlock(Request $request, User $user, array $allowedRoles, string $errorMessage)
    {
        if (! in_array($user->role, $allowedRoles, true)) {
            return response()->json(['message' => $errorMessage], 422);
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

        return $user;
    }
}
