<?php

namespace App\Console\Commands;

use App\Services\Judge\JudgeStatusService;
use Illuminate\Console\Command;

/**
 * `php artisan judge:status` — the pool and queues at a glance. Exits
 * non-zero when no execution node is healthy, so it doubles as a deploy gate
 * / uptime probe: `php artisan judge:status --quiet || alert`.
 */
class JudgeStatus extends Command
{
    protected $signature = 'judge:status {--json : Emit the raw snapshot as JSON}';

    protected $description = 'Show live Piston node health, judge queue depth and throughput';

    public function handle(JudgeStatusService $status): int
    {
        $snapshot = $status->snapshot();

        if ($this->option('json')) {
            $this->line(json_encode($snapshot, JSON_PRETTY_PRINT));
        } else {
            $this->table(
                ['Node', 'Status', 'Latency', 'In flight', 'Slots', 'Breaker'],
                array_map(fn (array $n) => [
                    $n['name'],
                    $n['status'],
                    $n['latency_ms'] === null ? '-' : "{$n['latency_ms']} ms",
                    $n['in_flight'],
                    $n['max_jobs'],
                    $n['breaker_open'] ? 'OPEN' : 'closed',
                ], $snapshot['nodes'])
            );

            $this->table(
                ['Queue', 'Name', 'Depth'],
                array_map(fn (string $key, array $q) => [$key, $q['name'], $q['depth'] < 0 ? 'unavailable' : $q['depth']], array_keys($snapshot['queues']), $snapshot['queues'])
            );

            $t = $snapshot['totals'];
            $s = $snapshot['stats'];
            $this->line(sprintf(
                'capacity %d slots | in flight %d | queued %d | est. wait %s | %s jobs/min (last %d min) | avg wait %s ms, avg exec %s ms',
                $t['capacity'],
                $t['in_flight'],
                $t['queued'],
                $t['estimated_wait_seconds'] === null ? 'n/a' : "{$t['estimated_wait_seconds']}s",
                $s['throughput_per_minute'],
                $s['window_minutes'],
                $s['avg_wait_ms'] ?? 'n/a',
                $s['avg_exec_ms'] ?? 'n/a',
            ));
        }

        return $snapshot['totals']['healthy_nodes'] > 0 ? self::SUCCESS : self::FAILURE;
    }
}
