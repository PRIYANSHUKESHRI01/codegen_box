# -*- coding: utf-8 -*-
"""
Batch 21 - Part 4: Problems 76 to 100 (Display Order 2081 to 2105)
Combinatorics, Game Theory, Graph Challenges, and Dynamic Programming.
"""
import math
from collections import deque

def get_part4_problems():
    problems = []

    # 76. Counting Divisors
    def solve_counting_divisors(n):
        count = 0
        i = 1
        while i * i <= n:
            if n % i == 0:
                count += 1 if i * i == n else 2
            i += 1
        return count

    p76_cases = [
        {"inputs": {"n": 16}, "is_sample": True, "explanation": "Divisors are 1, 2, 4, 8, 16 (5 divisors)."},
        {"inputs": {"n": 17}, "is_sample": True, "explanation": "17 is prime (2 divisors: 1 and 17)."},
        {"inputs": {"n": 1}, "is_sample": False, "explanation": None},
        {"inputs": {"n": 24}, "is_sample": False, "explanation": None},
        {"inputs": {"n": 100}, "is_sample": False, "explanation": None},
        {"inputs": {"n": 1000000}, "is_sample": False, "explanation": None},
    ]
    for c in p76_cases:
        c["expected_output"] = solve_counting_divisors(c["inputs"]["n"])

    problems.append({
        "slug": "counting-divisors",
        "title": "Counting Divisors",
        "difficulty": "easy",
        "tags": ["Math", "Number Theory"],
        "companies": ["Amazon", "Bloomberg", "Adobe"],
        "description": "Given a positive integer `n`, return the total number of positive integer divisors of `n` in $O(\\sqrt{n})$ time.\n\n### Constraints\n- `1 <= n <= 10^9`",
        "function_name": "countDivisors",
        "params": [{"name": "n", "type": "integer"}],
        "return_type": "integer",
        "comparison_mode": "exact",
        "constraints": ["1 <= n <= 10^9"],
        "hints": [
            "Iterate from 1 up to sqrt(n). If i divides n, add 2 (for i and n / i) unless i * i == n."
        ],
        "acceptance_rate": 78.40,
        "total_submissions": 64300,
        "display_order": 2081,
        "test_cases": p76_cases
    })

    # 77. Common Divisors
    def solve_common_divisors(nums):
        if not nums:
            return 1
        max_val = max(nums)
        count = [0] * (max_val + 1)
        for x in nums:
            count[x] += 1

        for g in range(max_val, 0, -1):
            multiples = 0
            for mult in range(g, max_val + 1, g):
                multiples += count[mult]
                if multiples >= 2:
                    return g
        return 1

    p77_cases = [
        {"inputs": {"nums": [3, 14, 15, 7, 9]}, "is_sample": True, "explanation": "Pair (14, 7) has gcd = 7. Pair (9, 15) has gcd = 3. Max gcd is 7."},
        {"inputs": {"nums": [10, 20, 30]}, "is_sample": True, "explanation": "gcd(20, 30) = 10."},
        {"inputs": {"nums": [2, 3]}, "is_sample": False, "explanation": None},
        {"inputs": {"nums": [100, 25, 50]}, "is_sample": False, "explanation": None},
    ]
    for c in p77_cases:
        c["expected_output"] = solve_common_divisors(c["inputs"]["nums"])

    problems.append({
        "slug": "common-divisors",
        "title": "Common Divisors",
        "difficulty": "medium",
        "tags": ["Math", "Number Theory", "Sieve"],
        "companies": ["Google", "Citadel", "Goldman Sachs"],
        "description": "You are given an array `nums` of positive integers.\n\nFind the maximum greatest common divisor that can be obtained from any pair of distinct elements in the array.\n\n### Constraints\n- `2 <= nums.length <= 2 * 10^5`\n- `1 <= nums[i] <= 10^6`",
        "function_name": "maxCommonDivisor",
        "params": [{"name": "nums", "type": "integer[]"}],
        "return_type": "integer",
        "comparison_mode": "exact",
        "constraints": ["2 <= nums.length <= 200000", "nums[i] <= 1000000"],
        "hints": [
            "Count frequencies of all numbers in an array.",
            "Iterate g from max_value downwards. If the count of multiples of g in the array is >= 2, then g is the answer."
        ],
        "acceptance_rate": 61.20,
        "total_submissions": 45100,
        "display_order": 2082,
        "test_cases": p77_cases
    })

    # 78. Prime Multiples
    def solve_prime_multiples(n, primes):
        k = len(primes)
        ans = 0
        for mask in range(1, 1 << k):
            prod = 1
            bits = 0
            overflow = False
            for i in range(k):
                if (mask >> i) & 1:
                    bits += 1
                    if prod > n // primes[i]:
                        overflow = True
                        break
                    prod *= primes[i]
            if overflow:
                continue
            cnt = n // prod
            if bits % 2 == 1:
                ans += cnt
            else:
                ans -= cnt
        return ans

    p78_cases = [
        {"inputs": {"n": 20, "primes": [2, 5]}, "is_sample": True, "explanation": "Multiples of 2 (10), multiples of 5 (4), multiples of 10 (2) -> 10 + 4 - 2 = 12."},
        {"inputs": {"n": 10, "primes": [3]}, "is_sample": True, "explanation": "Multiples of 3 <= 10 are 3, 6, 9 (3 numbers)."},
        {"inputs": {"n": 100, "primes": [2, 3, 5]}, "is_sample": False, "explanation": None},
        {"inputs": {"n": 1000, "primes": [7, 11, 13]}, "is_sample": False, "explanation": None},
    ]
    for c in p78_cases:
        c["expected_output"] = solve_prime_multiples(c["inputs"]["n"], c["inputs"]["primes"])

    problems.append({
        "slug": "prime-multiples",
        "title": "Prime Multiples",
        "difficulty": "medium",
        "tags": ["Math", "Inclusion-Exclusion"],
        "companies": ["Google", "Bloomberg", "Two Sigma"],
        "description": "You are given a positive integer `n` and a list of `k` distinct prime numbers `primes`.\n\nHow many integers between `1` and `n` are divisible by at least one of the given prime numbers?\n\nReturn the count as a 64-bit integer.\n\n### Constraints\n- `1 <= n <= 10^18`\n- `1 <= primes.length <= 20`\n- `2 <= primes[i] <= 10^9`",
        "function_name": "countPrimeMultiples",
        "params": [{"name": "n", "type": "long"}, {"name": "primes", "type": "integer[]"}],
        "return_type": "long",
        "comparison_mode": "exact",
        "constraints": ["1 <= n <= 10^18", "1 <= primes.length <= 20"],
        "hints": [
            "Use the Principle of Inclusion-Exclusion over all 2^k - 1 non-empty subsets of primes.",
            "Guard against 64-bit integer overflow when multiplying primes by checking prod > n // p."
        ],
        "acceptance_rate": 57.30,
        "total_submissions": 38900,
        "display_order": 2083,
        "test_cases": p78_cases
    })

    # 79. Counting Coprime Pairs
    def solve_coprime_pairs(nums):
        if not nums:
            return 0
        max_val = max(nums)
        # Sieve for mu (Möbius function)
        mu = [0] * (max_val + 1)
        primes = []
        is_prime = [True] * (max_val + 1)
        mu[1] = 1

        for i in range(2, max_val + 1):
            if is_prime[i]:
                primes.append(i)
                mu[i] = -1
            for p in primes:
                if i * p > max_val:
                    break
                is_prime[i * p] = False
                if i % p == 0:
                    mu[i * p] = 0
                    break
                else:
                    mu[i * p] = -mu[i]

        freq = [0] * (max_val + 1)
        for x in nums:
            freq[x] += 1

        cnt = [0] * (max_val + 1)
        for d in range(1, max_val + 1):
            if mu[d] != 0:
                for mult in range(d, max_val + 1, d):
                    cnt[d] += freq[mult]

        coprime_pairs = 0
        for d in range(1, max_val + 1):
            if mu[d] != 0:
                coprime_pairs += mu[d] * (cnt[d] * (cnt[d] - 1) // 2)

        return coprime_pairs

    p79_cases = [
        {"inputs": {"nums": [3, 2, 4, 2, 5]}, "is_sample": True, "explanation": "Pairs with gcd=1 are (3, 2), (3, 4), (3, 2), (3, 5), (2, 5), (4, 5), (2, 5) -> 7 pairs."},
        {"inputs": {"nums": [2, 4, 6]}, "is_sample": True, "explanation": "All numbers are even, no coprime pairs (0)."},
        {"inputs": {"nums": [5, 7, 11]}, "is_sample": False, "explanation": None},
        {"inputs": {"nums": [1, 1, 1]}, "is_sample": False, "explanation": None},
    ]
    for c in p79_cases:
        c["expected_output"] = solve_coprime_pairs(c["inputs"]["nums"])

    problems.append({
        "slug": "counting-coprime-pairs",
        "title": "Counting Coprime Pairs",
        "difficulty": "hard",
        "tags": ["Math", "Number Theory", "Möbius Inversion"],
        "companies": ["Google", "Citadel", "Two Sigma"],
        "description": "Given an array `nums` of positive integers, count the number of pairs `(i, j)` with `i < j` such that $\\gcd(nums[i], nums[j]) = 1$.\n\nReturn the count as a 64-bit integer.\n\n### Constraints\n- `2 <= nums.length <= 10^5`\n- `1 <= nums[i] <= 10^6`",
        "function_name": "countCoprimePairs",
        "params": [{"name": "nums", "type": "integer[]"}],
        "return_type": "long",
        "comparison_mode": "exact",
        "constraints": ["2 <= nums.length <= 10^5", "nums[i] <= 1000000"],
        "hints": [
            "Use the Möbius inversion formula: sum_{d} mu(d) * (cnt[d] choose 2), where cnt[d] is the count of array numbers divisible by d.",
            "Precompute mu(d) for all d up to max(nums) using a linear sieve."
        ],
        "acceptance_rate": 44.50,
        "total_submissions": 31200,
        "display_order": 2084,
        "test_cases": p79_cases
    })

    # 80. Distributing Apples
    def solve_distributing_apples(n, m):
        MOD = 10**9 + 7
        return math.comb(m + n - 1, n - 1) % MOD

    p80_cases = [
        {"inputs": {"n": 3, "m": 2}, "is_sample": True, "explanation": "C(2 + 3 - 1, 3 - 1) = C(4, 2) = 6 ways to distribute 2 apples to 3 children."},
        {"inputs": {"n": 2, "m": 3}, "is_sample": True, "explanation": "C(3 + 2 - 1, 1) = C(4, 1) = 4 ways."},
        {"inputs": {"n": 1, "m": 10}, "is_sample": False, "explanation": None},
        {"inputs": {"n": 5, "m": 0}, "is_sample": False, "explanation": None},
        {"inputs": {"n": 10, "m": 10}, "is_sample": False, "explanation": None},
    ]
    for c in p80_cases:
        c["expected_output"] = solve_distributing_apples(c["inputs"]["n"], c["inputs"]["m"])

    problems.append({
        "slug": "distributing-apples",
        "title": "Distributing Apples",
        "difficulty": "medium",
        "tags": ["Math", "Combinatorics"],
        "companies": ["Amazon", "Uber", "Goldman Sachs"],
        "description": "There are `n` children and `m` identical apples.\n\nIn how many ways can the apples be distributed to the children? A child may receive zero or more apples.\n\nReturn the answer modulo $10^9 + 7$.\n\n### Constraints\n- `1 <= n, m <= 10^5`",
        "function_name": "waysToDistributeApples",
        "params": [{"name": "n", "type": "integer"}, {"name": "m", "type": "integer"}],
        "return_type": "integer",
        "comparison_mode": "exact",
        "constraints": ["1 <= n, m <= 10^5"],
        "hints": [
            "Use Stars and Bars combinatorics.",
            "Formula is binom(m + n - 1, n - 1) modulo 10^9 + 7."
        ],
        "acceptance_rate": 69.40,
        "total_submissions": 54200,
        "display_order": 2085,
        "test_cases": p80_cases
    })

    # 81. Christmas Party Derangements
    def solve_derangements(n):
        if n == 1:
            return 0
        MOD = 10**9 + 7
        d0, d1 = 1, 0
        for i in range(2, n + 1):
            d2 = ((i - 1) * (d1 + d0)) % MOD
            d0, d1 = d1, d2
        return d1

    p81_cases = [
        {"inputs": {"n": 4}, "is_sample": True, "explanation": "4! * sum((-1)^k / k!) = 9 derangements."},
        {"inputs": {"n": 3}, "is_sample": True, "explanation": "2 derangements of 3 items."},
        {"inputs": {"n": 1}, "is_sample": False, "explanation": None},
        {"inputs": {"n": 2}, "is_sample": False, "explanation": None},
        {"inputs": {"n": 5}, "is_sample": False, "explanation": None},
        {"inputs": {"n": 10}, "is_sample": False, "explanation": None},
        {"inputs": {"n": 100}, "is_sample": False, "explanation": None},
    ]
    for c in p81_cases:
        c["expected_output"] = solve_derangements(c["inputs"]["n"])

    problems.append({
        "slug": "christmas-party-derangements",
        "title": "Christmas Party Derangements",
        "difficulty": "medium",
        "tags": ["Math", "Combinatorics", "Dynamic Programming"],
        "companies": ["Google", "Bloomberg", "Salesforce"],
        "description": "There are `n` children at a Christmas party, and each child brought a gift.\n\nIn how many ways can the gifts be distributed such that no child receives their own gift (a permutation with no fixed points, called a derangement)?\n\nReturn the answer modulo $10^9 + 7$.\n\n### Constraints\n- `1 <= n <= 10^5`",
        "function_name": "countDerangements",
        "params": [{"name": "n", "type": "integer"}],
        "return_type": "integer",
        "comparison_mode": "exact",
        "constraints": ["1 <= n <= 10^5"],
        "hints": [
            "Use the recurrence D(n) = (n - 1) * (D(n - 1) + D(n - 2)) modulo 10^9 + 7.",
            "Base cases: D(1) = 0, D(2) = 1."
        ],
        "acceptance_rate": 66.80,
        "total_submissions": 49800,
        "display_order": 2086,
        "test_cases": p81_cases
    })

    # 82. Counting Necklaces (Burnside's Lemma)
    def solve_counting_necklaces(n, m):
        MOD = 10**9 + 7
        total = 0
        for i in range(n):
            g = math.gcd(i, n)
            total = (total + pow(m, g, MOD)) % MOD
        inv_n = pow(n, MOD - 2, MOD)
        return (total * inv_n) % MOD

    p82_cases = [
        {"inputs": {"n": 4, "m": 3}, "is_sample": True, "explanation": "(3^4 + 3^1 + 3^2 + 3^1) / 4 = (81 + 3 + 9 + 3) / 4 = 96 / 4 = 24."},
        {"inputs": {"n": 3, "m": 2}, "is_sample": True, "explanation": "(2^3 + 2^1 + 2^1) / 3 = 12 / 3 = 4."},
        {"inputs": {"n": 1, "m": 5}, "is_sample": False, "explanation": None},
        {"inputs": {"n": 5, "m": 2}, "is_sample": False, "explanation": None},
        {"inputs": {"n": 6, "m": 3}, "is_sample": False, "explanation": None},
    ]
    for c in p82_cases:
        c["expected_output"] = solve_counting_necklaces(c["inputs"]["n"], c["inputs"]["m"])

    problems.append({
        "slug": "counting-necklaces",
        "title": "Counting Necklaces",
        "difficulty": "hard",
        "tags": ["Math", "Combinatorics", "Group Theory"],
        "companies": ["Google", "Citadel", "Two Sigma"],
        "description": "Your task is to count the number of different necklaces that can be made using `n` pearls and `m` different colors.\n\nTwo necklaces are considered identical if one can be rotated into the other.\n\nReturn the count modulo $10^9 + 7$.\n\n### Constraints\n- `1 <= n, m <= 10^5`",
        "function_name": "countNecklaces",
        "params": [{"name": "n", "type": "integer"}, {"name": "m", "type": "integer"}],
        "return_type": "integer",
        "comparison_mode": "exact",
        "constraints": ["1 <= n, m <= 10^5"],
        "hints": [
            "Use Burnside's Lemma over the cyclic rotation group C_n.",
            "Sum m^gcd(i, n) for all 0 <= i < n, then multiply by n^(-1) modulo 10^9 + 7."
        ],
        "acceptance_rate": 48.70,
        "total_submissions": 34100,
        "display_order": 2087,
        "test_cases": p82_cases
    })

    # 83. Nim Game Classic
    def solve_nim(heaps):
        xor_sum = 0
        for h in heaps:
            xor_sum ^= h
        return xor_sum != 0

    p83_cases = [
        {"inputs": {"heaps": [1, 2, 3]}, "is_sample": True, "explanation": "1 ^ 2 ^ 3 = 0, second player wins (returns false)."},
        {"inputs": {"heaps": [1, 2, 4]}, "is_sample": True, "explanation": "1 ^ 2 ^ 4 = 7 != 0, first player wins (returns true)."},
        {"inputs": {"heaps": [5]}, "is_sample": False, "explanation": None},
        {"inputs": {"heaps": [4, 4]}, "is_sample": False, "explanation": None},
        {"inputs": {"heaps": [3, 4, 5]}, "is_sample": False, "explanation": None},
    ]
    for c in p83_cases:
        c["expected_output"] = solve_nim(c["inputs"]["heaps"])

    problems.append({
        "slug": "nim-game-classic",
        "title": "Nim Game Classic",
        "difficulty": "medium",
        "tags": ["Game Theory", "Bit Manipulation"],
        "companies": ["Amazon", "Google", "Goldman Sachs"],
        "description": "There are `n` heaps of matchsticks, where `heaps[i]` is the number of matchsticks in heap `i`.\n\nTwo players take turns. In each turn, a player chooses one heap and removes any positive number of matchsticks from it. The last player to move wins.\n\nAssuming both players play optimally, return `true` if the first player can force a victory, or `false` otherwise.\n\n### Constraints\n- `1 <= heaps.length <= 10^5`\n- `1 <= heaps[i] <= 10^9`",
        "function_name": "canWinNim",
        "params": [{"name": "heaps", "type": "integer[]"}],
        "return_type": "boolean",
        "comparison_mode": "exact",
        "constraints": ["1 <= heaps.length <= 10^5"],
        "hints": [
            "Bouton's Theorem: A game position is a winning position if and only if the bitwise XOR sum of all heap sizes is non-zero."
        ],
        "acceptance_rate": 69.80,
        "total_submissions": 59400,
        "display_order": 2088,
        "test_cases": p83_cases
    })

    # 84. Stair Game Nim
    def solve_stair_game(stairs):
        xor_sum = 0
        for i, val in enumerate(stairs, 1):
            if i % 2 == 0:  # step index from 1: balls on step i move to i-1
                # Notice in standard stair game: moving from step i to i-1
                # corresponds to nim on odd-indexed steps
                pass
        # Correct Stair Nim: only odd-numbered steps (or even depending on 0/1 indexing) affect nim-sum
        # With 1-based steps 1, 2, ..., n: moving from step k to k-1 means step 1 balls go to step 0 (removed)
        # So balls on even steps can always be mirrored by the other player if moved!
        # Thus the game is isomorphic to Nim played on balls on odd-numbered steps!
        for i in range(1, len(stairs), 2):
            xor_sum ^= stairs[i]
        return xor_sum != 0

    p84_cases = [
        {"inputs": {"stairs": [0, 2, 1]}, "is_sample": True, "explanation": "Step 2 has 2 balls. XOR sum = 2 != 0, first player wins."},
        {"inputs": {"stairs": [1, 1, 1]}, "is_sample": True, "explanation": "Step 2 has 1 ball. 1 != 0, first player wins."},
        {"inputs": {"stairs": [0, 0]}, "is_sample": False, "explanation": None},
        {"inputs": {"stairs": [5, 4, 3, 2, 1]}, "is_sample": False, "explanation": None},
    ]
    for c in p84_cases:
        c["expected_output"] = solve_stair_game(c["inputs"]["stairs"])

    problems.append({
        "slug": "stair-game-nim",
        "title": "Stair Game Nim",
        "difficulty": "hard",
        "tags": ["Game Theory", "Bit Manipulation"],
        "companies": ["Google", "Citadel", "Two Sigma"],
        "description": "There is a staircase with `n` steps numbered `1` to `n`, where step `i` contains `stairs[i - 1]` balls.\n\nOn each turn, a player may move any positive number of balls from step `i` down to step `i - 1` (balls moved down from step 1 are removed from the game). The last player to move wins.\n\nAssuming both players play optimally, return `true` if the first player can force a victory, or `false` otherwise.\n\n### Constraints\n- `1 <= stairs.length <= 10^5`\n- `0 <= stairs[i] <= 10^9`",
        "function_name": "canWinStairGame",
        "params": [{"name": "stairs", "type": "integer[]"}],
        "return_type": "boolean",
        "comparison_mode": "exact",
        "constraints": ["1 <= stairs.length <= 10^5"],
        "hints": [
            "Staircase Nim reduces directly to standard Nim on odd-indexed steps.",
            "Any move made from an even-indexed step can be mirrored immediately by the other player."
        ],
        "acceptance_rate": 52.30,
        "total_submissions": 31200,
        "display_order": 2089,
        "test_cases": p84_cases
    })

    # 85. Grundy's Game
    def solve_grundy(n):
        # Grundy game: split heap of size x into two unequal heaps a + b = x, a != b
        # Periodic/repeats or precompute Sprague-Grundy up to n
        memo = {1: 0, 2: 0}
        def get_g(x):
            if x in memo:
                return memo[x]
            seen = set()
            for a in range(1, (x + 1) // 2):
                b = x - a
                if a != b:
                    seen.add(get_g(a) ^ get_g(b))
            mex = 0
            while mex in seen:
                mex += 1
            memo[x] = mex
            return mex

        return get_g(n) != 0

    p85_cases = [
        {"inputs": {"n": 7}, "is_sample": True, "explanation": "For n=7, first player has a winning split (returns true)."},
        {"inputs": {"n": 4}, "is_sample": True, "explanation": "4 can only split into 1 and 3. G(1)=0, G(3)=G(1)+G(2)=0. XOR=0, first player loses (returns false)."},
        {"inputs": {"n": 1}, "is_sample": False, "explanation": None},
        {"inputs": {"n": 2}, "is_sample": False, "explanation": None},
        {"inputs": {"n": 3}, "is_sample": False, "explanation": None},
        {"inputs": {"n": 5}, "is_sample": False, "explanation": None},
        {"inputs": {"n": 8}, "is_sample": False, "explanation": None},
        {"inputs": {"n": 15}, "is_sample": False, "explanation": None},
    ]
    for c in p85_cases:
        c["expected_output"] = solve_grundy(c["inputs"]["n"])

    problems.append({
        "slug": "grundys-game",
        "title": "Grundy's Game",
        "difficulty": "hard",
        "tags": ["Game Theory", "Sprague-Grundy"],
        "companies": ["Google", "Bloomberg", "Two Sigma"],
        "description": "In Grundy's Game, there is initially a single heap of `n` coins.\n\nTwo players take turns. In each turn, a player chooses any existing heap and splits it into two non-empty heaps of strictly different sizes ($a + b = heap, a \\neq b$).\n\nThe first player who cannot make a valid split loses. Assuming optimal play, return `true` if the first player can win, or `false` otherwise.\n\n### Constraints\n- `1 <= n <= 1000`",
        "function_name": "canWinGrundyGame",
        "params": [{"name": "n", "type": "integer"}],
        "return_type": "boolean",
        "comparison_mode": "exact",
        "constraints": ["1 <= n <= 1000"],
        "hints": [
            "Use the Sprague-Grundy theorem.",
            "G(x) = mex({G(a) ^ G(x - a) for 1 <= a < x / 2}). If G(n) != 0, the first player wins."
        ],
        "acceptance_rate": 46.10,
        "total_submissions": 28900,
        "display_order": 2090,
        "test_cases": p85_cases
    })

    # 86. Friends Pairing Problem
    def solve_friends_pairing(n):
        if n <= 2:
            return n
        MOD = 10**9 + 7
        a, b = 1, 2
        for i in range(3, n + 1):
            c = (b + (i - 1) * a) % MOD
            a, b = b, c
        return b

    p86_cases = [
        {"inputs": {"n": 3}, "is_sample": True, "explanation": "4 ways: {1}, {2}, {3} or {1, 2}, {3} or {1, 3}, {2} or {2, 3}, {1}."},
        {"inputs": {"n": 2}, "is_sample": True, "explanation": "2 ways: {1}, {2} or {1, 2}."},
        {"inputs": {"n": 1}, "is_sample": False, "explanation": None},
        {"inputs": {"n": 4}, "is_sample": False, "explanation": None},
        {"inputs": {"n": 10}, "is_sample": False, "explanation": None},
        {"inputs": {"n": 100}, "is_sample": False, "explanation": None},
    ]
    for c in p86_cases:
        c["expected_output"] = solve_friends_pairing(c["inputs"]["n"])

    problems.append({
        "slug": "friends-pairing",
        "title": "Friends Pairing Problem",
        "difficulty": "medium",
        "tags": ["Dynamic Programming", "Combinatorics"],
        "companies": ["Amazon", "Microsoft", "Goldman Sachs"],
        "description": "Given `n` friends, each person can either remain single or be paired up with some other friend. Each friend can be paired at most once.\n\nFind the total number of ways in which the `n` friends can remain single or be paired up. Return the result modulo $10^9 + 7$.\n\n### Constraints\n- `1 <= n <= 10^5`",
        "function_name": "countFriendsPairings",
        "params": [{"name": "n", "type": "integer"}],
        "return_type": "integer",
        "comparison_mode": "exact",
        "constraints": ["1 <= n <= 10^5"],
        "hints": [
            "Friend n can either remain single (leaving f(n - 1) ways), or pair with any of the n - 1 other friends (leaving f(n - 2) ways).",
            "Recurrence: f(n) = f(n - 1) + (n - 1) * f(n - 2) modulo 10^9 + 7."
        ],
        "acceptance_rate": 62.80,
        "total_submissions": 71200,
        "display_order": 2091,
        "test_cases": p86_cases
    })

    # 87. Painting Fence Algorithm
    def solve_painting_fence(n, k):
        if n == 1:
            return k
        MOD = 10**9 + 7
        same = k
        diff = k * (k - 1)
        for _ in range(3, n + 1):
            prev_diff = diff
            diff = ((same + diff) * (k - 1)) % MOD
            same = prev_diff
        return (same + diff) % MOD

    p87_cases = [
        {"inputs": {"n": 3, "k": 2}, "is_sample": True, "explanation": "6 ways to paint 3 posts with 2 colors such that at most 2 adjacent posts have the same color."},
        {"inputs": {"n": 2, "k": 4}, "is_sample": True, "explanation": "4 + 4*3 = 16 ways."},
        {"inputs": {"n": 1, "k": 3}, "is_sample": False, "explanation": None},
        {"inputs": {"n": 4, "k": 3}, "is_sample": False, "explanation": None},
        {"inputs": {"n": 10, "k": 2}, "is_sample": False, "explanation": None},
    ]
    for c in p87_cases:
        c["expected_output"] = solve_painting_fence(c["inputs"]["n"], c["inputs"]["k"])

    problems.append({
        "slug": "painting-fence",
        "title": "Painting Fence Algorithm",
        "difficulty": "medium",
        "tags": ["Dynamic Programming"],
        "companies": ["Amazon", "Google", "Facebook"],
        "description": "Given a fence with `n` posts and `k` colors, find the total number of ways to paint the fence so that at most two adjacent posts have the same color.\n\nReturn the answer modulo $10^9 + 7$.\n\n### Constraints\n- `1 <= n <= 10^5`\n- `1 <= k <= 10^5`",
        "function_name": "countWaysToPaintFence",
        "params": [{"name": "n", "type": "integer"}, {"name": "k", "type": "integer"}],
        "return_type": "integer",
        "comparison_mode": "exact",
        "constraints": ["1 <= n <= 10^5", "1 <= k <= 10^5"],
        "hints": [
            "Keep two counts: same (last two posts have identical colors) and diff (last two posts have different colors).",
            "same_new = diff_prev, diff_new = (same_prev + diff_prev) * (k - 1)."
        ],
        "acceptance_rate": 57.40,
        "total_submissions": 58300,
        "display_order": 2092,
        "test_cases": p87_cases
    })

    # 88. Gold Mine Problem
    def solve_gold_mine(mine):
        if not mine or not mine[0]:
            return 0
        R, C = len(mine), len(mine[0])
        dp = [row[:] for row in mine]
        for c in range(1, C):
            for r in range(R):
                up_left = dp[r - 1][c - 1] if r > 0 else 0
                left = dp[r][c - 1]
                down_left = dp[r + 1][c - 1] if r < R - 1 else 0
                dp[r][c] += max(up_left, left, down_left)
        return max(dp[r][C - 1] for r in range(R))

    p88_cases = [
        {
            "inputs": {
                "mine": [
                    [1, 3, 3],
                    [2, 1, 4],
                    [0, 6, 4]
                ]
            },
            "is_sample": True,
            "explanation": "Path (2, 0) -> (1, 1) -> (1, 2) or (2, 1) gives 2 + 6 + 4 = 12."
        },
        {
            "inputs": {
                "mine": [
                    [1, 3, 1, 5],
                    [2, 2, 4, 1],
                    [5, 0, 2, 3],
                    [0, 6, 1, 2]
                ]
            },
            "is_sample": True,
            "explanation": "Max gold collected is 16."
        },
        {
            "inputs": {
                "mine": [[10, 20, 30]]
            },
            "is_sample": False,
            "explanation": None
        },
        {
            "inputs": {
                "mine": [[1], [5], [3]]
            },
            "is_sample": False,
            "explanation": None
        }
    ]
    for c in p88_cases:
        c["expected_output"] = solve_gold_mine(c["inputs"]["mine"])

    problems.append({
        "slug": "gold-mine-dp",
        "title": "Gold Mine Problem",
        "difficulty": "medium",
        "tags": ["Dynamic Programming", "Matrix"],
        "companies": ["Amazon", "Samsung", "Flipkart"],
        "description": "Given a gold mine of size `R x C` where `mine[r][c]` is the amount of gold in cell `(r, c)`.\n\nThe miner starts at any cell in the first column and moves to the right column by stepping right-up `(r - 1, c + 1)`, right `(r, c + 1)`, or right-down `(r + 1, c + 1)`.\n\nFind the maximum amount of gold the miner can collect upon reaching the last column.\n\n### Constraints\n- `1 <= R, C <= 500`\n- `0 <= mine[r][c] <= 1000`",
        "function_name": "maxGold",
        "params": [{"name": "mine", "type": "integer[][]"}],
        "return_type": "integer",
        "comparison_mode": "exact",
        "constraints": ["1 <= mine.length, mine[0].length <= 500"],
        "hints": [
            "Use dynamic programming column by column from left to right.",
            "dp[r][c] = mine[r][c] + max(dp[r - 1][c - 1], dp[r][c - 1], dp[r + 1][c - 1])."
        ],
        "acceptance_rate": 64.20,
        "total_submissions": 62100,
        "display_order": 2093,
        "test_cases": p88_cases
    })

    # 89. Assembly Line Scheduling
    def solve_assembly_line(a, t, e, x):
        n = len(a[0])
        f1 = [0] * n
        f2 = [0] * n

        f1[0] = e[0] + a[0][0]
        f2[0] = e[1] + a[1][0]

        for j in range(1, n):
            f1[j] = min(f1[j - 1] + a[0][j], f2[j - 1] + t[1][j - 1] + a[0][j])
            f2[j] = min(f2[j - 1] + a[1][j], f1[j - 1] + t[0][j - 1] + a[1][j])

        return min(f1[n - 1] + x[0], f2[n - 1] + x[1])

    p89_cases = [
        {
            "inputs": {
                "a": [[4, 5, 3, 2], [2, 10, 1, 4]],
                "t": [[7, 4, 5], [9, 2, 8]],
                "e": [10, 12],
                "x": [18, 7]
            },
            "is_sample": True,
            "explanation": "Optimal assembly time is 35."
        },
        {
            "inputs": {
                "a": [[7, 9, 3], [8, 5, 6]],
                "t": [[2, 3], [2, 1]],
                "e": [2, 4],
                "x": [3, 2]
            },
            "is_sample": True,
            "explanation": "Optimal time is 23."
        },
        {
            "inputs": {
                "a": [[5], [5]],
                "t": [[0], [0]],
                "e": [2, 2],
                "x": [3, 3]
            },
            "is_sample": False,
            "explanation": None
        }
    ]
    for c in p89_cases:
        c["expected_output"] = solve_assembly_line(c["inputs"]["a"], c["inputs"]["t"], c["inputs"]["e"], c["inputs"]["x"])

    problems.append({
        "slug": "assembly-line-scheduling",
        "title": "Assembly Line Scheduling",
        "difficulty": "medium",
        "tags": ["Dynamic Programming"],
        "companies": ["Amazon", "Microsoft", "Intel"],
        "description": "A car factory has two parallel assembly lines with `n` processing stations each.\n\nStation `j` on line `i` takes `a[i][j]` time. Moving from station $j$ on line $i$ to station $j + 1$ on the other line takes transition time `t[i][j]`.\n\nEntry and exit times for the two lines are given by arrays `e` and `x` of length 2.\n\nFind the minimum time required to assemble a car from start to finish.\n\n### Constraints\n- `1 <= a[0].length == a[1].length <= 10^4`\n- `e.length == x.length == 2`",
        "function_name": "carAssembly",
        "params": [
            {"name": "a", "type": "integer[][]"},
            {"name": "t", "type": "integer[][]"},
            {"name": "e", "type": "integer[]"},
            {"name": "x", "type": "integer[]"}
        ],
        "return_type": "integer",
        "comparison_mode": "exact",
        "constraints": ["1 <= a[0].length <= 10000", "e.length == 2", "x.length == 2"],
        "hints": [
            "Let f1[j] and f2[j] be the minimum times to leave station j on line 1 and line 2 respectively.",
            "f1[j] = min(f1[j - 1] + a[0][j], f2[j - 1] + t[1][j - 1] + a[0][j])."
        ],
        "acceptance_rate": 65.10,
        "total_submissions": 41200,
        "display_order": 2094,
        "test_cases": p89_cases
    })

    # 90. Traveling Salesperson Problem (Held-Karp)
    def solve_tsp(dist):
        n = len(dist)
        memo = {}

        def tsp(mask, u):
            if mask == (1 << n) - 1:
                return dist[u][0]
            if (mask, u) in memo:
                return memo[(mask, u)]
            res = float('inf')
            for v in range(n):
                if not (mask & (1 << v)):
                    res = min(res, dist[u][v] + tsp(mask | (1 << v), v))
            memo[(mask, u)] = res
            return res

        return tsp(1, 0)

    p90_cases = [
        {
            "inputs": {
                "dist": [
                    [0, 10, 15, 20],
                    [10, 0, 35, 25],
                    [15, 35, 0, 30],
                    [20, 25, 30, 0]
                ]
            },
            "is_sample": True,
            "explanation": "0 -> 1 -> 3 -> 2 -> 0 has cost 10 + 25 + 30 + 15 = 80."
        },
        {
            "inputs": {
                "dist": [
                    [0, 20, 42, 25],
                    [20, 0, 30, 34],
                    [42, 30, 0, 10],
                    [25, 34, 10, 0]
                ]
            },
            "is_sample": True,
            "explanation": "0 -> 1 -> 2 -> 3 -> 0 has cost 20 + 30 + 10 + 25 = 85."
        },
        {
            "inputs": {
                "dist": [
                    [0, 5],
                    [5, 0]
                ]
            },
            "is_sample": False,
            "explanation": None
        },
        {
            "inputs": {
                "dist": [
                    [0, 1, 2],
                    [1, 0, 3],
                    [2, 3, 0]
                ]
            },
            "is_sample": False,
            "explanation": None
        }
    ]
    for c in p90_cases:
        c["expected_output"] = solve_tsp(c["inputs"]["dist"])

    problems.append({
        "slug": "traveling-salesperson-bitmask",
        "title": "Traveling Salesperson Problem",
        "difficulty": "hard",
        "tags": ["Dynamic Programming", "Bit Manipulation"],
        "companies": ["Google", "Amazon", "Uber"],
        "description": "Given an `n x n` distance matrix where `dist[i][j]` is the distance between city `i` and city `j`.\n\nFind the minimum travel cost of a complete tour that starts at city 0, visits every other city exactly once, and returns to city 0 using the Held-Karp dynamic programming algorithm with bitmasking.\n\n### Constraints\n- `2 <= n <= 14`\n- `0 <= dist[i][j] <= 10^4`",
        "function_name": "tspBitmask",
        "params": [{"name": "dist", "type": "integer[][]"}],
        "return_type": "integer",
        "comparison_mode": "exact",
        "constraints": ["2 <= dist.length <= 14"],
        "hints": [
            "Use bitmask DP: dp(mask, u) is the minimum cost to visit all remaining unvisited cities starting from current city u.",
            "Base case: when mask == (1 << n) - 1, return dist[u][0]."
        ],
        "acceptance_rate": 39.80,
        "total_submissions": 51200,
        "display_order": 2095,
        "test_cases": p90_cases
    })

    # 91. Hamiltonian Path Check
    def solve_hamiltonian(n, edges):
        adj = [0] * n
        for u, v in edges:
            adj[u] |= (1 << v)
            adj[v] |= (1 << u)

        dp = [[False] * n for _ in range(1 << n)]
        for i in range(n):
            dp[1 << i][i] = True

        for mask in range(1, 1 << n):
            for u in range(n):
                if dp[mask][u]:
                    for v in range(n):
                        if not (mask & (1 << v)) and (adj[u] & (1 << v)):
                            dp[mask | (1 << v)][v] = True

        full = (1 << n) - 1
        return any(dp[full][u] for u in range(n))

    p91_cases = [
        {
            "inputs": {
                "n": 4,
                "edges": [[0, 1], [1, 2], [2, 3]]
            },
            "is_sample": True,
            "explanation": "Path 0 -> 1 -> 2 -> 3 visits every vertex exactly once."
        },
        {
            "inputs": {
                "n": 4,
                "edges": [[0, 1], [0, 2], [0, 3]]
            },
            "is_sample": True,
            "explanation": "Star graph with 3 leaves cannot have a Hamiltonian path visiting all 4 nodes."
        },
        {
            "inputs": {
                "n": 1,
                "edges": []
            },
            "is_sample": False,
            "explanation": None
        },
        {
            "inputs": {
                "n": 5,
                "edges": [[0, 1], [1, 2], [2, 3], [3, 4], [4, 0], [0, 2]]
            },
            "is_sample": False,
            "explanation": None
        }
    ]
    for c in p91_cases:
        c["expected_output"] = solve_hamiltonian(c["inputs"]["n"], c["inputs"]["edges"])

    problems.append({
        "slug": "hamiltonian-cycle",
        "title": "Hamiltonian Path Check",
        "difficulty": "medium",
        "tags": ["Graph", "Bit Manipulation", "Dynamic Programming"],
        "companies": ["Amazon", "Microsoft", "Directi"],
        "description": "Given an undirected graph with `n` vertices (numbered `0` to `n - 1`) and an array of `edges`.\n\nDetermine whether there exists a Hamiltonian path (a path that visits every vertex in the graph exactly once).\n\nReturn `true` if a Hamiltonian path exists, or `false` otherwise.\n\n### Constraints\n- `1 <= n <= 14`\n- `0 <= edges.length <= n * (n - 1) / 2`",
        "function_name": "hasHamiltonianPath",
        "params": [
            {"name": "n", "type": "integer"},
            {"name": "edges", "type": "integer[][]"}
        ],
        "return_type": "boolean",
        "comparison_mode": "exact",
        "constraints": ["1 <= n <= 14"],
        "hints": [
            "Use bitmask dynamic programming: dp[mask][u] is true if there exists a path visiting all vertices in mask ending at u.",
            "Iterate over masks from 1 to (1 << n) - 1."
        ],
        "acceptance_rate": 52.40,
        "total_submissions": 41200,
        "display_order": 2096,
        "test_cases": p91_cases
    })

    # 92. Snakes and Ladders Minimum Moves
    def solve_snakes_and_ladders(board):
        n = len(board) - 1
        visited = [False] * (n + 1)
        q = deque([(1, 0)])
        visited[1] = True

        while q:
            curr, moves = q.popleft()
            if curr == n:
                return moves
            for dice in range(1, 7):
                nxt = curr + dice
                if nxt <= n:
                    dest = board[nxt] if board[nxt] != -1 else nxt
                    if not visited[dest]:
                        visited[dest] = True
                        q.append((dest, moves + 1))
        return -1

    p92_cases = [
        {
            "inputs": {
                "board": [-1, -1, -1, 9, -1, -1, -1, -1, -1, -1]  # ladder from 3 to 9 on board of 9 cells
            },
            "is_sample": True,
            "explanation": "Roll 2 lands on cell 3, taking ladder directly to cell 9 in 1 move."
        },
        {
            "inputs": {
                "board": [-1, -1, -1, -1, -1, -1, -1]
            },
            "is_sample": True,
            "explanation": "6 cells: roll 5 reaches cell 6 in 1 move."
        },
        {
            "inputs": {
                "board": [-1, -1, 1, -1]  # snake from 2 to 1
            },
            "is_sample": False,
            "explanation": None
        }
    ]
    for c in p92_cases:
        c["expected_output"] = solve_snakes_and_ladders(c["inputs"]["board"])

    problems.append({
        "slug": "snakes-and-ladders-bfs",
        "title": "Snakes and Ladders Minimum Moves",
        "difficulty": "medium",
        "tags": ["Graph", "BFS"],
        "companies": ["Amazon", "Microsoft", "Goldman Sachs"],
        "description": "You are playing a game of Snakes and Ladders on a 1D board of size `n` cells (numbered 1 to `n`).\n\nYou start at cell 1. On each turn, you roll a standard 6-sided die (values 1 to 6).\n\nAn array `board` of size $n + 1$ indicates whether each cell has a snake or ladder leading to `board[i]` (if `board[i] == -1`, there is no snake or ladder at cell $i$).\n\nFind the minimum number of die rolls required to reach cell `n`. If cell `n` is unreachable, return `-1`.\n\n### Constraints\n- `2 <= board.length <= 10^5`",
        "function_name": "snakesAndLaddersMinDice",
        "params": [{"name": "board", "type": "integer[]"}],
        "return_type": "integer",
        "comparison_mode": "exact",
        "constraints": ["2 <= board.length <= 10^5"],
        "hints": [
            "Model the board as an unweighted directed graph and use Breadth-First Search (BFS).",
            "Maintain a visited array to avoid cycling through snake/ladder loops."
        ],
        "acceptance_rate": 45.80,
        "total_submissions": 64800,
        "display_order": 2097,
        "test_cases": p92_cases
    })

    # 93. Monsters Grid Escape
    def solve_monsters(grid):
        R, C = len(grid), len(grid[0])
        monster_dist = [[float('inf')] * C for _ in range(R)]
        q = deque()

        start = None
        for r in range(R):
            for c in range(C):
                if grid[r][c] == 'M':
                    monster_dist[r][c] = 0
                    q.append((r, c))
                elif grid[r][c] == 'A':
                    start = (r, c)

        while q:
            r, c = q.popleft()
            for dr, dc in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                nr, nc = r + dr, c + dc
                if 0 <= nr < R and 0 <= nc < C and grid[nr][nc] != '#' and monster_dist[nr][nc] == float('inf'):
                    monster_dist[nr][nc] = monster_dist[r][c] + 1
                    q.append((nr, nc))

        # BFS for player A
        sr, sc = start
        player_dist = [[float('inf')] * C for _ in range(R)]
        player_dist[sr][sc] = 0
        q = deque([(sr, sc)])

        while q:
            r, c = q.popleft()
            if r == 0 or r == R - 1 or c == 0 or c == C - 1:
                return True
            for dr, dc in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                nr, nc = r + dr, c + dc
                if 0 <= nr < R and 0 <= nc < C and grid[nr][nc] != '#' and player_dist[nr][nc] == float('inf'):
                    if player_dist[r][c] + 1 < monster_dist[nr][nc]:
                        player_dist[nr][nc] = player_dist[r][c] + 1
                        q.append((nr, nc))
        return False

    p93_cases = [
        {
            "inputs": {
                "grid": [
                    "#####",
                    "#A#M#",
                    "#.#.#",
                    "#...#",
                    "#####"
                ]
            },
            "is_sample": True,
            "explanation": "No exit boundary cell is reachable."
        },
        {
            "inputs": {
                "grid": [
                    "####",
                    "#A.#",
                    "#.M#",
                    "#..#"
                ]
            },
            "is_sample": True,
            "explanation": "Player can escape to boundary if path is unobstructed."
        },
        {
            "inputs": {
                "grid": ["A"]
            },
            "is_sample": False,
            "explanation": None
        }
    ]
    for c in p93_cases:
        c["expected_output"] = solve_monsters(c["inputs"]["grid"])

    problems.append({
        "slug": "monsters-grid",
        "title": "Monsters Grid Escape",
        "difficulty": "hard",
        "tags": ["Graph", "BFS", "Matrix"],
        "companies": ["Google", "Amazon", "Citadel"],
        "description": "You are trapped in a labyrinth. You are at cell 'A', monsters are located at cells 'M', '#' represents an impassable wall, and '.' is an open floor tile.\n\nEvery second, you can walk one step in the four cardinal directions; monsters also move at the same speed. A monster can intercept you if it reaches a cell at or before you do.\n\nCan you escape the labyrinth through any boundary edge cell without being caught? Return `true` if escape is possible, `false` otherwise.\n\n### Constraints\n- `1 <= grid.length, grid[0].length <= 500`",
        "function_name": "canEscapeMonsters",
        "params": [{"name": "grid", "type": "string[]"}],
        "return_type": "boolean",
        "comparison_mode": "exact",
        "constraints": ["1 <= grid.length, grid[0].length <= 500"],
        "hints": [
            "Use multi-source BFS starting from all monsters to compute monster_dist[r][c].",
            "Run a second BFS for the player: you can only step into (nr, nc) if player_time + 1 < monster_dist[nr][nc]."
        ],
        "acceptance_rate": 44.20,
        "total_submissions": 41200,
        "display_order": 2098,
        "test_cases": p93_cases
    })

    # 94. Game Routes DAG Paths Count
    def solve_game_routes(n, edges):
        MOD = 10**9 + 7
        in_degree = [0] * (n + 1)
        adj = [[] for _ in range(n + 1)]
        for u, v in edges:
            adj[u].append(v)
            in_degree[v] += 1

        dp = [0] * (n + 1)
        dp[1] = 1
        q = deque([i for i in range(1, n + 1) if in_degree[i] == 0])

        while q:
            u = q.popleft()
            for v in adj[u]:
                dp[v] = (dp[v] + dp[u]) % MOD
                in_degree[v] -= 1
                if in_degree[v] == 0:
                    q.append(v)
        return dp[n]

    p94_cases = [
        {
            "inputs": {
                "n": 4,
                "edges": [[1, 2], [2, 4], [1, 3], [3, 4], [1, 4]]
            },
            "is_sample": True,
            "explanation": "3 routes from 1 to 4: 1->2->4, 1->3->4, and 1->4."
        },
        {
            "inputs": {
                "n": 3,
                "edges": [[1, 2], [2, 3]]
            },
            "is_sample": True,
            "explanation": "Only 1 route: 1->2->3."
        },
        {
            "inputs": {
                "n": 2,
                "edges": []
            },
            "is_sample": False,
            "explanation": None
        }
    ]
    for c in p94_cases:
        c["expected_output"] = solve_game_routes(c["inputs"]["n"], c["inputs"]["edges"])

    problems.append({
        "slug": "game-routes",
        "title": "Game Routes DAG Paths Count",
        "difficulty": "medium",
        "tags": ["Graph", "Dynamic Programming", "Topological Sort"],
        "companies": ["Amazon", "Uber", "Microsoft"],
        "description": "A game has `n` levels numbered `1` to `n` and `m` directed pathways between levels forming a Directed Acyclic Graph (DAG).\n\nCount the number of different ways you can play through the game from level `1` to level `n`. Return the answer modulo $10^9 + 7$.\n\n### Constraints\n- `1 <= n <= 10^5`\n- `0 <= edges.length <= 2 * 10^5`",
        "function_name": "countGameRoutes",
        "params": [
            {"name": "n", "type": "integer"},
            {"name": "edges", "type": "integer[][]"}
        ],
        "return_type": "integer",
        "comparison_mode": "exact",
        "constraints": ["1 <= n <= 10^5", "edges.length <= 200000"],
        "hints": [
            "Process vertices in topological order using Kahn's algorithm.",
            "For each edge u -> v, dp[v] = (dp[v] + dp[u]) % (10^9 + 7)."
        ],
        "acceptance_rate": 61.40,
        "total_submissions": 53400,
        "display_order": 2099,
        "test_cases": p94_cases
    })

    # 95. Longest Flight Route in DAG
    def solve_longest_flight_route(n, flights):
        in_degree = [0] * (n + 1)
        adj = [[] for _ in range(n + 1)]
        for u, v in flights:
            adj[u].append(v)
            in_degree[v] += 1

        dist = [-float('inf')] * (n + 1)
        parent = [-1] * (n + 1)
        dist[1] = 1

        q = deque([i for i in range(1, n + 1) if in_degree[i] == 0])
        while q:
            u = q.popleft()
            for v in adj[u]:
                if dist[u] != -float('inf') and dist[u] + 1 > dist[v]:
                    dist[v] = dist[u] + 1
                    parent[v] = u
                in_degree[v] -= 1
                if in_degree[v] == 0:
                    q.append(v)

        if dist[n] == -float('inf'):
            return []
        path = []
        curr = n
        while curr != -1:
            path.append(curr)
            curr = parent[curr]
        return path[::-1]

    p95_cases = [
        {
            "inputs": {
                "n": 5,
                "flights": [[1, 2], [2, 3], [3, 5], [1, 4], [4, 5], [2, 4]]
            },
            "is_sample": True,
            "explanation": "Longest route is 1 -> 2 -> 4 -> 5 (4 cities) or 1 -> 2 -> 3 -> 5."
        },
        {
            "inputs": {
                "n": 3,
                "flights": [[1, 2]]
            },
            "is_sample": True,
            "explanation": "City 3 cannot be reached from 1, returns []."
        },
        {
            "inputs": {
                "n": 2,
                "flights": [[1, 2]]
            },
            "is_sample": False,
            "explanation": None
        }
    ]
    for c in p95_cases:
        c["expected_output"] = solve_longest_flight_route(c["inputs"]["n"], c["inputs"]["flights"])

    problems.append({
        "slug": "longest-flight-route",
        "title": "Longest Flight Route in DAG",
        "difficulty": "medium",
        "tags": ["Graph", "Dynamic Programming", "Topological Sort"],
        "companies": ["Google", "Bloomberg", "Two Sigma"],
        "description": "You want to fly from city `1` to city `n` through a network of one-way flights (forming a DAG) so that you visit the maximum number of cities possible.\n\nReturn the sequence of cities visited on the longest route, starting at `1` and ending at `n`. If no route exists from `1` to `n`, return an empty array `[]`.\n\n### Constraints\n- `2 <= n <= 10^5`\n- `1 <= flights.length <= 2 * 10^5`",
        "function_name": "longestFlightRoute",
        "params": [
            {"name": "n", "type": "integer"},
            {"name": "flights", "type": "integer[][]"}
        ],
        "return_type": "integer[]",
        "comparison_mode": "exact",
        "constraints": ["2 <= n <= 10^5", "flights.length <= 200000"],
        "hints": [
            "Use topological sorting on the DAG.",
            "Relax dist[v] = dist[u] + 1 along with parent pointers to reconstruct the longest path."
        ],
        "acceptance_rate": 53.80,
        "total_submissions": 46200,
        "display_order": 2100,
        "test_cases": p95_cases
    })

    # 96. Cycle Finding in Directed Graph
    def solve_has_cycle_directed(n, edges):
        adj = [[] for _ in range(n)]
        in_degree = [0] * n
        for u, v in edges:
            adj[u].append(v)
            in_degree[v] += 1

        q = deque([i for i in range(n) if in_degree[i] == 0])
        visited_count = 0
        while q:
            u = q.popleft()
            visited_count += 1
            for v in adj[u]:
                in_degree[v] -= 1
                if in_degree[v] == 0:
                    q.append(v)

        return visited_count < n

    p96_cases = [
        {
            "inputs": {
                "n": 4,
                "edges": [[0, 1], [1, 2], [2, 3], [3, 1]]
            },
            "is_sample": True,
            "explanation": "Contains cycle 1 -> 2 -> 3 -> 1."
        },
        {
            "inputs": {
                "n": 4,
                "edges": [[0, 1], [1, 2], [2, 3]]
            },
            "is_sample": True,
            "explanation": "Simple line DAG, no cycle."
        },
        {
            "inputs": {
                "n": 1,
                "edges": []
            },
            "is_sample": False,
            "explanation": None
        },
        {
            "inputs": {
                "n": 2,
                "edges": [[0, 1], [1, 0]]
            },
            "is_sample": False,
            "explanation": None
        }
    ]
    for c in p96_cases:
        c["expected_output"] = solve_has_cycle_directed(c["inputs"]["n"], c["inputs"]["edges"])

    problems.append({
        "slug": "cycle-finding",
        "title": "Cycle Finding in Directed Graph",
        "difficulty": "medium",
        "tags": ["Graph", "BFS", "Topological Sort"],
        "companies": ["Amazon", "Microsoft", "Uber"],
        "description": "Given a directed graph with `n` vertices (numbered `0` to `n - 1`) and a list of directed `edges` where each edge is `[u, v]`.\n\nDetermine whether the graph contains any cycle. Return `true` if a directed cycle exists, or `false` otherwise.\n\n### Constraints\n- `1 <= n <= 10^5`\n- `0 <= edges.length <= 2 * 10^5`",
        "function_name": "hasCycleDirected",
        "params": [
            {"name": "n", "type": "integer"},
            {"name": "edges", "type": "integer[][]"}
        ],
        "return_type": "boolean",
        "comparison_mode": "exact",
        "constraints": ["1 <= n <= 10^5", "edges.length <= 200000"],
        "hints": [
            "Use Kahn's algorithm with in-degrees.",
            "If the number of processed vertices in topological order is less than n, a cycle exists."
        ],
        "acceptance_rate": 67.20,
        "total_submissions": 78900,
        "display_order": 2101,
        "test_cases": p96_cases
    })

    # 97. Hotel Queries
    def solve_hotel_queries(hotels, group_sizes):
        h = hotels[:]
        res = []
        for g in group_sizes:
            assigned = 0
            for i in range(len(h)):
                if h[i] >= g:
                    assigned = i + 1
                    h[i] -= g
                    break
            res.append(assigned)
        return res

    p97_cases = [
        {"inputs": {"hotels": [3, 2, 4, 1, 5, 5, 2, 6], "groupSizes": [4, 4, 7, 1, 1]}, "is_sample": True, "explanation": "Hotels assigned: [3, 5, 0, 1, 1]."},
        {"inputs": {"hotels": [1, 2, 3], "groupSizes": [4]}, "is_sample": True, "explanation": "No hotel has 4 rooms, returns [0]."},
        {"inputs": {"hotels": [10], "groupSizes": [5, 5]}, "is_sample": False, "explanation": None},
    ]
    for c in p97_cases:
        c["expected_output"] = solve_hotel_queries(c["inputs"]["hotels"], c["inputs"]["groupSizes"])

    problems.append({
        "slug": "hotel-queries",
        "title": "Hotel Queries",
        "difficulty": "medium",
        "tags": ["Segment Tree", "Binary Search"],
        "companies": ["Google", "Citadel", "Bloomberg"],
        "description": "There are `n` hotels with available rooms in `hotels`.\n\nA sequence of tourist groups arrive with room requests `groupSizes`. Each group is assigned to the first hotel that has enough rooms for them, reducing that hotel's available rooms by the group size. If no hotel has enough rooms, output `0`.\n\nReturn an array of assigned hotel indices (1-based).\n\n### Constraints\n- `1 <= hotels.length, groupSizes.length <= 10^5`\n- `1 <= hotels[i], groupSizes[i] <= 10^9`",
        "function_name": "hotelQueries",
        "params": [
            {"name": "hotels", "type": "integer[]"},
            {"name": "groupSizes", "type": "integer[]"}
        ],
        "return_type": "integer[]",
        "comparison_mode": "exact",
        "constraints": ["1 <= hotels.length <= 10^5"],
        "hints": [
            "Use a segment tree storing the maximum available rooms in each subtree.",
            "Traverse left whenever left child's maximum is >= group size to find the first valid hotel in O(log n)."
        ],
        "acceptance_rate": 51.60,
        "total_submissions": 38900,
        "display_order": 2102,
        "test_cases": p97_cases
    })

    # 98. List Removals
    def solve_list_removals(nums, positions):
        lst = nums[:]
        res = []
        for p in positions:
            res.append(lst.pop(p - 1))
        return res

    p98_cases = [
        {"inputs": {"nums": [2, 6, 1, 4, 2], "positions": [3, 1, 3, 1, 1]}, "is_sample": True, "explanation": "Remove 3rd (1), 1st (2), 3rd (2), 1st (6), 1st (4) -> [1, 2, 2, 6, 4]."},
        {"inputs": {"nums": [10, 20], "positions": [2, 1]}, "is_sample": True, "explanation": "[20, 10]."},
        {"inputs": {"nums": [5], "positions": [1]}, "is_sample": False, "explanation": None},
    ]
    for c in p98_cases:
        c["expected_output"] = solve_list_removals(c["inputs"]["nums"], c["inputs"]["positions"])

    problems.append({
        "slug": "list-removals",
        "title": "List Removals",
        "difficulty": "medium",
        "tags": ["Segment Tree", "Binary Indexed Tree"],
        "companies": ["Amazon", "Uber", "Two Sigma"],
        "description": "You are given a list of `n` numbers and a sequence of `n` removal queries.\n\nEach query specifies the 1-based index of an element to be removed from the current remaining list.\n\nReturn an array containing the removed numbers in the order of their removal.\n\n### Constraints\n- `1 <= nums.length == positions.length <= 10^5`",
        "function_name": "listRemovals",
        "params": [
            {"name": "nums", "type": "integer[]"},
            {"name": "positions", "type": "integer[]"}
        ],
        "return_type": "integer[]",
        "comparison_mode": "exact",
        "constraints": ["1 <= nums.length <= 10^5"],
        "hints": [
            "Use a Fenwick tree or Segment tree where active elements have weight 1.",
            "Use binary search or segment tree walk to find the k-th active element in O(log n) time."
        ],
        "acceptance_rate": 58.70,
        "total_submissions": 45300,
        "display_order": 2103,
        "test_cases": p98_cases
    })

    # 99. Count Total Set Bits from 1 to N
    def solve_count_set_bits(n):
        total = 0
        i = 0
        while (1 << i) <= n:
            period = 1 << (i + 1)
            full = (n + 1) // period
            rem = (n + 1) % period
            total += full * (1 << i) + max(0, rem - (1 << i))
            i += 1
        return total

    p99_cases = [
        {"inputs": {"n": 4}, "is_sample": True, "explanation": "1 (1), 2 (1), 3 (2), 4 (1) -> 1 + 1 + 2 + 1 = 5 bits."},
        {"inputs": {"n": 17}, "is_sample": True, "explanation": "Total 35 set bits."},
        {"inputs": {"n": 0}, "is_sample": False, "explanation": None},
        {"inputs": {"n": 1}, "is_sample": False, "explanation": None},
        {"inputs": {"n": 100}, "is_sample": False, "explanation": None},
        {"inputs": {"n": 1000000}, "is_sample": False, "explanation": None},
    ]
    for c in p99_cases:
        c["expected_output"] = solve_count_set_bits(c["inputs"]["n"])

    problems.append({
        "slug": "count-set-bits-1-to-n",
        "title": "Count Total Set Bits from 1 to N",
        "difficulty": "medium",
        "tags": ["Bit Manipulation", "Math"],
        "companies": ["Amazon", "Microsoft", "Directi"],
        "description": "Given a non-negative integer `n`, count the total number of set bits (1s) in the binary representations of all integers from `1` up to `n` in $O(\\log n)$ time.\n\nReturn the total count as a 64-bit integer.\n\n### Constraints\n- `0 <= n <= 10^9`",
        "function_name": "countSetBits",
        "params": [{"name": "n", "type": "integer"}],
        "return_type": "long",
        "comparison_mode": "exact",
        "constraints": ["0 <= n <= 10^9"],
        "hints": [
            "At bit position i (from 0 to 30), bits alternate in periods of 2^(i + 1) with 2^i ones per period."
        ],
        "acceptance_rate": 63.90,
        "total_submissions": 68400,
        "display_order": 2104,
        "test_cases": p99_cases
    })

    # 100. Unbounded Knapsack Problem
    def solve_unbounded_knapsack(capacity, values, weights):
        dp = [0] * (capacity + 1)
        for w in range(1, capacity + 1):
            for v, wt in zip(values, weights):
                if wt <= w:
                    dp[w] = max(dp[w], dp[w - wt] + v)
        return dp[capacity]

    p100_cases = [
        {"inputs": {"capacity": 8, "values": [10, 40, 50, 70], "weights": [1, 3, 4, 5]}, "is_sample": True, "explanation": "Take two of weight 3 (value 80) and two of weight 1 (value 20) -> 100, or other combo -> 110 (wt 5 + wt 3 = 70 + 40 = 110)."},
        {"inputs": {"capacity": 100, "values": [1, 30], "weights": [1, 50]}, "is_sample": True, "explanation": "Take 100 items of weight 1 for value 100."},
        {"inputs": {"capacity": 0, "values": [10], "weights": [5]}, "is_sample": False, "explanation": None},
        {"inputs": {"capacity": 50, "values": [10, 20, 30], "weights": [5, 10, 15]}, "is_sample": False, "explanation": None},
    ]
    for c in p100_cases:
        c["expected_output"] = solve_unbounded_knapsack(c["inputs"]["capacity"], c["inputs"]["values"], c["inputs"]["weights"])

    problems.append({
        "slug": "unbounded-knapsack",
        "title": "Unbounded Knapsack Problem",
        "difficulty": "medium",
        "tags": ["Dynamic Programming"],
        "companies": ["Amazon", "Google", "Microsoft"],
        "description": "Given a knapsack with maximum weight `capacity` and `n` items where the $i$-th item has value `values[i]` and weight `weights[i]`.\n\nYou may take an unlimited number of copies of each item.\n\nFind the maximum total value that can be accommodated in the knapsack.\n\n### Constraints\n- `1 <= capacity <= 10^4`\n- `1 <= values.length == weights.length <= 1000`\n- `1 <= values[i], weights[i] <= 10^4`",
        "function_name": "unboundedKnapsack",
        "params": [
            {"name": "capacity", "type": "integer"},
            {"name": "values", "type": "integer[]"},
            {"name": "weights", "type": "integer[]"}
        ],
        "return_type": "integer",
        "comparison_mode": "exact",
        "constraints": ["1 <= capacity <= 10000", "1 <= values.length <= 1000"],
        "hints": [
            "Use a 1D DP array dp[w] representing maximum value for weight w.",
            "dp[w] = max(dp[w], dp[w - weights[i]] + values[i]) for all items."
        ],
        "acceptance_rate": 61.20,
        "total_submissions": 78900,
        "display_order": 2105,
        "test_cases": p100_cases
    })

    return problems

