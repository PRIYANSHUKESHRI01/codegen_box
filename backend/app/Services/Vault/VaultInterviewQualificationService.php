<?php

namespace App\Services\Vault;

use App\Enums\NotificationType;
use App\Models\Interview;
use App\Models\InterviewSession;
use App\Models\User;
use App\Models\VaultInterviewQualification;
use App\Models\VaultProfile;
use App\Models\VaultStackInterest;
use App\Services\CuratedInterviewSetService;
use App\Services\NotificationService;
use App\Services\ScoreLedger;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * Service managing Mellow Vault 3-Series Multi-Round Technical Interview Qualifications.
 *
 * Enforces:
 * - 3 Progressive Qualification Series (Series 1, Series 2, Series 3) per tech stack.
 * - Each Series contains 3 progressive sets (Round 1, Round 2, Round 3).
 * - All 3 sets must be completed; overall series average must be >= 60% to qualify for Mellow Vault.
 * - If average < 60%, unlocks the next distinct Series for re-attempt (up to 3 attempts total).
 * - Exhausting all 3 attempts triggers a 45-day preparation cooldown before re-qualifying.
 *
 * A qualification interview is bound to the exact attempt it was launched for (`qualification_id` + `attempt_seq` in its
 * practice_config), so a practice run of the same catalog set, or one left over from an earlier cycle, can never be
 * mistaken for it — and a set's score is recorded once: it cannot be re-rolled by re-attempting the interview.
 */
class VaultInterviewQualificationService
{
    public function __construct(
        private readonly CuratedInterviewSetService $curatedService,
        private readonly VaultService $vault,
        private readonly CuratedCatalog $catalog,
    ) {}

    /**
     * Get or initialize a qualification track for a user and stack. The role is always the catalog's own role for the
     * stack (never taken from the client), and an unknown stack is a 404 rather than an empty track.
     */
    public function getOrCreateQualification(User $user, string $stackKey): VaultInterviewQualification
    {
        $roleKey = $this->curatedService->roleKeyForStack($stackKey);

        if ($roleKey === null) {
            throw new NotFoundHttpException("Unknown interview stack [{$stackKey}].");
        }

        $qual = VaultInterviewQualification::firstOrCreate(
            [
                'user_id' => $user->id,
                'stack_key' => $stackKey,
            ],
            [
                'role_key' => $roleKey,
                'current_attempt' => 1,
                'max_attempts' => VaultInterviewQualification::MAX_ATTEMPTS,
                'status' => VaultInterviewQualification::STATUS_IN_PROGRESS,
                'active_series_id' => "{$roleKey}-{$stackKey}-series-1",
                'series_scores' => [],
                'series_average' => null,
                'attempt_history' => [],
            ]
        );

        // Cooldown naturally expired -> a fresh qualification cycle (the history of past attempts is kept).
        if ($qual->status === VaultInterviewQualification::STATUS_COOLING_DOWN
            && $qual->cooldown_until
            && Carbon::now()->gte($qual->cooldown_until)) {
            $qual->update([
                'status' => VaultInterviewQualification::STATUS_IN_PROGRESS,
                'current_attempt' => 1,
                'active_series_id' => "{$qual->role_key}-{$qual->stack_key}-series-1",
                'series_scores' => [],
                'series_average' => null,
                'cooldown_until' => null,
                // The failed series of the finished cycle stay on record but no longer count against the student's markers.
                'cycle_start' => count($qual->attempt_history ?? []),
            ]);
        }

        return $qual;
    }

