# -*- coding: utf-8 -*-
"""
Batch 21 - Part 2: Problems 26 to 50 (Display Order 2031 to 2055)
Classic Graph Algorithms, Shortest Paths, and String Processing.
"""
import heapq
from collections import deque

def get_part2_problems():
    problems = []

    # 26. Dijkstra's Shortest Path Algorithm
    def solve_dijkstra(n, edges, src):
        adj = [[] for _ in range(n)]
        for u, v, w in edges:
            adj[u].append((v, w))
        dist = [-1] * n
        pq = [(0, src)]
        visited = [False] * n

        while pq:
            d, u = heapq.heappop(pq)
            if visited[u]:
                continue
            visited[u] = True
            dist[u] = d
            for v, w in adj[u]:
                if not visited[v]:
                    heapq.heappush(pq, (d + w, v))
        return dist

    p26_cases = [
        {
            "inputs": {
                "n": 4,
                "edges": [[0, 1, 4], [0, 2, 1], [2, 1, 2], [1, 3, 1], [2, 3, 5]],
                "src": 0
            },
            "is_sample": True,
            "explanation": "Shortest distances from 0: to 0 is 0, to 1 is 3 (via 2), to 2 is 1, to 3 is 4."
        },
        {
            "inputs": {
                "n": 3,
                "edges": [[0, 1, 5]],
                "src": 0
            },
            "is_sample": True,
            "explanation": "Node 2 is unreachable, so its distance is -1: [0, 5, -1]."
        },
        {
            "inputs": {
                "n": 1,
                "edges": [],
                "src": 0
            },
            "is_sample": False,
            "explanation": None
        },
        {
            "inputs": {
                "n": 5,
                "edges": [[0, 1, 2], [1, 2, 3], [2, 3, 4], [3, 4, 5], [0, 4, 10]],
                "src": 0
            },
            "is_sample": False,
            "explanation": None
        },
        {
            "inputs": {
                "n": 4,
                "edges": [[0, 1, 10], [1, 2, 10], [2, 3, 10], [3, 0, 10]],
                "src": 2
            },
            "is_sample": False,
            "explanation": None
        }
    ]
    for c in p26_cases:
        c["expected_output"] = solve_dijkstra(c["inputs"]["n"], c["inputs"]["edges"], c["inputs"]["src"])

    problems.append({
        "slug": "dijkstras-algorithm",
        "title": "Dijkstra's Shortest Path Algorithm",
        "difficulty": "medium",
        "tags": ["Graph", "Shortest Path", "Heap (Priority Queue)"],
        "companies": ["Google", "Amazon", "Microsoft", "Uber"],
        "description": "Given a directed weighted graph with `n` vertices (labeled `0` to `n - 1`) and a list of `edges` where each edge is `[u, v, w]`, compute the shortest distance from a given starting vertex `src` to every other vertex in the graph.\n\nAll edge weights `w` are non-negative. If a vertex is unreachable from `src`, its distance should be `-1`.\n\nReturn an array of length `n` where index `i` is the shortest distance from `src` to `i`.\n\n### Constraints\n- `1 <= n <= 10^4`\n- `0 <= edges.length <= 5 * 10^4`\n- `0 <= u, v < n`\n- `0 <= w <= 10^5`",
        "function_name": "dijkstraShortestPath",
        "params": [
            {"name": "n", "type": "integer"},
            {"name": "edges", "type": "integer[][]"},
            {"name": "src", "type": "integer"}
        ],
        "return_type": "integer[]",
        "comparison_mode": "exact",
        "constraints": ["1 <= n <= 10000", "0 <= edges.length <= 50000", "0 <= w <= 100000"],
        "hints": [
            "Use a min-heap (priority queue) storing pairs (distance, vertex).",
            "Keep an array dist initialized to -1, marking nodes visited once popped from the heap."
        ],
        "acceptance_rate": 56.70,
        "total_submissions": 95400,
        "display_order": 2031,
        "test_cases": p26_cases
    })

    # 27. Bellman-Ford Negative Cycle Detection
    def solve_bellman_ford(n, edges):
        dist = [0] * n
        for _ in range(n - 1):
            updated = False
            for u, v, w in edges:
                if dist[u] + w < dist[v]:
                    dist[v] = dist[u] + w
                    updated = True
            if not updated:
                return False
        for u, v, w in edges:
            if dist[u] + w < dist[v]:
                return True
        return False

    p27_cases = [
        {
            "inputs": {
                "n": 3,
                "edges": [[0, 1, 1], [1, 2, 2], [2, 0, -5]]
            },
            "is_sample": True,
            "explanation": "Cycle 0 -> 1 -> 2 -> 0 has total weight 1 + 2 - 5 = -2 < 0 (negative cycle)."
        },
        {
            "inputs": {
                "n": 3,
                "edges": [[0, 1, 1], [1, 2, 2], [2, 0, 1]]
            },
            "is_sample": True,
            "explanation": "Total cycle weight is 4 > 0, no negative cycle exists."
        },
        {
            "inputs": {
                "n": 2,
                "edges": [[0, 1, 5]]
            },
            "is_sample": False,
            "explanation": None
        },
        {
            "inputs": {
                "n": 4,
                "edges": [[0, 1, 1], [1, 2, -1], [2, 3, -1], [3, 1, -1]]
            },
            "is_sample": False,
            "explanation": None
        },
        {
            "inputs": {
                "n": 4,
                "edges": [[0, 1, 3], [1, 2, 4], [2, 3, 2], [3, 0, -8]]
            },
            "is_sample": False,
            "explanation": None
        }
    ]
    for c in p27_cases:
        c["expected_output"] = solve_bellman_ford(c["inputs"]["n"], c["inputs"]["edges"])

    problems.append({
        "slug": "bellman-ford-algorithm",
        "title": "Bellman-Ford Negative Cycle Detection",
        "difficulty": "medium",
        "tags": ["Graph", "Shortest Path"],
        "companies": ["Amazon", "Microsoft", "Uber"],
        "description": "Given a directed graph with `n` vertices (labeled `0` to `n - 1`) and a list of `edges` where `edges[i] = [u, v, w]` representing a directed edge from `u` to `v` with weight `w` (which may be negative).\n\nDetermine whether the graph contains any negative-weight cycle reachable from any vertex.\n\nReturn `true` if a negative cycle exists, or `false` otherwise.\n\n### Constraints\n- `1 <= n <= 500`\n- `0 <= edges.length <= 2500`\n- `-10^4 <= w <= 10^4`",
        "function_name": "hasNegativeWeightCycle",
        "params": [
            {"name": "n", "type": "integer"},
            {"name": "edges", "type": "integer[][]"}
        ],
        "return_type": "boolean",
        "comparison_mode": "exact",
        "constraints": ["1 <= n <= 500", "0 <= edges.length <= 2500", "-10^4 <= w <= 10^4"],
        "hints": [
            "Initialize all distances to 0 to detect negative cycles anywhere in the graph.",
            "Relax all edges n - 1 times. If any edge can still be relaxed on the n-th pass, a negative cycle exists."
        ],
        "acceptance_rate": 49.10,
        "total_submissions": 58300,
        "display_order": 2032,
        "test_cases": p27_cases
    })

    # 28. Floyd-Warshall All-Pairs Shortest Path
    def solve_floyd_warshall(n, edges):
        INF = float('inf')
        dist = [[INF] * n for _ in range(n)]
        for i in range(n):
            dist[i][i] = 0
        for u, v, w in edges:
            dist[u][v] = min(dist[u][v], w)

        for k in range(n):
            for i in range(n):
                for j in range(n):
                    if dist[i][k] != INF and dist[k][j] != INF:
                        if dist[i][k] + dist[k][j] < dist[i][j]:
                            dist[i][j] = dist[i][k] + dist[k][j]

        res = []
        for i in range(n):
            row = []
            for j in range(n):
                row.append(-1 if dist[i][j] == INF else dist[i][j])
            res.append(row)
        return res

    p28_cases = [
        {
            "inputs": {
                "n": 3,
                "edges": [[0, 1, 4], [0, 2, 7], [1, 2, 1]]
            },
            "is_sample": True,
            "explanation": "Shortest distance from 0 to 2 is 0->1->2 with weight 4 + 1 = 5."
        },
        {
            "inputs": {
                "n": 2,
                "edges": [[0, 1, 3]]
            },
            "is_sample": True,
            "explanation": "1 cannot reach 0, so dist[1][0] is -1."
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
                "n": 4,
                "edges": [[0, 1, 3], [1, 2, 1], [2, 3, 2], [0, 3, 10]]
            },
            "is_sample": False,
            "explanation": None
        }
    ]
    for c in p28_cases:
        c["expected_output"] = solve_floyd_warshall(c["inputs"]["n"], c["inputs"]["edges"])

    problems.append({
        "slug": "floyd-warshall-algorithm",
        "title": "Floyd-Warshall All-Pairs Shortest Path",
        "difficulty": "medium",
        "tags": ["Graph", "Dynamic Programming"],
        "companies": ["Amazon", "Microsoft", "Directi"],
        "description": "Given a directed weighted graph with `n` vertices (labeled `0` to `n - 1`) and a list of `edges` where each edge is `[u, v, w]`.\n\nCompute the shortest distance between every pair of vertices `(i, j)`. Return an `n x n` matrix `dist` where `dist[i][j]` is the shortest path distance from vertex `i` to vertex `j`. If there is no path from `i` to `j`, set `dist[i][j] = -1`.\n\n### Constraints\n- `1 <= n <= 100`\n- `0 <= edges.length <= 1000`\n- `0 <= w <= 10^5`",
        "function_name": "floydWarshall",
        "params": [
            {"name": "n", "type": "integer"},
            {"name": "edges", "type": "integer[][]"}
        ],
        "return_type": "integer[][]",
        "comparison_mode": "exact",
        "constraints": ["1 <= n <= 100", "0 <= edges.length <= 1000", "0 <= w <= 100000"],
        "hints": [
            "Initialize dist[i][j] to w if edge (i, j) exists, 0 if i == j, and infinity otherwise.",
            "Run 3 nested loops: for k from 0 to n - 1, for i from 0 to n - 1, for j from 0 to n - 1: dist[i][j] = min(dist[i][j], dist[i][k] + dist[k][j])."
        ],
        "acceptance_rate": 58.10,
        "total_submissions": 62400,
        "display_order": 2033,
        "test_cases": p28_cases
    })

    # 29. Kruskal's Minimum Spanning Tree
    def solve_kruskal(n, edges):
        parent = list(range(n))
        def find(i):
            if parent[i] == i:
                return i
            parent[i] = find(parent[i])
            return parent[i]

        def union(i, j):
            root_i = find(i)
            root_j = find(j)
            if root_i != root_j:
                parent[root_i] = root_j
                return True
            return False

        sorted_edges = sorted(edges, key=lambda x: x[2])
        mst_weight = 0
        edge_count = 0
        for u, v, w in sorted_edges:
            if union(u, v):
                mst_weight += w
                edge_count += 1
                if edge_count == n - 1:
                    break
        return mst_weight

    p29_cases = [
        {
            "inputs": {
                "n": 4,
                "edges": [[0, 1, 10], [0, 2, 6], [0, 3, 5], [1, 3, 15], [2, 3, 4]]
            },
            "is_sample": True,
            "explanation": "Edges chosen: (2, 3, 4), (0, 3, 5), (0, 1, 10). Total weight = 19."
        },
        {
            "inputs": {
                "n": 3,
                "edges": [[0, 1, 5], [1, 2, 3], [0, 2, 1]]
            },
            "is_sample": True,
            "explanation": "Edges (0, 2, 1) and (1, 2, 3) form MST with weight 4."
        },
        {
            "inputs": {
                "n": 2,
                "edges": [[0, 1, 7]]
            },
            "is_sample": False,
            "explanation": None
        },
        {
            "inputs": {
                "n": 5,
                "edges": [[0, 1, 2], [0, 3, 6], [1, 2, 3], [1, 3, 8], [1, 4, 5], [2, 4, 7], [3, 4, 9]]
            },
            "is_sample": False,
            "explanation": None
        }
    ]
    for c in p29_cases:
        c["expected_output"] = solve_kruskal(c["inputs"]["n"], c["inputs"]["edges"])

    problems.append({
        "slug": "kruskals-minimum-spanning-tree",
        "title": "Kruskal's Minimum Spanning Tree",
        "difficulty": "medium",
        "tags": ["Graph", "Greedy", "Union Find"],
        "companies": ["Amazon", "Google", "Morgan Stanley"],
        "description": "Given a connected, undirected weighted graph with `n` vertices (numbered `0` to `n - 1`) and an array of `edges` where `edges[i] = [u, v, w]`.\n\nFind the total weight of the Minimum Spanning Tree (MST) of the graph using Kruskal's algorithm.\n\n### Constraints\n- `1 <= n <= 10^4`\n- `n - 1 <= edges.length <= 5 * 10^4`\n- `0 <= w <= 10^5`",
        "function_name": "kruskalMST",
        "params": [
            {"name": "n", "type": "integer"},
            {"name": "edges", "type": "integer[][]"}
        ],
        "return_type": "integer",
        "comparison_mode": "exact",
        "constraints": ["1 <= n <= 10000", "edges.length <= 50000", "0 <= w <= 100000"],
        "hints": [
            "Sort all edges by weight in ascending order.",
            "Use Disjoint Set Union (DSU) to add edges that connect previously disconnected components until n - 1 edges are selected."
        ],
        "acceptance_rate": 63.20,
        "total_submissions": 72400,
        "display_order": 2034,
        "test_cases": p29_cases
    })

    # 30. Prim's Minimum Spanning Tree
    def solve_prim(n, edges):
        adj = [[] for _ in range(n)]
        for u, v, w in edges:
            adj[u].append((v, w))
            adj[v].append((u, w))

        visited = [False] * n
        pq = [(0, 0)]
        mst_weight = 0
        nodes_in_mst = 0

        while pq and nodes_in_mst < n:
            w, u = heapq.heappop(pq)
            if visited[u]:
                continue
            visited[u] = True
            mst_weight += w
            nodes_in_mst += 1
            for v, weight in adj[u]:
                if not visited[v]:
                    heapq.heappush(pq, (weight, v))

        return mst_weight

    p30_cases = [
        {
            "inputs": {
                "n": 3,
                "edges": [[0, 1, 5], [1, 2, 3], [0, 2, 1]]
            },
            "is_sample": True,
            "explanation": "Weight is 1 + 3 = 4."
        },
        {
            "inputs": {
                "n": 4,
                "edges": [[0, 1, 1], [1, 2, 2], [2, 3, 3], [0, 3, 4]]
            },
            "is_sample": True,
            "explanation": "Pick edges with weights 1, 2, 3 -> total 6."
        },
        {
            "inputs": {
                "n": 2,
                "edges": [[0, 1, 100]]
            },
            "is_sample": False,
            "explanation": None
        },
        {
            "inputs": {
                "n": 4,
                "edges": [[0, 1, 2], [0, 2, 3], [0, 3, 4], [1, 2, 5], [2, 3, 7]]
            },
            "is_sample": False,
            "explanation": None
        }
    ]
    for c in p30_cases:
        c["expected_output"] = solve_prim(c["inputs"]["n"], c["inputs"]["edges"])

    problems.append({
        "slug": "prims-minimum-spanning-tree",
        "title": "Prim's Minimum Spanning Tree",
        "difficulty": "medium",
        "tags": ["Graph", "Greedy", "Heap (Priority Queue)"],
        "companies": ["Microsoft", "Google", "Adobe"],
        "description": "Given a connected, undirected weighted graph with `n` vertices (numbered `0` to `n - 1`) and an array of `edges` where each edge is `[u, v, w]`.\n\nCalculate the sum of weights of edges in the Minimum Spanning Tree using Prim's algorithm with a priority queue.\n\n### Constraints\n- `1 <= n <= 10^4`\n- `n - 1 <= edges.length <= 5 * 10^4`\n- `0 <= w <= 10^5`",
        "function_name": "primMST",
        "params": [
            {"name": "n", "type": "integer"},
            {"name": "edges", "type": "integer[][]"}
        ],
        "return_type": "integer",
        "comparison_mode": "exact",
        "constraints": ["1 <= n <= 10000", "edges.length <= 50000", "0 <= w <= 100000"],
        "hints": [
            "Start from node 0 and push all its incident edges into a min-priority queue.",
            "Repeatedly extract the minimum weight edge that connects an unvisited node to the tree."
        ],
        "acceptance_rate": 59.80,
        "total_submissions": 66800,
        "display_order": 2035,
        "test_cases": p30_cases
    })

    # 31. Tarjan's Strongly Connected Components
    def solve_tarjan_scc(n, edges):
        adj = [[] for _ in range(n)]
        for u, v in edges:
            adj[u].append(v)

        disc = [-1] * n
        low = [-1] * n
        in_stack = [False] * n
        stack = []
        timer = 0
        scc_count = 0

        def dfs(u):
            nonlocal timer, scc_count
            disc[u] = low[u] = timer
            timer += 1
            stack.append(u)
            in_stack[u] = True

            for v in adj[u]:
                if disc[v] == -1:
                    dfs(v)
                    low[u] = min(low[u], low[v])
                elif in_stack[v]:
                    low[u] = min(low[u], disc[v])

            if low[u] == disc[u]:
                scc_count += 1
                while True:
                    node = stack.pop()
                    in_stack[node] = False
                    if node == u:
                        break

        for i in range(n):
            if disc[i] == -1:
                dfs(i)

        return scc_count

    p31_cases = [
        {
            "inputs": {
                "n": 5,
                "edges": [[1, 0], [0, 2], [2, 1], [0, 3], [3, 4]]
            },
            "is_sample": True,
            "explanation": "3 SCCs: {0, 1, 2}, {3}, {4}."
        },
        {
            "inputs": {
                "n": 4,
                "edges": [[0, 1], [1, 2], [2, 3], [3, 0]]
            },
            "is_sample": True,
            "explanation": "Single cycle of all 4 vertices forms 1 SCC."
        },
        {
            "inputs": {
                "n": 3,
                "edges": [[0, 1], [1, 2]]
            },
            "is_sample": False,
            "explanation": None
        },
        {
            "inputs": {
                "n": 6,
                "edges": [[0, 1], [1, 2], [2, 0], [3, 4], [4, 5], [5, 3], [2, 3]]
            },
            "is_sample": False,
            "explanation": None
        }
    ]
    for c in p31_cases:
        c["expected_output"] = solve_tarjan_scc(c["inputs"]["n"], c["inputs"]["edges"])

    problems.append({
        "slug": "tarjans-scc",
        "title": "Tarjan's Strongly Connected Components",
        "difficulty": "hard",
        "tags": ["Graph", "DFS"],
        "companies": ["Google", "Amazon", "Directi"],
        "description": "Given a directed graph with `n` vertices (labeled `0` to `n - 1`) and a list of directed `edges` where each edge is `[u, v]`.\n\nCount the number of Strongly Connected Components (SCCs) in the graph using Tarjan's single-pass DFS algorithm.\n\nA strongly connected component is a maximal subgraph where every vertex is reachable from every other vertex in that subgraph.\n\n### Constraints\n- `1 <= n <= 10^4`\n- `0 <= edges.length <= 5 * 10^4`",
        "function_name": "countSCCsTarjan",
        "params": [
            {"name": "n", "type": "integer"},
            {"name": "edges", "type": "integer[][]"}
        ],
        "return_type": "integer",
        "comparison_mode": "exact",
        "constraints": ["1 <= n <= 10000", "0 <= edges.length <= 50000"],
        "hints": [
            "Maintain discovery time disc[u] and lowest reachable time low[u] during DFS traversal.",
            "Push nodes onto a stack. When low[u] == disc[u], pop all nodes belonging to the current SCC."
        ],
        "acceptance_rate": 44.30,
        "total_submissions": 41200,
        "display_order": 2036,
        "test_cases": p31_cases
    })

    # 32. Kosaraju's Algorithm for SCC
    def solve_kosaraju(n, edges):
        adj = [[] for _ in range(n)]
        adj_rev = [[] for _ in range(n)]
        for u, v in edges:
            adj[u].append(v)
            adj_rev[v].append(u)

        visited = [False] * n
        order = []

        def dfs1(u):
            visited[u] = True
            for v in adj[u]:
                if not visited[v]:
                    dfs1(v)
            order.append(u)

        for i in range(n):
            if not visited[i]:
                dfs1(i)

        visited = [False] * n
        scc_count = 0

        def dfs2(u):
            visited[u] = True
            for v in adj_rev[u]:
                if not visited[v]:
                    dfs2(v)

        for u in reversed(order):
            if not visited[u]:
                dfs2(u)
                scc_count += 1

        return scc_count

    p32_cases = [
        {
            "inputs": {
                "n": 5,
                "edges": [[0, 2], [2, 1], [1, 0], [0, 3], [3, 4]]
            },
            "is_sample": True,
            "explanation": "3 SCCs: {0, 1, 2}, {3}, {4}."
        },
        {
            "inputs": {
                "n": 3,
                "edges": [[0, 1], [1, 2], [2, 0]]
            },
            "is_sample": True,
            "explanation": "Single cycle is 1 SCC."
        },
        {
            "inputs": {
                "n": 4,
                "edges": [[0, 1], [1, 2], [2, 3]]
            },
            "is_sample": False,
            "explanation": None
        },
        {
            "inputs": {
                "n": 1,
                "edges": []
            },
            "is_sample": False,
            "explanation": None
        }
    ]
    for c in p32_cases:
        c["expected_output"] = solve_kosaraju(c["inputs"]["n"], c["inputs"]["edges"])

    problems.append({
        "slug": "kosarajus-algorithm",
        "title": "Kosaraju's Algorithm for SCC",
        "difficulty": "medium",
        "tags": ["Graph", "DFS"],
        "companies": ["Amazon", "Microsoft", "Goldman Sachs"],
        "description": "Given a directed graph with `n` vertices (labeled `0` to `n - 1`) and a list of directed `edges` where each edge is `[u, v]`.\n\nCount the total number of Strongly Connected Components (SCCs) using Kosaraju's two-pass DFS algorithm.\n\n### Constraints\n- `1 <= n <= 10^4`\n- `0 <= edges.length <= 5 * 10^4`",
        "function_name": "countSCCsKosaraju",
        "params": [
            {"name": "n", "type": "integer"},
            {"name": "edges", "type": "integer[][]"}
        ],
        "return_type": "integer",
        "comparison_mode": "exact",
        "constraints": ["1 <= n <= 10000", "0 <= edges.length <= 50000"],
        "hints": [
            "Pass 1: Perform DFS on the original graph and push nodes to an order list by finish time.",
            "Pass 2: Transpose the graph (reverse all edges) and run DFS in reverse finish-time order."
        ],
        "acceptance_rate": 53.40,
        "total_submissions": 48900,
        "display_order": 2037,
        "test_cases": p32_cases
    })

    # 33. Kahn's Algorithm for Topological Sorting
    def solve_kahns(n, edges):
        in_degree = [0] * n
        adj = [[] for _ in range(n)]
        for u, v in edges:
            adj[u].append(v)
            in_degree[v] += 1

        pq = []
        for i in range(n):
            if in_degree[i] == 0:
                heapq.heappush(pq, i)

        order = []
        while pq:
            u = heapq.heappop(pq)
            order.append(u)
            for v in adj[u]:
                in_degree[v] -= 1
                if in_degree[v] == 0:
                    heapq.heappush(pq, v)

        return order if len(order) == n else []

    p33_cases = [
        {
            "inputs": {
                "n": 6,
                "edges": [[5, 2], [5, 0], [4, 0], [4, 1], [2, 3], [3, 1]]
            },
            "is_sample": True,
            "explanation": "Valid lexicographically smallest topological sort is [4, 5, 0, 2, 3, 1]."
        },
        {
            "inputs": {
                "n": 2,
                "edges": [[0, 1], [1, 0]]
            },
            "is_sample": True,
            "explanation": "Graph contains a cycle, impossible to topologically sort, returns []."
        },
        {
            "inputs": {
                "n": 3,
                "edges": [[0, 1], [1, 2]]
            },
            "is_sample": False,
            "explanation": None
        },
        {
            "inputs": {
                "n": 4,
                "edges": [[3, 0], [3, 1], [2, 0]]
            },
            "is_sample": False,
            "explanation": None
        }
    ]
    for c in p33_cases:
        c["expected_output"] = solve_kahns(c["inputs"]["n"], c["inputs"]["edges"])

    problems.append({
        "slug": "kahns-algorithm",
        "title": "Kahn's Algorithm for Topological Sorting",
        "difficulty": "medium",
        "tags": ["Graph", "BFS", "Topological Sort"],
        "companies": ["Amazon", "Google", "Facebook", "Microsoft"],
        "description": "Given a Directed Acyclic Graph (DAG) with `n` vertices (numbered `0` to `n - 1`) and a list of directed `edges` where each edge `[u, v]` represents a dependency $u \\to v$.\n\nFind a valid topological ordering of vertices using Kahn's algorithm (BFS with in-degrees). If multiple valid orderings exist, prioritize smaller vertex IDs using a min-heap.\n\nIf the graph contains a cycle and no valid topological ordering is possible, return an empty array `[]`.\n\n### Constraints\n- `1 <= n <= 10^4`\n- `0 <= edges.length <= 5 * 10^4`",
        "function_name": "topologicalSort",
        "params": [
            {"name": "n", "type": "integer"},
            {"name": "edges", "type": "integer[][]"}
        ],
        "return_type": "integer[]",
        "comparison_mode": "exact",
        "constraints": ["1 <= n <= 10000", "0 <= edges.length <= 50000"],
        "hints": [
            "Compute the in-degree of all vertices.",
            "Initialize a min-heap with all vertices that have in-degree 0.",
            "Pop vertices, add to result, and decrement in-degrees of their outgoing neighbors."
        ],
        "acceptance_rate": 61.20,
        "total_submissions": 87500,
        "display_order": 2038,
        "test_cases": p33_cases
    })

    # 34. Counting Rooms
    def solve_counting_rooms(grid):
        if not grid or not grid[0]:
            return 0
        R, C = len(grid), len(grid[0])
        visited = [[False] * C for _ in range(R)]
        rooms = 0

        for r in range(R):
            for c in range(C):
                if grid[r][c] == '.' and not visited[r][c]:
                    rooms += 1
                    q = deque([(r, c)])
                    visited[r][c] = True
                    while q:
                        cr, cc = q.popleft()
                        for dr, dc in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                            nr, nc = cr + dr, cc + dc
                            if 0 <= nr < R and 0 <= nc < C and grid[nr][nc] == '.' and not visited[nr][nc]:
                                visited[nr][nc] = True
                                q.append((nr, nc))
        return rooms

    p34_cases = [
        {
            "inputs": {
                "grid": [
                    "########",
                    "#..#...#",
                    "####.#.#",
                    "#..#...#",
                    "########"
                ]
            },
            "is_sample": True,
            "explanation": "3 rooms in the building."
        },
        {
            "inputs": {
                "grid": [
                    "###",
                    "#.#",
                    "###"
                ]
            },
            "is_sample": True,
            "explanation": "Single room of 1 floor tile."
        },
        {
            "inputs": {
                "grid": [
                    "####",
                    "####"
                ]
            },
            "is_sample": False,
            "explanation": None
        },
        {
            "inputs": {
                "grid": [
                    "#...#",
                    "#...#",
                    "#...#"
                ]
            },
            "is_sample": False,
            "explanation": None
        }
    ]
    for c in p34_cases:
        c["expected_output"] = solve_counting_rooms(c["inputs"]["grid"])

    problems.append({
        "slug": "counting-rooms",
        "title": "Counting Rooms",
        "difficulty": "medium",
        "tags": ["Graph", "BFS", "Matrix"],
        "companies": ["Amazon", "Uber", "Flipkart"],
        "description": "You are given a map of a building represented as an array of strings `grid`, where `.` denotes an open floor tile and `#` denotes a solid wall.\n\nYou can walk horizontally and vertically through floor tiles. A room is a maximal connected component of floor tiles.\n\nYour task is to count the number of rooms in the building.\n\n### Constraints\n- `1 <= grid.length, grid[0].length <= 500`\n- `grid[i][j]` is either `.` or `#`",
        "function_name": "countRooms",
        "params": [{"name": "grid", "type": "string[]"}],
        "return_type": "integer",
        "comparison_mode": "exact",
        "constraints": ["1 <= grid.length <= 500", "grid[i] contains only '.' and '#'"],
        "hints": [
            "Use standard connected component search (BFS or DFS) on the 2D grid.",
            "Keep a visited 2D array or mark visited cells in-place to ensure each cell is visited at most once."
        ],
        "acceptance_rate": 65.80,
        "total_submissions": 76500,
        "display_order": 2039,
        "test_cases": p34_cases
    })

    # 35. Building Roads
    def solve_building_roads(n, roads):
        parent = list(range(n + 1))
        def find(i):
            if parent[i] == i:
                return i
            parent[i] = find(parent[i])
            return parent[i]

        def union(i, j):
            ri, rj = find(i), find(j)
            if ri != rj:
                parent[ri] = rj

        for u, v in roads:
            union(u, v)

        reps = []
        for i in range(1, n + 1):
            if find(i) == i:
                reps.append(i)

        new_roads = []
        for i in range(1, len(reps)):
            new_roads.append([reps[i - 1], reps[i]])
        return new_roads

    p35_cases = [
        {
            "inputs": {
                "n": 4,
                "roads": [[1, 2], [3, 4]]
            },
            "is_sample": True,
            "explanation": "Two components: {1, 2} and {3, 4}. Connect 2 and 4 (or 1 and 3) with 1 new road."
        },
        {
            "inputs": {
                "n": 4,
                "roads": [[1, 2], [2, 3], [3, 4]]
            },
            "is_sample": True,
            "explanation": "All 4 cities are already connected, returns []."
        },
        {
            "inputs": {
                "n": 2,
                "roads": []
            },
            "is_sample": False,
            "explanation": None
        },
        {
            "inputs": {
                "n": 5,
                "roads": [[1, 2], [2, 3]]
            },
            "is_sample": False,
            "explanation": None
        }
    ]
    for c in p35_cases:
        c["expected_output"] = solve_building_roads(c["inputs"]["n"], c["inputs"]["roads"])

    problems.append({
        "slug": "building-roads",
        "title": "Building Roads",
        "difficulty": "medium",
        "tags": ["Graph", "Union Find", "DFS"],
        "companies": ["Microsoft", "Google", "Goldman Sachs"],
        "description": "There are `n` cities labeled `1` to `n` and `m` bidirectional roads.\n\nYour task is to find the minimum number of new roads required so that there is a path between every pair of cities, and output which roads should be constructed.\n\nReturn an array of new roads where each road is `[u, v]`. If multiple valid constructions exist, return the one connecting the canonical component representative of each component in increasing order of representative.\n\n### Constraints\n- `1 <= n <= 10^5`\n- `0 <= roads.length <= 2 * 10^5`",
        "function_name": "minRoadsToConnect",
        "params": [
            {"name": "n", "type": "integer"},
            {"name": "roads", "type": "integer[][]"}
        ],
        "return_type": "integer[][]",
        "comparison_mode": "exact",
        "constraints": ["1 <= n <= 10^5", "0 <= roads.length <= 200000"],
        "hints": [
            "Use Disjoint Set Union (DSU) or DFS to find all connected components.",
            "If there are C components, exactly C - 1 roads are needed to connect them all."
        ],
        "acceptance_rate": 64.10,
        "total_submissions": 68900,
        "display_order": 2040,
        "test_cases": p35_cases
    })

    # 36. Message Route
    def solve_message_route(n, connections):
        adj = [[] for _ in range(n + 1)]
        for u, v in connections:
            adj[u].append(v)
            adj[v].append(u)

        dist = [-1] * (n + 1)
        parent = [-1] * (n + 1)
        q = deque([1])
        dist[1] = 0

        while q:
            u = q.popleft()
            if u == n:
                break
            for v in adj[u]:
                if dist[v] == -1:
                    dist[v] = dist[u] + 1
                    parent[v] = u
                    q.append(v)

        if dist[n] == -1:
            return []

        curr = n
        path = []
        while curr != -1:
            path.append(curr)
            curr = parent[curr]
        return path[::-1]

    p36_cases = [
        {
            "inputs": {
                "n": 5,
                "connections": [[1, 2], [1, 3], [1, 4], [2, 3], [5, 4]]
            },
            "is_sample": True,
            "explanation": "Shortest route is 1 -> 4 -> 5 (length 3)."
        },
        {
            "inputs": {
                "n": 5,
                "connections": [[1, 2], [3, 4]]
            },
            "is_sample": True,
            "explanation": "No connection to computer 5, returns []."
        },
        {
            "inputs": {
                "n": 2,
                "connections": [[1, 2]]
            },
            "is_sample": False,
            "explanation": None
        },
        {
            "inputs": {
                "n": 4,
                "connections": [[1, 2], [2, 3], [3, 4], [1, 4]]
            },
            "is_sample": False,
            "explanation": None
        }
    ]
    for c in p36_cases:
        c["expected_output"] = solve_message_route(c["inputs"]["n"], c["inputs"]["connections"])

    problems.append({
        "slug": "message-route",
        "title": "Message Route",
        "difficulty": "medium",
        "tags": ["Graph", "BFS"],
        "companies": ["Amazon", "Uber", "Citadel"],
        "description": "A computer network consists of `n` computers labeled `1` to `n` and bidirectional network cable connections.\n\nFind the shortest route for a network packet traveling from computer `1` to computer `n`.\n\nReturn the sequence of computer IDs on the shortest path (inclusive of `1` and `n`). If multiple shortest paths exist, any one is acceptable. If no route exists, return an empty array `[]`.\n\n### Constraints\n- `2 <= n <= 10^5`\n- `1 <= connections.length <= 2 * 10^5`",
        "function_name": "shortestMessageRoute",
        "params": [
            {"name": "n", "type": "integer"},
            {"name": "connections", "type": "integer[][]"}
        ],
        "return_type": "integer[]",
        "comparison_mode": "exact",
        "constraints": ["2 <= n <= 10^5", "connections.length <= 200000"],
        "hints": [
            "Use standard unweighted Breadth-First Search (BFS) starting from computer 1.",
            "Maintain a parent pointer array to reconstruct the path backwards from computer n."
        ],
        "acceptance_rate": 60.50,
        "total_submissions": 74200,
        "display_order": 2041,
        "test_cases": p36_cases
    })

    # 37. Building Teams
    def solve_building_teams(n, friendships):
        adj = [[] for _ in range(n + 1)]
        for u, v in friendships:
            adj[u].append(v)
            adj[v].append(u)

        team = [0] * (n + 1)
        for i in range(1, n + 1):
            if team[i] == 0:
                team[i] = 1
                q = deque([i])
                while q:
                    u = q.popleft()
                    for v in adj[u]:
                        if team[v] == 0:
                            team[v] = 3 - team[u]
                            q.append(v)
                        elif team[v] == team[u]:
                            return []
        return team[1:]

    p37_cases = [
        {
            "inputs": {
                "n": 5,
                "friendships": [[1, 2], [1, 3], [4, 5]]
            },
            "is_sample": True,
            "explanation": "Valid assignment: pupil 1 team 1, pupils 2 and 3 team 2, pupil 4 team 1, pupil 5 team 2."
        },
        {
            "inputs": {
                "n": 3,
                "friendships": [[1, 2], [2, 3], [3, 1]]
            },
            "is_sample": True,
            "explanation": "Odd cycle triangle requires 3 teams; impossible with 2, returns []."
        },
        {
            "inputs": {
                "n": 4,
                "friendships": [[1, 2], [2, 3], [3, 4], [4, 1]]
            },
            "is_sample": False,
            "explanation": None
        },
        {
            "inputs": {
                "n": 2,
                "friendships": []
            },
            "is_sample": False,
            "explanation": None
        }
    ]
    for c in p37_cases:
        c["expected_output"] = solve_building_teams(c["inputs"]["n"], c["inputs"]["friendships"])

    problems.append({
        "slug": "building-teams",
        "title": "Building Teams",
        "difficulty": "medium",
        "tags": ["Graph", "BFS", "Bipartite"],
        "companies": ["Google", "Bloomberg", "Salesforce"],
        "description": "There are `n` pupils numbered `1` to `n` and `m` pairs of friends.\n\nYour task is to divide the pupils into two teams (team 1 and team 2) such that no two pupils on the same team are friends.\n\nReturn an array of length `n` where the `i`-th value is either `1` or `2` representing the team of pupil $i + 1$. If no valid assignment exists (the graph is not bipartite), return an empty array `[]`.\n\n### Constraints\n- `1 <= n <= 10^5`\n- `0 <= friendships.length <= 2 * 10^5`",
        "function_name": "buildTwoTeams",
        "params": [
            {"name": "n", "type": "integer"},
            {"name": "friendships", "type": "integer[][]"}
        ],
        "return_type": "integer[]",
        "comparison_mode": "exact",
        "constraints": ["1 <= n <= 10^5", "friendships.length <= 200000"],
        "hints": [
            "This is the bipartite 2-coloring problem.",
            "Use BFS or DFS to color connected components with colors 1 and 2. If an edge connects two nodes of the same color, it is impossible."
        ],
        "acceptance_rate": 58.70,
        "total_submissions": 68400,
        "display_order": 2042,
        "test_cases": p37_cases
    })

    # 38. Round Trip Cycle
    def solve_round_trip(n, roads):
        adj = [[] for _ in range(n + 1)]
        for u, v in roads:
            adj[u].append(v)
            adj[v].append(u)

        visited = [False] * (n + 1)
        parent = [0] * (n + 1)
        cycle = []

        def dfs(u, p):
            visited[u] = True
            parent[u] = p
            for v in adj[u]:
                if v == p:
                    continue
                if visited[v]:
                    # Found cycle
                    curr = u
                    c = [v]
                    while curr != v:
                        c.append(curr)
                        curr = parent[curr]
                    c.append(v)
                    cycle.extend(c[::-1])
                    return True
                if dfs(v, u):
                    return True
            return False

        for i in range(1, n + 1):
            if not visited[i]:
                if dfs(i, 0):
                    return cycle
        return []

    p38_cases = [
        {
            "inputs": {
                "n": 5,
                "roads": [[1, 3], [1, 2], [5, 3], [1, 5], [2, 4]]
            },
            "is_sample": True,
            "explanation": "Valid cycle starts and ends at 1: [1, 3, 5, 1]."
        },
        {
            "inputs": {
                "n": 4,
                "roads": [[1, 2], [2, 3], [3, 4]]
            },
            "is_sample": True,
            "explanation": "A tree contains no cycles, returns []."
        },
        {
            "inputs": {
                "n": 3,
                "roads": [[1, 2], [2, 3], [3, 1]]
            },
            "is_sample": False,
            "explanation": None
        },
        {
            "inputs": {
                "n": 4,
                "roads": [[1, 2], [2, 3], [3, 4], [4, 1]]
            },
            "is_sample": False,
            "explanation": None
        }
    ]
    for c in p38_cases:
        c["expected_output"] = solve_round_trip(c["inputs"]["n"], c["inputs"]["roads"])

    problems.append({
        "slug": "round-trip",
        "title": "Round Trip Cycle",
        "difficulty": "medium",
        "tags": ["Graph", "DFS", "Cycle Detection"],
        "companies": ["Google", "Uber", "Palantir"],
        "description": "Given an undirected graph of `n` cities labeled `1` to `n` and `m` bidirectional roads.\n\nFind any round-trip route that starts and ends at the same city and visits at least 3 distinct cities on the cycle, with no repeated cities other than the start and end.\n\nReturn the sequence of cities on the cycle. If multiple cycles exist, return any one. If no cycle exists, return an empty array `[]`.\n\n### Constraints\n- `1 <= n <= 10^5`\n- `0 <= roads.length <= 2 * 10^5`",
        "function_name": "findCycle",
        "params": [
            {"name": "n", "type": "integer"},
            {"name": "roads", "type": "integer[][]"}
        ],
        "return_type": "integer[]",
        "comparison_mode": "exact",
        "constraints": ["1 <= n <= 10^5", "0 <= roads.length <= 200000"],
        "hints": [
            "Use DFS tracking the parent of each visited vertex.",
            "When encountering a neighbor that is already visited and not the immediate parent, a back-edge has been found that forms a cycle."
        ],
        "acceptance_rate": 51.40,
        "total_submissions": 56700,
        "display_order": 2043,
        "test_cases": p38_cases
    })

    # 39. Flight Discount
    def solve_flight_discount(n, flights):
        adj = [[] for _ in range(n + 1)]
        for u, v, p in flights:
            adj[u].append((v, p))

        dist = [[float('inf')] * 2 for _ in range(n + 1)]
        dist[1][0] = 0
        pq = [(0, 1, 0)]  # (cost, node, used_coupon)

        while pq:
            d, u, used = heapq.heappop(pq)
            if d > dist[u][used]:
                continue
            if u == n and used == 1:
                return d
            for v, p in adj[u]:
                # Option 1: Don't use coupon on this edge
                if d + p < dist[v][used]:
                    dist[v][used] = d + p
                    heapq.heappush(pq, (d + p, v, used))
                # Option 2: Use coupon on this edge (if not used yet)
                if used == 0:
                    discounted = d + p // 2
                    if discounted < dist[v][1]:
                        dist[v][1] = discounted
                        heapq.heappush(pq, (discounted, v, 1))

        return dist[n][1]

    p39_cases = [
        {
            "inputs": {
                "n": 3,
                "flights": [[1, 2, 3], [2, 3, 1], [1, 3, 7]]
            },
            "is_sample": True,
            "explanation": "Path 1 -> 2 -> 3 with coupon on flight 1 (cost floor(3/2) = 1) gives 1 + 1 = 2."
        },
        {
            "inputs": {
                "n": 4,
                "flights": [[1, 2, 10], [2, 4, 10], [1, 3, 2], [3, 4, 20]]
            },
            "is_sample": True,
            "explanation": "Path 1 -> 3 -> 4 with discount on flight (3, 4): 2 + 10 = 12."
        },
        {
            "inputs": {
                "n": 2,
                "flights": [[1, 2, 5]]
            },
            "is_sample": False,
            "explanation": None
        },
        {
            "inputs": {
                "n": 4,
                "flights": [[1, 2, 4], [2, 3, 6], [3, 4, 8], [1, 4, 20]]
            },
            "is_sample": False,
            "explanation": None
        }
    ]
    for c in p39_cases:
        c["expected_output"] = solve_flight_discount(c["inputs"]["n"], c["inputs"]["flights"])

    problems.append({
        "slug": "flight-discount",
        "title": "Flight Discount",
        "difficulty": "hard",
        "tags": ["Graph", "Shortest Path", "Heap (Priority Queue)"],
        "companies": ["Google", "Amazon", "Citadel"],
        "description": "There are `n` cities (labeled `1` to `n`) and directed flight routes between them with ticket price `[u, v, price]`.\n\nYou have a discount coupon that halves the price of exactly one flight along your journey (integer division $\\lfloor price / 2 \\rfloor$).\n\nFind the minimum total price to travel from city `1` to city `n`. Return the result as a 64-bit integer.\n\n### Constraints\n- `2 <= n <= 10^5`\n- `1 <= flights.length <= 2 * 10^5`\n- `1 <= price <= 10^9`",
        "function_name": "minFlightDiscount",
        "params": [
            {"name": "n", "type": "integer"},
            {"name": "flights", "type": "integer[][]"}
        ],
        "return_type": "long",
        "comparison_mode": "exact",
        "constraints": ["2 <= n <= 10^5", "flights.length <= 200000", "1 <= price <= 10^9"],
        "hints": [
            "Use state space expansion: dist[u][0] is shortest distance to u without using the coupon, dist[u][1] is shortest distance to u having used the coupon.",
            "Run Dijkstra over the expanded graph with 2 states per node."
        ],
        "acceptance_rate": 43.80,
        "total_submissions": 51200,
        "display_order": 2044,
        "test_cases": p39_cases
    })

    # 40. Eulerian Circuit in Directed Graph
    def solve_eulerian_circuit(n, edges):
        in_deg = [0] * n
        out_deg = [0] * n
        adj = [[] for _ in range(n)]

        for u, v in edges:
            out_deg[u] += 1
            in_deg[v] += 1
            adj[u].append(v)

        for i in range(n):
            if in_deg[i] != out_deg[i]:
                return False

        # Connectivity check for vertices with positive degree
        start = -1
        total_edges = len(edges)
        if total_edges == 0:
            return True

        for i in range(n):
            if out_deg[i] > 0:
                start = i
                break

        visited = [False] * n
        q = deque([start])
        visited[start] = True
        while q:
            u = q.popleft()
            for v in adj[u]:
                if not visited[v]:
                    visited[v] = True
                    q.append(v)

        for i in range(n):
            if out_deg[i] > 0 and not visited[i]:
                return False

        return True

    p40_cases = [
        {
            "inputs": {
                "n": 3,
                "edges": [[0, 1], [1, 2], [2, 0]]
            },
            "is_sample": True,
            "explanation": "Every node has in_degree == out_degree == 1, connected component forms an Eulerian circuit."
        },
        {
            "inputs": {
                "n": 3,
                "edges": [[0, 1], [1, 2]]
            },
            "is_sample": True,
            "explanation": "Node 0 has in-degree 0, out-degree 1. No Eulerian circuit."
        },
        {
            "inputs": {
                "n": 4,
                "edges": [[0, 1], [1, 2], [2, 3], [3, 0], [1, 3], [3, 1]]
            },
            "is_sample": False,
            "explanation": None
        },
        {
            "inputs": {
                "n": 1,
                "edges": []
            },
            "is_sample": False,
            "explanation": None
        }
    ]
    for c in p40_cases:
        c["expected_output"] = solve_eulerian_circuit(c["inputs"]["n"], c["inputs"]["edges"])

    problems.append({
        "slug": "eulerian-path-directed",
        "title": "Eulerian Circuit in Directed Graph",
        "difficulty": "medium",
        "tags": ["Graph", "Eulerian Circuit"],
        "companies": ["Amazon", "Google", "Microsoft"],
        "description": "Given a directed graph with `n` vertices (numbered `0` to `n - 1`) and a list of directed `edges` where each edge is `[u, v]`.\n\nDetermine whether the graph has an Eulerian circuit (a closed path that visits every directed edge in the graph exactly once).\n\nReturn `true` if an Eulerian circuit exists, or `false` otherwise.\n\n### Constraints\n- `1 <= n <= 10^4`\n- `0 <= edges.length <= 5 * 10^4`",
        "function_name": "hasEulerianCircuit",
        "params": [
            {"name": "n", "type": "integer"},
            {"name": "edges", "type": "integer[][]"}
        ],
        "return_type": "boolean",
        "comparison_mode": "exact",
        "constraints": ["1 <= n <= 10000", "0 <= edges.length <= 50000"],
        "hints": [
            "A directed graph has an Eulerian circuit if and only if every vertex has in-degree equal to out-degree, and all vertices with non-zero degree belong to a single strongly connected component."
        ],
        "acceptance_rate": 52.30,
        "total_submissions": 38100,
        "display_order": 2045,
        "test_cases": p40_cases
    })

    # 41. KMP String Matching Algorithm
    def solve_kmp(text, pattern):
        if not pattern:
            return []
        m, n = len(pattern), len(text)
        lps = [0] * m
        length = 0
        i = 1
        while i < m:
            if pattern[i] == pattern[length]:
                length += 1
                lps[i] = length
                i += 1
            elif length != 0:
                length = lps[length - 1]
            else:
                lps[i] = 0
                i += 1

        res = []
        i = j = 0
        while i < n:
            if pattern[j] == text[i]:
                i += 1
                j += 1
            if j == m:
                res.append(i - j)
                j = lps[j - 1]
            elif i < n and pattern[j] != text[i]:
                if j != 0:
                    j = lps[j - 1]
                else:
                    i += 1
        return res

    p41_cases = [
        {"inputs": {"text": "AABAACAADAABAABA", "pattern": "AABA"}, "is_sample": True, "explanation": "Pattern 'AABA' occurs at indices 0, 9, 12."},
        {"inputs": {"text": "ABCDE", "pattern": "CD"}, "is_sample": True, "explanation": "Occurs once at index 2."},
        {"inputs": {"text": "AAAAAB", "pattern": "AAA"}, "is_sample": False, "explanation": None},
        {"inputs": {"text": "HELLO", "pattern": "WORLD"}, "is_sample": False, "explanation": None},
        {"inputs": {"text": "ABC", "pattern": "A"}, "is_sample": False, "explanation": None},
    ]
    for c in p41_cases:
        c["expected_output"] = solve_kmp(c["inputs"]["text"], c["inputs"]["pattern"])

    problems.append({
        "slug": "knuth-morris-pratt",
        "title": "KMP String Matching Algorithm",
        "difficulty": "medium",
        "tags": ["String", "String Matching"],
        "companies": ["Amazon", "Microsoft", "Google"],
        "description": "Given a `text` string and a `pattern` string, find all starting 0-based indices where `pattern` occurs in `text` using the Knuth-Morris-Pratt (KMP) algorithm with a precomputed Longest Prefix Suffix (LPS) array.\n\nReturn the matching indices in strictly ascending order.\n\n### Constraints\n- `1 <= text.length <= 10^5`\n- `1 <= pattern.length <= text.length`",
        "function_name": "kmpSearch",
        "params": [{"name": "text", "type": "string"}, {"name": "pattern", "type": "string"}],
        "return_type": "integer[]",
        "comparison_mode": "exact",
        "constraints": ["1 <= text.length <= 10^5", "1 <= pattern.length <= text.length"],
        "hints": [
            "Compute the LPS (Longest Proper Prefix which is also Suffix) table for the pattern in O(m) time.",
            "Scan the text with two pointers, utilizing the LPS table to avoid backtracking in the text."
        ],
        "acceptance_rate": 61.80,
        "total_submissions": 92300,
        "display_order": 2046,
        "test_cases": p41_cases
    })

    # 42. Rabin-Karp String Matching
    def solve_rabin_karp(text, pattern):
        n, m = len(text), len(pattern)
        if m > n or m == 0:
            return []
        P = 31
        MOD = 10**9 + 7
        res = []

        pat_hash = 0
        curr_hash = 0
        p_pow = 1
        for i in range(m):
            pat_hash = (pat_hash * P + ord(pattern[i])) % MOD
            curr_hash = (curr_hash * P + ord(text[i])) % MOD
            if i > 0:
                p_pow = (p_pow * P) % MOD

        for i in range(n - m + 1):
            if curr_hash == pat_hash:
                if text[i:i + m] == pattern:
                    res.append(i)
            if i < n - m:
                curr_hash = (curr_hash - ord(text[i]) * p_pow) % MOD
                curr_hash = (curr_hash * P + ord(text[i + m])) % MOD
                curr_hash = (curr_hash + MOD) % MOD
        return res

    p42_cases = [
        {"inputs": {"text": "GEEKS FOR GEEKS", "pattern": "GEEK"}, "is_sample": True, "explanation": "Pattern 'GEEK' occurs at index 0 and index 10."},
        {"inputs": {"text": "ABABDABACDABABCABAB", "pattern": "ABABCABAB"}, "is_sample": True, "explanation": "Occurs at index 10."},
        {"inputs": {"text": "AAAA", "pattern": "AA"}, "is_sample": False, "explanation": None},
        {"inputs": {"text": "XYZ", "pattern": "ABC"}, "is_sample": False, "explanation": None},
    ]
    for c in p42_cases:
        c["expected_output"] = solve_rabin_karp(c["inputs"]["text"], c["inputs"]["pattern"])

    problems.append({
        "slug": "rabin-karp-search",
        "title": "Rabin-Karp String Matching",
        "difficulty": "medium",
        "tags": ["String", "Hash Function"],
        "companies": ["Microsoft", "Oracle", "Goldman Sachs"],
        "description": "Given a `text` string and a `pattern` string, find all starting 0-based indices of occurrences of `pattern` in `text` using the Rabin-Karp rolling hash algorithm.\n\nReturn the indices in strictly increasing order.\n\n### Constraints\n- `1 <= text.length <= 10^5`\n- `1 <= pattern.length <= text.length`",
        "function_name": "rabinKarp",
        "params": [{"name": "text", "type": "string"}, {"name": "pattern", "type": "string"}],
        "return_type": "integer[]",
        "comparison_mode": "exact",
        "constraints": ["1 <= text.length <= 10^5", "1 <= pattern.length <= text.length"],
        "hints": [
            "Compute the polynomial rolling hash of the pattern and the first window of the text.",
            "Slide the window by removing the leading character's hash contribution and appending the new character."
        ],
        "acceptance_rate": 55.40,
        "total_submissions": 64800,
        "display_order": 2047,
        "test_cases": p42_cases
    })

    # 43. Manacher's Algorithm for Longest Palindromic Substring
    def solve_manacher(s):
        if not s:
            return ""
        T = "^#" + "#".join(s) + "#$"
        n = len(T)
        P = [0] * n
        C = R = 0

        for i in range(1, n - 1):
            i_mirror = 2 * C - i
            if R > i:
                P[i] = min(R - i, P[i_mirror])
            else:
                P[i] = 0

            while T[i + 1 + P[i]] == T[i - 1 - P[i]]:
                P[i] += 1

            if i + P[i] > R:
                C = i
                R = i + P[i]

        max_len = 0
        center_idx = 0
        for i in range(1, n - 1):
            if P[i] > max_len:
                max_len = P[i]
                center_idx = i

        start = (center_idx - 1 - max_len) // 2
        return s[start:start + max_len]

    p43_cases = [
        {"inputs": {"s": "babad"}, "is_sample": True, "explanation": "'bab' is a valid longest palindrome (or 'aba')."},
        {"inputs": {"s": "cbbd"}, "is_sample": True, "explanation": "'bb' is the longest palindrome."},
        {"inputs": {"s": "a"}, "is_sample": False, "explanation": None},
        {"inputs": {"s": "racecar"}, "is_sample": False, "explanation": None},
        {"inputs": {"s": "abacdfgdcaba"}, "is_sample": False, "explanation": None},
        {"inputs": {"s": "forgeeksskeegfor"}, "is_sample": False, "explanation": None},
    ]
    for c in p43_cases:
        c["expected_output"] = solve_manacher(c["inputs"]["s"])

    problems.append({
        "slug": "manachers-algorithm",
        "title": "Manacher's Algorithm for Longest Palindromic Substring",
        "difficulty": "hard",
        "tags": ["String", "Manacher's Algorithm"],
        "companies": ["Google", "Amazon", "Microsoft"],
        "description": "Given a string `s`, find the longest palindromic substring in `s` in optimal $O(n)$ time using Manacher's algorithm.\n\nIf there are multiple palindromic substrings of the same maximum length, return the one that appears first in `s`.\n\n### Constraints\n- `1 <= s.length <= 10^5`\n- `s` consists of English letters and digits",
        "function_name": "longestPalindromeManacher",
        "params": [{"name": "s", "type": "string"}],
        "return_type": "string",
        "comparison_mode": "exact",
        "constraints": ["1 <= s.length <= 10^5"],
        "hints": [
            "Transform the string by inserting sentinel characters like '#' between every character to handle both odd and even length palindromes identically.",
            "Use previously computed palindrome radiuses to skip redundant character comparisons."
        ],
        "acceptance_rate": 35.60,
        "total_submissions": 89200,
        "display_order": 2048,
        "test_cases": p43_cases
    })

    # 44. Z-Algorithm for Pattern Matching
    def solve_z_algorithm(text, pattern):
        s = pattern + "$" + text
        n = len(s)
        Z = [0] * n
        l = r = 0
        for i in range(1, n):
            if i <= r:
                Z[i] = min(r - i + 1, Z[i - l])
            while i + Z[i] < n and s[Z[i]] == s[i + Z[i]]:
                Z[i] += 1
            if i + Z[i] - 1 > r:
                l = i
                r = i + Z[i] - 1

        m = len(pattern)
        res = []
        for i in range(m + 1, n):
            if Z[i] == m:
                res.append(i - (m + 1))
        return res

    p44_cases = [
        {"inputs": {"text": "baabaa", "pattern": "aab"}, "is_sample": True, "explanation": "Pattern 'aab' starts at index 1."},
        {"inputs": {"text": "aaaaa", "pattern": "aa"}, "is_sample": True, "explanation": "Starts at indices [0, 1, 2, 3]."},
        {"inputs": {"text": "abcdef", "pattern": "gh"}, "is_sample": False, "explanation": None},
        {"inputs": {"text": "abracadabra", "pattern": "abra"}, "is_sample": False, "explanation": None},
    ]
    for c in p44_cases:
        c["expected_output"] = solve_z_algorithm(c["inputs"]["text"], c["inputs"]["pattern"])

    problems.append({
        "slug": "z-algorithm",
        "title": "Z-Algorithm for Pattern Matching",
        "difficulty": "medium",
        "tags": ["String", "Z-Algorithm"],
        "companies": ["Google", "Bloomberg", "Salesforce"],
        "description": "Implement pattern matching using the linear-time Z-algorithm.\n\nGiven `text` and `pattern`, concatenate them as `pattern + '$' + text`, compute the Z-array (where `Z[i]` is the length of the longest substring starting at `i` that matches a prefix of the string), and return all 0-based starting indices of `pattern` in `text` in ascending order.\n\n### Constraints\n- `1 <= text.length <= 10^5`\n- `1 <= pattern.length <= text.length`",
        "function_name": "zAlgorithmSearch",
        "params": [{"name": "text", "type": "string"}, {"name": "pattern", "type": "string"}],
        "return_type": "integer[]",
        "comparison_mode": "exact",
        "constraints": ["1 <= text.length <= 10^5", "1 <= pattern.length <= text.length"],
        "hints": [
            "Maintain an active interval [l, r] that represents the rightmost matching prefix segment.",
            "Whenever Z[i] reaches pattern.length, record the text index i - (pattern.length + 1)."
        ],
        "acceptance_rate": 54.80,
        "total_submissions": 51200,
        "display_order": 2049,
        "test_cases": p44_cases
    })

    # 45. String Matching Occurrence Count
    def solve_count_pattern_occ(text, pattern):
        return len(solve_kmp(text, pattern))

    p45_cases = [
        {"inputs": {"text": "saippuakauppias", "pattern": "pp"}, "is_sample": True, "explanation": "Appears twice ('pp' in saippua and kauppias)."},
        {"inputs": {"text": "aaaaa", "pattern": "aa"}, "is_sample": True, "explanation": "Appears 4 times (overlapping)."},
        {"inputs": {"text": "abcdef", "pattern": "z"}, "is_sample": False, "explanation": None},
        {"inputs": {"text": "hello", "pattern": "hello"}, "is_sample": False, "explanation": None},
    ]
    for c in p45_cases:
        c["expected_output"] = solve_count_pattern_occ(c["inputs"]["text"], c["inputs"]["pattern"])

    problems.append({
        "slug": "string-matching-kmp",
        "title": "String Matching Occurrence Count",
        "difficulty": "easy",
        "tags": ["String", "String Matching"],
        "companies": ["Amazon", "Cisco", "Adobe"],
        "description": "Given a string `text` and a string `pattern`, count the total number of times `pattern` appears as a contiguous substring in `text` (overlapping occurrences are counted).\n\n### Constraints\n- `1 <= text.length <= 10^5`\n- `1 <= pattern.length <= text.length`",
        "function_name": "countPatternOccurrences",
        "params": [{"name": "text", "type": "string"}, {"name": "pattern", "type": "string"}],
        "return_type": "integer",
        "comparison_mode": "exact",
        "constraints": ["1 <= text.length <= 10^5", "1 <= pattern.length <= text.length"],
        "hints": [
            "Use the KMP algorithm to find all occurrences in O(n + m) time."
        ],
        "acceptance_rate": 74.20,
        "total_submissions": 81000,
        "display_order": 2050,
        "test_cases": p45_cases
    })

    # 46. Finding Borders
    def solve_finding_borders(s):
        n = len(s)
        pi = [0] * n
        for i in range(1, n):
            j = pi[i - 1]
            while j > 0 and s[i] != s[j]:
                j = pi[j - 1]
            if s[i] == s[j]:
                j += 1
            pi[i] = j

        borders = []
        k = pi[n - 1]
        while k > 0:
            borders.append(k)
            k = pi[k - 1]
        return borders[::-1]

    p46_cases = [
        {"inputs": {"s": "abacaba"}, "is_sample": True, "explanation": "Borders of 'abacaba' are 'a' (length 1), 'aba' (length 3)."},
        {"inputs": {"s": "aaaa"}, "is_sample": True, "explanation": "Borders are lengths 1, 2, 3 ('a', 'aa', 'aaa')."},
        {"inputs": {"s": "abc"}, "is_sample": False, "explanation": None},
        {"inputs": {"s": "aabaa"}, "is_sample": False, "explanation": None},
        {"inputs": {"s": "ababab"}, "is_sample": False, "explanation": None},
    ]
    for c in p46_cases:
        c["expected_output"] = solve_finding_borders(c["inputs"]["s"])

    problems.append({
        "slug": "finding-borders",
        "title": "Finding Borders",
        "difficulty": "medium",
        "tags": ["String", "Prefix Function"],
        "companies": ["Google", "Bloomberg", "Facebook"],
        "description": "A border of a string is a substring that is both a proper prefix and a proper suffix of the string (shorter than the string itself).\n\nYour task is to find all lengths of borders of string `s` in strictly increasing order.\n\n### Constraints\n- `1 <= s.length <= 10^5`\n- `s` consists of lowercase English letters",
        "function_name": "findStringBorders",
        "params": [{"name": "s", "type": "string"}],
        "return_type": "integer[]",
        "comparison_mode": "exact",
        "constraints": ["1 <= s.length <= 10^5"],
        "hints": [
            "Compute KMP's prefix function pi for string s.",
            "The longest border has length pi[n - 1]. Traverse backwards pi[pi[n-1]-1] to retrieve all border lengths."
        ],
        "acceptance_rate": 61.50,
        "total_submissions": 45300,
        "display_order": 2051,
        "test_cases": p46_cases
    })

    # 47. Minimal String Rotation
    def solve_minimal_rotation(s):
        n = len(s)
        s2 = s + s
        f = [-1] * (2 * n)
        k = 0
        for j in range(1, 2 * n):
            i = f[j - k - 1]
            while i != -1 and s2[j] != s2[k + i + 1]:
                if s2[j] < s2[k + i + 1]:
                    k = j - i - 1
                i = f[i]
            if i == -1 and s2[j] != s2[k + i + 1]:
                if s2[j] < s2[k + i + 1]:
                    k = j
                f[j - k] = -1
            else:
                f[j - k] = i + 1
        return s2[k:k + n]

    p47_cases = [
        {"inputs": {"s": "acab"}, "is_sample": True, "explanation": "Rotations: 'acab', 'caba', 'abac', 'baca'. Smallest is 'abac'."},
        {"inputs": {"s": "baabaa"}, "is_sample": True, "explanation": "Minimal rotation is 'aabaab'."},
        {"inputs": {"s": "a"}, "is_sample": False, "explanation": None},
        {"inputs": {"s": "cba"}, "is_sample": False, "explanation": None},
        {"inputs": {"s": "dbca"}, "is_sample": False, "explanation": None},
    ]
    for c in p47_cases:
        c["expected_output"] = solve_minimal_rotation(c["inputs"]["s"])

    problems.append({
        "slug": "minimal-rotation",
        "title": "Minimal String Rotation",
        "difficulty": "medium",
        "tags": ["String", "Booth's Algorithm"],
        "companies": ["Amazon", "Uber", "Citadel"],
        "description": "A rotation of a string is obtained by moving characters one by one from the beginning to the end.\n\nGiven a string `s`, find the lexicographically smallest rotation of `s` using Booth's linear-time algorithm.\n\n### Constraints\n- `1 <= s.length <= 10^5`\n- `s` consists of lowercase English letters",
        "function_name": "minimalCyclicShift",
        "params": [{"name": "s", "type": "string"}],
        "return_type": "string",
        "comparison_mode": "exact",
        "constraints": ["1 <= s.length <= 10^5"],
        "hints": [
            "Concatenate s with itself: s + s.",
            "Use Booth's algorithm which extends KMP's failure function to find the minimal cyclic shift in O(n) time."
        ],
        "acceptance_rate": 57.80,
        "total_submissions": 39100,
        "display_order": 2052,
        "test_cases": p47_cases
    })

    # 48. Longest Repeating Subsequence
    def solve_lrs(s):
        n = len(s)
        dp = [[0] * (n + 1) for _ in range(n + 1)]
        for i in range(1, n + 1):
            for j in range(1, n + 1):
                if s[i - 1] == s[j - 1] and i != j:
                    dp[i][j] = 1 + dp[i - 1][j - 1]
                else:
                    dp[i][j] = max(dp[i - 1][j], dp[i][j - 1])
        return dp[n][n]

    p48_cases = [
        {"inputs": {"s": "AABEBCDD"}, "is_sample": True, "explanation": "LRS is 'ABD' of length 3."},
        {"inputs": {"s": "abc"}, "is_sample": True, "explanation": "All characters are distinct, length is 0."},
        {"inputs": {"s": "axxzxy"}, "is_sample": False, "explanation": None},
        {"inputs": {"s": "banana"}, "is_sample": False, "explanation": None},
        {"inputs": {"s": "aab"}, "is_sample": False, "explanation": None},
    ]
    for c in p48_cases:
        c["expected_output"] = solve_lrs(c["inputs"]["s"])

    problems.append({
        "slug": "longest-repeating-subsequence",
        "title": "Longest Repeating Subsequence",
        "difficulty": "medium",
        "tags": ["Dynamic Programming", "String"],
        "companies": ["Amazon", "Microsoft", "Goldman Sachs"],
        "description": "Given a string `s`, find the length of the longest repeating subsequence such that two subsequences don't have the same string character at the same index.\n\n### Constraints\n- `1 <= s.length <= 1000`",
        "function_name": "longestRepeatingSubsequence",
        "params": [{"name": "s", "type": "string"}],
        "return_type": "integer",
        "comparison_mode": "exact",
        "constraints": ["1 <= s.length <= 1000"],
        "hints": [
            "This is equivalent to finding the Longest Common Subsequence of s with itself.",
            "Add the condition that matching characters must have different indices (i != j)."
        ],
        "acceptance_rate": 50.10,
        "total_submissions": 62400,
        "display_order": 2053,
        "test_cases": p48_cases
    })

    # 49. Longest Repeating Substring Length
    def solve_repeating_substring_len(s):
        n = len(s)
        low, high = 1, n - 1
        res = 0

        def search(L):
            seen = set()
            for i in range(n - L + 1):
                sub = s[i:i + L]
                if sub in seen:
                    return True
                seen.add(sub)
            return False

        while low <= high:
            mid = (low + high) // 2
            if search(mid):
                res = mid
                low = mid + 1
            else:
                high = mid - 1
        return res

    p49_cases = [
        {"inputs": {"s": "abcd"}, "is_sample": True, "explanation": "No substring appears more than once, returns 0."},
        {"inputs": {"s": "abbaba"}, "is_sample": True, "explanation": "'ab' and 'ba' occur twice, length is 2."},
        {"inputs": {"s": "aabcaabdaab"}, "is_sample": True, "explanation": "'aab' occurs three times, max length 3."},
        {"inputs": {"s": "banana"}, "is_sample": False, "explanation": None},
        {"inputs": {"s": "aaaaa"}, "is_sample": False, "explanation": None},
    ]
    for c in p49_cases:
        c["expected_output"] = solve_repeating_substring_len(c["inputs"]["s"])

    problems.append({
        "slug": "repeating-substring-length",
        "title": "Longest Repeating Substring Length",
        "difficulty": "hard",
        "tags": ["String", "Binary Search", "Rolling Hash"],
        "companies": ["Google", "Amazon", "Facebook"],
        "description": "Given a string `s`, find the maximum length of a substring that occurs at least twice in `s`. The occurrences can overlap.\n\nIf no substring occurs at least twice, return `0`.\n\n### Constraints\n- `1 <= s.length <= 1500`\n- `s` consists of lowercase English letters",
        "function_name": "longestRepeatingSubstring",
        "params": [{"name": "s", "type": "string"}],
        "return_type": "integer",
        "comparison_mode": "exact",
        "constraints": ["1 <= s.length <= 1500"],
        "hints": [
            "Binary search on the length L of the repeating substring.",
            "For a fixed L, check if any duplicate length-L substring exists using rolling hash (Rabin-Karp) in O(n) time."
        ],
        "acceptance_rate": 47.90,
        "total_submissions": 43100,
        "display_order": 2054,
        "test_cases": p49_cases
    })

    # 50. De Bruijn Sequence Generation
    def solve_de_bruijn(k, n):
        if n == 1:
            return "".join(str(i) for i in range(k))
        seen = set()
        edges = []

        def dfs(node):
            for x in range(k):
                nxt = node + str(x)
                if nxt not in seen:
                    seen.add(nxt)
                    dfs(nxt[1:])
                    edges.append(x)

        start_node = "0" * (n - 1)
        dfs(start_node)
        seq = "".join(str(x) for x in edges[::-1])
        return seq + start_node

    p50_cases = [
        {"inputs": {"k": 2, "n": 2}, "is_sample": True, "explanation": "A valid de Bruijn sequence of length 4 for k=2, n=2."},
        {"inputs": {"k": 2, "n": 3}, "is_sample": True, "explanation": "Valid de Bruijn sequence of length 8."},
        {"inputs": {"k": 3, "n": 2}, "is_sample": False, "explanation": None},
        {"inputs": {"k": 2, "n": 1}, "is_sample": False, "explanation": None},
    ]
    for c in p50_cases:
        c["expected_output"] = solve_de_bruijn(c["inputs"]["k"], c["inputs"]["n"])

    problems.append({
        "slug": "de-bruijn-sequence",
        "title": "De Bruijn Sequence Generation",
        "difficulty": "hard",
        "tags": ["Graph", "Eulerian Circuit", "String"],
        "companies": ["Google", "Bloomberg", "Two Sigma"],
        "description": "Given an alphabet of size `k` (using digits from `0` to `k - 1`) and word length `n`, generate a cyclic De Bruijn sequence of length $k^n$ that contains every sequence of length `n` over the alphabet as a substring (including cyclic wrap-around).\n\nReturn the sequence string.\n\n### Constraints\n- `1 <= k <= 4`\n- `1 <= n <= 4`",
        "function_name": "deBruijnSequence",
        "params": [{"name": "k", "type": "integer"}, {"name": "n", "type": "integer"}],
        "return_type": "string",
        "comparison_mode": "exact",
        "constraints": ["1 <= k <= 4", "1 <= n <= 4"],
        "hints": [
            "Construct a de Bruijn graph where vertices are strings of length n - 1.",
            "An Eulerian circuit in this graph corresponds directly to a de Bruijn sequence."
        ],
        "acceptance_rate": 42.10,
        "total_submissions": 29800,
        "display_order": 2055,
        "test_cases": p50_cases
    })

    return problems

