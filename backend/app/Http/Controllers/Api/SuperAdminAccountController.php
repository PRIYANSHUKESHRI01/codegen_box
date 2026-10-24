<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\ConfirmsSuperadminPassword;
use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\College;
use App\Models\PaymentOrder;
use App\Models\Subscription;
use App\Models\User;
use App\Services\IssuedCredentialVault;
use App\Services\SubscriptionAdminPresenter;
use App\Services\SubscriptionPresenter;
use App\Services\UserPurgeService;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Superadmin → manage ONE account, whatever its role: the 360° view behind the
 * "Manage" drawer (who they are, how they sign in, what plan they hold and
 * what it cost, what they paid, what was done to them), plus the hand tools —
 * edit their details, sign them out everywhere, look at the product the way they
 * see it, or delete them for good.
 *
 * Everything that can lock someone out, impersonate them or destroy data asks for
 * the superadmin's own password (ConfirmsSuperadminPassword) and shares the tight
 * `superadmin-sensitive` limiter. Superadmin accounts are never a target of
 * edit / sign-out / view-as / delete: they have no self-service recovery by
 * design, so one superadmin must not be able to reach another's account.
 */
class SuperAdminAccountController extends Controller
{
    use ConfirmsSuperadminPassword;

    /** How long a "view as" session lasts before it simply stops working. */
    public const IMPERSONATION_MINUTES = 60;

    public function __construct(
        private readonly SubscriptionAdminPresenter $subscriptionRows,
        private readonly SubscriptionPresenter $coverage,
        private readonly UserPurgeService $purger,
        private readonly IssuedCredentialVault $credentialVault,
    ) {}

    // ─────────────────────────────── read ───────────────────────────────

    public function show(Request $request, User $user): JsonResponse
    {
        $user->loadMissing(['college:id,name', 'company:id,name', 'blockedBy:id,name']);
        $isSuperadmin = $user->role === User::ROLE_SUPERADMIN;
        $isSelf = $user->id === $request->user()->id;

        return response()->json([
            'user' => $this->identity($user),
            'login' => [
                'login_id' => $user->email,
                // Never the password itself: it is a one-way hash, and a user replaces a temporary one at first login.
                'password_state' => $user->must_change_password ? 'temporary' : 'set_by_user',
                // Whether the temporary password can be looked up (lookup itself: SuperAdminCredentialController).
                'credential_state' => $this->credentialVault->statesFor([$user])[$user->id],
                'credentials_email_sent_at' => $user->credentials_email_sent_at,
                'last_seen_at' => $user->last_seen_at,
                'active_sessions' => $user->tokens()->count(),
            ],
            'plan' => $user->role === User::ROLE_USER ? $this->planBlock($user) : null,
            'payments' => PaymentOrder::where('user_id', $user->id)->latest('id')->limit(10)->get()->map->toReceipt()->values(),
            'activity' => $this->activity($user),
            'capabilities' => [
                'edit' => ! $isSuperadmin,
                'reset_password' => ! $isSuperadmin,
                'revoke_sessions' => ! $isSuperadmin && ! $isSelf,
                'view_as' => ! $isSuperadmin && ! $isSelf && ! $user->is_blocked,
                'delete' => ! $isSelf && $this->purger->canDelete($user),
                'grant_plan' => $user->role === User::ROLE_USER,
                'block' => ! $isSelf,
            ],
        ]);
    }

    // ─────────────────────────────── edit ───────────────────────────────

    /**
     * Correct an account's details: the things support gets asked to fix (a typo
     * in an email, a wrong roll number, a student who moved colleges). Sends
     * only what changed; the audit log records each field's before and after.
     * Never touches the password, role, block state or permissions — those have
     * their own, more deliberate, actions.
     */
    public function update(Request $request, User $user): JsonResponse
    {
        if ($user->role === User::ROLE_SUPERADMIN) {
            throw ValidationException::withMessages(['user' => ['A superadmin changes their own details from Settings.']]);
        }

        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'email' => ['sometimes', 'required', 'string', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'handle' => ['sometimes', 'nullable', 'string', 'max:64', 'alpha_dash', Rule::unique('users', 'handle')->ignore($user->id)],
            'phone' => ['sometimes', 'nullable', 'string', 'max:20'],
            'roll_number' => ['sometimes', 'nullable', 'string', 'max:255'],
            'branch' => ['sometimes', 'nullable', 'string', 'max:255'],
            'section' => ['sometimes', 'nullable', 'string', 'max:50'],
            'cgpa' => ['sometimes', 'nullable', 'numeric', 'between:0,10'],
            'backlogs' => ['sometimes', 'nullable', 'integer', 'between:0,99'],
            'college_id' => ['sometimes', 'integer', 'exists:colleges,id'],
        ]);

        // Moving a student to a college is only for an account that already belongs to one: taking a
        // lead into a college, or a TPO to another, is a different decision with its own tools.
        if (array_key_exists('college_id', $validated)) {
            if ($user->role !== User::ROLE_USER || $user->college_id === null) {
                throw ValidationException::withMessages(['college_id' => ['Only a student who already belongs to a college can be moved to another one here.']]);
            }

            if ((int) $validated['college_id'] !== (int) $user->college_id) {
                $this->assertRoomInCollege(College::findOrFail($validated['college_id']));
            }
        }

