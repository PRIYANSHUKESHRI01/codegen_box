<?php

namespace Database\Seeders;

use App\Models\Problem;
use Illuminate\Database\Seeder;
use RuntimeException;

/**
 * Seeds a tenth batch of 100 DSA interview problems, on top of the 905
 * already seeded by ProblemSeeder + DsaHundredProblemSeeder (V1-V9) — same
 * structured function-signature + test-case format, same
 * generate-then-execute-a-reference-solution approach to produce
 * expected_output (see DsaHundredProblemSeeder's docblock for the full
 * rationale). Every slug and normalized title here was cross-checked against
 * all 905 pre-existing problems before generation to guarantee no duplicates.
 * Coverage: greedy/binary-search-on-the-answer, BFS/graph shortest-path
 * variants, bitwise tricks, and a deliberately hard-heavy final third
 * (quadruplet counting, widest-path safeness, meeting-room simulation,
 * Floyd-Warshall string conversion, game-theory parity).
 */
class DsaHundredProblemSeederV10 extends Seeder
{
    public function run(): void
    {
        $path = __DIR__.'/data/dsa_100_problems_batch10.json';

        if (! file_exists($path)) {
            throw new RuntimeException("DsaHundredProblemSeederV10: missing data file at {$path}");
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
