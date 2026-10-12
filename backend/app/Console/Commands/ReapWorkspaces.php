<?php

namespace App\Console\Commands;

use App\Services\Workspaces\WorkspaceManager;
use Illuminate\Console\Command;

/**
 * Every minute (see routes/console.php): stop Project Lab workspaces that are
 * idle, lapsed, out of hours, over the session or disk cap, or whose container
 * died — and stop containers on the hosts that no workspace row accounts for.
 * This is what keeps the self-hosted fleet's cost bounded; it needs the
 * Laravel scheduler running every minute (`schedule:run`).
 */
class ReapWorkspaces extends Command
{
    protected $signature = 'workspaces:reap';

    protected $description = 'Stop idle, lapsed or over-limit Project Lab workspaces and clean up stray containers';

    public function handle(WorkspaceManager $workspaces): int
    {
        $summary = $workspaces->reap();

        $stopped = array_sum($summary['stopped']);

        if ($stopped > 0 || $summary['orphans'] > 0) {
            $reasons = collect($summary['stopped'])->map(fn ($n, $reason) => "{$reason}: {$n}")->implode(', ');
            $this->info("Checked {$summary['checked']}; stopped {$stopped}".($reasons ? " ({$reasons})" : '')."; orphans {$summary['orphans']}.");
        }

        return self::SUCCESS;
    }
}
