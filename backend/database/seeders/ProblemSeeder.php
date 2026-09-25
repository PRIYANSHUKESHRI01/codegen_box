<?php

namespace Database\Seeders;

use App\Models\Problem;
use Illuminate\Database\Seeder;

/**
 * Seeds the initial DSA problem catalog for the Practice Arena. These are
 * five well-known, classic interview problems (one per major pattern:
 * hashing, stacks, interval sorting, sliding window, two pointers) spanning
 * all three difficulty tiers so the difficulty filter has real data to show.
 *
 * Structured function-signature + test-case format now — no hand-written
 * per-language starter_code/test_harness (see
 * App\Services\ProblemCodeGenerator, which generates both from just what's
 * below). Each problem's sample test cases match what used to be its only
 * `examples`; a couple of additional hidden-only cases are added per problem
 * so Submit's real hidden-suite grading has something beyond the samples to
 * actually test.
 */
class ProblemSeeder extends Seeder
{
    public function run(): void
    {
        foreach ($this->problems() as $spec) {
            $testCases = $spec['test_cases'];
            unset($spec['test_cases']);

            $problem = Problem::updateOrCreate(['slug' => $spec['slug']], $spec);

            $problem->testCases()->delete();
            foreach ($testCases as $index => $testCase) {
                $problem->testCases()->create([...$testCase, 'display_order' => $index]);
            }
        }
    }

