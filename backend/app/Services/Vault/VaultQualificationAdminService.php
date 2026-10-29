<?php

namespace App\Services\Vault;

use App\Enums\NotificationType;
use App\Models\ActivityLog;
use App\Models\User;
use App\Models\VaultInterviewQualification;
use App\Models\VaultProfile;
use App\Services\NotificationService;
use App\Services\ScoreLedger;
use Carbon\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * What a superadmin can do to a student's Vault AI Interview qualification by hand, one stack at a time:
 *
 *   reset          give the student their three attempts again (ends a 45-day block; on a qualified student it takes the
 *                  qualification back). A fresh start: nothing of the old cycle can leak into the new one.
 *   setScores      correct the marks of the series the student is sitting, or of a past attempt. The same pass / fail / cooldown
 *                  rules as the live flow decide what the new marks mean (VaultInterviewQualificationService::evaluateSeries),
 *                  so correcting a failed attempt up to 60% qualifies the student, exactly as sitting it would have.
 *   markQualified  qualify the student outright, at a chosen average.
 *   unlockAccess   open the interview itself for a student still waiting out the gate (waiting period / readiness line).
 *
 * Every action needs a reason, is written to the qualification's own log and to the platform audit log, and tells the student
 * when it changes what they can do.
 */
class VaultQualificationAdminService
{
    private const LOG_LIMIT = 40;

    public function __construct(
        private readonly VaultInterviewQualificationService $qualifications,
        private readonly VaultService $vault,
    ) {}

    public function reset(User $user, string $stackKey, User $admin, string $reason): VaultInterviewQualification
    {
        $this->qualifications->getOrCreateQualification($user, $stackKey);

        $qual = DB::transaction(function () use ($user, $stackKey, $admin, $reason) {
            $qual = $this->lock($user, $stackKey);
            $was = $qual->status;

            if ($qual->status === VaultInterviewQualification::STATUS_IN_PROGRESS
                && (int) $qual->current_attempt === 1
                && ($qual->series_scores ?? []) === []
                && ($qual->attempt_history ?? []) === []) {
                throw new HttpException(422, 'This student has not used any attempts on this stack, so there is nothing to reset.');
            }

            $this->freshStart($qual);
            $this->log($qual, $admin, 'reset', $reason, ['from' => $was]);
            $qual->save();

            if ($was === VaultInterviewQualification::STATUS_QUALIFIED) {
                $this->vault->revokeAiInterviewQualification($user, $this->remainingQualification($user, $qual));
            }

            $this->resyncLedger($user);

            return $qual;
        });

        $this->audit($admin, $user, $qual, 'reset', $reason);

        $this->tell(
            $user,
            $this->stackName($stackKey).' — a fresh start',
            'The AptRun team has reset your Vault AI Interview for this stack. You have all 3 attempts again — open it whenever you are ready.',
            '/dashboard/vault-interviews',
        );

        return $qual->refresh();
    }

    /**
     * @param  array<int|string, int|float|string|null>  $scores  set number (1-3) => percent; only the sets being changed
     * @param  int|null  $historyIndex  correct that past attempt (its position in the attempt history) instead of the series being sat
     */
    public function setScores(User $user, string $stackKey, array $scores, User $admin, string $reason, ?int $historyIndex = null): VaultInterviewQualification
    {
        $scores = $this->cleanScores($scores);
        $this->qualifications->getOrCreateQualification($user, $stackKey);
        $profile = null;
        $outcome = null;

        $qual = DB::transaction(function () use ($user, $stackKey, $scores, $admin, $reason, $historyIndex, &$profile, &$outcome) {
            $qual = $this->lock($user, $stackKey);
            $before = $qual->status;

            if ($historyIndex !== null) {
                $profile = $this->correctPastAttempt($qual, $historyIndex, $scores, $admin);
            } elseif ($qual->status === VaultInterviewQualification::STATUS_COOLING_DOWN) {
                throw new HttpException(422, 'This student is blocked. Correct the marks of one of their past attempts, or give them access again first.');
            } elseif ($qual->status === VaultInterviewQualification::STATUS_QUALIFIED) {
                $profile = $this->correctQualifyingSeries($qual, $scores);
            } else {
                $merged = $qual->series_scores ?? [];
                foreach ($scores as $set => $value) {
                    $merged[(string) $set] = $value;
                }
                $qual->series_scores = $merged;
                $profile = $this->qualifications->evaluateSeries($qual);
            }

            $outcome = $this->outcome($before, $qual);
            $this->log($qual, $admin, 'scores', $reason, [
                'scores' => $scores,
                'past_attempt' => $historyIndex,
                'result' => $outcome,
            ]);
            $qual->save();
            $this->resyncLedger($user);

            return $qual;
        });

        $this->audit($admin, $user, $qual, 'scores', $reason, ['scores' => $scores, 'result' => $outcome]);

        if ($outcome === 'qualified') {
            $this->tellQualified($user, $qual, $profile);
        } elseif ($outcome === 'blocked') {
            $this->tell($user, $this->stackName($stackKey).' — result updated', 'Your Vault AI Interview marks were reviewed by the AptRun team. Open the interview to see where you stand.', '/dashboard/vault-interviews');
        }

        return $qual->refresh();
    }

