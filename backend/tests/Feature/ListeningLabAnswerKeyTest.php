<?php

namespace Tests\Feature;

use App\Models\ListeningAttempt;
use App\Models\ListeningLesson;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Covers ListeningLabController — specifically that the answer key
 * (correct_index/explanation) is never sent to the client before they've
 * answered (show()), and that grading always trusts the server-held lesson
 * row rather than anything the client submits (submit()). No Gemini
 * involved — grading is deterministic.
 */
class ListeningLabAnswerKeyTest extends TestCase
{
    use RefreshDatabase;

    private function studentUser(): User
    {
        return User::factory()->create(['role' => User::ROLE_USER]);
    }

    private function lesson(): ListeningLesson
    {
        return ListeningLesson::create([
            'title' => 'Test Lesson',
            'passage_text' => 'This is a short test passage about a library.',
            'category' => 'Campus Life',
            'difficulty' => ListeningLesson::DIFFICULTY_BEGINNER,
            'questions' => [
                ['question' => 'What is the passage about?', 'options' => ['A library', 'A park', 'A restaurant', 'A gym'], 'correct_index' => 0, 'explanation' => 'It is about a library.'],
                ['question' => 'Is the passage short or long?', 'options' => ['Long', 'Short', 'Medium', 'Unclear'], 'correct_index' => 1, 'explanation' => 'It is described as short.'],
            ],
            'is_active' => true,
        ]);
    }

    public function test_show_never_leaks_the_answer_key(): void
    {
        Sanctum::actingAs($this->studentUser());
        $lesson = $this->lesson();

        $response = $this->getJson("/api/learning-centre/listening/lessons/{$lesson->id}");

        $response->assertStatus(200);
        $body = $response->json();

        $this->assertArrayNotHasKey('correct_index', $body['lesson']['questions'][0]);
        $this->assertArrayNotHasKey('explanation', $body['lesson']['questions'][0]);
        $this->assertSame(['question', 'options'], array_keys($body['lesson']['questions'][0]));
    }

    public function test_submit_grades_against_the_real_answer_key_not_client_input(): void
    {
        Sanctum::actingAs($this->studentUser());
        $lesson = $this->lesson();

        // Both correct (0 and 1).
        $response = $this->postJson("/api/learning-centre/listening/lessons/{$lesson->id}/attempts", [
            'answers' => [0, 1],
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('attempt.score', 100)
            ->assertJsonPath('attempt.passed', true);

        $this->assertDatabaseHas('listening_attempts', [
            'listening_lesson_id' => $lesson->id,
            'score' => 100,
        ]);
    }

    public function test_submit_with_one_wrong_answer_scores_partial_and_reveals_explanations(): void
    {
        Sanctum::actingAs($this->studentUser());
        $lesson = $this->lesson();

        $response = $this->postJson("/api/learning-centre/listening/lessons/{$lesson->id}/attempts", [
            'answers' => [0, 0], // second one wrong (correct is 1)
        ]);

        $response->assertStatus(200)->assertJsonPath('attempt.score', 50);
        $this->assertFalse($response->json('results.1.is_correct'));
        $this->assertSame('It is described as short.', $response->json('results.1.explanation'));
    }

    public function test_submit_rejects_wrong_answer_count(): void
    {
        Sanctum::actingAs($this->studentUser());
        $lesson = $this->lesson();

        $response = $this->postJson("/api/learning-centre/listening/lessons/{$lesson->id}/attempts", [
            'answers' => [0],
        ]);

        $response->assertStatus(422);
        $this->assertSame(0, ListeningAttempt::count());
    }
}
