<?php

namespace App\Services;

use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * Skill Drills bookkeeping: records the answers a student gave to browser-generated drill questions, and reads them back as the
 * per-skill picture (for mastery) and the day streak. Questions are never stored; only what the student did.
 */
class DrillService
{
    /**
     * Stores a batch of answers. Past the student's daily allowance the rest are quietly dropped — practice never errors out.
     *
     * @param  list<array{pack: string, skill: string, difficulty: int, correct: bool, seconds?: ?int}>  $attempts
     * @return array{accepted: int, dropped: int}
     */
    public function record(User $user, array $attempts, ?int $sittingId = null): array
    {
        $cap = (int) config('drills.limits.attempts_per_day');
        $room = max(0, $cap - DB::table('drill_attempts')->where('user_id', $user->id)->where('created_at', '>=', now()->startOfDay())->count());
        $take = array_slice($attempts, 0, $room);
        $now = now();

        if ($take !== []) {
            DB::table('drill_attempts')->insert(array_map(fn (array $a) => [
                'user_id' => $user->id, 'pack' => $a['pack'], 'skill' => $a['skill'], 'difficulty' => (int) $a['difficulty'],
                'correct' => (bool) $a['correct'], 'seconds' => $a['seconds'] ?? null, 'created_at' => $now, 'study_sitting_id' => $sittingId,
            ], $take));
        }

        return ['accepted' => count($take), 'dropped' => count($attempts) - count($take)];
    }

    /**
     * @return array{skills: array<string, array<string, mixed>>, streak: array<string, mixed>, week: array<string, int>}
     */
    public function summary(User $user): array
    {
        $window = (int) config('drills.recent_window');

        $totals = DB::table('drill_attempts')->where('user_id', $user->id)
            ->selectRaw('skill, count(*) as attempts, sum(case when correct then 1 else 0 end) as correct, max(created_at) as last_at')
            ->groupBy('skill')->get()->keyBy('skill');

        // A skill's most recent answers, newest first — what mastery is judged on.
        $recent = DB::table('drill_attempts')->where('user_id', $user->id)
            ->selectRaw('skill, correct, difficulty, row_number() over (partition by skill order by id desc) as rn')
            ->get()->groupBy('skill');

        $skills = [];
        foreach ($totals as $skill => $row) {
            $skills[$skill] = [
                'attempts' => (int) $row->attempts,
                'correct' => (int) $row->correct,
                'last_at' => CarbonImmutable::parse($row->last_at)->toIso8601String(),
                'recent' => $recent->get($skill, collect())->filter(fn ($r) => (int) $r->rn <= $window)->sortBy('rn')
                    ->map(fn ($r) => [(int) $r->correct, (int) $r->difficulty])->values()->all(),
            ];
        }

        return ['skills' => $skills, 'streak' => $this->streak($user), 'week' => $this->week($user)];
    }

    /**
     * Consecutive days with at least one answer. A streak survives until the end of the day after the last active one (so it is
     * not lost at midnight before the student has had the chance to practise).
     *
     * @return array{current: int, best: int, today: int, active_today: bool}
     */
    private function streak(User $user): array
    {
        $days = DB::table('drill_attempts')->where('user_id', $user->id)->where('created_at', '>=', now()->subDays(400)->startOfDay())
            ->selectRaw('DATE(created_at) as d')->distinct()->pluck('d')->map(fn ($d) => (string) $d)->sort()->values()->all();

        $set = array_flip($days);
        $today = now()->toDateString();
        $activeToday = isset($set[$today]);

        $cursor = $activeToday ? CarbonImmutable::parse($today) : CarbonImmutable::parse($today)->subDay();
        $current = 0;
        while (isset($set[$cursor->toDateString()])) {
            $current++;
            $cursor = $cursor->subDay();
        }

        $best = 0;
        $run = 0;
        $previous = null;
        foreach ($days as $d) {
            $run = $previous !== null && CarbonImmutable::parse($previous)->addDay()->toDateString() === $d ? $run + 1 : 1;
            $best = max($best, $run);
            $previous = $d;
        }

        return [
            'current' => $current, 'best' => max($best, $current), 'active_today' => $activeToday,
            'today' => DB::table('drill_attempts')->where('user_id', $user->id)->where('created_at', '>=', now()->startOfDay())->count(),
        ];
    }

    /** @return array{attempts: int, days: int} */
    private function week(User $user): array
    {
        $since = now()->subDays(6)->startOfDay();
        $rows = DB::table('drill_attempts')->where('user_id', $user->id)->where('created_at', '>=', $since);

        return ['attempts' => (clone $rows)->count(), 'days' => (clone $rows)->selectRaw('DATE(created_at) as d')->distinct()->get()->count()];
    }
}
