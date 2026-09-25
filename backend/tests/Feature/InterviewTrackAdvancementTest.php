<?php

namespace Tests\Feature;

use App\Models\Interview;
use App\Models\InterviewQuestion;
use App\Models\InterviewQuestionBank;
use App\Models\InterviewResponse;
use App\Models\InterviewRoleTemplate;
use App\Models\InterviewSession;
use App\Models\InterviewTrack;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Covers InterviewTrackAdvancementService via the actual
 * scoreResponse/finalizeSession HTTP endpoints on AdminInterviewController —
 * the core "does scoring correctly gate advancement" contract.
 */
class InterviewTrackAdvancementTest extends TestCase
{
    use RefreshDatabase;

    private User $ops;

    private InterviewTrack $track;

    protected function setUp(): void
    {
        parent::setUp();

        $this->ops = User::factory()->create(['role' => User::ROLE_ADMIN_INTERNAL, 'permissions' => [User::PERM_INTERVIEWS]]);

        $template = InterviewRoleTemplate::create([
            'name' => 'Backend Developer',
            'rounds_config' => [
                ['round_number' => 1, 'round_name' => 'Screening', 'question_count' => 3, 'difficulty' => 'medium', 'category_weights' => ['technical' => 70, 'behavioral' => 30], 'qualifying_score_percent' => 75],
                ['round_number' => 2, 'round_name' => 'Deep Technical', 'question_count' => 2, 'difficulty' => 'hard', 'category_weights' => ['technical' => 100], 'qualifying_score_percent' => 65],
                ['round_number' => 3, 'round_name' => 'Final / HR', 'question_count' => 2, 'difficulty' => 'medium', 'category_weights' => ['hr' => 100], 'qualifying_score_percent' => 60],
            ],
        ]);

        Sanctum::actingAs($this->ops);
        $trackId = $this->postJson('/api/admin/interview-tracks', [
            'title' => 'Backend Dev Track',
            'interview_role_template_id' => $template->id,
        ])->json('track.id');

        $this->track = InterviewTrack::with('rounds')->findOrFail($trackId);
        $this->postJson("/api/admin/interview-tracks/{$this->track->slug}", ['status' => 'published'])->assertStatus(200);
        $this->track->refresh()->load('rounds');
    }

    private function round(int $number): Interview
    {
        return $this->track->rounds()->where('round_number', $number)->firstOrFail();
    }

    private function attachQuestion(Interview $round, string $category, int $order): InterviewQuestion
    {
        $bank = InterviewQuestionBank::create([
            'question_text' => "Question {$order}",
            'category' => $category,
            'difficulty' => 'medium',
            'expected_duration_seconds' => 120,
            'tags' => [],
            'is_active' => true,
        ]);

        return InterviewQuestion::create([
            'interview_id' => $round->id,
            'interview_question_bank_id' => $bank->id,
            'display_order' => $order,
        ]);
    }

    private function completedSession(Interview $round, User $candidate, array $questions): InterviewSession
    {
        $session = InterviewSession::create([
            'interview_id' => $round->id,
            'user_id' => $candidate->id,
            'status' => InterviewSession::STATUS_COMPLETED,
            'started_at' => now(),
            'completed_at' => now(),
            'current_question_order' => count($questions),
        ]);

        foreach ($questions as $question) {
            InterviewResponse::create([
                'interview_session_id' => $session->id,
                'interview_question_id' => $question->id,
                'transcript_text' => 'a spoken answer',
                'answered_at' => now(),
            ]);
        }

        return $session;
    }

    public function test_finalize_requires_every_response_scored(): void
    {
        $round1 = $this->round(1);
        $q1 = $this->attachQuestion($round1, 'technical', 0);
        $q2 = $this->attachQuestion($round1, 'behavioral', 1);
        $candidate = User::factory()->create(['role' => User::ROLE_USER]);
        $session = $this->completedSession($round1, $candidate, [$q1, $q2]);

        Sanctum::actingAs($this->ops);
        $this->postJson("/api/admin/interviews/{$round1->slug}/responses/{$session->responses->first()->id}/score", ['score' => 80]);

        $response = $this->postJson("/api/admin/interviews/{$round1->slug}/sessions/{$session->id}/finalize");
        $response->assertStatus(422);
    }

    public function test_weighted_composite_math_and_pass_unlocks_next_round(): void
    {
        $round1 = $this->round(1);
        // technical: 2 questions scored 80, 100 -> avg 90, weight 70 -> 63
        // behavioral: 1 question scored 50 -> weight 30 -> 15
        // composite = 78, threshold 75 -> passes
        $tech1 = $this->attachQuestion($round1, 'technical', 0);
        $tech2 = $this->attachQuestion($round1, 'technical', 1);
        $behavioral = $this->attachQuestion($round1, 'behavioral', 2);
        $candidate = User::factory()->create(['role' => User::ROLE_USER]);
        $session = $this->completedSession($round1, $candidate, [$tech1, $tech2, $behavioral]);

        Sanctum::actingAs($this->ops);
        foreach ($session->responses as $response) {
            $score = match ($response->interview_question_id) {
                $tech1->id => 80,
                $tech2->id => 100,
                $behavioral->id => 50,
            };
            $this->postJson("/api/admin/interviews/{$round1->slug}/responses/{$response->id}/score", ['score' => $score])
                ->assertStatus(200);
        }

        $result = $this->postJson("/api/admin/interviews/{$round1->slug}/sessions/{$session->id}/finalize");
        $result->assertStatus(200);
        $this->assertSame(78.0, (float) $result->json('composite_score_percent'));
        $this->assertTrue($result->json('passed'));
        $this->assertTrue($result->json('advanced'));

        $round2 = $this->round(2);
        $this->assertDatabaseHas('interview_sessions', [
            'interview_id' => $round2->id,
            'user_id' => $candidate->id,
            'status' => InterviewSession::STATUS_INVITED,
        ]);

        Sanctum::actingAs($candidate);
        $this->getJson("/api/interviews/{$round2->slug}")->assertStatus(200);
    }

