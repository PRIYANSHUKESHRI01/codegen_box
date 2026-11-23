<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Enums\NotificationType;
use App\Models\ActivityLog;
use App\Models\IntegritySession;
use App\Models\InterviewProctoringSession;
use App\Models\InterviewProctoringViolation;
use App\Models\InterviewSession;
use App\Models\User;
use App\Models\VaultInterviewQualification;
use App\Models\VaultProfile;
use App\Services\NotificationService;
use App\Services\Vault\CuratedCatalog;
use App\Services\Vault\VaultAiAccessService;
use App\Services\Vault\VaultQualificationAdminService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * Superadmin → a student's Vault AI Interview (the "Vault AI" tab of the Manage drawer): their qualifications, and the hand tools to manage it - give a blocked
 * student their attempts back, correct marks, qualify someone outright, take a qualification back, open the interview for
 * a student still waiting at the gate. The rules themselves live in VaultQualificationAdminService; this class validates,
 * finds the student, and answers with the student's whole Vault AI picture as it now stands.
 */
class SuperAdminVaultAiController extends Controller
{
    public function __construct(
        private readonly VaultQualificationAdminService $admin,
        private readonly CuratedCatalog $catalog,
    ) {}

    /** One student's whole Vault AI picture: the gate, every stack they have touched, their Vault standing. */
    public function show(User $user): JsonResponse
    {
        return response()->json($this->payload($this->student($user)));
    }

    public function reset(Request $request, User $user, string $stackKey): JsonResponse
    {
        $validated = $request->validate([
            'reason' => ['required', 'string', 'min:3', 'max:300'],
            'mode' => ['nullable', 'string', 'in:full_reset,single_attempt,retry_attempt'],
            'attempt' => ['nullable', 'integer', 'min:1', 'max:3'],
        ]);
        $this->knownStack($stackKey);

        $mode = $validated['mode'] ?? 'full_reset';
        $attempt = isset($validated['attempt']) ? (int) $validated['attempt'] : null;

        $this->admin->resetOrGrant($this->student($user), $stackKey, $request->user(), $validated['reason'], $mode, $attempt);

        return response()->json($this->payload($user->fresh()));
    }

    public function grantAttempt(Request $request, User $user, string $stackKey): JsonResponse
    {
        $validated = $request->validate([
            'reason' => ['required', 'string', 'min:3', 'max:300'],
            'attempt' => ['nullable', 'integer', 'min:1', 'max:3'],
        ]);
        $this->knownStack($stackKey);

        $attempt = isset($validated['attempt']) ? (int) $validated['attempt'] : null;
        $this->admin->reopenAttempt($this->student($user), $stackKey, $request->user(), $validated['reason'], $attempt);

        return response()->json($this->payload($user->fresh()));
    }

    public function scores(Request $request, User $user, string $stackKey): JsonResponse
    {
        $validated = $request->validate([
            'scores' => ['required', 'array'],
            'scores.*' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'attempt_index' => ['nullable', 'integer', 'min:0', 'max:200'],
            'reason' => ['required', 'string', 'min:3', 'max:300'],
        ]);
        $this->knownStack($stackKey);

        $this->admin->setScores(
            $this->student($user), $stackKey, $validated['scores'], $request->user(), $validated['reason'], $validated['attempt_index'] ?? null
        );

        return response()->json($this->payload($user->fresh()));
    }

    public function qualify(Request $request, User $user, string $stackKey): JsonResponse
    {
        $validated = $request->validate([
            'average' => ['required', 'numeric', 'min:'.VaultInterviewQualification::PASSING_THRESHOLD, 'max:100'],
            'reason' => ['required', 'string', 'min:3', 'max:300'],
        ]);
        $this->knownStack($stackKey);

        $this->admin->markQualified($this->student($user), $stackKey, (float) $validated['average'], $request->user(), $validated['reason']);

        return response()->json($this->payload($user->fresh()));
    }

    public function unlockAccess(Request $request, User $user): JsonResponse
    {
        $validated = $request->validate(['reason' => ['required', 'string', 'min:3', 'max:300']]);

        $this->admin->unlockAccess($this->student($user), $request->user(), $validated['reason']);

        return response()->json($this->payload($user->fresh()));
    }

