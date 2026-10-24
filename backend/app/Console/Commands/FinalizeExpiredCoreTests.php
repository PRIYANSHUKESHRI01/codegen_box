<?php

namespace App\Console\Commands;

use App\Services\Core\CoreTestService;
use Illuminate\Console\Command;

/**
 * Grades Core test attempts whose clock ran out without the student submitting (they closed the tab, lost
 * power, walked out of the lab). Without this an abandoned attempt would sit open forever and never count
 * toward readiness. Runs every minute from the scheduler; safe to run by hand.
 */
class FinalizeExpiredCoreTests extends Command
{
    protected $signature = 'core:finalize-expired';

    protected $description = 'Grade Core test attempts that ran past their deadline without being submitted';

    public function handle(CoreTestService $tests): int
    {
        $count = $tests->finalizeExpired();

        $this->info("Finalised {$count} expired attempt(s).");

        return self::SUCCESS;
    }
}