    private function problems(): array
    {
        return [
            [
                'slug' => 'two-sum',
                'title' => 'Two Sum',
                'difficulty' => Problem::DIFFICULTY_EASY,
                'tags' => ['Array', 'Hash Table'],
                'description' => "Given an array of integers `nums` and an integer `target`, return the indices of the two numbers in `nums` that add up to `target`.\n\nYou may assume that each input has exactly one valid answer, and you may not use the same element twice. Return the answer in any order.",
                'function_name' => 'twoSum',
                'params' => [
                    ['name' => 'nums', 'type' => 'integer[]'],
                    ['name' => 'target', 'type' => 'integer'],
                ],
                'return_type' => 'integer[]',
                'constraints' => [
                    '2 <= nums.length <= 10^4',
                    '-10^9 <= nums[i] <= 10^9',
                    '-10^9 <= target <= 10^9',
                    'Only one valid answer exists.',
                ],
                'hints' => [
                    'A brute-force check of every pair takes O(n^2) time — can you do better by trading some space for speed?',
                    "As you scan the array, what if you remembered every number you'd already seen, along with its index?",
                    'For each number, check whether `target - number` was already seen. A hash map gives O(1) average lookups, so the whole scan runs in O(n) time.',
                ],
                'acceptance_rate' => 51.80,
                'total_submissions' => 284190,
                'display_order' => 1,
                'test_cases' => [
                    ['inputs' => ['nums' => [2, 7, 11, 15], 'target' => 9], 'expected_output' => [0, 1], 'explanation' => 'nums[0] + nums[1] == 9, so we return [0, 1].', 'is_sample' => true],
                    ['inputs' => ['nums' => [3, 2, 4], 'target' => 6], 'expected_output' => [1, 2], 'explanation' => 'nums[1] + nums[2] == 6, so we return [1, 2].', 'is_sample' => true],
                    ['inputs' => ['nums' => [3, 3], 'target' => 6], 'expected_output' => [0, 1], 'explanation' => null, 'is_sample' => true],
                    ['inputs' => ['nums' => [1, 5, 3, 7, 9, 2], 'target' => 11], 'expected_output' => [4, 5], 'explanation' => null, 'is_sample' => false],
                    ['inputs' => ['nums' => [-3, 4, 3, 90], 'target' => 0], 'expected_output' => [0, 2], 'explanation' => null, 'is_sample' => false],
                ],
            ],
            [
                'slug' => 'valid-parentheses',
                'title' => 'Valid Parentheses',
                'difficulty' => Problem::DIFFICULTY_EASY,
                'tags' => ['String', 'Stack'],
                'description' => "Given a string `s` containing just the characters `(`, `)`, `{`, `}`, `[` and `]`, determine if the input string is valid.\n\nA string is valid if:\n1. Every opening bracket is closed by the same type of bracket.\n2. Opening brackets are closed in the correct order.\n3. Every closing bracket has a matching, previously-unclosed opening bracket.",
                'function_name' => 'isValid',
                'params' => [
                    ['name' => 's', 'type' => 'string'],
                ],
                'return_type' => 'boolean',
                'constraints' => [
                    '1 <= s.length <= 10^4',
                    "s consists only of the characters '()[]{}'.",
                ],
                'hints' => [
                    "Think about which bracket needs to close first when brackets are nested — that's a last-in, first-out order.",
                    'Push every opening bracket onto a stack. When you hit a closing bracket, it must match whatever is on top of the stack.',
                    "The string is valid only if every closing bracket matched, and the stack is completely empty once you've processed the whole string.",
                ],
                'acceptance_rate' => 41.50,
                'total_submissions' => 312000,
                'display_order' => 2,
                'test_cases' => [
                    ['inputs' => ['s' => '()'], 'expected_output' => true, 'explanation' => null, 'is_sample' => true],
                    ['inputs' => ['s' => '()[]{}'], 'expected_output' => true, 'explanation' => null, 'is_sample' => true],
                    ['inputs' => ['s' => '(]'], 'expected_output' => false, 'explanation' => "The bracket types don't match.", 'is_sample' => true],
                    ['inputs' => ['s' => '([)]'], 'expected_output' => false, 'explanation' => 'The brackets close out of order.', 'is_sample' => true],
                    ['inputs' => ['s' => '((()))'], 'expected_output' => true, 'explanation' => null, 'is_sample' => false],
                    ['inputs' => ['s' => '((('], 'expected_output' => false, 'explanation' => null, 'is_sample' => false],
                ],
            ],
            [
                'slug' => 'merge-intervals',
                'title' => 'Merge Intervals',
                'difficulty' => Problem::DIFFICULTY_MEDIUM,
                'tags' => ['Array', 'Sorting'],
                'description' => 'Given an array of `intervals` where `intervals[i] = [starti, endi]`, merge all overlapping intervals and return an array of the non-overlapping intervals that cover all the intervals in the input.',
                'function_name' => 'merge',
                'params' => [
                    ['name' => 'intervals', 'type' => 'integer[][]'],
                ],
                'return_type' => 'integer[][]',
                'constraints' => [
                    '1 <= intervals.length <= 10^4',
                    'intervals[i].length == 2',
                    '0 <= starti <= endi <= 10^4',
                ],
                'hints' => [
                    'If the intervals were sorted by start time, any two intervals that overlap would end up next to each other.',
                    'Sort by start value first, then walk through once, merging the current interval into the last one you kept whenever they overlap.',
                    "Two intervals overlap when the next interval's start is less than or equal to the current merged interval's end.",
                ],
                'acceptance_rate' => 47.90,
                'total_submissions' => 165430,
                'display_order' => 3,
                'test_cases' => [
                    ['inputs' => ['intervals' => [[1, 3], [2, 6], [8, 10], [15, 18]]], 'expected_output' => [[1, 6], [8, 10], [15, 18]], 'explanation' => 'Intervals [1,3] and [2,6] overlap, so they merge into [1,6].', 'is_sample' => true],
                    ['inputs' => ['intervals' => [[1, 4], [4, 5]]], 'expected_output' => [[1, 5]], 'explanation' => 'Intervals [1,4] and [4,5] are considered overlapping since they touch at 4.', 'is_sample' => true],
                    ['inputs' => ['intervals' => [[1, 4]]], 'expected_output' => [[1, 4]], 'explanation' => null, 'is_sample' => false],
                    ['inputs' => ['intervals' => [[1, 4], [2, 3]]], 'expected_output' => [[1, 4]], 'explanation' => null, 'is_sample' => false],
                ],
            ],
            [
                'slug' => 'longest-substring-without-repeating-characters',
                'title' => 'Longest Substring Without Repeating Characters',
                'difficulty' => Problem::DIFFICULTY_MEDIUM,
                'tags' => ['Hash Table', 'String', 'Sliding Window'],
                'description' => 'Given a string `s`, find the length of the longest substring without duplicate characters.',
                'function_name' => 'lengthOfLongestSubstring',
                'params' => [
                    ['name' => 's', 'type' => 'string'],
                ],
                'return_type' => 'integer',
                'constraints' => [
                    '0 <= s.length <= 5 * 10^4',
                    's consists of English letters, digits, symbols and spaces.',
                ],
                'hints' => [
                    'A brute-force check of every substring is at least O(n^2) — try expanding and shrinking a window over the string instead.',
                    'Keep a window [left, right] that only ever contains unique characters, and track the last index each character was seen at with a hash map.',
                    "When you hit a character already inside the window, jump `left` forward to just past its previous occurrence, then keep extending `right` and tracking the largest window size seen.",
                ],
                'acceptance_rate' => 34.60,
                'total_submissions' => 231400,
                'display_order' => 4,
                'test_cases' => [
                    ['inputs' => ['s' => 'abcabcbb'], 'expected_output' => 3, 'explanation' => 'The answer is "abc", with length 3.', 'is_sample' => true],
                    ['inputs' => ['s' => 'bbbbb'], 'expected_output' => 1, 'explanation' => 'The answer is "b", with length 1.', 'is_sample' => true],
                    ['inputs' => ['s' => 'pwwkew'], 'expected_output' => 3, 'explanation' => 'The answer is "wke", with length 3. Note that "pwke" is a subsequence, not a substring.', 'is_sample' => true],
                    ['inputs' => ['s' => ''], 'expected_output' => 0, 'explanation' => null, 'is_sample' => false],
                    ['inputs' => ['s' => 'dvdf'], 'expected_output' => 3, 'explanation' => null, 'is_sample' => false],
                ],
            ],
            [
                'slug' => 'trapping-rain-water',
                'title' => 'Trapping Rain Water',
                'difficulty' => Problem::DIFFICULTY_HARD,
                'tags' => ['Array', 'Two Pointers', 'Dynamic Programming', 'Monotonic Stack'],
                'description' => 'Given `n` non-negative integers representing an elevation map where the width of each bar is 1, compute how much water it can trap after raining.',
                'function_name' => 'trap',
                'params' => [
                    ['name' => 'height', 'type' => 'integer[]'],
                ],
                'return_type' => 'integer',
                'constraints' => [
                    'n == height.length',
                    '1 <= n <= 2 * 10^4',
                    '0 <= height[i] <= 10^5',
                ],
                'hints' => [
                    'The water trapped above any bar is limited by the shorter of the tallest bar to its left and the tallest bar to its right.',
                    'Precompute the max height to the left and to the right of every index — the water trapped at index i is then min(leftMax[i], rightMax[i]) - height[i].',
                    'You can avoid the two extra arrays entirely with two pointers moving inward from both ends, always advancing the side with the smaller current max.',
                ],
                'acceptance_rate' => 61.20,
                'total_submissions' => 189400,
                'display_order' => 5,
                'test_cases' => [
                    ['inputs' => ['height' => [0, 1, 0, 2, 1, 0, 1, 3, 2, 1, 2, 1]], 'expected_output' => 6, 'explanation' => 'The elevation map traps 6 units of rain water between the bars.', 'is_sample' => true],
                    ['inputs' => ['height' => [4, 2, 0, 3, 2, 5]], 'expected_output' => 9, 'explanation' => null, 'is_sample' => true],
                    ['inputs' => ['height' => [1, 2, 3, 4, 5]], 'expected_output' => 0, 'explanation' => null, 'is_sample' => false],
                    ['inputs' => ['height' => [5]], 'expected_output' => 0, 'explanation' => null, 'is_sample' => false],
                ],
            ],
        ];
    }
}
