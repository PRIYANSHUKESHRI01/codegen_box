<?php

namespace App\Console\Commands;

use App\Models\VaultAiResult;
use App\Models\VaultInterviewQualification;
use App\Services\Reports\VaultAiReportService;
use App\Services\Vault\VaultAiResultService;
use Illuminate\Console\Command;

/**
 * Fills the Vault AI results ledger from the qualifications that already exist (everything completed before the ledger was added), and
 * optionally writes each student's report PDF. Safe to run any number of times: a ledger entry is matched, never duplicated, and a report
 * is only written for a result that has none (or for all of them with --force-reports).
 *
 *   php artisan vault-ai:rebuild-results              ledger only
 *   php artisan vault-ai:rebuild-results --reports    also generate the PDFs that are missing
 */
class RebuildVaultAiResults extends Command
{
    protected $signature = 'vault-ai:rebuild-results {--reports : also write the report PDF of every result that has none} {--force-reports : rewrite every report}';

    protected $description = 'Record every completed Vault AI Interview series in the results ledger (and optionally generate the PDF reports)';

    public function handle(VaultAiResultService $results, VaultAiReportService $reports): int
    {
        $rows = 0;

        VaultInterviewQualification::query()->orderBy('id')->chunkById(200, function ($quals) use ($results, &$rows) {
            foreach ($quals as $qual) {
                if ($results->reconcile($qual)[0] !== null) {
                    $rows++;
                }
            }
        });

        $this->info("Ledger up to date: {$rows} result(s).");

        if ($this->option('reports') || $this->option('force-reports')) {
            $made = 0;

            VaultAiResult::query()->orderBy('id')->chunkById(50, function ($batch) use ($reports, &$made) {
                foreach ($batch as $result) {
                    if ($result->report_id !== null && ! $this->option('force-reports')) {
                        continue;
                    }

                    try {
                        $reports->generate($result);
                        $made++;
                    } catch (\Throwable $e) {
                        $this->warn("Report for result #{$result->id} failed: ".$e->getMessage());
                    }
                }
            });

            $this->info("Wrote {$made} report(s).");
        }

        return self::SUCCESS;
    }
}
