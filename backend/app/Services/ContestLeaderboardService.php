<?php

namespace App\Services;

use App\Models\Contest;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * The global leaderboard, built from contest scores and nothing else. Practice problems no longer count: a place here is
 * earned in rated rounds, where everyone faces the same problems under the same clock.
 *
 *   all time    the sum of a student's scores over every platform-wide contest they have entered
 *   weekly      the same, but only for contests that started this week (Monday 00:00 to Sunday 23:59, India time) — the board
 *               starts again from zero every Monday, which is what the weekly rewards are paid on
 *
 * Only the platform-wide types count (general and the AptRun Daily Challenge). A college's own mock contest or a company's
 * round is seen by one college only, so adding those up would hand an advantage to whoever happens to have more of them.
 * Students with no points are not on the board. Ties on score are broken by the lower total penalty, then shown with the same
 * rank (1, 1, 3).
 */
class ContestLeaderboardService
{
    public const PERIOD_WEEKLY = 'weekly';

    public const PERIOD_ALL_TIME = 'all_time';

    public const PERIODS = [self::PERIOD_WEEKLY, self::PERIOD_ALL_TIME];

    /** Contest types that count towards the board. */
    public const COUNTED_TYPES = [Contest::CONTEST_TYPE_GENERAL, Contest::CONTEST_TYPE_DAILY];

    /** Rows a board returns to the browser (the student's own row is always added on top of this). */
    public const BOARD_SIZE = 50;

    public function timezone(): string
    {
        return (string) config('weekly_rewards.timezone', 'Asia/Kolkata');
    }

    /**
     * The week that contains `$at` (now by default): Monday 00:00 in the leaderboard timezone up to the next Monday 00:00.
     * `start`/`end` are in the app's own timezone, ready to compare with stored datetimes; `key` is the Monday's date and is
     * what names the week everywhere else (a reward row, a log line).
     *
     * @return array{key: string, start: Carbon, end: Carbon}
     */
    public function week(?Carbon $at = null): array
    {
        $monday = ($at ?? Carbon::now())->copy()->setTimezone($this->timezone())->startOfWeek(Carbon::MONDAY);

        return [
            'key' => $monday->toDateString(),
            'start' => $monday->copy()->setTimezone(config('app.timezone')),
            'end' => $monday->copy()->addWeek()->setTimezone(config('app.timezone')),
        ];
    }

    public function previousWeek(?Carbon $at = null): array
    {
        return $this->week($this->week($at)['start']->copy()->subSecond());
    }

    /** What the screens need to say about a week: when it began, when it resets. */
    public function weekPayload(array $week): array
    {
        return ['key' => $week['key'], 'starts_at' => $week['start'], 'resets_at' => $week['end']];
    }

    /**
     * Everyone who scored, best first, with a rank on every row.
     *
     * @param  array{key: string, start: Carbon, end: Carbon}|null  $week  for the weekly period: which week (this one by default)
     * @return Collection<int, array<string, mixed>>
     */
    public function standings(string $period, ?int $collegeId = null, ?array $week = null): Collection
    {
        $query = DB::table('contest_participants as cp')
            ->join('contests as c', 'c.id', '=', 'cp.contest_id')
            ->join('users as u', 'u.id', '=', 'cp.user_id')
            ->where('c.status', Contest::STATUS_PUBLISHED)
            ->whereIn('c.contest_type', self::COUNTED_TYPES)
            ->where('c.start_at', '<=', now()->toDateTimeString())
            ->where('u.role', User::ROLE_USER)
            ->where('cp.score', '>', 0)
            ->when($collegeId !== null, fn ($q) => $q->where('u.college_id', $collegeId));

        if ($period === self::PERIOD_WEEKLY) {
            $week ??= $this->week();
            $query->where('c.start_at', '>=', $week['start']->toDateTimeString())->where('c.start_at', '<', $week['end']->toDateTimeString());
        }

        $rows = $query
            ->groupBy('u.id', 'u.name', 'u.handle', 'u.current_rating', 'u.rated_contests_count')
            ->select('u.id', 'u.name', 'u.handle', 'u.current_rating', 'u.rated_contests_count')
            ->selectRaw('SUM(cp.score) as total_score, SUM(cp.penalty_minutes) as total_penalty, COUNT(*) as contests')
            ->orderByDesc('total_score')
            ->orderBy('total_penalty')
            ->orderBy('u.name')
            ->orderBy('u.id')
            ->get();

        $out = collect();
        $previous = null;
        $rank = 0;

        foreach ($rows as $i => $row) {
            if ($previous === null || (int) $previous->total_score !== (int) $row->total_score || (int) $previous->total_penalty !== (int) $row->total_penalty) {
                $rank = $i + 1;
            }
            $previous = $row;

            $out->push([
                'rank' => $rank,
                'user' => ['id' => (int) $row->id, 'name' => $row->name, 'handle' => $row->handle],
                'contest_score' => (int) $row->total_score,
                'penalty_minutes' => (int) $row->total_penalty,
                'contests_played' => (int) $row->contests,
                'display_rating' => $row->rated_contests_count > 0 ? (string) $row->current_rating : 'Unrated',
            ]);
        }

        return $out;
    }
}