    /** Qualifies the student at this series average, whatever they have scored so far. */
    public function markQualified(User $user, string $stackKey, float $average, User $admin, string $reason): VaultInterviewQualification
    {
        $average = round(max(VaultInterviewQualification::PASSING_THRESHOLD, min(100, $average)), 2);
        $this->qualifications->getOrCreateQualification($user, $stackKey);
        $profile = null;

        $qual = DB::transaction(function () use ($user, $stackKey, $average, $admin, $reason, &$profile) {
            $qual = $this->lock($user, $stackKey);

            if ($qual->isQualified()) {
                throw new HttpException(422, 'This student is already qualified in this stack.');
            }

            $was = $qual->status;
            $mark = (int) round($average);
            $qual->status = VaultInterviewQualification::STATUS_QUALIFIED;
            $qual->qualified_at = Carbon::now();
            $qual->qualified_by_admin_id = $admin->id;
            $qual->cooldown_until = null;
            $qual->series_scores = ['1' => $mark, '2' => $mark, '3' => $mark];
            $qual->series_average = $average;
            $qual->current_attempt = max(1, min((int) $qual->current_attempt, VaultInterviewQualification::MAX_ATTEMPTS));
            $qual->active_series_id = "{$qual->role_key}-{$qual->stack_key}-series-{$qual->current_attempt}";
            // Anything the student had half-way through belongs to the series that no longer applies.
            $qual->attempt_offset = (int) $qual->attempt_offset + 1;

            $this->log($qual, $admin, 'qualified', $reason, ['average' => $average, 'from' => $was]);
            $qual->save();

            app(ScoreLedger::class)->vaultAi((int) $qual->user_id, $average);

            $profile = $this->vault->applyAiInterviewQualification(
                $user, $qual->stack_key, $qual->role_key, $average, array_map('intval', $qual->series_scores), (int) $qual->current_attempt
            );

            return $qual;
        });

        $this->audit($admin, $user, $qual, 'qualified', $reason, ['average' => $average]);
        $this->tellQualified($user, $qual, $profile);

        return $qual->refresh();
    }

    /**
     * Opens the Vault AI Interview for a student still inside the waiting period or below the readiness line. Written exactly as
     * the system writes a first unlock (users.vault_ai_unlocked_at), so it is kept and nothing later undoes it.
     */
    public function unlockAccess(User $user, User $admin, string $reason): void
    {
        DB::table('users')->where('id', $user->id)->whereNull('vault_ai_unlocked_at')->update(['vault_ai_unlocked_at' => now()]);
        Cache::forget("vault-ai-access:readiness:{$user->id}");

        ActivityLog::record($admin, 'Unlocked the Vault AI Interview for a student', 'Vault AI Interview', $user->name, [
            'user_id' => $user->id,
            'reason' => $reason,
        ]);

        $this->tell($user, 'Vault AI Interview unlocked', 'The AptRun team has opened the Vault AI Interview for you. You can start whenever you are ready.', '/dashboard/vault-interviews');
    }

    // ─────────────────────────────────── internals ───────────────────────────────────

    private function lock(User $user, string $stackKey): VaultInterviewQualification
    {
        return VaultInterviewQualification::where('user_id', $user->id)->where('stack_key', $stackKey)->lockForUpdate()->firstOrFail();
    }

    /** Back to Series 1 with all attempts, as if the student had just arrived. The history stays on record. */
    private function freshStart(VaultInterviewQualification $qual): void
    {
        $qual->status = VaultInterviewQualification::STATUS_IN_PROGRESS;
        $qual->current_attempt = 1;
        $qual->active_series_id = "{$qual->role_key}-{$qual->stack_key}-series-1";
        $qual->series_scores = [];
        $qual->series_average = null;
        $qual->cooldown_until = null;
        $qual->qualified_at = null;
        $qual->qualified_by_admin_id = null;
        // An interview started before this moment must never be taken for one of the new cycle, nor re-score into it.
        $qual->attempt_offset = (int) $qual->attempt_offset + 1;
        $qual->cycle_start = count($qual->attempt_history ?? []);
    }

