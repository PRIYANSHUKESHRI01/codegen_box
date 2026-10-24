<?php

namespace App\Console\Commands;

use App\Models\Interview;
use App\Models\InterviewQuestion;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Practice interviews that nobody ever started pile up (a student builds one, changes their mind). Removes the ones with no session
 * after `practice_interviews.limits.unused_days`. An interview that has a session — started or finished — is history and is kept.
 */
class PrunePracticeInterviews extends Command
{
    protected $signature = 'interview:prune-practice';

    protected $description = 'Delete practice interviews that were built but never taken';

    public function handle(): int
    {
        $cutoff = now()->subDays((int) config('practice_interviews.limits.unused_days'));
        $removed = 0;

        Interview::query()->where('interview_type', Interview::INTERVIEW_TYPE_PRACTICE)->where('created_at', '<', $cutoff)->doesntHave('sessions')
            ->select('id')->chunkById(200, function ($chunk) use (&$removed) {
                DB::transaction(function () use ($chunk, &$removed) {
                    $ids = $chunk->pluck('id');
                    InterviewQuestion::whereIn('interview_id', $ids)->delete();
                    $removed += Interview::whereIn('id', $ids)->delete();
                });
            });

        $this->info("Removed {$removed} unused practice interview(s).");

        return self::SUCCESS;
    }
}
