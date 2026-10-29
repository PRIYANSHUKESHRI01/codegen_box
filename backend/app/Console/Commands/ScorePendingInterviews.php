<?php

namespace App\Console\Commands;

use App\Jobs\ScoreInterviewSessionJob;
use App\Models\InterviewSession;
use Illuminate\Console\Command;

/**
 * The safety net under live AI scoring. A finished interview is scored right after the request that finished it (a few seconds); this
 * command, run every minute by the scheduler, picks up the rare session that was left behind — the PHP process was restarted mid-scoring,
 * say — so a student is never stuck on "scoring..." with no score. It only touches sessions that finished more than a couple of minutes ago,
 * have no score and have not been marked as failed (a failed scoring is deliberately left for a human), and the job itself does nothing if a
 * score has appeared in the meantime.
 */
class ScorePendingInterviews extends Command
{
    protected $signature = 'interview:score-pending {--older-than=120 : Only sessions finished at least this many seconds ago} {--limit=20 : At most this many per run}';

    protected $description = 'Score finished AI interviews whose live scoring never completed';

    public function handle(): int
    {
        $sessions = InterviewSession::query()
            ->where('status', InterviewSession::STATUS_COMPLETED)
            ->whereNull('ai_scored_at')
            ->whereNull('reviewed_at')
            ->whereNull('scoring_failed_at')
            ->where('completed_at', '<=', now()->subSeconds((int) $this->option('older-than')))
            // Nothing older than a day: a session that old with no score is a human's call, not a retry's.
            ->where('completed_at', '>=', now()->subDay())
            ->whereHas('responses')
            ->orderBy('completed_at')
            ->limit((int) $this->option('limit'))
            ->pluck('id');

        foreach ($sessions as $id) {
            ScoreInterviewSessionJob::dispatchSync($id);
        }

        if ($sessions->isNotEmpty()) {
            $this->info("Re-scored {$sessions->count()} interview(s) whose scoring had not completed.");
        }

        return self::SUCCESS;
    }
}