    /**
     * Corrects the marks of a finished attempt. A correction that lifts it to 60% qualifies the student (unless they already are).
     *
     * @param  array<int, int>  $scores
     */
    private function correctPastAttempt(VaultInterviewQualification $qual, int $index, array $scores, User $admin): ?VaultProfile
    {
        $history = $qual->attempt_history ?? [];

        if (! isset($history[$index])) {
            throw new HttpException(404, 'That attempt is not on record.');
        }

        $entry = $history[$index];
        $merged = $this->completeScores($entry['scores'] ?? [], $scores, 'This attempt');
        $average = round(array_sum($merged) / 3, 2);

        $entry['scores'] = $merged;
        $entry['average'] = $average;
        $entry['edited_by_admin'] = true;

        if ($average < VaultInterviewQualification::PASSING_THRESHOLD || $qual->isQualified()) {
            $history[$index] = $entry;
            $qual->attempt_history = $history;

            return null;
        }

        $entry['passed'] = true;
        $history[$index] = $entry;
        $qual->attempt_history = $history;
        $qual->status = VaultInterviewQualification::STATUS_QUALIFIED;
        $qual->qualified_at = Carbon::now();
        $qual->qualified_by_admin_id = $admin->id;
        $qual->cooldown_until = null;
        $qual->current_attempt = max(1, (int) ($entry['attempt'] ?? 1));
        $qual->active_series_id = "{$qual->role_key}-{$qual->stack_key}-series-{$qual->current_attempt}";
        $qual->series_scores = $merged;
        $qual->series_average = $average;
        $qual->attempt_offset = (int) $qual->attempt_offset + 1;
        $qual->save();

        return $this->vault->applyAiInterviewQualification(
            User::findOrFail($qual->user_id), $qual->stack_key, $qual->role_key, $average, $merged, (int) $qual->current_attempt
        );
    }

    /**
     * A qualified student's marks may be corrected, but not below the line - that is what "Start over" is for.
     *
     * @param  array<int, int>  $scores
     */
    private function correctQualifyingSeries(VaultInterviewQualification $qual, array $scores): ?VaultProfile
    {
        $merged = $this->completeScores($qual->series_scores ?? [], $scores, 'The qualifying series');
        $average = round(array_sum($merged) / 3, 2);

        if ($average < VaultInterviewQualification::PASSING_THRESHOLD) {
            throw new HttpException(422, 'Those marks average '.rtrim(rtrim(number_format($average, 2), '0'), '.').'%, below the 60% line. To take the qualification back, use "Start over" instead.');
        }

        $qual->series_scores = $merged;
        $qual->series_average = $average;
        $qual->save();

        return $this->vault->applyAiInterviewQualification(
            User::findOrFail($qual->user_id), $qual->stack_key, $qual->role_key, $average, $merged, (int) $qual->current_attempt
        );
    }

    /**
     * @param  array<int|string, mixed>  $existing
     * @param  array<int, int>  $changes
     * @return array<string, int> all three sets
     */
    private function completeScores(array $existing, array $changes, string $what): array
    {
        $merged = [];

        foreach ([1, 2, 3] as $set) {
            $value = $changes[$set] ?? $existing[(string) $set] ?? $existing[$set] ?? null;

            if ($value === null) {
                throw new HttpException(422, "{$what} has no mark for Set {$set} - enter all three.");
            }

            $merged[(string) $set] = (int) $value;
        }

        return $merged;
    }

    /**
     * @param  array<int|string, mixed>  $scores
     * @return array<int, int> set number => percent, 0-100
     */
    private function cleanScores(array $scores): array
    {
        $clean = [];

        foreach ($scores as $set => $value) {
            if ($value === null || $value === '') {
                continue;
            }

            if (! in_array((int) $set, [1, 2, 3], true) || ! is_numeric($value) || $value < 0 || $value > 100) {
                throw new HttpException(422, 'Marks are whole percentages between 0 and 100, for sets 1 to 3.');
            }

            $clean[(int) $set] = (int) round((float) $value);
        }

        if ($clean === []) {
            throw new HttpException(422, 'Enter at least one mark.');
        }

        return $clean;
    }

