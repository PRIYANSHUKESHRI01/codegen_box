<?php

namespace Tests\Feature;

use App\Models\College;
use App\Models\User;
use App\Support\BranchNormalizer;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * "My branch isn't listed": a student who cannot find their branch in the list writes it instead. It is kept as their own words in the
 * department they chose, counts as answered (they are not asked again), still lands on their TPO's roster, and never overrides a branch
 * their college gave us and we recognise.
 */
class StudentOwnBranchTest extends TestCase
{
    use RefreshDatabase;

    private function student(array $attrs = []): User
    {
        return User::factory()->create(['role' => User::ROLE_USER] + $attrs);
    }

    private function onboardingAnswers(array $extra = []): array
    {
        return $extra + [
            'primary_language' => 'python',
            'skill_level' => 'intermediate',
            'career_goal' => 'campus_placement',
        ];
    }

    public function test_a_student_can_write_a_branch_that_is_not_listed(): void
    {
        $s = $this->student();
        Sanctum::actingAs($s);

        $this->assertTrue($s->fresh()->branch_pending, 'a student with no branch is asked');

        $this->putJson('/api/me/branch', ['branch_label' => 'Biomedical Engineering', 'branch_department' => 'engineering'])
            ->assertOk()
            ->assertJsonPath('user.branch', 'Biomedical Engineering')
            ->assertJsonPath('user.branch_code', null)
            ->assertJsonPath('user.discipline', null)
            ->assertJsonPath('user.department', 'engineering')
            ->assertJsonPath('user.branch_source', 'self')
            ->assertJsonPath('user.branch_pending', false);

        $fresh = $s->fresh();
        $this->assertNotNull($fresh->branch_confirmed_at);
        $this->assertSame(BranchNormalizer::key('Biomedical Engineering'), $fresh->branch_key);
    }

    public function test_they_are_not_asked_again_on_the_next_visit(): void
    {
        $s = $this->student();
        Sanctum::actingAs($s);

        $this->putJson('/api/me/branch', ['branch_label' => 'Biomedical Engineering'])->assertOk();

        $this->getJson('/api/me')->assertOk()->assertJsonPath('user.branch_pending', false);
        $this->travel(30)->days();
        $this->assertFalse($s->fresh()->branch_pending, 'it does not come back after the cool-off either');
    }

    public function test_the_words_are_trimmed_and_spaces_collapsed(): void
    {
        $s = $this->student();
        Sanctum::actingAs($s);

        $this->putJson('/api/me/branch', ['branch_label' => "  Marine \t  Engineering  "])->assertOk()->assertJsonPath('user.branch', 'Marine Engineering');
    }

    public function test_a_branch_we_know_under_another_spelling_becomes_that_branch(): void
    {
        $s = $this->student();
        Sanctum::actingAs($s);

        $this->putJson('/api/me/branch', ['branch_label' => 'Civil'])
            ->assertOk()
            ->assertJsonPath('user.branch_code', 'civil')
            ->assertJsonPath('user.branch_source', 'self');
    }

    public function test_a_spelling_of_a_branch_that_is_switched_off_stays_their_own_words(): void
    {
        // "Marine Engineering" is a known spelling, but that branch is not on offer (only the main branches are). It must not fail with
        // "that branch is not available" — the student wrote what they study, so it is kept as written.
        $s = $this->student();
        Sanctum::actingAs($s);

        $this->putJson('/api/me/branch', ['branch_label' => 'Marine Engineering'])
            ->assertOk()
            ->assertJsonPath('user.branch', 'Marine Engineering')
            ->assertJsonPath('user.branch_code', null)
            ->assertJsonPath('user.branch_source', 'self')
            ->assertJsonPath('user.branch_pending', false);
    }

    public function test_writing_a_second_time_changes_it_and_stays_their_own(): void
    {
        $s = $this->student();
        Sanctum::actingAs($s);

        $this->putJson('/api/me/branch', ['branch_label' => 'Biomedical Engineering'])->assertOk();
        // The model's `saving` hook reads a changed `branch` as a college-typed label; a self-written one must not be re-read that way.
        $this->putJson('/api/me/branch', ['branch_label' => 'Marine Engineering'])
            ->assertOk()
            ->assertJsonPath('user.branch', 'Marine Engineering')
            ->assertJsonPath('user.branch_source', 'self')
            ->assertJsonPath('user.branch_code', null)
            ->assertJsonPath('user.branch_pending', false);
    }

    public function test_they_can_still_pick_a_listed_branch_later(): void
    {
        $s = $this->student();
        Sanctum::actingAs($s);

        $this->putJson('/api/me/branch', ['branch_label' => 'Biomedical Engineering'])->assertOk();
        $this->putJson('/api/me/branch', ['branch_code' => 'mech'])
            ->assertOk()
            ->assertJsonPath('user.branch_code', 'mech')
            ->assertJsonPath('user.branch', 'Mechanical Engineering');
    }

