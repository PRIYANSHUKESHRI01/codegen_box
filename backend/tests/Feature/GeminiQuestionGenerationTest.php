<?php

namespace Tests\Feature;

use App\Models\Company;
use App\Models\CompanyRecommendedInterviewQuestion;
use App\Models\InterviewQuestionBank;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Covers InterviewQuestionGenerationController + GeminiQuestionGeneratorService
 * without ever calling the real Gemini API — Http::fake() stands in for it,
 * so this proves the parsing/clamping/persistence/company-tagging logic is
 * correct independent of whether the live API's exact wire format matches
 * what's assumed (see the service's docblock on the "no verified live key
 * yet" caveat).
 */
class GeminiQuestionGenerationTest extends TestCase
{
    use RefreshDatabase;

    private function opsUser(): User
    {
        return User::factory()->create(['role' => User::ROLE_ADMIN_INTERNAL]);
    }

    private function fakeGeminiResponse(array $items): void
    {
        Http::fake([
            'generativelanguage.googleapis.com/*' => Http::response([
                'candidates' => [
                    ['content' => ['parts' => [['text' => json_encode($items)]]]],
                ],
            ], 200),
        ]);
    }

    public function test_returns_422_when_not_configured(): void
    {
        config(['services.gemini.api_key' => null]);
        Sanctum::actingAs($this->opsUser());

        $response = $this->postJson('/api/interview-question-bank/generate', [
            'role' => 'Backend Engineer',
            'difficulty' => 'medium',
            'categories' => ['technical'],
            'count' => 3,
        ]);

        $response->assertStatus(422)->assertJsonFragment(['message' => 'AI question generation is not configured yet — add questions from the bank instead.']);
        $this->assertSame(0, InterviewQuestionBank::count());
    }

    public function test_generates_and_persists_real_bank_rows(): void
    {
        config(['services.gemini.api_key' => 'test-key']);
        $this->fakeGeminiResponse([
            ['question_text' => 'Describe a time you debugged a hard production issue.', 'category' => 'behavioral', 'difficulty' => 'medium', 'expected_duration_seconds' => 150, 'tags' => ['debugging'], 'notes_for_reviewer' => 'Listen for a systematic approach.'],
            ['question_text' => 'How would you design a URL shortener?', 'category' => 'technical', 'difficulty' => 'medium', 'expected_duration_seconds' => 200, 'tags' => ['system-design'], 'notes_for_reviewer' => null],
        ]);

        $user = $this->opsUser();
        Sanctum::actingAs($user);

        $response = $this->postJson('/api/interview-question-bank/generate', [
            'role' => 'Backend Engineer',
            'difficulty' => 'medium',
            'categories' => ['technical', 'behavioral'],
            'count' => 2,
        ]);

        $response->assertStatus(201);
        $this->assertSame(2, InterviewQuestionBank::count());
        $this->assertDatabaseHas('interview_question_banks', [
            'question_text' => 'How would you design a URL shortener?',
            'category' => 'technical',
            'expected_duration_seconds' => 200,
            'created_by' => $user->id,
            'is_active' => true,
        ]);
    }

    public function test_clamps_out_of_range_duration_and_drops_malformed_items(): void
    {
        config(['services.gemini.api_key' => 'test-key']);
        $this->fakeGeminiResponse([
            // Duration way above the 300s ceiling — must be clamped, not stored as-is.
            ['question_text' => 'Tell me about your greatest strength.', 'category' => 'hr', 'difficulty' => 'easy', 'expected_duration_seconds' => 5000, 'tags' => [], 'notes_for_reviewer' => null],
            // Missing question_text entirely — must be dropped, not crash the batch.
            ['category' => 'hr', 'difficulty' => 'easy', 'expected_duration_seconds' => 100],
        ]);

        Sanctum::actingAs($this->opsUser());

        $response = $this->postJson('/api/interview-question-bank/generate', [
            'role' => 'Analyst',
            'difficulty' => 'easy',
            'categories' => ['hr'],
            'count' => 2,
        ]);

        $response->assertStatus(201);
        $this->assertSame(1, InterviewQuestionBank::count(), 'the malformed item must be dropped, not stored');
        $this->assertDatabaseHas('interview_question_banks', [
            'question_text' => 'Tell me about your greatest strength.',
            'expected_duration_seconds' => 300, // clamped down from 5000
        ]);
    }

    public function test_tags_generated_questions_to_the_requested_company(): void
    {
        config(['services.gemini.api_key' => 'test-key']);
        $company = Company::create(['name' => 'Nimbus Test Co', 'slug' => 'nimbus-test-co-'.uniqid()]);
        $this->fakeGeminiResponse([
            ['question_text' => 'Walk me through your approach to code review.', 'category' => 'technical', 'difficulty' => 'medium', 'expected_duration_seconds' => 180, 'tags' => [], 'notes_for_reviewer' => null],
        ]);

        Sanctum::actingAs($this->opsUser());

        $response = $this->postJson('/api/interview-question-bank/generate', [
            'role' => 'Backend Engineer',
            'difficulty' => 'medium',
            'categories' => ['technical'],
            'count' => 1,
            'company_id' => $company->id,
        ]);

        $response->assertStatus(201);
        $questionId = InterviewQuestionBank::firstOrFail()->id;
        $this->assertDatabaseHas('company_recommended_interview_questions', [
            'company_id' => $company->id,
            'interview_question_bank_id' => $questionId,
        ]);
    }

    public function test_students_cannot_generate_questions(): void
    {
        config(['services.gemini.api_key' => 'test-key']);
        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_USER]));

        $response = $this->postJson('/api/interview-question-bank/generate', [
            'role' => 'Backend Engineer',
            'difficulty' => 'medium',
            'categories' => ['technical'],
            'count' => 1,
        ]);

        $response->assertStatus(403);
    }

    public function test_validates_required_fields(): void
    {
        config(['services.gemini.api_key' => 'test-key']);
        Sanctum::actingAs($this->opsUser());

        $response = $this->postJson('/api/interview-question-bank/generate', []);

        $response->assertStatus(422)->assertJsonValidationErrors(['role', 'difficulty', 'categories', 'count']);
    }
}
