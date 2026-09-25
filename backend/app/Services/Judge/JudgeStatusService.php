<?php

namespace App\Services\Judge;

/**
 * Live telemetry for the superadmin Infrastructure tab and `php artisan
 * judge:status`: what an on-call person needs during a contest — is every
 * node up, how full is it, how deep are the queues, how fast are we draining,
 * and roughly how long will the last person in line wait.
 *
 * Every number is measured, not stored. This replaced a table of
 * hand-written "clusters" (142/250 active jobs, 28 ms) that had no
 * connection to the real pool and implied ~1,000 slots of capacity the
 * platform never had.
 */
class JudgeStatusService
{
    public function __construct(
        private readonly PistonPool $pool,
        private readonly JudgeQueue $queue,
        private readonly JudgeResultStore $results,
    ) {}

    /**
     * @return array{
     *   nodes: list<array<string, mixed>>,
     *   queues: array<string, array{name: string, depth: int}>,
     *   totals: array<string, mixed>,
     *   stats: array<string, mixed>,
     * }
     */
    public function snapshot(): array
    {
        $nodes = [];
        $capacity = 0;
        $inFlight = 0;
        $healthy = 0;

        foreach ($this->pool->nodes() as $node) {
            $probe = $this->pool->probe($node);
            $load = $this->pool->inflight($node);
            $breakerOpen = $this->pool->isDown($node);

            $status = match (true) {
                ! $probe['up'] => 'offline',
                $breakerOpen => 'degraded',
                $load >= $node['slots'] => 'busy',
                default => 'healthy',
            };

            $capacity += $node['slots'];
            $inFlight += $load;
            $healthy += $probe['up'] && ! $breakerOpen ? 1 : 0;

            $parts = parse_url($node['url']);
            $nodes[] = [
                'name' => ($parts['host'] ?? $node['url']).(isset($parts['port']) ? ':'.$parts['port'] : ''),
                'status' => $status,
                'latency_ms' => $probe['latency_ms'],
                'in_flight' => $load,
                'max_jobs' => $node['slots'],
                'breaker_open' => $breakerOpen,
                'runtimes' => $probe['runtimes'],
            ];
        }

        $queues = $this->queue->depths();
        $queued = array_sum(array_map(fn (array $q) => max(0, $q['depth']), $queues));

        $stats = $this->results->recentStats();
        $windowSeconds = max(1, (int) config('judge.stats_window_minutes', 5)) * 60;
        $perSecond = $stats['completed'] / $windowSeconds;

        return [
            'nodes' => $nodes,
            'queues' => $queues,
            'totals' => [
                'nodes' => count($nodes),
                'healthy_nodes' => $healthy,
                'capacity' => $capacity,
                'in_flight' => $inFlight,
                'queued' => $queued,
                // Drain-time estimate from the measured recent rate; null when there's no recent throughput to extrapolate from.
                'estimated_wait_seconds' => $queued > 0 && $perSecond > 0 ? (int) ceil($queued / $perSecond) : null,
            ],
            'stats' => [
                ...$stats,
                'window_minutes' => (int) config('judge.stats_window_minutes', 5),
                'throughput_per_minute' => round($perSecond * 60, 1),
            ],
        ];
    }
}
