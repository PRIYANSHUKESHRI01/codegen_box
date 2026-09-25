<?php

namespace Tests\Feature;

use App\Models\Interview;
use App\Models\InterviewQuestion;
use App\Models\InterviewQuestionBank;
use App\Models\InterviewRoleTemplate;
use App\Models\InterviewSession;
use App\Models\InterviewTrack;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Covers the instant-AI-scoring flow end to end: ScoreInterviewSessionJob
 * (dispatched synchronously here — phpunit.xml sets QUEUE_CONNECTION=sync)
 * dispatched from InterviewController::answer(), GeminiInterviewScoringService's
 * sanitization, InterviewController::result()'s polling contract, track
 * auto-advancement, and the human-override path.
 */
class InterviewAiScoringTest extends TestCase
{
    use RefreshDatabase;

    private function standaloneInterview(int $questionCount = 2): Interview
    {
        $interview = Interview::create([
            'title' => 'General Screening',
            'slug' => Interview::uniqueSlug('General Screening'),
            'status' => Interview::STATUS_PUBLISHED,
            'interview_type' => Interview::INTERVIEW_TYPE_GENERAL,
        ]);

        for ($i = 0; $i < $questionCount; $i++) {
            $bank = InterviewQuestionBank::create([
                'question_text' => "Question {$i}",
                'category' => 'technical',
                'difficulty' => 'medium',
                'expected_duration_seconds' => 120,
                'tags' => [],
                'is_active' => true,
            ]);

            InterviewQuestion::create([
                'interview_id' => $interview->id,
                'interview_question_bank_id' => $bank->id,
                'display_order' => $i,
            ]);
        }

        return $interview;
    }

    private function completeInterview(User $candidate, Interview $interview, array $transcripts): void
    {
        Sanctum::actingAs($candidate);
        $this->postJson("/api/interviews/{$interview->slug}/start")->assertStatus(200);

        $questions = $interview->interviewQuestions()->orderBy('display_order')->get();
        foreach ($questions as $i => $question) {
            $this->postJson("/api/interviews/{$interview->slug}/answer", [
                'interview_question_id' => $question->id,
                'transcript_text' => $transcripts[$i],
            ])->assertStatus(200);
        }
    }

    public function test_completing_a_standalone_interview_scores_it_and_the_result_endpoint_reflects_it(): void
    {
        config(['services.gemini.api_key' => 'test-key']);
        $interview = $this->standaloneInterview(2);
        $questions = $interview->interviewQuestions()->orderBy('display_order')->get();
        $candidate = User::factory()->create(['role' => User::ROLE_USER]);

        // Complete the first question, then fake Gemini using the REAL
        // response ids the answer() calls create — the job dispatches (and
        // runs synchronously, phpunit.xml sets QUEUE_CONNECTION=sync) the
        // moment the second/last answer completes the session, so the fake
        // must be armed before that final call, keyed on ids we can only
        // know once both responses exist.
        Sanctum::actingAs($candidate);
        $this->postJson("/api/interviews/{$interview->slug}/start")->assertStatus(200);
        $this->postJson("/api/interviews/{$interview->slug}/answer", [
            'interview_question_id' => $questions[0]->id,
            'transcript_text' => 'My first answer.',
        ])->assertStatus(200);

        Http::fake([
            'generativelanguage.googleapis.com/*' => function () use ($questions) {
                $ids = \App\Models\InterviewResponse::whereIn('interview_question_id', $questions->pluck('id'))->pluck('id')->all();

                return Http::response([
                    'candidates' => [
                        ['content' => ['parts' => [['text' => json_encode([
                            ['response_id' => $ids[0], 'score' => 80, 'feedback' => 'Solid answer.'],
                            ['response_id' => $ids[1], 'score' => 60, 'feedback' => 'Could be more specific.'],
                        ])]]]],
                    ],
                ], 200);
            },
        ]);

        $this->postJson("/api/interviews/{$interview->slug}/answer", [
            'interview_question_id' => $questions[1]->id,
            'transcript_text' => 'My second answer.',
        ])->assertStatus(200);

        $result = $this->getJson("/api/interviews/{$interview->slug}/result");
        $result->assertStatus(200);
        $this->assertSame('scored', $result->json('status'));
        $this->assertSame(70.0, (float) $result->json('composite_score_percent')); // avg(80, 60)
        $this->assertNull($result->json('passed'), 'a standalone interview has no pass/fail concept');
        $this->assertCount(2, $result->json('responses'));
        $this->assertSame('Solid answer.', $result->json('responses.0.feedback'));
    }

