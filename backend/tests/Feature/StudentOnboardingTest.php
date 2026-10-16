<?php

namespace Tests\Feature;

use App\Models\College;
use App\Models\User;
use App\Support\StudentPreferences;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\CreatesCodingActivityFixtures;
use Tests\TestCase;

/**
 * First-login onboarding and the preferences it saves: who is asked, what is
 * accepted, how a skip is remembered, how a later edit from Settings behaves,
 * and what the answers change elsewhere (the weekly goal).
 */
class StudentOnboardingTest extends TestCase
{
    use CreatesCodingActivityFixtures;
    use RefreshDatabase;

    private function student(array $attributes = []): User
    {
        return User::factory()->create(array_merge(['role' => User::ROLE_USER], $attributes));
    }

    private function validAnswers(array $overrides = []): array
    {
        return array_merge([
            'primary_language' => 'python',
            'preferred_languages' => ['java', 'cpp'],
            'skill_level' => 'intermediate',
            'career_goal' => 'campus_placement',
            'focus_areas' => ['problem_solving', 'mock_interviews'],
            'weekly_pace' => 'steady',
        ], $overrides);
    }

    public function test_a_student_who_has_not_answered_is_flagged_as_needing_onboarding(): void
    {
        $student = $this->student();
        Sanctum::actingAs($student);

        $this->getJson('/api/me')->assertOk()->assertJsonPath('user.onboarding_pending', true);
    }

    public function test_only_students_are_ever_asked(): void
    {
        $college = College::create(['name' => 'Staff College', 'short_code' => 'SC']);
        $tpo = User::factory()->create(['role' => User::ROLE_ADMIN_TPO, 'college_id' => $college->id]);
        Sanctum::actingAs($tpo);

        $this->getJson('/api/me')->assertOk()->assertJsonPath('user.onboarding_pending', false);
        $this->postJson('/api/me/onboarding', $this->validAnswers())->assertForbidden();
        $this->postJson('/api/me/onboarding/skip')->assertForbidden();
        $this->putJson('/api/me/preferences', ['skill_level' => 'advanced'])->assertForbidden();
        $this->getJson('/api/me/language-insights')->assertForbidden();
    }

    public function test_completing_onboarding_saves_every_answer_and_stops_the_prompt(): void
    {
        $student = $this->student();
        Sanctum::actingAs($student);

        $response = $this->postJson('/api/me/onboarding', $this->validAnswers());

        $response->assertOk()
            ->assertJsonPath('user.onboarding_pending', false)
            ->assertJsonPath('user.primary_language', 'python')
            ->assertJsonPath('user.skill_level', 'intermediate')
            ->assertJsonPath('user.career_goal', 'campus_placement')
            ->assertJsonPath('user.weekly_pace', 'steady');

        // The primary language always leads its own list, with no duplicates.
        $this->assertSame(['python', 'java', 'cpp'], $student->fresh()->preferred_languages);
        $this->assertSame(['problem_solving', 'mock_interviews'], $student->fresh()->focus_areas);
        $this->assertNotNull($student->fresh()->onboarding_completed_at);
    }

    public function test_a_primary_language_repeated_in_the_other_languages_is_not_duplicated(): void
    {
        $student = $this->student();
        Sanctum::actingAs($student);

        $this->postJson('/api/me/onboarding', $this->validAnswers(['preferred_languages' => ['python', 'java', 'java']]))
            ->assertStatus(422); // `distinct` — the same language twice in the list is a bad request, not silently merged

        $this->postJson('/api/me/onboarding', $this->validAnswers(['preferred_languages' => ['python', 'java']]))->assertOk();
        $this->assertSame(['python', 'java'], $student->fresh()->preferred_languages);
    }

    public function test_the_three_core_answers_are_required_to_finish(): void
    {
        Sanctum::actingAs($this->student());

        foreach (['primary_language', 'skill_level', 'career_goal'] as $field) {
            $answers = $this->validAnswers();
            unset($answers[$field]);

            $this->postJson('/api/me/onboarding', $answers)->assertStatus(422)->assertJsonValidationErrors($field);
        }
    }

