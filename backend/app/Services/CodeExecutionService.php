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
        $fullSource = $prelude.$this->assembleSource($language, $studentCode, $harness);

        $data = $this->pool->execute([
            'language' => $lang['piston_language'],
            'version' => $lang['version'],
            'run_timeout' => (int) config('piston.run_timeout_ms', 7000),
            'compile_timeout' => (int) config('piston.compile_timeout_ms', 15000),
            'run_cpu_time' => (int) ($lang['run_cpu_time_ms'] ?? config('piston.run_cpu_time_ms', 3000)),
            'compile_cpu_time' => (int) config('piston.compile_cpu_time_ms', 10000),
            'files' => [
                ['name' => $lang['filename'], 'content' => $fullSource],
            ],
        ]);

        $compile = $data['compile'] ?? null;
        $run = $data['run'] ?? [];

        // A compiler that is *killed* (CPU/wall limit) exits with code null and a signal, not a
        // non-zero code, and Piston mirrors that result into `run`. Treat it as a failed compile
        // with the real reason instead of letting it surface as a bare "Terminated (SIGKILL)".
        $compileKilled = $compile !== null && ($compile['signal'] ?? null) !== null;
        $compileFailed = $compile !== null && ((int) ($compile['code'] ?? 0) !== 0 || $compileKilled);

        $compileMessage = trim($compile['stderr'] ?? '') ?: trim($compile['output'] ?? '');

        return [
            'stdout' => $run['stdout'] ?? '',
            'stderr' => $run['stderr'] ?? '',
            'compileError' => $compileFailed
                ? ($compileMessage ?: ($compileKilled ? 'Compilation was stopped: '.($compile['message'] ?? 'resource limit exceeded').'.' : 'Compilation failed.'))
                : null,
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

        return $studentCode."\n\n".$harness;
    }
}