    public function test_gemini_failure_leaves_the_session_needing_human_review(): void
    {
        config(['services.gemini.api_key' => 'test-key']);
        Http::fake(['generativelanguage.googleapis.com/*' => Http::response([], 500)]);

        $interview = $this->standaloneInterview(1);
        $candidate = User::factory()->create(['role' => User::ROLE_USER]);
        $this->completeInterview($candidate, $interview, ['An answer.']);

        $result = $this->getJson("/api/interviews/{$interview->slug}/result");
        $result->assertStatus(200);
        $this->assertSame('needs_human_review', $result->json('status'));
        $this->assertNull($result->json('composite_score_percent'));

        $session = InterviewSession::where('interview_id', $interview->id)->firstOrFail();
        $this->assertNotNull($session->scoring_failed_at);
    }

    public function test_missing_api_key_also_falls_back_to_needs_human_review(): void
    {
        config(['services.gemini.api_key' => null]);

        $interview = $this->standaloneInterview(1);
        $candidate = User::factory()->create(['role' => User::ROLE_USER]);
        $this->completeInterview($candidate, $interview, ['An answer.']);

        $result = $this->getJson("/api/interviews/{$interview->slug}/result");
        $this->assertSame('needs_human_review', $result->json('status'));
    }

    public function test_ai_scoring_auto_advances_a_track_round_with_no_human_involved(): void
    {
        config(['services.gemini.api_key' => 'test-key']);

        $ops = User::factory()->create(['role' => User::ROLE_ADMIN_INTERNAL, 'permissions' => [User::PERM_INTERVIEWS]]);
        $template = InterviewRoleTemplate::create([
            'name' => 'Backend Developer',
            'rounds_config' => [
                ['round_number' => 1, 'round_name' => 'Screening', 'question_count' => 2, 'difficulty' => 'medium', 'category_weights' => ['technical' => 100], 'qualifying_score_percent' => 60],
                ['round_number' => 2, 'round_name' => 'Deep Technical', 'question_count' => 2, 'difficulty' => 'hard', 'category_weights' => ['technical' => 100], 'qualifying_score_percent' => 65],
                ['round_number' => 3, 'round_name' => 'Final / HR', 'question_count' => 2, 'difficulty' => 'medium', 'category_weights' => ['hr' => 100], 'qualifying_score_percent' => 60],
            ],
        ]);

        Sanctum::actingAs($ops);
        $trackId = $this->postJson('/api/admin/interview-tracks', [
            'title' => 'Backend Dev Track',
            'interview_role_template_id' => $template->id,
        ])->json('track.id');
        $track = InterviewTrack::with('rounds')->findOrFail($trackId);
        $this->postJson("/api/admin/interview-tracks/{$track->slug}", ['status' => 'published'])->assertStatus(200);

        $round1 = $track->rounds()->where('round_number', 1)->firstOrFail();
        $bank1 = InterviewQuestionBank::create(['question_text' => 'Q1', 'category' => 'technical', 'difficulty' => 'medium', 'expected_duration_seconds' => 120, 'tags' => [], 'is_active' => true]);
        $bank2 = InterviewQuestionBank::create(['question_text' => 'Q2', 'category' => 'technical', 'difficulty' => 'medium', 'expected_duration_seconds' => 120, 'tags' => [], 'is_active' => true]);
        InterviewQuestion::create(['interview_id' => $round1->id, 'interview_question_bank_id' => $bank1->id, 'display_order' => 0]);
        InterviewQuestion::create(['interview_id' => $round1->id, 'interview_question_bank_id' => $bank2->id, 'display_order' => 1]);

        $candidate = User::factory()->create(['role' => User::ROLE_USER]);

        Sanctum::actingAs($candidate);
        $this->postJson("/api/interviews/{$round1->slug}/start")->assertStatus(200);
        $questions = $round1->interviewQuestions()->orderBy('display_order')->get();

        $this->postJson("/api/interviews/{$round1->slug}/answer", [
            'interview_question_id' => $questions[0]->id,
            'transcript_text' => 'Answer one.',
        ])->assertStatus(200);

        Http::fake([
            'generativelanguage.googleapis.com/*' => function () use ($questions) {
                $ids = \App\Models\InterviewResponse::whereIn('interview_question_id', $questions->pluck('id'))->pluck('id')->all();

                return Http::response([
                    'candidates' => [
                        ['content' => ['parts' => [['text' => json_encode([
                            ['response_id' => $ids[0], 'score' => 90, 'feedback' => 'Great.'],
                            ['response_id' => $ids[1], 'score' => 85, 'feedback' => 'Great too.'],
                        ])]]]],
                    ],
                ], 200);
            },
        ]);

        $this->postJson("/api/interviews/{$round1->slug}/answer", [
            'interview_question_id' => $questions[1]->id,
            'transcript_text' => 'Answer two.',
        ])->assertStatus(200);

        $round2 = $track->rounds()->where('round_number', 2)->firstOrFail();
        $this->assertDatabaseHas('interview_sessions', [
            'interview_id' => $round2->id,
            'user_id' => $candidate->id,
            'status' => InterviewSession::STATUS_INVITED,
        ]);

        $session = InterviewSession::where('interview_id', $round1->id)->where('user_id', $candidate->id)->firstOrFail();
        $this->assertNotNull($session->ai_scored_at);
        $this->assertNull($session->reviewed_at, 'no human was involved in this advancement');
        $this->assertSame(87.5, (float) $session->composite_score_percent);
        $this->assertTrue($session->advanced);
    }

