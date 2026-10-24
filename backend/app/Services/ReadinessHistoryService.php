<?php

namespace App\Services;

use App\Enums\NotificationType;
use App\Models\ReadinessSnapshot;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * The day-by-day record of every student's readiness score — see the readiness_snapshots migration.
 *
 * ReadinessScoreService measures; VaultService decides what a measurement means; this class remembers. It is called by
 * the same refresh that moves Vault state (VaultRefreshService), so one scoring pass feeds all three and they cannot
 * disagree about what a student's score was on a given day.
 *
 *   record()   today's row for a whole chunk of students — one read, one upsert, and only the rows that changed.
 *   nudge()    the "you slipped" notification, on the 1st, 3rd and 7th idle day (once each, however often it runs).
 *   history()  what the student's chart and the Vault page read.
 *   prune()    drops rows past the retention window.
 */
class ReadinessHistoryService
{
    /** Idle days on which a student who was recently active is told their score is slipping. Once each, then they are left alone. */
    public const NUDGE_ON_IDLE_DAYS = [1, 3, 7];

    /** Rows per upsert statement. */
    private const CHUNK = 200;

    /**
     * Writes today's snapshot for each student. A student with nothing to track yet (no score, never tracked) gets no row,
     * so a roster of dormant accounts costs nothing; once a student has a row they keep getting one, even at 0 — the
     * chart must show the fall, not stop.
     *
     * @param  array<int, array>  $breakdowns  student id => ReadinessScoreService breakdown
     * @return int rows written
     */
    public function record(array $breakdowns): int
    {
        if ($breakdowns === []) {
            return 0;
        }

        $today = now()->toDateString();
        $stamp = now()->toDateTimeString();

        $existing = DB::table('readiness_snapshots')
            ->whereIn('user_id', array_keys($breakdowns))
            ->where('snapshot_date', $today)
            ->get(['user_id', 'score', 'base_score', 'penalty', 'missed_days', 'active_today', 'components'])
            ->keyBy('user_id');

        $rows = [];

        foreach ($breakdowns as $userId => $breakdown) {
            $decay = (array) ($breakdown['decay'] ?? []);
            $base = (int) ($breakdown['base_score'] ?? $breakdown['score']);
            $score = (int) $breakdown['score'];
            $before = $existing[$userId] ?? null;

            if ($before === null && $base === 0 && $score === 0 && ! ($decay['tracking'] ?? false)) {
                continue;
            }

            $components = [];
            foreach ((array) ($breakdown['components'] ?? []) as $component) {
                $components[$component['key']] = (int) $component['score'];
            }
            ksort($components);
            $json = json_encode($components);

            $row = [
                'user_id' => (int) $userId,
                'snapshot_date' => $today,
                'score' => $score,
                'base_score' => $base,
                'penalty' => (int) ($decay['points'] ?? 0),
                'missed_days' => (int) ($decay['missed_days'] ?? 0),
                'active_today' => (bool) ($decay['practised_today'] ?? false),
                'tier' => mb_substr((string) ($breakdown['tier'] ?? ''), 0, 20),
                'profile' => mb_substr((string) ($breakdown['profile'] ?? 'software'), 0, 16),
                'version' => (int) config('readiness.version'),
                'components' => $json,
                'created_at' => $stamp,
                'updated_at' => $stamp,
            ];

            if ($before !== null && $this->sameAs($before, $row)) {
                continue;
            }

            $rows[] = $row;
        }

        foreach (array_chunk($rows, self::CHUNK) as $chunk) {
            DB::table('readiness_snapshots')->upsert(
                $chunk,
                ['user_id', 'snapshot_date'],
                ['score', 'base_score', 'penalty', 'missed_days', 'active_today', 'tier', 'profile', 'version', 'components', 'updated_at'],
            );
        }

        return count($rows);
    }

    /** Whether the stored row already says what the new one would. @param object $before */
    private function sameAs(object $before, array $row): bool
    {
        // The database may hand the keys back in its own order (MySQL sorts JSON keys): compare as sorted maps.
        $stored = is_string($before->components) ? (array) json_decode($before->components, true) : (array) $before->components;
        ksort($stored);
        $stored = json_encode($stored);

        return (int) $before->score === $row['score']
            && (int) $before->base_score === $row['base_score']
            && (int) $before->penalty === $row['penalty']
            && (int) $before->missed_days === $row['missed_days']
            && (bool) $before->active_today === $row['active_today']
            && $stored === $row['components'];
    }

    // ───────────────────────────── the nudge ─────────────────────────────

    /**
     * Tells a student their score is slipping — only a student who WAS practising (a month-long absence is the win-back
     * e-mail's business, not a daily bell), only on the 1st, 3rd and 7th idle day, and only while they have not yet
     * practised today. The notification's group key carries the day they were last active, so each milestone of each
     * absence is raised once however many refreshes see it.
     *
     * @param  array<string, mixed>  $breakdown
     * @param  bool  $listed  the student is Vault-eligible right now (they have a place to lose)
     */
    public function nudge(User $user, array $breakdown, bool $listed = false): bool
    {
        $decay = (array) ($breakdown['decay'] ?? []);
        $idle = $decay['idle_days'] ?? null;
        $lost = (int) ($decay['points'] ?? 0);

        if (! ($decay['enabled'] ?? false) || $idle === null || $lost <= 0 || ($decay['practised_today'] ?? false)
            || ! in_array($idle, self::NUDGE_ON_IDLE_DAYS, true)) {
            return false;
        }

        $score = (int) $breakdown['score'];
        $line = (int) config('vault.enter_score', 60);
        $exit = min((int) config('vault.exit_score', 55), $line);
        $days = $idle === 1 ? 'a day' : "{$idle} days";

        $body = "You've been away for {$days} and that has cost you {$lost} ".($lost === 1 ? 'point' : 'points').'. Do anything on AptRun today to stop the slide.';

        if ($listed) {
            $body .= $score >= $exit
                ? " You stay in the Vault while you're at {$exit} or above — you're at {$score}."
                : " You've dropped below {$exit}, so you're no longer in the Vault; practise to get back to {$line}.";
        } elseif ($score < $line && $line - $score <= 15) {
            $body .= ' You are '.($line - $score).' '.(($line - $score) === 1 ? 'point' : 'points')." from the Vault line ({$line}).";
        }

        return app(NotificationService::class)->notify($user, NotificationType::ReadinessSlip, "Your readiness slipped to {$score}", $body, [
            'url' => '/dashboard/vault',
            'severity' => 'warning',
            'group_key' => "readiness.slip:{$user->id}:".($decay['last_active'] ?? 'none').":{$idle}",
        ]);
    }

