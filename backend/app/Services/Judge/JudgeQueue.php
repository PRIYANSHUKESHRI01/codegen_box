<?php

namespace App\Services\Judge;

use App\Jobs\JudgeSubmissionJob;
use App\Models\Problem;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use Throwable;

/**
 * The one entry point for "judge this code". Controllers hand it a
 * JudgeRequest; it answers with an HTTP-ready envelope and never executes
 * anything itself. In order:
 *
 *  1. Run-result cache  — identical code on an identical sample set is free.
 *  2. Double-click guard — same user + same code already in flight = same job.
 *  3. Per-user cap      — one student can't flood the pool (429).
 *  4. Backpressure      — a queue past its limit sheds new work (503), so
 *                         latency stays bounded instead of growing forever.
 *  5. Enqueue           — onto a priority queue; 202 + token.
 *
 * With QUEUE_CONNECTION=sync (tests / no-worker dev) the job runs inside
 * dispatch(), so the result is already stored and we answer 200 inline —
 * the same code path, just synchronous.
 */
class JudgeQueue
{
    public function __construct(private readonly JudgeResultStore $results) {}

    /** @return array{status: int, body: array<string, mixed>, headers: array<string, string>} */
    public function enqueue(JudgeRequest $request, Problem $problem): array
    {
        $cacheKey = null;

        if ($request->kind === JudgeRequest::KIND_RUN) {
            $cacheKey = $this->runCacheKey($request, $problem);

            if ($hit = $this->results->cachedRun($cacheKey)) {
                return $this->response(200, [
                    'state' => JudgeResultStore::STATE_DONE,
                    'token' => null,
                    'http_status' => $hit['status'],
                    'result' => $hit['body'],
                    'cached' => true,
                ]);
            }
        }

        $token = Str::random(32);
        $dedupeKey = "judge:inflight:{$request->userId}:{$request->fingerprint()}";

        if (! Cache::add($dedupeKey, $token, (int) config('judge.dedupe_window_seconds', 30))) {
            $existingToken = Cache::get($dedupeKey);
            $entry = is_string($existingToken) ? $this->results->get($existingToken) : null;

            if ($entry !== null && in_array($entry['state'], [JudgeResultStore::STATE_QUEUED, JudgeResultStore::STATE_RUNNING], true)) {
                return $this->response(202, [
                    'state' => $entry['state'],
                    'token' => $existingToken,
                    'position' => $entry['position'] ?? 0,
                    'poll_after_ms' => $this->pollHint($entry['state'], $entry['position'] ?? 0),
                ]);
            }

            Cache::put($dedupeKey, $token, (int) config('judge.dedupe_window_seconds', 30));
        }

        $activeKey = $this->activeKey($request->userId);
        Cache::add($activeKey, 0, (int) config('judge.result_ttl_seconds', 900)); // outlives any queue wait, or the per-user cap silently resets

        if (Cache::increment($activeKey) > (int) config('judge.limits.max_active_per_user', 3)) {
            $this->releaseActive($request->userId);
            Cache::forget($dedupeKey);

            return $this->response(429, ['message' => 'You already have submissions being judged. Wait for them to finish, then try again.'], ['Retry-After' => '3']);
        }

        $queueName = (string) config("judge.queues.{$request->queue}");
        $limit = (int) config("judge.backpressure.max_depth.{$request->queue}", 0);

        try {
            $depth = (int) Queue::connection(config('judge.connection'))->size($queueName);

            if ($limit > 0 && $depth >= $limit) {
                $this->releaseActive($request->userId);
                Cache::forget($dedupeKey);
                $retry = (int) config('judge.backpressure.retry_after_seconds', 10);

                return $this->response(503, ['message' => 'The judge is at capacity right now. Please try again in a few seconds.'], ['Retry-After' => (string) $retry]);
            }

            $this->results->putQueued($token, $request, $depth + 1);

            JudgeSubmissionJob::dispatch($token, $request->toArray(), $cacheKey)
                ->onConnection(config('judge.connection'))
                ->onQueue($queueName);
        } catch (Throwable $e) {
            Log::error('Judge enqueue failed', ['error' => $e->getMessage()]);
            $this->releaseActive($request->userId);
            Cache::forget($dedupeKey);

            return $this->response(503, ['message' => 'The judge queue is unavailable. Please try again shortly.'], ['Retry-After' => '5']);
        }

        // Synchronous queue driver: the job already ran inside dispatch().
        $entry = $this->results->get($token);

        if ($entry !== null && $entry['state'] === JudgeResultStore::STATE_DONE) {
            return $this->response(200, $this->doneBody($token, $entry));
        }

        return $this->response(202, [
            'state' => JudgeResultStore::STATE_QUEUED,
            'token' => $token,
            'position' => $depth + 1,
            'poll_after_ms' => $this->pollHint(JudgeResultStore::STATE_QUEUED, $depth + 1),
        ]);
    }