    /**
     * Reinstates a candidate who was locked or blocked during an interview session (or cooling down).
     * Unblocks the account, resets locked proctoring and integrity sessions to active, clears cooldown,
     * logs admin activity, and notifies the student.
     */
    public function reinstateProctoring(Request $request, User $user): JsonResponse
    {
        $validated = $request->validate([
            'reason' => ['required', 'string', 'min:3', 'max:300'],
        ]);

        $student = $this->student($user);
        $admin = $request->user();
        $reason = $validated['reason'];

        DB::transaction(function () use ($student, $admin, $reason) {
            // 1. Unblock student if blocked
            if ($student->is_blocked) {
                $student->forceFill([
                    'is_blocked' => false,
                    'blocked_at' => null,
                    'blocked_by' => null,
                    'blocked_reason' => null,
                ])->save();
            }

            // 2. Reinstate any locked InterviewProctoringSession for this user
            $interviewSessions = InterviewSession::where('user_id', $student->id)->get();
            foreach ($interviewSessions as $sess) {
                $ps = $sess->proctoringSession;
                if ($ps && $ps->isLocked()) {
                    $ps->update([
                        'status' => InterviewProctoringSession::STATUS_ACTIVE,
                        'locked_at' => null,
                        'violation_count' => 0,
                    ]);
                }
            }

            // 3. Reinstate any locked IntegritySession for this user
            IntegritySession::where('user_id', $student->id)
                ->where('status', IntegritySession::STATUS_LOCKED)
                ->update([
                    'status' => IntegritySession::STATUS_ACTIVE,
                    'last_incident_at' => null,
                ]);

            // 4. Clear any active cooling down period on qualifications
            $qualifications = VaultInterviewQualification::where('user_id', $student->id)->get();
            foreach ($qualifications as $qual) {
                if ($qual->status === VaultInterviewQualification::STATUS_COOLING_DOWN || $qual->cooldown_until !== null) {
                    $qual->status = VaultInterviewQualification::STATUS_IN_PROGRESS;
                    $qual->cooldown_until = null;
                    $log = $qual->admin_log ?? [];
                    $log[] = [
                        'action' => 'reinstate_proctoring',
                        'by' => $admin->name,
                        'at' => now()->toIso8601String(),
                        'reason' => $reason,
                    ];
                    $qual->admin_log = $log;
                    $qual->save();
                }
            }

            // 5. Activity log
            ActivityLog::record(
                $admin,
                'Reinstated proctoring & re-granted access for candidate',
                'Vault AI Interview',
                $student->name,
                ['user_id' => $student->id, 'reason' => $reason]
            );

            // 6. Notify student
            try {
                app(NotificationService::class)->notify(
                    $student,
                    NotificationType::VaultActivity,
                    'Access Reinstated',
                    'Your interview session has been reviewed and your access has been reinstated by an administrator. You may now continue or re-attempt your interview.',
                    [
                        'url' => '/dashboard/vault-interviews',
                        'severity' => 'success',
                        'group_key' => 'vault.proctoring_reinstated:'.$student->id.':'.now()->timestamp,
                    ]
                );
            } catch (\Throwable $e) {
                // Notifications shouldn't break reinstatement
            }
        });

        return response()->json($this->payload($student->fresh()));
    }

    // ─────────────────────────────────── shaping ───────────────────────────────────

