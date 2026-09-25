# Scaling the judge — 1,000 students at once

Last verified: 2026-09-22. Everything below is either **measured** (with the rig
named), **taken from a primary source** (linked at the end), or **arithmetic on
stated assumptions** — and each one says which. §7 lists exactly what was and was
not tested. The rig for every "real" number is one 4-core laptop, so treat those
as a *floor*, not a forecast for server hardware.

## 1. The answer

**Could the original setup handle 1,000 students solving at once? No.**

| Problem in the original design | Evidence |
|---|---|
| Run/Submit executed the code *inside the HTTP request*, so every in-flight execution pinned a PHP worker for 0.1–2.5 s. 1,000 simultaneous clicks need ~1,000 workers or they queue and time out. | By design. Measured on the original code: 40 simultaneous submissions against a single dev-server process gave 17 verdicts, while the other 23 requests were still hanging at the 30 s client timeout and the site's own health probe failed. A dev server exaggerates it; the mechanism (a worker held for the whole execution) is the same under FPM. |
| One Piston node whose overflow queue is **unbounded and has no timeout**, so overload becomes hung requests that still burn CPU after the caller has gone. | `api/src/job.js`: `job_queue = []`, jobs `await` a promise until a slot frees; nothing bounds or expires it. |
| Piston's default output cap is **1,024 bytes**. Any program printing more is killed. | Measured on the existing node: printing 5 KB → `SIGKILL`, empty stdout. On a node with the shipped config, 300 KB passes; ~1 MiB is where it is killed. |
| Piston's default CPU ceiling is **3 s**; the JVM alone burns 1–1.5 CPU-s starting up on an idle host, several times that under load. | Measured: the existing node answers the app's Java request (`run_cpu_time: 8000`) with `HTTP 400 run_cpu_time cannot exceed the configured limit of 3000`. |
| No per-user limits, no code-size cap, limits keyed by IP (a campus lab is one IP). | Code review. |
| The superadmin "Infrastructure" panel showed made-up numbers. | Replaced with live telemetry (§6). |

**Can it handle 1,000 now? Yes — proven end to end, and the capacity you need is
a number you can calculate (§3).** The pipeline is asynchronous, queued,
prioritised, load-balanced across Piston nodes, rate-limited per user,
backpressured, and observable.

The real run (§5): **1,000 students pressed Submit at the same instant against
real Piston nodes and a real Redis queue, and all 1,000 received a correct
verdict — none lost, none mis-judged — while the rest of the site kept
answering.** On the 4-core laptop it was tested on (4 execution slots) that took
12.5 minutes, because a laptop is about 1/12th of the recommended fleet. On the
recommended 48 slots the same burst is calculated to clear in roughly 20–60 s.

That real run also found two problems the simulator could not (a retry-window bug
that failed 657 of 1,000 jobs, and false kills when slots outnumber physical
cores). Both are fixed and covered by tests; §5 tells the story because the lessons
are the operating rules.

## 2. How a submission flows

```
Browser ── POST /problems/{id}/submit ──▶ API (PHP-FPM)
             │   validate · per-user rate limit · code-size cap
             │   Run-result cache hit ─────────────▶ 200 + verdict (no execution)
             │   same user + same code in flight ──▶ 202 + the existing token
             │   user already has 3 active ────────▶ 429
             │   queue past its depth limit ───────▶ 503 + Retry-After
             ▼
         Queue (Redis):  judge-contest  ▸  judge-submit  ▸  judge-run     (priority order)
             ▼
         Queue workers (≈ total Piston slots)
             │   PistonPool: weighted power-of-two-choices across nodes,
             │   per-node circuit breaker, failover, clamp to node ceilings
             ▼
         Piston node 1..N   (isolate sandbox, one slot per PHYSICAL core)
             ▼
         Verdict persisted (idempotent) → result store (15 min TTL)

Browser ◀── polls GET /judge/{token}: queued(position) → running → done(verdict)
```

Guarantees, each covered by a test in `backend/tests/Feature/Judge/`:

- **Infrastructure failures never become verdicts.** A node that is down or
  restarting makes the job retry (with backoff, on another node when there is
  one) for `JUDGE_JOB_RETRY_FOR` seconds (default 240) **counted from the job's
  first execution — time spent waiting in the queue never counts**. If it finally
  gives up, the student sees "could not complete — nothing was recorded", the
  active-job slot is released and nothing is written to their history.
