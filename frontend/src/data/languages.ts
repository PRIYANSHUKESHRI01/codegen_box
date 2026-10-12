import { SupportedLanguage } from "@/types/common";

/**
 * Exactly the 19 languages the real judge supports — backend/config/piston.php
 * is the single source of truth for versions; keep these in sync with it by
 * hand (there's no build-time link between the two). This used to also list
 * a fifth "Rust" entry that the judge has never actually supported — see
 * PublicController::stats()'s languages_total, which reads the real config
 * count so the landing page's Stats section can never silently drift out of
 * sync with this list again.
 */
export const LANGUAGES_DATA: SupportedLanguage[] = [
  {
    id: "cpp",
    name: "C++",
    version: "GCC 10.2.0",
    compiler: "g++ -O3",
    speedTier: "Fastest",
    popularity: "Most Popular in Contests",
    defaultSnippet: `#include <bits/stdc++.h>
using namespace std;

// Solution for Problem: Two Sum
class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        unordered_map<int, int> seen;
        for (int i = 0; i < (int)nums.size(); ++i) {
            int complement = target - nums[i];
            if (seen.count(complement)) {
                return {seen[complement], i};
            }
            seen[nums[i]] = i;
        }
        return {};
    }
};

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    
    Solution sol;
    vector<int> nums = {2, 7, 11, 15};
    int target = 9;
    vector<int> result = sol.twoSum(nums, target);
    
    cout << "[" << result[0] << ", " << result[1] << "]" << "\\n";
    return 0;
}`,
  },
  {
    id: "python",
    name: "Python3",
    version: "Python 3.10.0",
    compiler: "python3",
    speedTier: "Balanced",
    popularity: "Highest Readability",
    defaultSnippet: `from typing import List

class Solution:
    def twoSum(self, nums: List[int], target: int) -> List[int]:
        seen = {}
        for i, num in enumerate(nums):
            complement = target - num
            if complement in seen:
                return [seen[complement], i]
            seen[num] = i
        return []

if __name__ == "__main__":
    solution = Solution()
    print(solution.twoSum([2, 7, 11, 15], 9))
`,
  },
  {
    id: "java",
    name: "Java",
    version: "OpenJDK 15.0.2",
    compiler: "javac --release 15",
    speedTier: "Fast",
    popularity: "Standard Enterprise Choice",
    defaultSnippet: `import java.util.HashMap;
import java.util.Map;

class Solution {
    public int[] twoSum(int[] nums, int target) {
        Map<Integer, Integer> map = new HashMap<>();
        for (int i = 0; i < nums.length; i++) {
            int complement = target - nums[i];
            if (map.containsKey(complement)) {
                return new int[]{map.get(complement), i};
            }
            map.put(nums[i], i);
        }
        return new int[]{};
    }

    public static void main(String[] args) {
        Solution sol = new Solution();
        int[] res = sol.twoSum(new int[]{2, 7, 11, 15}, 9);
        System.out.println("[" + res[0] + ", " + res[1] + "]");
    }
}`,
  },
  {
    id: "javascript",
    name: "JavaScript",
    version: "Node.js 18.15.0",
    compiler: "node",
    speedTier: "Fast",
    popularity: "Full-Stack Native",
    defaultSnippet: `/**
 * @param {number[]} nums
 * @param {number} target
 * @return {number[]}
 */
function twoSum(nums, target) {
  const map = new Map();
  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];
    if (map.has(complement)) {
      return [map.get(complement), i];
    }
    map.set(nums[i], i);
  }
  return [];
}

console.log(twoSum([2, 7, 11, 15], 9));
`,
  },
  {
    id: "c",
    name: "C",
    version: "GCC 10.2.0",
    compiler: "gcc -std=c11",
    speedTier: "Fastest",
    popularity: "Closest to the Metal",
    defaultSnippet: `/**
 * Note: The returned array must be malloced, assume caller calls free().
 */
int* twoSum(int* nums, int numsSize, int target, int* returnSize) {
    for (int i = 0; i < numsSize; i++) {
        for (int j = i + 1; j < numsSize; j++) {
            if (nums[i] + nums[j] == target) {
                int* result = malloc(2 * sizeof(int));
                result[0] = i;
                result[1] = j;
                *returnSize = 2;
                return result;
            }
        }
    }
    *returnSize = 0;
    return NULL;
}
`,
  },
  {
    id: "csharp",
    name: "C#",
    version: "Mono 6.12.0",
    compiler: "csc",
    speedTier: "Fast",
    popularity: "Enterprise and Games",
    defaultSnippet: `public class Solution {
    public int[] TwoSum(int[] nums, int target) {
        var seen = new Dictionary<int, int>();
        for (int i = 0; i < nums.Length; i++) {
            if (seen.TryGetValue(target - nums[i], out int j)) {
                return new int[] { j, i };
            }
            seen[nums[i]] = i;
        }
        return new int[0];
    }
}
`,
  },
  {
    id: "go",
    name: "Go",
    version: "Go 1.16.2",
    compiler: "go run",
    speedTier: "Fast",
    popularity: "Cloud-Native Favourite",
    defaultSnippet: `package main

func twoSum(nums []int, target int) []int {
	seen := map[int]int{}
	for i, n := range nums {
		if j, ok := seen[target-n]; ok {
			return []int{j, i}
		}
		seen[n] = i
	}
	return nil
}
`,
  },
  {
    id: "kotlin",
    name: "Kotlin",
    version: "Kotlin 1.8.20",
    compiler: "kotlinc",
    speedTier: "Balanced",
    popularity: "Modern JVM",
    defaultSnippet: `class Solution {
    fun twoSum(nums: IntArray, target: Int): IntArray {
        val seen = HashMap<Int, Int>()
        for ((i, n) in nums.withIndex()) {
            val j = seen[target - n]
            if (j != null) return intArrayOf(j, i)
            seen[n] = i
        }
        return intArrayOf()
    }
}
`,
  },
  {
    id: "rust",
    name: "Rust",
    version: "Rust 1.68.2",
    compiler: "rustc",
    speedTier: "Fastest",
    popularity: "Memory-Safe Systems",
    defaultSnippet: `use std::collections::HashMap;

struct Solution;

impl Solution {
    pub fn two_sum(nums: Vec<i32>, target: i32) -> Vec<i32> {
        let mut seen: HashMap<i32, usize> = HashMap::new();
        for (i, &n) in nums.iter().enumerate() {
            if let Some(&j) = seen.get(&(target - n)) {
                return vec![j as i32, i as i32];
            }
            seen.insert(n, i);
        }
        vec![]
    }
}
`,
  },
  {
    id: "php",
    name: "PHP",
    version: "PHP 8.2.3",
    compiler: "php",
    speedTier: "Balanced",
    popularity: "Powers the Web",
    defaultSnippet: `<?php

class Solution {
    /**
     * @param Integer[] $nums
     * @param Integer $target
     * @return Integer[]
     */
    public function twoSum($nums, $target) {
        $seen = [];
        foreach ($nums as $i => $num) {
            $complement = $target - $num;
            if (isset($seen[$complement])) {
                return [$seen[$complement], $i];
            }
            $seen[$num] = $i;
        }
        return [];
    }
}
`,
  },
  {
    id: "typescript",
    name: "TypeScript",
    version: "TypeScript 5.0.3",
    compiler: "tsc --target es2020",
    speedTier: "Fast",
    popularity: "JavaScript, Typed",
    defaultSnippet: `function twoSum(nums: number[], target: number): number[] {
    const seen = new Map<number, number>();
    for (let i = 0; i < nums.length; i++) {
        const j = seen.get(target - nums[i]);
        if (j !== undefined) return [j, i];
        seen.set(nums[i], i);
    }
    return [];
}
`,
  },
  {
    id: "swift",
    name: "Swift",
    version: "Swift 5.3.3",
    compiler: "swift",
    speedTier: "Fast",
    popularity: "Apple Platforms",
    defaultSnippet: `class Solution {
    func twoSum(_ nums: [Int], _ target: Int) -> [Int] {
        var seen = [Int: Int]()
        for (i, n) in nums.enumerated() {
            if let j = seen[target - n] { return [j, i] }
            seen[n] = i
        }
        return []
    }
}
`,
  },
  {
    id: "ruby",
    name: "Ruby",
    version: "Ruby 3.0.1",
    compiler: "ruby",
    speedTier: "Balanced",
    popularity: "Developer Happiness",
    defaultSnippet: `def two_sum(nums, target)
  seen = {}
  nums.each_with_index do |n, i|
    return [seen[target - n], i] if seen.key?(target - n)
    seen[n] = i
  end
  []
end
`,
  },
  {
    id: "dart",
    name: "Dart",
    version: "Dart 2.19.6",
    compiler: "dart run",
    speedTier: "Fast",
    popularity: "Flutter's Language",
    defaultSnippet: `class Solution {
  List<int> twoSum(List<int> nums, int target) {
    final seen = <int, int>{};
    for (var i = 0; i < nums.length; i++) {
      final j = seen[target - nums[i]];
      if (j != null) return [j, i];
      seen[nums[i]] = i;
    }
    return [];
  }
}
`,
  },
  {
    id: "scala",
    name: "Scala",
    version: "Scala 3.2.2",
    compiler: "scalac",
    speedTier: "Balanced",
    popularity: "Functional on the JVM",
    defaultSnippet: `object Solution {
  def twoSum(nums: Array[Int], target: Int): Array[Int] = {
    val seen = scala.collection.mutable.HashMap[Int, Int]()
    var i = 0
    while (i < nums.length) {
      seen.get(target - nums(i)) match {
        case Some(j) => return Array(j, i)
        case None => seen(nums(i)) = i
      }
      i += 1
    }
    Array[Int]()
  }
}
`,
  },
  {
    id: "elixir",
    name: "Elixir",
    version: "Elixir 1.11.3",
    compiler: "elixir",
    speedTier: "Balanced",
    popularity: "Concurrency at Scale",
    defaultSnippet: `defmodule Solution do
  @spec two_sum(nums :: [integer], target :: integer) :: [integer]
  def two_sum(nums, target) do
    nums
    |> Enum.with_index()
    |> Enum.reduce_while(%{}, fn {n, i}, seen ->
      case Map.fetch(seen, target - n) do
        {:ok, j} -> {:halt, [j, i]}
        :error -> {:cont, Map.put(seen, n, i)}
      end
    end)
    |> case do
      result when is_list(result) -> result
      _ -> []
    end
  end
end
`,
  },
  {
    id: "erlang",
    name: "Erlang",
    version: "Erlang/OTP 23",
    compiler: "erlc",
    speedTier: "Balanced",
    popularity: "Telecom-Grade Reliability",
    defaultSnippet: `-spec two_sum(Nums :: [integer()], Target :: integer()) -> [integer()].
two_sum(Nums, Target) ->
  two_sum(Nums, Target, 0, #{}).

two_sum([], _Target, _I, _Seen) -> [];
two_sum([N | Rest], Target, I, Seen) ->
  case maps:find(Target - N, Seen) of
    {ok, J} -> [J, I];
    error -> two_sum(Rest, Target, I + 1, Seen#{N => I})
  end.
`,
  },
  {
    id: "racket",
    name: "Racket",
    version: "Racket 8.3.0",
    compiler: "racket",
    speedTier: "Balanced",
    popularity: "Language-Oriented Programming",
    defaultSnippet: `#lang racket

(define/contract (two-sum nums target)
  (-> (listof exact-integer?) exact-integer? (listof exact-integer?))
  (let loop ([xs nums] [i 0] [seen (hash)])
    (cond
      [(null? xs) '()]
      [(hash-has-key? seen (- target (car xs))) (list (hash-ref seen (- target (car xs))) i)]
      [else (loop (cdr xs) (+ i 1) (hash-set seen (car xs) i))])))
`,
  },
  {
    id: "python2",
    name: "Python (2.7)",
    version: "Python 2.7.18",
    compiler: "python2.7",
    speedTier: "Balanced",
    popularity: "Legacy Codebases",
    defaultSnippet: `class Solution(object):
    def twoSum(self, nums, target):
        seen = {}
        for i, n in enumerate(nums):
            if target - n in seen:
                return [seen[target - n], i]
            seen[n] = i
        return []
`,
  },
];
