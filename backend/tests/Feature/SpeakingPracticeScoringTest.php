<?php

namespace Tests\Feature;

use App\Models\SpeakingAttempt;
use App\Models\SpeakingPrompt;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Covers SpeakingPracticeController::submit() + GeminiSpeakingScoringService
 * without ever calling the real Gemini API — Http::fake() stands in for it,
 * same "prove the parsing/clamping/persistence logic independent of the
 * live API" posture as GeminiQuestionGenerationTest.
 */
class SpeakingPracticeScoringTest extends TestCase
{
    use RefreshDatabase;

    private function studentUser(): User
    {
        return User::factory()->create(['role' => User::ROLE_USER]);
    }

    private function prompt(): SpeakingPrompt
    {
        return SpeakingPrompt::create([
            'title' => 'Test Passage',
            'passage_text' => 'The quick brown fox jumps over the lazy dog.',
            'category' => 'General',
            'difficulty' => SpeakingPrompt::DIFFICULTY_BEGINNER,
            'target_wpm_min' => 110,
            'target_wpm_max' => 160,
            'is_active' => true,
        ]);
    }

    private function fakeGeminiScore(array $result): void
    {
        Http::fake([
            'generativelanguage.googleapis.com/*' => Http::response([
                'candidates' => [
                    ['content' => ['parts' => [['text' => json_encode($result)]]]],
                ],
            ], 200),
        ]);
    }

    public function test_returns_422_when_not_configured(): void
    {
        config(['services.gemini.api_key' => null]);
        Sanctum::actingAs($this->studentUser());
        $prompt = $this->prompt();

        $response = $this->postJson("/api/learning-centre/speaking/prompts/{$prompt->id}/attempts", [
            'transcript_text' => 'The quick brown fox jumps over the lazy dog.',
            'duration_seconds' => 5,
        ]);

        $response->assertStatus(422)->assertJsonFragment(['message' => 'AI speech scoring is not configured yet.']);
        $attempt = SpeakingAttempt::firstOrFail();
        $this->assertNotNull($attempt->scoring_failed_at);
        $this->assertNull($attempt->overall_score);
    }

    public function test_a_passing_score_is_persisted_and_marked_passed(): void
    {
        config(['services.gemini.api_key' => 'test-key']);
        $this->fakeGeminiScore([
            'overall_score' => 82,
            'clarity_score' => 85,
            'fluency_score' => 80,
            'accuracy_score' => 90,
            'feedback' => 'You read clearly and at a steady pace.',
            'improvement_tips' => ['Slow down slightly on longer words.'],
        ]);

        Sanctum::actingAs($this->studentUser());
        $prompt = $this->prompt();

        $response = $this->postJson("/api/learning-centre/speaking/prompts/{$prompt->id}/attempts", [
            'transcript_text' => 'The quick brown fox jumps over the lazy dog.',
            'duration_seconds' => 5,
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('attempt.overall_score', 82)
            ->assertJsonPath('attempt.passed', true);

        $this->assertDatabaseHas('speaking_attempts', [
            'speaking_prompt_id' => $prompt->id,
            'overall_score' => 82,
            'passed' => true,
        ]);
    }

    public function test_a_score_below_sixty_is_marked_not_passed_for_the_frontend_retry_flow(): void
    {
        config(['services.gemini.api_key' => 'test-key']);
        $this->fakeGeminiScore([
            'overall_score' => 45,
            'clarity_score' => 40,
            'fluency_score' => 50,
            'accuracy_score' => 45,
            'feedback' => 'Several words were unclear — try reading a little slower.',
            'improvement_tips' => ['Pause briefly between sentences.'],
        ]);

        Sanctum::actingAs($this->studentUser());
        $prompt = $this->prompt();

        $response = $this->postJson("/api/learning-centre/speaking/prompts/{$prompt->id}/attempts", [
            'transcript_text' => 'The quick brown dog.',
            'duration_seconds' => 5,
        ]);

        $response->assertStatus(200)->assertJsonPath('attempt.passed', false);
        $this->assertSame(SpeakingAttempt::PASS_THRESHOLD, 60);
    }

    public function test_scores_out_of_range_from_gemini_are_clamped(): void
    {
        config(['services.gemini.api_key' => 'test-key']);
        $this->fakeGeminiScore([
            'overall_score' => 500,
            'clarity_score' => -10,
            'fluency_score' => 70,
            'accuracy_score' => 70,
            'feedback' => 'Good effort overall.',
            'improvement_tips' => [],
        ]);

        Sanctum::actingAs($this->studentUser());
        $prompt = $this->prompt();

        $response = $this->postJson("/api/learning-centre/speaking/prompts/{$prompt->id}/attempts", [
            'transcript_text' => 'The quick brown fox jumps over the lazy dog.',
            'duration_seconds' => 5,
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('attempt.overall_score', 100)
            ->assertJsonPath('attempt.clarity_score', 0);
    }

    public function test_second_attempt_increments_attempt_number(): void
    {
        config(['services.gemini.api_key' => 'test-key']);
        $this->fakeGeminiScore([
            'overall_score' => 70, 'clarity_score' => 70, 'fluency_score' => 70, 'accuracy_score' => 70,
            'feedback' => 'Solid attempt.', 'improvement_tips' => [],
        ]);

        Sanctum::actingAs($this->studentUser());
        $prompt = $this->prompt();

        $this->postJson("/api/learning-centre/speaking/prompts/{$prompt->id}/attempts", [
            'transcript_text' => 'First try.', 'duration_seconds' => 3,
        ]);
        $response = $this->postJson("/api/learning-centre/speaking/prompts/{$prompt->id}/attempts", [
            'transcript_text' => 'Second try.', 'duration_seconds' => 3,
        ]);

        $response->assertJsonPath('attempt.attempt_number', 2);
        $this->assertSame(2, SpeakingAttempt::count());
    }
}
