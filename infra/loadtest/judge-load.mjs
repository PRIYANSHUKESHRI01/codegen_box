#!/usr/bin/env node
/**
 * Judge load test — dependency-free (Node >= 18). Simulates N students using
 * the real HTTP API exactly as the frontend does (POST run/submit -> 202 +
 * token -> poll /judge/{token} with 400ms..2s backoff), and reports what a
 * capacity planner needs: end-to-end verdict latency percentiles, failures
 * by class, throughput/drain rate — and, crucially, whether the REST OF THE
 * SITE stays responsive while all that judging is in flight.
 *
 *   php artisan judge:loadtest-seed --users=1000 [--contest]     # on the app host
 *   node judge-load.mjs --tokens=loadtest-users.json --base=https://staging.example.com/api
 *
 * Scenarios
 *   burst   (default) every student presses Submit at the same instant — the
 *           "teacher says go" / contest-start / last-minute worst case.
 *   steady  each student loops for --duration seconds: think 15-45s, then Run
 *           (or Submit ~1 in 4) — a realistic contest body.
 *
 * Every request carries different code (a unique comment appended) so the run
 * cache / double-click dedupe cannot flatter the numbers; pass --identical to
 * measure that path instead. Solutions are correct Two Sum in each language,
 * so anything other than an accepted verdict counts as a failure.
 *
 * Options: --users --scenario --action=run|submit|mixed --contest --duration
 *   --think=15,45 --mix=python:35,cpp:30,java:25,javascript:10
 *   --http-concurrency=250 --timeout=180 --identical --probe=false --out=file.json
 */
import fs from "node:fs";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, "").split("=");
    return [k, v.length ? v.join("=") : "true"];
  })
);

const parseMix = (s) => {
  const entries = s.split(",").map((p) => p.split(":"));
  const total = entries.reduce((n, [, w]) => n + +w, 0);
  return entries.map(([lang, w]) => ({ lang, share: +w / total }));
};

const cfg = {
  tokens: args.tokens ?? "loadtest-users.json",
  // One or more API base URLs (comma-separated); students are spread across them
  // round-robin, for testing several app instances without a load balancer in front.
  bases: (args.base ?? "http://127.0.0.1:8000/api").split(",").map((b) => b.trim().replace(/\/$/, "")),
  users: +(args.users ?? 1000),
  scenario: args.scenario ?? "burst",
  action: args.action ?? "submit",
  contest: args.contest === "true",
  mix: parseMix(args.mix ?? "python:35,cpp:30,java:25,javascript:10"),
  duration: +(args.duration ?? 60),
  think: (args.think ?? "15,45").split(",").map(Number),
  httpConcurrency: +(args["http-concurrency"] ?? 250),
  timeoutSec: +(args.timeout ?? 180),
  identical: args.identical === "true",
  probe: args.probe !== "false",
  out: args.out,
};

const seed = JSON.parse(fs.readFileSync(cfg.tokens, "utf8"));
const users = seed.users.slice(0, cfg.users).map((u, i) => ({ ...u, base: cfg.bases[i % cfg.bases.length] }));
if (cfg.contest && !seed.contest) throw new Error("--contest needs a token file made with `judge:loadtest-seed --contest`");
const actionPath = (action) =>
  cfg.contest
    ? `/contests/${seed.contest.slug}/problems/${seed.contest.contest_problem_id}/${action}`
    : `/problems/${seed.problem.slug}/${action}`;

// ---- correct Two Sum in every supported language ------------------------------------------------
const SOLUTIONS = {
  python: (u) => `from typing import List\n\nclass Solution:\n    def twoSum(self, nums: List[int], target: int) -> List[int]:\n        seen = {}\n        for i, n in enumerate(nums):\n            if target - n in seen:\n                return [seen[target - n], i]\n            seen[n] = i\n        return []\n# ${u}\n`,
  javascript: (u) => `function twoSum(nums, target) {\n  const seen = new Map();\n  for (let i = 0; i < nums.length; i++) {\n    const j = seen.get(target - nums[i]);\n    if (j !== undefined) return [j, i];\n    seen.set(nums[i], i);\n  }\n  return [];\n}\n// ${u}\n`,
  java: (u) => `class Solution {\n    public int[] twoSum(int[] nums, int target) {\n        java.util.Map<Integer, Integer> m = new java.util.HashMap<>();\n        for (int i = 0; i < nums.length; i++) {\n            Integer j = m.get(target - nums[i]);\n            if (j != null) return new int[]{j, i};\n            m.put(nums[i], i);\n        }\n        return new int[]{};\n    }\n}\n// ${u}\n`,
  cpp: (u) => `class Solution {\npublic:\n    vector<int> twoSum(vector<int>& nums, int target) {\n        unordered_map<int, int> m;\n        for (int i = 0; i < (int)nums.size(); i++) {\n            auto it = m.find(target - nums[i]);\n            if (it != m.end()) return {it->second, i};\n            m[nums[i]] = i;\n        }\n        return {};\n    }\n};\n// ${u}\n`,
};

