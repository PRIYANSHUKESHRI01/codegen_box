<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Piston node pool
    |--------------------------------------------------------------------------
    |
    | One or more self-hosted Piston nodes (see infra/judge/), comma
    | separated, each optionally followed by `|<slots>` = that node's
    | PISTON_MAX_CONCURRENT_JOBS (its weight in load balancing), e.g.
    |
    |   PISTON_NODES=http://judge-1:2000|8,http://judge-2:2000|16
    |
    | PISTON_BASE_URL (a single node) is still honoured as the fallback so
    | existing single-node setups keep working unchanged. Run several nodes
    | rather than one big one: nodes are stateless, so a node dying costs
    | 1/N of capacity instead of everything, and the pool fails over to the
    | others automatically (App\Services\Judge\PistonPool).
    */
    'nodes' => array_values(array_filter(array_map(function (string $entry) {
        [$url, $slots] = array_pad(explode('|', trim($entry), 2), 2, null);

        return $url === '' ? null : ['url' => rtrim($url, '/'), 'slots' => max(1, (int) ($slots ?: 8))];
    }, explode(',', (string) env('PISTON_NODES', env('PISTON_BASE_URL', 'http://localhost:2000')))))),

    // Kept for backwards compatibility with anything still reading it.
    'base_url' => env('PISTON_BASE_URL', 'http://localhost:2000'),

    // HTTP budget for one execution = compile + run + margin. A hung node
    // is detected by this, so it must stay well below the job timeout
    // (judge.job.timeout_seconds).
    'http_timeout_seconds' => (int) env('PISTON_HTTP_TIMEOUT_SECONDS', env('PISTON_TIMEOUT_SECONDS', 30)),
    'connect_timeout_seconds' => (int) env('PISTON_CONNECT_TIMEOUT_SECONDS', 3),
    'timeout_seconds' => (int) env('PISTON_HTTP_TIMEOUT_SECONDS', env('PISTON_TIMEOUT_SECONDS', 30)),

    // Circuit breaker: after this many consecutive failures a node is taken
    // out of rotation for the cooldown, so a dead node costs one failed
    // request, not one per student.
    'breaker_failures' => (int) env('PISTON_BREAKER_FAILURES', 3),
    'breaker_cooldown_seconds' => (int) env('PISTON_BREAKER_COOLDOWN_SECONDS', 20),

    /*
    | Per-request limits sent to Piston. Wall-clock (`*_timeout_ms`) is the
    | backstop against infinite loops; CPU time (`*_cpu_time_ms`) is what
    | Piston's isolate sandbox actually enforces first. Piston rejects any
    | request above its own server-side ceiling (PISTON_RUN_TIMEOUT,
    | PISTON_RUN_CPU_TIME, ... — see infra/judge/), so those must be set to
    | at least these values on every node.
    |
    | Run wall time was 15s, which is how long a program that sleeps or
    | blocks on input held an execution slot (a CPU-bound `while(true)` is
    | cut earlier, at the CPU limit: 3.1s measured). 7s is still generous for
    | a real solution and more than halves that waste.
    */
    'run_timeout_ms' => (int) env('PISTON_RUN_TIMEOUT_MS', 7000),
    'compile_timeout_ms' => (int) env('PISTON_COMPILE_TIMEOUT_MS', 15000),
    'run_cpu_time_ms' => (int) env('PISTON_RUN_CPU_TIME_MS', 3000),
    'compile_cpu_time_ms' => (int) env('PISTON_COMPILE_CPU_TIME_MS', 10000),

    /*
    |--------------------------------------------------------------------------
    | Language mapping
    |--------------------------------------------------------------------------
    |
    | Our internal language keys (also used for starter_code/test_harness on
    | Problem) mapped to Piston's language identifier + installed version
    | (`docker exec piston_api ... ppman install <lang>=<version>`) and the
    | filename Piston should write the source as — Java's public class must
    | match its filename, so this has to be "Main.java".
    |
    | `run_cpu_time_ms` overrides the global CPU cap per language. Java needs
    | it: Piston runs `java Main.java` (source-launcher mode, javac in
    | process), and the JVM's JIT/GC threads burn 2-3 CPU-seconds on a trivial
    | program (measured: 1.9-2.5s on an 8-thread host, one run killed at
    | 3034ms by the default 3s cap) — and more CPU-seconds the more cores the
    | host has. Without headroom, correct Java solutions get SIGKILLed.
    */
    'languages' => [
        'javascript' => ['piston_language' => 'javascript', 'version' => '18.15.0', 'filename' => 'main.js'],
        'python' => ['piston_language' => 'python', 'version' => '3.10.0', 'filename' => 'main.py'],
        'java' => ['piston_language' => 'java', 'version' => '15.0.2', 'filename' => 'Main.java', 'run_cpu_time_ms' => (int) env('PISTON_JAVA_RUN_CPU_TIME_MS', 8000)],
        'cpp' => ['piston_language' => 'c++', 'version' => '10.2.0', 'filename' => 'main.cpp'],
    ],

    /*
    |--------------------------------------------------------------------------
    | Per-language preludes
    |--------------------------------------------------------------------------
    |
    | Imports/includes that must appear before the student's own code (Java
    | import statements and C++ #includes are illegal after a class/using
    | declaration), so these are prepended rather than generated as part of
    | each problem's harness (App\Services\ProblemCodeGenerator\HarnessGenerator).
    |
    | C++'s toJson(...) overload set below is the one place this codebase
    | prints canonical JSON for a language with no JSON support built in —
    | written once here, reused by every problem's generated harness,
    | instead of a one-off print helper hand-rolled per problem (which is
    | what the old hand-authored test_harness data used to do). Java needs
    | the equivalent overload set too, but it has to live *inside* the
    | generated `public class Main` (Piston's single-file Java launcher
    | picks the first top-level class as the entry point, so nothing can
    | precede it) — see HarnessGenerator::JAVA_JSON_HELPERS instead.
    */
    'preludes' => [
        'javascript' => '',
        'python' => "import json\n\n",
        'java' => "import java.util.*;\n\n",
        'cpp' => <<<'CPP'
#include <bits/stdc++.h>
using namespace std;

string toJson(int v) { return to_string(v); }
string toJson(long long v) { return to_string(v); }
string toJson(double v) { ostringstream oss; oss << v; return oss.str(); }
string toJson(bool v) { return v ? "true" : "false"; }
string toJson(const string& v) {
    string r = "\"";
    for (char c : v) { if (c == '"' || c == '\\') r += '\\'; r += c; }
    r += "\"";
    return r;
}
string toJson(const vector<int>& v) { string r = "["; for (size_t i = 0; i < v.size(); i++) { if (i) r += ","; r += toJson(v[i]); } r += "]"; return r; }
string toJson(const vector<long long>& v) { string r = "["; for (size_t i = 0; i < v.size(); i++) { if (i) r += ","; r += toJson(v[i]); } r += "]"; return r; }
string toJson(const vector<double>& v) { string r = "["; for (size_t i = 0; i < v.size(); i++) { if (i) r += ","; r += toJson(v[i]); } r += "]"; return r; }
string toJson(const vector<bool>& v) { string r = "["; for (size_t i = 0; i < v.size(); i++) { if (i) r += ","; r += toJson((bool)v[i]); } r += "]"; return r; }
string toJson(const vector<string>& v) { string r = "["; for (size_t i = 0; i < v.size(); i++) { if (i) r += ","; r += toJson(v[i]); } r += "]"; return r; }
string toJson(const vector<vector<int>>& v) { string r = "["; for (size_t i = 0; i < v.size(); i++) { if (i) r += ","; r += toJson(v[i]); } r += "]"; return r; }

CPP,
    ],

];
