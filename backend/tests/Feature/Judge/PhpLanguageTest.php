<?php

namespace Tests\Feature\Judge;

use App\Models\Problem;
use App\Models\Submission;
use App\Services\JudgeService;
use App\Services\ProblemCodeGenerator\StarterCodeGenerator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Symfony\Component\Process\Process;
use Tests\TestCase;

/**
 * PHP is judged by the same pipeline as the other four languages, but its pieces are the ones
 * that differ (a two-file layout, errors on stderr, loose-typing normalisation), so these tests
 * run the REAL generated files. A stand-in "Piston" behind Http::fake() writes exactly the files
 * CodeExecutionService sent to disk and executes them with this machine's PHP binary (`-n`: no
 * php.ini, like the Piston package) — so the bootstrap, harness, literal emitter and verdict
 * logic are all exercised end to end without Docker. Sandbox limits (CPU/memory/wall) are
 * Piston's job and are covered by the live check in docs/scaling-the-judge.md.
 */
class PhpLanguageTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Cache::flush();
        config(['piston.nodes' => [['url' => 'http://piston-test:2000', 'slots' => 8]]]);

        Http::fake(['piston-test:2000/*' => fn (Request $request) => Http::response($this->runLocally($request['files']))]);
    }

    // ------------------------------------------------------------------ helpers

    /** @param list<array{name: string, content: string}> $files @return array<string, mixed> a Piston-shaped reply */
    private function runLocally(array $files): array
    {
        $dir = sys_get_temp_dir().DIRECTORY_SEPARATOR.'aptrun-php-'.bin2hex(random_bytes(4));
        mkdir($dir);
        foreach ($files as $file) {
            file_put_contents($dir.DIRECTORY_SEPARATOR.$file['name'], $file['content']);
        }

        $process = new Process([PHP_BINARY, '-n', $files[0]['name']], $dir);
        $process->setTimeout(30);
        $process->run();

        array_map('unlink', glob($dir.DIRECTORY_SEPARATOR.'*'));
        rmdir($dir);

        return [
            'compile' => null,
            'run' => ['stdout' => $process->getOutput(), 'stderr' => $process->getErrorOutput(), 'code' => $process->getExitCode(), 'signal' => null, 'cpu_time' => 5, 'memory' => 4096000],
        ];
    }

    /** @param list<array{inputs: array, expected: mixed}> $cases */
    private function problem(string $function, array $params, string $returnType, array $cases): Problem
    {
        $problem = Problem::create([
            'slug' => 'php-'.uniqid(),
            'title' => 'PHP test problem',
            'difficulty' => 'easy',
            'tags' => [],
            'description' => 'x',
            'function_name' => $function,
            'params' => $params,
            'return_type' => $returnType,
            'comparison_mode' => Problem::COMPARISON_EXACT,
            'display_order' => 1,
        ]);

        foreach ($cases as $i => $case) {
            $problem->testCases()->create(['inputs' => $case['inputs'], 'expected_output' => $case['expected'], 'is_sample' => $i < 3, 'display_order' => $i]);
        }

        return $problem;
    }

    private function twoSum(): Problem
    {
        return $this->problem('twoSum', [['name' => 'nums', 'type' => 'integer[]'], ['name' => 'target', 'type' => 'integer']], 'integer[]', [
            ['inputs' => ['nums' => [2, 7, 11, 15], 'target' => 9], 'expected' => [0, 1]],
            ['inputs' => ['nums' => [3, 2, 4], 'target' => 6], 'expected' => [1, 2]],
            ['inputs' => ['nums' => [-3, 4, 3, 90], 'target' => 0], 'expected' => [0, 2]],
        ]);
    }

    private function judge(Problem $problem, string $code): array
    {
        return app(JudgeService::class)->judge($problem, 'php', $code, $problem->testCases()->get());
    }

    private const TWO_SUM = <<<'PHP'
<?php

