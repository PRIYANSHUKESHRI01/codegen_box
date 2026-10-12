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
    |
    | PHP is the one language whose student code goes in a file of its own
    | (`solution_filename`) instead of being concatenated with the harness.
    | PHP has no compile step and its CLI prints parse errors to *stdout*
    | (exit 255) — which would be read as test-case output and hide the real
    | message — and a parse error in the same file as the bootstrap can't be
    | caught. The bootstrap (the `php` prelude below) `require`s that file
    | instead, so a syntax error becomes a catchable ParseError that exits
    | with `syntax_error_exit_code`, which CodeExecutionService reports as a
    | compile error, like Java/C++ get from their compilers. Keep the three
    | in step: this entry, the prelude, and CodeExecutionService.
    |
    | Go also keeps the student's code in its own file (solution.go), for a
    | different reason: its imports must come before every other declaration
    | and an unused one is a compile error, so the harness file (main.go)
    | owns its imports and the student's file owns theirs. Piston's Go
    | package has no compile step — `go run` builds and runs in one go — so a
    | build failure is told apart from a runtime panic by its stderr shape
    | (`compile_error_pattern`), not by an exit code.
    |
    | MEASURED on the 8-thread dev laptop (run CPU below includes the build / start-up for these languages):
    |   Go `go run` ~1.4 s (its build is billed to the run), Dart ~1.4-2.4 s (its front end compiles on start),
    |   Swift ~1-2 s (its interpreter compiles on start), Kotlin compile ~9 CPU-s warm and ~18 cold, Scala ~6-10.
    |   Racket ~1.2 s warm but ~4.5 s on a cold node: its `#lang racket` loads a lot of files, and reading them
    |   from a cold disk cache is *kernel CPU time*, which counts. This laptop has less RAM than the toolchains it
    |   switches between (7.9 GB host, 3.7 GB for Docker, ~11 GB of runtimes), so the cache is often cold. The 3 s
    |   default would kill all of these on a busy or cold node: they get 8 s (Go, Dart, Swift, Elixir, Erlang) or
    |   10 s, the node ceiling (Racket). A runaway program is still stopped by the 7 s wall-clock limit.
    |
    | Optional per-language overrides, all in milliseconds: `run_cpu_time_ms`,
    | `run_timeout_ms` (wall), `compile_cpu_time_ms`, `compile_timeout_ms`.
    | They exist for the toolchains that are heavy to *start*: the JVM (Java,
    | Kotlin — kotlinc is a JVM program too) and `go run`, whose build is
    | billed to the run. Piston rejects a request above its node's own
    | ceiling (infra/judge/docker-compose.yml), so raise both together.
    */
    'languages' => [
        'javascript' => ['piston_language' => 'javascript', 'version' => '18.15.0', 'filename' => 'main.js'],
        'python' => ['piston_language' => 'python', 'version' => '3.10.0', 'filename' => 'main.py'],
        'java' => ['piston_language' => 'java', 'version' => '15.0.2', 'filename' => 'Main.java', 'run_cpu_time_ms' => (int) env('PISTON_JAVA_RUN_CPU_TIME_MS', 8000)],
        'cpp' => ['piston_language' => 'c++', 'version' => '10.2.0', 'filename' => 'main.cpp'],
        'php' => ['piston_language' => 'php', 'version' => '8.2.3', 'filename' => 'main.php', 'solution_filename' => 'solution.php', 'syntax_error_exit_code' => 3],
        // C is compiled by the same gcc package as C++ (`gcc -std=c11 *.c -lm`).
        'c' => ['piston_language' => 'c', 'version' => '10.2.0', 'filename' => 'main.c'],
        'go' => ['piston_language' => 'go', 'version' => '1.16.2', 'filename' => 'main.go', 'solution_filename' => 'solution.go', 'compile_error_pattern' => '/\A(# command-line-arguments|[^\n]*\.go:\d+:\d+: )/', 'run_cpu_time_ms' => 8000],
        // Kotlin and Scala: the compiler is itself a JVM program. Tuned (infra/judge/patch-runtimes.sh) it takes
        // ~6-9 CPU-seconds on a warm node, up to ~15 on the very first compile after a node restart, so they get
        // a bigger compile budget than the 10 s / 15 s default; nodes must allow it (PISTON_COMPILE_* in compose).
        'kotlin' => ['piston_language' => 'kotlin', 'version' => '1.8.20', 'filename' => 'main.kt', 'compile_cpu_time_ms' => 25000, 'compile_timeout_ms' => 25000],
        'rust' => ['piston_language' => 'rust', 'version' => '1.68.2', 'filename' => 'main.rs'],
        // `mono` package: Roslyn `csc` + the Mono runtime. (Piston's other C# package, `dotnet`, builds a whole project per run.)
        'csharp' => ['piston_language' => 'csharp', 'version' => '6.12.0', 'filename' => 'main.cs'],
        // `tsc *.ts` then `node` (the type checker runs as the compile step, so a type error is a compile error).
        'typescript' => ['piston_language' => 'typescript', 'version' => '5.0.3', 'filename' => 'main.ts', 'compile_cpu_time_ms' => 20000],
        // Swift and Racket have no compile step in their Piston packages: the interpreter reports a bad program
        // when it runs. Swift's errors are recognised by their shape, like Go's.
        'swift' => ['piston_language' => 'swift', 'version' => '5.3.3', 'filename' => 'main.swift', 'compile_error_pattern' => '/\A[^\n]*\.swift:\d+:\d+: error:/', 'run_cpu_time_ms' => 8000],
        'ruby' => ['piston_language' => 'ruby', 'version' => '3.0.1', 'filename' => 'main.rb'],
        // `dart run` exits 254 for a program that does not compile and 255 for an uncaught exception.
        'dart' => ['piston_language' => 'dart', 'version' => '2.19.6', 'filename' => 'main.dart', 'syntax_error_exit_code' => 254, 'run_cpu_time_ms' => 8000],
        'scala' => ['piston_language' => 'scala', 'version' => '3.2.2', 'filename' => 'main.scala', 'compile_cpu_time_ms' => 25000, 'compile_timeout_ms' => 25000],
        // The BEAM and Racket pay 1-1.5 CPU-seconds just to start (much more when cold), hence the larger run budgets.
        'elixir' => ['piston_language' => 'elixir', 'version' => '1.11.3', 'filename' => 'main.exs', 'run_cpu_time_ms' => 8000],
        // Erlang: student code is its own module (solution.erl), compiled by the harness — see the 'erlang' prelude note.
        // 10 s wall (the node ceiling) rather than 7: the harness for a problem with 100,000-value cases is a 1.5 MB
        // source file that escript must read and lex, which measured 3-7 s on this laptop (mostly kernel time, so it
        // swings with free RAM). Every other problem finishes in about a second.
        'erlang' => ['piston_language' => 'erlang', 'version' => '23.0.0', 'filename' => 'main.erl', 'solution_filename' => 'solution.erl', 'syntax_error_exit_code' => 3, 'run_cpu_time_ms' => 10000, 'run_timeout_ms' => 10000],
        'racket' => ['piston_language' => 'racket', 'version' => '8.3.0', 'filename' => 'main.rkt', 'run_cpu_time_ms' => 10000],
        // LeetCode's "Python" is Python 2.7; our `python` (Python 3.10) is what it calls "Python3".
        'python2' => ['piston_language' => 'python2', 'version' => '2.7.18', 'filename' => 'main.py'],
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
        // The PHP entry file (main.php) is this + the generated harness; the student's code is the
        // separate solution.php it requires (see the 'languages' note above). What each line is for:
        //  - display_errors=stderr: PHP CLI prints fatals to STDOUT by default, which the judge would
        //    read as a test case's output. On stderr they become the runtime_error the student sees.
        //  - error_reporting: warnings/notices/deprecations are dropped. They're harmless to the
        //    verdict (every other language ignores the equivalent) but a warning inside a hot loop
        //    can print megabytes and trip Piston's output limit on an otherwise-correct solution.
        //  - memory_limit: PHP's default is 128M, a quarter of the 512 MiB a run is given for every
        //    other language; arrays are heavy in PHP, so a typical DP table would die on it. Stay a
        //    little under the sandbox cap so running out is PHP's readable fatal, not a bare SIGKILL.
        //  - ob_start/ob_end_clean: discards anything the student's file prints at top level (a demo
        //    call left under their class, a stray `echo`) so it can't shift the one-line-per-case output.
        //  - exit(3): keep equal to 'syntax_error_exit_code' above.
        'php' => <<<'PHP'
<?php
ini_set('display_errors', 'stderr');
ini_set('memory_limit', '448M');
error_reporting(E_ERROR | E_PARSE | E_CORE_ERROR | E_COMPILE_ERROR | E_USER_ERROR | E_RECOVERABLE_ERROR);
ob_start();
try {
    require __DIR__ . '/solution.php';
} catch (\ParseError $e) {
    fwrite(STDERR, 'Parse error: ' . $e->getMessage() . ' in solution.php on line ' . $e->getLine() . "\n");
    exit(3);
}
ob_end_clean();

PHP,
        // `#line 1 "solution.c"` restarts line numbering for the student's code (everything above is
        // ours), so a compile error says "solution.c:3" where the editor shows line 3. The file name
        // must not be a real file: gcc quotes the offending source line from the *physical* file, which
        // would show one of the #includes above instead of the student's line. -lm is already on Piston's gcc line.
        'c' => <<<'C'
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdbool.h>
#include <stdint.h>
#include <limits.h>
#include <math.h>
#include <ctype.h>
#line 1 "solution.c"

C,
        // The imports of main.go (the harness). The student's own imports live in solution.go.
        'go' => "package main\n\nimport (\n\t\"encoding/json\"\n\t\"fmt\"\n\t\"reflect\"\n\t\"strconv\"\n\t\"strings\"\n)\n\n",
        'kotlin' => '',
        // No trailing newline on the next two, on purpose: the student's first line continues this
        // one, so their code keeps its own line numbers in a compiler error. Warnings are silenced
        // (`allow(warnings)`) so a compile error isn't buried under unused-variable noise.
        'rust' => '#![allow(warnings)] ',
        'csharp' => 'using System; using System.Collections.Generic; using System.Linq; using System.Text; ',
        'typescript' => '',
        'swift' => 'import Foundation; ', // Swift wants a `;` between two statements on one line
        'ruby' => '',
        // Same one-line trick: imports must precede declarations, and the student's code continues this line.
        'dart' => "import 'dart:convert'; import 'dart:math'; import 'dart:collection'; ",
        'scala' => '',
        'elixir' => '',
        // Empty: main.erl is only the harness. The student's code is solution.erl, which CodeExecutionService
        // gives its `-module(solution)` header and which the harness compiles itself (HarnessGenerator::ERLANG_LOADER):
        // escript prints compiler warnings to *stdout* (an unused variable is the commonest thing in Erlang), which
        // would be read as the first test case's output. Exit code 3 = it did not compile.
        'erlang' => '',
        'racket' => '', // `#lang racket` is added by CodeExecutionService when the student's code lacks it
        // Python 2 refuses a source file containing any non-ASCII byte unless it declares an encoding, and
        // a student's comment or string easily has one.
        'python2' => "# -*- coding: utf-8 -*-\nimport json\nimport sys\n\n",
    ],

];