const pickLang = () => {
  let r = Math.random();
  for (const { lang, share } of cfg.mix) if ((r -= share) <= 0) return lang;
  return cfg.mix[0].lang;
};

// ---- tiny HTTP layer -----------------------------------------------------------------------------
let inFlight = 0;
const waiters = [];
const acquire = () => (inFlight < cfg.httpConcurrency ? (inFlight++, Promise.resolve()) : new Promise((r) => waiters.push(r)));
const release = () => (waiters.length ? waiters.shift()() : inFlight--);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function http(method, path, user, body) {
  await acquire();
  const t0 = performance.now();
  try {
    const res = await fetch(user.base + path, {
      method,
      headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${user.token}` },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30_000),
    });
    const json = await res.json().catch(() => null);
    return { status: res.status, json, ms: performance.now() - t0, retryAfter: res.headers.get("retry-after") };
  } catch (e) {
    return { status: 0, json: null, ms: performance.now() - t0, error: e.cause?.code ?? e.name };
  } finally {
    release();
  }
}

// ---- one student action: enqueue, then poll exactly like the frontend ---------------------------
const records = [];
const completions = []; // seconds-since-start of each finished verdict, for the drain profile
const T0 = performance.now();
let counter = 0;

async function judgeOnce(user, action) {
  const lang = pickLang();
  const tag = cfg.identical ? "same" : `u${user.id}-${counter++}`;
  const started = performance.now();
  const rec = { user: user.id, lang, action, ok: false, outcome: "?", e2eMs: 0, enqueueMs: 0, polls: 0, cached: false };

  const first = await http("POST", actionPath(action), user, { language: lang, code: SOLUTIONS[lang](tag) });
  rec.enqueueMs = first.ms;

  const finish = (outcome, ok = false) => {
    rec.outcome = outcome;
    rec.ok = ok;
    rec.e2eMs = performance.now() - started;
    records.push(rec);
    if (ok) completions.push((performance.now() - T0) / 1000);
    return rec;
  };

  if (first.status === 429) return finish("rate_limited_429");
  if (first.status === 503) return finish("shed_503");
  if (first.status === 0) return finish(`network_${first.error}`);
  if (first.status >= 400 && first.status !== 202) return finish(`http_${first.status}`);

  let env = first.json;
  let delay = env?.poll_after_ms ?? 400;
  const deadline = started + cfg.timeoutSec * 1000;

  for (;;) {
    if (env?.state === "done") {
      rec.cached = !!env.cached;
      const passed = env.result?.all_passed === true;
      return finish(passed ? "accepted" : `wrong:${JSON.stringify(env.result).slice(0, 220)}`, passed);
    }
    if (env?.state === "error") return finish("job_error");
    if (!env?.token) return finish("bad_envelope");
    if (performance.now() > deadline) return finish("client_timeout");

    await sleep(delay);
    delay = Math.min(Math.round(delay * 1.5), 2000);
    rec.polls++;
    const poll = await http("GET", `/judge/${env.token}`, user);
    if (poll.status === 429) { await sleep(2000); continue; }
    if (poll.status === 404) return finish("token_lost_404");
    if (poll.status >= 500 || poll.status === 0) { await sleep(1000); continue; }
    env = poll.json;
    if (env?.poll_after_ms) delay = Math.max(delay, Math.min(env.poll_after_ms, 5000)); // server's depth-scaled hint, like the frontend
  }
}

// ---- concurrent probe: does the REST of the site stay responsive? -------------------------------
const probeSamples = [];
let probing = cfg.probe;
async function prober() {
  const probeUser = users[0];
  while (probing) {
    const r = await http("GET", "/me", probeUser);
    probeSamples.push({ ms: r.ms, status: r.status });
    await sleep(400);
  }
}

// ---- scenarios ------------------------------------------------------------------------------------
async function runBurst() {
  await Promise.all(users.map((u) => judgeOnce(u, cfg.action === "run" ? "run" : "submit")));
}

async function runSteady() {
  const end = performance.now() + cfg.duration * 1000;
  const [lo, hi] = cfg.think;
  await Promise.all(
    users.map(async (u, i) => {
      await sleep(Math.random() * lo * 1000); // de-synchronise the start
      while (performance.now() < end) {
        const action = cfg.action === "mixed" ? (Math.random() < 0.25 ? "submit" : "run") : cfg.action;
        await judgeOnce(u, action);
        await sleep((lo + Math.random() * (hi - lo)) * 1000);
      }
    })
  );
}

// ---- report ---------------------------------------------------------------------------------------
const pct = (arr, p) => (arr.length ? [...arr].sort((a, b) => a - b)[Math.min(arr.length - 1, Math.floor(arr.length * p))] : NaN);
const f = (n) => (Number.isFinite(n) ? Math.round(n) : "-");

console.log(`\nJudge load test: ${users.length} students, scenario=${cfg.scenario}, action=${cfg.action}, ${cfg.contest ? "CONTEST" : "practice"} path, base=${cfg.bases.join(",")}`);
console.log(`language mix: ${cfg.mix.map((m) => `${m.lang} ${Math.round(m.share * 100)}%`).join(", ")}\n`);

const probeTask = cfg.probe ? prober() : Promise.resolve();
await (cfg.scenario === "steady" ? runSteady() : runBurst());
probing = false;
await probeTask;

const wall = (performance.now() - T0) / 1000;
const ok = records.filter((r) => r.ok);
const byOutcome = records.reduce((m, r) => ((m[r.outcome.split(":")[0]] = (m[r.outcome.split(":")[0]] ?? 0) + 1), m), {});
const e2e = ok.map((r) => r.e2eMs);
const enq = records.map((r) => r.enqueueMs);
const probeMs = probeSamples.filter((s) => s.status === 200).map((s) => s.ms);
const probeBad = probeSamples.filter((s) => s.status !== 200).length;

console.log(`requests: ${records.length}   accepted verdicts: ${ok.length}   wall: ${wall.toFixed(1)}s   throughput: ${(ok.length / wall).toFixed(2)} verdicts/s`);
console.log(`outcomes: ${JSON.stringify(byOutcome)}`);
{
  // Never leave a failure as just a count: show a sample of each distinct kind.
  const seen = new Set();
  for (const r of records.filter((x) => !x.ok)) {
    const key = `${r.lang}/${r.outcome.slice(0, 40)}`;
    if (seen.size < 6 && !seen.has(key)) {
      seen.add(key);
      console.log(`  failure sample [${r.lang}, ${r.action}]: ${r.outcome}`);
    }
  }
}
console.log(`enqueue latency (POST -> 202/200):   p50 ${f(pct(enq, 0.5))}ms   p95 ${f(pct(enq, 0.95))}ms   p99 ${f(pct(enq, 0.99))}ms   max ${f(Math.max(...enq))}ms`);
console.log(`end-to-end (click -> verdict):       p50 ${f(pct(e2e, 0.5))}ms   p90 ${f(pct(e2e, 0.9))}ms   p95 ${f(pct(e2e, 0.95))}ms   p99 ${f(pct(e2e, 0.99))}ms   max ${f(Math.max(...e2e))}ms`);
if (cfg.probe) {
  console.log(`site responsiveness DURING the run (GET /me every 400ms, ${probeSamples.length} samples): p50 ${f(pct(probeMs, 0.5))}ms   p95 ${f(pct(probeMs, 0.95))}ms   max ${f(Math.max(...probeMs))}ms   failed ${probeBad}`);
}
const byLang = {};
for (const r of ok) (byLang[r.lang] ??= []).push(r.e2eMs);
console.log(`by language (p50 e2e ms): ${Object.entries(byLang).map(([l, a]) => `${l} ${f(pct(a, 0.5))} (n=${a.length})`).join("  ")}`);

if (completions.length > 1) {
  const buckets = {};
  for (const s of completions) buckets[Math.floor(s / 10) * 10] = (buckets[Math.floor(s / 10) * 10] ?? 0) + 1;
  console.log(`drain profile (verdicts per 10s): ${Object.entries(buckets).map(([t, n]) => `${t}s:${n}`).join("  ")}`);
}

const summary = {
  config: { ...cfg, tokens: undefined },
  wallSeconds: wall,
  requests: records.length,
  accepted: ok.length,
  outcomes: byOutcome,
  verdictsPerSecond: ok.length / wall,
  enqueueMs: { p50: pct(enq, 0.5), p95: pct(enq, 0.95), p99: pct(enq, 0.99), max: Math.max(...enq) },
  e2eMs: { p50: pct(e2e, 0.5), p90: pct(e2e, 0.9), p95: pct(e2e, 0.95), p99: pct(e2e, 0.99), max: Math.max(...e2e) },
  probeMs: cfg.probe ? { samples: probeSamples.length, p50: pct(probeMs, 0.5), p95: pct(probeMs, 0.95), max: Math.max(...probeMs), failed: probeBad } : null,
};
if (cfg.out) fs.writeFileSync(cfg.out, JSON.stringify(summary, null, 2));

// Non-zero exit if any request was lost or wrong, so this can gate a release.
process.exit(records.some((r) => !r.ok && !["rate_limited_429", "shed_503"].includes(r.outcome.split(":")[0])) ? 1 : 0);
