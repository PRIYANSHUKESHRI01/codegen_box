<?php

namespace Database\Seeders;

use App\Models\Problem;
use Illuminate\Database\Seeder;
use RuntimeException;

/**
 * Seeds a ninth batch of 100 DSA interview problems, on top of the 805
 * already seeded by ProblemSeeder + DsaHundredProblemSeeder (V1-V8) — same
 * structured function-signature + test-case format, same
 * generate-then-execute-a-reference-solution approach to produce
 * expected_output (see DsaHundredProblemSeeder's docblock for the full
 * rationale). Every slug and normalized title here was cross-checked against
 * all 805 pre-existing problems before generation to guarantee no duplicates.
 * Coverage: arrays and prefix sums, binary search on the answer, greedy,
 * string manipulation, graph/tree traversal and functional-graph cycles.
 */
class DsaHundredProblemSeederV9 extends Seeder
{
    public function run(): void
    {
        $path = __DIR__.'/data/dsa_100_problems_batch9.json';

        if (! file_exists($path)) {
            throw new RuntimeException("DsaHundredProblemSeederV9: missing data file at {$path}");
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