    /** @return array<string, mixed> */
    private function payload(User $student): array
    {
        $student->loadMissing(['college:id,name', 'blockedBy:id,name']);

        $qualifications = VaultInterviewQualification::where('user_id', $student->id)
            ->with(['user:id,name,email,college_id', 'user.college:id,name'])
            ->latest('updated_at')
            ->get();

        $profile = VaultProfile::where('user_id', $student->id)->first();
        $breakdown = $student->readinessBreakdown();
        $gate = app(VaultAiAccessService::class)->forUser($student, true, false);
        $blockDetails = $this->buildBlockDetails($student, $qualifications, $gate);

        return [
            'student' => [
                'id' => $student->id,
                'name' => $student->name,
                'email' => $student->email,
                'college' => $student->college?->name,
                'study_year' => $student->study_year,
                'is_blocked' => (bool) $student->is_blocked,
                'blocked_reason' => $student->blocked_reason,
                'blocked_at' => $student->blocked_at?->toIso8601String(),
                'blocked_by' => $student->blockedBy?->name,
                'vault_ai_score' => $student->vault_ai_score !== null ? (float) $student->vault_ai_score : null,
            ],
            // Read-only: looking at a student must never write their unlock.
            'gate' => $gate,
            'readiness' => [
                'score' => $breakdown['score'],
                'tier' => $breakdown['tier'],
                'overridden' => isset($breakdown['override']),
            ],
            'vault' => $profile === null ? null : [
                'status' => $profile->visibility_status,
                'is_eligible' => (bool) $profile->is_eligible,
                'source' => $profile->qualification_source,
                'ai_interview_stack' => $profile->ai_interview_stack,
            ],
            'qualifications' => $qualifications->map(fn (VaultInterviewQualification $q) => $this->row($q, detail: true))->values(),
            'stacks' => $this->stacks(),
            'block_details' => $blockDetails,
        ];
    }