    /**
     * Return comprehensive status payload for the given user and stack.
     *
     * @return array<string, mixed>
     */
    public function getStatus(User $user, string $stackKey): array
    {
        $found = $this->catalog->stack($stackKey);

        if ($found === null) {
            throw new NotFoundHttpException("Unknown interview stack [{$stackKey}].");
        }

        // A stack that is not open yet has no track to show — and must not get a qualification row just for being looked at.
        $progress = $this->catalog->progress($found['stack']);
        $existing = VaultInterviewQualification::where('user_id', $user->id)->where('stack_key', $stackKey)->first();

        if (! $progress['live'] && ! $existing?->isQualified()) {
            return [
                'stack_live' => false,
                'status' => 'coming_soon',
                'stack_key' => $stackKey,
                'role_key' => $found['role']['key'],
                'ready_sets' => $progress['ready_sets'],
                'total_sets' => $progress['total_sets'],
                'interested' => VaultStackInterest::where('user_id', $user->id)->where('stack_key', $stackKey)->exists(),
            ];
        }

        $qual = $this->reconcile($this->getOrCreateQualification($user, $stackKey));

        $seriesNumber = $qual->current_attempt;
        $scores = $qual->series_scores ?? [];

        // Build active series set details
        $sets = [];
        $completedCount = 0;

        for ($setNum = 1; $setNum <= 3; $setNum++) {
            $target = $this->curatedService->findSetBySeries($stackKey, $seriesNumber, $setNum);
            $setData = $target['set'] ?? null;

            $existingInterview = $this->interviewFor($qual, $setNum);
            $existingSession = $existingInterview
                ? InterviewSession::where('interview_id', $existingInterview->id)->where('user_id', $user->id)->first()
                : null;

            // The recorded score is the only thing that counts as "completed"; a finished interview whose score has
            // not landed yet is "scoring" (it has not been, and may never be, turned into a score).
            $scoreVal = isset($scores[(string) $setNum]) ? (int) $scores[(string) $setNum] : null;

            $setStatus = 'not_started';
            if ($scoreVal !== null) {
                $setStatus = 'completed';
                $completedCount++;
            } elseif ($existingSession?->status === InterviewSession::STATUS_COMPLETED) {
                $setStatus = 'scoring';
            } elseif ($existingSession?->status === InterviewSession::STATUS_IN_PROGRESS) {
                $setStatus = 'in_progress';
            }

            $sets[] = [
                'set_number' => $setNum,
                'set_id' => $setData['id'] ?? "{$stackKey}-s{$seriesNumber}-set{$setNum}",
                'title' => $setData['title'] ?? "Set {$setNum}",
                'description' => $setData['description'] ?? '',
                'duration_minutes' => $setData['duration_minutes'] ?? 15,
                'question_count' => count($setData['questions'] ?? []),
                'preview_questions' => array_slice(array_column($setData['questions'] ?? [], 'text'), 0, 3),
                'status' => $setStatus,
                'score_percent' => $scoreVal,
                'interview_slug' => $existingInterview?->slug,
            ];
        }

        $cooldownUntil = $qual->cooldown_until;

        return [
            'stack_live' => true,
            'qualification_id' => $qual->id,
            'user_id' => $user->id,
            'stack_key' => $stackKey,
            'role_key' => $qual->role_key,
            'status' => $qual->status,
            'is_qualified' => $qual->isQualified(),
            'is_cooling_down' => $qual->isCoolingDown(),
            'current_attempt' => $qual->current_attempt,
            'max_attempts' => $qual->max_attempts,
            'attempts_remaining' => max(0, $qual->max_attempts - $qual->current_attempt + 1),
            'cooldown_until' => $cooldownUntil?->toIso8601String(),
            'cooldown_formatted_date' => $cooldownUntil?->format('d M Y, h:i A'),
            'cooldown_days_remaining' => $qual->getRemainingCooldownDays(),
            'cooldown_hours_remaining' => $qual->getRemainingCooldownHours(),
            'active_series' => [
                'series_number' => $seriesNumber,
                'title' => "Series {$seriesNumber}",
                'sets' => $sets,
                'completed_sets_count' => $completedCount,
                'all_sets_completed' => $completedCount >= 3,
                'series_average' => $qual->series_average,
            ],
            'past_attempts' => array_values(array_slice($qual->attempt_history ?? [], (int) $qual->cycle_start)),
        ];
    }

