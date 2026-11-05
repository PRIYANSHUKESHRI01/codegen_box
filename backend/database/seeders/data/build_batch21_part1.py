# -*- coding: utf-8 -*-
"""
Batch 21 - Part 1: Problems 1 to 25 (Display Order 2006 to 2030)
Classic Recursion, Backtracking, and Dynamic Programming.
"""

def get_part1_problems():
    problems = []

    # 1. Tower of Hanoi
    def solve_hanoi(n):
        moves = []
        def helper(count, src, dst, aux):
            if count == 0:
                return
            helper(count - 1, src, aux, dst)
            moves.append([src, dst])
            helper(count - 1, aux, dst, src)
        helper(n, 1, 3, 2)
        return moves

    p1_cases = [
        {"inputs": {"n": 1}, "is_sample": True, "explanation": "Move disk 1 directly from rod 1 to rod 3."},
        {"inputs": {"n": 2}, "is_sample": True, "explanation": "Move disk 1 from 1 to 2, disk 2 from 1 to 3, then disk 1 from 2 to 3 (3 moves)."},
        {"inputs": {"n": 3}, "is_sample": True, "explanation": "Requires 2^3 - 1 = 7 moves."},
        {"inputs": {"n": 4}, "is_sample": False, "explanation": None},
        {"inputs": {"n": 5}, "is_sample": False, "explanation": None},
        {"inputs": {"n": 6}, "is_sample": False, "explanation": None},
        {"inputs": {"n": 7}, "is_sample": False, "explanation": None},
        {"inputs": {"n": 8}, "is_sample": False, "explanation": None},
    ]
    for c in p1_cases:
        c["expected_output"] = solve_hanoi(c["inputs"]["n"])

    problems.append({
        "slug": "tower-of-hanoi",
        "title": "Tower of Hanoi",
        "difficulty": "medium",
        "tags": ["Recursion", "Backtracking", "Divide and Conquer"],
        "companies": ["Amazon", "Microsoft", "Google", "Goldman Sachs"],
        "description": "The Tower of Hanoi is a classic mathematical puzzle consisting of three rods (numbered 1, 2, and 3) and `n` disks of different sizes.\n\nInitially, all `n` disks are stacked in increasing order of size on rod 1 (smallest disk at the top, largest at the bottom).\n\nThe objective is to transfer the entire stack from rod 1 to rod 3, following these rules:\n1. Only one disk can be moved at a time.\n2. In each move, the upper disk from one rod is taken and placed on top of another rod.\n3. No disk may be placed on top of a disk smaller than itself.\n\nReturn the sequence of moves required to complete the transfer in the minimum number of moves ($2^n - 1$). Each move should be represented as a two-element array `[from_rod, to_rod]`.\n\n### Constraints\n- `1 <= n <= 14`",
        "function_name": "towerOfHanoi",
        "params": [{"name": "n", "type": "integer"}],
        "return_type": "integer[][]",
        "comparison_mode": "exact",
        "constraints": ["1 <= n <= 14"],
        "hints": [
            "To move n disks from rod A to rod C, first move the top n - 1 disks to auxiliary rod B.",
            "Next, move the largest n-th disk directly from rod A to rod C.",
            "Finally, move the n - 1 disks from auxiliary rod B onto rod C using rod A as auxiliary."
        ],
        "acceptance_rate": 58.40,
        "total_submissions": 92100,
        "display_order": 2006,
        "test_cases": p1_cases
    })

    # 2. Tower of Hanoi Minimum Moves
    def solve_hanoi_min_moves(n):
        return (1 << n) - 1

    p2_cases = [
        {"inputs": {"n": 1}, "is_sample": True, "explanation": "2^1 - 1 = 1 move."},
        {"inputs": {"n": 3}, "is_sample": True, "explanation": "2^3 - 1 = 7 moves."},
        {"inputs": {"n": 4}, "is_sample": True, "explanation": "2^4 - 1 = 15 moves."},
        {"inputs": {"n": 2}, "is_sample": False, "explanation": None},
        {"inputs": {"n": 5}, "is_sample": False, "explanation": None},
        {"inputs": {"n": 10}, "is_sample": False, "explanation": None},
        {"inputs": {"n": 20}, "is_sample": False, "explanation": None},
        {"inputs": {"n": 30}, "is_sample": False, "explanation": None},
        {"inputs": {"n": 50}, "is_sample": False, "explanation": None},
        {"inputs": {"n": 60}, "is_sample": False, "explanation": None},
    ]
    for c in p2_cases:
        c["expected_output"] = solve_hanoi_min_moves(c["inputs"]["n"])

    problems.append({
        "slug": "tower-of-hanoi-minimum-moves",
        "title": "Tower of Hanoi Minimum Moves",
        "difficulty": "easy",
        "tags": ["Math", "Recursion", "Bit Manipulation"],
        "companies": ["Amazon", "Bloomberg", "Adobe"],
        "description": "Given an integer `n` representing the number of disks in the classic 3-rod Tower of Hanoi puzzle, compute the minimum number of moves required to transfer all `n` disks from the source peg to the destination peg.\n\nEvery move transfers exactly one disk to another peg such that no larger disk is placed atop a smaller disk. Return the answer as a 64-bit integer.\n\n### Constraints\n- `1 <= n <= 60`",
        "function_name": "minHanoiMoves",
        "params": [{"name": "n", "type": "integer"}],
        "return_type": "long",
        "comparison_mode": "exact",
        "constraints": ["1 <= n <= 60"],
        "hints": [
            "The recurrence relation is T(n) = 2 * T(n - 1) + 1 with base case T(1) = 1.",
            "Expanding this yields 2^n - 1."
        ],
        "acceptance_rate": 78.50,
        "total_submissions": 64300,
        "display_order": 2007,
        "test_cases": p2_cases
    })

    # 3. Josephus Problem
    def solve_josephus(n, k):
        res = 0
        for i in range(1, n + 1):
            res = (res + k) % i
        return res + 1

    p3_cases = [
        {"inputs": {"n": 5, "k": 2}, "is_sample": True, "explanation": "People 2, 4, 1, 5 are eliminated in order; person 3 survives."},
        {"inputs": {"n": 7, "k": 3}, "is_sample": True, "explanation": "Survivor is person 4."},
        {"inputs": {"n": 1, "k": 1}, "is_sample": False, "explanation": None},
        {"inputs": {"n": 10, "k": 1}, "is_sample": False, "explanation": None},
        {"inputs": {"n": 6, "k": 5}, "is_sample": False, "explanation": None},
        {"inputs": {"n": 14, "k": 2}, "is_sample": False, "explanation": None},
        {"inputs": {"n": 40, "k": 7}, "is_sample": False, "explanation": None},
        {"inputs": {"n": 100, "k": 13}, "is_sample": False, "explanation": None},
    ]
    for c in p3_cases:
        c["expected_output"] = solve_josephus(c["inputs"]["n"], c["inputs"]["k"])

    problems.append({
        "slug": "josephus-problem",
        "title": "Josephus Problem",
        "difficulty": "medium",
        "tags": ["Recursion", "Math", "Queue"],
        "companies": ["Google", "Microsoft", "Morgan Stanley"],
        "description": "There are `n` people standing in a circle numbered from 1 to `n` in clockwise order.\n\nStarting from person 1, you count `k` people clockwise. The `k`-th person is eliminated from the circle, and the count begins again immediately from the next person clockwise.\n\nThis elimination process repeats until only one person remains. Return the 1-based index of the survivor.\n\n### Constraints\n- `1 <= n <= 10^5`\n- `1 <= k <= 10^5`",
        "function_name": "josephusSurvivor",
        "params": [{"name": "n", "type": "integer"}, {"name": "k", "type": "integer"}],
        "return_type": "integer",
        "comparison_mode": "exact",
        "constraints": ["1 <= n <= 10^5", "1 <= k <= 10^5"],
        "hints": [
            "Use the recurrence J(n, k) = (J(n - 1, k) + k) % n in 0-based indexing.",
            "Compute iteratively from 1 to n to avoid recursion stack overflow."
        ],
        "acceptance_rate": 53.20,
        "total_submissions": 78900,
        "display_order": 2008,
        "test_cases": p3_cases
    })

    # 4. Rat in a Maze
    def solve_rat_in_maze(maze, n):
        if n == 0 or maze[0][0] == 0 or maze[n - 1][n - 1] == 0:
            return []
        visited = [[False] * n for _ in range(n)]
        res = []
        moves = [('D', 1, 0), ('L', 0, -1), ('R', 0, 1), ('U', -1, 0)]

        def dfs(r, c, path):
            if r == n - 1 and c == n - 1:
                res.append(path)
                return
            visited[r][c] = True
            for m, dr, dc in moves:
                nr, nc = r + dr, c + dc
                if 0 <= nr < n and 0 <= nc < n and maze[nr][nc] == 1 and not visited[nr][nc]:
                    dfs(nr, nc, path + m)
            visited[r][c] = False

        dfs(0, 0, "")
        res.sort()
        return res

    p4_cases = [
        {
            "inputs": {
                "maze": [[1, 0, 0, 0], [1, 1, 0, 1], [1, 1, 0, 0], [0, 1, 1, 1]],
                "n": 4
            },
            "is_sample": True,
            "explanation": "Two valid paths: DDRRDR and DDRDRR."
        },
        {
            "inputs": {
                "maze": [[1, 0], [1, 0]],
                "n": 2
            },
            "is_sample": True,
            "explanation": "Destination is blocked, so no path exists."
        },
        {
            "inputs": {
                "maze": [[1, 1], [1, 1]],
                "n": 2
            },
            "is_sample": False,
            "explanation": None
        },
        {
            "inputs": {
                "maze": [[1, 1, 1], [1, 1, 1], [1, 1, 1]],
                "n": 3
            },
            "is_sample": False,
            "explanation": None
        },
        {
            "inputs": {
                "maze": [[0, 1], [1, 1]],
                "n": 2
            },
            "is_sample": False,
            "explanation": None
        },
        {
            "inputs": {
                "maze": [[1, 1, 1, 1], [0, 0, 0, 1], [1, 1, 0, 1], [1, 1, 1, 1]],
                "n": 4
            },
            "is_sample": False,
            "explanation": None
        }
    ]
    for c in p4_cases:
        c["expected_output"] = solve_rat_in_maze(c["inputs"]["maze"], c["inputs"]["n"])

    problems.append({
        "slug": "rat-in-a-maze",
        "title": "Rat in a Maze",
        "difficulty": "medium",
        "tags": ["Backtracking", "Matrix", "DFS"],
        "companies": ["Amazon", "Microsoft", "Goldman Sachs"],
        "description": "Consider a rat placed at `(0, 0)` in a square grid `maze` of size `n x n`.\n\nThe rat must reach destination `(n - 1, n - 1)`. In the maze, value `0` represents a blocked cell, and value `1` represents an open path cell.\n\nFrom any open cell, the rat can move in four directions:\n- Down ('D')\n- Left ('L')\n- Right ('R')\n- Up ('U')\n\nNo cell may be visited more than once in a path. Return all possible unique paths from source to destination as an array of strings in lexicographically sorted order. If no path exists, return an empty array `[]`.\n\n### Constraints\n- `2 <= n <= 5`\n- `maze[i][j]` is either 0 or 1",
        "function_name": "findMazePaths",
        "params": [{"name": "maze", "type": "integer[][]"}, {"name": "n", "type": "integer"}],
        "return_type": "string[]",
        "comparison_mode": "exact",
        "constraints": ["2 <= n <= 5", "maze[i][j] is 0 or 1"],
        "hints": [
            "Use depth-first search backtracking while maintaining a visited boolean grid.",
            "Traverse directions in lexicographical order: 'D', 'L', 'R', 'U' to naturally produce sorted paths."
        ],
        "acceptance_rate": 42.10,
        "total_submissions": 61200,
        "display_order": 2009,
        "test_cases": p4_cases
    })

    # 5. Knight's Tour Problem
    def solve_knights_tour(n):
        board = [[-1] * n for _ in range(n)]
        moves = [
            (2, 1), (1, 2), (-1, 2), (-2, 1),
            (-2, -1), (-1, -2), (1, -2), (2, -1)
        ]
        def count_degree(r, c):
            deg = 0
            for dr, dc in moves:
                nr, nc = r + dr, c + dc
                if 0 <= nr < n and 0 <= nc < n and board[nr][nc] == -1:
                    deg += 1
            return deg

        board[0][0] = 0
        r, c = 0, 0
        for step in range(1, n * n):
            candidates = []
            for dr, dc in moves:
                nr, nc = r + dr, c + dc
                if 0 <= nr < n and 0 <= nc < n and board[nr][nc] == -1:
                    candidates.append((count_degree(nr, nc), nr, nc))
            if not candidates:
                return board
            candidates.sort(key=lambda x: x[0])
            _, r, c = candidates[0]
            board[r][c] = step
        return board

    p5_cases = [
        {"inputs": {"n": 5}, "is_sample": True, "explanation": "A valid 5x5 board traversal starting at (0, 0) with 0 through 24."},
        {"inputs": {"n": 6}, "is_sample": True, "explanation": "A valid 6x6 Knight's Tour."},
        {"inputs": {"n": 7}, "is_sample": False, "explanation": None},
        {"inputs": {"n": 8}, "is_sample": False, "explanation": None},
    ]
    for c in p5_cases:
        c["expected_output"] = solve_knights_tour(c["inputs"]["n"])

    problems.append({
        "slug": "knights-tour",
        "title": "Knight's Tour Problem",
        "difficulty": "hard",
        "tags": ["Backtracking", "Matrix", "Graph"],
        "companies": ["Google", "Microsoft", "Directi"],
        "description": "Given an integer `n`, consider an `n x n` chessboard. A knight starts at cell `(0, 0)` with move number `0`.\n\nA knight makes standard chess moves (8 possible L-shaped jumps: 2 squares horizontally and 1 vertically, or 1 horizontally and 2 vertically).\n\nThe goal is to visit every square on the board exactly once. Return an `n x n` matrix where each cell contains the move number (from `0` to `n^2 - 1`) at which the knight visited that cell, determined using Warnsdorff's heuristic (always moving to the unvisited square with the fewest onward moves).\n\n### Constraints\n- `5 <= n <= 8`",
        "function_name": "knightsTour",
        "params": [{"name": "n", "type": "integer"}],
        "return_type": "integer[][]",
        "comparison_mode": "exact",
        "constraints": ["5 <= n <= 8"],
        "hints": [
            "Pure backtracking takes exponential time. Use Warnsdorff's algorithm.",
            "At each step, examine all legal unvisited neighbors and choose the one with the minimum number of available onward moves."
        ],
        "acceptance_rate": 34.60,
        "total_submissions": 31200,
        "display_order": 2010,
        "test_cases": p5_cases
    })

    # 6. Apple Division
    def solve_apple_division(weights):
        total = sum(weights)
        n = len(weights)
        min_diff = total
        for mask in range(1 << n):
            sub_sum = 0
            for i in range(n):
                if (mask >> i) & 1:
                    sub_sum += weights[i]
            diff = abs(total - 2 * sub_sum)
            if diff < min_diff:
                min_diff = diff
        return min_diff

    p6_cases = [
        {"inputs": {"weights": [3, 2, 7, 4, 1]}, "is_sample": True, "explanation": "Group 1: {2, 3, 4} (sum 9), Group 2: {1, 7} (sum 8). Diff = 1."},
        {"inputs": {"weights": [1, 2, 3, 4]}, "is_sample": True, "explanation": "{1, 4} (sum 5) and {2, 3} (sum 5), diff = 0."},
        {"inputs": {"weights": [10]}, "is_sample": False, "explanation": None},
        {"inputs": {"weights": [10, 20]}, "is_sample": False, "explanation": None},
        {"inputs": {"weights": [5, 5, 5, 5]}, "is_sample": False, "explanation": None},
        {"inputs": {"weights": [1, 5, 11, 5]}, "is_sample": False, "explanation": None},
        {"inputs": {"weights": [1000, 2000, 3000, 4000, 5000]}, "is_sample": False, "explanation": None},
        {"inputs": {"weights": [73, 85, 23, 44, 91, 105, 15, 62]}, "is_sample": False, "explanation": None},
    ]
    for c in p6_cases:
        c["expected_output"] = solve_apple_division(c["inputs"]["weights"])

    problems.append({
        "slug": "apple-division",
        "title": "Apple Division",
        "difficulty": "easy",
        "tags": ["Recursion", "Bit Manipulation", "Divide and Conquer"],
        "companies": ["Amazon", "Uber", "TCS"],
        "description": "There are `n` apples with known positive weights.\n\nYour task is to divide the apples into two groups such that the absolute difference between the total weights of the two groups is as small as possible.\n\nReturn the minimum possible difference.\n\n### Constraints\n- `1 <= weights.length <= 18`\n- `1 <= weights[i] <= 10^9`",
        "function_name": "minAppleDifference",
        "params": [{"name": "weights", "type": "integer[]"}],
        "return_type": "long",
        "comparison_mode": "exact",
        "constraints": ["1 <= weights.length <= 18", "1 <= weights[i] <= 10^9"],
        "hints": [
            "With n <= 18, 2^n is at most 262,144 subsets.",
            "Iterate over all subsets using bit manipulation and compute the difference for each."
        ],
        "acceptance_rate": 69.80,
        "total_submissions": 54200,
        "display_order": 2011,
        "test_cases": p6_cases
    })

    # 7. Two Knights Placement
    def solve_two_knights(n):
        res = []
        for k in range(1, n + 1):
            total_pairs = (k * k * (k * k - 1)) // 2
            attacking_pairs = 4 * (k - 1) * (k - 2) if k >= 3 else 0
            res.append(total_pairs - attacking_pairs)
        return res

    p7_cases = [
        {"inputs": {"n": 5}, "is_sample": True, "explanation": "Answers for k=1 to 5: 0, 6, 28, 96, 252."},
        {"inputs": {"n": 8}, "is_sample": True, "explanation": "Results up to standard 8x8 chessboard size."},
        {"inputs": {"n": 1}, "is_sample": False, "explanation": None},
        {"inputs": {"n": 2}, "is_sample": False, "explanation": None},
        {"inputs": {"n": 10}, "is_sample": False, "explanation": None},
        {"inputs": {"n": 20}, "is_sample": False, "explanation": None},
    ]
    for c in p7_cases:
        c["expected_output"] = solve_two_knights(c["inputs"]["n"])

    problems.append({
        "slug": "two-knights",
        "title": "Two Knights Placement",
        "difficulty": "medium",
        "tags": ["Math", "Combinatorics"],
        "companies": ["Google", "Bloomberg", "Atlassian"],
        "description": "Your task is to count for each `k = 1, 2, ..., n` the number of ways two knights can be placed on a `k x k` chessboard so that they do not attack each other.\n\nReturn an array of length `n` where the `i`-th element (0-indexed) gives the count for board size `k = i + 1` as a 64-bit integer.\n\n### Constraints\n- `1 <= n <= 1000`",
        "function_name": "countNonAttackingKnights",
        "params": [{"name": "n", "type": "integer"}],
        "return_type": "long[]",
        "comparison_mode": "exact",
        "constraints": ["1 <= n <= 1000"],
        "hints": [
            "Total ways to choose 2 squares out of k^2 is C(k^2, 2) = k^2 * (k^2 - 1) / 2.",
            "Two knights attack each other if they occupy opposite corners of a 2x3 or 3x2 rectangle.",
            "Count how many 2x3 and 3x2 blocks fit on a k x k board: (k - 1)(k - 2) of each, with 2 attacking pairs per block."
        ],
        "acceptance_rate": 61.30,
        "total_submissions": 41800,
        "display_order": 2012,
        "test_cases": p7_cases
    })

    # 8. Two Sets Partition
    def solve_two_sets(n):
        total = n * (n + 1) // 2
        return total % 2 == 0

    p8_cases = [
        {"inputs": {"n": 7}, "is_sample": True, "explanation": "Sum is 28 (even), can be partitioned into {1, 2, 4, 7} and {3, 5, 6}."},
        {"inputs": {"n": 4}, "is_sample": True, "explanation": "Sum is 10 (even), {1, 4} and {2, 3}."},
        {"inputs": {"n": 6}, "is_sample": True, "explanation": "Sum is 21 (odd), cannot be partitioned."},
        {"inputs": {"n": 1}, "is_sample": False, "explanation": None},
        {"inputs": {"n": 2}, "is_sample": False, "explanation": None},
        {"inputs": {"n": 3}, "is_sample": False, "explanation": None},
        {"inputs": {"n": 8}, "is_sample": False, "explanation": None},
        {"inputs": {"n": 100}, "is_sample": False, "explanation": None},
        {"inputs": {"n": 101}, "is_sample": False, "explanation": None},
    ]
    for c in p8_cases:
        c["expected_output"] = solve_two_sets(c["inputs"]["n"])

    problems.append({
        "slug": "two-sets",
        "title": "Two Sets Partition",
        "difficulty": "easy",
        "tags": ["Math", "Greedy"],
        "companies": ["Microsoft", "Oracle", "Cisco"],
        "description": "Your task is to determine whether the numbers `1, 2, ..., n` can be divided into two sets of equal sum.\n\nReturn `true` if such a partition is possible, or `false` otherwise.\n\n### Constraints\n- `1 <= n <= 10^6`",
        "function_name": "canPartitionTwoSets",
        "params": [{"name": "n", "type": "integer"}],
        "return_type": "boolean",
        "comparison_mode": "exact",
        "constraints": ["1 <= n <= 10^6"],
        "hints": [
            "The sum of numbers from 1 to n is n * (n + 1) / 2.",
            "If the sum is odd, it can never be partitioned into two equal integers.",
            "Check n % 4 == 0 or n % 4 == 3."
        ],
        "acceptance_rate": 72.50,
        "total_submissions": 82000,
        "display_order": 2013,
        "test_cases": p8_cases
    })

    # 9. Coin Piles Game
    def solve_coin_piles(a, b):
        if (a + b) % 3 != 0:
            return False
        return a <= 2 * b and b <= 2 * a

    p9_cases = [
        {"inputs": {"a": 2, "b": 1}, "is_sample": True, "explanation": "Remove 2 from left and 1 from right in 1 move."},
        {"inputs": {"a": 2, "b": 2}, "is_sample": True, "explanation": "Total sum is 4, not divisible by 3."},
        {"inputs": {"a": 3, "b": 3}, "is_sample": True, "explanation": "Move 1: (2, 1) -> (1, 2); Move 2: (1, 2) -> (0, 0)."},
        {"inputs": {"a": 0, "b": 0}, "is_sample": False, "explanation": None},
        {"inputs": {"a": 1, "b": 1}, "is_sample": False, "explanation": None},
        {"inputs": {"a": 100, "b": 200}, "is_sample": False, "explanation": None},
        {"inputs": {"a": 100, "b": 201}, "is_sample": False, "explanation": None},
        {"inputs": {"a": 1000000, "b": 500000}, "is_sample": False, "explanation": None},
    ]
    for c in p9_cases:
        c["expected_output"] = solve_coin_piles(c["inputs"]["a"], c["inputs"]["b"])

    problems.append({
        "slug": "coin-piles",
        "title": "Coin Piles Game",
        "difficulty": "easy",
        "tags": ["Math", "Greedy"],
        "companies": ["Amazon", "Morgan Stanley", "Samsung"],
        "description": "You have two coin piles containing `a` and `b` coins respectively.\n\nOn each step, you can perform either of two operations:\n- Remove 1 coin from the left pile and 2 coins from the right pile.\n- Remove 2 coins from the left pile and 1 coin from the right pile.\n\nReturn `true` if you can empty both piles completely, or `false` otherwise.\n\n### Constraints\n- `0 <= a, b <= 10^9`",
        "function_name": "canEmptyCoinPiles",
        "params": [{"name": "a", "type": "integer"}, {"name": "b", "type": "integer"}],
        "return_type": "boolean",
        "comparison_mode": "exact",
        "constraints": ["0 <= a, b <= 10^9"],
        "hints": [
            "Each move removes exactly 3 coins in total.",
            "Neither pile can exceed twice the other pile."
        ],
        "acceptance_rate": 65.40,
        "total_submissions": 69400,
        "display_order": 2014,
        "test_cases": p9_cases
    })

    # 10. M-Coloring Problem
    def solve_m_coloring(edges, m, n):
        adj = [[] for _ in range(n)]
        for u, v in edges:
            adj[u].append(v)
            adj[v].append(u)
        color = [-1] * n

        def is_safe(node, c):
            for neighbor in adj[node]:
                if color[neighbor] == c:
                    return False
            return True

        def dfs(node):
            if node == n:
                return True
            for c in range(m):
                if is_safe(node, c):
                    color[node] = c
                    if dfs(node + 1):
                        return True
                    color[node] = -1
            return False

        return dfs(0)

    p10_cases = [
        {
            "inputs": {
                "edges": [[0, 1], [1, 2], [2, 3], [3, 0], [0, 2]],
                "m": 3,
                "n": 4
            },
            "is_sample": True,
            "explanation": "A 4-vertex graph containing triangles can be colored with 3 colors."
        },
        {
            "inputs": {
                "edges": [[0, 1], [1, 2], [2, 0]],
                "m": 2,
                "n": 3
            },
            "is_sample": True,
            "explanation": "A 3-cycle requires 3 colors, impossible with 2."
        },
        {
            "inputs": {
                "edges": [[0, 1], [1, 2], [2, 3], [3, 0]],
                "m": 2,
                "n": 4
            },
            "is_sample": False,
            "explanation": None
        },
        {
            "inputs": {
                "edges": [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]],
                "m": 3,
                "n": 4
            },
            "is_sample": False,
            "explanation": None
        },
        {
            "inputs": {
                "edges": [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]],
                "m": 4,
                "n": 4
            },
            "is_sample": False,
            "explanation": None
        }
    ]
    for c in p10_cases:
        c["expected_output"] = solve_m_coloring(c["inputs"]["edges"], c["inputs"]["m"], c["inputs"]["n"])

    problems.append({
        "slug": "m-coloring-graph",
        "title": "M-Coloring Problem",
        "difficulty": "medium",
        "tags": ["Backtracking", "Graph"],
        "companies": ["Amazon", "Microsoft", "Paytm"],
        "description": "Given an undirected graph with `n` vertices (numbered 0 to `n - 1`) and a list of undirected `edges` where each edge is `[u, v]`, determine whether the graph can be colored using at most `m` colors such that no two adjacent vertices have the same color.\n\nReturn `true` if a valid vertex coloring exists, or `false` otherwise.\n\n### Constraints\n- `1 <= n <= 16`\n- `1 <= m <= 10`\n- `0 <= edges.length <= n * (n - 1) / 2`",
        "function_name": "graphColoring",
        "params": [
            {"name": "edges", "type": "integer[][]"},
            {"name": "m", "type": "integer"},
            {"name": "n", "type": "integer"}
        ],
        "return_type": "boolean",
        "comparison_mode": "exact",
        "constraints": ["1 <= n <= 16", "1 <= m <= 10", "0 <= edges.length <= 120"],
        "hints": [
            "Use backtracking to assign colors vertex by vertex from 0 to n - 1.",
            "Before assigning color c to vertex u, verify none of u's neighbors currently have color c."
        ],
        "acceptance_rate": 45.60,
        "total_submissions": 51200,
        "display_order": 2015,
        "test_cases": p10_cases
    })

    # 11. Matrix Chain Multiplication
    def solve_mcm(p):
        n = len(p) - 1
        dp = [[0] * (n + 1) for _ in range(n + 1)]
        for length in range(2, n + 1):
            for i in range(1, n - length + 2):
                j = i + length - 1
                dp[i][j] = float('inf')
                for k in range(i, j):
                    cost = dp[i][k] + dp[k + 1][j] + p[i - 1] * p[k] * p[j]
                    if cost < dp[i][j]:
                        dp[i][j] = cost
        return dp[1][n]

    p11_cases = [
        {"inputs": {"p": [10, 20, 30, 40, 30]}, "is_sample": True, "explanation": "Matrices of dims 10x20, 20x30, 30x40, 40x30. Min operations = 30000."},
        {"inputs": {"p": [10, 20, 30]}, "is_sample": True, "explanation": "Only two matrices: 10 * 20 * 30 = 6000."},
        {"inputs": {"p": [40, 20, 30, 10, 30]}, "is_sample": False, "explanation": None},
        {"inputs": {"p": [10, 5, 20, 10, 5]}, "is_sample": False, "explanation": None},
        {"inputs": {"p": [1, 2, 3, 4, 5]}, "is_sample": False, "explanation": None},
        {"inputs": {"p": [5, 10, 3, 12, 5, 50, 6]}, "is_sample": False, "explanation": None},
    ]
    for c in p11_cases:
        c["expected_output"] = solve_mcm(c["inputs"]["p"])

    problems.append({
        "slug": "matrix-chain-multiplication",
        "title": "Matrix Chain Multiplication",
        "difficulty": "hard",
        "tags": ["Dynamic Programming"],
        "companies": ["Amazon", "Microsoft", "Flipkart"],
        "description": "Given an array `p` representing the dimensions of a chain of matrices where matrix $A_i$ has dimensions $p[i - 1] \\times p[i]$ for $1 \\le i \\le n$.\n\nFind the most efficient parenthesization to multiply these matrices together, returning the minimum number of scalar multiplications needed.\n\n### Constraints\n- `2 <= p.length <= 100`\n- `1 <= p[i] <= 500`",
        "function_name": "matrixChainOrder",
        "params": [{"name": "p", "type": "integer[]"}],
        "return_type": "integer",
        "comparison_mode": "exact",
        "constraints": ["2 <= p.length <= 100", "1 <= p[i] <= 500"],
        "hints": [
            "Let dp[i][j] be the minimum multiplications needed to compute A_i ... A_j.",
            "For each possible split point k from i to j - 1, compute dp[i][k] + dp[k+1][j] + p[i-1]*p[k]*p[j]."
        ],
        "acceptance_rate": 46.80,
        "total_submissions": 67800,
        "display_order": 2016,
        "test_cases": p11_cases
    })

    # 12. Rod Cutting Problem
    def solve_rod_cutting(price, n):
        dp = [0] * (n + 1)
        for i in range(1, n + 1):
            max_val = 0
            for j in range(1, min(i + 1, len(price) + 1)):
                max_val = max(max_val, price[j - 1] + dp[i - j])
            dp[i] = max_val
        return dp[n]

    p12_cases = [
        {"inputs": {"price": [1, 5, 8, 9, 10, 17, 17, 20], "n": 8}, "is_sample": True, "explanation": "Cut into lengths 2 and 6 for price 5 + 17 = 22."},
        {"inputs": {"price": [3, 5, 8, 9, 10, 17, 17, 20], "n": 8}, "is_sample": True, "explanation": "Cut into 8 pieces of length 1 for 8 * 3 = 24."},
        {"inputs": {"price": [1, 5, 8, 9], "n": 4}, "is_sample": False, "explanation": None},
        {"inputs": {"price": [2, 5, 7, 8], "n": 5}, "is_sample": False, "explanation": None},
        {"inputs": {"price": [1, 1, 1], "n": 3}, "is_sample": False, "explanation": None},
        {"inputs": {"price": [10], "n": 5}, "is_sample": False, "explanation": None},
    ]
    for c in p12_cases:
        c["expected_output"] = solve_rod_cutting(c["inputs"]["price"], c["inputs"]["n"])

    problems.append({
        "slug": "rod-cutting-problem",
        "title": "Rod Cutting Problem",
        "difficulty": "medium",
        "tags": ["Dynamic Programming"],
        "companies": ["Amazon", "Google", "Morgan Stanley"],
        "description": "Given a rod of length `n` inches and an array `price` where `price[i]` is the selling price of a piece of length `i + 1`.\n\nDetermine the maximum revenue obtainable by cutting up the rod and selling the pieces. You may make any number of cuts (or none at all).\n\n### Constraints\n- `1 <= n <= 1000`\n- `1 <= price.length <= n`\n- `1 <= price[i] <= 10^4`",
        "function_name": "cutRod",
        "params": [{"name": "price", "type": "integer[]"}, {"name": "n", "type": "integer"}],
        "return_type": "integer",
        "comparison_mode": "exact",
        "constraints": ["1 <= n <= 1000", "1 <= price.length <= n"],
        "hints": [
            "This is equivalent to the Unbounded Knapsack problem.",
            "dp[i] = max_{1 <= j <= i}(price[j - 1] + dp[i - j])."
        ],
        "acceptance_rate": 62.40,
        "total_submissions": 73200,
        "display_order": 2017,
        "test_cases": p12_cases
    })

    # 13. Longest Bitonic Subsequence
    def solve_lbs(nums):
        n = len(nums)
        if n == 0:
            return 0
        lis = [1] * n
        for i in range(n):
            for j in range(i):
                if nums[j] < nums[i] and lis[j] + 1 > lis[i]:
                    lis[i] = lis[j] + 1
        lds = [1] * n
        for i in range(n - 1, -1, -1):
            for j in range(n - 1, i, -1):
                if nums[j] < nums[i] and lds[j] + 1 > lds[i]:
                    lds[i] = lds[j] + 1
        max_len = 0
        for i in range(n):
            max_len = max(max_len, lis[i] + lds[i] - 1)
        return max_len

    p13_cases = [
        {"inputs": {"nums": [1, 11, 2, 10, 4, 5, 2, 1]}, "is_sample": True, "explanation": "Longest bitonic subsequence is [1, 2, 10, 4, 2, 1] or [1, 2, 10, 5, 2, 1] of length 6."},
        {"inputs": {"nums": [1, 2, 3, 4, 5]}, "is_sample": True, "explanation": "Entire array is strictly increasing (bitonic with no decreasing tail), length 5."},
        {"inputs": {"nums": [5, 4, 3, 2, 1]}, "is_sample": True, "explanation": "Entire array is strictly decreasing, length 5."},
        {"inputs": {"nums": [10]}, "is_sample": False, "explanation": None},
        {"inputs": {"nums": [10, 20, 10]}, "is_sample": False, "explanation": None},
        {"inputs": {"nums": [12, 11, 40, 5, 3, 1]}, "is_sample": False, "explanation": None},
        {"inputs": {"nums": [80, 60, 30, 40, 20, 10]}, "is_sample": False, "explanation": None},
    ]
    for c in p13_cases:
        c["expected_output"] = solve_lbs(c["inputs"]["nums"])

    problems.append({
        "slug": "longest-bitonic-subsequence",
        "title": "Longest Bitonic Subsequence",
        "difficulty": "medium",
        "tags": ["Dynamic Programming"],
        "companies": ["Amazon", "Microsoft", "Directi"],
        "description": "Given an integer array `nums`, find the length of the longest bitonic subsequence.\n\nA sequence is called bitonic if it strictly increases first, then strictly decreases. A purely strictly increasing or purely strictly decreasing sequence is also bitonic.\n\n### Constraints\n- `1 <= nums.length <= 1000`\n- `1 <= nums[i] <= 10^4`",
        "function_name": "longestBitonicSubsequence",
        "params": [{"name": "nums", "type": "integer[]"}],
        "return_type": "integer",
        "comparison_mode": "exact",
        "constraints": ["1 <= nums.length <= 1000", "1 <= nums[i] <= 10^4"],
        "hints": [
            "Compute LIS[i]: the length of the longest strictly increasing subsequence ending at index i.",
            "Compute LDS[i]: the length of the longest strictly decreasing subsequence starting at index i.",
            "The maximum of LIS[i] + LDS[i] - 1 across all i is the answer."
        ],
        "acceptance_rate": 54.10,
        "total_submissions": 59100,
        "display_order": 2018,
        "test_cases": p13_cases
    })

    # 14. Maximum Sum Increasing Subsequence
    def solve_msis(nums):
        n = len(nums)
        if n == 0:
            return 0
        dp = nums[:]
        for i in range(n):
            for j in range(i):
                if nums[j] < nums[i] and dp[j] + nums[i] > dp[i]:
                    dp[i] = dp[j] + nums[i]
        return max(dp)

    p14_cases = [
        {"inputs": {"nums": [1, 101, 2, 3, 100, 4, 5]}, "is_sample": True, "explanation": "Subsequence [1, 2, 3, 100] has max sum = 106."},
        {"inputs": {"nums": [10, 5, 4, 3]}, "is_sample": True, "explanation": "Max sum is single element [10]."},
        {"inputs": {"nums": [1, 2, 3, 4]}, "is_sample": False, "explanation": None},
        {"inputs": {"nums": [100]}, "is_sample": False, "explanation": None},
        {"inputs": {"nums": [20, 3, 40, 5, 60]}, "is_sample": False, "explanation": None},
        {"inputs": {"nums": [3, 4, 5, 10]}, "is_sample": False, "explanation": None},
    ]
    for c in p14_cases:
        c["expected_output"] = solve_msis(c["inputs"]["nums"])

    problems.append({
        "slug": "maximum-sum-increasing-subsequence",
        "title": "Maximum Sum Increasing Subsequence",
        "difficulty": "medium",
        "tags": ["Dynamic Programming"],
        "companies": ["Amazon", "Microsoft", "Morgan Stanley"],
        "description": "Given an array `nums` of positive integers, find the maximum sum of a strictly increasing subsequence.\n\n### Constraints\n- `1 <= nums.length <= 1000`\n- `1 <= nums[i] <= 10^5`",
        "function_name": "maxSumIS",
        "params": [{"name": "nums", "type": "integer[]"}],
        "return_type": "integer",
        "comparison_mode": "exact",
        "constraints": ["1 <= nums.length <= 1000", "1 <= nums[i] <= 10^5"],
        "hints": [
            "Similar to Longest Increasing Subsequence, but track maximum sum instead of maximum length.",
            "dp[i] = max(nums[i], dp[j] + nums[i]) for all j < i with nums[j] < nums[i]."
        ],
        "acceptance_rate": 51.20,
        "total_submissions": 58300,
        "display_order": 2019,
        "test_cases": p14_cases
    })

    # 15. Optimal Binary Search Tree
    def solve_optimal_bst(keys, freq, n):
        dp = [[0] * n for _ in range(n)]
        weight = [[0] * n for _ in range(n)]

        for i in range(n):
            dp[i][i] = freq[i]
            weight[i][i] = freq[i]

        for length in range(2, n + 1):
            for i in range(n - length + 1):
                j = i + length - 1
                weight[i][j] = weight[i][j - 1] + freq[j]
                dp[i][j] = float('inf')
                for r in range(i, j + 1):
                    left = dp[i][r - 1] if r > i else 0
                    right = dp[r + 1][j] if r < j else 0
                    cost = left + right + weight[i][j]
                    if cost < dp[i][j]:
                        dp[i][j] = cost
        return dp[0][n - 1]

    p15_cases = [
        {"inputs": {"keys": [10, 12, 20], "freq": [34, 8, 50], "n": 3}, "is_sample": True, "explanation": "Root at 20 gives min total search cost 142."},
        {"inputs": {"keys": [10, 12], "freq": [8, 34], "n": 2}, "is_sample": True, "explanation": "Root at 12: 34*1 + 8*2 = 50."},
        {"inputs": {"keys": [5], "freq": [10], "n": 1}, "is_sample": False, "explanation": None},
        {"inputs": {"keys": [10, 20, 30, 40], "freq": [4, 2, 6, 3], "n": 4}, "is_sample": False, "explanation": None},
        {"inputs": {"keys": [1, 2, 3, 4, 5], "freq": [5, 4, 3, 2, 1], "n": 5}, "is_sample": False, "explanation": None},
    ]
    for c in p15_cases:
        c["expected_output"] = solve_optimal_bst(c["inputs"]["keys"], c["inputs"]["freq"], c["inputs"]["n"])

    problems.append({
        "slug": "optimal-binary-search-tree",
        "title": "Optimal Binary Search Tree",
        "difficulty": "hard",
        "tags": ["Dynamic Programming"],
        "companies": ["Microsoft", "Google"],
        "description": "Given a sorted array `keys[0..n-1]` of search keys and an array `freq[0..n-1]` of their search frequencies.\n\nFind the minimum total search cost of a binary search tree built with these keys. The search cost of a key at level $d$ (root is at depth 1) is $d \\times \\text{freq}[key]$.\n\n### Constraints\n- `1 <= n <= 50`\n- `1 <= freq[i] <= 1000`",
        "function_name": "optimalSearchTree",
        "params": [
            {"name": "keys", "type": "integer[]"},
            {"name": "freq", "type": "integer[]"},
            {"name": "n", "type": "integer"}
        ],
        "return_type": "integer",
        "comparison_mode": "exact",
        "constraints": ["1 <= n <= 50", "1 <= freq[i] <= 1000"],
        "hints": [
            "Use interval dynamic programming dp[i][j]: minimum cost to build an optimal BST for keys from i to j.",
            "For each key r from i to j as candidate root, total cost is dp[i][r - 1] + dp[r + 1][j] + sum(freq[i..j])."
        ],
        "acceptance_rate": 39.80,
        "total_submissions": 27400,
        "display_order": 2020,
        "test_cases": p15_cases
    })

    # 16. Weighted Job Scheduling
    def solve_job_scheduling(start_time, end_time, profit):
        jobs = sorted(zip(start_time, end_time, profit), key=lambda x: x[1])
        n = len(jobs)
        ends = [j[1] for j in jobs]
        dp = [0] * (n + 1)
        import bisect
        for i in range(1, n + 1):
            s, e, p = jobs[i - 1]
            idx = bisect.bisect_right(ends, s)
            dp[i] = max(dp[i - 1], dp[idx] + p)
        return dp[n]

    p16_cases = [
        {"inputs": {"startTime": [1, 2, 3, 3], "endTime": [3, 4, 5, 6], "profit": [50, 10, 40, 70]}, "is_sample": True, "explanation": "Choose first job [1, 3] profit 50 and fourth job [3, 6] profit 70. Total = 120."},
        {"inputs": {"startTime": [1, 2, 3, 4, 6], "endTime": [3, 5, 10, 6, 9], "profit": [20, 20, 100, 70, 60]}, "is_sample": True, "explanation": "Jobs [1, 3] profit 20, [4, 6] profit 70, [6, 9] profit 60 -> 150."},
        {"inputs": {"startTime": [1, 1, 1], "endTime": [2, 3, 4], "profit": [5, 6, 4]}, "is_sample": False, "explanation": None},
        {"inputs": {"startTime": [1], "endTime": [10], "profit": [100]}, "is_sample": False, "explanation": None},
        {"inputs": {"startTime": [1, 3, 6, 8], "endTime": [3, 5, 8, 10], "profit": [10, 20, 30, 40]}, "is_sample": False, "explanation": None},
    ]
    for c in p16_cases:
        c["expected_output"] = solve_job_scheduling(c["inputs"]["startTime"], c["inputs"]["endTime"], c["inputs"]["profit"])

    problems.append({
        "slug": "weighted-job-scheduling",
        "title": "Weighted Job Scheduling",
        "difficulty": "hard",
        "tags": ["Dynamic Programming", "Binary Search", "Sorting"],
        "companies": ["Amazon", "Google", "Goldman Sachs"],
        "description": "We have `n` jobs, where every job is represented by `startTime[i]`, `endTime[i]`, and `profit[i]`.\n\nFind the maximum profit you can achieve such that no two jobs in your chosen subset overlap in time.\n\nIf you choose a job that ends at time `X`, you can immediately start another job that starts at time `X`.\n\n### Constraints\n- `1 <= startTime.length == endTime.length == profit.length <= 5 * 10^4`\n- `1 <= startTime[i] < endTime[i] <= 10^9`\n- `1 <= profit[i] <= 10^4`",
        "function_name": "jobScheduling",
        "params": [
            {"name": "startTime", "type": "integer[]"},
            {"name": "endTime", "type": "integer[]"},
            {"name": "profit", "type": "integer[]"}
        ],
        "return_type": "integer",
        "comparison_mode": "exact",
        "constraints": ["1 <= startTime.length <= 50000", "1 <= profit[i] <= 10000"],
        "hints": [
            "Sort jobs by end time.",
            "For each job i, use binary search to find the latest job that finishes at or before job i starts."
        ],
        "acceptance_rate": 53.60,
        "total_submissions": 78900,
        "display_order": 2021,
        "test_cases": p16_cases
    })

    # 17. Dice Combinations
    def solve_dice_combinations(n):
        MOD = 10**9 + 7
        dp = [0] * (n + 1)
        dp[0] = 1
        for i in range(1, n + 1):
            s = 0
            for j in range(1, 7):
                if i - j >= 0:
                    s = (s + dp[i - j]) % MOD
            dp[i] = s
        return dp[n]

    p17_cases = [
        {"inputs": {"n": 3}, "is_sample": True, "explanation": "4 ways: (1,1,1), (1,2), (2,1), (3)."},
        {"inputs": {"n": 4}, "is_sample": True, "explanation": "8 ways to form sum 4."},
        {"inputs": {"n": 1}, "is_sample": False, "explanation": None},
        {"inputs": {"n": 2}, "is_sample": False, "explanation": None},
        {"inputs": {"n": 5}, "is_sample": False, "explanation": None},
        {"inputs": {"n": 6}, "is_sample": False, "explanation": None},
        {"inputs": {"n": 10}, "is_sample": False, "explanation": None},
        {"inputs": {"n": 100}, "is_sample": False, "explanation": None},
        {"inputs": {"n": 500}, "is_sample": False, "explanation": None},
    ]
    for c in p17_cases:
        c["expected_output"] = solve_dice_combinations(c["inputs"]["n"])

    problems.append({
        "slug": "dice-combinations",
        "title": "Dice Combinations",
        "difficulty": "medium",
        "tags": ["Dynamic Programming"],
        "companies": ["Google", "Bloomberg", "Uber"],
        "description": "Your task is to count the number of ways to construct sum `n` by throwing a standard six-sided die one or more times.\n\nEach throw produces an integer outcome between 1 and 6. Return the answer modulo $10^9 + 7$.\n\n### Constraints\n- `1 <= n <= 10^5`",
        "function_name": "countDiceCombinations",
        "params": [{"name": "n", "type": "integer"}],
        "return_type": "integer",
        "comparison_mode": "exact",
        "constraints": ["1 <= n <= 10^5"],
        "hints": [
            "dp[i] = dp[i - 1] + dp[i - 2] + ... + dp[i - 6] modulo 10^9 + 7.",
            "Base case: dp[0] = 1."
        ],
        "acceptance_rate": 66.80,
        "total_submissions": 64200,
        "display_order": 2022,
        "test_cases": p17_cases
    })

    # 18. Minimizing Coins
    def solve_minimizing_coins(coins, target):
        dp = [float('inf')] * (target + 1)
        dp[0] = 0
        for i in range(1, target + 1):
            for c in coins:
                if i - c >= 0 and dp[i - c] + 1 < dp[i]:
                    dp[i] = dp[i - c] + 1
        return dp[target] if dp[target] != float('inf') else -1

    p18_cases = [
        {"inputs": {"coins": [1, 5, 7], "target": 11}, "is_sample": True, "explanation": "3 coins: 5 + 5 + 1 = 11."},
        {"inputs": {"coins": [2], "target": 3}, "is_sample": True, "explanation": "Cannot make sum 3 with coin 2, returns -1."},
        {"inputs": {"coins": [1], "target": 0}, "is_sample": False, "explanation": None},
        {"inputs": {"coins": [1, 2, 5], "target": 100}, "is_sample": False, "explanation": None},
        {"inputs": {"coins": [9, 6, 5, 1], "target": 11}, "is_sample": False, "explanation": None},
        {"inputs": {"coins": [2, 4], "target": 7}, "is_sample": False, "explanation": None},
    ]
    for c in p18_cases:
        c["expected_output"] = solve_minimizing_coins(c["inputs"]["coins"], c["inputs"]["target"])

    problems.append({
        "slug": "minimizing-coins",
        "title": "Minimizing Coins",
        "difficulty": "medium",
        "tags": ["Dynamic Programming"],
        "companies": ["Amazon", "Microsoft", "Goldman Sachs"],
        "description": "Consider a currency system consisting of `n` distinct positive integer coin values.\n\nYour task is to produce a sum of money `target` using the fewest coins possible. Return the minimum number of coins needed, or `-1` if it is impossible to form the target.\n\n### Constraints\n- `1 <= coins.length <= 100`\n- `1 <= coins[i] <= 10^6`\n- `0 <= target <= 10^5`",
        "function_name": "minCoinsToSum",
        "params": [{"name": "coins", "type": "integer[]"}, {"name": "target", "type": "integer"}],
        "return_type": "integer",
        "comparison_mode": "exact",
        "constraints": ["1 <= coins.length <= 100", "0 <= target <= 10^5"],
        "hints": [
            "Use dynamic programming: dp[x] = min(dp[x], dp[x - c] + 1) for coin c in coins.",
            "Initialize dp[0] = 0 and all other dp entries to infinity."
        ],
        "acceptance_rate": 57.30,
        "total_submissions": 71800,
        "display_order": 2023,
        "test_cases": p18_cases
    })

    # 19. Removing Digits
    def solve_removing_digits(n):
        steps = 0
        while n > 0:
            max_d = max(int(d) for d in str(n))
            n -= max_d
            steps += 1
        return steps

    p19_cases = [
        {"inputs": {"n": 27}, "is_sample": True, "explanation": "27 -> 20 (sub 7) -> 18 (sub 2) -> 10 (sub 8) -> 9 (sub 1) -> 0 (sub 9). 5 steps."},
        {"inputs": {"n": 5}, "is_sample": True, "explanation": "5 -> 0 in 1 step."},
        {"inputs": {"n": 10}, "is_sample": False, "explanation": None},
        {"inputs": {"n": 15}, "is_sample": False, "explanation": None},
        {"inputs": {"n": 99}, "is_sample": False, "explanation": None},
        {"inputs": {"n": 123}, "is_sample": False, "explanation": None},
        {"inputs": {"n": 1000}, "is_sample": False, "explanation": None},
    ]
    for c in p19_cases:
        c["expected_output"] = solve_removing_digits(c["inputs"]["n"])

    problems.append({
        "slug": "removing-digits",
        "title": "Removing Digits",
        "difficulty": "easy",
        "tags": ["Greedy", "Dynamic Programming"],
        "companies": ["Amazon", "Paytm", "Accenture"],
        "description": "You are given an integer `n`.\n\nOn each step, you may subtract one of the non-zero decimal digits of `n` from `n`.\n\nHow many steps are required to reduce `n` to 0? Return the minimum number of steps.\n\n### Constraints\n- `1 <= n <= 10^6`",
        "function_name": "minStepsRemoveDigits",
        "params": [{"name": "n", "type": "integer"}],
        "return_type": "integer",
        "comparison_mode": "exact",
        "constraints": ["1 <= n <= 10^6"],
        "hints": [
            "A greedy choice of subtracting the maximum digit in n at each step is optimal."
        ],
        "acceptance_rate": 79.40,
        "total_submissions": 58900,
        "display_order": 2024,
        "test_cases": p19_cases
    })

    # 20. Counting Towers
    def solve_counting_towers(n):
        MOD = 10**9 + 7
        a = 1  # 2 separate 1x1s
        b = 1  # 1 joined 1x2
        for _ in range(2, n + 1):
            na = (2 * a + b) % MOD
            nb = (a + 4 * b) % MOD
            a, b = na, nb
        return (a + b) % MOD

    p20_cases = [
        {"inputs": {"n": 1}, "is_sample": True, "explanation": "2 ways for height 1: [1, 1] separated or [2] merged."},
        {"inputs": {"n": 2}, "is_sample": True, "explanation": "8 ways for height 2."},
        {"inputs": {"n": 3}, "is_sample": False, "explanation": None},
        {"inputs": {"n": 4}, "is_sample": False, "explanation": None},
        {"inputs": {"n": 5}, "is_sample": False, "explanation": None},
        {"inputs": {"n": 10}, "is_sample": False, "explanation": None},
        {"inputs": {"n": 100}, "is_sample": False, "explanation": None},
    ]
    for c in p20_cases:
        c["expected_output"] = solve_counting_towers(c["inputs"]["n"])

    problems.append({
        "slug": "counting-towers",
        "title": "Counting Towers",
        "difficulty": "medium",
        "tags": ["Dynamic Programming"],
        "companies": ["Google", "Uber", "Citadel"],
        "description": "Your task is to build a tower of width 2 and height `n` using $1 \\times 1$ and $1 \\times 2$ blocks.\n\nTwo blocks can be placed next to each other or fused into a $1 \\times 2$ block horizontally, and blocks can extend vertically.\n\nIn how many ways can you tile the tower? Return the count modulo $10^9 + 7$.\n\n### Constraints\n- `1 <= n <= 10^5`",
        "function_name": "countTowers",
        "params": [{"name": "n", "type": "integer"}],
        "return_type": "integer",
        "comparison_mode": "exact",
        "constraints": ["1 <= n <= 10^5"],
        "hints": [
            "Maintain two DP states for each row: a = number of towers where the two top tiles are separated, b = top tiles are connected.",
            "a_{i} = 2*a_{i-1} + b_{i-1}, b_{i} = a_{i-1} + 4*b_{i-1}."
        ],
        "acceptance_rate": 48.70,
        "total_submissions": 34100,
        "display_order": 2025,
        "test_cases": p20_cases
    })

    # 21. Rectangle Cutting
    def solve_rectangle_cutting(a, b):
        dp = [[0] * (b + 1) for _ in range(a + 1)]
        for i in range(1, a + 1):
            for j in range(1, b + 1):
                if i == j:
                    dp[i][j] = 0
                else:
                    min_cuts = float('inf')
                    for k in range(1, i):
                        min_cuts = min(min_cuts, 1 + dp[k][j] + dp[i - k][j])
                    for k in range(1, j):
                        min_cuts = min(min_cuts, 1 + dp[i][k] + dp[i][j - k])
                    dp[i][j] = min_cuts
        return dp[a][b]

    p21_cases = [
        {"inputs": {"a": 3, "b": 5}, "is_sample": True, "explanation": "Cut into squares with 3 cuts."},
        {"inputs": {"a": 4, "b": 4}, "is_sample": True, "explanation": "Already a square, 0 cuts."},
        {"inputs": {"a": 1, "b": 5}, "is_sample": False, "explanation": None},
        {"inputs": {"a": 2, "b": 3}, "is_sample": False, "explanation": None},
        {"inputs": {"a": 4, "b": 6}, "is_sample": False, "explanation": None},
        {"inputs": {"a": 10, "b": 11}, "is_sample": False, "explanation": None},
    ]
    for c in p21_cases:
        c["expected_output"] = solve_rectangle_cutting(c["inputs"]["a"], c["inputs"]["b"])

    problems.append({
        "slug": "rectangle-cutting",
        "title": "Rectangle Cutting",
        "difficulty": "medium",
        "tags": ["Dynamic Programming"],
        "companies": ["Amazon", "Microsoft", "Goldman Sachs"],
        "description": "Given an `a x b` rectangle, find the minimum number of straight cuts across the entire rectangle needed to divide it completely into squares.\n\nEach cut must be straight and parallel to one of the sides.\n\n### Constraints\n- `1 <= a, b <= 100`",
        "function_name": "minRectangleCuts",
        "params": [{"name": "a", "type": "integer"}, {"name": "b", "type": "integer"}],
        "return_type": "integer",
        "comparison_mode": "exact",
        "constraints": ["1 <= a, b <= 100"],
        "hints": [
            "If a == b, 0 cuts are needed.",
            "Otherwise try all horizontal cuts 1 <= k < a and vertical cuts 1 <= k < b."
        ],
        "acceptance_rate": 52.80,
        "total_submissions": 45600,
        "display_order": 2026,
        "test_cases": p21_cases
    })

    # 22. Money Sums
    def solve_money_sums(coins):
        possible = {0}
        for c in coins:
            possible |= {s + c for s in possible}
        possible.remove(0)
        return sorted(possible)

    p22_cases = [
        {"inputs": {"coins": [4, 2, 5, 2]}, "is_sample": True, "explanation": "Distinct non-zero sums: [2, 4, 5, 6, 7, 8, 9, 11, 13]."},
        {"inputs": {"coins": [1, 2]}, "is_sample": True, "explanation": "Sums are [1, 2, 3]."},
        {"inputs": {"coins": [5]}, "is_sample": False, "explanation": None},
        {"inputs": {"coins": [3, 3, 3]}, "is_sample": False, "explanation": None},
        {"inputs": {"coins": [1, 3, 7]}, "is_sample": False, "explanation": None},
    ]
    for c in p22_cases:
        c["expected_output"] = solve_money_sums(c["inputs"]["coins"])

    problems.append({
        "slug": "money-sums",
        "title": "Money Sums",
        "difficulty": "medium",
        "tags": ["Dynamic Programming"],
        "companies": ["Bloomberg", "Microsoft", "Paytm"],
        "description": "You have `n` coins with known values.\n\nYour task is to find all distinct positive money sums you can create using a subset of the coins. Return the distinct sums in strictly ascending order.\n\n### Constraints\n- `1 <= coins.length <= 100`\n- `1 <= coins[i] <= 1000`",
        "function_name": "distinctMoneySums",
        "params": [{"name": "coins", "type": "integer[]"}],
        "return_type": "integer[]",
        "comparison_mode": "exact",
        "constraints": ["1 <= coins.length <= 100", "1 <= coins[i] <= 1000"],
        "hints": [
            "Use a boolean DP array reachable[sum] up to max possible sum.",
            "For each coin, iterate backwards to prevent counting the same coin multiple times."
        ],
        "acceptance_rate": 67.10,
        "total_submissions": 49200,
        "display_order": 2027,
        "test_cases": p22_cases
    })

    # 23. Removal Game
    def solve_removal_game(nums):
        n = len(nums)
        dp = [[0] * n for _ in range(n)]
        total = sum(nums)
        for i in range(n):
            dp[i][i] = nums[i]
        for length in range(2, n + 1):
            for i in range(n - length + 1):
                j = i + length - 1
                dp[i][j] = max(nums[i] - dp[i + 1][j], nums[j] - dp[i][j - 1])
        diff = dp[0][n - 1]
        return (total + diff) // 2

    p23_cases = [
        {"inputs": {"nums": [4, 5, 1, 3]}, "is_sample": True, "explanation": "Player 1 takes 4, player 2 takes 5, player 1 takes 3, player 2 takes 1. Total score for player 1 is 4 + 3 = 8 (or 4 + 4). Max score is 8."},
        {"inputs": {"nums": [2, 1, 2]}, "is_sample": True, "explanation": "First player takes 2, second takes 2, first takes 1 -> score 3."},
        {"inputs": {"nums": [10]}, "is_sample": False, "explanation": None},
        {"inputs": {"nums": [1, 1000, 2]}, "is_sample": False, "explanation": None},
        {"inputs": {"nums": [7, 8, 3, 2, 9]}, "is_sample": False, "explanation": None},
        {"inputs": {"nums": [10, 20, 30, 40, 50]}, "is_sample": False, "explanation": None},
    ]
    for c in p23_cases:
        c["expected_output"] = solve_removal_game(c["inputs"]["nums"])

    problems.append({
        "slug": "removal-game",
        "title": "Removal Game",
        "difficulty": "medium",
        "tags": ["Dynamic Programming", "Game Theory"],
        "companies": ["Google", "Atlassian", "Uber"],
        "description": "There is a list of `n` numbers and two players take turns.\n\nIn each turn, a player removes either the first or the last number from the list and adds its value to their score.\n\nBoth players play optimally to maximize their own total score. What is the maximum score the first player can achieve? Return the result as a 64-bit integer.\n\n### Constraints\n- `1 <= nums.length <= 5000`\n- `-10^9 <= nums[i] <= 10^9`",
        "function_name": "maxScoreRemovalGame",
        "params": [{"name": "nums", "type": "integer[]"}],
        "return_type": "long",
        "comparison_mode": "exact",
        "constraints": ["1 <= nums.length <= 5000"],
        "hints": [
            "Let dp[i][j] be the maximum difference (my score - opponent's score) achievable on subarray nums[i..j].",
            "dp[i][j] = max(nums[i] - dp[i + 1][j], nums[j] - dp[i][j - 1]).",
            "Score_1 = (total_sum + dp[0][n - 1]) / 2."
        ],
        "acceptance_rate": 59.40,
        "total_submissions": 51900,
        "display_order": 2028,
        "test_cases": p23_cases
    })

    # 24. Elevator Rides
    def solve_elevator_rides(weight, max_weight):
        n = len(weight)
        dp = [(n + 1, 0)] * (1 << n)
        dp[0] = (1, 0)
        for mask in range(1 << n):
            rides, last_w = dp[mask]
            for i in range(n):
                if not ((mask >> i) & 1):
                    new_mask = mask | (1 << i)
                    if last_w + weight[i] <= max_weight:
                        candidate = (rides, last_w + weight[i])
                    else:
                        candidate = (rides + 1, weight[i])
                    if candidate < dp[new_mask]:
                        dp[new_mask] = candidate
        return dp[(1 << n) - 1][0]

    p24_cases = [
        {"inputs": {"weight": [4, 8, 6, 1], "maxWeight": 10}, "is_sample": True, "explanation": "Ride 1: 4 + 6 = 10; Ride 2: 8 + 1 = 9. Total 2 rides."},
        {"inputs": {"weight": [2, 3, 3], "maxWeight": 5}, "is_sample": True, "explanation": "Ride 1: 2 + 3 = 5; Ride 2: 3. Total 2 rides."},
        {"inputs": {"weight": [5], "maxWeight": 10}, "is_sample": False, "explanation": None},
        {"inputs": {"weight": [5, 5, 5], "maxWeight": 5}, "is_sample": False, "explanation": None},
        {"inputs": {"weight": [1, 2, 3, 4, 5], "maxWeight": 5}, "is_sample": False, "explanation": None},
        {"inputs": {"weight": [1, 2, 3, 4, 5, 6, 7], "maxWeight": 10}, "is_sample": False, "explanation": None},
    ]
    for c in p24_cases:
        c["expected_output"] = solve_elevator_rides(c["inputs"]["weight"], c["inputs"]["maxWeight"])

    problems.append({
        "slug": "elevator-rides",
        "title": "Elevator Rides",
        "difficulty": "hard",
        "tags": ["Dynamic Programming", "Bit Manipulation"],
        "companies": ["Google", "Citadel", "Facebook"],
        "description": "There are `n` people who want to get to the top of a building which has only one elevator with weight capacity `maxWeight`.\n\nYou are given an array `weight` where `weight[i]` is the weight of person `i`.\n\nWhat is the minimum number of elevator rides needed to get all people to the top?\n\n### Constraints\n- `1 <= weight.length <= 16`\n- `1 <= maxWeight <= 10^9`\n- `1 <= weight[i] <= maxWeight`",
        "function_name": "minElevatorRides",
        "params": [{"name": "weight", "type": "integer[]"}, {"name": "maxWeight", "type": "integer"}],
        "return_type": "integer",
        "comparison_mode": "exact",
        "constraints": ["1 <= weight.length <= 16", "1 <= weight[i] <= maxWeight"],
        "hints": [
            "Use bitmask dynamic programming over all 2^n subsets of people.",
            "For each mask, track a pair (rides, last_ride_weight) and choose lexicographically smallest."
        ],
        "acceptance_rate": 41.50,
        "total_submissions": 38200,
        "display_order": 2029,
        "test_cases": p24_cases
    })

    # 25. Boolean Parenthesization Problem
    def solve_boolean_parenthesization(symb, oper):
        MOD = 1003
        n = len(symb)
        T = [[0] * n for _ in range(n)]
        F = [[0] * n for _ in range(n)]

        for i in range(n):
            if symb[i] == 'T':
                T[i][i] = 1
            else:
                F[i][i] = 1

        for length in range(2, n + 1):
            for i in range(n - length + 1):
                j = i + length - 1
                for k in range(i, j):
                    op = oper[k]
                    tik = (T[i][k] + F[i][k]) % MOD
                    tkj = (T[k + 1][j] + F[k + 1][j]) % MOD

                    if op == '&':
                        T[i][j] = (T[i][j] + T[i][k] * T[k + 1][j]) % MOD
                        total = (tik * tkj) % MOD
                        F[i][j] = (F[i][j] + total - T[i][k] * T[k + 1][j] + MOD) % MOD
                    elif op == '|':
                        F[i][j] = (F[i][j] + F[i][k] * F[k + 1][j]) % MOD
                        total = (tik * tkj) % MOD
                        T[i][j] = (T[i][j] + total - F[i][k] * F[k + 1][j] + MOD) % MOD
                    elif op == '^':
                        T[i][j] = (T[i][j] + T[i][k] * F[k + 1][j] + F[i][k] * T[k + 1][j]) % MOD
                        F[i][j] = (F[i][j] + T[i][k] * T[k + 1][j] + F[i][k] * F[k + 1][j]) % MOD
        return T[0][n - 1] % MOD

    p25_cases = [
        {"inputs": {"symb": "TFT", "oper": "^&"}, "is_sample": True, "explanation": "Expression ((T^F)&T) evaluates to True (1 way)."},
        {"inputs": {"symb": "TFF", "oper": "^|"}, "is_sample": True, "explanation": "2 ways: (T^(F|F)) and ((T^F)|F) both evaluate to True."},
        {"inputs": {"symb": "T", "oper": ""}, "is_sample": False, "explanation": None},
        {"inputs": {"symb": "F", "oper": ""}, "is_sample": False, "explanation": None},
        {"inputs": {"symb": "TTFT", "oper": "|&^"}, "is_sample": False, "explanation": None},
        {"inputs": {"symb": "TTFFT", "oper": "|&^|"}, "is_sample": False, "explanation": None},
    ]
    for c in p25_cases:
        c["expected_output"] = solve_boolean_parenthesization(c["inputs"]["symb"], c["inputs"]["oper"])

    problems.append({
        "slug": "boolean-parenthesization",
        "title": "Boolean Parenthesization Problem",
        "difficulty": "hard",
        "tags": ["Dynamic Programming"],
        "companies": ["Amazon", "Microsoft", "Directi"],
        "description": "Given a string `symb` of boolean symbols ('T' and 'F') and a string `oper` of operators ('&', '|', '^') placed between consecutive symbols.\n\nCount the number of ways to parenthesize the expression such that it evaluates to True. Return the answer modulo 1003.\n\n### Constraints\n- `1 <= symb.length <= 50`\n- `oper.length == symb.length - 1`",
        "function_name": "countBooleanParenthesizations",
        "params": [{"name": "symb", "type": "string"}, {"name": "oper", "type": "string"}],
        "return_type": "integer",
        "comparison_mode": "exact",
        "constraints": ["1 <= symb.length <= 50", "oper.length == symb.length - 1"],
        "hints": [
            "Use two DP tables: T[i][j] for ways to make the sub-expression true, F[i][j] for ways to make it false.",
            "Iterate over all possible operators k between i and j and combine using boolean logic rules."
        ],
        "acceptance_rate": 38.90,
        "total_submissions": 36700,
        "display_order": 2030,
        "test_cases": p25_cases
    })

    return problems