    /**
     * Builds a detailed diagnostic of whether and WHY a student is blocked from the Vault AI Interview:
     * - Proctoring lock (phone detected, facial mismatch, absence from camera, 3 strikes)
     * - Account suspension (admin block with reason & actor)
     * - 45-day series cooldown (exhausted attempts with dates)
     * - Gate restrictions (readiness or waiting period)
     *
     * @param \Illuminate\Database\Eloquent\Collection<int, VaultInterviewQualification> $qualifications
     * @param array<string, mixed> $gate
     * @return array<string, mixed>
     */
    private function buildBlockDetails(User $student, $qualifications, array $gate): array
    {
        // 1. Look for any locked proctoring session for this candidate's interviews
        $lockedProctoring = InterviewProctoringSession::whereHas('interviewSession', fn ($q) => $q->where('user_id', $student->id))
            ->where('status', InterviewProctoringSession::STATUS_LOCKED)
            ->with(['violations' => fn ($q) => $q->latest('occurred_at')->limit(20), 'interviewSession.interview'])
            ->latest('locked_at')
            ->first();

        // 2. Look for recent locked integrity session
        $lockedIntegrity = IntegritySession::where('user_id', $student->id)
            ->where('surface', IntegritySession::SURFACE_INTERVIEW)
            ->where('status', IntegritySession::STATUS_LOCKED)
            ->latest('last_incident_at')
            ->first();

        // 3. Active cooldowns
        $cooldownQuals = $qualifications->filter(fn (VaultInterviewQualification $q) => $q->isCoolingDown());

        $hasAccountBlock = (bool) $student->is_blocked;
        $hasProctoringLock = $lockedProctoring !== null || $lockedIntegrity !== null;
        $hasCooldown = $cooldownQuals->isNotEmpty();
        $isGateLocked = ($gate['state'] ?? '') === 'locked';

        $isBlocked = $hasAccountBlock || $hasProctoringLock || $hasCooldown;

        $violationsList = [];
        $primaryTrigger = null;

        if ($lockedProctoring) {
            foreach ($lockedProctoring->violations as $v) {
                $violationsList[] = [
                    'id' => $v->id,
                    'type' => $v->type,
                    'label' => InterviewProctoringViolation::label($v->type),
                    'occurred_at' => $v->occurred_at?->toIso8601String() ?? $v->created_at?->toIso8601String(),
                    'counted' => (bool) $v->counted_toward_lock,
                    'meta' => $v->meta,
                ];
            }

            $types = collect($violationsList)->pluck('type')->all();

            if (in_array(InterviewProctoringViolation::TYPE_PHONE_DETECTED, $types, true)) {
                $primaryTrigger = [
                    'type' => 'phone_detected',
                    'title' => 'Mobile Phone Detected (Grace Period Exceeded)',
                    'message' => 'A prohibited mobile phone was detected in front of the camera during the interview session and was not removed within the 15-second grace countdown.',
                    'severity' => 'critical',
                ];
            } elseif (in_array(InterviewProctoringViolation::TYPE_FACE_MISMATCH, $types, true)) {
                $primaryTrigger = [
                    'type' => 'face_mismatch',
                    'title' => 'Facial Identity Mismatch',
                    'message' => 'Continuous facial recognition detected a person who did not match the baseline verification photo taken prior to starting the interview.',
                    'severity' => 'critical',
                ];
            } elseif (in_array('no_face', $types, true)) {
                $primaryTrigger = [
                    'type' => 'no_face',
                    'title' => 'Candidate Left Camera Frame',
                    'message' => 'No face was detected in the camera view for longer than the 15-second grace window.',
                    'severity' => 'high',
                ];
            } elseif (in_array('multiple_faces', $types, true)) {
                $primaryTrigger = [
                    'type' => 'multiple_faces',
                    'title' => 'Multiple Faces in Frame',
                    'message' => 'More than one individual was detected in the camera view during the interview.',
                    'severity' => 'high',
                ];
            } else {
                $primaryTrigger = [
                    'type' => 'strikes_exceeded',
                    'title' => 'Proctoring Strikes Limit Reached (3 Strikes)',
                    'message' => 'The candidate accumulated 3 or more proctoring strikes (such as exiting fullscreen, switching browser tabs, or opening developer tools).',
                    'severity' => 'high',
                ];
            }
        } elseif ($hasAccountBlock) {
            $primaryTrigger = [
                'type' => 'account_suspended',
                'title' => 'Account Blocked by Administrator',
                'message' => $student->blocked_reason ?: 'Account access suspended by staff or administrator.',
                'severity' => 'warning',
            ];
        } elseif ($hasCooldown) {
            $first = $cooldownQuals->first();
            $stackName = $first ? ($this->catalog->stack($first->stack_key)['stack']['name'] ?? $first->stack_key) : 'Interview';
            $primaryTrigger = [
                'type' => 'series_cooldown',
                'title' => '45-Day Series Cooldown Restriction',
                'message' => "Candidate failed all attempts in {$stackName} and is restricted under a mandatory 45-day cooldown until " . ($first?->cooldown_until?->format('d M Y') ?? 'later') . " ({$first?->getRemainingCooldownDays()} days remaining).",
                'severity' => 'warning',
            ];
        }

        $summaryMessage = null;
        if ($isBlocked) {
            $parts = [];
            if ($primaryTrigger) {
                $parts[] = $primaryTrigger['message'];
            }
            if ($hasAccountBlock && (! $primaryTrigger || $primaryTrigger['type'] !== 'account_suspended')) {
                $parts[] = 'Account is marked blocked' . ($student->blocked_reason ? ": \"{$student->blocked_reason}\"" : '.');
            }
            if ($hasCooldown && (! $primaryTrigger || $primaryTrigger['type'] !== 'series_cooldown')) {
                $first = $cooldownQuals->first();
                $parts[] = "Under 45-day cooldown in {$first?->stack_key} ({$first?->getRemainingCooldownDays()} days remaining).";
            }
            $summaryMessage = implode(' · ', $parts);
        }

        return [
            'is_blocked' => $isBlocked,
            'has_account_block' => $hasAccountBlock,
            'has_proctoring_lock' => $hasProctoringLock,
            'has_cooldown' => $hasCooldown,
            'is_gate_locked' => $isGateLocked,
            'summary_message' => $summaryMessage,
            'primary_trigger' => $primaryTrigger,
            'account_block' => $hasAccountBlock ? [
                'reason' => $student->blocked_reason,
                'blocked_at' => $student->blocked_at?->toIso8601String(),
                'blocked_by' => $student->blockedBy?->name,
            ] : null,
            'proctoring_lock' => $lockedProctoring ? [
                'session_id' => $lockedProctoring->id,
                'interview_title' => $lockedProctoring->interviewSession?->interview?->title ?? 'Vault AI Interview',
                'locked_at' => $lockedProctoring->locked_at?->toIso8601String(),
                'violation_count' => $lockedProctoring->violation_count,
                'violations' => $violationsList,
                'flags' => (object) ($lockedIntegrity?->flags ?? []),
                'risk_level' => $lockedIntegrity?->risk_level,
                'risk_score' => $lockedIntegrity?->risk_score,
            ] : null,
            'cooldowns' => $cooldownQuals->map(fn (VaultInterviewQualification $q) => [
                'stack_key' => $q->stack_key,
                'stack_name' => $this->catalog->stack($q->stack_key)['stack']['name'] ?? $q->stack_key,
                'cooldown_until' => $q->cooldown_until?->toIso8601String(),
                'days_remaining' => $q->getRemainingCooldownDays(),
                'current_attempt' => $q->current_attempt,
                'max_attempts' => $q->max_attempts,
            ])->values()->all(),
        ];
    }

