<?php

namespace Database\Seeders;

use App\Models\Problem;
use Illuminate\Database\Seeder;
use RuntimeException;

/**
 * Seeds a fifth batch of 100 well-known DSA interview problems, on top of
 * the 405 already seeded by ProblemSeeder + DsaHundredProblemSeeder
 * (V1-V4) — same curation sources, same structured function-signature +
 * test-case format, same generate-then-execute-a-reference-solution
 * approach to produce expected_output (see DsaHundredProblemSeeder's
 * docblock for the full rationale). Every slug/title here was
 * cross-checked against all 405 pre-existing problems before generation
 * to guarantee no duplicates. This batch skews into harder, less
 * universally-iconic territory (several classic hard DP/graph problems)
 * since the first four batches already covered the most famous tier.
 */
class DsaHundredProblemSeederV5 extends Seeder
{
    public function run(): void
    {
        $path = __DIR__.'/data/dsa_100_problems_batch5.json';

        if (! file_exists($path)) {
            throw new RuntimeException("DsaHundredProblemSeederV5: missing data file at {$path}");
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
