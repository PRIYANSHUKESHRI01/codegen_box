<?php

namespace App\Services\Judge;

use Illuminate\Support\Facades\Cache;

/**
 * Where a queued job's state and final verdict live until the student's
 * browser collects it (default 15 minutes), plus the per-minute counters the
 * superadmin telemetry reads. Uses the app's default cache store — Redis in
 * production, so polling never touches MySQL.
 *
 * Entries are bound to the requesting user: GET /api/judge/{token} treats
 * another user's (or an expired) token identically — as "not found" — so a
 * token can neither be enumerated nor read by anyone but its owner.
 */
class JudgeResultStore
{
    public const STATE_QUEUED = 'queued';

    public const STATE_RUNNING = 'running';

    public const STATE_DONE = 'done';

    public const STATE_ERROR = 'error';

    public function putQueued(string $token, JudgeRequest $request, int $position): void
    {
        $this->put($token, [
            'user_id' => $request->userId,
            'state' => self::STATE_QUEUED,
            'kind' => $request->kind,
            'queue' => $request->queue,
            'position' => $position,
            'queued_at' => microtime(true),
        ]);
    }

    public function markRunning(string $token): void
    {
        $entry = $this->get($token);

        if ($entry === null || $entry['state'] === self::STATE_DONE) {
            return;
        }

        $this->put($token, [...$entry, 'state' => self::STATE_RUNNING, 'started_at' => microtime(true)]);
    }

    /** @param  array{body: array, status: int}  $outcome */
    public function putResult(string $token, array $outcome): void
    {
        $entry = $this->get($token) ?? [];
        $now = microtime(true);

        $this->put($token, [
            ...$entry,
            'state' => self::STATE_DONE,
            'http_status' => $outcome['status'],
            'body' => $outcome['body'],
            'finished_at' => $now,
        ]);

        $this->recordStats($entry, $now, failed: false);
    }

    public function putError(string $token, string $message): void
    {
        $entry = $this->get($token) ?? [];
        $now = microtime(true);

        $this->put($token, [...$entry, 'state' => self::STATE_ERROR, 'message' => $message, 'finished_at' => $now]);

        $this->recordStats($entry, $now, failed: true);
    }

    /** @return array<string, mixed>|null */
    public function get(string $token): ?array
    {
        $entry = Cache::get($this->key($token));

        return is_array($entry) ? $entry : null;
    }

    /**
     * Unix time this job first started executing (recorded on its first call, then
     * stable across retries). The infrastructure-retry window is measured from here,
     * not from when the job was queued — see JudgeSubmissionJob.
     */
    public function firstAttemptAt(string $token): int
    {
        $key = "judge:firstattempt:{$token}";
        $now = now()->getTimestamp();

        Cache::add($key, $now, (int) config('judge.job.retry_for_seconds', 240) + 600);

        return (int) Cache::get($key, $now);
    }

    /**
     * Cached "Run" verdict for identical code against an identical test set,
     * or null. Only deterministic verdicts are ever stored (see cacheRun()).
     *
     * @return array{body: array, status: int}|null
     */
    public function cachedRun(string $cacheKey): ?array
    {
        $hit = Cache::get("judge:runcache:{$cacheKey}");

        return is_array($hit) ? $hit : null;
    }

    /**
     * Only accepted / wrong_answer / compile_error are cached. A timeout,
     * memory kill or infrastructure error can differ on the next attempt
     * (load, a warmer node), so caching one would pin a transient failure.
     *
     * @param  array{body: array, status: int, submissionStatus: string, transient?: bool}  $outcome
     */
    public function cacheRun(string $cacheKey, array $outcome): void
    {
        $deterministic = in_array($outcome['submissionStatus'], ['accepted', 'wrong_answer', 'compile_error'], true)
            && $outcome['status'] === 200
            && empty($outcome['transient']);

        if ($deterministic) {
            Cache::put("judge:runcache:{$cacheKey}", ['body' => $outcome['body'], 'status' => $outcome['status']], (int) config('judge.run_cache_ttl_seconds', 600));
        }
    }

    /**
     * Last N minutes of throughput and latency, for the telemetry panel.
     *
     * @return array{completed: int, failed: int, avg_wait_ms: ?int, avg_exec_ms: ?int}
     */
    public function recentStats(): array
    {
        $completed = $failed = $waitMs = $execMs = 0;
        $minute = intdiv(time(), 60);

        for ($i = 0; $i < (int) config('judge.stats_window_minutes', 5); $i++) {
            $m = $minute - $i;
            $completed += (int) Cache::get("judge:stat:{$m}:done", 0);
            $failed += (int) Cache::get("judge:stat:{$m}:failed", 0);
            $waitMs += (int) Cache::get("judge:stat:{$m}:wait_ms", 0);
            $execMs += (int) Cache::get("judge:stat:{$m}:exec_ms", 0);
        }

        return [
            'completed' => $completed,
            'failed' => $failed,
            'avg_wait_ms' => $completed > 0 ? intdiv($waitMs, $completed) : null,
            'avg_exec_ms' => $completed > 0 ? intdiv($execMs, $completed) : null,
        ];
    }

    /** @param  array<string, mixed>  $entry */
    private function recordStats(array $entry, float $finishedAt, bool $failed): void
    {
        $minute = intdiv((int) $finishedAt, 60);
        $ttl = ((int) config('judge.stats_window_minutes', 5) + 2) * 60;

        $this->bump("judge:stat:{$minute}:".($failed ? 'failed' : 'done'), 1, $ttl);

        if ($failed) {
            return;
        }

        $queuedAt = $entry['queued_at'] ?? null;
        $startedAt = $entry['started_at'] ?? null;

        if ($queuedAt !== null && $startedAt !== null) {
            $this->bump("judge:stat:{$minute}:wait_ms", (int) max(0, ($startedAt - $queuedAt) * 1000), $ttl);
            $this->bump("judge:stat:{$minute}:exec_ms", (int) max(0, ($finishedAt - $startedAt) * 1000), $ttl);
        }
    }

    private function bump(string $key, int $by, int $ttl): void
    {
        Cache::add($key, 0, $ttl);
        Cache::increment($key, $by);
    }

    /** @param  array<string, mixed>  $entry */
    private function put(string $token, array $entry): void
    {
        Cache::put($this->key($token), $entry, (int) config('judge.result_ttl_seconds', 900));
    }

    private function key(string $token): string
    {
        return "judge:job:{$token}";
    }
}