- **Every stop has a reason.** A run stopped by a limit says so — "Time Limit
  Exceeded" (with "(wall clock)" when it was the wall backstop), "Output Limit
  Exceeded", or "Compilation was stopped: Time limit exceeded" — instead of a bare
  "Terminated (SIGKILL)". A compiler killed by a limit is *not* cached as a
  compile error (it could succeed on a quieter node); a genuine syntax error is.
- **Contest submissions are idempotent.** `judge_token` is unique, so a retried
  job cannot create a second submission, and `submitted_at` is the moment the API
  accepted the request — queue wait can never cost a student contest time.
- **Fairness.** A contest's work is drained before practice submissions, which
  drain before Runs. A second worker group checks Run *first*, so a wall of
  submissions cannot starve someone pressing Run to debug. One student can have
  at most 3 jobs active. Rate limits are **per user**, never per IP.
- **Bounded latency.** When a queue is deeper than its limit, new work gets
  `503 + Retry-After` instead of waiting unboundedly (Judge0's `MAX_QUEUE_SIZE`
  does the same). How to set that limit is in §3 — the defaults assume a big fleet.
- **No poll storm.** The API tells each client how long to wait before polling
  again, scaled to its queue depth (400 ms when it is next, up to 5 s when it is
  hundreds back). Without it, 1,000 waiting browsers generated enough polling
  to delay verdicts: the simulated 1,000-burst went from 165 s to 121 s with it.

## 3. Capacity and sizing

### What one execution costs

Measured directly on real Piston nodes (C++ = a `bits/stdc++.h` hello, Java =
trivial `Main`), on the 4-core / 8-thread test laptop:

| | idle, one job | 2 at once | 4 at once | 6 at once |
|---|---|---|---|---|
| C++ compile, wall per job | 1.1–1.5 s | 2.4 s | 3.4 s | 5.9 s |
| C++ compiles finished per second (all jobs) | ~0.8 | 0.82 | **1.19** | 1.03 |
| Java run, CPU per job (tuned launcher) | 0.7–1.0 s | 2.0 s | 2.5 s | 2.6 s |

Python and JavaScript are ~0.1–0.15 s and barely move. Two things to take from
this: per-job cost rises steeply once jobs outnumber physical cores, and
**throughput stops rising at the physical-core count** (6 at once is *slower* in
total than 4). Java is the canary — in the full 1,000-student run at 4 slots its
CPU time averaged **4.3 s and peaked at 5.7 s against an 8 s limit**, about 6×
its idle cost (probably the JVM's JIT/GC threads contending for cores; the cause
was not isolated).

### The sizing rule

Piston runs one job per slot, and the queue (not Piston) holds the backlog. If
slots outnumber cores, per-job CPU time inflates, wall time stretches, and
correct solutions get killed by a CPU or wall limit — an infrastructure artefact
that looks like the student's fault. So:

```
slots per node   = the node's PHYSICAL core count   (PISTON_MAX_CONCURRENT_JOBS = JUDGE_SLOTS)
                   on most x86 cloud instances a vCPU is one hardware thread, so slots = vCPUs / 2;
                   Arm instances usually expose whole cores, so slots = vCPUs
nodes            = dedicated hosts: no web tier, database or Redis on them
queue workers    ≈ total slots × 1.1
RAM per slot     ≈ 1 GiB budget (compile cap 1 GiB, run cap 512 MiB — caps, not measurements)
```

Verdict throughput per slot is the number to measure on *your* hardware. Two
bounds we have:

| | verdicts / s / slot | how obtained |
|---|---|---|
| Pessimistic | **0.34** | measured: whole stack (nodes, workers, web, DB, load generator) on the 4 cores of a laptop — 1.34 verdicts/s from 4 slots |
| Optimistic | ~1.0 | calculated: the simulator's 0.84 s average per execution × the 0.87 pool efficiency it measured |

| Total slots | Clears 1,000 simultaneous submissions in… pessimistic | …optimistic |
|---|---|---|
| 4 | **12.5 min (measured: 748 s)** | 4 min |
| 16 | 3.1 min | 1.0 min |
| 32 | 1.6 min | 31 s |
| 48 | 62 s | 21 s |

