<?php

namespace Tests\Feature;

use App\Models\College;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * The superadmin Students tab: how fast the list comes back, and that every number on its filter bar is exactly what
 * picking that filter then shows.
 */
class SuperadminStudentDirectoryTest extends TestCase
{
    use RefreshDatabase;

    private function superadmin(): User
    {
        return User::factory()->create(['role' => User::ROLE_SUPERADMIN]);
    }

    private function student(College $college, ?string $department, array $over = []): User
    {
        return User::factory()->create(array_merge([
            'role' => User::ROLE_USER,
            'college_id' => $college->id,
            'department' => $department,
        ], $over));
    }

    /** @return array{a: College, b: College} */
    private function fixture(): array
    {
        $a = College::create(['name' => 'Alpha University', 'short_code' => 'ALP', 'tier' => 'Standard']);
        $b = College::create(['name' => 'Beta Institute', 'short_code' => 'BET', 'tier' => 'Standard']);

        // Alpha: 3 engineering (one never classified), 2 management. Beta: 1 engineering, 1 commerce.
        $this->student($a, 'engineering', ['name' => 'Asha Engineer']);
        $this->student($a, 'engineering', ['name' => 'Anil Engineer']);
        $this->student($a, null, ['name' => 'Unclassified Student']);
        $this->student($a, 'management', ['name' => 'Meera Manager']);
        $this->student($a, 'management', ['name' => 'Manoj Manager']);
        $this->student($b, 'engineering', ['name' => 'Bala Engineer']);
        $this->student($b, 'commerce', ['name' => 'Chitra Commerce']);

        return ['a' => $a, 'b' => $b];
    }

    private function list(array $query = []): \Illuminate\Testing\TestResponse
    {
        return $this->getJson('/api/superadmin/users?'.http_build_query($query + ['role' => 'user', 'has_college' => 1]))->assertOk();
    }

    private function facets(array $query = []): \Illuminate\Testing\TestResponse
    {
        return $this->getJson('/api/superadmin/users/facets?'.http_build_query($query + ['role' => 'user', 'has_college' => 1]))->assertOk();
    }

    public function test_the_list_scores_the_whole_page_at_once_instead_of_one_student_at_a_time(): void
    {
        $f = $this->fixture();
        for ($i = 0; $i < 20; $i++) {
            $this->student($f['a'], 'engineering');
        }
        Sanctum::actingAs($this->superadmin());

        DB::enableQueryLog();
        $response = $this->list();
        $queries = count(DB::getQueryLog());

        $this->assertCount(27, $response->json('data'));
        // Scored per student this page was well over 20 queries a row (several hundred in all); scored for the page at once
        // the readiness work is a fixed handful, so the whole request stays near the per-row subscription lookups.
        $this->assertLessThan(27 * 6, $queries, "the Students list ran {$queries} queries — readiness is being scored per row again");
        $this->assertContains($response->json('data.0.readiness_tier'), ['Placement Ready', 'In Progress', 'Needs Training']);
    }

    public function test_every_student_row_carries_a_readiness_tier_and_non_students_do_not(): void
    {
        $this->fixture();
        $staff = User::factory()->create(['role' => User::ROLE_ADMIN_INTERNAL]);
        Sanctum::actingAs($this->superadmin());

        foreach ($this->list()->json('data') as $row) {
            $this->assertNotNull($row['readiness_tier']);
        }

        $all = collect($this->getJson('/api/superadmin/users?roles=admin_internal')->assertOk()->json('data'));
        $this->assertNull($all->firstWhere('id', $staff->id)['readiness_tier'] ?? null);
    }

    public function test_the_department_filter_returns_that_departments_students_and_counts_the_unclassified_as_engineering(): void
    {
        $this->fixture();
        Sanctum::actingAs($this->superadmin());

        $engineering = $this->list(['department' => 'engineering']);
        $this->assertSame(4, $engineering->json('total'), 'three classified + the one never classified');
        $this->assertContains('Unclassified Student', collect($engineering->json('data'))->pluck('name')->all());

        $this->assertSame(2, $this->list(['department' => 'management'])->json('total'));
        $this->assertSame(1, $this->list(['department' => 'commerce'])->json('total'));
        $this->assertSame(0, $this->list(['department' => 'arts'])->json('total'));
    }

    public function test_department_counts_add_up_to_the_students_and_follow_the_chosen_university(): void
    {
        $f = $this->fixture();
        Sanctum::actingAs($this->superadmin());

        $everywhere = $this->facets()->json('departments');
        $this->assertSame(['commerce' => 1, 'engineering' => 4, 'management' => 2], $this->sorted($everywhere));
        $this->assertSame($this->list()->json('total'), array_sum($everywhere));

        $inBeta = $this->facets(['college_id' => $f['b']->id])->json('departments');
        $this->assertSame(['commerce' => 1, 'engineering' => 1], $this->sorted($inBeta));
    }

    public function test_university_counts_follow_the_chosen_department(): void
    {
        $f = $this->fixture();
        Sanctum::actingAs($this->superadmin());

        $colleges = fn ($response) => collect($response->json('colleges'))->pluck('accounts', 'id')->all();

        $any = $colleges($this->facets());
        $this->assertSame(5, $any[$f['a']->id]);
        $this->assertSame(2, $any[$f['b']->id]);

        $management = $colleges($this->facets(['department' => 'management']));
        $this->assertSame(2, $management[$f['a']->id]);
        $this->assertSame(0, $management[$f['b']->id], 'Beta has no management students, and says so before it is clicked');

        $commerce = $colleges($this->facets(['department' => 'commerce']));
        $this->assertSame(0, $commerce[$f['a']->id]);
        $this->assertSame(1, $commerce[$f['b']->id]);
    }

    public function test_every_count_on_the_filter_bar_equals_what_choosing_it_then_lists(): void
    {
        $f = $this->fixture();
        Sanctum::actingAs($this->superadmin());

        foreach (['', 'engineer', 'Manager', 'nobody-by-this-name'] as $search) {
            $q = $search === '' ? [] : ['search' => $search];

            foreach ([null, 'engineering', 'management', 'commerce', 'arts'] as $department) {
                $d = $department ? ['department' => $department] : [];

                foreach ($this->facets($q + $d)->json('colleges') as $college) {
                    $this->assertSame(
                        $college['accounts'],
                        $this->list($q + $d + ['college_id' => $college['id']])->json('total'),
                        "university {$college['name']} / department ".($department ?? 'any')." / search '{$search}'"
                    );
                }
            }

            foreach ([$f['a'], $f['b']] as $college) {
                $perDepartment = $this->facets($q + ['college_id' => $college->id])->json('departments');
                foreach (['engineering', 'management', 'commerce', 'arts'] as $department) {
                    $this->assertSame(
                        $perDepartment[$department] ?? 0,
                        $this->list($q + ['college_id' => $college->id, 'department' => $department])->json('total'),
                        "{$college->name} / {$department} / search '{$search}'"
                    );
                }
            }
        }
    }

    /** @param array<string, int> $counts */
    private function sorted(array $counts): array
    {
        ksort($counts);

        return $counts;
    }
}
