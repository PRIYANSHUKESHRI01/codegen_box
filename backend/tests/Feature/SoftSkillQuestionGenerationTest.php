<?php

namespace Tests\Feature;

use App\Models\SoftSkillAssessment;
use App\Models\SoftSkillQuestion;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Covers GeminiSoftSkillQuestionGeneratorService (via
 * AdminSoftSkillQuestionBankController::generate(), Http::fake()'d — same
 * "prove the parsing/sanitization independent of the live API" posture as
 * every other Gemini service test in this codebase) and
 * ManagesSoftSkillQuestions::autoFillQuestions()'s honest partial-fill
 * behavior.
 */
class SoftSkillQuestionGenerationTest extends TestCase
{
    use RefreshDatabase;

    private function opsUser(): User
    {
        return User::factory()->create(['role' => User::ROLE_ADMIN_INTERNAL, 'permissions' => [User::PERM_SOFT_SKILLS]]);
    }

    public function test_returns_422_when_gemini_not_configured(): void
    {
        config(['services.gemini.api_key' => null]);
        Sanctum::actingAs($this->opsUser());

        $response = $this->postJson('/api/admin/soft-skill-question-bank/generate', [
            'category' => 'aptitude',
            'difficulty' => 'medium',
            'count' => 5,
        ]);

        $response->assertStatus(422);
        $this->assertSame(0, SoftSkillQuestion::count());
    }

    public function test_generates_and_persists_real_bank_rows(): void
    {
        config(['services.gemini.api_key' => 'test-key']);
        Http::fake([
            'generativelanguage.googleapis.com/*' => Http::response([
                'candidates' => [
                    ['content' => ['parts' => [['text' => json_encode([
                        ['question_text' => 'What is 10% of 50?', 'options' => ['3', '5', '7', '10'], 'correct_index' => 1, 'explanation' => '10% of 50 is 5.'],
                        ['question_text' => 'What is 20% of 200?', 'options' => ['20', '30', '40', '50'], 'correct_index' => 2, 'explanation' => '20% of 200 is 40.'],
                    ])]]]],
                ],
            ], 200),
        ]);

        Sanctum::actingAs($this->opsUser());

        $response = $this->postJson('/api/admin/soft-skill-question-bank/generate', [
            'category' => 'aptitude',
            'difficulty' => 'medium',
            'count' => 2,
        ]);

        $response->assertStatus(201);
        $this->assertSame(2, SoftSkillQuestion::count());
        $this->assertDatabaseHas('soft_skill_questions', [
            'question_text' => 'What is 20% of 200?',
            'category' => 'aptitude',
            'correct_index' => 2,
            'is_active' => true,
        ]);
    }

    public function test_drops_malformed_items_without_failing_the_batch(): void
    {
        config(['services.gemini.api_key' => 'test-key']);
        Http::fake([
            'generativelanguage.googleapis.com/*' => Http::response([
                'candidates' => [
                    ['content' => ['parts' => [['text' => json_encode([
                        ['question_text' => 'Valid question', 'options' => ['a', 'b', 'c', 'd'], 'correct_index' => 1, 'explanation' => 'Because.'],
                        // Missing options entirely — must be dropped.
                        ['question_text' => 'Broken question', 'correct_index' => 1, 'explanation' => 'x'],
                        // correct_index out of range — must be dropped.
                        ['question_text' => 'Also broken', 'options' => ['a', 'b', 'c', 'd'], 'correct_index' => 9, 'explanation' => 'x'],
                    ])]]]],
                ],
            ], 200),
        ]);

        Sanctum::actingAs($this->opsUser());

        $response = $this->postJson('/api/admin/soft-skill-question-bank/generate', [
            'category' => 'reasoning',
            'difficulty' => 'easy',
            'count' => 3,
        ]);

        $response->assertStatus(201);
        $this->assertSame(1, SoftSkillQuestion::count(), 'only the one valid item should be persisted');
    }

    public function test_students_cannot_generate_questions(): void
    {
        config(['services.gemini.api_key' => 'test-key']);
        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_USER]));

        $response = $this->postJson('/api/admin/soft-skill-question-bank/generate', [
            'category' => 'aptitude',
            'difficulty' => 'medium',
            'count' => 3,
        ]);

        $response->assertStatus(403);
    }

    public function test_auto_fill_reports_an_honest_shortfall_when_the_bank_runs_out(): void
    {
        SoftSkillQuestion::create(['category' => 'aptitude', 'question_text' => 'Q1', 'options' => ['a', 'b', 'c', 'd'], 'correct_index' => 0, 'is_active' => true]);
        SoftSkillQuestion::create(['category' => 'aptitude', 'question_text' => 'Q2', 'options' => ['a', 'b', 'c', 'd'], 'correct_index' => 0, 'is_active' => true]);

        $assessment = SoftSkillAssessment::create([
            'title' => 'Test',
            'slug' => SoftSkillAssessment::uniqueSlug('Test'),
            'status' => SoftSkillAssessment::STATUS_DRAFT,
            'assessment_type' => SoftSkillAssessment::TYPE_GENERAL,
            'duration_minutes' => 30,
            'pass_percentage' => 60,
        ]);

        Sanctum::actingAs($this->opsUser());

        $response = $this->postJson("/api/admin/soft-skills/{$assessment->slug}/questions/auto-fill", [
            'composition' => ['aptitude' => 5],
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('attached_count', 2)
            ->assertJsonPath('shortfalls.aptitude.requested', 5)
            ->assertJsonPath('shortfalls.aptitude.attached', 2);

        $this->assertSame(2, $assessment->assessmentQuestions()->count());
    }

    public function test_auto_fill_never_attaches_the_same_question_twice(): void
    {
        SoftSkillQuestion::create(['category' => 'english', 'question_text' => 'Q1', 'options' => ['a', 'b', 'c', 'd'], 'correct_index' => 0, 'is_active' => true]);
        SoftSkillQuestion::create(['category' => 'english', 'question_text' => 'Q2', 'options' => ['a', 'b', 'c', 'd'], 'correct_index' => 0, 'is_active' => true]);

        $assessment = SoftSkillAssessment::create([
            'title' => 'Test',
            'slug' => SoftSkillAssessment::uniqueSlug('Test'),
            'status' => SoftSkillAssessment::STATUS_DRAFT,
            'assessment_type' => SoftSkillAssessment::TYPE_GENERAL,
            'duration_minutes' => 30,
            'pass_percentage' => 60,
        ]);

        Sanctum::actingAs($this->opsUser());

        $this->postJson("/api/admin/soft-skills/{$assessment->slug}/questions/auto-fill", ['composition' => ['english' => 2]])->assertStatus(201);
        $second = $this->postJson("/api/admin/soft-skills/{$assessment->slug}/questions/auto-fill", ['composition' => ['english' => 2]]);

        $second->assertStatus(201)->assertJsonPath('attached_count', 0);
        $this->assertSame(2, $assessment->assessmentQuestions()->count());
    }
}
