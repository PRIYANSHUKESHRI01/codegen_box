<?php

namespace App\Console\Commands;

use App\Services\ContestLeaderboardService;
use App\Services\WeeklyRewardService;
use Illuminate\Console\Command;

/**
 * Scheduled every day just after midnight IST (routes/console.php): closes out the week that has just finished — a ledger row and a
 * bell notification for everyone who held a prize rank (see WeeklyRewardService::finalize). Only Monday's run has anything to do; the
 * other days find the ledger already written and change nothing, which is also what makes a missed run harmless.
 */
class FinalizeWeeklyRewards extends Command
{
    protected $signature = 'rewards:finalize-weekly {--week= : Any date in the week to close out (default: last week)}';

    protected $description = 'Record the winners of the weekly contest leaderboard that has just finished and tell them';

    public function handle(WeeklyRewardService $rewards, ContestLeaderboardService $board): int
    {
        $week = $this->option('week') ? $rewards->weekOf((string) $this->option('week')) : $board->previousWeek();

        if ($week['end']->isFuture()) {
            $this->warn("The week of {$week['key']} has not finished yet.");

            return self::FAILURE;
        }

        $created = $rewards->finalize($week);
        $this->info($created > 0 ? "Recorded {$created} winner(s) for the week of {$week['key']}." : "Nothing new to record for the week of {$week['key']}.");

        return self::SUCCESS;
    }
}
