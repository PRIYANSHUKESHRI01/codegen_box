<?php

namespace Database\Seeders;

use App\Models\Problem;
use Illuminate\Database\Seeder;
use RuntimeException;

/**
 * Seeds a fourteenth batch of 100 DSA interview problems, on top of the 1305
 * already seeded by ProblemSeeder + DsaHundredProblemSeeder (V1-V13) — same
 * structured function-signature + test-case format, same
 * generate-then-execute-a-reference-solution approach to produce
 * expected_output (see DsaHundredProblemSeeder's docblock for the full
 * rationale). Every slug and normalized title here was cross-checked against
 * all 1305 pre-existing problems before generation to guarantee zero duplicates.
 * Coverage: core DSA topics referenced from LeetCode including arrays, simulation,
 * string hashing, prefix sums, sliding window, two pointers, greedy, monotonic stack/queue,
 * dynamic programming, number theory, combinatorics, bitmask, trees, and graphs
 * (BFS/DFS, Dijkstra, Union-Find).
 */
class DsaHundredProblemSeederV14 extends Seeder
{
    public function run(): void
    {
        $path = __DIR__.'/data/dsa_100_problems_batch14.json';

        if (! file_exists($path)) {
            throw new RuntimeException("DsaHundredProblemSeederV14: missing data file at {$path}");
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

