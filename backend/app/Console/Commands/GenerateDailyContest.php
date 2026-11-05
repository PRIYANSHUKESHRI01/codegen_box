<?php

namespace App\Console\Commands;

use App\Models\Contest;
use App\Models\ContestProblem;
use App\Models\Problem;
use App\Services\DailyChallengeService;
use Illuminate\Console\Command;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Scheduled (see routes/console.php) the moment each day's slot closes (9 PM IST), plus an hourly net, so the NEXT
 * edition is on the calendar the minute the last one ends — well before its own start, visible in students' "Upcoming"
 * list, with registration opening 15 hours ahead — and every student gets a bell notification about it. Creates ONE platform-wide "AptRun Daily Challenge"
 * contest — 1 easy, 1 medium, 1 hard problem, open for config('contests.daily.
 * duration_minutes') starting at config('contests.daily.start_time') (8 PM IST)
 * — and publishes it immediately (there is no draft-curation step for this
 * contest_type, unlike `general`/`company`). The name, slot and wording come
 * from DailyChallengeService, so the scheduler, the API and the screens agree.
 *
 * Which day it makes is DailyChallengeService::targetDate(): today's while today's slot is still ahead, tomorrow's once
 * it has closed. Idempotent two ways: `daily_key` (that date) is checked before doing
 * any work, AND is a real unique DB column, so two overlapping scheduler
 * fires racing each other still can't both succeed — the loser's insert
 * hits a duplicate-key error, caught below and treated as a clean no-op.
 */
class GenerateDailyContest extends Command
{
    protected $signature = 'contests:generate-daily';

    protected $description = 'Auto-create the next platform-wide AptRun Daily Challenge contest (1 easy, 1 medium, 1 hard) and tell the students';

    public function handle(DailyChallengeService $daily): int
    {
        $today = $daily->targetDate();

        $existing = Contest::where('daily_key', $today)->first();

        if ($existing) {
            // The day's contest may have been made before the name or the time changed: while it has not
            // opened yet it is brought in line, so students never see yesterday's slot on today's contest.
            $this->info($daily->realign($existing)
                ? "Daily contest for {$today} already existed — updated to the current name and time."
                : "Daily contest for {$today} already exists — skipping.");

            return self::SUCCESS;
        }

        [$startAt, $endAt] = $daily->slotFor($today);

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

        $points = config('contests.daily.points');

        try {
            $contest = DB::transaction(function () use ($daily, $today, $startAt, $endAt, $selected, $points) {
                $contest = Contest::create([
                    'title' => $daily->titleFor($startAt),
                    'slug' => $daily->slugFor($today),
                    'description' => $daily->descriptionFor($startAt, $endAt),
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

        $told = $daily->announce($contest);
        $this->info("Told {$told} student(s) in their bell.");

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
