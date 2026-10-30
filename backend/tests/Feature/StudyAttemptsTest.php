<?php

namespace Tests\Feature;

use App\Models\Interview;
use App\Models\MockInterviewQuestion;
use App\Models\Plan;
use App\Models\StudyAttempt;
use App\Models\User;
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
 * The student's permanent record of study sittings (Merchant Navy): every finished set is kept with its score and a snapshot of what was
 * asked, said and shown - so the score history survives "Practise again", and a report can be downloaded after every sitting.
 */
class StudyAttemptsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Queue::fake();
        Mail::fake();
        Http::fake();
        config(['services.gemini.api_key' => 'a-key-that-must-never-be-used']);
        $this->seed(PlanSeeder::class);
        $this->seed(MerchantNavyMockQuestionsSeeder::class);
        $this->withoutMiddleware(\Illuminate\Routing\Middleware\ThrottleRequests::class);
    }

    private function student(): User
    {
        $student = User::factory()->create(['role' => User::ROLE_USER, 'branch' => 'CSE']);
        app(SubscriptionService::class)->grantIndividualPlan($student, Plan::where('code', Plan::CODE_EXPERT)->firstOrFail(), User::factory()->create(['role' => User::ROLE_SUPERADMIN]), [
            'days' => 365, 'kind' => 'complimentary', 'reason' => 'Test',
        ]);

        return $student->fresh();
    }

    /** Opens a ROR set (23 questions in set 1) and returns [slug, first question]. */
    private function open(int $set = 1, string $stack = 'ror_cards'): array
    {
        $slug = $this->postJson("/api/mock-interviews/rounds/mock-{$stack}-r{$set}/start")->assertCreated()->json('interview.slug');
        $start = $this->postJson("/api/interviews/{$slug}/start")->assertOk();

        return [$slug, $start->json('question')];
    }

    /**
     * Answers questions in order: `$answers` is a callable (model answer, index) => what the student says. Stops after `$limit` answers.
     *
     * @return int how many were answered
     */
    private function sit(string $slug, ?array $question, callable $answers, ?int $limit = null): int
    {
        $n = 0;

        while ($question !== null && ($limit === null || $n < $limit)) {
            $model = (string) \App\Models\InterviewQuestionBank::where('question_text', $question['question_text'])->where('image', $question['image'] ?? null)->firstOrFail()->notes_for_reviewer;
            $res = $this->postJson("/api/interviews/{$slug}/answer", ['interview_question_id' => $question['interview_question_id'], 'transcript_text' => $answers($model, $n)])->assertOk();
            $question = $res->json('next_question');
            $n++;
        }

        return $n;
    }

    private function best(string $model, int $i): string
    {
        return $model;
    }

    private function poor(string $model, int $i): string
    {
        return 'I am not sure about this one.';
    }

    // ───────────────────────────── recording ─────────────────────────────

    public function test_finishing_a_set_keeps_the_sitting_with_a_snapshot_of_what_was_asked_said_and_shown(): void
    {
        $student = $this->student();
        Sanctum::actingAs($student);
        [$slug, $q] = $this->open(1);

        $answered = $this->sit($slug, $q, $this->best(...));

        $attempt = StudyAttempt::where('user_id', $student->id)->sole();
        $this->assertSame('ror_cards', $attempt->stack_key);
        $this->assertSame('Rule of the Road (ROR) Cards', $attempt->exam_name);
        $this->assertSame('mock-ror_cards-r1', $attempt->round_id);
        $this->assertSame(1, $attempt->set_number);
        $this->assertSame('Set 1', $attempt->set_title);
        $this->assertSame(100, $attempt->score);
        $this->assertSame($answered, $attempt->answered_count);
        $this->assertSame($answered, $attempt->question_count);
        $this->assertFalse($attempt->isPartial());
        $this->assertSame($answered, $attempt->green_count);
        $this->assertSame(0, $attempt->red_count);
        $this->assertNotNull($attempt->completed_at);

        // the snapshot: question, picture, topic, what they said, the model answer, the match
        $first = $attempt->results[0];
        $expected = MockInterviewQuestion::where('stack_key', 'ror_cards')->where('round_number', 1)->orderBy('position')->first();
        $this->assertSame($expected->text, $first['question']);
        $this->assertSame($expected->image, $first['image']);
        $this->assertSame($expected->topic, $first['topic'], 'the report can say which kind of situation each card was');
        $this->assertSame($expected->note, $first['answer']);
        $this->assertSame($expected->note, $first['model_answer']);
        $this->assertSame(100, $first['percent']);
        $this->assertSame('green', $first['band']);
        $this->assertCount($answered, $attempt->results);

        // finishing is recorded once however often the result is read
        $this->getJson("/api/interviews/{$slug}/result")->assertOk();
        $this->getJson("/api/interviews/{$slug}/result")->assertOk();
        $this->assertSame(1, StudyAttempt::count());
        $this->assertCount(0, Http::recorded(fn ($request) => str_contains($request->body(), 'transcript') || str_contains($request->body(), 'Candidate')), 'no answer was sent anywhere');
    }

    public function test_the_history_survives_practising_the_set_again_and_says_how_the_new_sitting_compares(): void
    {
        $student = $this->student();
        Sanctum::actingAs($student);
        [$slug, $q] = $this->open(1);
        $this->sit($slug, $q, $this->best(...));
        $first = StudyAttempt::sole();
        $firstResults = $first->results;

        // "Practise this set again" resets the same interview and deletes its answers ...
        $this->postJson("/api/interviews/{$slug}/reattempt")->assertOk();
        $this->assertSame(0, \App\Models\InterviewResponse::count());
        $again = $this->postJson("/api/interviews/{$slug}/start")->assertOk()->json('question');
        $this->sit($slug, $again, $this->poor(...));

        // ... but the first sitting is still there, untouched
        $this->assertSame(2, StudyAttempt::count());
        $this->assertSame($firstResults, $first->fresh()->results);
        $second = StudyAttempt::orderByDesc('id')->first();
        $this->assertLessThan(60, $second->score);
        $this->assertGreaterThan(0, $second->red_count + $second->yellow_count);

        $result = $this->getJson("/api/interviews/{$slug}/result")->assertOk()->json('attempt');
        $this->assertSame($second->id, $result['id']);
        $this->assertSame(2, $result['number']);
        $this->assertSame(2, $result['attempts']);
        $this->assertSame(100, $result['previous_score']);
        $this->assertSame($second->score - 100, $result['delta']);
        $this->assertSame(100, $result['best_score']);
        $this->assertFalse($result['is_personal_best']);
        $this->assertSame([100, $second->score], array_column($result['history'], 'score'));

        // the card on the set remembers both
        $navy = collect($this->getJson('/api/mock-interviews/catalog')->assertOk()->json('roles'))->firstWhere('key', 'merchant_navy');
        $my = collect($navy['stacks'])->firstWhere('key', 'ror_cards')['rounds'][0]['my'];
        $this->assertSame(2, $my['attempts']);
        $this->assertSame(100, $my['best_score']);
        $this->assertSame($second->score, $my['last_score']);
        $this->assertSame(100, $my['previous_score']);
    }

    public function test_an_improvement_is_announced_as_a_personal_best(): void
    {
        $student = $this->student();
        Sanctum::actingAs($student);
        [$slug, $q] = $this->open(2);
        $this->sit($slug, $q, $this->poor(...));
        $this->postJson("/api/interviews/{$slug}/reattempt")->assertOk();
        $this->sit($slug, $this->postJson("/api/interviews/{$slug}/start")->assertOk()->json('question'), $this->best(...));

        $result = $this->getJson("/api/interviews/{$slug}/result")->assertOk()->json('attempt');
        $this->assertTrue($result['is_personal_best']);
        $this->assertGreaterThan(0, $result['delta']);

        $first = $this->postJson('/api/mock-interviews/rounds/mock-ror_cards-r3/start')->assertCreated()->json('interview.slug');
        $this->postJson("/api/interviews/{$first}/start")->assertOk();
        $this->assertNull($this->getJson("/api/study-attempts")->json('exams.0.sets.1'), 'a set that has not been finished has no history');
    }

    public function test_leaving_early_keeps_a_partial_sitting_marked_as_such(): void
    {
        $student = $this->student();
        Sanctum::actingAs($student);
        [$slug, $q] = $this->open(1);
        $this->sit($slug, $q, $this->best(...), 3);
        $this->postJson("/api/interviews/{$slug}/complete")->assertOk();

        $attempt = StudyAttempt::sole();
        $this->assertTrue($attempt->isPartial());
        $this->assertSame(3, $attempt->answered_count);
        $this->assertGreaterThan(3, $attempt->question_count);
        $this->assertCount(3, $attempt->results);

        $overview = $this->getJson('/api/study-attempts')->assertOk()->json();
        $this->assertTrue($overview['exams'][0]['sets'][0]['history'][0]['partial']);
    }

    public function test_a_set_left_without_a_single_answer_leaves_no_sitting(): void
    {
        Sanctum::actingAs($this->student());
        [$slug] = $this->open(1);
        $this->postJson("/api/interviews/{$slug}/complete")->assertOk();

        $this->assertSame(0, StudyAttempt::count());
    }

    // ───────────────────────────── reading ─────────────────────────────

    public function test_the_overview_lists_every_exam_and_set_with_best_last_and_the_trend(): void
    {
        $student = $this->student();
        Sanctum::actingAs($student);

        [$a, $qa] = $this->open(1);
        $this->sit($a, $qa, $this->best(...));
        [$b, $qb] = $this->open(2);
        $this->sit($b, $qb, $this->poor(...));
        $this->postJson("/api/interviews/{$b}/reattempt")->assertOk();
        $this->sit($b, $this->postJson("/api/interviews/{$b}/start")->assertOk()->json('question'), $this->best(...));

        $overview = $this->getJson('/api/study-attempts')->assertOk()->json();

        $this->assertSame(3, $overview['totals']['attempts']);
        $this->assertSame(2, $overview['totals']['sets_practised']);
        $this->assertGreaterThan(40, $overview['totals']['questions_answered']);
        $exam = $overview['exams'][0];
        $this->assertSame('ror_cards', $exam['stack_key']);
        $this->assertSame(2, $exam['sets_practised']);
        $this->assertSame(10, $exam['sets_total']);
        $this->assertSame(3, $exam['attempts']);
        $this->assertSame(100, $exam['average_latest'], 'the mean of each set\'s latest score: both sets now end on 100');
        $this->assertSame(100, $exam['best_score']);

        [$set1, $set2] = $exam['sets'];
        $this->assertSame([1, 2], [$set1['set_number'], $set2['set_number']]);
        $this->assertSame(1, $set1['attempts']);
        $this->assertNull($set1['delta']);
        $this->assertSame(2, $set2['attempts']);
        $this->assertSame(100, $set2['last_score']);
        $this->assertLessThan(100, $set2['previous_score']);
        $this->assertSame(100 - $set2['previous_score'], $set2['delta']);
        $this->assertCount(2, $set2['history']);
        $this->assertArrayNotHasKey('results', $set2['history'][0], 'the overview carries scores, not whole reports');
    }

    public function test_a_report_is_the_students_own_and_complete(): void
    {
        $student = $this->student();
        Sanctum::actingAs($student);
        [$slug, $q] = $this->open(1);
        $this->sit($slug, $q, $this->best(...));
        $attempt = StudyAttempt::sole();

        $report = $this->getJson("/api/study-attempts/{$attempt->id}")->assertOk()->json();
        $this->assertSame($student->name, $report['student']['name']);
        $this->assertSame('Rule of the Road (ROR) Cards', $report['attempt']['exam']);
        $this->assertSame(100, $report['attempt']['score']);
        $this->assertSame($attempt->question_count, count($report['attempt']['results']));
        $this->assertSame($attempt->results[0]['image'], $report['attempt']['results'][0]['image']);
        $this->assertSame(1, $report['standing']['number']);
        $this->assertNull($report['standing']['previous_score']);

        // somebody else's report is not there to be found
        Sanctum::actingAs($this->student());
        $this->getJson("/api/study-attempts/{$attempt->id}")->assertNotFound();
        $this->assertSame([], $this->getJson('/api/study-attempts')->assertOk()->json('exams'));
    }

    public function test_the_history_is_for_signed_in_students_only(): void
    {
        $this->getJson('/api/study-attempts')->assertUnauthorized();
        $this->getJson('/api/study-attempts/1')->assertUnauthorized();
    }

    // ───────────────────────────── sittings from before the ledger ─────────────────────────────

    public function test_the_backfill_records_sittings_finished_before_the_ledger_and_is_safe_to_run_again(): void
    {
        $student = $this->student();
        Sanctum::actingAs($student);
        [$slug, $q] = $this->open(1);
        $this->sit($slug, $q, $this->best(...));
        $score = StudyAttempt::sole()->score;
        StudyAttempt::query()->delete(); // as if it had been sat before the ledger existed

        $this->artisan('study:backfill-attempts')->assertSuccessful();
        $this->assertSame(1, StudyAttempt::count());
        $this->assertSame($score, StudyAttempt::sole()->score);

        $this->artisan('study:backfill-attempts')->assertSuccessful();
        $this->assertSame(1, StudyAttempt::count());

        // and the result page records one lazily, for a student who opens an old sitting before anyone ran the command
        StudyAttempt::query()->delete();
        $this->assertNotNull($this->getJson("/api/interviews/{$slug}/result")->assertOk()->json('attempt'));
        $this->assertSame(1, StudyAttempt::count());
    }

    public function test_an_interview_that_is_not_a_study_set_is_never_recorded(): void
    {
        $student = User::factory()->create(['role' => User::ROLE_USER, 'branch' => 'CSE']);
        $interview = Interview::create(['title' => 'Plain', 'slug' => 'plain-x', 'status' => Interview::STATUS_PUBLISHED, 'interview_type' => Interview::INTERVIEW_TYPE_PRACTICE, 'is_mock' => true, 'created_by' => $student->id, 'audience_scope' => Interview::AUDIENCE_SCOPE_ALL, 'practice_config' => []]);
        $session = \App\Models\InterviewSession::create(['interview_id' => $interview->id, 'user_id' => $student->id, 'status' => 'completed', 'completed_at' => now()]);

        $this->assertNull(app(\App\Services\Interviews\StudyAttemptRecorder::class)->record($session));
        $this->assertSame(0, StudyAttempt::count());
    }
}
