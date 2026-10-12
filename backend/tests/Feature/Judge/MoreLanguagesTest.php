<?php

namespace Tests\Feature\Judge;

use App\Models\Problem;
use App\Models\Submission;
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
 * TypeScript, Swift, Ruby, Dart, Scala, Elixir, Erlang, Racket and Python 2 — the languages added to match
 * LeetCode's picker. Same approach as NewLanguagesTest: everything that needs no toolchain is pinned here
 * (starter code, source literals, harness shape, file layout, how compiler output becomes a verdict), and
 * whether the programs really build and judge correctly is LiveLanguagesTest's job against real Piston nodes.
 */
class MoreLanguagesTest extends TestCase
{
    use RefreshDatabase;

    private const NINE = ['typescript', 'swift', 'ruby', 'dart', 'scala', 'elixir', 'erlang', 'racket', 'python2'];

    protected function setUp(): void
    {
        parent::setUp();

        Cache::flush();
        config(['piston.nodes' => [['url' => 'http://piston-test:2000', 'slots' => 8]]]);
    }

    private function problem(string $function, array $params, string $returnType, array $cases = []): Problem
    {
        $problem = Problem::create([
            'slug' => 'more-lang-'.uniqid(),
            'title' => 'More language test',
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

    /** @return list<array{name: string, content: string}> the files CodeExecutionService sent for $code in $language */
    private function filesSentFor(string $language, string $code): array
    {
        Http::fake(['piston-test:2000/*' => Http::response(['compile' => null, 'run' => ['stdout' => '', 'stderr' => '', 'code' => 0, 'signal' => null, 'cpu_time' => 5, 'memory' => 4096000]])]);

        $problem = $this->twoSum();
        app(JudgeService::class)->judge($problem, $language, $code, $problem->testCases()->get());

        return Http::recorded()->last()[0]['files'];
    }

    // ----------------------------------------------------------------- wiring

    public function test_every_language_is_supported_configured_and_offered(): void
    {
        $offered = array_keys(app(StarterCodeGenerator::class)->generateAll($this->twoSum()));

        foreach (self::NINE as $language) {
            $this->assertContains($language, JudgeService::SUPPORTED_LANGUAGES);
            $this->assertContains($language, $offered);
            $this->assertNotEmpty(config("piston.languages.{$language}.version"));
            $this->assertNotEmpty(config("piston.languages.{$language}.filename"));
        }

        $this->assertSame(19, count(JudgeService::SUPPORTED_LANGUAGES), "LeetCode's picker has 19 entries, and so does ours");
        $this->assertEqualsCanonicalizing(JudgeService::SUPPORTED_LANGUAGES, array_keys(config('piston.languages')));
        $this->assertSame(['python2', '2.7.18'], [config('piston.languages.python2.piston_language'), config('piston.languages.python2.version')]);
        $this->assertSame(['python', '3.10.0'], [config('piston.languages.python.piston_language'), config('piston.languages.python.version')], 'Python 3 is untouched: its id keeps saved drafts and past submissions valid');
    }

    public function test_method_names_follow_each_languages_convention(): void
    {
        $problem = $this->twoSum();
        $cases = $problem->testCases()->get();
        $harness = app(HarnessGenerator::class);

        $this->assertStringContainsString('two_sum([2, 7, 11, 15], 9)', $harness->generate($problem, 'ruby', $cases));
        $this->assertStringContainsString('Solution.two_sum([2, 7, 11, 15], 9)', $harness->generate($problem, 'elixir', $cases));
        $this->assertStringContainsString('two_sum([2, 7, 11, 15], 9)', $harness->generate($problem, 'erlang', $cases));
        $this->assertStringContainsString('(two-sum \'(2 7 11 15) 9)', $harness->generate($problem, 'racket', $cases));
        $this->assertStringContainsString('sol.twoSum([2, 7, 11, 15], 9)', $harness->generate($problem, 'swift', $cases));
        $this->assertStringContainsString('sol.twoSum([2, 7, 11, 15], 9)', $harness->generate($problem, 'dart', $cases));
        $this->assertStringContainsString('Solution.twoSum(Array[Int](2, 7, 11, 15), 9)', $harness->generate($problem, 'scala', $cases));
        $this->assertStringContainsString('JSON.stringify(twoSum([2,7,11,15], 9))', $harness->generate($problem, 'typescript', $cases));
        $this->assertStringContainsString('_sol.twoSum([2, 7, 11, 15], 9)', $harness->generate($problem, 'python2', $cases));

        $this->assertSame('two-sum', ProblemType::kebabCase('twoSum'));
        $this->assertSame('length-of-lis', ProblemType::kebabCase('lengthOfLIS'));
    }

    // ----------------------------------------------------------- starter code

    public function test_starter_code_follows_each_languages_leetcode_convention(): void
    {
        $generator = app(StarterCodeGenerator::class);
        $problem = $this->twoSum();

        $this->assertSame("function twoSum(nums: number[], target: number): number[] {\n    // TODO: implement\n    return [];\n}\n", $generator->generate($problem, 'typescript'));

        $this->assertSame(<<<'SWIFT'
class Solution {
    func twoSum(_ nums: [Int], _ target: Int) -> [Int] {
        // TODO: implement
        return []
    }
}

SWIFT, $generator->generate($problem, 'swift'));

        $this->assertSame(<<<'RUBY'
# @param {Integer[]} nums
# @param {Integer} target
# @return {Integer[]}
def two_sum(nums, target)
  # TODO: implement
  []
end

RUBY, $generator->generate($problem, 'ruby'));

        $this->assertSame(<<<'DART'
class Solution {
  List<int> twoSum(List<int> nums, int target) {
    // TODO: implement
    return [];
  }
}

DART, $generator->generate($problem, 'dart'));

        $this->assertSame(<<<'SCALA'
object Solution {
    def twoSum(nums: Array[Int], target: Int): Array[Int] = {
        // TODO: implement
        Array[Int]()
    }
}

SCALA, $generator->generate($problem, 'scala'));

        $this->assertSame(<<<'ELIXIR'
defmodule Solution do
  @spec two_sum(nums :: [integer], target :: integer) :: [integer]
  def two_sum(nums, target) do
    # TODO: implement
    []
  end
end

ELIXIR, $generator->generate($problem, 'elixir'));

        $this->assertSame(<<<'ERLANG'
-spec two_sum(Nums :: [integer()], Target :: integer()) -> [integer()].
two_sum(Nums, Target) ->
  % TODO: implement
  [].

ERLANG, $generator->generate($problem, 'erlang'));

        $this->assertSame(<<<'RACKET'
#lang racket

(define/contract (two-sum nums target)
  (-> (listof exact-integer?) exact-integer? (listof exact-integer?))
  ;; TODO: implement
  '())

RACKET, $generator->generate($problem, 'racket'));

        $this->assertSame(<<<'PYTHON'
class Solution(object):
    def twoSum(self, nums, target):
        """
        :type nums: List[int]
        :type target: int
        :rtype: List[int]
        """
        # TODO: implement
        pass

PYTHON, $generator->generate($problem, 'python2'));
    }

    public function test_starter_signatures_for_strings_matrices_and_other_return_shapes(): void
    {
        $generator = app(StarterCodeGenerator::class);
        $merge = $this->problem('mergeAll', [['name' => 'grid', 'type' => 'integer[][]'], ['name' => 'words', 'type' => 'string[]'], ['name' => 'label', 'type' => 'string'], ['name' => 'big', 'type' => 'long']], 'integer[][]');

        $this->assertStringContainsString('function mergeAll(grid: number[][], words: string[], label: string, big: number): number[][] {', $generator->generate($merge, 'typescript'));
        $this->assertStringContainsString('func mergeAll(_ grid: [[Int]], _ words: [String], _ label: String, _ big: Int) -> [[Int]] {', $generator->generate($merge, 'swift'));
        $this->assertStringContainsString("# @param {Integer[][]} grid\n# @param {String[]} words", $generator->generate($merge, 'ruby'));
        $this->assertStringContainsString('def merge_all(grid, words, label, big)', $generator->generate($merge, 'ruby'));
        $this->assertStringContainsString('List<List<int>> mergeAll(List<List<int>> grid, List<String> words, String label, int big) {', $generator->generate($merge, 'dart'));
        $this->assertStringContainsString('def mergeAll(grid: Array[Array[Int]], words: Array[String], label: String, big: Long): Array[Array[Int]] = {', $generator->generate($merge, 'scala'));
        $this->assertStringContainsString('Array[Array[Int]]()', $generator->generate($merge, 'scala'));
        $this->assertStringContainsString('@spec merge_all(grid :: [[integer]], words :: [String.t], label :: String.t, big :: integer) :: [[integer]]', $generator->generate($merge, 'elixir'));
        $this->assertStringContainsString('-spec merge_all(Grid :: [[integer()]], Words :: [unicode:unicode_binary()], Label :: unicode:unicode_binary(), Big :: integer()) -> [[integer()]].', $generator->generate($merge, 'erlang'));
        $this->assertStringContainsString('(-> (listof (listof exact-integer?)) (listof string?) string? exact-integer? (listof (listof exact-integer?)))', $generator->generate($merge, 'racket'));
        $this->assertStringContainsString("        :type words: List[str]\n", $generator->generate($merge, 'python2'));
        $this->assertStringContainsString('        :rtype: List[List[int]]', $generator->generate($merge, 'python2'));

        $isOk = $this->problem('isOk', [['name' => 's', 'type' => 'string']], 'boolean');
        $this->assertStringContainsString('func isOk(_ s: String) -> Bool {', $generator->generate($isOk, 'swift'));
        $this->assertStringContainsString('  bool isOk(String s) {', $generator->generate($isOk, 'dart'));
        $this->assertStringContainsString('def is_ok(s)', $generator->generate($isOk, 'ruby'));
        $this->assertStringContainsString('(define/contract (is-ok s)', $generator->generate($isOk, 'racket'));
        $this->assertStringContainsString('-spec is_ok(S :: unicode:unicode_binary()) -> boolean().', $generator->generate($isOk, 'erlang'));

        $ratio = $this->problem('ratio', [['name' => 'n', 'type' => 'integer']], 'double');
        $this->assertStringContainsString('  0.0', $generator->generate($ratio, 'ruby'));
        $this->assertStringContainsString('(-> exact-integer? flonum?)', $generator->generate($ratio, 'racket'));
        $this->assertStringContainsString('0.0', $generator->generate($ratio, 'erlang'));
    }

    // ------------------------------------------------------- source literals

    public function test_hostile_strings_become_valid_literals_in_each_language(): void
    {
        $lit = app(LiteralEmitter::class);
        $tricky = "a\$b {\$x} #{y} \"q\" 'sq' \\ / ~ \u{e9} \u{1F600}\nline\ttab\x01";
        $bs = fn (string $expected) => str_replace('^', chr(92), $expected); // ^ stands for a backslash, so these stay readable

        // `#{` is an interpolation in Ruby and Elixir, `$` a template in Dart; none accept JSON's `^/`;
        // each spells a code point its own way (Swift/Ruby/Dart/Elixir ^u{..}, Erlang ^x{..}, Scala a UTF-16 pair,
        // Racket ^U........); Python 2 is plain bytes.
        $this->assertSame($bs('"a$b {$x} #{y} ^"q^" \'sq\' ^^ / ~ ^u{E9} ^u{1F600}^nline^ttab^u{1}"'), $lit->emit($tricky, 'string', 'swift'));
        $this->assertSame($bs('"a$b {$x} ^#{y} ^"q^" \'sq\' ^^ / ~ ^u{E9} ^u{1F600}^nline^ttab^u{1}"'), $lit->emit($tricky, 'string', 'ruby'));
        $this->assertSame($bs('"a^$b {^$x} #{y} ^"q^" \'sq\' ^^ / ~ ^u{E9} ^u{1F600}^nline^ttab^u{1}"'), $lit->emit($tricky, 'string', 'dart'));
        $this->assertSame($bs('"a$b {$x} #{y} ^"q^" \'sq\' ^^ / ~ ^u00E9 ^uD83D^uDE00^nline^ttab^u0001"'), $lit->emit($tricky, 'string', 'scala'));
        $this->assertSame($bs('"a$b {$x} ^#{y} ^"q^" \'sq\' ^^ / ~ ^u{E9} ^u{1F600}^nline^ttab^u{1}"'), $lit->emit($tricky, 'string', 'elixir'));
        $this->assertSame($bs('<<"a$b {$x} #{y} ^"q^" \'sq\' ^^ / ~ ^x{E9} ^x{1F600}^nline^ttab^x{1}"/utf8>>'), $lit->emit($tricky, 'string', 'erlang'));
        $this->assertSame($bs('"a$b {$x} #{y} ^"q^" \'sq\' ^^ / ~ ^u00E9 ^U0001F600^nline^ttab^u0001"'), $lit->emit($tricky, 'string', 'racket'));
        $this->assertSame($bs('"a$b {$x} #{y} ^"q^" \'sq\' ^^ / ~ ^xc3^xa9 ^xf0^x9f^x98^x80^nline^ttab^x01"'), $lit->emit($tricky, 'string', 'python2'));

        foreach (['swift', 'ruby', 'dart', 'scala', 'elixir', 'erlang', 'racket', 'python2'] as $language) {
            $this->assertStringNotContainsString(chr(92).'/', $lit->emit('a/b', 'string', $language));
            $this->assertMatchesRegularExpression('/^[\x20-\x7e]*$/', $lit->emit($tricky, 'string', $language), "{$language} literal must be plain ASCII");
        }
    }

    public function test_every_value_shape_has_the_right_literal(): void
    {
        $lit = app(LiteralEmitter::class);

        foreach (['swift', 'ruby', 'dart', 'elixir', 'erlang'] as $language) {
            $this->assertSame('[1, -2, 3]', $lit->emit([1, -2, 3], 'integer[]', $language), $language);
            $this->assertSame('[[1, 2], [], [3]]', $lit->emit([[1, 2], [], [3]], 'integer[][]', $language), $language);
            $this->assertSame('[]', $lit->emit([], 'integer[]', $language), $language);
            $this->assertSame('[true, false]', $lit->emit([true, false], 'boolean[]', $language), $language);
            $this->assertSame('5000000000', $lit->emit(5000000000, 'long', $language), $language);
        }

        $this->assertSame('[<<"a"/utf8>>, <<"b"/utf8>>]', $lit->emit(['a', 'b'], 'string[]', 'erlang'), 'an Erlang string is a binary');
        $this->assertSame('[True, False]', $lit->emit([true, false], 'boolean[]', 'python2'));
        $this->assertSame('[1,-2,3]', $lit->emit([1, -2, 3], 'integer[]', 'typescript'));
        $this->assertSame('Array[Int](1, -2, 3)', $lit->emit([1, -2, 3], 'integer[]', 'scala'));
        $this->assertSame('Array[Array[Int]](Array[Int](1, 2), Array[Int](), Array[Int](3))', $lit->emit([[1, 2], [], [3]], 'integer[][]', 'scala'));
        $this->assertSame('Array[Long](5000000000L)', $lit->emit([5000000000], 'long[]', 'scala'));
        $this->assertSame('Array[Int]()', $lit->emit([], 'integer[]', 'scala'));
        $this->assertSame("'(1 -2 3)", $lit->emit([1, -2, 3], 'integer[]', 'racket'));
        $this->assertSame("'((1 2) () (3))", $lit->emit([[1, 2], [], [3]], 'integer[][]', 'racket'));
        $this->assertSame("'(\"a\" \"b\")", $lit->emit(['a', 'b'], 'string[]', 'racket'));
        $this->assertSame("'()", $lit->emit([], 'integer[]', 'racket'));
        $this->assertSame('#t', $lit->emit(true, 'boolean', 'racket'));

        // A whole-number double must still read as a double.
        foreach (['swift', 'ruby', 'dart', 'scala', 'elixir', 'erlang', 'racket', 'python2', 'typescript'] as $language) {
            $this->assertSame('2.0', $lit->emit(2.0, 'double', $language), $language);
        }
    }

    // --------------------------------------------------------- harness shape

    public function test_each_harness_isolates_cases_and_prints_the_shared_error_sentinel(): void
    {
        $problem = $this->twoSum();
        $cases = $problem->testCases()->get();
        $harness = app(HarnessGenerator::class);
        $sentinel = '__RUNTIME_ERROR__';

        $swift = $harness->generate($problem, 'swift', $cases);
        $this->assertSame(2, substr_count($swift, 'aptrunCase {'));
        $this->assertStringContainsString('fflush(stdout)', $swift, 'a later crash must not take earlier output with it (Swift cannot catch a trap)');
        $this->assertStringContainsString('extension Array: AptrunJson where Element: AptrunJson', $swift);

        $ruby = $harness->generate($problem, 'ruby', $cases);
        $this->assertSame(2, substr_count($ruby, 'rescue Exception'));
        $this->assertStringContainsString('$stdout.sync = true', $ruby);
        $this->assertStringContainsString($sentinel, $ruby);

        $dart = $harness->generate($problem, 'dart', $cases);
        $this->assertSame(2, substr_count($dart, 'catch (e)'));
        $this->assertStringContainsString('void main()', $dart);

        $scala = $harness->generate($problem, 'scala', $cases);
        $this->assertStringContainsString('@main def aptrunMain(): Unit', $scala, "Piston's Scala package finds the entry point by grepping for @main");
        $this->assertStringContainsString('case _: Throwable', $scala);

        $elixir = $harness->generate($problem, 'elixir', $cases);
        $this->assertSame(2, substr_count($elixir, 'run.(fn ->'));
        $this->assertStringContainsString('rescue', $elixir);
        $this->assertStringContainsString('catch', $elixir);

        $erlang = $harness->generate($problem, 'erlang', $cases);
        $this->assertStringContainsString('main(_) ->', $erlang);
        $this->assertSame(2, substr_count($erlang, 'aptrun_case(fun() ->'));
        $this->assertStringContainsString('catch _:_ ->', $erlang);

        $racket = $harness->generate($problem, 'racket', $cases);
        $this->assertSame(2, substr_count($racket, '(aptrun-case (lambda ()'));
        $this->assertStringContainsString('(flush-output)', $racket);
        $this->assertStringContainsString('(require json)', $racket);

        $python2 = $harness->generate($problem, 'python2', $cases);
        $this->assertSame(2, substr_count($python2, 'except BaseException:'));
        $this->assertSame(4, substr_count($python2, 'sys.stdout.flush()'));
    }

    // ------------------------------------------------- reserved-word parameters

    public function test_a_parameter_named_after_a_reserved_word_is_renamed_in_the_starter_code_only(): void
    {
        $generator = app(StarterCodeGenerator::class);
        $harness = app(HarnessGenerator::class);
        // path-with-maximum-probability has `end`; remove-element has `val` — fine in Java/C++/Python/JS, not in these.
        $edge = $this->problem('route', [['name' => 'start', 'type' => 'integer'], ['name' => 'end', 'type' => 'integer']], 'integer', [[['start' => 1, 'end' => 2], 3]]);
        $remove = $this->problem('removeElement', [['name' => 'nums', 'type' => 'integer[]'], ['name' => 'val', 'type' => 'integer']], 'integer', [[['nums' => [1, 2], 'val' => 2], 1]]);

        $this->assertStringContainsString('def route(start, end_)', $generator->generate($edge, 'ruby'));
        $this->assertStringContainsString('def route(start, end_) do', $generator->generate($edge, 'elixir'));
        $this->assertStringContainsString('fun removeElement(nums: IntArray, val_: Int): Int {', $generator->generate($remove, 'kotlin'));
        $this->assertStringContainsString('def removeElement(nums: Array[Int], val_: Int): Int = {', $generator->generate($remove, 'scala'));

        // Not reserved there, so untouched — including where the word is only reserved in *another* language.
        $this->assertStringContainsString('func route(start int, end int) int {', $generator->generate($edge, 'go'));
        $this->assertStringContainsString('public int Route(int start, int end) {', $generator->generate($edge, 'csharp'));
        $this->assertStringContainsString('(define/contract (route start end)', $generator->generate($edge, 'racket'));
        $this->assertStringContainsString('def removeElement(self, nums, val):', $generator->generate($remove, 'python2'));
        $this->assertStringContainsString('fun removeElement(nums: IntArray, val: Int)', str_replace('val_', 'val', $generator->generate($remove, 'kotlin')));

        // The harness passes arguments by position, so renaming changes nothing about how the function is called.
        $this->assertStringContainsString('Solution.route(1, 2)', $harness->generate($edge, 'elixir', $edge->testCases()->get()));
        $this->assertStringContainsString('route(1, 2)', $harness->generate($edge, 'ruby', $edge->testCases()->get()));

        $this->assertSame('end_', ProblemType::parameterName('end', 'ruby'));
        $this->assertSame('End_', ProblemType::parameterName('End', 'ruby'), 'compared in the case the language will use (End -> end)');
        $this->assertSame('end', ProblemType::parameterName('end', 'go'));
        $this->assertSame('anything', ProblemType::parameterName('anything', 'brainfuck'), 'a language with no list is left alone');
    }

    // ------------------------------------------- slashes and large integer arrays

    public function test_a_slash_in_test_data_is_written_as_a_plain_slash_in_every_json_style_language(): void
    {
        $lit = app(LiteralEmitter::class);

        // PHP's json_encode writes `/` as `\/` unless told not to: Java rejects that ("illegal escape character") and
        // Python keeps the backslash, so simplify-path would receive "\/a\/b" instead of "/a/b".
        foreach (['javascript', 'typescript', 'python', 'java', 'cpp'] as $language) {
            $this->assertSame('"/a/b/../c"', $lit->emit('/a/b/../c', 'string', $language), $language);
        }
    }

    public function test_a_large_integer_array_travels_as_text_in_the_languages_that_cannot_take_a_big_literal(): void
    {
        $lit = app(LiteralEmitter::class);
        $large = range(1, 300);
        $text = implode(',', $large);

        $calls = [
            'java' => "aptrunInts(\"{$text}\")", 'kotlin' => "aptrunInts(\"{$text}\")", 'swift' => "aptrunInts(\"{$text}\")", 'go' => "aptrunInts(\"{$text}\")",
            'scala' => "AptrunData.ints(\"{$text}\")", 'dart' => "aptrunInts([\"{$text}\"])", 'rust' => "aptrun_ints(&[\"{$text}\"])",
            'elixir' => "AptrunData.ints([\"{$text}\"])", 'erlang' => "aptrun_ints([\"{$text}\"])", 'racket' => "(aptrun-ints \"{$text}\")", 'python2' => "aptrun_ints(\"{$text}\")",
        ];
        foreach ($calls as $language => $expected) {
            $this->assertSame($expected, $lit->emit($large, 'integer[]', $language), $language);
        }

        // ...and as rows separated by `;` for a matrix (a small one is still a literal)
        $this->assertSame('arrayOf(intArrayOf(1,2),intArrayOf(3),intArrayOf(),intArrayOf(4,5,6))', $lit->emit([[1, 2], [3], [], [4, 5, 6]], 'integer[][]', 'kotlin'));
        $bigMatrix = array_fill(0, 150, [1, 2]);
        $this->assertStringStartsWith('aptrunIntMatrix("1,2;1,2;', $lit->emit($bigMatrix, 'integer[][]', 'kotlin'));
        $this->assertStringStartsWith('AptrunData.int_matrix(["1,2;1,2;', $lit->emit($bigMatrix, 'integer[][]', 'elixir'));

        // Small arrays and every other type stay ordinary literals, so normal generated code is unchanged.
        $this->assertSame('intArrayOf(1,2,3)', $lit->emit([1, 2, 3], 'integer[]', 'kotlin'));
        $this->assertSame('[1, 2, 3]', $lit->emit([1, 2, 3], 'integer[]', 'dart'));
        $this->assertStringStartsWith('longArrayOf(', $lit->emit(range(1, 300), 'long[]', 'kotlin'), 'only integer[] / integer[][] use the text path');

        // The languages that read a big literal without trouble keep it.
        foreach (['javascript', 'typescript', 'python', 'php', 'cpp', 'c', 'csharp', 'ruby'] as $language) {
            $this->assertStringNotContainsString('aptrun', $lit->emit($large, 'integer[]', $language), $language);
        }
    }

    public function test_text_chunks_are_exact_never_split_a_number_and_stay_small(): void
    {
        $lit = app(LiteralEmitter::class);
        $values = array_map(fn ($i) => 1000000 + $i * 7, range(0, 19999)); // 140,000 characters of digits
        $call = $lit->emit($values, 'integer[]', 'kotlin');

        preg_match_all('/"([^"]*)"/', $call, $matches);
        $chunks = $matches[1];

        $this->assertGreaterThan(3, count($chunks));
        $this->assertSame(implode(',', $values), implode('', $chunks), 'joining the chunks restores the exact text');
        foreach ($chunks as $i => $chunk) {
            $this->assertLessThan(31000, strlen($chunk), 'one string constant must stay under the class-file limit');
            $this->assertMatchesRegularExpression($i < count($chunks) - 1 ? '/^-?\d[\d,]*,$/' : '/^-?\d[\d,]*\d$/', $chunk, 'cut only after a separator, never inside a number');
        }
    }

    // --------------------------------------------------- file layout & verdicts

    public function test_erlang_student_code_is_its_own_module_that_the_harness_compiles_quietly(): void
    {
        $files = $this->filesSentFor('erlang', "two_sum(Nums, Target) ->\n  [].\n");

        $this->assertSame(['main.erl', 'solution.erl'], array_column($files, 'name'));
        $this->assertSame("-module(solution). -compile([export_all, nowarn_export_all]). two_sum(Nums, Target) ->\n  [].\n", $files[1]['content'], 'header on the same line, so error line numbers stay the student\'s own');
        $this->assertStringNotContainsString('two_sum(Nums, Target) ->', $files[0]['content'], 'the harness file never contains the student code');
        $this->assertStringContainsString('compile:file("solution.erl", [binary, return_errors])', $files[0]['content']);
        $this->assertStringContainsString('solution:two_sum([2, 7, 11, 15], 9)', $files[0]['content']);
        $this->assertStringContainsString('halt(3)', $files[0]['content'], 'a compile failure exits with the code config/piston.php reports as a compile error');
        $this->assertSame(3, config('piston.languages.erlang.syntax_error_exit_code'));
    }

    public function test_an_erlang_compile_failure_is_a_compile_error_with_the_compilers_message(): void
    {
        $problem = $this->twoSum();
        Http::fake(['piston-test:2000/*' => Http::response(['compile' => null, 'run' => ['stdout' => '', 'stderr' => "solution.erl:3: syntax error before: ')'\n", 'code' => 3, 'signal' => null, 'cpu_time' => 300, 'memory' => 4096000]])]);

        $outcome = app(JudgeService::class)->judge($problem, 'erlang', 'x', $problem->testCases()->get());

        $this->assertSame(Submission::STATUS_COMPILE_ERROR, $outcome['submissionStatus']);
        $this->assertStringContainsString("solution.erl:3: syntax error before: ')'", $outcome['body']['compile_error']);
    }

    public function test_racket_always_gets_a_lang_line_and_python2_declares_its_encoding(): void
    {
        $bare = $this->filesSentFor('racket', "(define (two-sum nums target) '())\n")[0]['content'];
        $this->assertStringStartsWith("#lang racket\n(define (two-sum", $bare);
        $this->assertSame(1, substr_count($bare, '#lang'));

        $own = $this->filesSentFor('racket', "#lang racket\n\n(define (two-sum nums target) '())\n")[0]['content'];
        $this->assertStringStartsWith("#lang racket\n\n(define (two-sum", $own);
        $this->assertSame(1, substr_count($own, '#lang'), 'a student who kept it is not given a second one');

        $python2 = $this->filesSentFor('python2', "class Solution(object):\n    pass\n")[0]['content'];
        $this->assertStringStartsWith("# -*- coding: utf-8 -*-\nimport json\nimport sys\n", $python2);
    }

    public function test_preludes_share_the_students_first_line_where_the_language_needs_imports_first(): void
    {
        $swift = $this->filesSentFor('swift', "class Solution {\n}\n")[0]['content'];
        $this->assertStringStartsWith('import Foundation; class Solution {', $swift);

        $dart = $this->filesSentFor('dart', "class Solution {\n}\n")[0]['content'];
        $this->assertStringStartsWith("import 'dart:convert'; import 'dart:math'; import 'dart:collection'; class Solution {", $dart);

        $this->assertSame('main.rkt', $this->filesSentFor('racket', 'x')[0]['name']);
        $this->assertSame(['main.ts'], array_column($this->filesSentFor('typescript', 'x'), 'name'));
    }

    public function test_swift_and_dart_compile_errors_are_told_apart_from_crashes(): void
    {
        $problem = $this->twoSum();
        $cases = $problem->testCases()->get();
        $judge = app(JudgeService::class);
        $run = fn (?int $code, string $stderr, ?string $signal = null) => ['compile' => null, 'run' => ['stdout' => '', 'stderr' => $stderr, 'code' => $code, 'signal' => $signal, 'cpu_time' => 900, 'memory' => 4096000]];

        Http::fake(['piston-test:2000/*' => Http::sequence()
            ->push($run(1, "/box/submission/main.swift:4:16: error: cannot find 'undefinedThing' in scope\n        return undefinedThing\n               ^~~~~~~~~~~~~\n"))
            ->push($run(null, "Fatal error: Index out of range: file Swift/ContiguousArrayBuffer.swift, line 580\n", 'SIGILL'))
            ->push($run(254, "main.dart:4:12: Error: Undefined name 'undefinedThing'.\n"))
            ->push($run(255, "Unhandled exception:\nRangeError (index): Invalid value: Not in inclusive range 0..2: 5\n#0 Solution.twoSum (file:///box/submission/main.dart:5:12)\n")),
        ]);

        $swiftSyntax = $judge->judge($problem, 'swift', 'x', $cases);
        $this->assertSame(Submission::STATUS_COMPILE_ERROR, $swiftSyntax['submissionStatus']);
        $this->assertStringContainsString("cannot find 'undefinedThing'", $swiftSyntax['body']['compile_error']);

        $swiftCrash = $judge->judge($problem, 'swift', 'x', $cases);
        $this->assertSame(Submission::STATUS_RUNTIME_ERROR, $swiftCrash['submissionStatus']);
        $this->assertStringContainsString('Index out of range', $swiftCrash['body']['runtime_error']);

        $dartSyntax = $judge->judge($problem, 'dart', 'x', $cases);
        $this->assertSame(Submission::STATUS_COMPILE_ERROR, $dartSyntax['submissionStatus']);
        $this->assertStringContainsString("Undefined name 'undefinedThing'", $dartSyntax['body']['compile_error']);

        $dartCrash = $judge->judge($problem, 'dart', 'x', $cases);
        $this->assertSame(Submission::STATUS_RUNTIME_ERROR, $dartCrash['submissionStatus']);
        $this->assertStringContainsString('RangeError', $dartCrash['body']['runtime_error']);
    }

    public function test_compiler_failures_of_scala_and_typescript_are_compile_errors_with_the_real_message(): void
    {
        $problem = $this->twoSum();
        $cases = $problem->testCases()->get();
        $judge = app(JudgeService::class);
        $failure = fn (string $stderr) => ['compile' => ['stdout' => '', 'stderr' => $stderr, 'output' => $stderr, 'code' => 1, 'signal' => null, 'cpu_time' => 800], 'run' => ['stdout' => '', 'stderr' => '', 'code' => 1, 'signal' => null]];
        $messages = [
            'typescript' => "main.ts.ts(3,12): error TS2304: Cannot find name 'undefinedThing'.",
            'scala' => "-- [E006] Not Found Error: main.scala:3:11\nNot found: undefinedThing",
        ];

        // (Http::fake() stubs don't override each other: first match wins. So one sequence, in order.)
        Http::fake(['piston-test:2000/*' => Http::sequence(array_map(fn ($m) => Http::response($failure($m)), array_values($messages)))]);

        foreach ($messages as $language => $message) {
            $outcome = $judge->judge($problem, $language, 'x', $cases);

            $this->assertSame(Submission::STATUS_COMPILE_ERROR, $outcome['submissionStatus'], $language);
            $this->assertSame($message, $outcome['body']['compile_error'], $language);
        }
    }
}
