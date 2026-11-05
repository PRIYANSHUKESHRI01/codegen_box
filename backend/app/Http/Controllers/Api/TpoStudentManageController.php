<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\SendAccountCredentialsEmail;
use App\Models\ActivityLog;
use App\Models\User;
use App\Models\VaultInterviewQualification;
use App\Services\CollegeDepartmentService;
use App\Services\IssuedCredentialVault;
use App\Services\StudentCohortService;
use App\Services\UserPurgeService;
use App\Support\SingleMail;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * What a college's TPO can do to the accounts of THEIR OWN students, from the student's "Manage" panel on the cohort screens.
 *
 * The TPO is the college's administrator, so they can run a student's account the way a platform superadmin can: look at the
 * account, correct their details, block and unblock them, send them a fresh login, sign them out of every device, and remove an
 * account that was added by mistake. Every action is scoped to the caller's own college (an id from another college is a 404,
 * exactly as if it did not exist) and is written to the audit trail with the student it was done to.
 *
 * What is deliberately NOT here, because it is a platform decision and not a college one:
 *   - seeing or choosing a student's password (a fresh login is e-mailed to the student; the TPO never sees it),
 *   - plans, payments and refunds,
 *   - setting a readiness score by hand, or changing Vault AI Interview results and attempts (they decide who employers see),
 *   - "view as" a student's session,
 *   - deleting an account that has ever been used (block it instead; its history is the college's record),
 *   - any role change, and anything about another college.
 */
class TpoStudentManageController extends Controller
{
    public function __construct(
        private readonly StudentCohortService $cohort,
        private readonly CollegeDepartmentService $departments,
    ) {}

    /** GET /tpo/students/{student}/manage — the account at a glance, and what has been done to it. */
    public function show(Request $request, User $student): JsonResponse
    {
        $this->authorizeOwn($request, $student);

        $subscription = $student->effectiveSubscription();

        $blocker = $student->is_blocked && $student->blocked_by !== null ? User::query()->find($student->blocked_by, ['id', 'name', 'role']) : null;

        $history = ActivityLog::query()
            ->where('meta->user_id', $student->id)
            ->latest('id')->limit(12)->get()
            ->map(fn (ActivityLog $l) => ['action' => $l->action, 'by' => $l->actor_name, 'role' => $l->actor_role, 'at' => $l->created_at?->toIso8601String(), 'reason' => $l->meta['reason'] ?? null]);

        return response()->json([
            'account' => [
                'id' => $student->id,
                'email' => $student->email,
                'activated' => ! $student->must_change_password,
                'created_at' => $student->created_at?->toIso8601String(),
                'last_seen_at' => $student->last_seen_at?->toIso8601String(),
                'sessions' => $student->tokens()->count(),
                'is_blocked' => (bool) $student->is_blocked,
                'blocked' => $student->is_blocked ? [
                    'reason' => $student->blocked_reason,
                    'at' => $student->blocked_at?->toIso8601String(),
                    'by' => $blocker?->name,
                    'by_role' => $blocker?->role,
                ] : null,
            ],
            // Read-only: what the student can use today, and how they got it. Plans are managed by Mellow Vault, not by the college.
            'plan' => [
                'name' => $subscription?->plan?->name ?? 'Free',
                'covered_by_college' => $subscription !== null && $subscription->subscriber_type !== User::class,
                'ends_at' => $subscription?->current_period_end?->toIso8601String(),
            ],
            'vault_ai' => VaultInterviewQualification::query()->where('user_id', $student->id)->orderByDesc('updated_at')->limit(6)->get()
                ->map(fn (VaultInterviewQualification $q) => [
                    'stack' => Str::headline((string) $q->stack_key),
                    'status' => $q->status,
                    'average' => $q->series_average !== null ? (int) round($q->series_average) : null,
                    'attempt' => $q->current_attempt,
                    'max_attempts' => $q->max_attempts,
                ]),
            'can_remove' => $this->removalBlocker($student) === null,
            'remove_blocker' => $this->removalBlocker($student),
            'history' => $history,
        ]);
    }

    /** PATCH /tpo/students/{student}/profile — correct the details the college owns. */
    public function updateProfile(Request $request, User $student): JsonResponse
    {
        $this->authorizeOwn($request, $student);

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'email' => ['sometimes', 'string', 'email', 'max:255'],
            'roll_number' => ['sometimes', 'nullable', 'string', 'max:50'],
            'branch' => ['sometimes', 'nullable', 'string', 'max:100'],
            'cgpa' => ['sometimes', 'nullable', 'numeric', 'min:0', 'max:10'],
            'backlogs' => ['sometimes', 'nullable', 'integer', 'min:0', 'max:99'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:20'],
            'parent_phone' => ['sometimes', 'nullable', 'string', 'max:20'],
        ]);

        $emailChanged = array_key_exists('email', $validated) && mb_strtolower($validated['email']) !== mb_strtolower($student->email);

        if ($emailChanged) {
            // The login is the student's identity. While the account is still on its one-time password nobody has relied on it, so a typo
            // from the import can be fixed (and the new address gets the login); once they have signed in it is theirs to change.
            if (! $student->must_change_password) {
                throw ValidationException::withMessages(['email' => ['This student has already signed in, so their login e-mail can only be changed by them (or by Mellow Vault support).']]);
            }
            if (User::query()->where('email', $validated['email'])->where('id', '!=', $student->id)->exists()) {
                throw ValidationException::withMessages(['email' => ['Another account already uses this e-mail.']]);
            }
        }

        if (array_key_exists('branch', $validated)
            && ($conflict = $this->departments->labelConflict($student->college, $validated['branch'], $student->department ?? (string) config('departments.fallback', 'engineering'))) !== null) {
            throw ValidationException::withMessages(['branch' => [$conflict]]);
        }

        $before = $student->only(array_keys($validated));
        $student->fill($validated);
        $changed = array_keys(array_filter($validated, fn ($v, $k) => ($before[$k] ?? null) != $v, ARRAY_FILTER_USE_BOTH));

        if ($changed === []) {
            return response()->json(['student' => $this->row($student), 'message' => 'Nothing changed.']);
        }

        $student->save();

        $emailed = null;
        if ($emailChanged) {
            $emailed = $this->issueLogin($request, $student, 'Corrected the e-mail and sent a new login');
        }

        ActivityLog::record($request->user(), 'Edited a student\'s details', 'User', $student->name, ['user_id' => $student->id, 'fields' => $changed]);

        return response()->json([
            'student' => $this->row($student->refresh()),
            'message' => $emailed === null ? 'Details saved.' : ($emailed ? 'Details saved and a new login was e-mailed to the new address.' : 'Details saved. The e-mail could not be sent right now; use "Send a new login" to try again.'),
        ]);
    }

    /** POST /tpo/students/{student}/block {reason} */
    public function block(Request $request, User $student): JsonResponse
    {
        $this->authorizeOwn($request, $student);

        $reason = trim((string) $request->validate(['reason' => ['required', 'string', 'min:3', 'max:255']])['reason']);

        $student->forceFill(['is_blocked' => true, 'blocked_at' => now(), 'blocked_by' => $request->user()->id, 'blocked_reason' => $reason])->save();
        // The block is refused on the very next request anyway; ending the sessions as well means an open exam page stops too.
        $student->tokens()->delete();

        ActivityLog::record($request->user(), 'TPO blocked a student', 'User', $student->name, ['user_id' => $student->id, 'reason' => $reason]);

        return response()->json(['student' => $this->row($student->refresh()), 'message' => "{$student->name} is blocked and signed out."]);
    }

    /** POST /tpo/students/{student}/unblock — a TPO may lift any block on their own students, including a section coordinator's. */
    public function unblock(Request $request, User $student): JsonResponse
    {
        $this->authorizeOwn($request, $student);

        $student->forceFill(['is_blocked' => false, 'blocked_at' => null, 'blocked_by' => null, 'blocked_reason' => null])->save();

        ActivityLog::record($request->user(), 'TPO unblocked a student', 'User', $student->name, ['user_id' => $student->id]);

        return response()->json(['student' => $this->row($student->refresh()), 'message' => "{$student->name} can sign in again."]);
    }

    /**
     * POST /tpo/students/{student}/send-login — a brand-new one-time password, e-mailed to the student and never shown to the TPO.
     * For a student who never got or lost their login, or whose account might be shared. They must choose their own password at
     * their next sign-in, and every device they were signed in on is signed out.
     */
    public function sendLogin(Request $request, User $student): JsonResponse
    {
        $this->authorizeOwn($request, $student);

        abort_if($student->is_blocked, 422, 'This account is blocked. Unblock it before sending a login.');

        $emailed = $this->issueLogin($request, $student, 'Sent a student a new login');

        return response()->json([
            'emailed' => $emailed,
            'message' => $emailed
                ? "A new login was e-mailed to {$student->email}."
                : 'The e-mail could not be sent right now, so the new login has NOT reached the student. Try again in a minute.',
        ], $emailed ? 200 : 502);
    }

    /** POST /tpo/students/{student}/revoke-sessions — sign the student out of every device (the password is unchanged). */
    public function revokeSessions(Request $request, User $student): JsonResponse
    {
        $this->authorizeOwn($request, $student);

        $ended = $student->tokens()->delete();

        ActivityLog::record($request->user(), 'Signed a student out of all devices', 'User', $student->name, ['user_id' => $student->id, 'sessions_ended' => $ended]);

        return response()->json(['revoked' => $ended, 'message' => $ended > 0 ? "Signed out of {$ended} device(s)." : 'They were not signed in anywhere.']);
    }

    /** DELETE /tpo/students/{student} — remove an account that was added by mistake and has never been used. */
    public function destroy(Request $request, User $student, UserPurgeService $purge): JsonResponse
    {
        $this->authorizeOwn($request, $student);

        if (($why = $this->removalBlocker($student)) !== null) {
            return response()->json(['message' => $why], 422);
        }

        $name = $student->name;
        $purge->purge($student);

        ActivityLog::record($request->user(), 'Removed a student account that had never been used', 'User', $name, ['user_id' => $student->id]);

        return response()->json(['message' => "{$name} was removed from your college."]);
    }

    // ───────────────────────────── helpers ─────────────────────────────

    /** Why this account cannot be removed (null = it can). Anything that has ever been used is the college's record: block it instead. */
    private function removalBlocker(User $student): ?string
    {
        if (! $student->must_change_password || $student->last_seen_at !== null) {
            return 'This student has signed in, so the account is part of your records and cannot be deleted. Block it instead.';
        }

        $count = fn (string $table, string $column = 'user_id') => DB::table($table)->where($column, $student->id)->count();

        $used = $count('submissions') + $count('contest_participants') + $count('interview_sessions') + $count('drive_applications') + $count('payment_orders');

        if (DB::table('subscriptions')->where('subscriber_type', User::class)->where('subscriber_id', $student->id)->exists()) {
            $used++;
        }

        return $used > 0 ? 'This student already has activity or purchases on record, so the account cannot be deleted. Block it instead.' : null;
    }

    /** New one-time password -> encrypted lookup copy for Mellow support -> e-mailed to the student. Returns whether the e-mail went out. */
    private function issueLogin(Request $request, User $student, string $auditAction): bool
    {
        $plain = Str::password(12);

        DB::transaction(function () use ($student, $plain, $request) {
            $student->forceFill([
                'password' => Hash::make($plain),
                'must_change_password' => true,
                // The credentials-email job refuses to send twice to one account; this is a new password, so it must be allowed to.
                'credentials_email_sent_at' => null,
            ])->save();

            $student->tokens()->delete();
            app(IssuedCredentialVault::class)->keep($student, $plain, 'reset', $request->user());
        });

        $emailed = SingleMail::now(new SendAccountCredentialsEmail($student->id, $plain));

        ActivityLog::record($request->user(), $auditAction, 'User', $student->name, ['user_id' => $student->id, 'emailed' => $emailed]);

        return $emailed;
    }

    /** The same row shape every cohort screen renders, so a screen can drop the response straight into its list. */
    private function row(User $student): array
    {
        return $this->cohort->payload($student, $this->cohort->activeMappingsFor((int) $student->college_id));
    }

    private function authorizeOwn(Request $request, User $student): void
    {
        $collegeId = $request->user()->college_id;

        abort_unless($collegeId !== null && $student->role === User::ROLE_USER && (int) $student->college_id === (int) $collegeId, 404);
    }
}