    public function test_a_human_can_override_an_ai_score(): void
    {
        config(['services.gemini.api_key' => 'test-key']);
        $interview = $this->standaloneInterview(1);
        $question = $interview->interviewQuestions()->firstOrFail();
        $candidate = User::factory()->create(['role' => User::ROLE_USER]);

        Sanctum::actingAs($candidate);
        $this->postJson("/api/interviews/{$interview->slug}/start")->assertStatus(200);

        Http::fake([
            'generativelanguage.googleapis.com/*' => function () use ($question) {
                $id = \App\Models\InterviewResponse::where('interview_question_id', $question->id)->value('id');

                return Http::response([
                    'candidates' => [['content' => ['parts' => [['text' => json_encode([
                        ['response_id' => $id, 'score' => 40, 'feedback' => 'Weak answer.'],
                    ])]]]]],
                ], 200);
            },
        ]);

        $this->postJson("/api/interviews/{$interview->slug}/answer", [
            'interview_question_id' => $question->id,
            'transcript_text' => 'An answer.',
        ])->assertStatus(200);

        $response = \App\Models\InterviewResponse::where('interview_question_id', $question->id)->firstOrFail();
        $this->assertTrue($response->ai_scored);
        $this->assertSame(40, $response->score);

        $ops = User::factory()->create(['role' => User::ROLE_ADMIN_INTERNAL, 'permissions' => [User::PERM_INTERVIEWS]]);
        Sanctum::actingAs($ops);
        $this->postJson("/api/admin/interviews/{$interview->slug}/responses/{$response->id}/score", [
            'score' => 95,
            'review_notes' => 'Actually a great answer, the transcript was mis-scored.',
        ])->assertStatus(200);

        $response->refresh();
        $this->assertFalse($response->ai_scored);
        $this->assertSame(95, $response->score);
        $this->assertSame($ops->id, $response->scored_by);
    }
}
