<?php

namespace App\Jobs;

use App\Models\Problem;
use App\Services\Judge\JudgeOutcomePersister;
use App\Services\Judge\JudgeQueue;
use App\Services\Judge\JudgeRequest;
use App\Services\Judge\JudgeResultStore;
use App\Services\JudgeService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Throwable;

/**
 * Judges one Run/Submit off the request path. The whole point of the
 * pipeline: web workers enqueue and return in milliseconds; a bounded pool
 * of these workers (keep workers <= total Piston slots) drains the queue at
 * exactly the rate the execution nodes can sustain.
 *
 * Failure semantics — the part that matters for fairness:
 *  - The student's code failing (wrong answer, compile/runtime error) is a
 *    normal verdict: judged, stored, persisted.
 *  - Our infrastructure failing (no node reachable, node error, timeout)
 *    throws instead, and the job retries with backoff for `retry_for_seconds`.
 *    If it still can't run, failed() records an *error* state and NOTHING is
 *    persisted — no wrong-answer row, no contest penalty for our outage.
 *
 * That retry window is measured from the job's FIRST EXECUTION, never from
 * when it was queued. (Laravel's retryUntil() is fixed into the payload at
 * dispatch, so using it made time spent waiting in a deep queue count against
 * the window: at a 1,000-student burst every job more than ~4 minutes back was
 * failed before it ever ran. Found by a load test against real Piston.)
 */
class JudgeSubmissionJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable;

    /**
     * Only a safety net against a job that kills its worker every time; the real
     * limit is time (see retryWindowClosed()), so these are set high.
     */
    public int $tries;

    public int $maxExceptions;

    public int $timeout;

    public bool $failOnTimeout = true;

    /**
     * @param  array<string, mixed>  $request  JudgeRequest::toArray()
     * @param  string|null  $runCacheKey  Set for "Run" jobs: where to cache a deterministic verdict.
     */
    public function __construct(
        public string $token,
        public array $request,
        public ?string $runCacheKey = null,
    ) {
        $this->tries = $this->maxExceptions = (int) config('judge.job.max_attempts', 40);
        $this->timeout = (int) config('judge.job.timeout_seconds', 60);
    }

    /** @return list<int> */
    public function backoff(): array
    {
        return (array) config('judge.job.backoff_seconds', [2, 5, 10, 20]);
    }

    public function handle(
        JudgeService $judge,
        JudgeResultStore $results,
        JudgeOutcomePersister $persister,
        JudgeQueue $queue,
    ): void {
        $firstAttemptAt = $results->firstAttemptAt($this->token);

        try {
            $this->process($judge, $results, $persister, $queue);
        } catch (Throwable $e) {
            // Still inside the window since it first ran: rethrow so the queue retries it with
            // backoff. Past it: give up now (failed() tells the student and frees their slot).
            if (now()->getTimestamp() - $firstAttemptAt >= (int) config('judge.job.retry_for_seconds', 240)) {
                $this->fail($e);

                return;
            }

            throw $e;
        }
    }

    private function process(
        JudgeService $judge,
        JudgeResultStore $results,
        JudgeOutcomePersister $persister,
        JudgeQueue $queue,
    ): void {
        $request = JudgeRequest::fromArray($this->request);

        // Already finished (a retry after a worker died post-completion).
        if (($results->get($this->token)['state'] ?? null) === JudgeResultStore::STATE_DONE) {
            $queue->releaseActive($request->userId);

            return;
        }

        $problem = Problem::find($request->problemId);

        if ($problem === null) {
            $results->putError($this->token, 'This problem is no longer available.');
            $queue->releaseActive($request->userId);

            return;
        }

        $results->markRunning($this->token);

        $testCases = $request->kind === JudgeRequest::KIND_SUBMIT
            ? $problem->testCases()->get()
            : $problem->sampleTestCases()->get();

        // Throws on infrastructure failure -> retried; never turned into a verdict.
        $outcome = $judge->judge($problem, $request->language, $request->code, $testCases, propagateExecutionFailures: true);

        // Persist BEFORE marking done: if we die in between, the retry re-judges
        // and the idempotent persister absorbs it — the reverse order could
        // tell the student "done" for a submission that was never recorded.
        $persister->persist($request, $outcome, $this->token);

        $results->putResult($this->token, $outcome);

        if ($this->runCacheKey !== null) {
            $results->cacheRun($this->runCacheKey, $outcome);
        }

        $queue->releaseActive($request->userId);
    }

    /** Retries exhausted (or a non-retryable error): tell the student honestly, record nothing. */
    public function failed(Throwable $exception): void
    {
        $request = JudgeRequest::fromArray($this->request);

        app(JudgeResultStore::class)->putError(
            $this->token,
            'The judge is temporarily unavailable, so this run could not be completed. Nothing was recorded against you — please try again in a moment.'
        );

        app(JudgeQueue::class)->releaseActive($request->userId);
    }
}
