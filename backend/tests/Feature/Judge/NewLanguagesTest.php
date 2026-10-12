<?php

namespace Tests\Feature\Judge;

use App\Models\Problem;
use App\Models\Submission;
use App\Services\CodeExecutionService;
use App\Services\JudgeService;
use App\Services\ProblemCodeGenerator\HarnessGenerator;
use App\Services\ProblemCodeGenerator\LiteralEmitter;
use App\Services\ProblemCodeGenerator\ProblemType;
use App\Services\ProblemCodeGenerator\StarterCodeGenerator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * C, C#, Go, Kotlin and Rust. Unlike PhpLanguageTest these can't execute the generated code locally
 * (nobody's laptop or CI has all five toolchains), so this pins down everything that does NOT need one:
 * the starter code each language shows, the source literals every test value becomes, the shape of each
 * generated harness, and how CodeExecutionService lays the files out and reads compiler output. Whether
 * the generated programs actually compile and judge correctly is checked against real Piston nodes by
 * LiveLanguagesTest (opt-in, PISTON_LIVE=1) and by the catalog-wide oracle run described in the docs.
 */
class NewLanguagesTest extends TestCase
{
    use RefreshDatabase;

    private const NEW = ['c', 'csharp', 'go', 'kotlin', 'rust'];

    protected function setUp(): void
    {
        parent::setUp();

        Cache::flush();
        config(['piston.nodes' => [['url' => 'http://piston-test:2000', 'slots' => 8]]]);
    }

    private function problem(string $function, array $params, string $returnType, array $cases = []): Problem
    {
        $problem = Problem::create([
            'slug' => 'new-lang-'.uniqid(),
            'title' => 'New language test',
            'difficulty' => 'easy',
            'tags' => [],
            'description' => 'x',
            'function_name' => $function,
            'params' => $params,
            'return_type' => $returnType,
            'comparison_mode' => Problem::COMPARISON_EXACT,
            'display_order' => 1,
        ]);

        foreach ($cases as $i => [$inputs, $expected]) {
            $problem->testCases()->create(['inputs' => $inputs, 'expected_output' => $expected, 'is_sample' => $i < 3, 'display_order' => $i]);
        }

        return $problem;
    }

    private function twoSum(): Problem
    {
        return $this->problem('twoSum', [['name' => 'nums', 'type' => 'integer[]'], ['name' => 'target', 'type' => 'integer']], 'integer[]', [
            [['nums' => [2, 7, 11, 15], 'target' => 9], [0, 1]],
            [['nums' => [3, 2, 4], 'target' => 6], [1, 2]],
        ]);
    }

    /** @return array<string, mixed> a Piston reply that ran and printed nothing (the verdict isn't what's under test) */
    private function pistonSilent(): array
    {
        return ['compile' => null, 'run' => ['stdout' => '', 'stderr' => '', 'code' => 0, 'signal' => null, 'cpu_time' => 5, 'memory' => 4096000]];
    }

    /** @return list<array{name: string, content: string}> the files CodeExecutionService sent for $code in $language */
    private function filesSentFor(string $language, string $code): array
    {
        Http::fake(['piston-test:2000/*' => Http::response($this->pistonSilent())]);

        $problem = $this->twoSum();
        app(JudgeService::class)->judge($problem, $language, $code, $problem->testCases()->get());

        return Http::recorded()->last()[0]['files'];
    }

    // ----------------------------------------------------------------- wiring

    public function test_every_new_language_is_supported_configured_and_offered(): void
    {
        $offered = array_keys(app(StarterCodeGenerator::class)->generateAll($this->twoSum()));

        $this->assertSame('javascript', $offered[0], 'JavaScript stays the language a student starts in');

        foreach (self::NEW as $language) {
            $this->assertContains($language, JudgeService::SUPPORTED_LANGUAGES);
            $this->assertContains($language, $offered);
            $this->assertNotEmpty(config("piston.languages.{$language}.version"));
            $this->assertNotEmpty(config("piston.languages.{$language}.filename"));
        }

        $this->assertSame(count(JudgeService::SUPPORTED_LANGUAGES), count(config('piston.languages')), 'the validation list and the Piston config must name the same languages');
        $this->assertEqualsCanonicalizing(JudgeService::SUPPORTED_LANGUAGES, $offered);
        $this->assertEqualsCanonicalizing(JudgeService::SUPPORTED_LANGUAGES, array_keys(config('piston.languages')));
    }

    public function test_every_language_can_generate_starter_and_harness_for_every_problem_type(): void
    {
        $generator = app(StarterCodeGenerator::class);
        $harness = app(HarnessGenerator::class);
        $values = [
            'integer' => 1, 'long' => 5000000000, 'double' => 1.5, 'boolean' => true, 'string' => 'abc',
            'integer[]' => [1, 2], 'long[]' => [5000000000], 'double[]' => [1.5], 'boolean[]' => [true], 'string[]' => ['a'], 'integer[][]' => [[1], [2, 3]],
        ];

        foreach (JudgeService::SUPPORTED_LANGUAGES as $language) {
            foreach (ProblemType::ALL as $type) {
                $problem = $this->problem('solve', [['name' => 'value', 'type' => $type]], $type, [[['value' => $values[$type]], $values[$type]]]);

                $this->assertNotSame('', $generator->generate($problem, $language), "{$language} starter for {$type}");
                $this->assertStringContainsStringIgnoringCase('solve', $harness->generate($problem, $language, $problem->testCases()->get()), "{$language} harness for {$type}");
            }
        }
    }

    // ------------------------------------------------------------ naming rules

    public function test_rust_uses_snake_case_and_csharp_pascal_case_method_names(): void
    {
        foreach (['twoSum' => 'two_sum', 'lengthOfLIS' => 'length_of_lis', 'getHTTPResponse' => 'get_http_response', 'maxProfit2' => 'max_profit2', 'isValid' => 'is_valid', 'solve' => 'solve', 'rob' => 'rob'] as $camel => $snake) {
            $this->assertSame($snake, ProblemType::snakeCase($camel));
        }
        $this->assertSame('TwoSum', ProblemType::pascalCase('twoSum'));

        $problem = $this->twoSum();
        $cases = $problem->testCases()->get();
        $harness = app(HarnessGenerator::class);
        $this->assertStringContainsString('Solution::two_sum(', $harness->generate($problem, 'rust', $cases));
        $this->assertStringContainsString('sol.TwoSum(', $harness->generate($problem, 'csharp', $cases));
        $this->assertStringContainsString('sol.twoSum(', $harness->generate($problem, 'kotlin', $cases));
        $this->assertStringContainsString('return twoSum(', $harness->generate($problem, 'go', $cases));
        $this->assertStringContainsString('twoSum(aptrun_a0, 4, 9, &aptrun_n)', $harness->generate($problem, 'c', $cases));
    }

    // ----------------------------------------------------------- starter code

    public function test_starter_code_follows_each_languages_leetcode_convention(): void
    {
        $generator = app(StarterCodeGenerator::class);
        $problem = $this->twoSum();

        $this->assertSame(<<<'C'
/**
 * Note: The returned array must be malloced, assume caller calls free().
 */
int* twoSum(int* nums, int numsSize, int target, int* returnSize) {
    // TODO: implement
    *returnSize = 0;
    return NULL;
}

C, $generator->generate($problem, 'c'));

        $this->assertSame("package main\n\nfunc twoSum(nums []int, target int) []int {\n\t// TODO: implement\n\treturn nil\n}\n", $generator->generate($problem, 'go'));

        $this->assertSame(<<<'KOTLIN'
class Solution {
    fun twoSum(nums: IntArray, target: Int): IntArray {
        // TODO: implement
        return intArrayOf()
    }
}

KOTLIN, $generator->generate($problem, 'kotlin'));

        $this->assertSame(<<<'RUST'
struct Solution;

impl Solution {
    pub fn two_sum(nums: Vec<i32>, target: i32) -> Vec<i32> {
        // TODO: implement
        vec![]
    }
}

RUST, $generator->generate($problem, 'rust'));

        $this->assertSame(<<<'CSHARP'
public class Solution {
    public int[] TwoSum(int[] nums, int target) {
        // TODO: implement
        return new int[0];
    }
}

CSHARP, $generator->generate($problem, 'csharp'));
    }

    public function test_starter_signatures_for_strings_matrices_and_other_return_shapes(): void
    {
        $generator = app(StarterCodeGenerator::class);
        $merge = $this->problem('merge', [['name' => 'grid', 'type' => 'integer[][]'], ['name' => 'words', 'type' => 'string[]'], ['name' => 'label', 'type' => 'string'], ['name' => 'big', 'type' => 'long']], 'integer[][]');

        $c = $generator->generate($merge, 'c');
        $this->assertStringContainsString('int** merge(int** grid, int gridSize, int* gridColSize, char** words, int wordsSize, char* label, long long big, int* returnSize, int** returnColumnSizes) {', $c);
        $this->assertStringContainsString('*returnColumnSizes = NULL;', $c);

        $this->assertStringContainsString('func merge(grid [][]int, words []string, label string, big int64) [][]int {', $generator->generate($merge, 'go'));
        $this->assertStringContainsString('fun merge(grid: Array<IntArray>, words: Array<String>, label: String, big: Long): Array<IntArray> {', $generator->generate($merge, 'kotlin'));
        $this->assertStringContainsString('return arrayOf<IntArray>()', $generator->generate($merge, 'kotlin'));
        $this->assertStringContainsString('pub fn merge(grid: Vec<Vec<i32>>, words: Vec<String>, label: String, big: i64) -> Vec<Vec<i32>> {', $generator->generate($merge, 'rust'));
        $this->assertStringContainsString('public int[][] Merge(int[][] grid, string[] words, string label, long big) {', $generator->generate($merge, 'csharp'));
        $this->assertStringContainsString('return new int[0][];', $generator->generate($merge, 'csharp'));

        $isOk = $this->problem('isOk', [['name' => 's', 'type' => 'string']], 'boolean');
        $this->assertStringContainsString("bool isOk(char* s) {\n    // TODO: implement\n    return false;", $generator->generate($isOk, 'c'));
        $this->assertStringContainsString('func isOk(s string) bool {', $generator->generate($isOk, 'go'));
        $this->assertStringContainsString('pub fn is_ok(s: String) -> bool {', $generator->generate($isOk, 'rust'));

        $name = $this->problem('name', [['name' => 'n', 'type' => 'integer']], 'string');
        $this->assertStringContainsString("        String::new()\n", $generator->generate($name, 'rust'));
        $this->assertStringContainsString('Note: a returned string must stay valid', $generator->generate($name, 'c'));

        $ratio = $this->problem('ratio', [['name' => 'n', 'type' => 'integer']], 'double[]');
        $this->assertStringContainsString('return doubleArrayOf()', $generator->generate($ratio, 'kotlin'));
        $this->assertStringContainsString('double* ratio(int n, int* returnSize)', $generator->generate($ratio, 'c'));
    }

    // ------------------------------------------------------- source literals

    public function test_hostile_strings_become_valid_ascii_only_literals_in_each_language(): void
    {
        $lit = app(LiteralEmitter::class);
        $tricky = "a\$b {\$x} \"q\" 'sq' \\ / ? ??/ \u{e9} \u{1F600}\nline\ttab\x01";
        $bs = fn (string $expected) => str_replace('~', chr(92), $expected); // ~ stands for a backslash, so these stay readable

        // `$` raw in Go/Rust/C# but escaped in Kotlin (string templates); `?` escaped in C (trigraphs);
        // non-ASCII as each language's own escape; and never JSON's `~/`, which none of them accept.
        $this->assertSame($bs('"a$b {$x} ~"q~" \'sq\' ~~ / ~? ~?~?/ ~303~251 ~360~237~230~200~nline~ttab~001"'), $lit->emit($tricky, 'string', 'c'));
        $this->assertSame($bs('"a$b {$x} ~"q~" \'sq\' ~~ / ? ??/ ~u00E9 ~U0001F600~nline~ttab~u0001"'), $lit->emit($tricky, 'string', 'go'));
        $this->assertSame($bs('"a~$b {~$x} ~"q~" \'sq\' ~~ / ? ??/ ~u00E9 ~uD83D~uDE00~nline~ttab~u0001"'), $lit->emit($tricky, 'string', 'kotlin'));
        $this->assertSame($bs('String::from("a$b {$x} ~"q~" \'sq\' ~~ / ? ??/ ~u{E9} ~u{1F600}~nline~ttab~u{1}")'), $lit->emit($tricky, 'string', 'rust'));
        $this->assertSame($bs('"a$b {$x} ~"q~" \'sq\' ~~ / ? ??/ ~u00E9 ~uD83D~uDE00~nline~ttab~u0001"'), $lit->emit($tricky, 'string', 'csharp'));

        foreach (self::NEW as $language) {
            $this->assertStringNotContainsString(chr(92).'/', $lit->emit('a/b', 'string', $language));
            $this->assertMatchesRegularExpression('/^[\x20-\x7e]*$/', $lit->emit($tricky, 'string', $language), "{$language} literal must be plain ASCII");
        }
    }

    public function test_every_value_shape_has_the_right_typed_literal(): void
    {
        $lit = app(LiteralEmitter::class);

        $this->assertSame('{1,-2,3}', $lit->emit([1, -2, 3], 'integer[]', 'c'));
        $this->assertSame('{5000000000LL,1LL}', $lit->emit([5000000000, 1], 'long[]', 'c'));
        $this->assertSame('[]int{1,-2,3}', $lit->emit([1, -2, 3], 'integer[]', 'go'));
        $this->assertSame('[]int64{int64(5000000000),int64(1)}', $lit->emit([5000000000, 1], 'long[]', 'go'));
        $this->assertSame('[][]int{[]int{1,2},[]int{},[]int{3}}', $lit->emit([[1, 2], [], [3]], 'integer[][]', 'go'));
        $this->assertSame('intArrayOf()', $lit->emit([], 'integer[]', 'kotlin'));
        $this->assertSame('longArrayOf(5000000000L,1L)', $lit->emit([5000000000, 1], 'long[]', 'kotlin'));
        $this->assertSame('doubleArrayOf(0.5,2.0)', $lit->emit([0.5, 2.0], 'double[]', 'kotlin'));
        $this->assertSame('booleanArrayOf(true,false)', $lit->emit([true, false], 'boolean[]', 'kotlin'));
        $this->assertSame('arrayOf<String>("a","b'.chr(92).'"c")', $lit->emit(['a', 'b"c'], 'string[]', 'kotlin'));
        $this->assertSame('arrayOf(intArrayOf(1,2),intArrayOf(),intArrayOf(3))', $lit->emit([[1, 2], [], [3]], 'integer[][]', 'kotlin'));
        $this->assertSame('9000000000L', $lit->emit(9000000000, 'long', 'kotlin'));
        $this->assertSame('vec![vec![1,2],vec![],vec![3]]', $lit->emit([[1, 2], [], [3]], 'integer[][]', 'rust'));
        $this->assertSame('vec![String::from("a"),String::from("b")]', $lit->emit(['a', 'b'], 'string[]', 'rust'));
        $this->assertSame('9000000000i64', $lit->emit(9000000000, 'long', 'rust'));
        $this->assertSame('new int[][] {new int[] {1,2},new int[] {},new int[] {3}}', $lit->emit([[1, 2], [], [3]], 'integer[][]', 'csharp'));
        $this->assertSame('new string[] {"a","b"}', $lit->emit(['a', 'b'], 'string[]', 'csharp'));
        $this->assertSame('9000000000L', $lit->emit(9000000000, 'long', 'csharp'));

        // A whole-number double must still read as a double, or `2` would be an int where a double is expected.
        foreach (self::NEW as $language) {
            $this->assertSame('2.0', $lit->emit(2.0, 'double', $language));
        }
    }

    // --------------------------------------------------------- harness shape

    public function test_each_harness_isolates_cases_and_prints_the_shared_error_sentinel(): void
    {
        $problem = $this->twoSum();
        $cases = $problem->testCases()->get();
        $harness = app(HarnessGenerator::class);

        $go = $harness->generate($problem, 'go', $cases);
        $this->assertSame(2, substr_count($go, 'aptrunCase(func() interface{} {'));
        $this->assertStringContainsString('recover()', $go);
        $this->assertStringContainsString('"__RUNTIME_ERROR__"', $go);
        $this->assertStringContainsString('reflect.MakeSlice', $go, 'a nil slice must print [], not null');

        $kotlin = $harness->generate($problem, 'kotlin', $cases);
        $this->assertSame(2, substr_count($kotlin, 'catch (t: Throwable)'));
        $this->assertStringContainsString('fun main()', $kotlin);

        $rust = $harness->generate($problem, 'rust', $cases);
        $this->assertSame(2, substr_count($rust, 'catch_unwind'));
        $this->assertStringContainsString('set_hook', $rust);

        $csharp = $harness->generate($problem, 'csharp', $cases);
        $this->assertSame(2, substr_count($csharp, 'catch (Exception)'));
        $this->assertStringContainsString('public static void Main()', $csharp);

        // C can't catch a crash, so what it must do instead is flush after every case.
        $c = $harness->generate($problem, 'c', $cases);
        $this->assertSame(2, substr_count($c, 'aptrun_end();'));
        $this->assertStringContainsString('fflush(stdout)', $c);
    }

    public function test_the_c_harness_lays_out_arrays_matrices_and_strings_the_way_the_starter_declares_them(): void
    {
        $problem = $this->problem('mix', [
            ['name' => 'grid', 'type' => 'integer[][]'], ['name' => 'words', 'type' => 'string[]'], ['name' => 'label', 'type' => 'string'],
            ['name' => 'flags', 'type' => 'boolean[]'], ['name' => 'big', 'type' => 'long'], ['name' => 'ratio', 'type' => 'double'],
        ], 'integer[][]', [
            [['grid' => [[1, 2], []], 'words' => ['x', 'y'], 'label' => 'hi', 'flags' => [true], 'big' => 5000000000, 'ratio' => 0.5], [[1]]],
            [['grid' => [], 'words' => [], 'label' => '', 'flags' => [], 'big' => 1, 'ratio' => 2.0], []],
        ]);

        $c = app(HarnessGenerator::class)->generate($problem, 'c', $problem->testCases()->get());

        // case 1: a matrix is rows + a pointer array + a column-size array; every empty row/array still has one slot
        $this->assertStringContainsString('int aptrun_a0r0[2] = {1,2};', $c);
        $this->assertStringContainsString('int aptrun_a0r1[1] = {0};', $c);
        $this->assertStringContainsString('int* aptrun_a0[2] = {aptrun_a0r0,aptrun_a0r1};', $c);
        $this->assertStringContainsString('int aptrun_a0c[2] = {2,0};', $c);
        $this->assertStringContainsString('char aptrun_a1e0[] = "x";', $c);
        $this->assertStringContainsString('char* aptrun_a1[2] = {aptrun_a1e0,aptrun_a1e1};', $c);
        $this->assertStringContainsString('char aptrun_a2[] = "hi";', $c);
        $this->assertStringContainsString('bool aptrun_a3[1] = {true};', $c);
        $this->assertStringContainsString('mix(aptrun_a0, 2, aptrun_a0c, aptrun_a1, 2, aptrun_a2, aptrun_a3, 1, 5000000000LL, 0.5, &aptrun_n, &aptrun_cols)', $c);
        $this->assertStringContainsString('aptrun_print_int_matrix(aptrun_r, aptrun_n, aptrun_cols);', $c);

        // case 2: every empty collection is still a valid declaration, and its length argument is 0
        $this->assertStringContainsString('int* aptrun_a0[1] = {NULL};', $c);
        $this->assertStringContainsString('char* aptrun_a1[1] = {NULL};', $c);
        $this->assertStringContainsString('mix(aptrun_a0, 0, aptrun_a0c, aptrun_a1, 0, aptrun_a2, aptrun_a3, 0, 1LL, 2.0, &aptrun_n, &aptrun_cols)', $c);
    }

    // --------------------------------------------------- file layout & limits

    public function test_c_gets_includes_and_a_line_directive_so_errors_use_the_students_line_numbers(): void
    {
        $files = $this->filesSentFor('c', "int* twoSum(int* nums, int numsSize, int target, int* returnSize) { return NULL; }\n");

        $this->assertCount(1, $files);
        $this->assertSame('main.c', $files[0]['name']);
        $this->assertStringContainsString('#include <stdlib.h>', $files[0]['content']);
        $this->assertStringContainsString("#line 1 \"solution.c\"\nint* twoSum(", $files[0]['content']);
    }

    public function test_csharp_and_rust_preludes_share_the_students_first_line_so_line_numbers_hold(): void
    {
        $csharp = $this->filesSentFor('csharp', "public class Solution {\n}\n")[0]['content'];
        $this->assertStringStartsWith('using System; using System.Collections.Generic; using System.Linq; using System.Text; public class Solution {', $csharp);

        $rust = $this->filesSentFor('rust', "struct Solution;\nimpl Solution {}\n")[0]['content'];
        $this->assertStringStartsWith('#![allow(warnings)] struct Solution;', $rust);
    }

    public function test_rust_gets_the_struct_when_only_the_impl_was_written_and_never_a_second_one(): void
    {
        $implOnly = $this->filesSentFor('rust', "impl Solution {\n    pub fn two_sum(nums: Vec<i32>, target: i32) -> Vec<i32> { vec![] }\n}\n")[0]['content'];
        $this->assertSame(1, substr_count($implOnly, 'struct Solution;'));

        $complete = $this->filesSentFor('rust', "pub struct Solution;\nimpl Solution {}\n")[0]['content'];
        $this->assertSame(0, substr_count($complete, "\nstruct Solution;"), 'a student who declared it is not given a duplicate');
        $this->assertStringContainsString('pub struct Solution;', $complete);
    }

    public function test_go_keeps_the_students_file_separate_and_adds_the_package_line_on_the_same_line(): void
    {
        $withPackage = "package main\n\nfunc twoSum(nums []int, target int) []int { return nil }\n";
        $files = $this->filesSentFor('go', $withPackage);

        $this->assertSame(['main.go', 'solution.go'], array_column($files, 'name'));
        $this->assertSame($withPackage, $files[1]['content'], 'kept verbatim when the student has their own package line');
        $this->assertStringStartsWith("package main\n\nimport (\n\t\"encoding/json\"", $files[0]['content']);
        $this->assertStringNotContainsString('func twoSum(nums', $files[0]['content'], 'the harness file never contains the student code');

        $this->assertSame('package main; import "sort"'."\n", $this->filesSentFor('go', "import \"sort\"\n")[1]['content']);
        $this->assertSame("// solution\npackage main\n", $this->filesSentFor('go', "// solution\npackage main\n")[1]['content'], 'a leading comment before package is still a package line');
        $this->assertSame("package solution\n", $this->filesSentFor('go', "package solution\n")[1]['content'], 'never rewrites a package the student chose (the compiler then explains the mismatch)');
    }

    public function test_per_language_limit_overrides_reach_piston_and_default_otherwise(): void
    {
        config([
            'piston.run_timeout_ms' => 7000, 'piston.compile_timeout_ms' => 15000, 'piston.run_cpu_time_ms' => 3000, 'piston.compile_cpu_time_ms' => 10000,
            'piston.languages.kotlin.run_timeout_ms' => 9000, 'piston.languages.kotlin.compile_cpu_time_ms' => 12345,
            'piston.languages.rust.run_timeout_ms' => null, 'piston.languages.rust.compile_cpu_time_ms' => null, 'piston.languages.rust.run_cpu_time_ms' => null, 'piston.languages.rust.compile_timeout_ms' => null,
        ]);
        Http::fake(['piston-test:2000/*' => Http::response($this->pistonSilent())]);
        $problem = $this->twoSum();
        $cases = $problem->testCases()->get();

        app(JudgeService::class)->judge($problem, 'kotlin', 'class Solution', $cases);
        app(JudgeService::class)->judge($problem, 'rust', 'struct Solution;', $cases);

        $sent = Http::recorded()->map(fn (array $pair) => $pair[0])->values();
        $this->assertSame(9000, $sent[0]['run_timeout']);
        $this->assertSame(12345, $sent[0]['compile_cpu_time']);
        $this->assertSame([7000, 15000, 3000, 10000], [$sent[1]['run_timeout'], $sent[1]['compile_timeout'], $sent[1]['run_cpu_time'], $sent[1]['compile_cpu_time']]);
        $this->assertSame(['kotlin', '1.8.20'], [$sent[0]['language'], $sent[0]['version']]);
        $this->assertSame(['rust', '1.68.2'], [$sent[1]['language'], $sent[1]['version']]);
    }

    // ------------------------------------------------ compiler output to verdict

    public function test_a_go_build_failure_is_a_compile_error_but_a_go_panic_is_a_runtime_error(): void
    {
        $problem = $this->twoSum();
        $cases = $problem->testCases()->get();
        $judge = app(JudgeService::class);
        $failedRun = fn (string $stderr) => ['compile' => null, 'run' => ['stdout' => '', 'stderr' => $stderr, 'code' => 2, 'signal' => null, 'cpu_time' => 900, 'memory' => 4096000]];

        Http::fake(['piston-test:2000/*' => Http::sequence()
            ->push($failedRun("# command-line-arguments\n./solution.go:4:9: undefined: undefinedThing\n"))
            ->push($failedRun("solution.go:3:8: package nosuchpkg is not in GOROOT (/piston/packages/go/1.16.2/go/src/nosuchpkg)\n"))
            ->push($failedRun("panic: runtime error: index out of range [3] with length 0\n\ngoroutine 1 [running]:\nmain.twoSum(...)\n\t/box/submission/solution.go:7\nexit status 2\n")),
        ]);

        $syntax = $judge->judge($problem, 'go', 'x', $cases);
        $this->assertSame(Submission::STATUS_COMPILE_ERROR, $syntax['submissionStatus']);
        $this->assertStringContainsString('./solution.go:4:9: undefined: undefinedThing', $syntax['body']['compile_error']);

        $badImport = $judge->judge($problem, 'go', 'x', $cases);
        $this->assertSame(Submission::STATUS_COMPILE_ERROR, $badImport['submissionStatus']);
        $this->assertStringContainsString('nosuchpkg', $badImport['body']['compile_error']);

        $panic = $judge->judge($problem, 'go', 'x', $cases);
        $this->assertSame(Submission::STATUS_RUNTIME_ERROR, $panic['submissionStatus']);
        $this->assertStringContainsString('index out of range', $panic['body']['runtime_error']);
    }

    public function test_compiler_failures_of_the_compiled_languages_are_compile_errors_with_the_real_message(): void
    {
        $problem = $this->twoSum();
        $cases = $problem->testCases()->get();
        $judge = app(JudgeService::class);
        $compileFailure = fn (string $stderr) => ['compile' => ['stdout' => '', 'stderr' => $stderr, 'output' => $stderr, 'code' => 1, 'signal' => null, 'cpu_time' => 800], 'run' => ['stdout' => '', 'stderr' => '', 'code' => 1, 'signal' => null]];

        $messages = [
            'c' => "solution.c:3:12: error: 'undefined_symbol' undeclared",
            'rust' => "error[E0308]: mismatched types\n --> main.rs:1:40",
            'csharp' => "main.cs(3,16): error CS0103: The name 'undefinedThing' does not exist in the current context",
            'kotlin' => 'main.kt.kt:3:16: error: unresolved reference: undefinedThing',
        ];

        // (Http::fake() stubs don't override each other: first match wins. So one sequence, in order.)
        Http::fake(['piston-test:2000/*' => Http::sequence(array_map(fn ($m) => Http::response($compileFailure($m)), array_values($messages)))]);

        foreach ($messages as $language => $message) {
            $outcome = $judge->judge($problem, $language, 'x', $cases);

            $this->assertSame(Submission::STATUS_COMPILE_ERROR, $outcome['submissionStatus'], $language);
            $this->assertSame($message, $outcome['body']['compile_error'], $language);
        }
    }

    public function test_a_c_crash_keeps_the_cases_that_finished_before_it(): void
    {
        $problem = $this->twoSum();
        Http::fake(['piston-test:2000/*' => Http::response(['compile' => null, 'run' => [
            'stdout' => "[0,1]\n", 'stderr' => '/piston/packages/gcc/10.2.0/run: line 6: 3 Segmentation fault', 'code' => 139, 'signal' => null, 'cpu_time' => 12, 'memory' => 1024000,
        ]])]);

        $outcome = app(JudgeService::class)->judge($problem, 'c', 'x', $problem->testCases()->get());

        $this->assertSame(Submission::STATUS_RUNTIME_ERROR, $outcome['submissionStatus']);
        $this->assertTrue($outcome['body']['results'][0]['passed']);
        $this->assertTrue($outcome['body']['results'][1]['not_run']);
        $this->assertStringContainsString('Segmentation fault', $outcome['body']['runtime_error']);
    }

    public function test_the_executor_rejects_a_language_it_has_no_config_for(): void
    {
        $this->expectExceptionMessage('Unsupported language for execution: cobol');

        app(CodeExecutionService::class)->run('cobol', 'x', 'y');
    }
}