class Solution {
    public function twoSum($nums, $target) {
        $seen = [];
        foreach ($nums as $i => $n) {
            if (isset($seen[$target - $n])) {
                return [$seen[$target - $n], $i];
            }
            $seen[$n] = $i;
        }
        return [];
    }
}
PHP;

    // -------------------------------------------------------------------- wiring

    public function test_php_is_a_supported_language_everywhere_the_others_are(): void
    {
        $this->assertContains('php', JudgeService::SUPPORTED_LANGUAGES);
        $this->assertSame('php', config('piston.languages.php.piston_language'));
        $this->assertArrayHasKey('php', app(StarterCodeGenerator::class)->generateAll($this->twoSum()));
    }

    public function test_the_starter_code_is_leetcode_shaped_and_opens_with_the_php_tag(): void
    {
        $this->assertSame(<<<'PHP'
<?php

class Solution {
    /**
     * @param Integer[] $nums
     * @param Integer $target
     * @return Integer[]
     */
    public function twoSum($nums, $target) {
        // TODO: implement
        return [];
    }
}

PHP, app(StarterCodeGenerator::class)->generate($this->twoSum(), 'php'));
    }

    public function test_the_starter_code_is_valid_php_for_every_return_type(): void
    {
        $generator = app(StarterCodeGenerator::class);

        foreach (['integer', 'long', 'double', 'boolean', 'string', 'integer[]', 'double[]', 'boolean[]', 'string[]', 'integer[][]'] as $type) {
            $problem = $this->problem('solve', [['name' => 'value', 'type' => $type]], $type, [['inputs' => ['value' => $type === 'string' ? 'a' : ($type === 'boolean' ? true : 1)], 'expected' => 1]]);
            $source = $generator->generate($problem, 'php');

            $lint = new Process([PHP_BINARY, '-n', '-l'], null, null, $source);
            $lint->run();
            $this->assertTrue($lint->isSuccessful(), "starter for {$type} does not lint: ".$lint->getOutput().$lint->getErrorOutput());
        }
    }

    public function test_student_code_goes_in_its_own_file_and_the_open_tag_is_optional(): void
    {
        $problem = $this->twoSum();
        $withTag = "<?php\nclass Solution { }\n";
        $withoutTag = "class Solution { }\n";

        $this->judge($problem, $withTag);
        $this->judge($problem, $withoutTag);

        $sent = Http::recorded()->map(fn (array $pair) => $pair[0]['files']);
        $this->assertCount(2, $sent[0]);
        $this->assertSame(['main.php', 'solution.php'], array_column($sent[0], 'name'));
        $this->assertStringContainsString("require __DIR__ . '/solution.php'", $sent[0][0]['content'], 'the entry file loads the student file');
        $this->assertStringNotContainsString('class Solution', $sent[0][0]['content'], 'student code is not mixed into the entry file');

        $this->assertSame($withTag, $sent[0][1]['content'], 'a student who kept <?php is sent verbatim');
        // Same line: so a syntax error's line number is the one the student sees in the editor.
        $this->assertSame('<?php class Solution { }'."\n", $sent[1][1]['content']);
    }

    // ----------------------------------------------------------------- verdicts

    public function test_a_correct_solution_is_accepted(): void
    {
        $outcome = $this->judge($this->twoSum(), self::TWO_SUM);

        $this->assertSame(Submission::STATUS_ACCEPTED, $outcome['submissionStatus']);
        $this->assertTrue($outcome['body']['all_passed']);
        $this->assertCount(3, $outcome['body']['results']);
    }

    public function test_a_solution_that_works_without_the_open_tag_is_accepted(): void
    {
        $outcome = $this->judge($this->twoSum(), preg_replace('/^<\?php\s*/', '', self::TWO_SUM));

        $this->assertSame(Submission::STATUS_ACCEPTED, $outcome['submissionStatus']);
    }

    public function test_a_wrong_answer_shows_what_the_solution_printed(): void
    {
        $outcome = $this->judge($this->twoSum(), "<?php\nclass Solution { function twoSum(\$n, \$t) { return [9, 9]; } }");

        $this->assertSame(Submission::STATUS_WRONG_ANSWER, $outcome['submissionStatus']);
        $this->assertSame('[9,9]', $outcome['body']['results'][0]['actual']);
        $this->assertSame('[0,1]', $outcome['body']['results'][0]['expected']);
    }

    public function test_a_syntax_error_is_a_compile_error_that_points_at_the_students_line(): void
    {
        $code = "<?php\n\nclass Solution {\n    function twoSum(\$nums, \$target {\n        return [];\n    }\n}\n";

        $outcome = $this->judge($this->twoSum(), $code);

        $this->assertSame(Submission::STATUS_COMPILE_ERROR, $outcome['submissionStatus']);
        $this->assertStringContainsString('Parse error', $outcome['body']['compile_error']);
        $this->assertStringContainsString('solution.php on line 4', $outcome['body']['compile_error']);
        $this->assertSame([], $outcome['body']['results']);
    }

    public function test_a_syntax_error_line_is_right_even_when_the_student_deleted_the_open_tag(): void
    {
        $outcome = $this->judge($this->twoSum(), "class Solution {\n    function twoSum(\$nums, \$target {\n}\n");

        $this->assertSame(Submission::STATUS_COMPILE_ERROR, $outcome['submissionStatus']);
        $this->assertStringContainsString('on line 2', $outcome['body']['compile_error']);
    }

    public function test_an_uncaught_error_surfaces_its_message_not_a_bare_exit_code(): void
    {
        $outcome = $this->judge($this->twoSum(), "<?php\nthrow new RuntimeException('boom from top level');\n");

        $this->assertSame(Submission::STATUS_RUNTIME_ERROR, $outcome['submissionStatus']);
        $this->assertStringContainsString('boom from top level', $outcome['body']['runtime_error']);
    }

    public function test_a_missing_solution_class_says_so(): void
    {
        $outcome = $this->judge($this->twoSum(), "<?php\nclass NotSolution {}\n");

        $this->assertSame(Submission::STATUS_RUNTIME_ERROR, $outcome['submissionStatus']);
        $this->assertStringContainsString('Class "Solution" not found', $outcome['body']['runtime_error']);
    }

    public function test_one_case_throwing_does_not_lose_the_cases_after_it(): void
    {
        $problem = $this->problem('half', [['name' => 'n', 'type' => 'integer']], 'integer', [
            ['inputs' => ['n' => 4], 'expected' => 2],
            ['inputs' => ['n' => 0], 'expected' => 0],   // intdiv by zero below throws DivisionByZeroError
            ['inputs' => ['n' => 6], 'expected' => 3],
        ]);

        $outcome = $this->judge($problem, "<?php\nclass Solution { function half(\$n) { return \$n === 0 ? intdiv(1, \$n) : intdiv(\$n, 2); } }");

        $this->assertSame(Submission::STATUS_WRONG_ANSWER, $outcome['submissionStatus']);
        $results = $outcome['body']['results'];
        $this->assertTrue($results[0]['passed']);
        $this->assertFalse($results[1]['passed']);
        $this->assertSame('__RUNTIME_ERROR__', $results[1]['actual']);
        $this->assertTrue($results[2]['passed'], 'the case after the throwing one still ran and passed');
    }

    // ------------------------------------------- PHP-specific output hygiene

    public function test_stray_output_and_warnings_cannot_shift_the_per_case_lines(): void
    {
        // A demo call under the class, an echo inside the method, and an undefined-key warning:
        // all of which PHP CLI would otherwise print to stdout between the harness's lines.
        $code = <<<'PHP'
<?php
class Solution {
    public function twoSum($nums, $target) {
        $unused = $nums[99];
        echo "";
        $seen = [];
        foreach ($nums as $i => $n) {
            if (isset($seen[$target - $n])) { return [$seen[$target - $n], $i]; }
            $seen[$n] = $i;
        }
        return [];
    }
}
echo "debug: result is ", json_encode((new Solution)->twoSum([2, 7], 9)), "\n";
PHP;

        $outcome = $this->judge($this->twoSum(), $code);

        $this->assertSame(Submission::STATUS_ACCEPTED, $outcome['submissionStatus']);
    }

    public function test_floats_from_floor_and_friends_are_accepted_for_integer_problems(): void
    {
        $problem = $this->problem('isqrt', [['name' => 'x', 'type' => 'integer']], 'integer', [
            ['inputs' => ['x' => 8], 'expected' => 2],
            ['inputs' => ['x' => 16], 'expected' => 4],
            ['inputs' => ['x' => 0], 'expected' => 0],
        ]);

        // floor() returns float(2), not int(2) — the classic PHP trap. It must still be accepted
        // (json_encode prints it as `2`); pinned here so a harness change can't quietly break it.
        $outcome = $this->judge($problem, "<?php\nclass Solution { function isqrt(\$x) { return floor(sqrt(\$x)); } }");

        $this->assertSame(Submission::STATUS_ACCEPTED, $outcome['submissionStatus']);
    }

    public function test_a_genuinely_fractional_answer_for_an_integer_problem_still_fails(): void
    {
        $problem = $this->problem('half', [['name' => 'x', 'type' => 'integer']], 'integer', [
            ['inputs' => ['x' => 7], 'expected' => 3],
        ]);

        $outcome = $this->judge($problem, "<?php\nclass Solution { function half(\$x) { return \$x / 2; } }"); // 3.5

        $this->assertSame(Submission::STATUS_WRONG_ANSWER, $outcome['submissionStatus']);
        $this->assertSame('3.5', $outcome['body']['results'][0]['actual']);
    }

    public function test_arrays_that_lost_their_sequential_keys_are_still_lists(): void
    {
        $problem = $this->problem('evens', [['name' => 'nums', 'type' => 'integer[]']], 'integer[]', [
            ['inputs' => ['nums' => [1, 2, 3, 4]], 'expected' => [2, 4]],
            ['inputs' => ['nums' => [1, 3]], 'expected' => []],
        ]);

        // array_filter() keeps the original keys ([1 => 2, 3 => 4]) and would encode as an object.
        $outcome = $this->judge($problem, "<?php\nclass Solution { function evens(\$nums) { return array_filter(\$nums, fn(\$n) => \$n % 2 === 0); } }");

        $this->assertSame(Submission::STATUS_ACCEPTED, $outcome['submissionStatus']);
    }

    public function test_a_matrix_return_type_is_normalised_row_by_row(): void
    {
        $problem = $this->problem('positives', [['name' => 'grid', 'type' => 'integer[][]']], 'integer[][]', [
            ['inputs' => ['grid' => [[1, -2, 3], [-1, 4], [-5]]], 'expected' => [[1, 3], [4]]],
        ]);

        // Both the inner rows ([0 => 1, 2 => 3], [1 => 4]) and the outer array (the emptied row is
        // dropped, leaving keys 0 and 1 out of step with a fresh list) have gaps to repair.
        $code = "<?php\nclass Solution { function positives(\$grid) { return array_filter(array_map(fn(\$row) => array_filter(\$row, fn(\$v) => \$v > 0), \$grid)); } }";

        $outcome = $this->judge($problem, $code);

        $this->assertSame(Submission::STATUS_ACCEPTED, $outcome['submissionStatus'], json_encode($outcome['body']));
    }

    public function test_string_arguments_survive_php_quoting_intact(): void
    {
        // Every character that is special in a PHP double-quoted string or that JSON escapes
        // differently from PHP: `$`, `{$`, quotes, backslash, `/`, unicode, a newline, a closing PHP tag.
        $tricky = "cost: \$5 {\$x} 'single' \"double\" back\\slash a/b caf\u{e9} \u{1F600} line\nbreak ?> <?php";
        $problem = $this->problem('same', [['name' => 's', 'type' => 'string'], ['name' => 'parts', 'type' => 'string[]']], 'string', [
            ['inputs' => ['s' => $tricky, 'parts' => ['a$b', "it's"]], 'expected' => $tricky],
            ['inputs' => ['s' => '', 'parts' => []], 'expected' => ''],
        ]);

        $outcome = $this->judge($problem, "<?php\nclass Solution { function same(\$s, \$parts) { return \$s; } }");

        $this->assertSame(Submission::STATUS_ACCEPTED, $outcome['submissionStatus'], json_encode($outcome['body']));
    }

    public function test_every_argument_type_is_passed_with_the_right_php_type(): void
    {
        $problem = $this->problem('describe', [
            ['name' => 'i', 'type' => 'integer'], ['name' => 'l', 'type' => 'long'], ['name' => 'd', 'type' => 'double'],
            ['name' => 'b', 'type' => 'boolean'], ['name' => 'xs', 'type' => 'integer[]'], ['name' => 'ds', 'type' => 'double[]'],
            ['name' => 'bs', 'type' => 'boolean[]'], ['name' => 'grid', 'type' => 'integer[][]'],
        ], 'string', [
            ['inputs' => ['i' => -5, 'l' => 9000000000, 'd' => 2.0, 'b' => true, 'xs' => [1, -2], 'ds' => [0.5, 3.0], 'bs' => [true, false], 'grid' => [[1], [2, 3]]], 'expected' => 'integer,integer,double,boolean,integer[2],double[2],boolean[2],rows=2'],
        ]);

        $code = <<<'PHP'
<?php
class Solution {
    function describe($i, $l, $d, $b, $xs, $ds, $bs, $grid) {
        return implode(',', [gettype($i), gettype($l), gettype($d), gettype($b), 'integer[' . count($xs) . ']', 'double[' . count($ds) . ']', 'boolean[' . count($bs) . ']', 'rows=' . count($grid)]);
    }
}
PHP;

        $outcome = $this->judge($problem, $code);

        $this->assertSame(Submission::STATUS_ACCEPTED, $outcome['submissionStatus'], json_encode($outcome['body']));
    }
}