    private function outcome(string $before, VaultInterviewQualification $qual): string
    {
        if ($qual->isQualified() && $before !== VaultInterviewQualification::STATUS_QUALIFIED) {
            return 'qualified';
        }

        if ($qual->status === VaultInterviewQualification::STATUS_COOLING_DOWN && $before !== VaultInterviewQualification::STATUS_COOLING_DOWN) {
            return 'blocked';
        }

        return 'updated';
    }

    /**
     * Another stack this student still holds a qualification in, so the profile keeps pointing at something true.
     *
     * @return array{stack_key: string, role_key: string, average: float, scores: array<string, int>, attempt: int}|null
     */
    private function remainingQualification(User $user, VaultInterviewQualification $except): ?array
    {
        $other = VaultInterviewQualification::where('user_id', $user->id)
            ->where('status', VaultInterviewQualification::STATUS_QUALIFIED)
            ->whereKeyNot($except->id)
            ->orderByDesc('qualified_at')
            ->first();

        return $other === null ? null : [
            'stack_key' => $other->stack_key,
            'role_key' => $other->role_key,
            'average' => (float) $other->series_average,
            'scores' => array_map('intval', $other->series_scores ?? []),
            'attempt' => (int) $other->current_attempt,
        ];
    }

    /** The kept "best Vault AI score" follows the marks that now stand - it may go down after a correction or a reset. */
    private function resyncLedger(User $user): void
    {
        $best = null;

        foreach (VaultInterviewQualification::where('user_id', $user->id)->get() as $q) {
            $averages = array_column(array_filter($q->attempt_history ?? [], fn ($a) => isset($a['average'])), 'average');

            if ($q->series_average !== null) {
                $averages[] = $q->series_average;
            }

            foreach ($averages as $a) {
                $best = $best === null ? (float) $a : max($best, (float) $a);
            }
        }

        app(ScoreLedger::class)->vaultAiExact($user->id, $best);
    }

    /** @param  array<string, mixed>  $details */
    private function log(VaultInterviewQualification $qual, User $admin, string $action, string $reason, array $details = []): void
    {
        $log = $qual->admin_log ?? [];
        $log[] = [
            'at' => Carbon::now()->toIso8601String(),
            'by_id' => $admin->id,
            'by' => $admin->name,
            'action' => $action,
            'reason' => $reason,
        ] + $details;

        $qual->admin_log = array_slice($log, -self::LOG_LIMIT);
    }

    /** @param  array<string, mixed>  $extra */
    private function audit(User $admin, User $user, VaultInterviewQualification $qual, string $action, string $reason, array $extra = []): void
    {
        $label = [
            'reset' => 'Reset a student\'s Vault AI Interview',
            'scores' => 'Corrected a student\'s Vault AI Interview marks',
            'qualified' => 'Marked a student qualified in the Vault AI Interview',
        ][$action] ?? 'Changed a Vault AI Interview qualification';

        ActivityLog::record($admin, $label, 'Vault AI Interview', $user->name, [
            'user_id' => $user->id,
            'stack' => $qual->stack_key,
            'status_now' => $qual->status,
            'reason' => $reason,
        ] + $extra);
    }

    private function stackName(string $stackKey): string
    {
        return app(CuratedCatalog::class)->stack($stackKey)['stack']['name'] ?? ucwords(str_replace('_', ' ', $stackKey));
    }

    private function tellQualified(User $user, VaultInterviewQualification $qual, ?VaultProfile $profile): void
    {
        $average = rtrim(rtrim(number_format((float) $qual->series_average, 2, '.', ''), '0'), '.');
        $next = match ($profile?->visibility_status) {
            VaultProfile::STATUS_VISIBLE => 'Your profile is now live in Mellow Vault.',
            VaultProfile::STATUS_PENDING_CONSENT => 'Open your Vault and give consent to go live.',
            VaultProfile::STATUS_UPGRADE_REQUIRED => 'Your plan does not include the Vault yet — upgrade to be seen by hiring partners.',
            default => 'Open your Vault to see where your profile stands.',
        };

        $this->tell($user, 'Mellow Vault Qualified!', "You are qualified in {$this->stackName($qual->stack_key)} with a {$average}% Vault AI Interview average. {$next}", '/dashboard/vault');
    }

    private function tell(User $user, string $title, string $body, string $url): void
    {
        app(NotificationService::class)->notify($user, NotificationType::VaultActivity, $title, $body, [
            'url' => $url,
            'severity' => 'success',
            'group_key' => 'vault.admin:'.$user->id.':'.now()->timestamp,
        ]);
    }
}
