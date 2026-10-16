<?php

namespace Database\Seeders;

use App\Models\Problem;
use Illuminate\Database\Seeder;
use RuntimeException;

/**
 * Seeds a twentieth batch of 100 authentic DSA interview problems, on top of the 1905
 * already seeded by ProblemSeeder + DsaHundredProblemSeeder (V1-V19) — scaling the catalog to 2005 problems.
 * Structured function-signature + test-case format conforming strictly to ProblemType::ALL.
 * Every slug and normalized title was cross-checked against all 1905 pre-existing problems
 * to guarantee zero duplicates.
 * Comprehensive coverage: arrays, strings, two pointers, sliding window, prefix sums,
 * monotonic stack/queue, matrix, graph algorithms, 1D/2D/grid/interval/bitmask DP,
 * greedy algorithms, math/number theory, game theory, and bit manipulation.
 */
class DsaHundredProblemSeederV20 extends Seeder
{
    public function run(): void
    {
        $path = __DIR__.'/data/dsa_100_problems_batch20.json';

        if (! file_exists($path)) {
            throw new RuntimeException("DsaHundredProblemSeederV20: missing data file at {$path}");
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

