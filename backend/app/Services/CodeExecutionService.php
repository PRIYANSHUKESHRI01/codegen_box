<?php

namespace App\Services;

use App\Services\Judge\PistonPool;
use RuntimeException;

/**
 * Thin client around the Piston node pool. Submits one full program
 * (student code + our appended test harness) and returns the raw run
 * result — this service knows nothing about problems or test cases, that
 * comparison logic lives in JudgeService. Node selection, failover and
 * the circuit breaker live in PistonPool.
 */
class CodeExecutionService
{
    public function __construct(private readonly PistonPool $pool) {}

    /**
     * @return array{
     *   stdout: string,
     *   stderr: string,
     *   compileError: ?string,
     *   signal: ?string,
     *   exitCode: ?int,
     *   cpuTimeMs: ?int,
     *   memoryBytes: ?int,
     *   compileKilled: bool,  the compiler was stopped by a resource limit (transient: load-dependent), not a genuine compile error
     *   runStatus: ?string,   Piston's own reason for the run ending: TO time limit, OL output limit, RE non-zero exit, SG signal
     *   runMessage: ?string,  e.g. "Time limit exceeded (wall clock)"
     * }
     *
     * @throws RuntimeException for an unsupported language
     * @throws \App\Services\Judge\JudgeUnavailableException when no node could execute the job
     */
    public function run(string $language, string $studentCode, string $harness): array
    {
        $lang = config("piston.languages.{$language}");

        if (! $lang) {
            throw new RuntimeException("Unsupported language for execution: {$language}");
        }

        $prelude = config("piston.preludes.{$language}", '');

        $data = $this->pool->execute([
            'language' => $lang['piston_language'],
            'version' => $lang['version'],
            'run_timeout' => (int) ($lang['run_timeout_ms'] ?? config('piston.run_timeout_ms', 7000)),
            'compile_timeout' => (int) ($lang['compile_timeout_ms'] ?? config('piston.compile_timeout_ms', 15000)),
            'run_cpu_time' => (int) ($lang['run_cpu_time_ms'] ?? config('piston.run_cpu_time_ms', 3000)),
            'compile_cpu_time' => (int) ($lang['compile_cpu_time_ms'] ?? config('piston.compile_cpu_time_ms', 10000)),
            'files' => $this->assembleFiles($language, $lang, $prelude, $studentCode, $harness),
        ]);

        $compile = $data['compile'] ?? null;
        $run = $data['run'] ?? [];

        // A compiler that is *killed* (CPU/wall limit) exits with code null and a signal, not a
        // non-zero code, and Piston mirrors that result into `run`. Treat it as a failed compile
        // with the real reason instead of letting it surface as a bare "Terminated (SIGKILL)".
        $compileKilled = $compile !== null && ($compile['signal'] ?? null) !== null;
        $compileFailed = $compile !== null && ((int) ($compile['code'] ?? 0) !== 0 || $compileKilled);

        $compileMessage = trim($compile['stderr'] ?? '') ?: trim($compile['output'] ?? '');

        // PHP has no compile step, so its bootstrap reports a syntax error by exiting with this
        // dedicated code (config/piston.php) — the equivalent of Java/C++ failing to compile.
        $syntaxErrorExit = $lang['syntax_error_exit_code'] ?? null;
        $syntaxError = $syntaxErrorExit !== null && ($run['code'] ?? null) === $syntaxErrorExit;

        // Go has no separate compile step either (`go run` does both), so a build failure is only
        // recognisable by what it prints. A panic's stderr starts with "panic:", never like this.
        $buildErrorPattern = $lang['compile_error_pattern'] ?? null;
        $buildError = $buildErrorPattern !== null
            && ($run['code'] ?? 0) !== 0
            && preg_match($buildErrorPattern, ltrim($run['stderr'] ?? '')) === 1;

        return [
            'stdout' => $run['stdout'] ?? '',
            'stderr' => $run['stderr'] ?? '',
            'compileError' => match (true) {
                $compileFailed => $compileMessage ?: ($compileKilled ? 'Compilation was stopped: '.($compile['message'] ?? 'resource limit exceeded').'.' : 'Compilation failed.'),
                $syntaxError, $buildError => trim($run['stderr'] ?? '') ?: 'Syntax error.',
                default => null,
            },
            'signal' => $run['signal'] ?? null,
            'exitCode' => array_key_exists('code', $run) ? $run['code'] : null,
            'cpuTimeMs' => $run['cpu_time'] ?? null,
            'memoryBytes' => $run['memory'] ?? null,
            'compileKilled' => $compileKilled,
            'runStatus' => $run['status'] ?? null,
            'runMessage' => $run['message'] ?? null,
        ];
    }

