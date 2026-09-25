<?php

namespace App\Services\Judge;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

/**
 * Client-side pool over N stateless Piston nodes.
 *
 *  - Load balancing: weighted "power of two choices" — sample two nodes in
 *    proportion to their slot count and take the less loaded (in-flight /
 *    slots). Near-optimal balance with no coordination beyond a counter.
 *  - Failover: connection errors, timeouts and 5xx move on to another node.
 *  - Circuit breaker: consecutive failures take a node out of rotation for a
 *    cooldown, so a dead node costs one slow request, not one per student.
 *  - Self-healing counters: in-flight/failure keys carry TTLs, so a killed
 *    worker can never leave a node "full" or "broken" forever.
 *
 * The pool deliberately does NOT queue. Concurrency is bounded upstream by
 * the number of queue workers (keep workers <= total slots): Piston queues
 * any job above PISTON_MAX_CONCURRENT_JOBS *inside its own process with no
 * timeout*, which turns overload into hung requests that finish after the
 * caller gave up — wasted work that then triggers retries. Keeping the
 * queue in Laravel (bounded, visible, prioritised) avoids that entirely.
 */
class PistonPool
{
    /** @return list<array{url: string, slots: int}> */
    public function nodes(): array
    {
        return config('piston.nodes', []);
    }

    /**
     * Execute one Piston job on the best available node.
     *
     * @param  array<string, mixed>  $payload  A Piston /api/v2/execute request body.
     * @return array<string, mixed>  Piston's decoded response (has a `run` key).
     *
     * @throws JudgeUnavailableException when no node could run the job.
     */
    public function execute(array $payload): array
    {
        $nodes = $this->nodes();

        if ($nodes === []) {
            throw new JudgeUnavailableException('No Piston nodes are configured (PISTON_NODES / PISTON_BASE_URL).');
        }

        $tried = [];
        $lastError = 'unknown error';

        for ($attempt = 0, $max = min(count($nodes), 3); $attempt < $max; $attempt++) {
            $node = $this->pick($nodes, $tried);

            if ($node === null) {
                break;
            }

            $tried[] = $node['url'];
            $clamped = false;

            do {
                $retrySameNode = false;
                $this->acquire($node);

                try {
                    $response = Http::connectTimeout((int) config('piston.connect_timeout_seconds', 3))
                        ->timeout((int) config('piston.http_timeout_seconds', 30))
                        ->acceptJson()
                        ->asJson()
                        ->post($node['url'].'/api/v2/execute', $payload);
                } catch (ConnectionException $e) {
                    $this->recordFailure($node);
                    $lastError = "{$node['url']}: {$e->getMessage()}";

                    continue 2;
                } finally {
                    $this->release($node);
                }

                if ($response->serverError()) {
                    $this->recordFailure($node);
                    $lastError = "{$node['url']}: HTTP {$response->status()}";

                    continue 2;
                }

                if ($response->failed()) {
                    // The node answered, so it is healthy — but it refused this request.
                    $this->recordSuccess($node);
                    $message = (string) $response->json('message', $response->body());

                    // The app asks for more CPU/wall time than this node's ceiling allows
                    // (e.g. a node still on Piston's defaults). Piston tells us the
                    // ceiling; clamp to it once rather than failing every Java run.
                    if (! $clamped && $this->clampToCeiling($payload, $message)) {
                        $clamped = true;
                        $retrySameNode = true;

                        continue;
                    }

                    $lastError = "{$node['url']}: HTTP {$response->status()} {$message}";

                    continue 2;
                }

                $data = $response->json();

                if (! is_array($data) || ! isset($data['run'])) {
                    $this->recordFailure($node);
                    $lastError = "{$node['url']}: malformed response";

                    continue 2;
                }

                $this->recordSuccess($node);

                return $data;
            } while ($retrySameNode);
        }

        throw new JudgeUnavailableException("No execution node could run the job ({$lastError}).");
    }

