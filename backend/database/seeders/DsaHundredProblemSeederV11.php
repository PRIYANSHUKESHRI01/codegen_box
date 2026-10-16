<?php

namespace Database\Seeders;

use App\Models\Problem;
use Illuminate\Database\Seeder;
use RuntimeException;

/**
 * Seeds an eleventh batch of 100 DSA interview problems, on top of the 1005
 * already seeded by ProblemSeeder + DsaHundredProblemSeeder (V1-V10) — same
 * structured function-signature + test-case format, same
 * generate-then-execute-a-reference-solution approach to produce
 * expected_output (see DsaHundredProblemSeeder's docblock for the full
 * rationale). Every slug and normalized title here was cross-checked against
 * all 1005 pre-existing problems before generation to guarantee no duplicates.
 * Coverage: two pointers, prefix sums, binary search on answers, monotonic
 * queues/stacks, bitwise tricks, grid traversal, interval scheduling, and
 * classic dynamic programming with advanced graph algorithms (Eulerian path,
 * MST criticality, bipartite graph grouping).
 */
class DsaHundredProblemSeederV11 extends Seeder
{
    public function run(): void
    {
        $path = __DIR__.'/data/dsa_100_problems_batch11.json';

        if (! file_exists($path)) {
            throw new RuntimeException("DsaHundredProblemSeederV11: missing data file at {$path}");
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