    public function test_values_outside_the_catalogue_are_rejected(): void
    {
        Sanctum::actingAs($this->student());

        $this->postJson('/api/me/onboarding', $this->validAnswers(['primary_language' => 'brainfuck']))->assertStatus(422)->assertJsonValidationErrors('primary_language');
        $this->postJson('/api/me/onboarding', $this->validAnswers(['skill_level' => 'wizard']))->assertStatus(422)->assertJsonValidationErrors('skill_level');
        $this->postJson('/api/me/onboarding', $this->validAnswers(['career_goal' => 'world_domination']))->assertStatus(422)->assertJsonValidationErrors('career_goal');
        $this->postJson('/api/me/onboarding', $this->validAnswers(['focus_areas' => ['napping']]))->assertStatus(422)->assertJsonValidationErrors('focus_areas.0');
        $this->postJson('/api/me/onboarding', $this->validAnswers(['weekly_pace' => 'ludicrous']))->assertStatus(422)->assertJsonValidationErrors('weekly_pace');
        $this->postJson('/api/me/onboarding', $this->validAnswers(['preferred_languages' => ['cobol']]))->assertStatus(422)->assertJsonValidationErrors('preferred_languages.0');
    }

    public function test_too_many_languages_are_rejected(): void
    {
        Sanctum::actingAs($this->student());

        $tooMany = ['java', 'cpp', 'c', 'go', 'rust', 'ruby', 'php']; // 7 > MAX_LANGUAGES

        $this->postJson('/api/me/onboarding', $this->validAnswers(['preferred_languages' => $tooMany]))
            ->assertStatus(422)
            ->assertJsonValidationErrors('preferred_languages');
        $this->assertGreaterThan(StudentPreferences::MAX_LANGUAGES, count($tooMany));
    }

    public function test_skipping_is_remembered_and_the_prompt_returns_after_the_cool_off(): void
    {
        $student = $this->student();
        Sanctum::actingAs($student);

        $this->postJson('/api/me/onboarding/skip')->assertOk()->assertJsonPath('user.onboarding_pending', false);
        $this->getJson('/api/me')->assertJsonPath('user.onboarding_pending', false);

        $this->travel(StudentPreferences::SKIP_COOLDOWN_DAYS - 1)->days();
        $this->assertFalse($student->fresh()->needsOnboarding(), 'still inside the cool-off');

        $this->travel(2)->days();
        $this->assertTrue($student->fresh()->needsOnboarding(), 'cool-off over — ask again');
    }

    public function test_completing_after_a_skip_clears_the_skip(): void
    {
        $student = $this->student();
        Sanctum::actingAs($student);

        $this->postJson('/api/me/onboarding/skip')->assertOk();
        $this->postJson('/api/me/onboarding', $this->validAnswers())->assertOk();

        $this->assertNull($student->fresh()->onboarding_skipped_at);
        $this->travel(30)->days();
        $this->assertFalse($student->fresh()->needsOnboarding());
    }

    public function test_skipping_never_undoes_a_completed_onboarding(): void
    {
        $student = $this->student();
        Sanctum::actingAs($student);

        $this->postJson('/api/me/onboarding', $this->validAnswers())->assertOk();
        $this->postJson('/api/me/onboarding/skip')->assertOk();

        $this->assertNotNull($student->fresh()->onboarding_completed_at);
        $this->assertNull($student->fresh()->onboarding_skipped_at);
    }

    public function test_settings_can_edit_a_single_answer_without_touching_the_rest(): void
    {
        $student = $this->student();
        Sanctum::actingAs($student);
        $this->postJson('/api/me/onboarding', $this->validAnswers())->assertOk();

        $this->putJson('/api/me/preferences', ['skill_level' => 'advanced'])->assertOk();

        $fresh = $student->fresh();
        $this->assertSame('advanced', $fresh->skill_level);
        $this->assertSame('python', $fresh->primary_language);
        $this->assertSame(['python', 'java', 'cpp'], $fresh->preferred_languages);
        $this->assertSame('campus_placement', $fresh->career_goal);
    }

