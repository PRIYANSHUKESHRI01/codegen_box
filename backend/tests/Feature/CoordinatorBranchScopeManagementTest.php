<?php

namespace Tests\Feature;

use App\Models\College;
use App\Models\User;
use App\Support\BranchAudience;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Giving each branch of a mixed section its own coordinator: the TPO picks the branches, no two coordinators of a
 * section may cover the same student, and the TPO is told how many students nobody covers.
 */
class CoordinatorBranchScopeManagementTest extends TestCase
{
    use RefreshDatabase;

    private College $college;

    private User $tpo;

    protected function setUp(): void
    {
        parent::setUp();

        $this->college = College::create(['name' => 'Mixed College', 'short_code' => 'MC']);
        $this->tpo = User::factory()->create(['role' => User::ROLE_ADMIN_TPO, 'college_id' => $this->college->id]);
        Sanctum::actingAs($this->tpo);
    }

    private function student(string $branch, string $section = 'A', ?College $college = null): User
    {
        return User::factory()->create(['role' => User::ROLE_USER, 'college_id' => ($college ?? $this->college)->id, 'branch' => $branch, 'section' => $section]);
    }

    private function add(string $name, ?array $scope, string $section = 'A'): \Illuminate\Testing\TestResponse
    {
        return $this->postJson('/api/tpo/coordinators', array_filter([
            'name' => $name, 'email' => strtolower(str_replace(' ', '.', $name)).'@example.com', 'section' => $section,
            'branch_scope' => $scope,
        ], fn ($v) => $v !== null));
    }

    private function sections(): array
    {
        return collect($this->getJson('/api/tpo/coordinators')->assertOk()->json('sections'))->keyBy('section')->all();
    }

    public function test_a_section_can_have_one_coordinator_per_branch(): void
    {
        $ece = $this->add('Eva ECE', ['disciplines' => ['ece'], 'branches' => []])->assertCreated();
        $cse = $this->add('Carl CSE', ['disciplines' => ['cse'], 'branches' => []])->assertCreated();

        $this->assertSame('ECE', $ece->json('coordinator.scope_label'));
        $this->assertSame(['disciplines' => ['ece'], 'branches' => []], $ece->json('coordinator.branch_scope'));
        $this->assertSame('CSE / IT', $cse->json('coordinator.scope_label'));
        $this->assertSame(['disciplines' => ['ece'], 'branches' => []], User::find($ece->json('coordinator.id'))->coordinator_scope);
    }

    public function test_two_coordinators_may_not_cover_the_same_branch_of_a_section(): void
    {
        $this->add('Eva ECE', ['disciplines' => ['ece'], 'branches' => []])->assertCreated();

        $this->add('Evan Also ECE', ['disciplines' => ['ece'], 'branches' => []])->assertStatus(422)->assertJsonValidationErrors('branch_scope');
        // a single ECE branch is inside the ECE family
        $this->add('Ed Etc', ['disciplines' => [], 'branches' => ['etc']])->assertStatus(422)->assertJsonValidationErrors('branch_scope');
        // but another family is free
        $this->add('Mia Mech', ['disciplines' => ['mech'], 'branches' => []])->assertCreated();
    }

    public function test_two_branches_of_one_family_do_not_collide(): void
    {
        $this->add('Ed Etc', ['disciplines' => [], 'branches' => ['etc']])->assertCreated();
        $this->add('Eli Ece', ['disciplines' => [], 'branches' => ['ece']])->assertCreated();
    }

    public function test_a_whole_section_coordinator_and_a_branch_coordinator_exclude_each_other(): void
    {
        $this->add('Wes Whole', null)->assertCreated();

        $this->add('Eva ECE', ['disciplines' => ['ece'], 'branches' => []])->assertStatus(422)->assertJsonValidationErrors('section');

        $this->add('Bea Section B', null, 'B')->assertCreated();
        $this->add('Bo Branch B', ['disciplines' => ['cse'], 'branches' => []], 'B')->assertStatus(422)->assertJsonValidationErrors('section');
    }

    public function test_a_whole_section_coordinator_cannot_be_added_beside_branch_coordinators(): void
    {
        $this->add('Eva ECE', ['disciplines' => ['ece'], 'branches' => []])->assertCreated();

        $this->add('Wes Whole', null)->assertStatus(422)->assertJsonValidationErrors('section');
    }

    public function test_section_names_are_compared_ignoring_case_and_spaces(): void
    {
        $this->add('Wes Whole', null)->assertCreated();

        $this->add('Wanda Whole', null, ' a ')->assertStatus(422)->assertJsonValidationErrors('section');
    }