    /**
     * Poll view of a token for its owner, or null when unknown/expired/not theirs.
     *
     * @return array<string, mixed>|null
     */
    public function status(string $token, int $userId): ?array
    {
        $entry = $this->results->get($token);

        if ($entry === null || ($entry['user_id'] ?? null) !== $userId) {
            return null;
        }

        return match ($entry['state']) {
            JudgeResultStore::STATE_DONE => $this->doneBody($token, $entry),
            JudgeResultStore::STATE_ERROR => [
                'state' => JudgeResultStore::STATE_ERROR,
                'token' => $token,
                'message' => $entry['message'] ?? 'The judge could not complete this run. Nothing was recorded — please try again.',
            ],
            default => [
                'state' => $entry['state'],
                'token' => $token,
                'position' => $entry['position'] ?? 0,
                'poll_after_ms' => $this->pollHint($entry['state'], $entry['position'] ?? 0),
            ],
        };
    }

    public function releaseActive(int $userId): void
    {
        $key = $this->activeKey($userId);

        if ((int) Cache::get($key, 0) > 0) {
            Cache::decrement($key);
        }
    }

    /**
     * Current depth of each judge queue, keyed by priority name.
     *
     * @return array<string, array{name: string, depth: int}>
     */
    public function depths(): array
    {
        $out = [];

        foreach ((array) config('judge.queues') as $key => $name) {
            try {
                $depth = (int) Queue::connection(config('judge.connection'))->size($name);
            } catch (Throwable) {
                $depth = -1;
            }

            $out[$key] = ['name' => $name, 'depth' => $depth];
        }

        return $out;
    }

    /**
     * How long the client should wait before its next poll. A job that is
     * already running is about to finish; one 800 places back has minutes to
     * go and polling it every 400ms is pure load — with 1,000 students waiting
     * that is hundreds of requests/second of nothing. The interval therefore
     * scales with the depth the job was queued at (400ms .. 5s): short waits
     * stay snappy, a mass burst doesn't become a poll storm.
     */
    private function pollHint(string $state, int $position): int
    {
        if ($state === JudgeResultStore::STATE_RUNNING) {
            return 400;
        }

        return (int) min(5000, max(400, 400 + $position * 12));
    }

    /** @param  array<string, mixed>  $entry */
    private function doneBody(string $token, array $entry): array
    {
        return [
            'state' => JudgeResultStore::STATE_DONE,
            'token' => $token,
            'http_status' => $entry['http_status'] ?? 200,
            'result' => $entry['body'] ?? [],
        ];
    }

    /**
     * Cache key for a Run verdict. Includes a fingerprint of the problem's
     * sample test set so editing a problem's tests can never serve a verdict
     * computed against the old ones.
     */
    private function runCacheKey(JudgeRequest $request, Problem $problem): string
    {
        $testSet = Cache::remember("judge:testset:{$problem->id}", 60, function () use ($problem) {
            // reorder(): the relation carries ORDER BY display_order, which
            // MySQL's ONLY_FULL_GROUP_BY rejects on an aggregate-only query.
            $samples = $problem->sampleTestCases()->reorder()->selectRaw('count(*) as c, max(updated_at) as m')->first();

            return ($problem->updated_at?->timestamp ?? 0).':'.($samples->c ?? 0).':'.($samples->m ?? '');
        });

        return hash('sha256', $request->fingerprint().'|'.$testSet);
    }

    private function activeKey(int $userId): string
    {
        return "judge:active:{$userId}";
    }

    /**
     * @param  array<string, mixed>  $body
     * @param  array<string, string>  $headers
     * @return array{status: int, body: array<string, mixed>, headers: array<string, string>}
     */
    private function response(int $status, array $body, array $headers = []): array
    {
        return ['status' => $status, 'body' => $body, 'headers' => $headers];
    }
}