    public function test_changing_only_the_primary_language_keeps_the_other_languages(): void
    {
        $student = $this->student();
        Sanctum::actingAs($student);
        $this->postJson('/api/me/onboarding', $this->validAnswers())->assertOk();

        $this->putJson('/api/me/preferences', ['primary_language' => 'java'])->assertOk();

        // java is promoted to the front; python stays in the list, no duplicate java.
        $this->assertSame(['java', 'python', 'cpp'], $student->fresh()->preferred_languages);
        $this->assertSame('java', $student->fresh()->primary_language);
    }

    public function test_filling_the_core_answers_in_settings_counts_as_finishing_onboarding(): void
    {
        $student = $this->student();
        Sanctum::actingAs($student);

        // Partial answers don't finish it...
        $this->putJson('/api/me/preferences', ['primary_language' => 'go'])->assertOk()->assertJsonPath('user.onboarding_pending', true);
        // ...but the full core set does, so they are not asked again.
        $this->putJson('/api/me/preferences', ['skill_level' => 'beginner', 'career_goal' => 'internship'])
            ->assertOk()
            ->assertJsonPath('user.onboarding_pending', false);
        $this->assertNotNull($student->fresh()->onboarding_completed_at);
    }

    public function test_the_weekly_goal_follows_the_chosen_pace(): void
    {
        $student = $this->student();
        Sanctum::actingAs($student);

        // No pace chosen → the 20 / 5 the dashboard always had.
        $this->getJson('/api/me/stats')->assertOk()
            ->assertJsonPath('weekly_goals.solved_this_week.target', 20)
            ->assertJsonPath('weekly_goals.hard_solved_this_week.target', 5);

        $this->putJson('/api/me/preferences', ['weekly_pace' => 'intense'])->assertOk();
        $this->getJson('/api/me/stats')
            ->assertJsonPath('weekly_goals.solved_this_week.target', 35)
            ->assertJsonPath('weekly_goals.hard_solved_this_week.target', 10);

        $this->putJson('/api/me/preferences', ['weekly_pace' => 'casual'])->assertOk();
        $this->getJson('/api/me/stats')
            ->assertJsonPath('weekly_goals.solved_this_week.target', 10)
            ->assertJsonPath('weekly_goals.hard_solved_this_week.target', 2);
    }

    public function test_the_password_and_role_cannot_be_smuggled_in_through_preferences(): void
    {
        $student = $this->student();
        Sanctum::actingAs($student);

        $this->putJson('/api/me/preferences', ['role' => User::ROLE_SUPERADMIN, 'college_id' => 1, 'is_blocked' => true, 'skill_level' => 'advanced'])->assertOk();

        $fresh = $student->fresh();
        $this->assertSame(User::ROLE_USER, $fresh->role);
        $this->assertNull($fresh->college_id);
        $this->assertFalse((bool) $fresh->is_blocked);
        $this->assertSame('advanced', $fresh->skill_level);
    }

    public function test_login_and_session_checks_stamp_last_seen_without_writing_on_every_request(): void
    {
        $student = $this->student();
        $this->assertNull($student->last_seen_at);

        $this->postJson('/api/login', ['email' => $student->email, 'password' => 'password'])->assertOk();
        $firstSeen = $student->fresh()->last_seen_at;
        $this->assertNotNull($firstSeen);

        // A re-check moments later is inside the throttle window — no new write.
        Sanctum::actingAs($student->fresh());
        $this->travel(2)->minutes();
        $this->getJson('/api/me')->assertOk();
        $this->assertEquals($firstSeen->timestamp, $student->fresh()->last_seen_at->timestamp);

        // Past the window it refreshes.
        $this->travel(15)->minutes();
        $this->getJson('/api/me')->assertOk();
        $this->assertGreaterThan($firstSeen->timestamp, $student->fresh()->last_seen_at->timestamp);
    }
}
