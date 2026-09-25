<?php

namespace App\Services;

use App\Models\Problem;
use App\Models\ProblemTestCase;
use App\Models\Submission;
use App\Services\ProblemCodeGenerator\HarnessGenerator;
use Illuminate\Support\Collection;
use RuntimeException;

/**
 * The single problem-judging pipeline — extracted out of SubmissionController
 * (its original, only caller) so contest submissions (ContestSubmissionController)
 * can reuse the exact same harness-execution and verdict-classification rules
 * rather than a second, independently-maintained copy of what "accepted"
 * means. Knows nothing about *where* a submission is persisted (practice
 * `submissions` vs contest `contest_submissions`) — callers own that.
 *
 * The caller also decides *which* test cases get judged — "Run" passes only
 * the public samples (fast feedback on what's visible), "Submit" passes the
 * full set including hidden cases (see SubmissionController) — so passing
 * only requires satisfying the real hidden suite, not just what's shown.
 */
class JudgeService
{
    public const SUPPORTED_LANGUAGES = ['javascript', 'python', 'java', 'cpp'];

    public function __construct(
        private readonly CodeExecutionService $executor,
        private readonly HarnessGenerator $harnessGenerator,
    ) {}

    /**
     * @param  Collection<int, ProblemTestCase>  $testCases  In display order; judged in that order, stopping at (and revealing) the first failure.
     * @param  bool  $propagateExecutionFailures  When true, an execution-infrastructure failure (no Piston node
     *                                            reachable, node error, timeout) is rethrown instead of being
     *                                            turned into a 502 "verdict". The queued judge path sets this:
     *                                            an outage must be retried, never persisted as the student's
     *                                            runtime error (which for a contest would cost them a penalty).
     *                                            Synchronous callers (admin problem verification) keep the
     *                                            original behaviour.
     * @return array{
     *   body: array,
     *   status: int,
     *   submissionStatus: string,
     *   runtimeMs: ?int,
     *   memoryKb: ?int,
     * }
     */
    public function judge(Problem $problem, string $language, string $code, Collection $testCases, bool $propagateExecutionFailures = false): array
    {
        if (! in_array($language, self::SUPPORTED_LANGUAGES, true)) {
            return $this->rejection("This problem doesn't support running {$language} yet.");
        }

        if ($testCases->isEmpty()) {
            return $this->rejection('This problem has no test cases yet.');
        }

        $harness = $this->harnessGenerator->generate($problem, $language, $testCases);

        try {
            $result = $this->executor->run($language, $code, $harness);
        } catch (RuntimeException $e) {
            if ($propagateExecutionFailures) {
                throw $e;
            }

            return [
                'body' => [
                    'message' => 'Could not reach the execution engine. Please try again in a moment.',
                    'error' => $e->getMessage(),
                ],
                'status' => 502,
                'submissionStatus' => Submission::STATUS_RUNTIME_ERROR,
                'runtimeMs' => null,
                'memoryKb' => null,
            ];
        }

        $runtimeMs = $result['cpuTimeMs'] !== null ? (int) round($result['cpuTimeMs']) : null;
        $memoryKb = $result['memoryBytes'] !== null ? (int) round($result['memoryBytes'] / 1024) : null;

        // A compile error or crash means there's nothing meaningful to
        // compare per-case — surface it directly instead of pretending
        // every case failed independently.
        if ($result['compileError'] !== null) {
            return [
                'body' => ['compile_error' => $result['compileError'], 'results' => [], 'all_passed' => false],
                'status' => 200,
                'submissionStatus' => Submission::STATUS_COMPILE_ERROR,
                'runtimeMs' => null,
                'memoryKb' => null,
                // A compiler stopped by a CPU/wall limit can succeed on a quieter node, so
                // (unlike a real syntax error) that verdict must not be cached for other students.
                'transient' => (bool) ($result['compileKilled'] ?? false),
            ];
        }

        $killedBySignal = $result['signal'] !== null;
        $nonZeroExit = $result['exitCode'] !== null && $result['exitCode'] !== 0;

        if ($killedBySignal || $nonZeroExit) {
            // Piston says why it stopped the run; a limit kill is a SIGKILL either way, but
            // "Time Limit Exceeded" is what a student (and an operator reading the logs) needs.
            $status = match (true) {
                ($result['runStatus'] ?? null) === 'TO' => 'Time Limit Exceeded',
                ($result['runStatus'] ?? null) === 'OL' => 'Output Limit Exceeded',
                $killedBySignal => "Terminated ({$result['signal']})",
                default => 'Runtime Error',
            };

            return [
                'body' => [
                    'runtime_error' => trim($result['stderr']) ?: ($result['runMessage'] ?? $status),
                    'status' => $status,
                    'results' => [],
                    'all_passed' => false,
                ],
                'status' => 200,
                'submissionStatus' => Submission::STATUS_RUNTIME_ERROR,
                'runtimeMs' => $runtimeMs,
                'memoryKb' => $memoryKb,
            ];
        }

        $actualLines = preg_split('/\r?\n/', trim($result['stdout']));
        $results = [];
        $allPassed = true;

        foreach ($testCases as $index => $testCase) {
            $actualRaw = trim($actualLines[$index] ?? '');
            $actualDecoded = json_decode($actualRaw, true);
            $actualIsValidJson = json_last_error() === JSON_ERROR_NONE;

            $passed = $actualIsValidJson && $this->compare(
                $actualDecoded,
                $testCase->expected_output,
                $problem->comparison_mode,
                $problem->comparison_epsilon !== null ? (float) $problem->comparison_epsilon : null,
            );

            $results[] = [
                'case' => $index + 1,
                'input' => $testCase->prettyInput($problem->params),
                'expected' => json_encode($testCase->expected_output),
                'actual' => $actualRaw,
                'passed' => $passed,
            ];

            if (! $passed) {
                $allPassed = false;
                break; // Fail-fast: reveal exactly one concrete failing case, not the whole (possibly hidden) suite.
            }
        }

        return [
            'body' => [
                'results' => $results,
                'all_passed' => $allPassed,
                'time' => $result['cpuTimeMs'] !== null ? round($result['cpuTimeMs'] / 1000, 2) : null,
                'memory' => $memoryKb,
            ],
            'status' => 200,
            'submissionStatus' => $allPassed ? Submission::STATUS_ACCEPTED : Submission::STATUS_WRONG_ANSWER,
            'runtimeMs' => $runtimeMs,
            'memoryKb' => $memoryKb,
        ];
    }

