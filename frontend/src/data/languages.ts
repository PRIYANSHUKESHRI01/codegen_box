import { SupportedLanguage } from "@/types/common";

/**
 * Exactly the 4 languages the real judge supports — backend/config/piston.php
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
    name: "Python",
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
];
