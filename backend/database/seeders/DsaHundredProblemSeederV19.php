<?php

namespace Database\Seeders;

use App\Models\Problem;
use Illuminate\Database\Seeder;
use RuntimeException;

/**
 * Seeds a nineteenth batch of 100 authentic DSA interview problems, on top of the 1805
 * already seeded by ProblemSeeder + DsaHundredProblemSeeder (V1-V18) — scaling the catalog to 1905 problems.
 * Structured function-signature + test-case format conforming strictly to ProblemType::ALL.
 * Every slug and normalized title was cross-checked against all 1805 pre-existing problems
 * to guarantee zero duplicates.
 * Comprehensive coverage: arrays, strings, two pointers, sliding window, prefix sums,
 * monotonic stack/queue, tree DFS/BFS, graph algorithms, 1D/2D/grid/interval/bitmask DP,
 * greedy algorithms, math/number theory, and union-find.
 */
class DsaHundredProblemSeederV19 extends Seeder
{
    public function run(): void
    {
        $path = __DIR__.'/data/dsa_100_problems_batch19.json';

        if (! file_exists($path)) {
            throw new RuntimeException("DsaHundredProblemSeederV19: missing data file at {$path}");
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

