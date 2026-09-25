<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\SendAccountCredentialsEmail;
use App\Models\ActivityLog;
use App\Models\College;
use App\Models\Company;
use App\Models\FeatureFlag;
use App\Models\Submission;
use App\Models\Subscription;
use App\Models\User;
use App\Services\Judge\JudgeStatusService;
use App\Services\LeadAssignmentService;
use App\Services\StudentStatsService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

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

        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('handle', 'like', "%{$search}%");
            });
        }

        if ($roles = $request->query('roles')) {
            $validRoles = array_intersect(explode(',', $roles), User::ROLES);
            if ($validRoles !== []) {
                $query->whereIn('role', $validRoles);
            }
        } elseif ($role = $request->query('role')) {
            $query->where('role', $role);
        }

        if ($request->has('has_college')) {
            $request->boolean('has_college')
                ? $query->whereNotNull('college_id')
                : $query->whereNull('college_id');
        }

        // Lets the Students tab narrow to one college's roster at a time.
        if ($collegeId = $request->query('college_id')) {
            $query->where('college_id', $collegeId);
        }

        $page = $query->latest()->paginate(50);

        // Real, cheap-per-row enrichment bounded to this one page (≤50 rows)
        // — same bounded-loop precedent as AdminController::colleges() and
        // MarketingLeadController::leadSummary(), never run across the whole
        // unfiltered table.
        $page->getCollection()->transform(function (User $user) {
            $user->subscription_plan_name = $user->effectiveSubscription()?->plan?->name;
            if ($user->role === User::ROLE_USER) {
                $user->readiness_tier = $user->readinessTier();
            }

            return $user;
        });

        return $page;
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

        SendAccountCredentialsEmail::dispatch($user->id, $temporaryPassword);

        return response()->json([
            'user' => $user->load('college:id,name'),
            'temporary_password' => $temporaryPassword,
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

        $institutionalPriced = $institutionalSubs->filter(fn (Subscription $s) => $s->plan?->annual_price !== null);

        return response()->json([
            'segments' => $segments,
            'submissions_today' => Submission::where('submitted_on', now()->toDateString())->count(),
            'signups_last_7_days' => User::where('created_at', '>=', now()->subDays(7))->count(),
            // Individual subs bill on a real ~30-day cycle at monthly_price
            // (SubscriptionService::activate() sets current_period_end
            // accordingly), so this sum genuinely is a monthly recurring
            // figure — not fabricated, but explicitly list-price, not
            // collected cash (no payment gateway exists yet).
            'individual_recurring' => [
                'count' => $individualSubs->count(),
                'monthly_total' => $individualSubs->sum(fn (Subscription $s) => $s->plan?->monthly_price ?? 0),
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