    /**
     * Start a specific set in the candidate's active qualification series.
     * Enforces the cooldown (no plan is needed). Opening a set that was already launched in this attempt just
     * returns it — resuming costs no plan allowance.
     */
    public function startSet(User $user, string $stackKey, int $setNumber): Interview
    {
        $found = $this->catalog->stack($stackKey);

        if ($found === null) {
            throw new NotFoundHttpException("Unknown interview stack [{$stackKey}].");
        }

        // Only an open stack can be sat: all 9 of its sets have questions, so a failed series can always move on to the next.
        if (! $this->catalog->progress($found['stack'])['live']) {
            throw new ConflictHttpException("The {$found['stack']['name']} interview is not open yet. Tap \"Notify me\" and we will tell you the moment it is.");
        }

        $this->getOrCreateQualification($user, $stackKey);

        return DB::transaction(function () use ($user, $stackKey, $setNumber) {
            // Two taps on "Start" must land on one interview: serialise on the qualification row.
            $qual = VaultInterviewQualification::where('user_id', $user->id)->where('stack_key', $stackKey)->lockForUpdate()->firstOrFail();

            // 1. Guard against cooldown lockout and against re-qualifying what is already qualified
            if ($qual->isCoolingDown()) {
                $formattedDate = $qual->cooldown_until?->format('d M Y');
                $daysLeft = $qual->getRemainingCooldownDays();
                throw new AccessDeniedHttpException(
                    "You have exhausted all 3 qualification attempts. A 45-day preparation cooldown is active (expires on {$formattedDate}, {$daysLeft} days remaining). Please practice on AptRun drills before re-qualifying."
                );
            }

            if ($qual->isQualified()) {
                throw new AccessDeniedHttpException('You have already qualified for Mellow Vault in this stack.');
            }

            // 2. Validate set number
            if ($setNumber < 1 || $setNumber > 3) {
                throw new NotFoundHttpException("Invalid set number [{$setNumber}]. Qualification series consist of Set 1, Set 2, and Set 3.");
            }

            // 3. Already launched in this attempt? Resume it.
            $existing = $this->interviewFor($qual, $setNumber);
            if ($existing) {
                return $existing;
            }

            // 4. No plan is needed: the Vault AI Interview is open to every student who has unlocked it (VaultAiAccessService), and
            //    a qualification set neither needs nor spends a plan's mock-interview allowance (PlanGate and InterviewController skip qualification interviews).

            // 5. Find the set in catalog
            $seriesNumber = $qual->current_attempt;
            $target = $this->curatedService->findSetBySeries($stackKey, $seriesNumber, $setNumber);

            if ($target === null) {
                throw new NotFoundHttpException("Set [{$setNumber}] for series [{$seriesNumber}] in stack [{$stackKey}] was not found in the question catalog.");
            }

            // 6. Create interview and link qualification metadata
            return $this->curatedService->createInterviewFromTarget($user, $target, [
                'qualification_id' => $qual->id,
                'attempt_seq' => $this->attemptSeq($qual),
                'stack_key' => $stackKey,
                'role_key' => $qual->role_key,
                'series_number' => $seriesNumber,
                'set_number' => $setNumber,
            ]);
        });
    }

    /**
     * Record score for a set and evaluate overall series average.
     * Called automatically when an interview session finishes scoring (and by reconcile() if that call was missed).
     *
     * A set is scored once per attempt: a score for a set that already has one, for a past attempt, or on a
     * qualification that is no longer in progress is ignored, so a second sitting of the same interview can never
     * change the outcome.
     */
    public function recordSetScoreAndEvaluate(Interview $interview, int $scorePercent): ?VaultInterviewQualification
    {
        $practiceConfig = $interview->practice_config ?? [];
        $qualId = $practiceConfig['qualification_id'] ?? null;
        $setNumber = (int) ($practiceConfig['set_number'] ?? 0);
        $seriesNumber = (int) ($practiceConfig['series_number'] ?? 0);

        if (! $qualId || $setNumber < 1 || $setNumber > 3 || ! $seriesNumber) {
            return null;
        }

        $scorePercent = max(0, min(100, $scorePercent));
        $passed = null;

        $qual = DB::transaction(function () use ($qualId, $setNumber, $seriesNumber, $scorePercent, $practiceConfig, $interview, &$passed) {
            $qual = VaultInterviewQualification::whereKey($qualId)->lockForUpdate()->first();

            if (! $qual
                || (int) $qual->user_id !== (int) $interview->created_by
                || $qual->status !== VaultInterviewQualification::STATUS_IN_PROGRESS
                || $seriesNumber !== (int) $qual->current_attempt
                || (isset($practiceConfig['attempt_seq']) && (int) $practiceConfig['attempt_seq'] !== $this->attemptSeq($qual))) {
                return $qual;
            }

            $scores = $qual->series_scores ?? [];

            if (isset($scores[(string) $setNumber])) {
                return $qual;
            }

            $scores[(string) $setNumber] = $scorePercent;
            $qual->series_scores = $scores;

            $passed = $this->evaluateSeries($qual);

            return $qual;
        });

        if ($passed instanceof VaultProfile && $qual) {
            $this->notifyQualified($qual, $passed);
        }

        return $qual;
    }

