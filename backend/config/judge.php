<?php

/*
|--------------------------------------------------------------------------
| Judge pipeline (queueing, limits, backpressure)
|--------------------------------------------------------------------------
|
| Run/Submit never execute code inside the web request. They validate,
| enqueue a JudgeSubmissionJob and return 202 + a token; the client polls
| GET /api/judge/{token}. This is the same model Judge0 documents ("we do
| not recommend wait=true because it does not scale well") and what every
| large online judge does: the queue absorbs contest-start / last-minute
| bursts so web workers stay free and a spike degrades into "a few seconds
| of waiting", never into 502s or a dead site. See docs/scaling-the-judge.md.
|
*/

return [

    /*
    | Queue names, highest priority first. Start workers with
    |   php artisan queue:work redis --queue=judge-contest,judge-submit,judge-run
    | (plus a smaller second group ordered run-first so interactive "Run"
    | is never starved by a wall of submissions — see
    | infra/judge/supervisor/judge-workers.conf).
    |
    | `connection`: which queue connection judge jobs use. Locally (APP_ENV=
    | local) it defaults to `sync`, so Run/Submit execute inline exactly like
    | before — same code path, no worker process needed. Everywhere else it
    | defaults to null = the app's default QUEUE_CONNECTION, which MUST be a
    | real queue (redis) with workers running. Override with
    | JUDGE_QUEUE_CONNECTION either way.
    */
    'connection' => env('JUDGE_QUEUE_CONNECTION', env('APP_ENV') === 'local' ? 'sync' : null),

    'queues' => [
        'contest' => env('JUDGE_QUEUE_CONTEST', 'judge-contest'),
        'submit' => env('JUDGE_QUEUE_SUBMIT', 'judge-submit'),
        'run' => env('JUDGE_QUEUE_RUN', 'judge-run'),
    ],

    /*
    | Input limits — enforced at the API boundary before anything is queued.
    */
    'limits' => [
        // Characters of source code accepted per request (64 KiB is ~2,000 lines).
        'max_code_length' => (int) env('JUDGE_MAX_CODE_LENGTH', 65536),

        // Queued + running jobs one student may have at once. Stops a single
        // user (or a script) monopolising the pool; a normal student has 1.
        'max_active_per_user' => (int) env('JUDGE_MAX_ACTIVE_PER_USER', 3),
    ],

    /*
    | Per-USER rate limits (never per-IP: a whole campus lab shares one NAT
    | address, so an IP limit would throttle 1,000 students as one person).
    */
    'rate_limits' => [
        'run_per_minute' => (int) env('JUDGE_RATE_RUN_PER_MINUTE', 20),
        'submit_per_minute' => (int) env('JUDGE_RATE_SUBMIT_PER_MINUTE', 10),
        // Result polling. The client backs off (400ms -> 2s), so a normal
        // wait costs 3-6 polls; this only stops a runaway loop.
        'poll_per_minute' => (int) env('JUDGE_RATE_POLL_PER_MINUTE', 180),
    ],

    /*
    | Backpressure. If a queue is deeper than this we reject NEW work with
    | 503 + Retry-After instead of letting latency grow without bound
    | (Judge0's MAX_QUEUE_SIZE does the same). Contest work is effectively
    | never rejected. Set to 0 to disable a limit.
    */
    'backpressure' => [
        'max_depth' => [
            'run' => (int) env('JUDGE_MAX_DEPTH_RUN', 2000),
            'submit' => (int) env('JUDGE_MAX_DEPTH_SUBMIT', 5000),
            'contest' => (int) env('JUDGE_MAX_DEPTH_CONTEST', 50000),
        ],
        'retry_after_seconds' => (int) env('JUDGE_RETRY_AFTER_SECONDS', 10),
    ],

    /*
    | Result store / caching (uses the default cache store; Redis in prod).
    */
    'result_ttl_seconds' => (int) env('JUDGE_RESULT_TTL', 900),

    // "Run" verdicts (samples only, deterministic ones only) are cached by
    // (problem test-set, language, code hash). Everyone hitting Run on the
    // untouched starter code at contest start becomes one execution.
    'run_cache_ttl_seconds' => (int) env('JUDGE_RUN_CACHE_TTL', 600),

    // Same user + same code within this window = same job (double-click guard).
    'dedupe_window_seconds' => (int) env('JUDGE_DEDUPE_WINDOW', 30),

    /*
    | Job behaviour. `timeout` must exceed piston.http_timeout_seconds and be
    | comfortably below the queue connection's retry_after (90s by default),
    | otherwise a slow job is handed to a second worker while still running.
    */
    'job' => [
        'timeout_seconds' => (int) env('JUDGE_JOB_TIMEOUT', 60),
        // Keep retrying infrastructure failures (node down / restarting) for this long,
        // counted from the job's FIRST EXECUTION. Time spent waiting in the queue does not
        // count: with a deep queue that wait can be many minutes.
        'retry_for_seconds' => (int) env('JUDGE_JOB_RETRY_FOR', 240),
        // Safety net only (a job that crashes its worker every time); time is the real limit.
        'max_attempts' => (int) env('JUDGE_JOB_MAX_ATTEMPTS', 40),
        'backoff_seconds' => [2, 5, 10, 20],
    ],

    // Rolling per-minute counters used by the superadmin telemetry endpoint.
    'stats_window_minutes' => 5,
];