**Recommendation for a 1,000-student class: 48 slots on 48 physical cores** (for
example three nodes of 16 cores / 32 vCPU), N+1: losing a node still leaves 32
slots. Sized on the pessimistic figure that clears a worst-case "everyone
presses Submit in the same second" inside about 1.5–2 minutes, which is also
about how long the student's browser waits (§ next). Measure your own
per-slot figure with the load test (§6) before trusting either bound.

Realistic load is far below the worst case. Planning assumption (not measured):
at a contest's peak each student submits about once per 3 minutes and presses Run
three times per submit → ~22 executions/s. That needs ~19 slots at the idealised
0.84 s/execution, and ~65 at the pessimistic 0.34 verdicts/s/slot — another reason
to measure. Identical Runs (everyone pressing Run on the untouched starter code at
contest start) are served from the result cache and cost one execution total.

### How much queue is too much (depth limits)

The student's browser waits **120 s**, then says "still queued"; the job still
completes (a Submit lands in their history) but they were left hanging. So the
queue should never be deeper than you can drain in about that time:

```
JUDGE_MAX_DEPTH_SUBMIT ≈ sustained verdicts/s × 120        (and keep waits < JUDGE_RESULT_TTL, 900 s)
  test laptop, 1.34/s → ≈ 160        48 slots, pessimistic 16/s → ≈ 1,900
```

The shipped defaults (Run 2,000 / Submit 5,000 / Contest 50,000) assume a fleet
doing ≥ ~40 verdicts/s. **Lower them for a smaller deployment** — past the limit
new work is shed with `503 + Retry-After` instead of silently waiting minutes.
The 12.5-minute run in §5 deliberately ran without a limit to prove nothing is
lost; a real deployment of that size would have set it to ~160.

### The rest of the stack

- **Redis is the production queue driver.** Use *two* instances
  (`infra/redis/docker-compose.yml`): the queue on `maxmemory-policy noeviction`
  (Redis then errors on write instead of silently dropping a queued submission;
  AOF on so queued work survives a restart), and the cache/result store on
  `allkeys-lru` (Redis docs: "you should consider running two separate Redis
  instances"). Both need a password. Watch `evicted_keys` on the cache; a result
  evicted before its student polls shows as "expired". Verified on Redis 7.4.
- **PHP-FPM with OPcache on.** Enqueue and poll are short requests. OPcache took
  an API request from ~200 ms to 17–32 ms on the rig. Size `pm.max_children` for
  your peak concurrent requests. The rig's web tier (three single-threaded PHP
  processes) was its slowest part: at 1,000 simultaneous clicks enqueue p50 was
  8.9 s mostly from requests queueing at the web tier — real FPM will do far better.
- **Database.** Each accepted verdict is one or two inserts; polling never
  touches the database except Sanctum's `last_used_at` write (§8).
- **Put Piston nodes on dedicated hosts.** They need `privileged: true` and run
  hostile code: no database, no secrets, port 2000 reachable only from the
  workers. Pin the image to a digest.

## 4. Configuration reference

All in `backend/.env` (see `backend/.env.example`); defaults live in
`backend/config/judge.php` and `backend/config/piston.php`.