    /**
     * Saves the qualification and, if all three sets of the active series now have a score, closes the series: an average of
     * 60 or more qualifies the student (and puts them in the Vault); less moves them to the next series, or into the 45-day
     * cooldown after the third. The ONE place that rule lives - the live flow above and the superadmin's score edits both end here.
     *
     * Must run inside the caller's transaction, on a row it has locked.
     *
     * @return VaultProfile|null the student's Vault profile when this call qualified them
     */
    public function evaluateSeries(VaultInterviewQualification $qual): ?VaultProfile
    {
        $scores = $qual->series_scores ?? [];

        if (! isset($scores['1'], $scores['2'], $scores['3'])) {
            $qual->save();

            return null;
        }

        $avg = round(($scores['1'] + $scores['2'] + $scores['3']) / 3, 2);
        $qual->series_average = $avg;

        // Kept on the student too (their best series average), whether this series qualifies them or not.
        app(ScoreLedger::class)->vaultAi((int) $qual->user_id, $avg);

        if ($avg >= VaultInterviewQualification::PASSING_THRESHOLD) {
            $qual->status = VaultInterviewQualification::STATUS_QUALIFIED;
            $qual->qualified_at = Carbon::now();
            $qual->cooldown_until = null;
            $qual->save();

            // The candidate joins the Vault in the same transaction: if that fails, the score is not recorded
            // either, and reconcile() tries again on the next visit.
            $user = User::findOrFail($qual->user_id);

            return $this->vault->applyAiInterviewQualification(
                $user, $qual->stack_key, $qual->role_key, $avg, array_map('intval', $scores), (int) $qual->current_attempt
            );
        }

        // FAILED ATTEMPT: Average < 60%
        $history = $qual->attempt_history ?? [];
        $history[] = [
            'attempt' => $qual->current_attempt,
            'series_number' => $qual->current_attempt,
            'scores' => $scores,
            'average' => $avg,
            'evaluated_at' => Carbon::now()->toIso8601String(),
            'passed' => false,
        ];
        $qual->attempt_history = $history;

        if ($qual->current_attempt < VaultInterviewQualification::MAX_ATTEMPTS) {
            // Advance to next distinct series for next attempt
            $nextAttempt = $qual->current_attempt + 1;
            $qual->current_attempt = $nextAttempt;
            $qual->active_series_id = "{$qual->role_key}-{$qual->stack_key}-series-{$nextAttempt}";
            $qual->series_scores = [];
            $qual->series_average = null;
        } else {
            // Exhausted all 3 attempts -> activate 45-day cooldown
            $qual->status = VaultInterviewQualification::STATUS_COOLING_DOWN;
            $qual->cooldown_until = Carbon::now()->addDays(VaultInterviewQualification::COOLDOWN_DAYS);
        }

        $qual->save();

        return null;
    }

