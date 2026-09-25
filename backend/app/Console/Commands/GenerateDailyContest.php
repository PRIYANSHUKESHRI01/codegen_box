<?php

namespace App\Console\Commands;

use App\Models\Contest;
use App\Models\ContestProblem;
use App\Models\Problem;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Scheduled once daily (see routes/console.php), well before the contest's
 * own start time, so it's visible in students' "Upcoming" list and they can
 * register ahead of it. Creates ONE platform-wide "Daily Challenge" contest
 * — 1 easy, 1 medium, 1 hard problem, open for config('contests.daily.
 * duration_minutes') starting at config('contests.daily.start_time') — and
 * publishes it immediately (there is no draft-curation step for this
 * contest_type, unlike `general`/`company`).
 *
 * Idempotent two ways: `daily_key` (today's date) is checked before doing
 * any work, AND is a real unique DB column, so two overlapping scheduler
 * fires racing each other still can't both succeed — the loser's insert
 * hits a duplicate-key error, caught below and treated as a clean no-op.
 */
class GenerateDailyContest extends Command
{
    protected $signature = 'contests:generate-daily';

    protected $description = "Auto-create today's platform-wide Daily Challenge contest (1 easy, 1 medium, 1 hard)";

    public function handle(): int
    {
        $timezone = config('contests.daily.timezone');
        $today = Carbon::now($timezone)->toDateString();

        if (Contest::where('daily_key', $today)->exists()) {
            $this->info("Daily contest for {$today} already exists — skipping.");

            return self::SUCCESS;
        }

        $selected = [];
        foreach (Problem::DIFFICULTIES as $difficulty) {
            $problem = $this->pickProblem($difficulty);

            if (! $problem) {
                $message = "No available {$difficulty} problem found for today's Daily Challenge — aborting, nothing was created.";
                $this->error($message);
                Log::error('GenerateDailyContest: '.$message, ['date' => $today, 'difficulty' => $difficulty]);

                return self::FAILURE;
            }

            $selected[$difficulty] = $problem;
        }

        // Eloquent's `datetime` cast writes whatever wall-clock the Carbon
        // instance shows with NO timezone conversion (a DATETIME column
        // carries no tz of its own) and reads it back interpreted as
        // config('app.timezone') (UTC). So the instant must be converted to
        // UTC here, before save — parsing "19:00" straight in Asia/Kolkata
        // and saving it as-is would store literal "19:00:00", which is then
        // read back as 19:00 UTC = 12:30 AM IST the next day, not 7 PM IST.
        $startAt = Carbon::parse("{$today} ".config('contests.daily.start_time'), $timezone)
            ->setTimezone(config('app.timezone'));
        $endAt = (clone $startAt)->addMinutes((int) config('contests.daily.duration_minutes'));
        $points = config('contests.daily.points');

        try {
            $contest = DB::transaction(function () use ($today, $startAt, $endAt, $selected, $points) {
                $contest = Contest::create([
                    'title' => 'Daily Challenge — '.$startAt->format('d M Y'),
                    'slug' => Contest::uniqueSlug('daily-challenge-'.$today),
                    'description' => 'Automatically generated every day — one Easy, one Medium, one Hard problem, open 7:00 PM to 8:00 PM.',
                    'start_at' => $startAt,
                    'end_at' => $endAt,
                    'is_rated' => true,
                    'status' => Contest::STATUS_PUBLISHED,
                    'contest_type' => Contest::CONTEST_TYPE_DAILY,
                    'is_auto_generated' => true,
                    'daily_key' => $today,
                    'created_by' => null,
                ]);

                $order = 0;
                foreach (Problem::DIFFICULTIES as $difficulty) {
                    ContestProblem::create([
                        'contest_id' => $contest->id,
                        'problem_id' => $selected[$difficulty]->id,
                        'points' => $points[$difficulty],
                        'display_order' => $order++,
                    ]);
                }

                return $contest;
            });
        } catch (QueryException $e) {
            if (str_contains($e->getMessage(), 'daily_key')) {
                $this->info("Daily contest for {$today} was created concurrently by another run — skipping.");

                return self::SUCCESS;
            }

            throw $e;
        }

        $this->info("Created '{$contest->title}' ({$contest->slug}) — ".implode(', ', array_map(
            fn ($difficulty) => "{$difficulty}: {$selected[$difficulty]->title}",
            Problem::DIFFICULTIES
        )));

        return self::SUCCESS;
    }

    /**
     * Picks the least-recently-used problem of a difficulty that isn't
     * currently attached to any other still-live/upcoming published contest
     * (so today's Daily Challenge can never accidentally reuse a problem a
     * student could see in a concurrent company/mock contest). "Least
     * recently used in a past Daily Challenge" naturally cycles through the
     * whole difficulty pool before ever repeating, and scales from 605
     * problems today to 3,000+ later with no config change — a
     * never-yet-used problem sorts first since MySQL orders NULL before any
     * real date in ASC order. A small random pick among the top N stalest
     * candidates (config('contests.daily.candidate_pool_size')) keeps the
     * choice from being perfectly predictable day to day.
     */
    private function pickProblem(string $difficulty): ?Problem
    {
        $busyProblemIds = ContestProblem::whereHas(
            'contest',
            fn ($q) => $q->where('status', Contest::STATUS_PUBLISHED)->where('end_at', '>', now())
        )->pluck('problem_id');

        $lastUsed = DB::table('contest_problems')
            ->join('contests', 'contests.id', '=', 'contest_problems.contest_id')
            ->where('contests.contest_type', Contest::CONTEST_TYPE_DAILY)
            ->select('contest_problems.problem_id', DB::raw('MAX(contests.start_at) as last_used_at'))
            ->groupBy('contest_problems.problem_id');

        $poolSize = max(1, (int) config('contests.daily.candidate_pool_size', 10));

        $candidateIds = Problem::query()
            ->where('difficulty', $difficulty)
            ->whereNotIn('id', $busyProblemIds)
            ->leftJoinSub($lastUsed, 'lu', 'lu.problem_id', '=', 'problems.id')
            ->orderByRaw('lu.last_used_at IS NOT NULL, lu.last_used_at ASC')
            ->limit($poolSize)
            ->pluck('problems.id');

        if ($candidateIds->isEmpty()) {
            return null;
        }

        return Problem::find($candidateIds->random());
    }
}