    /**
     * Java's single-file source-launcher (Piston runs `java <file>.java`,
     * not `javac` + `java <Class>`) picks the *first* top-level class
     * declared in the file as the entry point whenever the filename doesn't
     * exactly match a class name — which it never will here, since Piston
     * writes its own generated filename regardless of what we ask for. So
     * for Java, the harness's `public class Main` has to come first; every
     * other language's entry point isn't order-sensitive, so student code
     * reads naturally above the appended harness.
     */
    private function assembleSource(string $language, string $studentCode, string $harness): string
    {
        if ($language === 'java') {
            return $harness."\n\n".$studentCode;
        }

        if ($language === 'rust' && preg_match('/\bstruct\s+Solution\b/', $studentCode) !== 1) {
            // LeetCode's Rust editor hides `struct Solution;` and shows only the `impl`; solutions
            // pasted from there (or the impl a student kept after deleting the struct) still build.
            $studentCode .= "\nstruct Solution;";
        }

        // A Racket file is only a module if it opens with `#lang`; the starter code shows it, and a
        // student who deletes it (or pastes LeetCode's, which hides it) still runs.
        if ($language === 'racket' && preg_match('/\A\s*#lang\s/', $studentCode) !== 1) {
            $studentCode = "#lang racket\n".$studentCode;
        }

        return $studentCode."\n\n".$harness;
    }

    /**
     * The files Piston writes, entry file first. Most languages are one file: the student's code and
     * the harness together. PHP and Go keep the student's code in a file of its own (the entry file's
     * prelude + harness is the other) — see the 'languages' note in config/piston.php for why.
     *
     * @param  array<string, mixed>  $lang  config("piston.languages.{$language}")
     * @return list<array{name: string, content: string}>
     */
    private function assembleFiles(string $language, array $lang, string $prelude, string $studentCode, string $harness): array
    {
        if (! isset($lang['solution_filename'])) {
            return [['name' => $lang['filename'], 'content' => $prelude.$this->assembleSource($language, $studentCode, $harness)]];
        }

        return [
            ['name' => $lang['filename'], 'content' => $prelude.$harness],
            ['name' => $lang['solution_filename'], 'content' => $this->solutionFileSource($language, $studentCode)],
        ];
    }

    /**
     * What goes in the student's own file. These languages need a header the student may or may not
     * have kept from the starter code — PHP's `<?php` (a PHP file is only code between tags), Go's
     * `package main` — so accept both; Erlang's module header is never in the starter at all, so it is
     * always added. A missing header goes on the *same line* as the first line of the student's code,
     * so a syntax error's line number is the one the editor shows.
     */
    private function solutionFileSource(string $language, string $studentCode): string
    {
        return match ($language) {
            'php' => preg_match('/^\s*<\?php(\s|$)/i', $studentCode) === 1 ? $studentCode : '<?php '.$studentCode,
            'go' => preg_match('/^\s*(?:(?:\/\/[^\n]*|\/\*.*?\*\/)\s*)*package\s+\w+/s', $studentCode) === 1 ? $studentCode : 'package main; '.$studentCode,
            // A student's Erlang is just functions (as in LeetCode); the harness loads it as the `solution` module.
            'erlang' => '-module(solution). -compile([export_all, nowarn_export_all]). '.$studentCode,
            default => $studentCode,
        };
    }
}