    /**
     * Scores that exist on a finished interview but never reached the qualification (the call from the scoring job
     * failed, or the app was deployed mid-attempt) are recorded now, so a set can never be stuck "scoring".
     */
    private function reconcile(VaultInterviewQualification $qual): VaultInterviewQualification
    {
        for ($setNum = 1; $setNum <= 3; $setNum++) {
            if ($qual->status !== VaultInterviewQualification::STATUS_IN_PROGRESS) {
                break;
            }

            if (isset(($qual->series_scores ?? [])[(string) $setNum])) {
                continue;
            }

            $interview = $this->interviewFor($qual, $setNum);
            $session = $interview
                ? InterviewSession::where('interview_id', $interview->id)->where('user_id', $qual->user_id)->first()
                : null;

            if ($session?->status === InterviewSession::STATUS_COMPLETED && $session->composite_score_percent !== null) {
                $qual = $this->recordSetScoreAndEvaluate($interview, (int) round($session->composite_score_percent)) ?? $qual;
            }
        }

        return $qual;
    }

    /**
     * The interview launched for this set in the CURRENT attempt of this qualification, if any.
     */
    private function interviewFor(VaultInterviewQualification $qual, int $setNumber): ?Interview
    {
        return Interview::where('created_by', $qual->user_id)
            ->where('practice_config->qualification_id', $qual->id)
            ->where('practice_config->attempt_seq', $this->attemptSeq($qual))
            ->where('practice_config->set_number', $setNumber)
            ->orderByDesc('id')
            ->first();
    }

    /**
     * Which sitting of this qualification we are on: 1 for the first series, +1 for every failed series, so it never
     * repeats — not even when a finished cooldown sends the student back to Series 1.
     */
    private function attemptSeq(VaultInterviewQualification $qual): int
    {
        return count($qual->attempt_history ?? []) + (int) $qual->attempt_offset + 1;
    }

    /**
     * "Tell me when this opens" for a stack that is not open yet (or take it back). Idempotent. A stack that is already open
     * has nothing to wait for, and an unknown one is a 404.
     */
    public function setInterest(User $user, string $stackKey, bool $interested): void
    {
        $found = $this->catalog->stack($stackKey);

        if ($found === null) {
            throw new NotFoundHttpException("Unknown interview stack [{$stackKey}].");
        }

        if ($interested && $this->catalog->progress($found['stack'])['live']) {
            throw new HttpException(422, "The {$found['stack']['name']} interview is already open — you can start it now.");
        }

        if ($interested) {
            VaultStackInterest::firstOrCreate(['user_id' => $user->id, 'stack_key' => $stackKey]);

            return;
        }

        VaultStackInterest::where('user_id', $user->id)->where('stack_key', $stackKey)->delete();
    }

    private function notifyQualified(VaultInterviewQualification $qual, VaultProfile $profile): void
    {
        try {
            $user = User::find($qual->user_id);

            if (! $user) {
                return;
            }

            $stackName = $this->catalog->stack($qual->stack_key)['stack']['name'] ?? ucwords(str_replace('_', ' ', $qual->stack_key));
            $average = rtrim(rtrim(number_format((float) $qual->series_average, 2, '.', ''), '0'), '.');

            // Say only what is true: being qualified is not the same as being visible to hiring partners.
            $next = match ($profile->visibility_status) {
                VaultProfile::STATUS_VISIBLE => 'Your profile is now live in Mellow Vault.',
                VaultProfile::STATUS_PENDING_CONSENT => 'Open your Vault and give consent to go live.',
                VaultProfile::STATUS_UPGRADE_REQUIRED => 'Your plan does not include the Vault yet — upgrade to be seen by hiring partners.',
                default => 'Open your Vault to see where your profile stands.',
            };

            app(NotificationService::class)->notify(
                $user,
                NotificationType::VaultActivity,
                'Mellow Vault Qualified!',
                "Congratulations! You scored {$average}% in the {$stackName} Vault AI Interview. {$next}",
                [
                    'url' => '/dashboard/vault',
                    'severity' => 'success',
                    'group_key' => 'vault.qualified:'.$user->id.':'.$qual->stack_key,
                ]
            );
        } catch (\Throwable $e) {
            // The notification is a courtesy; the qualification is already recorded.
            report($e);
        }
    }
}