    /**
     * exact: direct structural equality (order- and type-sensitive).
     * unordered: same multiset of elements, order doesn't matter (problems
     * with "return any valid answer" semantics).
     * float_tolerance: numeric leaves compared within comparison_epsilon
     * instead of exact equality, for floating-point results.
     * Mirrors DMOJ's "standard"/"floats"/custom-checker concept.
     */
    private function compare(mixed $actual, mixed $expected, string $mode, ?float $epsilon): bool
    {
        return match ($mode) {
            Problem::COMPARISON_UNORDERED => $this->compareUnordered($actual, $expected),
            Problem::COMPARISON_FLOAT_TOLERANCE => $this->compareWithTolerance($actual, $expected, $epsilon ?? 0.000001),
            default => $actual === $expected,
        };
    }

    private function compareUnordered(mixed $actual, mixed $expected): bool
    {
        if (! is_array($actual) || ! is_array($expected)) {
            return $actual === $expected;
        }

        $a = $actual;
        $e = $expected;
        sort($a);
        sort($e);

        return $a === $e;
    }

    private function compareWithTolerance(mixed $actual, mixed $expected, float $epsilon): bool
    {
        if (is_array($expected)) {
            if (! is_array($actual) || count($actual) !== count($expected)) {
                return false;
            }

            foreach ($expected as $i => $expectedValue) {
                if (! $this->compareWithTolerance($actual[$i] ?? null, $expectedValue, $epsilon)) {
                    return false;
                }
            }

            return true;
        }

        if (is_numeric($expected) && is_numeric($actual)) {
            return abs((float) $actual - (float) $expected) <= $epsilon;
        }

        return $actual === $expected;
    }

    private function rejection(string $message): array
    {
        return [
            'body' => ['message' => $message],
            'status' => 422,
            'submissionStatus' => Submission::STATUS_COMPILE_ERROR,
            'runtimeMs' => null,
            'memoryKb' => null,
        ];
    }
}
