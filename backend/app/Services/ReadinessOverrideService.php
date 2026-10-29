<?php

namespace App\Services;

use App\Enums\NotificationType;
use App\Models\ActivityLog;
use App\Models\ReadinessOverride;
use App\Models\User;
use App\Services\Vault\VaultRefreshService;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * A superadmin's hand-set readiness score for a student: set it, change it, take it off.
 *
 * The number itself lives in `readiness_overrides` and is applied inside ReadinessScoreService - the one place a score is
 * worked out - so there is nothing to keep in step: the student's own screens, the TPO roster and reports, the Vault and its
 * history all read the same score. What this class adds is the part that makes a change visible AT ONCE instead of at the
 * next scheduled refresh: it re-runs the Vault refresh for that one student (which also stores the score on the student,
 * moves the Vault profile across the entry / exit line, and records today's point of the history chart) and drops the
 * short readiness cache the Vault AI Interview's access check keeps.
 *
 * Every change is audited with who did it and why, and the student is told.
 */
class ReadinessOverrideService
{
    public function __construct(private readonly VaultRefreshService $refresh) {}

    public function current(User $user): ?ReadinessOverride
    {
        return ReadinessOverride::where('user_id', $user->id)->inForce()->first();
    }

    /** The row even when it has expired, for the admin screen ("expired on ..."). */
    public function latest(User $user): ?ReadinessOverride
    {
        return ReadinessOverride::where('user_id', $user->id)->first();
    }

    /**
     * @param  int|null  $days  how long it stays in force; null = until a superadmin removes it
     */
    public function set(User $user, int $score, string $reason, User $by, ?int $days = null): ReadinessOverride
    {
        $score = max(0, min(100, $score));
        $before = $user->readinessScore();

        $override = DB::transaction(fn () => ReadinessOverride::updateOrCreate(
            ['user_id' => $user->id],
            [
                'score' => $score,
                'reason' => $reason,
                'set_by_id' => $by->id,
                'expires_at' => $days === null ? null : now()->addDays($days),
            ]
        ));

        $after = $this->settle($user);

        ActivityLog::record($by, 'Set a student\'s readiness score by hand', 'Student readiness', $user->name, [
            'user_id' => $user->id,
            'score' => $score,
            'calculated_score' => $after['override']['calculated_score'] ?? null,
            'score_before' => $before,
            'expires_at' => $override->expires_at?->toIso8601String(),
            'reason' => $reason,
        ]);

        $this->tell($user, "Your readiness score is now {$score}", "The AptRun team updated your readiness score to {$score}. It shows on your dashboard, your Vault page and your college's reports.");

        return $override;
    }

    /** Hands the student back to their calculated score. */
    public function clear(User $user, string $reason, User $by): bool
    {
        $override = $this->latest($user);

        if ($override === null) {
            return false;
        }

        $before = $user->readinessScore();
        $override->delete();
        $after = $this->settle($user);

        ActivityLog::record($by, 'Removed a student\'s hand-set readiness score', 'Student readiness', $user->name, [
            'user_id' => $user->id,
            'score_before' => $before,
            'score_after' => $after['score'],
            'reason' => $reason,
        ]);

        $this->tell($user, "Your readiness score is back to {$after['score']}", "Your readiness score is calculated from your activity again: {$after['score']}.");

        return true;
    }

    /**
     * Makes the new score real everywhere, now: forget what was cached, re-score the student, and run the Vault refresh for them.
     *
     * @return array<string, mixed> the student's breakdown as it now stands
     */
    private function settle(User $user): array
    {
        Cache::forget("vault-ai-access:readiness:{$user->id}");

        $fresh = User::findOrFail($user->id);
        $this->refresh->refresh([$fresh]);

        return $fresh->readinessBreakdown();
    }

    private function tell(User $user, string $title, string $body): void
    {
        app(NotificationService::class)->notify($user, NotificationType::VaultActivity, $title, $body, [
            'url' => '/dashboard/vault',
            'severity' => 'info',
            // One per change: two edits in a row are two things the student should see.
            'group_key' => 'readiness.override:'.$user->id.':'.now()->timestamp,
        ]);
    }
}
