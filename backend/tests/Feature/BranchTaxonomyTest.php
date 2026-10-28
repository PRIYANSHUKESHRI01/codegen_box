<?php

namespace Tests\Feature;

use App\Models\BranchAlias;
use App\Models\College;
use App\Models\User;
use App\Services\BranchAssignmentService;
use App\Support\BranchCatalog;
use App\Support\BranchNormalizer;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class BranchTaxonomyTest extends TestCase
{
    use RefreshDatabase;

    private function student(array $attrs = []): User
    {
        return User::factory()->create(['role' => User::ROLE_USER] + $attrs);
    }

    private int $collegeSeq = 0;

    private function college(): College
    {
        $n = ++$this->collegeSeq;

        return College::create(['name' => "Branch Test College {$n}", 'short_code' => "BTC{$n}", 'tier' => 'Standard']);
    }

    private function superadmin(): User
    {
        return User::factory()->create(['role' => User::ROLE_SUPERADMIN]);
    }

    public function test_normalizer_collapses_the_ways_colleges_write_a_branch(): void
    {
        $this->assertSame('mechanical', BranchNormalizer::key('Mechanical Engineering'));
        $this->assertSame('mechanical', BranchNormalizer::key('B.Tech - MECHANICAL'));
        $this->assertSame('mechanical', BranchNormalizer::key('  mechanical engg. '));
        $this->assertSame('electrical electronics', BranchNormalizer::key('Electrical & Electronics'));
        $this->assertSame('electrical electronics', BranchNormalizer::key('Electrical and Electronics Engineering'));
        $this->assertSame('cse ai ml', BranchNormalizer::key('CSE (AI & ML)'));
        $this->assertNull(BranchNormalizer::key('   '));
        $this->assertNull(BranchNormalizer::key(null));
    }

    /**
     * The frontend ports this function (lib/branches.ts normalizeBranchKey) to show an older drive's "MECH" as the
     * Mechanical chip. These are the SAME cases pinned in frontend/src/tests/unit/branches.test.ts — change one side
     * without the other and a picker will silently disagree with the server about what a label means.
     */
    #[DataProvider('sharedKeyCases')]
    public function test_normalizer_agrees_with_the_frontend_port(string $raw, ?string $key): void
    {
        $this->assertSame($key, BranchNormalizer::key($raw));
    }

    public static function sharedKeyCases(): array
    {
        return [
            ['Mechanical Engineering', 'mechanical'],
            ['B.Tech - MECHANICAL', 'mechanical'],
            ['  mechanical engg. ', 'mechanical'],
            ['Electrical & Electronics', 'electrical electronics'],
            ['Electrical and Electronics Engineering', 'electrical electronics'],
            ['CSE (AI & ML)', 'cse ai ml'],
            ['B.E. in Civil Engineering', 'civil'],
            ['Bachelor of Technology in ECE', 'ece'],
            ['E&TC', 'e tc'],
            ['   ', null],
        ];
    }

    public function test_the_catalogue_ships_with_the_schema(): void
    {
        $catalog = app(BranchCatalog::class);

        // Engineering offers its five main families (the catch-all "other" family has no active branch, so it is not offered);
        // the other departments hold their own. Its rows are still in the catalogue for students who were already in them.
        $this->assertSame(['cse', 'ece', 'eee', 'mech', 'civil'], array_column($catalog->disciplines('engineering'), 'code'));
        $this->assertSame('other', $catalog->disciplineOf('chem'));
        $this->assertSame(['engineering', 'management', 'commerce', 'arts'], array_column($catalog->departments(), 'code'));
        $this->assertSame('ece', $catalog->disciplineOf('etc'));
        $this->assertSame('eee', $catalog->disciplineOf('ee'));
        $this->assertSame('eee', $catalog->disciplineOf('eee'));
    }

    #[DataProvider('commonLabels')]
    public function test_common_labels_resolve(string $label, string $branch, string $discipline): void
    {
        $catalog = app(BranchCatalog::class);

        $this->assertSame($branch, $catalog->resolve($label));
        $this->assertSame($discipline, $catalog->disciplineOf($branch));
    }

    public static function commonLabels(): array
    {
        return [
            'MECH (old drive picker)' => ['MECH', 'mech', 'mech'],
            'Mechanical' => ['Mechanical', 'mech', 'mech'],
            'EE (old drive picker)' => ['EE', 'ee', 'eee'],
            'EEE' => ['EEE', 'eee', 'eee'],
            'ECE long' => ['Electronics & Communication Engineering', 'ece', 'ece'],
            'ENTC' => ['E&TC', 'etc', 'ece'],
            'CSE' => ['CSE', 'cse', 'cse'],
            'AI&ML' => ['CSE (AI & ML)', 'cse_aiml', 'cse'],
            'IT' => ['IT', 'it', 'cse'],
            'Civil' => ['Civil Engineering', 'civil', 'civil'],
            'Chemical' => ['Chemical', 'chem', 'other'],
        ];
    }

    public function test_unknown_label_is_not_guessed(): void
    {
        $this->assertNull(app(BranchCatalog::class)->resolve('Quantum Basket Weaving'));
    }

    public function test_saving_a_student_resolves_their_branch(): void
    {
        $s = $this->student(['branch' => 'Mechanical Engg']);

        $this->assertSame('mech', $s->branch_code);
        $this->assertSame('mech', $s->discipline);
        $this->assertSame('college', $s->branch_source);
        $this->assertSame('mechanical', $s->branch_key);
        $this->assertSame('Mechanical Engg', $s->branch, 'the college\'s own wording is kept for display');
    }

    public function test_an_unrecognised_label_keeps_its_key_but_no_code(): void
    {
        $s = $this->student(['branch' => 'Mech-A (Day)']);

        $this->assertNull($s->branch_code);
        $this->assertNull($s->discipline);
        $this->assertSame('college', $s->branch_source);
        $this->assertNotNull($s->branch_key);
    }

    public function test_changing_or_clearing_the_label_re_resolves(): void
    {
        $s = $this->student(['branch' => 'ECE']);
        $this->assertSame('ece', $s->branch_code);

        $s->update(['branch' => 'Civil']);
        $this->assertSame('civil', $s->fresh()->branch_code);

        $s->update(['branch' => null]);
        $fresh = $s->fresh();
        $this->assertNull($fresh->branch_code);
        $this->assertNull($fresh->branch_source);
    }

    public function test_staff_users_are_never_given_a_branch(): void
    {
        $tpo = User::factory()->create(['role' => User::ROLE_ADMIN_TPO, 'branch' => 'ECE']);

        $this->assertNull($tpo->branch_code);
    }

    public function test_a_college_mapping_wins_and_never_leaks_to_another_college(): void
    {
        $a = $this->college();
        $b = $this->college();

        BranchAlias::create(['alias_key' => BranchNormalizer::key('Mech-A'), 'branch_code' => 'mech', 'college_id' => $a->id, 'label' => 'Mech-A']);
        app(BranchCatalog::class)->flush();

        $inA = $this->student(['college_id' => $a->id, 'branch' => 'Mech-A']);
        $inB = $this->student(['college_id' => $b->id, 'branch' => 'Mech-A']);

        $this->assertSame('mech', $inA->branch_code);
        $this->assertNull($inB->branch_code, "college A's mapping must not apply in college B");
    }

    public function test_bulk_reresolve_maps_a_whole_college_in_one_pass(): void
    {
        $college = $this->college();
        $other = $this->college();

        $mine = collect(range(1, 5))->map(fn () => $this->student(['college_id' => $college->id, 'branch' => 'Mech-A']));
        $theirs = $this->student(['college_id' => $other->id, 'branch' => 'Mech-A']);
        $this->assertNull($mine->first()->branch_code);

        BranchAlias::create(['alias_key' => BranchNormalizer::key('Mech-A'), 'branch_code' => 'mech', 'college_id' => $college->id]);

        $changed = app(BranchAssignmentService::class)->reresolve($college->id, BranchNormalizer::key('Mech-A'));

        $this->assertSame(5, $changed);
        $this->assertSame(['mech'], $mine->map(fn ($s) => $s->fresh()->branch_code)->unique()->values()->all());
        $this->assertNull($theirs->fresh()->branch_code);
    }

    public function test_a_self_declared_branch_survives_a_bulk_reresolve_and_a_college_import_overrides_it(): void
    {
        $s = $this->student();
        $this->assertSame('ece', app(BranchAssignmentService::class)->declareSelf($s, 'ece')->branch_code);

        $s = $s->fresh();
        $this->assertSame('self', $s->branch_source);
        $this->assertSame('Electronics & Communication Engineering', $s->branch);

        app(BranchAssignmentService::class)->reresolve();
        $this->assertSame('ece', $s->fresh()->branch_code);

        // the college later imports a different label → the college is authoritative
        $s->update(['branch' => 'Mechanical']);
        $s = $s->fresh();
        $this->assertSame('mech', $s->branch_code);
        $this->assertSame('college', $s->branch_source);
    }

    public function test_student_may_declare_only_when_the_college_has_not_told_us(): void
    {
        $svc = app(BranchAssignmentService::class);

        $this->assertTrue($svc->canDeclare($this->student()), 'no branch on file');
        $this->assertTrue($svc->canDeclare($this->student(['branch' => 'Quantum Basket Weaving'])), 'unrecognised college label');
        $this->assertFalse($svc->canDeclare($this->student(['branch' => 'ECE'])), 'recognised college label is final');
    }

    public function test_public_catalogue_endpoint(): void
    {
        $json = $this->getJson('/api/public/branches')->assertOk()->json();

        $this->assertContains('mech', array_column($json['branches'], 'code'));
        $this->assertSame(['code', 'discipline', 'name', 'short'], array_keys($json['branches'][0]));
    }

    public function test_superadmin_can_add_a_spelling_and_students_update_everywhere(): void
    {
        $a = $this->college();
        $b = $this->college();
        $s1 = $this->student(['college_id' => $a->id, 'branch' => 'Machine Design']);
        $s2 = $this->student(['college_id' => $b->id, 'branch' => 'machine design']);
        $this->assertNull($s1->branch_code);

        $this->actingAs($this->superadmin())
            ->postJson('/api/superadmin/branch-aliases', ['label' => 'Machine Design', 'branch_code' => 'mech'])
            ->assertCreated()
            ->assertJsonPath('students_updated', 2);

        $this->assertSame('mech', $s1->fresh()->branch_code);
        $this->assertSame('mech', $s2->fresh()->discipline);

        $alias = BranchAlias::where('alias_key', 'machine design')->firstOrFail();
        $this->actingAs($this->superadmin())->deleteJson("/api/superadmin/branch-aliases/{$alias->id}")->assertOk()->assertJsonPath('students_updated', 2);
        $this->assertNull($s1->fresh()->branch_code);
    }

    public function test_a_spelling_cannot_point_at_two_branches(): void
    {
        $this->actingAs($this->superadmin())
            ->postJson('/api/superadmin/branch-aliases', ['label' => 'Mechanical', 'branch_code' => 'civil'])
            ->assertStatus(422);
    }

    public function test_only_superadmin_reaches_the_taxonomy_admin(): void
    {
        $this->actingAs($this->student())->getJson('/api/superadmin/branches')->assertForbidden();
        $this->actingAs($this->superadmin())->getJson('/api/superadmin/branches')->assertOk()
            ->assertJsonStructure(['disciplines', 'branches', 'aliases', 'unrecognised', 'unresolved_students']);
    }

    public function test_superadmin_can_add_a_new_branch(): void
    {
        $this->actingAs($this->superadmin())
            ->postJson('/api/superadmin/branches', ['code' => 'ai_robotics', 'discipline_code' => 'mech', 'name' => 'Robotics & AI', 'short' => 'R&AI'])
            ->assertCreated();

        $student = $this->student(['branch' => 'Robotics & AI']);
        $this->assertSame('ai_robotics', $student->branch_code);
        $this->assertSame('mech', $student->discipline);
    }

    public function test_cohort_rows_carry_the_resolved_branch(): void
    {
        $college = $this->college();
        $s = $this->student(['college_id' => $college->id, 'branch' => 'Mechanical']);
        $row = app(\App\Services\StudentCohortService::class)->payload($s->refresh(), collect());

        $this->assertSame('mech', $row['branch_code']);
        $this->assertSame('mech', $row['discipline']);
        $this->assertSame('Mechanical', $row['branch']);
    }
}
