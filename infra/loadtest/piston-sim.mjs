#!/usr/bin/env node
/**
 * Piston simulator — for load-testing everything AROUND the sandbox (web tier,
 * queue, workers, pool, cache, DB) at 1,000-student scale on a machine that
 * could never actually run 1,000 compiles. It is NOT a sandbox: it returns the
 * correct verdict lines after sleeping for a realistic time.
 *
 * It reproduces the real Piston behaviours that matter for capacity:
 *   - PISTON_MAX_CONCURRENT_JOBS slots; a job above that waits in an
 *     UNBOUNDED in-process FIFO with NO timeout (api/src/job.js: job_queue);
 *   - a job keeps running after its client has gone away (so a timed-out
 *     request still burns a slot — "zombie" work);
 *   - requests above the server's CPU/time ceilings get HTTP 400
 *     "<field> cannot exceed the configured limit of N".
 *
 * Wall time per language is what was MEASURED on an idle core with the app's
 * real harness (docs/scaling-the-judge.md): python 110ms, javascript 120ms,
 * java ~1.0s (tuned JVM flags; ~1.6s default), c++ ~1.8s (bits/stdc++.h compile).
 *
 *   node piston-sim.mjs --port=2100 --slots=8 --tokens=loadtest-users.json
 *   PISTON_NODES=http://127.0.0.1:2100|8   # point the app at it
 *
 * Options: --port --slots --speed=1 (2 = twice as fast) --run-cpu-ceiling=10000
 *   --fail-rate=0 --tokens=<file with problem.expected_lines>
 * Admin:   GET /admin/down?ms=5000   answer 503 for 5s (simulates a crashed node)
 *          GET /stats                running / queued / peaks / served / abandoned
 */
import http from "node:http";
import fs from "node:fs";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, "").split("=");
    return [k, v.length ? v.join("=") : "true"];
  })
);
const cfg = {
  port: +(args.port ?? 2100),
  slots: +(args.slots ?? 8),
  speed: +(args.speed ?? 1),
  runCpuCeiling: +(args["run-cpu-ceiling"] ?? 10000),
  failRate: +(args["fail-rate"] ?? 0),
};

let expected = ["[0,1]", "[1,2]"];
if (args.tokens && fs.existsSync(args.tokens)) {
  const seed = JSON.parse(fs.readFileSync(args.tokens, "utf8"));
  if (seed.problem?.expected_lines?.length) expected = seed.problem.expected_lines;
}

const WALL_MS = { python: 110, javascript: 120, java: 1000, "c++": 1800 };
const CPU_MS = { python: 40, javascript: 60, java: 950, "c++": 1750 };
const jitter = (ms) => ms * (0.8 + Math.random() * 0.4);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let running = 0;
const waiting = [];
const stats = { peakRunning: 0, peakQueued: 0, served: 0, abandoned: 0, rejected400: 0 };
let downUntil = 0;

const acquire = () =>
  running < cfg.slots ? (running++, Promise.resolve()) : new Promise((resolve) => (waiting.push(resolve), (stats.peakQueued = Math.max(stats.peakQueued, waiting.length))));
const release = () => (waiting.length ? waiting.shift()() : running--);

const readBody = (req) => new Promise((resolve) => { let b = ""; req.on("data", (c) => (b += c)).on("end", () => resolve(b)); });
const send = (res, status, body) => { if (!res.writableEnded) { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(body)); } };

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, "http://x");

    if (url.pathname === "/stats") return send(res, 200, { running, queued: waiting.length, slots: cfg.slots, ...stats });
    if (url.pathname === "/admin/down") { downUntil = Date.now() + +(url.searchParams.get("ms") ?? 5000); return send(res, 200, { down_until: downUntil }); }
    if (Date.now() < downUntil) return send(res, 503, { message: "node down (simulated)" });

    if (url.pathname === "/api/v2/runtimes") {
      return send(res, 200, [{ language: "python", version: "3.10.0" }, { language: "javascript", version: "18.15.0" }, { language: "java", version: "15.0.2" }, { language: "c++", version: "10.2.0" }]);
    }

    if (url.pathname === "/api/v2/execute" && req.method === "POST") {
      const body = JSON.parse((await readBody(req)) || "{}");
      if (body.run_cpu_time > cfg.runCpuCeiling) { stats.rejected400++; return send(res, 400, { message: `run_cpu_time cannot exceed the configured limit of ${cfg.runCpuCeiling}` }); }
      if (Math.random() < cfg.failRate) return send(res, 500, { message: "simulated node error" });

      let clientGone = false;
      res.on("close", () => { if (!res.writableEnded) { clientGone = true; stats.abandoned++; } });

      await acquire(); // unbounded FIFO, no timeout — exactly like Piston
      stats.peakRunning = Math.max(stats.peakRunning, running);
      const lang = body.language;
      const wall = jitter(WALL_MS[lang] ?? 500) / cfg.speed;
      await sleep(wall); // runs to completion even if the client already disconnected
      release();
      stats.served++;

      const compiled = lang === "c++" ? { stdout: "", stderr: "", code: 0, signal: null, cpu_time: Math.round(CPU_MS[lang] * 0.99), wall_time: Math.round(wall * 0.99), memory: 90_000_000 } : null;
      return clientGone ? undefined : send(res, 200, {
        language: lang,
        version: body.version,
        compile: compiled,
        run: { stdout: expected.join("\n") + "\n", stderr: "", code: 0, signal: null, cpu_time: Math.round((CPU_MS[lang] ?? 50) * 0.01) + 6, wall_time: Math.round(wall * 0.01) + 10, memory: 4_000_000 },
      });
    }

    send(res, 404, { message: "not found" });
  })
  .listen(cfg.port, "127.0.0.1", () => console.log(`piston-sim on :${cfg.port} slots=${cfg.slots} speed=${cfg.speed} expected_lines=${expected.length}`));