| Variable | Default | What it does |
|---|---|---|
| `PISTON_NODES` | `http://localhost:2000\|8` | `url\|slots,url\|slots…` — slots is the node's `PISTON_MAX_CONCURRENT_JOBS`; it is the node's weight |
| `JUDGE_QUEUE_CONNECTION` | `sync` if `APP_ENV=local`, else app default | Must be a real queue (redis) with workers everywhere except local dev |
| `JUDGE_MAX_CODE_LENGTH` | 65536 | Characters of source per request (≈ 2,000 lines) |
| `JUDGE_MAX_ACTIVE_PER_USER` | 3 | Jobs one student may have queued/running |
| `JUDGE_RATE_RUN_PER_MINUTE` / `_SUBMIT_` / `_POLL_` | 20 / 10 / 180 | Per user |
| `JUDGE_MAX_DEPTH_RUN` / `_SUBMIT` / `_CONTEST` | 2000 / 5000 / 50000 | Queue depth past which new work gets 503. `0` disables. **Set from §3's formula** |
| `JUDGE_RETRY_AFTER_SECONDS` | 10 | `Retry-After` on a 503 |
| `JUDGE_RESULT_TTL` | 900 | How long a verdict stays pollable; must exceed the longest queue wait |
| `JUDGE_RUN_CACHE_TTL` | 600 | Run-verdict cache (deterministic verdicts only, keyed with the problem's sample-test fingerprint) |
| `JUDGE_DEDUPE_WINDOW` | 30 | Same user + same code = same job |
| `JUDGE_JOB_TIMEOUT` | 60 | Keep above `PISTON_HTTP_TIMEOUT_SECONDS` and below the queue's `retry_after` (Laravel docs) |
| `JUDGE_JOB_RETRY_FOR` | 240 | Seconds to keep retrying an infrastructure failure, **from the job's first execution** (queue wait excluded) |
| `JUDGE_JOB_MAX_ATTEMPTS` | 40 | Safety net against a job that crashes its worker every time; time is the real limit |
| `PISTON_HTTP_TIMEOUT_SECONDS` / `_CONNECT_` | 30 / 3 | A hung node is detected by this |
| `PISTON_BREAKER_FAILURES` / `_COOLDOWN_SECONDS` | 3 / 20 | A dead node costs one failed request, then is skipped for the cooldown |
| `PISTON_RUN_TIMEOUT_MS` / `PISTON_COMPILE_TIMEOUT_MS` | 7000 / 15000 | Wall-clock backstops |
| `PISTON_RUN_CPU_TIME_MS` / `PISTON_COMPILE_CPU_TIME_MS` | 3000 / 10000 | CPU limits (what isolate enforces first) |
| `PISTON_JAVA_RUN_CPU_TIME_MS` | 8000 | Java gets headroom for JVM start-up (watch it: §8) |
| `REDIS_CLIENT` | `phpredis` | `predis` (installed) works everywhere; prefer `phpredis` on Linux |
| `REDIS_CACHE_HOST` / `_PORT` / `_PASSWORD` | fall back to `REDIS_*` | Put the cache on its own instance (§3) |

Node-side settings are in `infra/judge/docker-compose.yml`. The app's requested
limits must never exceed the node's ceilings; if one does, the pool reads
Piston's `cannot exceed the configured limit of N` reply and retries once at
the ceiling (this reply format was confirmed against the real node).

## 5. Measured results

### 5a. Real stack — Redis queue, real Piston, real workers

**Rig:** one Windows laptop (Intel i5-1135G7: **4 cores / 8 threads**, 7.7 GB RAM,
Docker VM limited to 3.7 GiB), everything on the same machine: 2 Piston nodes
× 2 slots (`infra/judge`), 2 Redis 7.4 instances (`infra/redis`), 5 queue workers
(2 run-first), 3 PHP web processes with OPcache, MariaDB 10.4 with XAMPP's stock
settings (16 MB buffer pool, fsync per commit), and the load generator. Load from
`infra/loadtest/judge-load.mjs` drives the real HTTP API exactly like the
frontend. Every request carries different code, so no cache flatters the numbers.

| Scenario | Result |
|---|---|
| 16 simultaneous submissions (all four languages) | 16/16 correct, 10.6–12.0 s |
| 100 simultaneous | **100/100 correct**, 56.7 s (1.76 verdicts/s); verdict latency p50 36 s; `GET /me` sampled during the run p50 100 ms, p95 1.2 s, 0 failed |
| **1,000 simultaneous** | **1,000/1,000 correct, 0 failed, 748 s (1.34 verdicts/s)**; verdict latency p50 399 s, max 748 s; `GET /me` p50 172 ms, p95 7.7 s, 0 failed; queue depth back to zero and 0 failures in the telemetry afterwards |
| Java in that 1,000 run (236 solutions) | CPU per run avg **4.3 s, max 5.7 s** (limit 8 s); all accepted |
| Python / JS / C++ runs | avg 100 ms / 143 ms / 15 ms of run CPU; all accepted |

The 12.5 minutes is a property of the *laptop* (§3): the last student waited
12 minutes because 4 slots deliver 1.34 verdicts/s. Nothing was dropped or
mis-judged, which is what this run was for.

### 5b. What the real runs found (and the fixes)

1. **Queue wait was eating the retry window.** The first 1,000-run judged only
   343; **657 ended as `job_error`** without ever executing. Laravel fixes a job's
   `retryUntil()` into its payload at dispatch, so my "retry infrastructure
   failures for 4 minutes" deadline silently counted time waiting in the queue.
   At ~1.3 verdicts/s every job more than ~4 minutes back was failed on pickup
   ("attempted too many times"). The simulator never showed it because it drained
   in under 120 s. Fixed: the window now runs from the job's first execution
   (`JudgeResultStore::firstAttemptAt`), with a regression test that queues a job
   for 10 minutes and still expects it to be retried, not failed. The good news
   in the failure: the safety design held — every one of the 657 was reported as
   an error and none became a wrong verdict.
2. **Six slots on four cores produced false kills.** First real test with 6
   slots: 14/16 correct; a correct Java solution was killed at its 8 s CPU limit
   (it had used 8,020 ms; the same code takes under 1 s on an idle node, and the accepted Java runs in that same test used 3.1–7.7 s) and a
   correct C++ one at the 10 s *compile* CPU limit. Nothing was OOM-killed (checked
   in the kernel log). Re-run at 4 slots: 16/16, and *faster* overall (10.6 s
   vs 18.3 s). Hence the sizing rule.
3. **The kill reason was invisible.** Both showed as "Terminated (SIGKILL)" (the
   compile kill even as a runtime error). Piston does report why (`TO`/`OL`/`RE`
   plus a message), so the app now says "Time Limit Exceeded", "Output Limit
   Exceeded" or "Compilation was stopped: …", and a compiler killed by a limit is
   never cached.
4. **The shipped compose file crashed on start** (`init: true` breaks Piston's
   cgroup-v2 setup). Fixed; the real installer, compose stack and healthchecks
   have now been run end to end.

### 5c. Simulator scale runs (pipeline only)

Same laptop, database queue driver, a *Piston simulator*
(`infra/loadtest/piston-sim.mjs`) that reproduces Piston's slot count, unbounded
internal queue, zombie jobs and 400-on-ceiling and replays idle per-language
times (Python 110 ms, JS 120 ms, Java 1.0 s, C++ 1.8 s), 8 slots. Useful for
what a laptop can't do (failover, backpressure at scale), **not** for capacity —
it ignores contention, which §5a shows dominates.

| Scenario | Result |
|---|---|
| 1,000 simultaneous submissions, 8 slots | 1,000/1,000 correct in 121 s (8.26/s) |
| 200 simultaneous **contest** submissions | 200/200 in 23 s |
| 200 simultaneous, one of two nodes answering 503 for 20 s from t = 5 s | 200/200 correct in 40 s, none lost, none mis-judged |
| 400 simultaneous with the submit-queue limit set to 100 | 135 accepted with correct verdicts, 265 shed with `503 + Retry-After`, 0 wrong |

### 5d. Real-Piston probes

Throwaway nodes started from the shipped compose file's environment, plus the
pre-existing node for comparison:

| Behaviour | Shipped config | Pre-existing `piston_api` |
|---|---|---|
| Python prints 5 KB / 300 KB | ok / ok | killed, empty stdout |
| Python prints 2 MB | killed at ~1 MiB (`OL`, "stdout length exceeded") | killed |
| Request `run_cpu_time: 8000` (Java) | accepted | `HTTP 400 … limit of 3000` |
| CPU-bound loop | killed at 3.1 s (`TO`, "Time limit exceeded") | 3.1 s |
| `time.sleep(60)`, 7 s wall cap | stopped at 7.1 s (`TO`, "Time limit exceeded (wall clock)") | stopped at 7.1 s |
| Python uses 200 / 400 / 700 MB (512 MiB cap) | ok / ok / killed (exit 137) | ok / ok / killed |
| Compiler exceeds its CPU limit | `compile` and `run` both `TO`, signal `SIGKILL`, code null | not tested |

## 6. Operating it

**See what is happening**

- Superadmin → Infrastructure (`GET /api/superadmin/judge-nodes`): per-node
  health and in-flight jobs, queue depth per priority, throughput, and an
  estimated drain time. All live.
- `php artisan judge:status` (`--json` for scripts): the same from a shell.

**Deploy (Linux)**

1. Piston nodes: `cd infra/judge && cp .env.example .env` (set `JUDGE_SLOTS` to
   the host's **physical** core count) `&& docker compose up -d && ./install-runtimes.sh`.
   Add nodes by copying a service in the compose file. Runtimes are several hundred MB per
   node (10–20 minutes per node on the test connection).
2. Redis: `cd infra/redis && cp .env.example .env` (set `REDIS_PASSWORD`) `&& docker compose up -d`.
3. App: `PISTON_NODES`, `QUEUE_CONNECTION=redis`, `CACHE_STORE=redis`,
   `JUDGE_QUEUE_CONNECTION=redis`, `REDIS_*` (and `REDIS_CACHE_*`), depth limits from §3.
4. Workers: `infra/judge/supervisor/judge-workers.conf` (36 + 16 processes for
   48 slots). After every deploy: `php artisan queue:restart`.
5. Before go-live: run the load test (below) against staging.

**Run the same stack on a Windows dev machine** (what the real runs used)

```powershell
# once
cd infra\redis ; copy .env.example .env      # set REDIS_PASSWORD, then: docker compose up -d
cd ..\judge    ; "JUDGE_SLOTS=2" | Set-Content .env ; docker compose up -d
& "C:Program FilesGitinash.exe" ./install-runtimes.sh   # Git Bash (plain `bash` may be WSL); installs runtimes + tunes Java
# backend/.env: PISTON_NODES=http://localhost:2001|2,http://localhost:2002|2
#               REDIS_CLIENT=predis  REDIS_PASSWORD=...  REDIS_CACHE_PORT=6380

# whenever you want the production-shaped path (workers + Redis queue + several web processes)
powershell infra\local\judge-stack.ps1 -Action up -Workers 5 -InteractiveWorkers 2 -Web 3
powershell infra\local\judge-stack.ps1 -Action status
powershell infra\local\judge-stack.ps1 -Action down          # add -All to stop the containers too
```

Plain `php artisan serve` with `APP_ENV=local` keeps judging inline, no worker
needed; `judge-stack.ps1` runs its workers and web processes with the Redis
drivers for *those processes only* (they must share one queue and one cache, so
start both through the script). Windows PHP has no `pcntl`, so a worker cannot
enforce `--timeout` itself; the Piston HTTP timeout bounds a job instead.

**Symptoms**

| You see | Look at | Do |
|---|---|---|
| Verdicts slow, queue depth growing | `judge:status`: depth vs slots | Add nodes/slots (physical cores). Do not raise `PISTON_MAX_CONCURRENT_JOBS` past physical cores |
| Students get "judge at capacity" (503) | Depth vs `JUDGE_MAX_DEPTH_*` | Add capacity first; raising the limit only trades errors for waiting (§3) |
| Jobs end as "could not complete" while nodes are healthy | Failed jobs / laravel.log ("attempted too many times") | You are on a build before the retry-window fix — see §5b.1 |
| A node shows down | Container health, `docker logs` | Pool skips it for 20 s and retries; nothing to do if it recovers |
| "Time Limit Exceeded" on trivial code, especially Java | Node CPU load; stored `runtime_ms` vs the limit | Slots exceed physical cores, or something else shares the host — lower `JUDGE_SLOTS` |
| Correct programs with big output fail | Node `PISTON_OUTPUT_MAX_SIZE` | Must be the shipped 1 MiB, not the 1,024-byte default |
| Java `SIGKILL` / limit errors | Node `PISTON_RUN_CPU_TIME` ≥ 8000; Java patch applied | `docker compose exec -T piston-1 sh -s < patch-java-runtime.sh` |
| Verdicts "expired" | Cache `evicted_keys`; queue wait vs `JUDGE_RESULT_TTL` | Raise cache `maxmemory` / lengthen the TTL / lower the depth limit |

**Load test** (never against production — the seeder refuses when
`APP_ENV=production`; use a scratch database so nothing touches real data):

```bash
# scratch DB, e.g. CREATE DATABASE mellow_loadtest, then with DB_DATABASE=mellow_loadtest:
php artisan migrate --force && php artisan db:seed --force
php artisan judge:loadtest-seed --users=1000 --contest      # throwaway students + tokens
node infra/loadtest/judge-load.mjs \
  --tokens=backend/storage/app/loadtest-users.json \
  --base=https://staging.example.com/api \
  --users=1000 --scenario=burst --action=submit              # add --contest for the contest path
php artisan judge:loadtest-seed --cleanup                     # or just drop the scratch DB
```

`--scenario=steady` runs a realistic contest body (think 15–45 s, then Run, or
Submit about one in four) instead of the worst-case burst. The report gives
verdict-latency percentiles, failures by class, drain rate, and whether the rest
of the site stayed responsive while judging was in flight. Pass several `--base`
URLs, comma-separated, to spread students across app instances; use `--timeout`
above the expected drain time. Read `submissions.runtime_ms` afterwards: it is
the CPU time of every run, the quickest way to see how close Java is to its limit.

## 7. What was and was not tested

Tested:

- 38 automated judge tests (`backend/tests/Feature/Judge/`: pool
  selection/failover/breaker/ceiling clamp, queue priority, backpressure,
  dedupe, idempotency, infrastructure-failure handling, the retry window, kill
  reasons and their caching, rate limits, result store); the whole backend suite
  is 40 tests, all passing.
- **The real stack end to end** (§5a): Redis 7.4 queue and cache with the shipped
  eviction policies and auth, the shipped compose file and installer, real Piston
  nodes, queue workers, and 1,000 simultaneous submissions.
- The pipeline-only scale scenarios in §5c and the real-Piston probes in §5d.

**Not tested — do these before relying on the numbers:**

- **Server hardware.** Everything real ran on one 4-core laptop where nodes, web
  tier, workers, database and load generator share the same cores. Per-slot
  throughput on dedicated cores is unmeasured; §3 gives a pessimistic (measured)
  and an optimistic (calculated) bound. Measure your own with the load test.
- **More than one host.** Failover was tested against simulated nodes and via the
  circuit-breaker unit tests, not across real machines.
- **PHP-FPM + nginx.** The web tier was three PHP built-in-server processes.
- **A production-class database** under hundreds of authenticated requests per
  second (the test DB was XAMPP's stock MariaDB).
- **The UI at scale.** The browser waits 120 s; the run above deliberately exceeded
  that to prove nothing is lost. With sensible depth limits the UI path is the
  503 message instead.

## 8. Known limits and next levers

1. **Java is the CPU canary.** 4.3 s average / 5.7 s peak against an 8 s limit
   even at one slot per physical core on a shared machine. On dedicated hosts it
   should be far lower; if you see Java `Time Limit Exceeded`, fix the contention
   before raising the limit. The structural fix is to run `javac` and `java` as
   separate stages (so the student's CPU budget excludes compiling) — that needs
   a custom Piston package and is not built or measured.
2. **C++ compile time dominates cost** (~two thirds of an average execution).
   Options not yet built or measured: a precompiled `bits/stdc++.h` on the
   nodes, or curated headers in the C++ prelude.
3. **Sanctum writes `personal_access_tokens.last_used_at` on every
   authenticated request.** At peak polling that is hundreds of tiny UPDATEs per
   second. It did not stop the 1,000-run, but on a real database consider
   throttling it (only update if older than a minute).
4. **Memory per slot is a cap, not a measurement.** Problems that legitimately
   need more than 512 MiB at run time need `PISTON_RUN_MEMORY_LIMIT` raised.
5. **Pool efficiency and per-slot throughput are hardware facts.** Re-derive
   them from your own load test rather than reusing §3's figures.

## References

- Piston, `api/src/job.js` — the in-process job queue (unbounded, no timeout),
  output-size kill, isolate limits: <https://github.com/engineer-man/piston/blob/master/api/src/job.js>
- Piston, `api/src/config.js` — options and defaults (`PISTON_MAX_CONCURRENT_JOBS` 64,
  `PISTON_OUTPUT_MAX_SIZE` 1024, `PISTON_RUN_CPU_TIME` 3000, `PISTON_RUN_MEMORY_LIMIT` -1,
  `PISTON_MAX_PROCESS_COUNT` 64): <https://github.com/engineer-man/piston/blob/master/api/src/config.js>
- Judge0 documentation — "We do not recommend the use of `wait=true` feature
  because it does not scale well"; submit-then-poll by token: <https://ce.judge0.com/>
- Judge0 `judge0.conf` — `MAX_QUEUE_SIZE` ("If request for new submission comes
  and the queue [is] full then submission will be rejected"): <https://github.com/judge0/judge0/blob/master/judge0.conf>
- Laravel 12 queues — job `timeout` must be less than `retry_after`; worker
  priority with `--queue=high,default`; `retryUntil`: <https://laravel.com/docs/12.x/queues>
- Redis key eviction — `noeviction` vs `allkeys-lru`; separate instances for
  cache and persistent keys: <https://redis.io/docs/latest/develop/reference/eviction/>