    /**
     * Live view of one node for telemetry: reachability + latency + the
     * runtimes it has installed.
     *
     * @param  array{url: string, slots: int}  $node
     * @return array{up: bool, latency_ms: ?int, runtimes: list<string>}
     */
    public function probe(array $node): array
    {
        $start = hrtime(true);

        try {
            $response = Http::connectTimeout(2)->timeout(3)->acceptJson()->get($node['url'].'/api/v2/runtimes');
        } catch (ConnectionException) {
            return ['up' => false, 'latency_ms' => null, 'runtimes' => []];
        }

        if (! $response->successful()) {
            return ['up' => false, 'latency_ms' => null, 'runtimes' => []];
        }

        $runtimes = collect($response->json() ?? [])
            ->map(fn ($r) => ($r['language'] ?? '?').' '.($r['version'] ?? ''))
            ->values()
            ->all();

        return ['up' => true, 'latency_ms' => (int) round((hrtime(true) - $start) / 1_000_000), 'runtimes' => $runtimes];
    }

    /** @param  array{url: string, slots: int}  $node */
    public function inflight(array $node): int
    {
        return max(0, (int) Cache::get($this->key('inflight', $node), 0));
    }

    /** @param  array{url: string, slots: int}  $node */
    public function isDown(array $node): bool
    {
        return Cache::has($this->key('down', $node));
    }

    /**
     * @param  list<array{url: string, slots: int}>  $nodes
     * @param  list<string>  $exclude  URLs already tried for this job
     * @return array{url: string, slots: int}|null
     */
    private function pick(array $nodes, array $exclude): ?array
    {
        $candidates = array_values(array_filter($nodes, fn (array $n) => ! in_array($n['url'], $exclude, true)));

        if ($candidates === []) {
            return null;
        }

        $healthy = array_values(array_filter($candidates, fn (array $n) => ! $this->isDown($n)));

        // Every remaining node is tripped: try them anyway ("half-open") rather
        // than fail closed for the whole cooldown when a node may have recovered.
        $pool = $healthy !== [] ? $healthy : $candidates;

        if (count($pool) === 1) {
            return $pool[0];
        }

        $a = $this->weightedSample($pool);
        $b = $this->weightedSample($pool);

        return $this->load($a) <= $this->load($b) ? $a : $b;
    }

    /** @param  list<array{url: string, slots: int}>  $pool */
    private function weightedSample(array $pool): array
    {
        $roll = random_int(1, array_sum(array_column($pool, 'slots')));

        foreach ($pool as $node) {
            $roll -= $node['slots'];

            if ($roll <= 0) {
                return $node;
            }
        }

        return $pool[0];
    }

    /** @param  array{url: string, slots: int}  $node */
    private function load(array $node): float
    {
        return $this->inflight($node) / max(1, $node['slots']);
    }

    /** @param  array{url: string, slots: int}  $node */
    private function acquire(array $node): void
    {
        $key = $this->key('inflight', $node);
        Cache::add($key, 0, 300);
        Cache::increment($key);
    }

    /** @param  array{url: string, slots: int}  $node */
    private function release(array $node): void
    {
        $key = $this->key('inflight', $node);

        if ((int) Cache::get($key, 0) > 0) {
            Cache::decrement($key);
        }
    }

    /** @param  array{url: string, slots: int}  $node */
    private function recordFailure(array $node): void
    {
        $failKey = $this->key('fail', $node);
        Cache::add($failKey, 0, 60);

        if (Cache::increment($failKey) >= (int) config('piston.breaker_failures', 3)) {
            Cache::put($this->key('down', $node), time(), (int) config('piston.breaker_cooldown_seconds', 20));
            Cache::forget($failKey);
        }
    }

    /** @param  array{url: string, slots: int}  $node */
    private function recordSuccess(array $node): void
    {
        Cache::forget($this->key('fail', $node));
        Cache::forget($this->key('down', $node));
    }

    /**
     * Piston answers over-limit requests with e.g.
     * "run_cpu_time cannot exceed the configured limit of 3000".
     *
     * @param  array<string, mixed>  $payload
     */
    private function clampToCeiling(array &$payload, string $message): bool
    {
        if (! preg_match('/^(\w+) cannot exceed the configured limit of (\d+)/', $message, $m)) {
            return false;
        }

        [, $field, $ceiling] = $m;

        if (! isset($payload[$field]) || (int) $payload[$field] <= (int) $ceiling) {
            return false;
        }

        $payload[$field] = (int) $ceiling;

        return true;
    }

    /** @param  array{url: string, slots: int}  $node */
    private function key(string $kind, array $node): string
    {
        return "judge:piston:{$kind}:".md5($node['url']);
    }
}
