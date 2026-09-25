<?php

namespace App\Console\Commands;

use App\Models\College;
use App\Services\WeeklyReadinessReportService;
use Illuminate\Console\Command;

/**
 * Scheduled weekly (see routes/console.php) — one Excel report per college
 * that has a TPO, emailed to that TPO, listing every student currently
 * under WeeklyReadinessReportService::AT_RISK_THRESHOLD (60%) readiness.
 * Safe to run manually any time (`php artisan report:weekly-readiness`)
 * without waiting a week — it always reflects live data, there's no
 * separate "pending report" state to get out of sync.
 */
class SendWeeklyReadinessReports extends Command
{
    protected $signature = 'report:weekly-readiness';

    protected $description = "Email each college's TPO(s) an Excel list of students below the readiness threshold";

    public function handle(WeeklyReadinessReportService $service): int
    {
        $colleges = College::where('is_active', true)->get();

        $totalAtRisk = 0;
        foreach ($colleges as $college) {
            $atRiskCount = $service->sendToTpos($college);
            $totalAtRisk += $atRiskCount;
            $this->line("{$college->name}: {$atRiskCount} at-risk student(s)");
        }

        $this->info("Done — {$colleges->count()} college(s) processed, {$totalAtRisk} at-risk student(s) total.");

        return self::SUCCESS;
    }
}
