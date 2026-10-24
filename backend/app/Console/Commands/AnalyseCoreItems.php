<?php

namespace App\Console\Commands;

use App\Services\Core\CoreItemAnalysisService;
use Illuminate\Console\Command;

/**
 * Nightly item analysis for Core Prep: from what students actually answered, work out which questions are too easy, too
 * hard, tell strong students from weak ones poorly — or look like they have the wrong answer key — and flag them for
 * Mellow Ops to review (Core Prep → Questions → "Flagged by analysis"). Changes no key and retires nothing. Safe to run by hand.
 */
class AnalyseCoreItems extends Command
{
    protected $signature = 'core:analyse-items';

    protected $description = 'Recompute Core question statistics (facility, discrimination) and flag questions staff should review';

    public function handle(CoreItemAnalysisService $analysis): int
    {
        $result = $analysis->run();

        $this->info("Analysed {$result['analysed']} question(s); {$result['flagged']} flagged for review.");

        return self::SUCCESS;
    }
}
