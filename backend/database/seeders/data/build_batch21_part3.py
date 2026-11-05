# -*- coding: utf-8 -*-
"""
Batch 21 - Part 3: Problems 51 to 75 (Display Order 2056 to 2080)
Classic Data Structures, Greedy Algorithms, and Number Theory.
"""
import math

def get_part3_problems():
    problems = []

    # 51. Segment Tree Range Sum Query
    def solve_segment_tree_sum(nums, queries):
        arr = nums[:]
        res = []
        for q in queries:
            if q[0] == 1:
                arr[q[1]] = q[2]
            elif q[0] == 2:
                res.append(sum(arr[q[1]:q[2] + 1]))
        return res

    p51_cases = [
        {
            "inputs": {
                "nums": [1, 3, 5],
                "queries": [[2, 0, 2], [1, 1, 2], [2, 0, 2]]
            },
            "is_sample": True,
            "explanation": "Range sum [0, 2] is 1 + 3 + 5 = 9. Update index 1 to 2. Range sum [0, 2] is 1 + 2 + 5 = 8."
        },
        {
            "inputs": {
                "nums": [1, 2, 3, 4, 5],
                "queries": [[2, 1, 3], [1, 2, 10], [2, 1, 3]]
            },
            "is_sample": True,
            "explanation": "Sum is 2 + 3 + 4 = 9. After update, 2 + 10 + 4 = 16."
        },
        {
            "inputs": {
                "nums": [10],
                "queries": [[2, 0, 0], [1, 0, 20], [2, 0, 0]]
            },
            "is_sample": False,
            "explanation": None
        },
        {
            "inputs": {
                "nums": [5, -2, 3, -1, 4],
                "queries": [[2, 0, 4], [2, 1, 3], [1, 0, 0], [2, 0, 4]]
            },
            "is_sample": False,
            "explanation": None
        }
    ]
    for c in p51_cases:
        c["expected_output"] = solve_segment_tree_sum(c["inputs"]["nums"], c["inputs"]["queries"])

    problems.append({
        "slug": "segment-tree-sum",
        "title": "Segment Tree Range Sum Query",
        "difficulty": "medium",
        "tags": ["Segment Tree", "Array"],
        "companies": ["Google", "Amazon", "Microsoft"],
        "description": "Implement a Segment Tree to handle mutable array range sum queries.\n\nYou are given an integer array `nums` and a list of `queries` where each query is formatted as:\n- `[1, index, val]`: Point update `nums[index] = val` (0-based indexing).\n- `[2, left, right]`: Range query asking for the sum $\\sum_{i=left}^{right} nums[i]$ inclusive.\n\nReturn an array of results for all type 2 queries as 64-bit integers.\n\n### Constraints\n- `1 <= nums.length <= 10^5`\n- `1 <= queries.length <= 10^5`\n- `0 <= left <= right < nums.length`\n- `-10^9 <= nums[i], val <= 10^9`",
        "function_name": "segmentTreeSum",
        "params": [
            {"name": "nums", "type": "integer[]"},
            {"name": "queries", "type": "integer[][]"}
        ],
        "return_type": "long[]",
        "comparison_mode": "exact",
        "constraints": ["1 <= nums.length <= 10^5", "1 <= queries.length <= 10^5"],
        "hints": [
            "Build a binary segment tree in O(n) time.",
            "Point updates run in O(log n) time, and range sum queries run in O(log n) time."
        ],
        "acceptance_rate": 58.40,
        "total_submissions": 78200,
        "display_order": 2056,
        "test_cases": p51_cases
    })

    # 52. Segment Tree Range Minimum Query
    def solve_segment_tree_rmq(nums, queries):
        arr = nums[:]
        res = []
        for q in queries:
            if q[0] == 1:
                arr[q[1]] = q[2]
            elif q[0] == 2:
                res.append(min(arr[q[1]:q[2] + 1]))
        return res

    p52_cases = [
        {
            "inputs": {
                "nums": [3, 2, 4, 5, 1],
                "queries": [[2, 1, 4], [2, 0, 3], [1, 4, 10], [2, 1, 4]]
            },
            "is_sample": True,
            "explanation": "Min in [1, 4] is 1. Min in [0, 3] is 2. After update, min in [1, 4] is 2."
        },
        {
            "inputs": {
                "nums": [5, 4, 3, 2, 1],
                "queries": [[2, 0, 4], [1, 4, 10], [2, 0, 4]]
            },
            "is_sample": True,
            "explanation": "Initial min is 1. After update, min is 2."
        },
        {
            "inputs": {
                "nums": [100],
                "queries": [[2, 0, 0]]
            },
            "is_sample": False,
            "explanation": None
        },
        {
            "inputs": {
                "nums": [1, 5, 2, 6, 3, 7, 4],
                "queries": [[2, 1, 5], [1, 2, 10], [2, 1, 5]]
            },
            "is_sample": False,
            "explanation": None
        }
    ]
    for c in p52_cases:
        c["expected_output"] = solve_segment_tree_rmq(c["inputs"]["nums"], c["inputs"]["queries"])

    problems.append({
        "slug": "segment-tree-rmq",
        "title": "Segment Tree Range Minimum Query",
        "difficulty": "medium",
        "tags": ["Segment Tree", "Array"],
        "companies": ["Amazon", "Google", "Bloomberg"],
        "description": "Given an integer array `nums` and a sequence of `queries`, implement a Segment Tree supporting:\n- `[1, index, val]`: Update `nums[index] = val`.\n- `[2, left, right]`: Find the minimum value in `nums[left..right]` inclusive.\n\nReturn an array containing the answers to all type 2 queries in order.\n\n### Constraints\n- `1 <= nums.length <= 10^5`\n- `1 <= queries.length <= 10^5`",
        "function_name": "segmentTreeRMQ",
        "params": [
            {"name": "nums", "type": "integer[]"},
            {"name": "queries", "type": "integer[][]"}
        ],
        "return_type": "integer[]",
        "comparison_mode": "exact",
        "constraints": ["1 <= nums.length <= 10^5", "1 <= queries.length <= 10^5"],
        "hints": [
            "Each tree node stores the minimum of its left and right children.",
            "Both update and query operations take O(log n) time."
        ],
        "acceptance_rate": 59.20,
        "total_submissions": 69400,
        "display_order": 2057,
        "test_cases": p52_cases
    })

    # 53. Fenwick Tree Range Sum Queries
    def solve_fenwick(nums, queries):
        arr = nums[:]
        res = []
        for q in queries:
            if q[0] == 1:
                arr[q[1]] += q[2]
            elif q[0] == 2:
                res.append(sum(arr[q[1]:q[2] + 1]))
        return res

    p53_cases = [
        {
            "inputs": {
                "nums": [1, 2, 3, 4, 5],
                "queries": [[2, 0, 4], [1, 2, 5], [2, 0, 4], [2, 2, 2]]
            },
            "is_sample": True,
            "explanation": "Initial sum = 15. Add 5 to index 2 (now 8). New sum = 20. Element at 2 is 8."
        },
        {
            "inputs": {
                "nums": [10, 20],
                "queries": [[2, 0, 1], [1, 0, -5], [2, 0, 1]]
            },
            "is_sample": True,
            "explanation": "Initial sum 30, after subtracting 5, sum is 25."
        },
        {
            "inputs": {
                "nums": [0, 0, 0],
                "queries": [[1, 1, 10], [2, 0, 2]]
            },
            "is_sample": False,
            "explanation": None
        }
    ]
    for c in p53_cases:
        c["expected_output"] = solve_fenwick(c["inputs"]["nums"], c["inputs"]["queries"])

    problems.append({
        "slug": "fenwick-tree-sum",
        "title": "Fenwick Tree Range Sum Queries",
        "difficulty": "medium",
        "tags": ["Binary Indexed Tree", "Array"],
        "companies": ["Google", "Bloomberg", "Salesforce"],
        "description": "Implement a Binary Indexed Tree (Fenwick Tree) to maintain prefix sums under dynamic point updates.\n\nYou are given `nums` and a list of `queries`:\n- `[1, index, delta]`: Add `delta` to `nums[index]` (0-based indexing).\n- `[2, left, right]`: Query range sum from `left` to `right` inclusive.\n\nReturn an array of answers for all type 2 queries as 64-bit integers.\n\n### Constraints\n- `1 <= nums.length <= 10^5`\n- `1 <= queries.length <= 10^5`",
        "function_name": "fenwickTreeQueries",
        "params": [
            {"name": "nums", "type": "integer[]"},
            {"name": "queries", "type": "integer[][]"}
        ],
        "return_type": "long[]",
        "comparison_mode": "exact",
        "constraints": ["1 <= nums.length <= 10^5", "1 <= queries.length <= 10^5"],
        "hints": [
            "Use 1-based indexing for the BIT array: bit[i] covers range (i - (i & -i), i].",
            "Range sum [L, R] = query(R) - query(L - 1)."
        ],
        "acceptance_rate": 61.10,
        "total_submissions": 54200,
        "display_order": 2058,
        "test_cases": p53_cases
    })

    # 54. Disjoint Set Union Connected Components
    def solve_dsu(n, edges):
        parent = list(range(n))
        rank = [0] * n
        components = n

        def find(i):
            if parent[i] == i:
                return i
            parent[i] = find(parent[i])
            return parent[i]

        def union(i, j):
            nonlocal components
            ri, rj = find(i), find(j)
            if ri != rj:
                if rank[ri] < rank[rj]:
                    ri, rj = rj, ri
                parent[rj] = ri
                if rank[ri] == rank[rj]:
                    rank[ri] += 1
                components -= 1

        for u, v in edges:
            union(u, v)
        return components

    p54_cases = [
        {
            "inputs": {
                "n": 5,
                "edges": [[0, 1], [1, 2], [3, 4]]
            },
            "is_sample": True,
            "explanation": "2 connected components: {0, 1, 2} and {3, 4}."
        },
        {
            "inputs": {
                "n": 5,
                "edges": [[0, 1], [1, 2], [2, 3], [3, 4]]
            },
            "is_sample": True,
            "explanation": "All 5 nodes connected in 1 component."
        },
        {
            "inputs": {
                "n": 4,
                "edges": []
            },
            "is_sample": False,
            "explanation": None
        },
        {
            "inputs": {
                "n": 6,
                "edges": [[0, 1], [0, 2], [1, 2], [3, 4]]
            },
            "is_sample": False,
            "explanation": None
        }
    ]
    for c in p54_cases:
        c["expected_output"] = solve_dsu(c["inputs"]["n"], c["inputs"]["edges"])

    problems.append({
        "slug": "disjoint-set-union",
        "title": "Disjoint Set Union Connected Components",
        "difficulty": "medium",
        "tags": ["Union Find", "Graph"],
        "companies": ["Amazon", "Microsoft", "Facebook"],
        "description": "Given `n` nodes labeled `0` to `n - 1` and an array of undirected `edges` where `edges[i] = [u, v]`.\n\nFind the number of connected components in the graph using Disjoint Set Union (DSU) with union by rank and path compression.\n\n### Constraints\n- `1 <= n <= 10^5`\n- `0 <= edges.length <= 2 * 10^5`",
        "function_name": "countComponentsDSU",
        "params": [
            {"name": "n", "type": "integer"},
            {"name": "edges", "type": "integer[][]"}
        ],
        "return_type": "integer",
        "comparison_mode": "exact",
        "constraints": ["1 <= n <= 10^5", "0 <= edges.length <= 200000"],
        "hints": [
            "Start with n components.",
            "For each edge (u, v), find roots of u and v. If roots differ, merge them and decrease the component count by 1."
        ],
        "acceptance_rate": 66.40,
        "total_submissions": 78900,
        "display_order": 2059,
        "test_cases": p54_cases
    })

    # 55. Static Range Sum Queries
    def solve_static_range_sum(nums, queries):
        prefix = [0]
        for x in nums:
            prefix.append(prefix[-1] + x)
        return [prefix[r + 1] - prefix[l] for l, r in queries]

    p55_cases = [
        {
            "inputs": {
                "nums": [3, 2, 4, 5, 1, 1, 5, 3],
                "queries": [[1, 4], [4, 4], [0, 7]]
            },
            "is_sample": True,
            "explanation": "Sums are 2+4+5+1 = 12, 1 = 1, and total sum = 24."
        },
        {
            "inputs": {
                "nums": [1, 2, 3],
                "queries": [[0, 0], [1, 1], [2, 2], [0, 2]]
            },
            "is_sample": True,
            "explanation": "[1, 2, 3, 6]."
        },
        {
            "inputs": {
                "nums": [1000000000, 1000000000],
                "queries": [[0, 1]]
            },
            "is_sample": False,
            "explanation": None
        }
    ]
    for c in p55_cases:
        c["expected_output"] = solve_static_range_sum(c["inputs"]["nums"], c["inputs"]["queries"])

    problems.append({
        "slug": "static-range-sum-queries",
        "title": "Static Range Sum Queries",
        "difficulty": "easy",
        "tags": ["Prefix Sum", "Array"],
        "companies": ["Amazon", "Microsoft", "TCS"],
        "description": "Given an array `nums` of `n` integers and `q` queries of the form `[left, right]`.\n\nCalculate the sum of elements in the range `nums[left..right]` (0-based inclusive) for each query in $O(1)$ time using prefix sums.\n\nReturn an array of results as 64-bit integers.\n\n### Constraints\n- `1 <= nums.length <= 10^5`\n- `1 <= queries.length <= 10^5`\n- `-10^9 <= nums[i] <= 10^9`",
        "function_name": "staticRangeSum",
        "params": [
            {"name": "nums", "type": "integer[]"},
            {"name": "queries", "type": "integer[][]"}
        ],
        "return_type": "long[]",
        "comparison_mode": "exact",
        "constraints": ["1 <= nums.length <= 10^5", "1 <= queries.length <= 10^5"],
        "hints": [
            "Compute prefix[i] = nums[0] + ... + nums[i - 1].",
            "Range sum is prefix[right + 1] - prefix[left]."
        ],
        "acceptance_rate": 81.20,
        "total_submissions": 98400,
        "display_order": 2060,
        "test_cases": p55_cases
    })

    # 56. Static Range Minimum Queries (Sparse Table)
    def solve_static_rmq(nums, queries):
        n = len(nums)
        if n == 0:
            return []
        log_n = n.bit_length()
        st = [[0] * log_n for _ in range(n)]

        for i in range(n):
            st[i][0] = nums[i]

        j = 1
        while (1 << j) <= n:
            i = 0
            while (i + (1 << j) - 1) < n:
                st[i][j] = min(st[i][j - 1], st[i + (1 << (j - 1))][j - 1])
                i += 1
            j += 1

        res = []
        for l, r in queries:
            k = (r - l + 1).bit_length() - 1
            res.append(min(st[l][k], st[r - (1 << k) + 1][k]))
        return res

    p56_cases = [
        {
            "inputs": {
                "nums": [3, 2, 4, 5, 1, 1, 5, 3],
                "queries": [[1, 4], [4, 4], [0, 7]]
            },
            "is_sample": True,
            "explanation": "Min in [1, 4] is 1, in [4, 4] is 1, in [0, 7] is 1."
        },
        {
            "inputs": {
                "nums": [10, 20, 30, 5, 15],
                "queries": [[0, 2], [2, 4]]
            },
            "is_sample": True,
            "explanation": "Min in [0, 2] is 10; min in [2, 4] is 5."
        },
        {
            "inputs": {
                "nums": [5],
                "queries": [[0, 0]]
            },
            "is_sample": False,
            "explanation": None
        }
    ]
    for c in p56_cases:
        c["expected_output"] = solve_static_rmq(c["inputs"]["nums"], c["inputs"]["queries"])

    problems.append({
        "slug": "static-range-minimum-queries",
        "title": "Static Range Minimum Queries",
        "difficulty": "medium",
        "tags": ["Sparse Table", "Array"],
        "companies": ["Google", "Bloomberg", "Two Sigma"],
        "description": "Given an array `nums` of `n` integers and `q` queries of the form `[left, right]`.\n\nPreprocess the array in $O(n \\log n)$ time using a Sparse Table so that each range minimum query can be answered in $O(1)$ time.\n\nReturn an array of the minimum values for each query.\n\n### Constraints\n- `1 <= nums.length <= 10^5`\n- `1 <= queries.length <= 10^5`",
        "function_name": "staticRangeMin",
        "params": [
            {"name": "nums", "type": "integer[]"},
            {"name": "queries", "type": "integer[][]"}
        ],
        "return_type": "integer[]",
        "comparison_mode": "exact",
        "constraints": ["1 <= nums.length <= 10^5", "1 <= queries.length <= 10^5"],
        "hints": [
            "A Sparse Table stores range minimums for intervals of length 2^k.",
            "For query [l, r], let k = floor(log2(r - l + 1)). The answer is min(st[l][k], st[r - 2^k + 1][k])."
        ],
        "acceptance_rate": 62.40,
        "total_submissions": 49200,
        "display_order": 2061,
        "test_cases": p56_cases
    })

    # 57. Range XOR Queries
    def solve_range_xor(nums, queries):
        prefix = [0]
        for x in nums:
            prefix.append(prefix[-1] ^ x)
        return [prefix[r + 1] ^ prefix[l] for l, r in queries]

    p57_cases = [
        {
            "inputs": {
                "nums": [3, 2, 4, 5, 1, 1, 5, 3],
                "queries": [[1, 4], [4, 4], [0, 7]]
            },
            "is_sample": True,
            "explanation": "2 ^ 4 ^ 5 ^ 1 = 2; 1 = 1; XOR of all 8 numbers = 0."
        },
        {
            "inputs": {
                "nums": [1, 2, 3],
                "queries": [[0, 2]]
            },
            "is_sample": True,
            "explanation": "1 ^ 2 ^ 3 = 0."
        },
        {
            "inputs": {
                "nums": [7],
                "queries": [[0, 0]]
            },
            "is_sample": False,
            "explanation": None
        }
    ]
    for c in p57_cases:
        c["expected_output"] = solve_range_xor(c["inputs"]["nums"], c["inputs"]["queries"])

    problems.append({
        "slug": "range-xor-queries",
        "title": "Range XOR Queries",
        "difficulty": "easy",
        "tags": ["Prefix Sum", "Bit Manipulation"],
        "companies": ["Amazon", "Uber", "Adobe"],
        "description": "Given an array `nums` of `n` integers and `q` queries of the form `[left, right]`.\n\nCalculate the bitwise XOR sum of all elements in the range `nums[left..right]` (0-based inclusive) for each query.\n\n### Constraints\n- `1 <= nums.length <= 10^5`\n- `1 <= queries.length <= 10^5`",
        "function_name": "rangeXOR",
        "params": [
            {"name": "nums", "type": "integer[]"},
            {"name": "queries", "type": "integer[][]"}
        ],
        "return_type": "integer[]",
        "comparison_mode": "exact",
        "constraints": ["1 <= nums.length <= 10^5", "1 <= queries.length <= 10^5"],
        "hints": [
            "Use prefix XOR: prefixXor[i] = nums[0] ^ ... ^ nums[i - 1].",
            "Range XOR [L, R] = prefixXor[R + 1] ^ prefixXor[L]."
        ],
        "acceptance_rate": 78.90,
        "total_submissions": 67300,
        "display_order": 2062,
        "test_cases": p57_cases
    })

    # 58. Nearest Smaller Values
    def solve_nearest_smaller(nums):
        res = []
        stack = []  # (val, 1-based index)
        for i, val in enumerate(nums, 1):
            while stack and stack[-1][0] >= val:
                stack.pop()
            res.append(stack[-1][1] if stack else 0)
            stack.append((val, i))
        return res

    p58_cases = [
        {"inputs": {"nums": [2, 5, 1, 4, 8, 3, 2, 5]}, "is_sample": True, "explanation": "Answers: [0, 1, 0, 3, 4, 3, 3, 7]."},
        {"inputs": {"nums": [1, 2, 3, 4]}, "is_sample": True, "explanation": "Each element's nearest smaller is immediate left: [0, 1, 2, 3]."},
        {"inputs": {"nums": [4, 3, 2, 1]}, "is_sample": False, "explanation": None},
        {"inputs": {"nums": [5]}, "is_sample": False, "explanation": None},
        {"inputs": {"nums": [2, 2, 2]}, "is_sample": False, "explanation": None},
    ]
    for c in p58_cases:
        c["expected_output"] = solve_nearest_smaller(c["inputs"]["nums"])

    problems.append({
        "slug": "nearest-smaller-values",
        "title": "Nearest Smaller Values",
        "difficulty": "medium",
        "tags": ["Monotonic Stack", "Array"],
        "companies": ["Amazon", "Microsoft", "Google"],
        "description": "Given an array `nums` of `n` integers, for each position find the 1-based index of the nearest element to its left that is strictly smaller than the current element.\n\nIf no such smaller element exists, output `0` for that position.\n\nReturn the array of indices.\n\n### Constraints\n- `1 <= nums.length <= 10^5`\n- `1 <= nums[i] <= 10^9`",
        "function_name": "nearestSmallerValues",
        "params": [{"name": "nums", "type": "integer[]"}],
        "return_type": "integer[]",
        "comparison_mode": "exact",
        "constraints": ["1 <= nums.length <= 10^5"],
        "hints": [
            "Use a monotonic stack storing pairs (value, 1-based index).",
            "Pop elements from the stack that are greater than or equal to current element."
        ],
        "acceptance_rate": 65.30,
        "total_submissions": 58900,
        "display_order": 2063,
        "test_cases": p58_cases
    })

    # 59. Subarray Divisibility
    def solve_subarray_divisibility(nums):
        n = len(nums)
        count = {0: 1}
        curr = 0
        ans = 0
        for x in nums:
            curr = (curr + x) % n
            curr = (curr + n) % n
            ans += count.get(curr, 0)
            count[curr] = count.get(curr, 0) + 1
        return ans

    p59_cases = [
        {"inputs": {"nums": [3, 1, 2, 7, 4]}, "is_sample": True, "explanation": "6 subarrays have sum divisible by n=5."},
        {"inputs": {"nums": [5]}, "is_sample": True, "explanation": "[5] sum is 5 divisible by 1 (1 subarray)."},
        {"inputs": {"nums": [4, 5, 0, -2, -3, 1]}, "is_sample": False, "explanation": None},
        {"inputs": {"nums": [-1, 2, 9]}, "is_sample": False, "explanation": None},
    ]
    for c in p59_cases:
        c["expected_output"] = solve_subarray_divisibility(c["inputs"]["nums"])

    problems.append({
        "slug": "subarray-divisibility",
        "title": "Subarray Divisibility",
        "difficulty": "medium",
        "tags": ["Prefix Sum", "Hash Table", "Math"],
        "companies": ["Amazon", "Google", "Facebook"],
        "description": "Given an array `nums` of `n` integers, count the number of contiguous non-empty subarrays whose sum of elements is divisible by `n`.\n\nReturn the total count as a 64-bit integer.\n\n### Constraints\n- `1 <= nums.length <= 10^5`\n- `-10^9 <= nums[i] <= 10^9`",
        "function_name": "countDivisibleSubarrays",
        "params": [{"name": "nums", "type": "integer[]"}],
        "return_type": "long",
        "comparison_mode": "exact",
        "constraints": ["1 <= nums.length <= 10^5"],
        "hints": [
            "Compute running prefix sum modulo n (normalize negative remainders to positive).",
            "If two prefix sums have the same remainder modulo n, the subarray between them is divisible by n."
        ],
        "acceptance_rate": 56.40,
        "total_submissions": 61200,
        "display_order": 2064,
        "test_cases": p59_cases
    })

    # 60. Maximum XOR Subarray
    def solve_max_xor_subarray(nums):
        prefix = [0]
        for x in nums:
            prefix.append(prefix[-1] ^ x)

        trie = {}
        def insert(val):
            curr = trie
            for i in range(30, -1, -1):
                bit = (val >> i) & 1
                if bit not in curr:
                    curr[bit] = {}
                curr = curr[bit]

        def query(val):
            curr = trie
            ans = 0
            for i in range(30, -1, -1):
                bit = (val >> i) & 1
                desired = 1 - bit
                if desired in curr:
                    ans |= (1 << i)
                    curr = curr[desired]
                elif bit in curr:
                    curr = curr[bit]
                else:
                    break
            return ans

        insert(0)
        max_xor = 0
        for p in prefix[1:]:
            max_xor = max(max_xor, query(p))
            insert(p)
        return max_xor

    p60_cases = [
        {"inputs": {"nums": [1, 2, 3, 4]}, "is_sample": True, "explanation": "Subarray [3, 4] has XOR sum 3 ^ 4 = 7."},
        {"inputs": {"nums": [8, 1, 2, 12, 7, 6]}, "is_sample": True, "explanation": "Subarray [1, 2, 12] has XOR sum 1 ^ 2 ^ 12 = 15."},
        {"inputs": {"nums": [5]}, "is_sample": False, "explanation": None},
        {"inputs": {"nums": [4, 6]}, "is_sample": False, "explanation": None},
    ]
    for c in p60_cases:
        c["expected_output"] = solve_max_xor_subarray(c["inputs"]["nums"])

    problems.append({
        "slug": "max-xor-subarray",
        "title": "Maximum XOR Subarray",
        "difficulty": "hard",
        "tags": ["Trie", "Bit Manipulation"],
        "companies": ["Google", "Amazon", "Directi"],
        "description": "Given an array `nums` of non-negative integers, find the maximum bitwise XOR sum of any contiguous non-empty subarray using a bitwise Trie.\n\n### Constraints\n- `1 <= nums.length <= 10^5`\n- `0 <= nums[i] <= 10^9`",
        "function_name": "maxXorSubarray",
        "params": [{"name": "nums", "type": "integer[]"}],
        "return_type": "integer",
        "comparison_mode": "exact",
        "constraints": ["1 <= nums.length <= 10^5", "0 <= nums[i] <= 10^9"],
        "hints": [
            "Any subarray XOR from i to j is prefixXor[j] ^ prefixXor[i - 1].",
            "Insert prefix XOR values into a binary Trie bit-by-bit from MSB to LSB."
        ],
        "acceptance_rate": 45.10,
        "total_submissions": 41200,
        "display_order": 2065,
        "test_cases": p60_cases
    })

    # 61. Activity Selection Problem
    def solve_activity_selection(start, finish):
        activities = sorted(zip(start, finish), key=lambda x: x[1])
        count = 0
        last_finish = -1
        for s, f in activities:
            if s >= last_finish:
                count += 1
                last_finish = f
        return count

    p61_cases = [
        {"inputs": {"start": [1, 3, 2, 5], "finish": [2, 4, 3, 6]}, "is_sample": True, "explanation": "Activities [1, 2], [3, 4], [5, 6] can all be performed (3 total)."},
        {"inputs": {"start": [1, 2, 3], "finish": [4, 5, 6]}, "is_sample": True, "explanation": "Pick [1, 4] for 1 activity."},
        {"inputs": {"start": [1], "finish": [10]}, "is_sample": False, "explanation": None},
        {"inputs": {"start": [10, 12, 20], "finish": [20, 25, 30]}, "is_sample": False, "explanation": None},
    ]
    for c in p61_cases:
        c["expected_output"] = solve_activity_selection(c["inputs"]["start"], c["inputs"]["finish"])

    problems.append({
        "slug": "activity-selection",
        "title": "Activity Selection Problem",
        "difficulty": "easy",
        "tags": ["Greedy", "Sorting"],
        "companies": ["Amazon", "Microsoft", "Infosys"],
        "description": "Given `n` activities with their `start` and `finish` times, select the maximum number of mutually compatible activities that can be performed by a single person.\n\nA person can only work on one activity at a time. Two activities are compatible if the start time of one is greater than or equal to the finish time of the other.\n\n### Constraints\n- `1 <= start.length == finish.length <= 10^5`\n- `0 <= start[i] < finish[i] <= 10^9`",
        "function_name": "maxActivities",
        "params": [
            {"name": "start", "type": "integer[]"},
            {"name": "finish", "type": "integer[]"}
        ],
        "return_type": "integer",
        "comparison_mode": "exact",
        "constraints": ["1 <= start.length <= 10^5"],
        "hints": [
            "Sort activities by finish time.",
            "Greedily select the next activity whose start time is >= finish time of the last selected activity."
        ],
        "acceptance_rate": 70.30,
        "total_submissions": 78900,
        "display_order": 2066,
        "test_cases": p61_cases
    })

    # 62. Huffman Encoding Total Bits
    def solve_huffman_cost(frequencies):
        if len(frequencies) <= 1:
            return 0
        import heapq
        pq = frequencies[:]
        heapq.heapify(pq)
        total_bits = 0
        while len(pq) > 1:
            a = heapq.heappop(pq)
            b = heapq.heappop(pq)
            cost = a + b
            total_bits += cost
            heapq.heappush(pq, cost)
        return total_bits

    p62_cases = [
        {"inputs": {"frequencies": [5, 9, 12, 13, 16, 45]}, "is_sample": True, "explanation": "Optimal Huffman prefix tree uses 224 total bits."},
        {"inputs": {"frequencies": [1, 1, 1, 1]}, "is_sample": True, "explanation": "4 characters of frequency 1 each get 2 bits, 4 * 2 = 8 bits."},
        {"inputs": {"frequencies": [100]}, "is_sample": False, "explanation": None},
        {"inputs": {"frequencies": [10, 20]}, "is_sample": False, "explanation": None},
        {"inputs": {"frequencies": [3, 4, 5, 6, 7]}, "is_sample": False, "explanation": None},
    ]
    for c in p62_cases:
        c["expected_output"] = solve_huffman_cost(c["inputs"]["frequencies"])

    problems.append({
        "slug": "huffman-encoding-cost",
        "title": "Huffman Encoding Total Bits",
        "difficulty": "medium",
        "tags": ["Greedy", "Heap (Priority Queue)"],
        "companies": ["Amazon", "Google", "Microsoft"],
        "description": "Given an array `frequencies` of character occurrences, compute the total number of bits required to encode the entire text when using optimal Huffman variable-length prefix codes.\n\nReturn the total bit cost as a 64-bit integer.\n\n### Constraints\n- `1 <= frequencies.length <= 10^5`\n- `1 <= frequencies[i] <= 10^9`",
        "function_name": "huffmanCost",
        "params": [{"name": "frequencies", "type": "integer[]"}],
        "return_type": "long",
        "comparison_mode": "exact",
        "constraints": ["1 <= frequencies.length <= 10^5"],
        "hints": [
            "Use a min-heap to repeatedly combine the two smallest frequency nodes.",
            "Each internal node's combined sum adds directly to the total bit cost."
        ],
        "acceptance_rate": 62.10,
        "total_submissions": 51400,
        "display_order": 2067,
        "test_cases": p62_cases
    })

    # 63. Minimum Railway Platforms Required
    def solve_platforms(arr, dep):
        arr_sorted = sorted(arr)
        dep_sorted = sorted(dep)
        n = len(arr)
        i = j = 0
        platforms = 0
        max_platforms = 0
        while i < n and j < n:
            if arr_sorted[i] <= dep_sorted[j]:
                platforms += 1
                max_platforms = max(max_platforms, platforms)
                i += 1
            else:
                platforms -= 1
                j += 1
        return max_platforms

    p63_cases = [
        {"inputs": {"arr": [900, 940, 950, 1100, 1500, 1800], "dep": [910, 1200, 1120, 1130, 1900, 2000]}, "is_sample": True, "explanation": "Max concurrent trains is 3 between 11:00 and 11:20."},
        {"inputs": {"arr": [900, 1100, 1235], "dep": [1000, 1200, 1240]}, "is_sample": True, "explanation": "Only 1 platform needed."},
        {"inputs": {"arr": [100], "dep": [200]}, "is_sample": False, "explanation": None},
        {"inputs": {"arr": [100, 100], "dep": [200, 200]}, "is_sample": False, "explanation": None},
    ]
    for c in p63_cases:
        c["expected_output"] = solve_platforms(c["inputs"]["arr"], c["inputs"]["dep"])

    problems.append({
        "slug": "minimum-railway-platforms",
        "title": "Minimum Railway Platforms Required",
        "difficulty": "medium",
        "tags": ["Greedy", "Two Pointers", "Sorting"],
        "companies": ["Amazon", "Microsoft", "Paytm", "D.E. Shaw"],
        "description": "Given arrival times `arr` and departure times `dep` of all trains reaching a station.\n\nFind the minimum number of platforms required at the station so that no train is kept waiting.\n\n### Constraints\n- `1 <= arr.length == dep.length <= 5 * 10^4`\n- `0 <= arr[i] <= dep[i] <= 2359`",
        "function_name": "findPlatform",
        "params": [
            {"name": "arr", "type": "integer[]"},
            {"name": "dep", "type": "integer[]"}
        ],
        "return_type": "integer",
        "comparison_mode": "exact",
        "constraints": ["1 <= arr.length <= 50000"],
        "hints": [
            "Sort both arrival and departure arrays independently.",
            "Use two pointers to simulate the chronological order of arrivals and departures."
        ],
        "acceptance_rate": 59.80,
        "total_submissions": 84100,
        "display_order": 2068,
        "test_cases": p63_cases
    })

    # 64. Job Sequencing with Deadlines
    def solve_job_sequencing(deadlines, profits):
        jobs = sorted(zip(deadlines, profits), key=lambda x: x[1], reverse=True)
        max_d = max(deadlines) if deadlines else 0
        slots = [-1] * (max_d + 1)
        count = 0
        total_profit = 0
        for d, p in jobs:
            for s in range(d, 0, -1):
                if slots[s] == -1:
                    slots[s] = p
                    count += 1
                    total_profit += p
                    break
        return [count, total_profit]

    p64_cases = [
        {"inputs": {"deadlines": [4, 1, 1, 1], "profits": [20, 10, 40, 30]}, "is_sample": True, "explanation": "Pick job with profit 40 at slot 1, job with profit 20 at slot 4. Total: 2 jobs, 60 profit."},
        {"inputs": {"deadlines": [2, 1, 2, 1, 1], "profits": [100, 19, 27, 25, 15]}, "is_sample": True, "explanation": "2 jobs, max profit 127."},
        {"inputs": {"deadlines": [1], "profits": [50]}, "is_sample": False, "explanation": None},
        {"inputs": {"deadlines": [3, 3, 3], "profits": [10, 20, 30]}, "is_sample": False, "explanation": None},
    ]
    for c in p64_cases:
        c["expected_output"] = solve_job_sequencing(c["inputs"]["deadlines"], c["inputs"]["profits"])

    problems.append({
        "slug": "job-sequencing-deadlines",
        "title": "Job Sequencing with Deadlines",
        "difficulty": "medium",
        "tags": ["Greedy", "Sorting", "Disjoint Set"],
        "companies": ["Amazon", "Microsoft", "Goldman Sachs"],
        "description": "Given `n` jobs where each job $i$ has a deadline `deadlines[i]` and an associated profit `profits[i]`.\n\nEach job takes 1 unit of time to complete and only one job can be executed at a time. A job yields profit only if completed on or before its deadline.\n\nFind the maximum number of jobs that can be scheduled and the maximum total profit earned. Return `[jobsCount, maxProfit]`.\n\n### Constraints\n- `1 <= deadlines.length == profits.length <= 10^4`\n- `1 <= deadlines[i] <= 1000`\n- `1 <= profits[i] <= 10^5`",
        "function_name": "jobSequencing",
        "params": [
            {"name": "deadlines", "type": "integer[]"},
            {"name": "profits", "type": "integer[]"}
        ],
        "return_type": "integer[]",
        "comparison_mode": "exact",
        "constraints": ["1 <= deadlines.length <= 10000", "deadlines[i] <= 1000"],
        "hints": [
            "Sort jobs in descending order of profit.",
            "For each job, allocate the latest available time slot <= its deadline."
        ],
        "acceptance_rate": 53.90,
        "total_submissions": 62700,
        "display_order": 2069,
        "test_cases": p64_cases
    })

    # 65. Ferris Wheel Gondola Allocation
    def solve_ferris_wheel(weights, x):
        weights.sort()
        i, j = 0, len(weights) - 1
        gondolas = 0
        while i <= j:
            if weights[i] + weights[j] <= x:
                i += 1
            j -= 1
            gondolas += 1
        return gondolas

    p65_cases = [
        {"inputs": {"weights": [2, 3, 7, 9], "x": 10}, "is_sample": True, "explanation": "3 gondolas: (2, 7), (3), (9)."},
        {"inputs": {"weights": [1, 2, 3], "x": 5}, "is_sample": True, "explanation": "2 gondolas: (1, 3), (2)."},
        {"inputs": {"weights": [5], "x": 5}, "is_sample": False, "explanation": None},
        {"inputs": {"weights": [5, 5, 5, 5], "x": 5}, "is_sample": False, "explanation": None},
    ]
    for c in p65_cases:
        c["expected_output"] = solve_ferris_wheel(c["inputs"]["weights"], c["inputs"]["x"])

    problems.append({
        "slug": "ferris-wheel",
        "title": "Ferris Wheel Gondola Allocation",
        "difficulty": "easy",
        "tags": ["Greedy", "Two Pointers", "Sorting"],
        "companies": ["Amazon", "Uber", "Flipkart"],
        "description": "There are `n` children who want to go on a Ferris wheel. Each gondola can hold at most 2 children, and the total weight of the children in a gondola cannot exceed `x`.\n\nFind the minimum number of gondolas needed to seat all children.\n\n### Constraints\n- `1 <= weights.length <= 2 * 10^5`\n- `1 <= x <= 10^9`\n- `1 <= weights[i] <= x`",
        "function_name": "minFerrisWheelGondolas",
        "params": [{"name": "weights", "type": "integer[]"}, {"name": "x", "type": "integer"}],
        "return_type": "integer",
        "comparison_mode": "exact",
        "constraints": ["1 <= weights.length <= 200000", "1 <= x <= 10^9"],
        "hints": [
            "Sort children weights in ascending order.",
            "Pair the heaviest child with the lightest child if their sum <= x; otherwise send the heaviest child alone."
        ],
        "acceptance_rate": 72.80,
        "total_submissions": 78900,
        "display_order": 2070,
        "test_cases": p65_cases
    })

    # 66. Restaurant Customers Maximum Concurrent
    def solve_restaurant_customers(arrival_departure):
        events = []
        for a, d in arrival_departure:
            events.append((a, 1))
            events.append((d, -1))
        events.sort(key=lambda x: (x[0], x[1]))
        curr = max_cust = 0
        for t, typ in events:
            curr += typ
            max_cust = max(max_cust, curr)
        return max_cust

    p66_cases = [
        {"inputs": {"arrivalDeparture": [[5, 8], [2, 4], [3, 9]]}, "is_sample": True, "explanation": "At time 3 to 4, customers 2 and 3 are present (max 2)."},
        {"inputs": {"arrivalDeparture": [[1, 2], [2, 3], [3, 4]]}, "is_sample": True, "explanation": "Departures coincide with arrivals: max 2 concurrent customers."},
        {"inputs": {"arrivalDeparture": [[1, 10]]}, "is_sample": False, "explanation": None},
        {"inputs": {"arrivalDeparture": [[1, 5], [2, 6], [3, 7], [4, 8]]}, "is_sample": False, "explanation": None},
    ]
    for c in p66_cases:
        c["expected_output"] = solve_restaurant_customers(c["inputs"]["arrivalDeparture"])

    problems.append({
        "slug": "restaurant-customers",
        "title": "Restaurant Customers Maximum Concurrent",
        "difficulty": "medium",
        "tags": ["Greedy", "Sorting"],
        "companies": ["Bloomberg", "Google", "Facebook"],
        "description": "You are given the arrival and departure times of customers at a restaurant.\n\nFind the maximum number of customers who were in the restaurant at any one moment.\n\n### Constraints\n- `1 <= arrivalDeparture.length <= 2 * 10^5`\n- `1 <= arr < dep <= 10^9`",
        "function_name": "maxConcurrentCustomers",
        "params": [{"name": "arrivalDeparture", "type": "integer[][]"}],
        "return_type": "integer",
        "comparison_mode": "exact",
        "constraints": ["1 <= arrivalDeparture.length <= 200000"],
        "hints": [
            "Create an event list: (+1 for arrival, -1 for departure).",
            "Sort all events chronologically and track the running sum."
        ],
        "acceptance_rate": 68.30,
        "total_submissions": 64200,
        "display_order": 2071,
        "test_cases": p66_cases
    })

    # 67. Movie Festival
    def solve_movie_festival(movies):
        movies.sort(key=lambda x: x[1])
        count = 0
        last_end = 0
        for s, e in movies:
            if s >= last_end:
                count += 1
                last_end = e
        return count

    p67_cases = [
        {"inputs": {"movies": [[3, 5], [4, 9], [5, 8]]}, "is_sample": True, "explanation": "Watch [3, 5] and [5, 8] (2 movies)."},
        {"inputs": {"movies": [[1, 3], [2, 5], [3, 6]]}, "is_sample": True, "explanation": "Watch [1, 3] and [3, 6] (2 movies)."},
        {"inputs": {"movies": [[1, 10]]}, "is_sample": False, "explanation": None},
        {"inputs": {"movies": [[1, 2], [2, 3], [3, 4], [4, 5]]}, "is_sample": False, "explanation": None},
    ]
    for c in p67_cases:
        c["expected_output"] = solve_movie_festival(c["inputs"]["movies"])

    problems.append({
        "slug": "movie-festival",
        "title": "Movie Festival",
        "difficulty": "medium",
        "tags": ["Greedy", "Sorting"],
        "companies": ["Amazon", "Google", "Microsoft"],
        "description": "In a movie festival, `n` movies will be shown. You are given the start and end time of each movie `[start, end]`.\n\nWhat is the maximum number of movies you can watch entirely? You can start a movie at the same time another movie ends.\n\n### Constraints\n- `1 <= movies.length <= 2 * 10^5`\n- `1 <= start < end <= 10^9`",
        "function_name": "maxMoviesWatched",
        "params": [{"name": "movies", "type": "integer[][]"}],
        "return_type": "integer",
        "comparison_mode": "exact",
        "constraints": ["1 <= movies.length <= 200000"],
        "hints": [
            "Always pick the movie that finishes earliest.",
            "Sort movies by end time."
        ],
        "acceptance_rate": 69.10,
        "total_submissions": 71200,
        "display_order": 2072,
        "test_cases": p67_cases
    })

    # 68. Stick Lengths Cost
    def solve_stick_lengths(lengths):
        lengths.sort()
        n = len(lengths)
        median = lengths[n // 2]
        return sum(abs(x - median) for x in lengths)

    p68_cases = [
        {"inputs": {"lengths": [2, 3, 1, 5, 2]}, "is_sample": True, "explanation": "Sorted: [1, 2, 2, 3, 5], median = 2. Cost = |1-2| + |2-2| + |2-2| + |3-2| + |5-2| = 5."},
        {"inputs": {"lengths": [1, 100]}, "is_sample": True, "explanation": "Diff is 99."},
        {"inputs": {"lengths": [5]}, "is_sample": False, "explanation": None},
        {"inputs": {"lengths": [10, 10, 10]}, "is_sample": False, "explanation": None},
        {"inputs": {"lengths": [1, 2, 3, 4, 5, 6]}, "is_sample": False, "explanation": None},
    ]
    for c in p68_cases:
        c["expected_output"] = solve_stick_lengths(c["inputs"]["lengths"])

    problems.append({
        "slug": "stick-lengths",
        "title": "Stick Lengths Cost",
        "difficulty": "medium",
        "tags": ["Greedy", "Sorting", "Math"],
        "companies": ["Amazon", "Uber", "Citadel"],
        "description": "There are `n` sticks with given lengths. Your task is to modify the sticks so that each stick has the exact same length.\n\nYou can increase or decrease the length of any stick; each unit modification costs 1 coin.\n\nFind the minimum total cost to make all sticks equal length. Return the answer as a 64-bit integer.\n\n### Constraints\n- `1 <= lengths.length <= 2 * 10^5`\n- `1 <= lengths[i] <= 10^9`",
        "function_name": "minStickCost",
        "params": [{"name": "lengths", "type": "integer[]"}],
        "return_type": "long",
        "comparison_mode": "exact",
        "constraints": ["1 <= lengths.length <= 200000"],
        "hints": [
            "The sum of absolute differences is minimized when all values are set to the median of the array."
        ],
        "acceptance_rate": 67.50,
        "total_submissions": 59800,
        "display_order": 2073,
        "test_cases": p68_cases
    })

    # 69. Missing Coin Sum
    def solve_missing_coin_sum(coins):
        coins.sort()
        res = 1
        for c in coins:
            if c > res:
                break
            res += c
        return res

    p69_cases = [
        {"inputs": {"coins": [2, 9, 1, 2, 7]}, "is_sample": True, "explanation": "Sorted: [1, 2, 2, 7, 9]. Can form 1..5, but cannot form 6."},
        {"inputs": {"coins": [1, 1, 1, 1]}, "is_sample": True, "explanation": "Can form 1..4, smallest missing is 5."},
        {"inputs": {"coins": [2]}, "is_sample": False, "explanation": None},
        {"inputs": {"coins": [1, 2, 4, 8, 16]}, "is_sample": False, "explanation": None},
    ]
    for c in p69_cases:
        c["expected_output"] = solve_missing_coin_sum(c["inputs"]["coins"])

    problems.append({
        "slug": "missing-coin-sum",
        "title": "Missing Coin Sum",
        "difficulty": "medium",
        "tags": ["Greedy", "Sorting"],
        "companies": ["Google", "Bloomberg", "Salesforce"],
        "description": "You have `n` coins with positive integer values.\n\nWhat is the smallest positive integer sum that you cannot produce using a subset of the coins? Return the result as a 64-bit integer.\n\n### Constraints\n- `1 <= coins.length <= 2 * 10^5`\n- `1 <= coins[i] <= 10^9`",
        "function_name": "smallestMissingCoinSum",
        "params": [{"name": "coins", "type": "integer[]"}],
        "return_type": "long",
        "comparison_mode": "exact",
        "constraints": ["1 <= coins.length <= 200000"],
        "hints": [
            "Sort coins in ascending order.",
            "Maintain current reachable prefix sum limit S (all sums 1..S can be formed). If next coin > S + 1, then S + 1 is the smallest missing sum."
        ],
        "acceptance_rate": 63.80,
        "total_submissions": 51200,
        "display_order": 2074,
        "test_cases": p69_cases
    })

    # 70. Collecting Numbers
    def solve_collecting_numbers(nums):
        pos = {val: i for i, val in enumerate(nums)}
        rounds = 1
        for i in range(2, len(nums) + 1):
            if pos[i] < pos[i - 1]:
                rounds += 1
        return rounds

    p70_cases = [
        {"inputs": {"nums": [4, 2, 1, 5, 3]}, "is_sample": True, "explanation": "Round 1 collects 1; Round 2 collects 2, 3; Round 3 collects 4, 5. 3 rounds total."},
        {"inputs": {"nums": [1, 2, 3, 4, 5]}, "is_sample": True, "explanation": "Already in order, 1 round."},
        {"inputs": {"nums": [5, 4, 3, 2, 1]}, "is_sample": False, "explanation": None},
        {"inputs": {"nums": [2, 1]}, "is_sample": False, "explanation": None},
    ]
    for c in p70_cases:
        c["expected_output"] = solve_collecting_numbers(c["inputs"]["nums"])

    problems.append({
        "slug": "collecting-numbers",
        "title": "Collecting Numbers",
        "difficulty": "medium",
        "tags": ["Greedy", "Array"],
        "companies": ["Amazon", "Uber", "Citadel"],
        "description": "You are given an array that contains a permutation of numbers `1, 2, ..., n`.\n\nYour task is to collect the numbers from 1 to `n` in strictly increasing order. In each round, you scan the array from left to right and collect as many sequential numbers as possible.\n\nHow many rounds are required?\n\n### Constraints\n- `1 <= nums.length <= 2 * 10^5`",
        "function_name": "collectNumbersRounds",
        "params": [{"name": "nums", "type": "integer[]"}],
        "return_type": "integer",
        "comparison_mode": "exact",
        "constraints": ["1 <= nums.length <= 200000"],
        "hints": [
            "Store the index of each number in a lookup table pos.",
            "A new round begins whenever pos[i] < pos[i - 1]."
        ],
        "acceptance_rate": 68.90,
        "total_submissions": 56400,
        "display_order": 2075,
        "test_cases": p70_cases
    })

    # 71. Sieve of Eratosthenes Prime Counting
    def solve_sieve(n):
        if n < 2:
            return 0
        is_prime = [True] * (n + 1)
        is_prime[0] = is_prime[1] = False
        p = 2
        while p * p <= n:
            if is_prime[p]:
                for i in range(p * p, n + 1, p):
                    is_prime[i] = False
            p += 1
        return sum(is_prime)

    p71_cases = [
        {"inputs": {"n": 10}, "is_sample": True, "explanation": "Primes <= 10 are 2, 3, 5, 7 (4 primes)."},
        {"inputs": {"n": 20}, "is_sample": True, "explanation": "8 primes: 2, 3, 5, 7, 11, 13, 17, 19."},
        {"inputs": {"n": 1}, "is_sample": False, "explanation": None},
        {"inputs": {"n": 2}, "is_sample": False, "explanation": None},
        {"inputs": {"n": 100}, "is_sample": False, "explanation": None},
        {"inputs": {"n": 1000}, "is_sample": False, "explanation": None},
    ]
    for c in p71_cases:
        c["expected_output"] = solve_sieve(c["inputs"]["n"])

    problems.append({
        "slug": "sieve-of-eratosthenes",
        "title": "Sieve of Eratosthenes Prime Counting",
        "difficulty": "easy",
        "tags": ["Math", "Number Theory"],
        "companies": ["Amazon", "Microsoft", "Goldman Sachs"],
        "description": "Given an integer `n`, compute the number of prime numbers less than or equal to `n` using the Sieve of Eratosthenes algorithm in $O(n \\log \\log n)$ time.\n\n### Constraints\n- `0 <= n <= 5 * 10^6`",
        "function_name": "countPrimesUpTo",
        "params": [{"name": "n", "type": "integer"}],
        "return_type": "integer",
        "comparison_mode": "exact",
        "constraints": ["0 <= n <= 5000000"],
        "hints": [
            "Use a boolean array initialized to true.",
            "Iterate from 2 up to sqrt(n) marking multiples of each discovered prime as composite."
        ],
        "acceptance_rate": 75.80,
        "total_submissions": 92100,
        "display_order": 2076,
        "test_cases": p71_cases
    })

    # 72. Nth Catalan Number
    def solve_catalan(n):
        return math.comb(2 * n, n) // (n + 1)

    p72_cases = [
        {"inputs": {"n": 3}, "is_sample": True, "explanation": "C_3 = (1/4) * binom(6, 3) = 20 / 4 = 5."},
        {"inputs": {"n": 4}, "is_sample": True, "explanation": "C_4 = 14."},
        {"inputs": {"n": 0}, "is_sample": False, "explanation": None},
        {"inputs": {"n": 1}, "is_sample": False, "explanation": None},
        {"inputs": {"n": 5}, "is_sample": False, "explanation": None},
        {"inputs": {"n": 10}, "is_sample": False, "explanation": None},
        {"inputs": {"n": 20}, "is_sample": False, "explanation": None},
    ]
    for c in p72_cases:
        c["expected_output"] = solve_catalan(c["inputs"]["n"])

    problems.append({
        "slug": "nth-catalan-number",
        "title": "Nth Catalan Number",
        "difficulty": "medium",
        "tags": ["Math", "Combinatorics"],
        "companies": ["Amazon", "Google", "Directi"],
        "description": "Compute the `n`-th Catalan number $C_n = \\frac{1}{n + 1} \\binom{2n}{n}$.\n\nCatalan numbers count the number of valid parenthesizations of length $2n$, the number of full binary trees with $n + 1$ leaves, and monotonic grid paths along an $n \\times n$ grid.\n\nReturn the answer as a 64-bit integer.\n\n### Constraints\n- `0 <= n <= 30`",
        "function_name": "catalanNumber",
        "params": [{"name": "n", "type": "integer"}],
        "return_type": "long",
        "comparison_mode": "exact",
        "constraints": ["0 <= n <= 30"],
        "hints": [
            "Use the recurrence C_0 = 1 and C_{n+1} = sum_{i=0}^n C_i * C_{n-i}.",
            "Or directly compute binom(2n, n) / (n + 1)."
        ],
        "acceptance_rate": 64.90,
        "total_submissions": 61200,
        "display_order": 2077,
        "test_cases": p72_cases
    })

    # 73. Extended Euclidean Algorithm
    def solve_extended_gcd(a, b):
        def egcd(x, y):
            if y == 0:
                return x, 1, 0
            g, x1, y1 = egcd(y, x % y)
            return g, y1, x1 - (x // y) * y1
        g, x, y = egcd(a, b)
        return [g, x, y]

    p73_cases = [
        {"inputs": {"a": 30, "b": 20}, "is_sample": True, "explanation": "gcd=10, 30*(1) + 20*(-1) = 10 -> [10, 1, -1]."},
        {"inputs": {"a": 35, "b": 15}, "is_sample": True, "explanation": "gcd=5, 35*(1) + 15*(-2) = 5 -> [5, 1, -2]."},
        {"inputs": {"a": 10, "b": 7}, "is_sample": False, "explanation": None},
        {"inputs": {"a": 100, "b": 25}, "is_sample": False, "explanation": None},
    ]
    for c in p73_cases:
        c["expected_output"] = solve_extended_gcd(c["inputs"]["a"], c["inputs"]["b"])

    problems.append({
        "slug": "extended-gcd",
        "title": "Extended Euclidean Algorithm",
        "difficulty": "medium",
        "tags": ["Math", "Number Theory"],
        "companies": ["Google", "Microsoft", "Goldman Sachs"],
        "description": "Given two positive integers `a` and `b`, find integers `g`, `x`, and `y` such that $a \\cdot x + b \\cdot y = g = \\gcd(a, b)$ using the Extended Euclidean Algorithm.\n\nReturn an array `[g, x, y]`.\n\n### Constraints\n- `1 <= a, b <= 10^9`",
        "function_name": "extendedGcd",
        "params": [{"name": "a", "type": "integer"}, {"name": "b", "type": "integer"}],
        "return_type": "integer[]",
        "comparison_mode": "exact",
        "constraints": ["1 <= a, b <= 10^9"],
        "hints": [
            "Use recursion: if b == 0, gcd = a, x = 1, y = 0.",
            "Otherwise recurse on (b, a % b) and update x = y1, y = x1 - (a // b) * y1."
        ],
        "acceptance_rate": 68.70,
        "total_submissions": 45800,
        "display_order": 2078,
        "test_cases": p73_cases
    })

    # 74. Weird Algorithm Collatz Sequence
    def solve_weird_algo(n):
        steps = 0
        while n > 1:
            if n % 2 == 0:
                n //= 2
            else:
                n = 3 * n + 1
            steps += 1
        return steps

    p74_cases = [
        {"inputs": {"n": 3}, "is_sample": True, "explanation": "Trajectory: 3 -> 10 -> 5 -> 16 -> 8 -> 4 -> 2 -> 1 (7 steps)."},
        {"inputs": {"n": 1}, "is_sample": True, "explanation": "Already at 1, 0 steps."},
        {"inputs": {"n": 2}, "is_sample": False, "explanation": None},
        {"inputs": {"n": 6}, "is_sample": False, "explanation": None},
        {"inputs": {"n": 27}, "is_sample": False, "explanation": None},
        {"inputs": {"n": 1000}, "is_sample": False, "explanation": None},
    ]
    for c in p74_cases:
        c["expected_output"] = solve_weird_algo(c["inputs"]["n"])

    problems.append({
        "slug": "weird-algorithm",
        "title": "Weird Algorithm Collatz Sequence",
        "difficulty": "easy",
        "tags": ["Simulation", "Math"],
        "companies": ["Amazon", "TCS", "Infosys"],
        "description": "Consider an algorithm that takes a positive integer `n`:\n- If `n` is even, the algorithm divides it by 2.\n- If `n` is odd, the algorithm multiplies it by 3 and adds 1.\n\nThe algorithm repeats this process until `n` reaches 1.\n\nReturn the total number of transformation steps needed to reach 1.\n\n### Constraints\n- `1 <= n <= 10^9`",
        "function_name": "collatzSteps",
        "params": [{"name": "n", "type": "long"}],
        "return_type": "integer",
        "comparison_mode": "exact",
        "constraints": ["1 <= n <= 10^9"],
        "hints": [
            "Simulate the process directly while maintaining a step counter.",
            "Be mindful of 64-bit integer overflow when calculating 3n + 1."
        ],
        "acceptance_rate": 84.10,
        "total_submissions": 99200,
        "display_order": 2079,
        "test_cases": p74_cases
    })

    # 75. Number Spiral Coordinate Value
    def solve_number_spiral(y, x):
        m = max(y, x)
        if m % 2 == 0:
            if y == m:
                return m * m - (x - 1)
            else:
                return (m - 1) * (m - 1) + y
        else:
            if x == m:
                return m * m - (y - 1)
            else:
                return (m - 1) * (m - 1) + x

    p75_cases = [
        {"inputs": {"y": 2, "x": 3}, "is_sample": True, "explanation": "Row 2, Column 3 contains 8 in the standard number spiral."},
        {"inputs": {"y": 1, "x": 1}, "is_sample": True, "explanation": "Origin contains 1."},
        {"inputs": {"y": 4, "x": 2}, "is_sample": False, "explanation": None},
        {"inputs": {"y": 3, "x": 1}, "is_sample": False, "explanation": None},
        {"inputs": {"y": 1000000, "x": 1000000}, "is_sample": False, "explanation": None},
    ]
    for c in p75_cases:
        c["expected_output"] = solve_number_spiral(c["inputs"]["y"], c["inputs"]["x"])

    problems.append({
        "slug": "number-spiral",
        "title": "Number Spiral Coordinate Value",
        "difficulty": "medium",
        "tags": ["Math"],
        "companies": ["Microsoft", "Google", "Goldman Sachs"],
        "description": "A number spiral is an infinite 2D grid whose top-left square contains the number 1. Successive numbers spiral outwards:\n\n```\n 1  2  9 10 25\n 4  3  8 11 24\n 5  6  7 12 23\n16 15 14 13 22\n17 18 19 20 21\n```\n\nYour task is to find the number in row `y` and column `x` (1-based indices). Return the answer as a 64-bit integer.\n\n### Constraints\n- `1 <= y, x <= 10^9`",
        "function_name": "numberSpiralValue",
        "params": [{"name": "y", "type": "long"}, {"name": "x", "type": "long"}],
        "return_type": "long",
        "comparison_mode": "exact",
        "constraints": ["1 <= y, x <= 10^9"],
        "hints": [
            "Let m = max(y, x). The m-th layer contains m^2 at one of its ends.",
            "Determine the direction of numbering based on whether m is even or odd."
        ],
        "acceptance_rate": 63.40,
        "total_submissions": 61200,
        "display_order": 2080,
        "test_cases": p75_cases
    })

    return problems

