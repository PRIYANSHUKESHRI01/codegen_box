<?php

namespace Tests\Feature;

use App\Models\CompanyRecommendedProblem;
use App\Models\Problem;
use Database\Seeders\AccenturePlacementSeeder;
use Database\Seeders\CapgeminiPlacementSeeder;
use Database\Seeders\CognizantPlacementSeeder;
use Database\Seeders\DsaHundredProblemSeeder;
use Database\Seeders\HclTechPlacementSeeder;
use Database\Seeders\InfosysPlacementSeeder;
use Database\Seeders\LtiMindtreePlacementSeeder;
use Database\Seeders\PlacementSeeder;
use Database\Seeders\ProblemSeeder;
use Database\Seeders\TcsPlacementSeeder;
use Database\Seeders\TechMahindraPlacementSeeder;
use Database\Seeders\WiproPlacementSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * "Solve" on a company's Frequently Tested Coding Problems opens the code editor for that slug. If a recommended slug
 * does not match a row in the problem catalogue, the card has nowhere to go — so every pack the platform ships must
 * name problems that exist. Seeds the real catalogue (ProblemSeeder + the DSA-hundred batches) and every company pack.
 */
class CompanyRecommendedProblemsResolveTest extends TestCase
{
    use RefreshDatabase;

    public function test_every_shipped_company_pack_only_recommends_problems_that_exist(): void
    {
        $this->seed(ProblemSeeder::class);
        $this->seed(DsaHundredProblemSeeder::class);
        foreach (range(2, 20) as $n) {
            $this->seed("Database\Seeders\DsaHundredProblemSeederV{$n}");
        }

        foreach ([
            PlacementSeeder::class, AccenturePlacementSeeder::class, CapgeminiPlacementSeeder::class, CognizantPlacementSeeder::class,
            WiproPlacementSeeder::class, TcsPlacementSeeder::class, InfosysPlacementSeeder::class, HclTechPlacementSeeder::class,
            TechMahindraPlacementSeeder::class, LtiMindtreePlacementSeeder::class,
        ] as $seeder) {
            $this->seed($seeder);
        }

        $recommended = CompanyRecommendedProblem::with('company:id,slug')->get();
        $this->assertGreaterThan(60, $recommended->count(), 'the company packs seeded no recommended problems — the seeders did not run');

        $catalogue = Problem::pluck('slug')->flip();
        $missing = $recommended->reject(fn ($r) => $catalogue->has($r->problem_slug))->map(fn ($r) => "{$r->company->slug}: {$r->problem_slug}")->values()->all();

        $this->assertSame([], $missing, 'recommended problems with no matching problem in the catalogue');
    }
}