    // ───────────────────────────── reading it back ─────────────────────────────

    /**
     * What the student's chart and the Vault page need: their daily scores for the last `$days` days (today taken from the
     * live breakdown, not from the last refresh), and a few facts worth saying out loud.
     *
     * @param  array<string, mixed>  $live  the student's current breakdown
     * @return array{points: array<int, array<string, mixed>>, summary: array<string, mixed>}
     */
    public function history(User $user, array $live, int $days = 30): array
    {
        $days = max(7, min(120, $days));
        $today = now()->toDateString();
        $from = now()->subDays($days - 1)->toDateString();
        $line = (int) config('vault.enter_score', 60);

        $points = [];
        $stats = null;
        $crossed = null;

        // Fails soft: code deployed a moment before `migrate` must not take the Vault page down with it.
        try {
            $points = ReadinessSnapshot::where('user_id', $user->id)
                ->where('snapshot_date', '>=', $from)
                ->where('snapshot_date', '<', $today)
                ->orderBy('snapshot_date')
                ->get(['snapshot_date', 'score', 'base_score', 'penalty', 'active_today'])
                ->map(fn (ReadinessSnapshot $s) => [
                    'date' => $s->snapshot_date->toDateString(),
                    'score' => $s->score,
                    'base_score' => $s->base_score,
                    'penalty' => $s->penalty,
                    'active' => $s->active_today,
                ])->values()->all();

            $stats = DB::table('readiness_snapshots')->where('user_id', $user->id)
                ->selectRaw('MIN(snapshot_date) as first_day, MAX(score) as best')->first();
            $crossed = DB::table('readiness_snapshots')->where('user_id', $user->id)->where('score', '>=', $line)
                ->min('snapshot_date');
        } catch (\Throwable $e) {
            report($e);
        }

        $decay = (array) ($live['decay'] ?? []);
        $points[] = [
            'date' => $today,
            'score' => (int) $live['score'],
            'base_score' => (int) ($live['base_score'] ?? $live['score']),
            'penalty' => (int) ($decay['points'] ?? 0),
            'active' => (bool) ($decay['practised_today'] ?? false),
        ];

        $score = (int) $live['score'];

        return [
            'points' => $points,
            'summary' => [
                'score' => $score,
                'threshold' => $line,
                'tracking_since' => $stats?->first_day ? substr((string) $stats->first_day, 0, 10) : null,
                'best' => max((int) ($stats->best ?? 0), $score),
                'first_crossed_on' => $crossed ? substr((string) $crossed, 0, 10) : ($score >= $line ? $today : null),
                'change_7d' => $this->changeOver($points, 7),
                'days_to_threshold' => $this->estimateDaysToThreshold($points, $score, $line),
            ],
        ];
    }

    /**
     * Points gained (or lost) against the point closest to `$days` days ago — or the oldest point there is, if tracking
     * is younger than that. Null when there is nothing earlier to compare with.
     *
     * @param  array<int, array<string, mixed>>  $points  oldest first, today last
     */
    private function changeOver(array $points, int $days): ?int
    {
        if (count($points) < 2) {
            return null;
        }

        $target = now()->subDays($days)->toDateString();
        $now = end($points);
        $reference = $points[0];

        foreach ($points as $point) {
            if ($point['date'] <= $target) {
                $reference = $point;
            }
        }

        return (int) $now['score'] - (int) $reference['score'];
    }

    /**
     * "At this pace" — a straight line through the last two weeks of scores. Only said when there is a real trend to read
     * (a week or more of points, climbing at least a third of a point a day) and the answer is within a few months;
     * otherwise null and the page says nothing rather than guessing.
     *
     * @param  array<int, array<string, mixed>>  $points
     */
    private function estimateDaysToThreshold(array $points, int $score, int $line): ?int
    {
        if ($score >= $line) {
            return null;
        }

        $recent = array_values(array_filter($points, fn (array $p) => $p['date'] >= now()->subDays(14)->toDateString()));

        if (count($recent) < 7) {
            return null;
        }

        $span = (int) abs(Carbon::parse($recent[0]['date'])->diffInDays(Carbon::parse(end($recent)['date'])));
        $slope = $span > 0 ? ((int) end($recent)['score'] - (int) $recent[0]['score']) / $span : 0;

        if ($slope < 0.34) {
            return null;
        }

        $eta = (int) ceil(($line - $score) / $slope);

        return $eta <= 120 ? max(1, $eta) : null;
    }

    public function prune(): int
    {
        return DB::table('readiness_snapshots')
            ->where('snapshot_date', '<', now()->subDays(max(30, (int) config('readiness.history_retention_days', 400)))->toDateString())
            ->delete();
    }
}
