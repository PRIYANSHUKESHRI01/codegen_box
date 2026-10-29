<?php

namespace Tests\Feature;

use App\Models\Interview;
use App\Models\InterviewQuestion;
use App\Models\InterviewQuestionBank;
use App\Models\InterviewResponse;
use App\Models\InterviewSession;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * A student must see their score soon after finishing, on any machine. The queue in use is a database queue that only the once-a-minute
 * scheduler drains (measured: 23-83 s from "submit" to "score", and never where there is no scheduler), so scoring runs right after the
 * request that finished the interview, with a sweeper for the rare session it missed.
 */
class InterviewLiveScoringTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // The interviewer's voice shares the Gemini key and host; these tests are about scoring only.
        config(['services.gemini.api_key' => 'test-key', 'services.gemini.model' => 'gemini-test', 'interview_speech.enabled' => false]);
    }

    private function interview(int $questions): Interview
    {
        $interview = Interview::create([
            'title' => 'General Screening',
            'slug' => Interview::uniqueSlug('General Screening'),
            'status' => Interview::STATUS_PUBLISHED,
            'interview_type' => Interview::INTERVIEW_TYPE_GENERAL,
        ]);

        foreach (range(0, $questions - 1) as $i) {
            $bank = InterviewQuestionBank::create(['question_text' => "Question {$i}?", 'category' => 'technical', 'difficulty' => 'medium', 'expected_duration_seconds' => 120, 'tags' => [], 'is_active' => true]);
            InterviewQuestion::create(['interview_id' => $interview->id, 'interview_question_bank_id' => $bank->id, 'display_order' => $i]);
        }

        return $interview;
    }

    /** The body Gemini sends back: a score for each of these responses. */
    private function scoresBody(array $responseIds, int $score): array
    {
        return ['candidates' => [['content' => ['parts' => [['text' => json_encode(array_map(fn ($id) => ['response_id' => $id, 'score' => $score, 'feedback' => 'Good.'], $responseIds))]]]]]];
    }

    /** Gemini answering the scoring prompt: every response in the session, scored (read at the moment of the call, when they all exist). */
    private function geminiScores(int $score = 80)
    {
        return fn () => Http::response($this->scoresBody(InterviewResponse::pluck('id')->all(), $score), 200);
    }

    private function finish(User $student, Interview $interview): void
    {
        Sanctum::actingAs($student);
        $this->postJson("/api/interviews/{$interview->slug}/start")->assertOk();
        foreach ($interview->interviewQuestions()->orderBy('display_order')->get() as $question) {
            $this->postJson("/api/interviews/{$interview->slug}/answer", ['interview_question_id' => $question->id, 'transcript_text' => 'A fair answer.'])->assertOk();
        }
    }

    private function completedSession(User $student, Interview $interview, array $over = []): InterviewSession
    {
        $session = InterviewSession::create($over + [
            'interview_id' => $interview->id, 'user_id' => $student->id, 'status' => InterviewSession::STATUS_COMPLETED,
            'started_at' => now()->subMinutes(20), 'completed_at' => now()->subMinutes(10), 'current_question_order' => 1,
        ]);

        foreach ($interview->interviewQuestions as $q) {
            InterviewResponse::create(['interview_session_id' => $session->id, 'interview_question_id' => $q->id, 'transcript_text' => 'An answer.', 'answered_at' => now()->subMinutes(10)]);
        }

        return $session->fresh();
    }

    // ───────────────────────────── scoring runs now, not on the queue ─────────────────────────────

    public function test_finishing_an_interview_scores_it_straight_away_without_a_queue_worker(): void
    {
        // The real configuration: a database queue, and no worker. Anything that went on that queue would just sit there.
        config(['queue.default' => 'database']);
        Http::fake(['generativelanguage.googleapis.com/*' => $this->geminiScores(85)]);
        $interview = $this->interview(2);
        $student = User::factory()->create(['role' => User::ROLE_USER]);

        $this->finish($student, $interview);

        $this->assertSame(0, DB::table('jobs')->count(), 'scoring must not wait on the queue');
        $result = $this->getJson("/api/interviews/{$interview->slug}/result")->assertOk();
        $this->assertSame('scored', $result->json('status'));
        $this->assertSame(85.0, (float) $result->json('composite_score_percent'));
        $this->assertSame('Good.', $result->json('responses.0.feedback'));
    }

    public function test_the_whole_session_is_scored_in_one_gemini_call(): void
    {
        Http::fake(['generativelanguage.googleapis.com/*' => $this->geminiScores()]);
        $interview = $this->interview(4);

        $this->finish(User::factory()->create(['role' => User::ROLE_USER]), $interview);

        Http::assertSentCount(1);
    }

    // ───────────────────────────── a momentary Gemini failure should not cost the student a score ─────────────────────────────

    public function test_a_gemini_hiccup_is_retried_once_and_the_student_still_gets_a_score(): void
    {
        // A one-question interview: its response is the first one in this fresh database.
        Http::fake(['generativelanguage.googleapis.com/*' => Http::sequence()
            ->push(['error' => ['message' => 'The model is overloaded']], 503)
            ->push($this->scoresBody([1], 70), 200)]);
        $interview = $this->interview(1);

        $this->finish(User::factory()->create(['role' => User::ROLE_USER]), $interview);

        Http::assertSentCount(2);
        $this->assertSame('scored', $this->getJson("/api/interviews/{$interview->slug}/result")->json('status'));
    }

    public function test_a_rejected_request_is_not_retried_and_goes_to_a_human(): void
    {
        Http::fake(['generativelanguage.googleapis.com/*' => Http::response(['error' => ['message' => 'API key not valid']], 400)]);
        $interview = $this->interview(1);

        $this->finish(User::factory()->create(['role' => User::ROLE_USER]), $interview);

        Http::assertSentCount(1);
        $this->assertSame('needs_human_review', $this->getJson("/api/interviews/{$interview->slug}/result")->json('status'));
    }

    public function test_a_gemini_that_stays_down_gives_up_after_the_second_try(): void
    {
        Http::fake(['generativelanguage.googleapis.com/*' => Http::response([], 503)]);
        $interview = $this->interview(1);

        $this->finish(User::factory()->create(['role' => User::ROLE_USER]), $interview);

        Http::assertSentCount(2);
        $this->assertSame('needs_human_review', $this->getJson("/api/interviews/{$interview->slug}/result")->json('status'));
    }

    // ───────────────────────────── the safety net ─────────────────────────────

    public function test_the_sweeper_scores_a_finished_session_whose_scoring_never_happened(): void
    {
        Http::fake(['generativelanguage.googleapis.com/*' => $this->geminiScores(75)]);
        $interview = $this->interview(2);
        $student = User::factory()->create(['role' => User::ROLE_USER]);
        $session = $this->completedSession($student, $interview);

        $this->artisan('interview:score-pending')->assertSuccessful();

        $session = $session->fresh();
        $this->assertNotNull($session->ai_scored_at);
        $this->assertSame(75.0, (float) $session->composite_score_percent);
    }

    public function test_the_sweeper_leaves_alone_what_is_not_its_to_touch(): void
    {
        Http::fake(['generativelanguage.googleapis.com/*' => $this->geminiScores()]);
        $interview = $this->interview(1);
        $student = fn () => User::factory()->create(['role' => User::ROLE_USER]);

        $justFinished = $this->completedSession($student(), $interview, ['completed_at' => now()->subSeconds(20)]); // still being scored right now
        $failed = $this->completedSession($student(), $interview, ['scoring_failed_at' => now()->subMinutes(5)]); // a person's call
        $reviewed = $this->completedSession($student(), $interview, ['reviewed_at' => now()->subMinutes(5)]);
        $ancient = $this->completedSession($student(), $interview, ['completed_at' => now()->subDays(3)]);
        $running = InterviewSession::create(['interview_id' => $interview->id, 'user_id' => $student()->id, 'status' => InterviewSession::STATUS_IN_PROGRESS, 'started_at' => now()->subMinutes(30), 'current_question_order' => 0]);

        $this->artisan('interview:score-pending')->assertSuccessful();

        Http::assertNothingSent();
        foreach ([$justFinished, $failed, $reviewed, $ancient, $running] as $session) {
            $this->assertNull($session->fresh()->ai_scored_at);
        }
    }

    public function test_the_sweeper_is_on_the_schedule_every_minute(): void
    {
        $this->artisan('schedule:list')->expectsOutputToContain('interview:score-pending')->assertSuccessful();
    }
}