    public function test_missing_category_responses_are_renormalized_and_flagged_partial(): void
    {
        $round1 = $this->round(1);
        // Only technical questions attached (no behavioral one at all) —
        // the 30% behavioral weight has nothing to average, so it's
        // excluded and the composite is 100% driven by technical.
        $tech1 = $this->attachQuestion($round1, 'technical', 0);
        $tech2 = $this->attachQuestion($round1, 'technical', 1);
        $candidate = User::factory()->create(['role' => User::ROLE_USER]);
        $session = $this->completedSession($round1, $candidate, [$tech1, $tech2]);

        Sanctum::actingAs($this->ops);
        foreach ($session->responses as $response) {
            $this->postJson("/api/admin/interviews/{$round1->slug}/responses/{$response->id}/score", ['score' => 90])->assertStatus(200);
        }

        $result = $this->postJson("/api/admin/interviews/{$round1->slug}/sessions/{$session->id}/finalize");
        $result->assertStatus(200);
        $this->assertSame(90.0, (float) $result->json('composite_score_percent'));
        $this->assertTrue($result->json('partial_composite'));
    }

    public function test_below_threshold_does_not_advance(): void
    {
        $round1 = $this->round(1);
        $tech = $this->attachQuestion($round1, 'technical', 0);
        $behavioral = $this->attachQuestion($round1, 'behavioral', 1);
        $candidate = User::factory()->create(['role' => User::ROLE_USER]);
        $session = $this->completedSession($round1, $candidate, [$tech, $behavioral]);

        Sanctum::actingAs($this->ops);
        foreach ($session->responses as $response) {
            $this->postJson("/api/admin/interviews/{$round1->slug}/responses/{$response->id}/score", ['score' => 30])->assertStatus(200);
        }

        $result = $this->postJson("/api/admin/interviews/{$round1->slug}/sessions/{$session->id}/finalize");
        $result->assertStatus(200);
        $this->assertFalse($result->json('passed'));
        $this->assertFalse($result->json('advanced'));

        $round2 = $this->round(2);
        $this->assertDatabaseMissing('interview_sessions', ['interview_id' => $round2->id, 'user_id' => $candidate->id]);

        Sanctum::actingAs($candidate);
        $this->getJson("/api/interviews/{$round2->slug}")->assertStatus(404);
    }

    public function test_finalize_is_idempotent(): void
    {
        $round1 = $this->round(1);
        $tech = $this->attachQuestion($round1, 'technical', 0);
        $behavioral = $this->attachQuestion($round1, 'behavioral', 1);
        $candidate = User::factory()->create(['role' => User::ROLE_USER]);
        $session = $this->completedSession($round1, $candidate, [$tech, $behavioral]);

        Sanctum::actingAs($this->ops);
        foreach ($session->responses as $response) {
            $this->postJson("/api/admin/interviews/{$round1->slug}/responses/{$response->id}/score", ['score' => 90])->assertStatus(200);
        }

        $this->postJson("/api/admin/interviews/{$round1->slug}/sessions/{$session->id}/finalize")->assertStatus(200);
        $second = $this->postJson("/api/admin/interviews/{$round1->slug}/sessions/{$session->id}/finalize");
        $second->assertStatus(200);
        $this->assertTrue($second->json('already_finalized'));

        $round2 = $this->round(2);
        $this->assertSame(1, InterviewSession::where('interview_id', $round2->id)->where('user_id', $candidate->id)->count());
    }

    public function test_round_three_pass_creates_no_round_four(): void
    {
        $round3 = $this->round(3);
        $hr1 = $this->attachQuestion($round3, 'hr', 0);
        $hr2 = $this->attachQuestion($round3, 'hr', 1);
        $candidate = User::factory()->create(['role' => User::ROLE_USER]);
        $session = $this->completedSession($round3, $candidate, [$hr1, $hr2]);

        Sanctum::actingAs($this->ops);
        foreach ($session->responses as $response) {
            $this->postJson("/api/admin/interviews/{$round3->slug}/responses/{$response->id}/score", ['score' => 90])->assertStatus(200);
        }

        $result = $this->postJson("/api/admin/interviews/{$round3->slug}/sessions/{$session->id}/finalize");
        $result->assertStatus(200);
        $this->assertTrue($result->json('passed'));
        $this->assertFalse($result->json('advanced'), 'there is no round 4 to advance into');
    }

    public function test_student_cannot_score_or_finalize(): void
    {
        $round1 = $this->round(1);
        $q = $this->attachQuestion($round1, 'technical', 0);
        $candidate = User::factory()->create(['role' => User::ROLE_USER]);
        $session = $this->completedSession($round1, $candidate, [$q]);

        Sanctum::actingAs($candidate);
        $this->postJson("/api/admin/interviews/{$round1->slug}/responses/{$session->responses->first()->id}/score", ['score' => 90])
            ->assertStatus(403);
        $this->postJson("/api/admin/interviews/{$round1->slug}/sessions/{$session->id}/finalize")
            ->assertStatus(403);
    }
}
