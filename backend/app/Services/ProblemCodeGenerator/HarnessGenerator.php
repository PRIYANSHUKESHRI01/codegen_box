<?php

namespace App\Services\ProblemCodeGenerator;

use App\Models\Problem;
use App\Models\ProblemTestCase;
use Illuminate\Support\Collection;
use InvalidArgumentException;

/**
 * Builds the driver code appended after the student's Solution — one call
 * per test case, each printing its result as canonical JSON on its own
 * line, so JudgeService can json_decode and structurally compare instead of
 * diffing raw stdout strings. Replaces the old per-problem hand-written
 * `test_harness` entirely: every problem gets this from just its
 * function_name/params/return_type + whichever test cases the caller
 * passes in (samples-only for Run, the full set for Submit — see
 * JudgeService).
 */
class HarnessGenerator
{
    /**
     * Lives inside the generated `public class Main` (not config/piston.php's
     * prelude) because Piston's single-file Java launcher picks the first
     * top-level class in the file as the entry point — nothing can precede
     * `public class Main` here. Fixed and shared across every problem;
     * mirrors the C++ toJson(...) overloads in config/piston.php's cpp
     * prelude, which face no such ordering constraint.
     */
    private const JAVA_JSON_HELPERS = <<<'JAVA'
    static String toJson(int v) { return String.valueOf(v); }
    static String toJson(long v) { return String.valueOf(v); }
    static String toJson(double v) { return String.valueOf(v); }
    static String toJson(boolean v) { return String.valueOf(v); }
    static String toJson(String v) {
        StringBuilder sb = new StringBuilder("\"");
        for (char c : v.toCharArray()) {
            if (c == '"' || c == '\\') sb.append('\\');
            sb.append(c);
        }
        sb.append("\"");
        return sb.toString();
    }
    static String toJson(int[] a) { StringBuilder sb = new StringBuilder("["); for (int i = 0; i < a.length; i++) { if (i > 0) sb.append(","); sb.append(toJson(a[i])); } sb.append("]"); return sb.toString(); }
    static String toJson(long[] a) { StringBuilder sb = new StringBuilder("["); for (int i = 0; i < a.length; i++) { if (i > 0) sb.append(","); sb.append(toJson(a[i])); } sb.append("]"); return sb.toString(); }
    static String toJson(double[] a) { StringBuilder sb = new StringBuilder("["); for (int i = 0; i < a.length; i++) { if (i > 0) sb.append(","); sb.append(toJson(a[i])); } sb.append("]"); return sb.toString(); }
    static String toJson(boolean[] a) { StringBuilder sb = new StringBuilder("["); for (int i = 0; i < a.length; i++) { if (i > 0) sb.append(","); sb.append(toJson(a[i])); } sb.append("]"); return sb.toString(); }
    static String toJson(String[] a) { StringBuilder sb = new StringBuilder("["); for (int i = 0; i < a.length; i++) { if (i > 0) sb.append(","); sb.append(toJson(a[i])); } sb.append("]"); return sb.toString(); }
    static String toJson(int[][] a) { StringBuilder sb = new StringBuilder("["); for (int i = 0; i < a.length; i++) { if (i > 0) sb.append(","); sb.append(toJson(a[i])); } sb.append("]"); return sb.toString(); }
JAVA;

    public function __construct(private readonly LiteralEmitter $literals) {}

    public function generate(Problem $problem, string $language, Collection $testCases): string
    {
        return match ($language) {
            'javascript' => $this->generateJs($problem, $testCases),
            'python' => $this->generatePython($problem, $testCases),
            'java' => $this->generateJava($problem, $testCases),
            'cpp' => $this->generateCpp($problem, $testCases),
            default => throw new InvalidArgumentException("Unsupported language: {$language}"),
        };
    }

    private function generateJs(Problem $problem, Collection $testCases): string
    {
        $lines = [];
        foreach ($testCases as $tc) {
            $args = implode(', ', $this->argLiterals($problem, $tc, 'javascript'));
            $lines[] = "console.log(JSON.stringify({$problem->function_name}({$args})));";
        }

        return implode("\n", $lines)."\n";
    }

    private function generatePython(Problem $problem, Collection $testCases): string
    {
        $lines = ['_sol = Solution()'];
        foreach ($testCases as $tc) {
            $args = implode(', ', $this->argLiterals($problem, $tc, 'python'));
            $lines[] = "print(json.dumps(_sol.{$problem->function_name}({$args})))";
        }

        return implode("\n", $lines)."\n";
    }

    private function generateJava(Problem $problem, Collection $testCases): string
    {
        $lines = ['public class Main {', self::JAVA_JSON_HELPERS, '', '    public static void main(String[] args) {', '        Solution sol = new Solution();'];
        foreach ($testCases as $tc) {
            $args = implode(', ', $this->argLiterals($problem, $tc, 'java'));
            $lines[] = "        System.out.println(toJson(sol.{$problem->function_name}({$args})));";
        }
        $lines[] = '    }';
        $lines[] = '}';

        return implode("\n", $lines)."\n";
    }

    /**
     * C++ needs one thing Java doesn't: array params are taken by reference
     * in the starter-code signature (`vector<int>& nums`), and a non-const
     * reference can't bind to a temporary — `sol.twoSum({2,7,11,15}, 9)`
     * simply doesn't compile. Each test case gets a braced block declaring
     * a named local for every array argument first, then calls through
     * those — braces give each case its own scope so the reused
     * `__argN` names across cases never collide.
     */
    private function generateCpp(Problem $problem, Collection $testCases): string
    {
        $params = $problem->params;
        $lines = ['int main() {', '    Solution sol;'];

        foreach ($testCases as $tc) {
            $lines[] = '    {';
            $callArgs = [];

            foreach ($params as $i => $p) {
                $literal = $this->literals->emit($tc->inputs[$p['name']], $p['type'], 'cpp');

                if (ProblemType::isArray($p['type'])) {
                    $varName = "__arg{$i}";
                    $lines[] = '        '.ProblemType::cppTypeName($p['type'])." {$varName} = {$literal};";
                    $callArgs[] = $varName;
                } else {
                    $callArgs[] = $literal;
                }
            }

            $args = implode(', ', $callArgs);
            $lines[] = "        cout << toJson(sol.{$problem->function_name}({$args})) << endl;";
            $lines[] = '    }';
        }

        $lines[] = '    return 0;';
        $lines[] = '}';

        return implode("\n", $lines)."\n";
    }

    /** @return string[] one literal per param, in declared order, for languages with no by-reference concerns. */
    private function argLiterals(Problem $problem, ProblemTestCase $tc, string $language): array
    {
        return array_map(
            fn ($p) => $this->literals->emit($tc->inputs[$p['name']], $p['type'], $language),
            $problem->params
        );
    }
}
