<?php

namespace App\Console\Commands;

use App\Models\Contest;
use App\Services\ContestFinalizeService;
use Illuminate\Console\Command;

/**
 * Scheduled every 5 minutes (see routes/console.php) — finalizes any
 * published contest whose end_at has passed and hasn't been scored yet.
 * Safe to run manually or repeatedly (ContestFinalizeService is idempotent
 * via Contest::finalized_at).
 */
class FinalizeContests extends Command
{
    protected $signature = 'contests:finalize';

    protected $description = 'Score and finalize any ended contest that has not been finalized yet';

    public function handle(ContestFinalizeService $service): int
    {
        $contests = Contest::where('status', Contest::STATUS_PUBLISHED)
            ->whereNull('finalized_at')
            ->where('end_at', '<=', now())
            ->get();

        foreach ($contests as $contest) {
            $result = $service->finalize($contest);
            $this->line("{$contest->title}: {$result['participants_ranked']} participant(s) ranked");
        }

        $this->info("Done — {$contests->count()} contest(s) finalized.");

        return self::SUCCESS;
    }
}