    public function test_a_branch_the_college_gave_and_we_recognise_is_never_overridden(): void
    {
        $s = $this->student(['branch' => 'Civil']);
        Sanctum::actingAs($s);

        $this->putJson('/api/me/branch', ['branch_label' => 'Biomedical Engineering'])->assertOk();

        $fresh = $s->fresh();
        $this->assertSame('civil', $fresh->branch_code);
        $this->assertSame('college', $fresh->branch_source);
        $this->assertSame('Civil', $fresh->branch);
    }

    public function test_a_college_label_we_could_not_read_can_be_replaced_by_the_student(): void
    {
        $s = $this->student(['branch' => 'Quantum Basket Weaving']);
        Sanctum::actingAs($s);
        $this->assertNull($s->fresh()->branch_code);
        $this->assertTrue($s->fresh()->branch_pending);

        $this->putJson('/api/me/branch', ['branch_label' => 'Textile Technology'])
            ->assertOk()
            ->assertJsonPath('user.branch', 'Textile Technology')
            ->assertJsonPath('user.branch_source', 'self')
            ->assertJsonPath('user.branch_pending', false);
    }

    public function test_the_first_login_wizard_accepts_it_too(): void
    {
        $s = $this->student();
        Sanctum::actingAs($s);

        $this->postJson('/api/me/onboarding', $this->onboardingAnswers(['branch_label' => 'Biomedical Engineering', 'branch_department' => 'engineering']))
            ->assertOk()
            ->assertJsonPath('user.onboarding_pending', false)
            ->assertJsonPath('user.branch', 'Biomedical Engineering')
            ->assertJsonPath('user.branch_source', 'self')
            ->assertJsonPath('user.branch_pending', false);
    }

    public function test_a_new_commerce_student_finishes_the_wizard_without_a_language(): void
    {
        // The wizard skips the language step for a programme without coding, so the save carries none. The programme being judged
        // is the one this same request declares — not the "nothing yet" the student was a moment ago.
        $s = $this->student();
        Sanctum::actingAs($s);

        $this->postJson('/api/me/onboarding', ['branch_code' => 'bcom', 'skill_level' => 'beginner', 'career_goal' => 'campus_placement'])
            ->assertOk()
            ->assertJsonPath('user.department', 'commerce')
            ->assertJsonPath('user.branch_code', 'bcom')
            ->assertJsonPath('user.capabilities.coding_practice', false)
            ->assertJsonPath('user.onboarding_pending', false);
    }

    public function test_the_same_holds_when_a_commerce_student_writes_their_own_branch(): void
    {
        $s = $this->student();
        Sanctum::actingAs($s);

        $this->postJson('/api/me/onboarding', ['branch_label' => 'Banking Studies', 'branch_department' => 'commerce', 'skill_level' => 'beginner', 'career_goal' => 'campus_placement'])
            ->assertOk()
            ->assertJsonPath('user.department', 'commerce')
            ->assertJsonPath('user.branch', 'Banking Studies')
            ->assertJsonPath('user.capabilities.coding_practice', false);
    }

    public function test_an_engineering_student_still_has_to_say_which_language_they_code_in(): void
    {
        $s = $this->student();
        Sanctum::actingAs($s);

        $this->postJson('/api/me/onboarding', ['branch_code' => 'cse', 'skill_level' => 'beginner', 'career_goal' => 'campus_placement'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('primary_language');

        $this->postJson('/api/me/onboarding', ['branch_code' => 'cse', 'primary_language' => 'python', 'skill_level' => 'beginner', 'career_goal' => 'campus_placement'])
            ->assertOk()
            ->assertJsonPath('user.department', 'engineering');
    }

    public function test_a_department_the_college_does_not_run_is_refused(): void
    {
        $college = College::create(['name' => 'Engineering Only College', 'short_code' => 'EOC', 'tier' => 'Standard']);
        $s = $this->student(['college_id' => $college->id]);
        Sanctum::actingAs($s);

        $this->putJson('/api/me/branch', ['branch_label' => 'Quantum Basket Weaving', 'branch_department' => 'commerce'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('branch_department');

        $this->assertNull($s->fresh()->branch_source);
    }

    public function test_nonsense_is_rejected(): void
    {
        $s = $this->student();
        Sanctum::actingAs($s);

        $this->putJson('/api/me/branch', ['branch_label' => 'A'])->assertStatus(422)->assertJsonValidationErrors('branch_label');
        $this->putJson('/api/me/branch', ['branch_label' => str_repeat('x', 81)])->assertStatus(422)->assertJsonValidationErrors('branch_label');
        $this->putJson('/api/me/branch', ['branch_label' => 'Biomedical Engineering', 'branch_department' => 'witchcraft'])->assertStatus(422)->assertJsonValidationErrors('branch_department');
    }

    public function test_only_students_can_use_it(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_ADMIN_TPO]));

        $this->putJson('/api/me/branch', ['branch_label' => 'Biomedical Engineering'])->assertForbidden();
    }
}
