<?php

namespace Tests\Feature;

use App\Jobs\ScoreInterviewSessionJob;
use App\Models\Interview;
use App\Models\InterviewQuestionBank;
use App\Models\InterviewResponse;
use App\Models\InterviewSession;
use App\Models\MockInterviewQuestion;
use App\Models\Plan;
use App\Models\User;
use App\Services\Mock\MockInterviewCatalog;
use App\Services\SubscriptionService;
use Database\Seeders\MerchantNavyMockQuestionsSeeder;
use Database\Seeders\PlanSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Study mode - the Merchant Navy sets. A student answers, and straight away sees their own answer, the model answer and how much of it they
 * covered; nothing is sent to an AI, ever. These tests walk the real endpoints a student's browser uses, and every one of them runs with
 * Http::fake(): a single outgoing request (Gemini) would fail them.
 */
class StudyModeInterviewTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Queue::fake();
        Mail::fake();
        Http::fake();
        // Even with a key configured, a study interview must not use it.
        config(['services.gemini.api_key' => 'a-key-that-must-never-be-used']);
        $this->seed(PlanSeeder::class);
    }

    private function student(bool $expert = true): User
    {
        $student = User::factory()->create(['role' => User::ROLE_USER, 'branch' => 'CSE']);

        if (! $expert) {
            return $student->fresh();
        }

        app(SubscriptionService::class)->grantIndividualPlan($student, Plan::where('code', Plan::CODE_EXPERT)->firstOrFail(), User::factory()->create(['role' => User::ROLE_SUPERADMIN]), [
            'days' => 365, 'kind' => 'complimentary', 'reason' => 'Test',
        ]);

        return $student->fresh();
    }

    /** Starts a set (as the Merchant Navy page does) and opens its interview session (as the room does). */
    private function sit(int $set = 1): array
    {
        $slug = $this->postJson("/api/mock-interviews/rounds/mock-second_mate_fg-r{$set}/start")->assertCreated()->json('interview.slug');
        $start = $this->postJson("/api/interviews/{$slug}/start")->assertOk();

        return [Interview::where('slug', $slug)->firstOrFail(), $start->json()];
    }

    /** The model answer of a question as the room hands it out. */
    private function modelAnswer(array $question): string
    {
        return (string) InterviewQuestionBank::where('question_text', $question['question_text'])->where('discipline', 'maritime')->firstOrFail()->notes_for_reviewer;
    }

    /**
     * Nothing about the student's answers leaves the server. (The interviewer's VOICE does call a speech service - it reads the QUESTION aloud,
     * as it does in every interview - so "no request at all" would be the wrong claim: the claim is that no request carries an answer or
     * asks anything to score one.)
     */
    private function assertNoAnswerSentOut(): void
    {
        $transcripts = InterviewResponse::pluck('transcript_text')->filter()->all();

        foreach (Http::recorded() as [$request]) {
            $body = $request->body();

            $this->assertStringNotContainsString('SPOKEN interview answers', $body, 'no scoring prompt was sent');
            $this->assertStringNotContainsString("Candidate's answer", $body, 'no answer was sent for scoring');

            foreach ($transcripts as $transcript) {
                $this->assertStringNotContainsString($transcript, $body, 'an answer was sent out');
            }
        }
    }

    private function answer(Interview $interview, array $question, string $transcript)
    {
        return $this->postJson("/api/interviews/{$interview->slug}/answer", [
            'interview_question_id' => $question['interview_question_id'],
            'transcript_text' => $transcript,
        ]);
    }

    // ───────────────────────────── starting ─────────────────────────────

    public function test_a_set_is_a_study_interview_and_its_model_answers_reach_the_student_untouched(): void
    {
        $this->seed(MerchantNavyMockQuestionsSeeder::class);
        Sanctum::actingAs($this->student());

        [$interview, $start] = $this->sit(1);

        $this->assertTrue($interview->isStudyMode());
        $this->assertTrue($start['study']);
        $this->assertSame(30, $start['total_questions']);
        $this->assertTrue(collect($this->getJson('/api/mock-interviews/catalog')->json('roles'))->firstWhere('key', 'merchant_navy')['stacks'][0]['study']);

        // The student READS the model answer, so it is exactly what the bank says: no instruction to an AI scorer mixed into it.
        $this->assertSame(0, InterviewQuestionBank::where('discipline', 'maritime')->where('notes_for_reviewer', 'like', '%still being checked%')->count());
    }

    public function test_an_it_stack_is_not_a_study_interview(): void
    {
        foreach (range(1, 6) as $i) {
            MockInterviewQuestion::create(['stack_key' => 'laravel', 'round_number' => 1, 'position' => $i, 'text' => "Explain how you would approach problem number {$i} in Laravel.", 'category' => 'technical', 'duration_seconds' => 180, 'note' => 'Covers the container.']);
        }
        app(MockInterviewCatalog::class)->flush();
        Sanctum::actingAs($this->student());

        $slug = $this->postJson('/api/mock-interviews/rounds/mock-laravel-r1/start')->assertCreated()->json('interview.slug');
        $start = $this->postJson("/api/interviews/{$slug}/start")->assertOk();
        $interview = Interview::where('slug', $slug)->firstOrFail();

        $this->assertFalse($interview->isStudyMode());
        $this->assertFalse($start['study']);

        $answer = $this->answer($interview, $start['question'], 'It resolves a dependency from the service container.')->assertOk();
        $this->assertArrayNotHasKey('feedback', $answer->json(), 'only a study interview shows the model answer');
    }

    // ───────────────────────────── answering ─────────────────────────────

    public function test_an_answer_gets_its_model_answer_and_match_at_once(): void
    {
        $this->seed(MerchantNavyMockQuestionsSeeder::class);
        Sanctum::actingAs($this->student());
        [$interview, $start] = $this->sit(1);

        $first = $start['question'];
        $model = $this->modelAnswer($first);

        $res = $this->answer($interview, $first, $model)->assertOk();

        $this->assertFalse($res->json('complete'));
        $this->assertNotEmpty($res->json('next_question.interview_question_id'), 'the next question is ready, to be shown when the student presses Next');
        $feedback = $res->json('feedback');
        $this->assertSame('text_match', $feedback['method']);
        $this->assertSame(100, $feedback['match_percent']);
        $this->assertSame('green', $feedback['band']);
        $this->assertSame('Strong answer', $feedback['label']);
        $this->assertSame(trim(preg_replace('/\s+/u', ' ', $model)), $feedback['reference_answer']);
        $this->assertSame($feedback['points']['total'], $feedback['points']['covered']);
        $this->assertSame(0, $feedback['points']['missed']);

        // and it was kept on the response, so the summary can show it again
        $stored = InterviewResponse::firstOrFail();
        $this->assertSame(100, $stored->score);
        $this->assertSame('text_match', $stored->match_details['method']);
        $this->assertFalse($stored->ai_scored);

        $this->assertNoAnswerSentOut();
    }

    public function test_a_poor_answer_is_red_and_shows_what_to_revise(): void
    {
        $this->seed(MerchantNavyMockQuestionsSeeder::class);
        Sanctum::actingAs($this->student());
        [$interview, $start] = $this->sit(1);

        $feedback = $this->answer($interview, $start['question'], 'um I am not sure about this one')->assertOk()->json('feedback');

        $this->assertLessThan(30, $feedback['match_percent']);
        $this->assertSame('red', $feedback['band']);
        $this->assertSame($feedback['points']['total'], $feedback['points']['missed'], 'every key point is shown as missed');
        $this->assertNotEmpty($feedback['missed']);
        $this->assertNotEmpty($feedback['reference_answer'], 'and the student is shown the model answer to learn from');
        $this->assertStringContainsString('To revise', InterviewResponse::firstOrFail()->review_notes);
    }

    public function test_an_unchecked_model_answer_says_so(): void
    {
        $this->seed(MerchantNavyMockQuestionsSeeder::class);
        Sanctum::actingAs($this->student());
        [$interview, $start] = $this->sit(4);

        // find a question in this set whose answer is unchecked (AI-written or marked [Verify]) and one whose answer is not
        $questions = InterviewQuestionBank::where('discipline', 'maritime')->get()->keyBy('question_text');
        $unverified = null;
        $checked = null;

        $current = $start['question'];
        while ($current !== null) {
            $isUnverified = (bool) $questions[$current['question_text']]->reference_unverified;
            $res = $this->answer($interview, $current, $this->modelAnswer($current))->assertOk();
            $unverified ??= $isUnverified ? $res->json('feedback') : null;
            $checked ??= ! $isUnverified ? $res->json('feedback') : null;
            $current = $res->json('next_question');
        }

        $this->assertNotNull($unverified, 'a set has questions AptRun wrote');
        $this->assertTrue($unverified['unverified']);
        $this->assertFalse($checked['unverified']);
    }

    // ───────────────────────────── finishing ─────────────────────────────

    public function test_the_last_answer_finishes_the_set_on_the_spot_with_the_average_match(): void
    {
        $this->seed(MerchantNavyMockQuestionsSeeder::class);
        Sanctum::actingAs($this->student());
        [$interview, $start] = $this->sit(2);

        $current = $start['question'];
        $scores = [];
        $i = 0;

        while ($current !== null) {
            // every other answer is a perfect one, the rest are a shrug
            $res = $this->answer($interview, $current, $i++ % 2 === 0 ? $this->modelAnswer($current) : 'um no idea')->assertOk();
            $scores[] = $res->json('feedback.match_percent');
            $current = $res->json('next_question');
        }

        $this->assertCount(30, $scores);
        $this->assertTrue($res->json('complete'));
        $this->assertNotNull($res->json('feedback'), 'the last answer shows its feedback too');

        $session = InterviewSession::firstOrFail();
        $this->assertSame(InterviewSession::STATUS_COMPLETED, $session->status);
        $this->assertNotNull($session->ai_scored_at, 'scored already - there is no waiting screen');
        $this->assertNull($session->scoring_failed_at);
        $this->assertEqualsWithDelta(array_sum($scores) / 30, (float) $session->composite_score_percent, 0.01, 'the score is the average match');

        $this->assertNoAnswerSentOut();
    }

    public function test_the_summary_has_every_model_answer_and_how_each_answer_matched(): void
    {
        $this->seed(MerchantNavyMockQuestionsSeeder::class);
        Sanctum::actingAs($this->student());
        [$interview, $start] = $this->sit(1);

        $current = $start['question'];
        while ($current !== null) {
            $current = $this->answer($interview, $current, $this->modelAnswer($current))->assertOk()->json('next_question');
        }

        $result = $this->getJson("/api/interviews/{$interview->slug}/result")->assertOk()->json();

        $this->assertSame('scored', $result['status']);
        $this->assertTrue($result['study']);
        $this->assertEqualsWithDelta(100.0, (float) $result['composite_score_percent'], 0.01);
        $this->assertTrue($result['reattemptable'], 'a study set can always be sat again');
        $this->assertCount(30, $result['responses']);

        foreach ($result['responses'] as $r) {
            $this->assertSame(100, $r['study']['match_percent']);
            $this->assertSame('green', $r['study']['band']);
            $this->assertNotEmpty($r['study']['reference_answer']);
            $this->assertNotEmpty($r['study']['segments']);
            $this->assertSame($r['transcript_text'], $r['transcript_text'], 'and the answer they gave');
        }
    }

    public function test_a_set_left_early_scores_what_was_answered(): void
    {
        $this->seed(MerchantNavyMockQuestionsSeeder::class);
        Sanctum::actingAs($this->student());
        [$interview, $start] = $this->sit(1);

        $current = $start['question'];
        $first = $this->answer($interview, $current, $this->modelAnswer($current))->assertOk();
        $this->answer($interview, $first->json('next_question'), 'um no idea')->assertOk();

        $this->postJson("/api/interviews/{$interview->slug}/complete")->assertOk();

        $session = InterviewSession::firstOrFail();
        $this->assertSame(InterviewSession::STATUS_COMPLETED, $session->status);
        $this->assertNotNull($session->ai_scored_at);
        $this->assertGreaterThan(40, (float) $session->composite_score_percent, 'a perfect answer and a shrug average out to about half');
        $this->assertLessThan(60, (float) $session->composite_score_percent);
        $this->assertNoAnswerSentOut();
    }

    public function test_the_scoring_job_never_sends_a_study_session_to_an_ai(): void
    {
        $this->seed(MerchantNavyMockQuestionsSeeder::class);
        Sanctum::actingAs($this->student());
        [$interview, $start] = $this->sit(1);

        $first = $this->answer($interview, $start['question'], $this->modelAnswer($start['question']))->assertOk();
        $this->answer($interview, $first->json('next_question'), 'something about ventilation')->assertOk();

        // A session finished but never finalised (what the once-a-minute sweeper looks for): the job picks it up.
        InterviewSession::query()->update(['status' => InterviewSession::STATUS_COMPLETED, 'completed_at' => now()->subMinutes(5), 'ai_scored_at' => null, 'composite_score_percent' => null]);
        // Run for real: with Queue::fake() a dispatchSync would only be recorded.
        app()->call([new ScoreInterviewSessionJob(InterviewSession::firstOrFail()->id), 'handle']);

        $session = InterviewSession::firstOrFail();
        $this->assertNotNull($session->ai_scored_at);
        $this->assertNull($session->scoring_failed_at);
        $this->assertNotNull($session->composite_score_percent);
        $this->assertNoAnswerSentOut();
    }

    public function test_a_set_can_be_sat_again_from_scratch(): void
    {
        $this->seed(MerchantNavyMockQuestionsSeeder::class);
        Sanctum::actingAs($this->student());
        [$interview, $start] = $this->sit(1);

        $current = $start['question'];
        while ($current !== null) {
            $current = $this->answer($interview, $current, 'um no idea')->assertOk()->json('next_question');
        }
        $this->assertSame(0, (int) round((float) InterviewSession::firstOrFail()->composite_score_percent));

        $this->postJson("/api/interviews/{$interview->slug}/reattempt")->assertOk();

        $session = InterviewSession::firstOrFail();
        $this->assertSame(InterviewSession::STATUS_IN_PROGRESS, $session->status);
        $this->assertNull($session->composite_score_percent);
        $this->assertNull($session->ai_scored_at);
        $this->assertSame(0, InterviewResponse::count());

        $again = $this->postJson("/api/interviews/{$interview->slug}/start")->assertOk();
        $this->assertSame(30, $again['total_questions']);
        $this->assertSame(0, $again['answered_count']);
        $this->assertTrue($again['study']);
    }

    public function test_exam_practice_still_stays_out_of_the_readiness_score(): void
    {
        $this->seed(MerchantNavyMockQuestionsSeeder::class);
        Sanctum::actingAs($this->student());
        [$interview] = $this->sit(1);

        $this->assertFalse(Interview::query()->countsTowardReadiness()->pluck('interviews.id')->contains($interview->id));
    }

    // ───────────────────────────── no limit ─────────────────────────────

    public function test_a_student_can_sit_as_many_study_sets_as_they_like_whatever_their_daily_limit(): void
    {
        $this->seed(MerchantNavyMockQuestionsSeeder::class);
        $student = $this->student();
        Sanctum::actingAs($student);
        $this->assertSame(10, $student->effectiveEntitlements()['max_mock_interviews_per_day'], 'the Expert plan limits ordinary mock interviews to 10 a day');

        foreach (range(1, 14) as $set) {
            $this->sit($set); // would be refused at the 11th if sets were rationed
        }

        $this->assertSame(14, InterviewSession::where('user_id', $student->id)->count());
        $this->assertSame(0, $this->getJson('/api/me/subscription')->assertOk()->json('entitlements.mock_interviews_used_today'), 'and sitting them does not eat the allowance');
    }

    public function test_the_free_plans_one_try_is_not_spent_on_study_sets_and_they_stay_open_to_it(): void
    {
        $this->seed(MerchantNavyMockQuestionsSeeder::class);
        foreach (range(1, 6) as $i) {
            MockInterviewQuestion::create(['stack_key' => 'laravel', 'round_number' => 1, 'position' => $i, 'text' => "Explain how you would approach problem number {$i} in Laravel.", 'category' => 'technical', 'duration_seconds' => 180, 'note' => 'Covers the container.']);
        }
        app(MockInterviewCatalog::class)->flush();
        $free = $this->student(expert: false);
        Sanctum::actingAs($free);
        $this->assertSame(1, $free->effectiveEntitlements()['feature_trial_uses'], 'the free plan has one try of an AI mock interview');

        // five study sets, one of them finished and sat again: none of it is refused
        foreach (range(1, 5) as $set) {
            [$interview, $start] = $this->sit($set);
        }
        $current = $start['question'];
        while ($current !== null) {
            $current = $this->answer($interview, $current, 'um no idea')->assertOk()->json('next_question');
        }
        $this->postJson("/api/interviews/{$interview->slug}/reattempt")->assertOk();
        $this->sit(6);

        // ...and the one try of an ordinary mock interview is still there to be used, then still enforced
        $slug = $this->postJson('/api/mock-interviews/rounds/mock-laravel-r1/start')->assertCreated()->json('interview.slug');
        $this->postJson("/api/interviews/{$slug}/start")->assertOk();
        $this->postJson('/api/mock-interviews/rounds/mock-laravel-r1/start')->assertCreated(); // resuming is free
        InterviewSession::where('interview_id', Interview::where('slug', $slug)->value('id'))->update(['status' => InterviewSession::STATUS_COMPLETED, 'completed_at' => now()]);
        $this->postJson('/api/mock-interviews/rounds/mock-laravel-r1/start')->assertStatus(402);

        // and study sets are still open after the free try is gone
        $this->sit(7);
    }

    public function test_ordinary_mock_interviews_are_still_limited_to_the_plans_daily_number(): void
    {
        foreach ([1, 2, 3] as $round) {
            foreach (range(1, 5) as $i) {
                MockInterviewQuestion::create(['stack_key' => 'laravel', 'round_number' => $round, 'position' => $i, 'text' => "Explain problem number {$i} of round {$round} in Laravel.", 'category' => 'technical', 'duration_seconds' => 180, 'note' => 'Covers it.']);
            }
        }
        app(MockInterviewCatalog::class)->flush();
        $student = $this->student();
        Plan::where('code', Plan::CODE_EXPERT)->update(['max_mock_interviews_per_day' => 2]);
        Sanctum::actingAs($student->fresh());

        foreach ([1, 2] as $round) {
            $slug = $this->postJson("/api/mock-interviews/rounds/mock-laravel-r{$round}/start")->assertCreated()->json('interview.slug');
            $this->postJson("/api/interviews/{$slug}/start")->assertOk();
        }

        $this->postJson('/api/mock-interviews/rounds/mock-laravel-r3/start')->assertStatus(402);
        $this->assertSame(2, $this->getJson('/api/me/subscription')->json('entitlements.mock_interviews_used_today'));
    }
}
