<?php

namespace App\Console\Commands;

use App\Models\Interview;
use App\Models\InterviewSession;
use App\Services\Interviews\StudyAttemptRecorder;
use Illuminate\Console\Command;

/**
 * Records, in the permanent attempt ledger, the study sittings (Merchant Navy sets) that were finished before the ledger existed - so their
 * scores count in the student's history and their reports can be downloaded. A sitting that was reset by "Practise again" since is gone (its
 * answers were deleted) and only its latest sitting can be recovered. Safe to run again: a sitting is recorded once.
 */
class BackfillStudyAttempts extends Command
{
    protected $signature = 'study:backfill-attempts';

    protected $description = 'Record finished study sittings (Merchant Navy sets) that are not yet in the score history';

    public function handle(StudyAttemptRecorder $recorder): int
    {
        $recorded = 0;
        $seen = 0;

        Interview::query()->where('practice_config->study', true)->select('id')->orderBy('id')->chunkById(200, function ($interviews) use ($recorder, &$recorded, &$seen) {
            foreach (InterviewSession::with('interview')->whereIn('interview_id', $interviews->pluck('id'))->where('status', InterviewSession::STATUS_COMPLETED)->get() as $session) {
                $seen++;
                $before = \App\Models\StudyAttempt::where('interview_id', $session->interview_id)->where('completed_at', $session->completed_at)->exists();

                if (! $before && $recorder->recordQuietly($session) !== null) {
                    $recorded++;
                }
            }
        });

        $this->info("Looked at {$seen} finished study sittings; recorded {$recorded} new.");

        return self::SUCCESS;
    }
}