    public function test_the_same_section_name_at_another_college_is_free(): void
    {
        $this->add('Wes Whole', null)->assertCreated();

        $other = College::create(['name' => 'Other', 'short_code' => 'OT']);
        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_ADMIN_TPO, 'college_id' => $other->id]));
        $this->add('Olga Other', null)->assertCreated();
    }

    public function test_an_unknown_branch_family_is_refused(): void
    {
        $this->add('Nope', ['disciplines' => ['astrology'], 'branches' => []])->assertStatus(422)->assertJsonValidationErrors('branch_scope.disciplines.0');
        $this->add('Nope', ['disciplines' => [], 'branches' => ['nonexistent']])->assertStatus(422);
    }

    public function test_editing_a_coordinator_can_narrow_widen_or_keep_their_scope(): void
    {
        $id = $this->add('Eva ECE', ['disciplines' => ['ece'], 'branches' => []])->json('coordinator.id');
        $this->add('Carl CSE', ['disciplines' => ['cse'], 'branches' => []])->assertCreated();

        // leaving branch_scope out keeps it
        $this->putJson("/api/tpo/coordinators/{$id}", ['section' => 'A', 'phone' => '9000000001'])->assertOk()->assertJsonPath('coordinator.scope_label', 'ECE');

        // widening into CSE collides with Carl
        $this->putJson("/api/tpo/coordinators/{$id}", ['section' => 'A', 'branch_scope' => ['disciplines' => ['ece', 'cse'], 'branches' => []]])
            ->assertStatus(422)->assertJsonValidationErrors('branch_scope');
        $this->assertSame(['disciplines' => ['ece'], 'branches' => []], User::find($id)->coordinator_scope);

        // widening into a free family is fine
        $this->putJson("/api/tpo/coordinators/{$id}", ['section' => 'A', 'branch_scope' => ['disciplines' => ['ece', 'eee'], 'branches' => []]])
            ->assertOk()->assertJsonPath('coordinator.scope_label', 'ECE, EEE');

        // explicitly null = the whole section — which Carl now stands in the way of
        $this->putJson("/api/tpo/coordinators/{$id}", ['section' => 'A', 'branch_scope' => null])->assertStatus(422);

        // moving to a section where the scope is free works
        $this->putJson("/api/tpo/coordinators/{$id}", ['section' => 'B'])->assertOk()->assertJsonPath('coordinator.section', 'B');
    }

    public function test_the_payload_counts_only_the_students_a_coordinator_covers(): void
    {
        $this->student('ECE');
        $this->student('ECE');
        $this->student('CSE');
        $this->student('ECE', 'B');
        $this->student('ECE', 'A', College::create(['name' => 'Other', 'short_code' => 'OT']));

        $response = $this->add('Eva ECE', ['disciplines' => ['ece'], 'branches' => []])->assertCreated();
        $this->assertSame(2, $response->json('coordinator.managed_student_count'));

        $whole = $this->add('Wes Whole', null, 'B')->assertCreated();
        $this->assertSame(1, $whole->json('coordinator.managed_student_count'));
    }

    public function test_the_sections_list_says_who_covers_each_section_and_how_many_students_nobody_does(): void
    {
        foreach (range(1, 3) as $i) {
            $this->student('ECE');
        }
        $this->student('CSE');
        $this->student('Mechanical');
        $this->student('Quantum Basket Weaving');   // branch not mapped
        $this->student('CSE', 'B');

        $this->add('Eva ECE', ['disciplines' => ['ece'], 'branches' => []])->assertCreated();
        $carl = $this->add('Carl CSE', ['disciplines' => ['cse'], 'branches' => []])->assertCreated();
        $this->add('Wes Whole', null, 'B')->assertCreated();

        $sections = $this->sections();

        $this->assertSame(6, $sections['A']['student_count']);
        $this->assertSame(['Carl CSE', 'Eva ECE'], collect($sections['A']['coordinators'])->pluck('name')->sort()->values()->all());
        $this->assertSame(2, $sections['A']['uncovered_count'], 'the Mechanical student and the unmapped one fall between the cracks');
        $this->assertSame('Carl CSE · Eva ECE', $sections['A']['coordinator_name']);
        $this->assertSame(0, $sections['B']['uncovered_count']);

        // A blocked coordinator covers nobody.
        $this->postJson('/api/tpo/coordinators/'.$carl->json('coordinator.id').'/toggle-block')->assertOk();
        $this->assertSame(3, $this->sections()['A']['uncovered_count']);
    }

    public function test_a_section_with_no_coordinator_is_wholly_uncovered(): void
    {
        $this->student('CSE');
        $this->student('ECE');

        $a = $this->sections()['A'];

        $this->assertNull($a['coordinator_name']);
        $this->assertSame([], $a['coordinators']);
        $this->assertSame(2, $a['uncovered_count']);
    }

    public function test_ops_set_scopes_under_the_same_rules(): void
    {
        $ops = User::factory()->create(['role' => User::ROLE_SUPERADMIN]);
        Sanctum::actingAs($ops);

        $this->postJson("/api/admin/colleges/{$this->college->id}/coordinators", ['name' => 'Eva Ops', 'email' => 'eva.ops@example.com', 'section' => 'A', 'branch_scope' => ['disciplines' => ['ece'], 'branches' => []]])
            ->assertCreated()->assertJsonPath('coordinator.scope_label', 'ECE');

        $this->postJson("/api/admin/colleges/{$this->college->id}/coordinators", ['name' => 'Dup Ops', 'email' => 'dup.ops@example.com', 'section' => 'A', 'branch_scope' => ['disciplines' => ['ece'], 'branches' => []]])
            ->assertStatus(422)->assertJsonValidationErrors('branch_scope');

        $listed = $this->getJson("/api/admin/colleges/{$this->college->id}/coordinators")->assertOk()->json();
        $this->assertSame('ECE', $listed['coordinators'][0]['scope_label']);
    }

    public function test_existing_coordinators_without_a_scope_behave_exactly_as_before(): void
    {
        $this->student('CSE');
        $this->student('ECE');
        $legacy = User::factory()->create(['role' => User::ROLE_SECTION_COORDINATOR, 'college_id' => $this->college->id, 'section' => 'A', 'must_change_password' => false]);

        $this->assertNull($legacy->fresh()->coordinator_scope);
        Sanctum::actingAs($legacy);
        $this->assertCount(2, $this->getJson('/api/coordinator/students')->assertOk()->json('students'));
        $this->assertSame('All branches', BranchAudience::label($legacy->coordinator_scope));
    }
}
