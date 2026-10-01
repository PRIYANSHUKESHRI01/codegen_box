<?php

namespace Database\Seeders;

use App\Models\Problem;
use Illuminate\Database\Seeder;
use RuntimeException;

/**
 * Seeds an eighth batch of 100 well-known DSA interview problems, on top of
 * the 705 already seeded by ProblemSeeder + DsaHundredProblemSeeder
 * (V1-V7) — same curation sources, same structured function-signature +
 * test-case format, same generate-then-execute-a-reference-solution
 * approach to produce expected_output (see DsaHundredProblemSeeder's
 * docblock for the full rationale). Every slug/title here was
 * cross-checked against all 705 pre-existing problems before generation
 * to guarantee no duplicates. This batch extends V7's binary-tree/BST
 * coverage (18 more classics) and adds graph/Union-Find, harder DP and
 * backtracking, and several offline-segment-tree-style problems (My
 * Calendar II/III, Range Sum Query - Mutable, Range Addition).
 */
class DsaHundredProblemSeederV8 extends Seeder
{
    public function run(): void
    {
        $path = __DIR__.'/data/dsa_100_problems_batch8.json';

        if (! file_exists($path)) {
            throw new RuntimeException("DsaHundredProblemSeederV8: missing data file at {$path}");
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