    /** @return array<string, mixed> */
    private function row(VaultInterviewQualification $q, bool $detail = false): array
    {
        $found = $this->catalog->stack($q->stack_key);
        $history = $q->attempt_history ?? [];
        $cycleStart = (int) $q->cycle_start;

        $row = [
            'id' => $q->id,
            'user' => [
                'id' => $q->user_id,
                'name' => $q->user?->name,
                'email' => $q->user?->email,
                'college' => $q->user?->college?->name,
            ],
            'stack_key' => $q->stack_key,
            'stack_name' => $found['stack']['name'] ?? ucwords(str_replace('_', ' ', $q->stack_key)),
            'role_name' => $found['role']['title'] ?? $q->role_key,
            'status' => $q->status,
            'is_blocked' => $q->isCoolingDown(),
            // Blocked on paper, but the 45 days are over: the student can sit again without anyone doing anything.
            'cooldown_over' => $q->status === VaultInterviewQualification::STATUS_COOLING_DOWN && ! $q->isCoolingDown(),
            'current_attempt' => $q->current_attempt,
            'max_attempts' => $q->max_attempts,
            'failed_attempts' => max(0, count($history) - $cycleStart),
            'series_scores' => (object) ($q->series_scores ?? []),
            'series_average' => $q->series_average,
            'cooldown_until' => $q->cooldown_until?->toIso8601String(),
            'cooldown_days_remaining' => $q->getRemainingCooldownDays(),
            'qualified_at' => $q->qualified_at?->toIso8601String(),
            'qualified_by_admin' => $q->qualified_by_admin_id !== null,
            'updated_at' => $q->updated_at?->toIso8601String(),
        ];

        if ($detail) {
            $row['attempt_history'] = collect($history)->map(function (array $a, int $i) use ($cycleStart, $q) {
                $scores = (array) ($a['scores'] ?? []);
                return [
                    'attempt' => (int) ($a['attempt'] ?? ($i + 1)),
                    'series_number' => (int) ($a['series_number'] ?? $a['attempt'] ?? ($i + 1)),
                    'scores' => empty($scores) ? (object) [] : (object) $scores,
                    'average' => isset($a['average']) ? round((float) $a['average'], 2) : 0.0,
                    'evaluated_at' => (string) ($a['evaluated_at'] ?? $q->updated_at?->toIso8601String() ?? now()->toIso8601String()),
                    'passed' => (bool) ($a['passed'] ?? false),
                    'edited_by_admin' => (bool) ($a['edited_by_admin'] ?? false),
                    'index' => $i,
                    'this_cycle' => $i >= $cycleStart,
                ];
            })->values();
            $row['admin_log'] = array_reverse($q->admin_log ?? []);
        }

        return $row;
    }

    /** @return list<array{key: string, name: string, role: string, live: bool}> */
    private function stacks(): array
    {
        $out = [];

        foreach ($this->catalog->roles() as $role) {
            foreach ($role['stacks'] as $key => $stack) {
                $out[] = [
                    'key' => (string) $key,
                    'name' => (string) $stack['name'],
                    'role' => (string) ($role['title'] ?? $role['key']),
                    'live' => $this->catalog->progress($stack)['live'],
                ];
            }
        }

        return $out;
    }

    private function student(User $user): User
    {
        if ($user->role !== User::ROLE_USER) {
            throw new NotFoundHttpException('That account is not a student.');
        }

        return $user;
    }

    private function knownStack(string $stackKey): void
    {
        if ($this->catalog->stack($stackKey) === null) {
            throw new NotFoundHttpException("Unknown interview stack [{$stackKey}].");
        }
    }
}