        $before = $user->only(array_keys($validated));
        $user->fill(collect($validated)->except('college_id')->all());

        if (array_key_exists('college_id', $validated)) {
            $user->college_id = $validated['college_id'];
        }

        // A changed number is no longer the one that was verified by SMS — they will have to verify it again.
        if ($user->isDirty('phone')) {
            $user->phone_verified_at = null;
        }

        $changes = [];
        foreach ($user->getDirty() as $field => $after) {
            if (in_array($field, ['phone_verified_at'], true)) {
                continue;
            }
            $changes[$field] = ['from' => $before[$field] ?? null, 'to' => $after];
        }

        if ($changes === []) {
            return response()->json(['user' => $this->identity($user->fresh(['college:id,name', 'company:id,name', 'blockedBy:id,name']))]);
        }

        $user->save();

        ActivityLog::record($request->user(), "Edited an account's details", 'User', $user->name, [
            'user_id' => $user->id,
            'role' => $user->role,
            'changes' => $changes,
        ]);

        return response()->json(['user' => $this->identity($user->fresh(['college:id,name', 'company:id,name', 'blockedBy:id,name']))]);
    }

    // ─────────────────────────── sign-out / view-as ───────────────────────────

    /**
     * Signs the account out of every device at once. The next request each open
     * session makes is refused (401) and lands on the login page. Does not change
     * the password, so they can sign straight back in — for "this account might be
     * shared or stolen": reset the password too.
     */
    public function revokeSessions(Request $request, User $user): JsonResponse
    {
        if ($user->role === User::ROLE_SUPERADMIN || $user->id === $request->user()->id) {
            throw ValidationException::withMessages(['user' => ['You cannot sign this account out from here.']]);
        }

        $revoked = $user->tokens()->delete();

        ActivityLog::record($request->user(), 'Signed an account out of all devices', 'User', $user->name, [
            'user_id' => $user->id,
            'role' => $user->role,
            'sessions_ended' => $revoked,
        ]);

        return response()->json(['revoked' => $revoked]);
    }

    /**
     * "View as": a short-lived, READ-ONLY session as the account, so the
     * superadmin can see exactly what its owner sees (dashboard, plan, locked
     * pages) without knowing — or changing — their password.
     *
     * The token carries the single `impersonated` ability and expires in
     * IMPERSONATION_MINUTES; RejectWritesWhileImpersonating refuses anything but
     * reads, so nothing can be submitted, bought or changed as the user.
     */
    public function impersonate(Request $request, User $user): JsonResponse
    {
        $validated = $request->validate(['password' => ['required', 'string']]);

        $this->confirmSuperadminPassword($request, $validated['password']);

        $actor = $request->user();

        if ($user->id === $actor->id || $user->role === User::ROLE_SUPERADMIN) {
            throw ValidationException::withMessages(['user' => ['A superadmin account cannot be viewed this way.']]);
        }

        if ($user->is_blocked) {
            throw ValidationException::withMessages(['user' => ['This account is blocked. Unblock it first if you need to view it.']]);
        }

        $name = User::IMPERSONATION_TOKEN_PREFIX.$actor->id;

        // One live "view as" per superadmin per account.
        $user->tokens()->where('name', $name)->delete();

        $expiresAt = now()->addMinutes(self::IMPERSONATION_MINUTES);
        $token = $user->createToken($name, [User::IMPERSONATION_ABILITY], $expiresAt);

        ActivityLog::record($actor, 'Started viewing an account ("view as", read-only)', 'User', $user->name, [
            'user_id' => $user->id,
            'role' => $user->role,
            'expires_at' => $expiresAt->toIso8601String(),
        ]);

        return response()->json([
            'token' => $token->plainTextToken,
            'user' => $user->load(['college.collegeDepartments', 'company']),
            'expires_at' => $expiresAt->toIso8601String(),
            'minutes' => self::IMPERSONATION_MINUTES,
        ]);
    }

    // ─────────────────────────────── delete ───────────────────────────────

    /** What deleting the account would remove — shown in the confirmation dialog before anything is touched. */
    public function deletionPreview(Request $request, User $user): JsonResponse
    {
        $this->assertDeletable($request, $user);

        return response()->json([
            'user' => ['id' => $user->id, 'name' => $user->name, 'email' => $user->email, 'role' => $user->role],
            'impact' => $this->purger->preview($user),
        ]);
    }

    /**
     * Permanently delete one student or coordinator account and everything it
     * owns — see UserPurgeService. Irreversible, so it takes the superadmin role,
     * their own password AND the account's exact email typed out.
     */
    public function destroy(Request $request, User $user): JsonResponse
    {
        $validated = $request->validate([
            'password' => ['required', 'string'],
            'confirm_email' => ['required', 'string'],
        ]);

        $this->confirmSuperadminPassword($request, $validated['password']);
        $this->assertDeletable($request, $user);

        if (! hash_equals(mb_strtolower($user->email), mb_strtolower(trim($validated['confirm_email'])))) {
            throw ValidationException::withMessages([
                'confirm_email' => ['The email you typed does not match this account. Type it exactly.'],
            ]);
        }

        $snapshot = ['name' => $user->name, 'email' => $user->email, 'role' => $user->role, 'id' => $user->id];

        try {
            $removed = $this->purger->purge($user);
        } catch (QueryException $e) {
            report($e);

            return response()->json(['message' => 'The account could not be deleted because some of its records are still in use elsewhere. Nothing was deleted.'], 409);
        }

        ActivityLog::record($request->user(), 'Permanently deleted an account', 'User', $snapshot['name'], [
            'user_id' => $snapshot['id'],
            'email' => $snapshot['email'],
            'role' => $snapshot['role'],
            'removed' => $removed,
        ]);

        return response()->json(['deleted' => true, 'removed' => $removed]);
    }

    // ─────────────────────────────── helpers ───────────────────────────────

    private function assertDeletable(Request $request, User $user): void
    {
        if ($user->id === $request->user()->id) {
            throw ValidationException::withMessages(['user' => ['You cannot delete your own account.']]);
        }

        if (! $this->purger->canDelete($user)) {
            throw ValidationException::withMessages([
                'user' => ['Only student and section-coordinator accounts can be deleted one at a time. Block this account instead, or delete its college.'],
            ]);
        }
    }

    /** The same seat rule every other way of adding a student to a college enforces — a "strict" cap has no admin backdoor. */
    private function assertRoomInCollege(College $college): void
    {
        if (! $college->hasActiveSubscription()) {
            throw ValidationException::withMessages(['college_id' => ["{$college->name}'s subscription has expired. Assign a plan before adding more students."]]);
        }

        $limit = $college->studentLimit();

        if ($limit !== null && $college->studentCount() >= $limit) {
            throw ValidationException::withMessages(['college_id' => ["{$college->name} is already at its limit of {$limit} students. Assign a bigger plan to add more."]]);
        }
    }

    /** @return array<string, mixed> */
    private function identity(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'handle' => $user->handle,
            'phone' => $user->phone,
            'phone_verified' => $user->isPhoneVerified(),
            'role' => $user->role,
            'college' => $user->college ? ['id' => $user->college->id, 'name' => $user->college->name] : null,
            'company' => $user->company ? ['id' => $user->company->id, 'name' => $user->company->name] : null,
            'section' => $user->section,
            'roll_number' => $user->roll_number,
            'branch' => $user->branch,
            'cgpa' => $user->cgpa,
            'backlogs' => $user->backlogs,
            'permissions' => $user->permissions,
            'is_blocked' => (bool) $user->is_blocked,
            'blocked_reason' => $user->blocked_reason,
            'blocked_at' => $user->blocked_at,
            'blocked_by' => $user->blockedBy?->name,
            'created_at' => $user->created_at,
            'last_seen_at' => $user->last_seen_at,
            'lead_status' => $user->lead_status,
            'is_lead' => $user->isMellowDirectLead(),
        ];
    }

    /** @return array<string, mixed> */
    private function planBlock(User $user): array
    {
        $coverage = $user->subscriptionCoverage();

        $history = $user->subscriptions()
            ->with('plan')
            ->latest('started_at')
            ->latest('id')
            ->limit(30)
            ->get()
            // The subscriber is this very user: say so rather than loading it again for every row.
            ->each(fn (Subscription $s) => $s->setRelation('subscriber', $user));

        return [
            'coverage' => $this->coverage->formatCoverage($coverage),
            'covered_by_college' => $coverage['source'] === 'institution',
            'college_name' => $user->college?->name,
            'history' => $history->map(fn (Subscription $s) => $this->subscriptionRows->row($s))->values(),
            'addons' => $user->activeAddonSubscriptions()->map(fn (Subscription $s) => [
                'code' => $s->plan->code,
                'name' => $s->plan->name,
                'days_remaining' => $s->daysRemaining(),
            ])->values(),
        ];
    }

    /**
     * What this account did that was worth auditing (it is the actor: it bought a
     * plan, created something) and what was done to it (an admin edited, blocked,
     * granted a plan to it — those entries carry its id in `meta.user_id`).
     *
     * @return list<array<string, mixed>>
     */
    private function activity(User $user): array
    {
        return ActivityLog::query()
            ->where(fn ($q) => $q->where('actor_id', $user->id)->orWhere('meta->user_id', $user->id))
            ->latest('id')
            ->limit(20)
            ->get()
            ->map(fn (ActivityLog $log) => [
                'id' => $log->id,
                'action' => $log->action,
                'by' => $log->actor_id === $user->id ? 'self' : $log->actor_name,
                'by_role' => $log->actor_role,
                'meta' => $log->meta,
                'created_at' => $log->created_at,
            ])
            ->values()
            ->all();
    }
}
