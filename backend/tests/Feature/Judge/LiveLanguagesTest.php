<?php

namespace Tests\Feature\Judge;

use App\Models\Problem;
use App\Models\Submission;
use App\Services\JudgeService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * The one test that proves a language really works end to end: a hand-written Two Sum goes through the real
 * pipeline against a REAL Piston node and must come back accepted, while a syntax error must not.
 *
 * Opt-in, because it needs the judge stack running (infra/judge) and every other test in this suite is hermetic:
 *
 *     PISTON_LIVE=1 php artisan test --filter=LiveLanguagesTest
 *
 * It uses the nodes in PISTON_NODES / PISTON_BASE_URL. A language whose runtime isn't installed on the node
 * is skipped with a message (run infra/judge/install-runtimes.sh) rather than failed.
 */
class LiveLanguagesTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Languages whose syntax errors reach the student as a compile error. JavaScript and Python report theirs
     * when the program runs, and so does Java: Piston runs it in source-launcher mode (`java Main.java`), which
     * compiles and runs in one step. PHP, Go, Swift, Dart and Erlang get there through our own handling (see
     * config/piston.php). Ruby, Elixir, Racket and Python 2 report a syntax error when the program runs, like
     * Python.
     */
    private const COMPILED = ['cpp', 'c', 'csharp', 'go', 'kotlin', 'rust', 'php', 'typescript', 'swift', 'dart', 'scala', 'erlang'];

    protected function setUp(): void
    {
        parent::setUp();

        if (! env('PISTON_LIVE')) {
            $this->markTestSkipped('Live judge test: set PISTON_LIVE=1 (needs the Piston nodes from infra/judge running).');
        }

        Cache::flush();
        // phpunit.xml pins nothing for Piston, so the nodes come from backend/.env exactly as the app sees them.
        config(['piston.http_timeout_seconds' => 120]);
    }

    /** @return array<string, array{string}> */
    public static function languages(): array
    {
        return array_combine(JudgeService::SUPPORTED_LANGUAGES, array_map(fn ($l) => [$l], JudgeService::SUPPORTED_LANGUAGES));
    }

    private function runtimeInstalled(string $language): bool
    {
        $wanted = config("piston.languages.{$language}");

        foreach (config('piston.nodes') as $node) {
            // A node that was just restarted can be slow to answer its first requests (Docker's port forwarding
            // settles), so ask a few times before giving up.
            $runtimes = Http::timeout(5)->retry(3, 1000)->get($node['url'].'/api/v2/runtimes')->json() ?? [];

            if (! collect($runtimes)->contains(fn ($r) => ($r['language'] ?? null) === $wanted['piston_language'] && ($r['version'] ?? null) === $wanted['version'])) {
                return false;
            }
        }

        return true;
    }

    #[DataProvider('languages')]
    public function test_a_correct_two_sum_is_accepted_and_a_syntax_error_is_not(string $language): void
    {
        if (! $this->runtimeInstalled($language)) {
            $this->markTestSkipped("{$language} is not installed on every configured Piston node — run infra/judge/install-runtimes.sh.");
        }

        $problem = Problem::create([
            'slug' => 'live-two-sum', 'title' => 'Two Sum', 'difficulty' => 'easy', 'tags' => [], 'description' => 'x',
            'function_name' => 'twoSum', 'params' => [['name' => 'nums', 'type' => 'integer[]'], ['name' => 'target', 'type' => 'integer']],
            'return_type' => 'integer[]', 'comparison_mode' => Problem::COMPARISON_EXACT, 'display_order' => 1,
        ]);
        foreach ([[[2, 7, 11, 15], 9, [0, 1]], [[3, 2, 4], 6, [1, 2]], [[3, 3], 6, [0, 1]], [[-1, -2, -3, -4, -5], -8, [2, 4]]] as $i => [$nums, $target, $expected]) {
            $problem->testCases()->create(['inputs' => ['nums' => $nums, 'target' => $target], 'expected_output' => $expected, 'is_sample' => $i < 3, 'display_order' => $i]);
        }
        $cases = $problem->testCases()->get();
        $judge = app(JudgeService::class);

        $accepted = $judge->judge($problem, $language, self::solution($language), $cases);
        $this->assertSame(Submission::STATUS_ACCEPTED, $accepted['submissionStatus'], json_encode($accepted['body'], JSON_PARTIAL_OUTPUT_ON_ERROR));

        $broken = $judge->judge($problem, $language, self::solution($language).")))\n", $cases);
        $this->assertNotSame(Submission::STATUS_ACCEPTED, $broken['submissionStatus']);
        $this->assertSame(
            in_array($language, self::COMPILED, true) ? Submission::STATUS_COMPILE_ERROR : Submission::STATUS_RUNTIME_ERROR,
            $broken['submissionStatus'],
            "{$language}: a syntax error should be reported as ".(in_array($language, self::COMPILED, true) ? 'a compile' : 'a runtime').' error'
        );
    }

    /** A correct Two Sum in each language, written the way a student would in the starter code's shape. */
    private static function solution(string $language): string
    {
        return match ($language) {
            'javascript' => "function twoSum(nums, target) {\n  const seen = new Map();\n  for (let i = 0; i < nums.length; i++) {\n    const j = seen.get(target - nums[i]);\n    if (j !== undefined) return [j, i];\n    seen.set(nums[i], i);\n  }\n  return [];\n}\n",
            'python' => "from typing import List\n\nclass Solution:\n    def twoSum(self, nums: List[int], target: int) -> List[int]:\n        seen = {}\n        for i, n in enumerate(nums):\n            if target - n in seen:\n                return [seen[target - n], i]\n            seen[n] = i\n        return []\n",
            'java' => "class Solution {\n    public int[] twoSum(int[] nums, int target) {\n        java.util.Map<Integer, Integer> m = new java.util.HashMap<>();\n        for (int i = 0; i < nums.length; i++) {\n            Integer j = m.get(target - nums[i]);\n            if (j != null) return new int[]{j, i};\n            m.put(nums[i], i);\n        }\n        return new int[]{};\n    }\n}\n",
            'cpp' => "class Solution {\npublic:\n    vector<int> twoSum(vector<int>& nums, int target) {\n        unordered_map<int, int> m;\n        for (int i = 0; i < (int)nums.size(); i++) {\n            auto it = m.find(target - nums[i]);\n            if (it != m.end()) return {it->second, i};\n            m[nums[i]] = i;\n        }\n        return {};\n    }\n};\n",
            'php' => "<?php\n\nclass Solution {\n    public function twoSum(\$nums, \$target) {\n        \$seen = [];\n        foreach (\$nums as \$i => \$n) {\n            if (isset(\$seen[\$target - \$n])) return [\$seen[\$target - \$n], \$i];\n            \$seen[\$n] = \$i;\n        }\n        return [];\n    }\n}\n",
            'c' => "int* twoSum(int* nums, int numsSize, int target, int* returnSize) {\n    for (int i = 0; i < numsSize; i++)\n        for (int j = i + 1; j < numsSize; j++)\n            if (nums[i] + nums[j] == target) {\n                int* r = malloc(2 * sizeof(int));\n                r[0] = i; r[1] = j; *returnSize = 2; return r;\n            }\n    *returnSize = 0;\n    return NULL;\n}\n",
            'go' => "package main\n\nfunc twoSum(nums []int, target int) []int {\n\tseen := map[int]int{}\n\tfor i, n := range nums {\n\t\tif j, ok := seen[target-n]; ok {\n\t\t\treturn []int{j, i}\n\t\t}\n\t\tseen[n] = i\n\t}\n\treturn nil\n}\n",
            'kotlin' => "class Solution {\n    fun twoSum(nums: IntArray, target: Int): IntArray {\n        val seen = HashMap<Int, Int>()\n        for ((i, n) in nums.withIndex()) {\n            val j = seen[target - n]\n            if (j != null) return intArrayOf(j, i)\n            seen[n] = i\n        }\n        return intArrayOf()\n    }\n}\n",
            'rust' => "use std::collections::HashMap;\n\nstruct Solution;\n\nimpl Solution {\n    pub fn two_sum(nums: Vec<i32>, target: i32) -> Vec<i32> {\n        let mut seen: HashMap<i32, usize> = HashMap::new();\n        for (i, &n) in nums.iter().enumerate() {\n            if let Some(&j) = seen.get(&(target - n)) {\n                return vec![j as i32, i as i32];\n            }\n            seen.insert(n, i);\n        }\n        vec![]\n    }\n}\n",
            'csharp' => "public class Solution {\n    public int[] TwoSum(int[] nums, int target) {\n        var seen = new Dictionary<int, int>();\n        for (int i = 0; i < nums.Length; i++) {\n            if (seen.TryGetValue(target - nums[i], out int j)) return new int[] { j, i };\n            seen[nums[i]] = i;\n        }\n        return new int[0];\n    }\n}\n",
            'typescript' => "function twoSum(nums: number[], target: number): number[] {\n    const seen = new Map<number, number>();\n    for (let i = 0; i < nums.length; i++) {\n        const j = seen.get(target - nums[i]);\n        if (j !== undefined) return [j, i];\n        seen.set(nums[i], i);\n    }\n    return [];\n}\n",
            'swift' => "class Solution {\n    func twoSum(_ nums: [Int], _ target: Int) -> [Int] {\n        var seen = [Int: Int]()\n        for (i, n) in nums.enumerated() {\n            if let j = seen[target - n] { return [j, i] }\n            seen[n] = i\n        }\n        return []\n    }\n}\n",
            'ruby' => "def two_sum(nums, target)\n  seen = {}\n  nums.each_with_index do |n, i|\n    return [seen[target - n], i] if seen.key?(target - n)\n    seen[n] = i\n  end\n  []\nend\n",
            'dart' => "class Solution {\n  List<int> twoSum(List<int> nums, int target) {\n    final seen = <int, int>{};\n    for (var i = 0; i < nums.length; i++) {\n      final j = seen[target - nums[i]];\n      if (j != null) return [j, i];\n      seen[nums[i]] = i;\n    }\n    return [];\n  }\n}\n",
            'scala' => "object Solution {\n  def twoSum(nums: Array[Int], target: Int): Array[Int] = {\n    val seen = scala.collection.mutable.HashMap[Int, Int]()\n    var i = 0\n    while (i < nums.length) {\n      seen.get(target - nums(i)) match {\n        case Some(j) => return Array(j, i)\n        case None => seen(nums(i)) = i\n      }\n      i += 1\n    }\n    Array[Int]()\n  }\n}\n",
            'elixir' => "defmodule Solution do\n  @spec two_sum(nums :: [integer], target :: integer) :: [integer]\n  def two_sum(nums, target) do\n    nums\n    |> Enum.with_index()\n    |> Enum.reduce_while(%{}, fn {n, i}, seen ->\n      case Map.fetch(seen, target - n) do\n        {:ok, j} -> {:halt, [j, i]}\n        :error -> {:cont, Map.put(seen, n, i)}\n      end\n    end)\n    |> case do\n      result when is_list(result) -> result\n      _ -> []\n    end\n  end\nend\n",
            'erlang' => "-spec two_sum(Nums :: [integer()], Target :: integer()) -> [integer()].\ntwo_sum(Nums, Target) ->\n  two_sum(Nums, Target, 0, #{}).\n\ntwo_sum([], _Target, _I, _Seen) -> [];\ntwo_sum([N | Rest], Target, I, Seen) ->\n  case maps:find(Target - N, Seen) of\n    {ok, J} -> [J, I];\n    error -> two_sum(Rest, Target, I + 1, Seen#{N => I})\n  end.\n",
            'racket' => "#lang racket\n\n(define/contract (two-sum nums target)\n  (-> (listof exact-integer?) exact-integer? (listof exact-integer?))\n  (let loop ([xs nums] [i 0] [seen (hash)])\n    (cond\n      [(null? xs) '()]\n      [(hash-has-key? seen (- target (car xs))) (list (hash-ref seen (- target (car xs))) i)]\n      [else (loop (cdr xs) (+ i 1) (hash-set seen (car xs) i))])))\n",
            'python2' => "class Solution(object):\n    def twoSum(self, nums, target):\n        seen = {}\n        for i, n in enumerate(nums):\n            if target - n in seen:\n                return [seen[target - n], i]\n            seen[n] = i\n        return []\n",
        };
    }
}
