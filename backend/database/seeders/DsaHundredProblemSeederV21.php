<?php

namespace Database\Seeders;

use App\Models\Problem;
use Illuminate\Database\Seeder;
use RuntimeException;

/**
 * Seeds a twenty-first batch of 100 authentic DSA and competitive programming problems,
 * on top of the 2005 already seeded by ProblemSeeder + DsaHundredProblemSeeder (V1-V20)
 * — scaling the catalog to 2105 problems.
 * Includes classic algorithms: Tower of Hanoi, Josephus Problem, Rat in a Maze,
 * Knight's Tour, Dijkstra, Bellman-Ford, Floyd-Warshall, Kruskal, Prim, Tarjan,
 * Kosaraju, Kahn's Topological Sort, KMP, Rabin-Karp, Manacher, Z-Algorithm,
 * Segment Trees, Fenwick Trees, DSU, CSES classics, and Game Theory.
 * Structured function-signature + test-case format conforming strictly to ProblemType::ALL.
 */
class DsaHundredProblemSeederV21 extends Seeder
{
    public function run(): void
    {
        $path = __DIR__.'/data/dsa_100_problems_batch21.json';

        if (! file_exists($path)) {
            throw new RuntimeException("DsaHundredProblemSeederV21: missing data file at {$path}");
        }

        $problems = json_decode(file_get_contents($path), true, flags: JSON_THROW_ON_ERROR);

        foreach ($problems as $spec) {
            $testCases = $spec['test_cases'];
            unset($spec['test_cases']);

            $problem = Problem::updateOrCreate(['slug' => $spec['slug']], $spec);

            $problem->testCases()->delete();
            foreach ($testCases as $index => $testCase) {
                $problem->testCases()->create([...$testCase, 'display_order' => $index]);
            }
        }
    }
}

