<?php

namespace Tests\Feature;

use App\Models\Interview;
use App\Models\InterviewQuestionBank;
use App\Models\InterviewSession;
use App\Models\MockInterviewQuestion;
use App\Models\Plan;
use App\Models\User;
use App\Services\GeminiInterviewScoringService;
use App\Services\Mock\MockInterviewCatalog;
use App\Services\SubscriptionService;
use App\Services\Vault\CuratedCatalog;
use App\Support\InterviewDiscipline;
use Database\Seeders\MerchantNavyMockQuestionsSeeder;
use Database\Seeders\PlanSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Merchant Navy in the Mock AI Interview: a domain that exists ONLY there (never in the Vault AI Interview), whose first exam is the
 * Second Mate (FG) orals - Function 1/2/3 as the three rounds, a sitting of 20 questions drawn across the syllabus, answers scored by an
 * examiner-style profile against the examiners' reference answer, and kept out of the IT readiness score.
 */
class MerchantNavyMockTest extends TestCase
{
    use RefreshDatabase;

    private const STACK = 'second_mate_fg';

    protected function setUp(): void
    {
        parent::setUp();

        Queue::fake();
        Mail::fake();
        $this->seed(PlanSeeder::class);
    }

    private function student(): User
    {
        $student = User::factory()->create(['role' => User::ROLE_USER, 'branch' => 'CSE']);
        app(SubscriptionService::class)->grantIndividualPlan($student, Plan::where('code', Plan::CODE_EXPERT)->firstOrFail(), User::factory()->create(['role' => User::ROLE_SUPERADMIN]), [
            'days' => 365, 'kind' => 'complimentary', 'reason' => 'Test',
        ]);

        return $student->fresh();
    }

    /** @param  array<string, int>  $topics topic => how many questions */
    private function fillRound(int $round, array $topics, string $stack = self::STACK): void
    {
        $position = 0;

        foreach ($topics as $topic => $count) {
            for ($i = 1; $i <= $count; $i++) {
                MockInterviewQuestion::create([
                    'stack_key' => $stack, 'round_number' => $round, 'position' => ++$position, 'topic' => $topic,
                    'text' => "What does the examiner expect you to say about {$topic}, point number {$i}?",
                    'category' => 'technical', 'duration_seconds' => 90, 'note' => "Reference answer for {$topic} number {$i}.",
                ]);
            }
        }

        // The staff tools flush the catalog after every write; a test that writes rows directly has to do the same.
        app(MockInterviewCatalog::class)->flush();
    }

    private function start(int $round = 1): Interview
    {
        $slug = $this->postJson("/api/mock-interviews/rounds/mock-second_mate_fg-r{$round}/start")->assertCreated()->json('interview.slug');

        return Interview::where('slug', $slug)->firstOrFail();
    }

    private function navy(): array
    {
        return collect($this->getJson('/api/mock-interviews/catalog')->assertOk()->json('roles'))->firstWhere('key', 'merchant_navy');
    }

    // ───────────────────────────── where it lives ─────────────────────────────

    public function test_merchant_navy_is_in_the_mock_interview_but_never_in_the_vault_interview(): void
    {
        $this->assertArrayNotHasKey('merchant_navy', app(CuratedCatalog::class)->roles());
        $this->assertNull(app(CuratedCatalog::class)->stack(self::STACK));

        Sanctum::actingAs($this->student());
        $roles = collect($this->getJson('/api/mock-interviews/catalog')->assertOk()->json('roles'))->keyBy('key');

        $navy = $roles['merchant_navy'];
        $this->assertSame('Merchant Navy', $navy['title']);
        $this->assertSame(['stack' => 'exam', 'stacks' => 'exams'], $navy['terms']);
        $this->assertSame([self::STACK, 'chief_mate_fg', 'master_fg'], array_column($navy['stacks'], 'key'));
        $this->assertNull($roles['backend']['terms'], 'an IT domain keeps the default wording');
        $this->assertFalse($navy['stacks'][0]['counts_toward_readiness'], 'the page must not promise readiness credit for exam practice');
        $this->assertTrue($roles['backend']['stacks'][0]['counts_toward_readiness']);

        $second = $navy['stacks'][0];
        $this->assertSame('Second Mate (FG) Orals', $second['name']);
        $this->assertSame(['mock-second_mate_fg-r1', 'mock-second_mate_fg-r2', 'mock-second_mate_fg-r3'], array_column($second['rounds'], 'id'));
        $this->assertStringStartsWith('Function 1: Navigation', $second['rounds'][0]['title']);
        $this->assertStringStartsWith('Function 3: Controlling the Operation of the Ship', $second['rounds'][2]['title']);
        $this->assertFalse($second['live'], 'coming soon until the questions are loaded');
    }

    public function test_the_vault_ai_interview_never_lists_or_opens_it(): void
    {
        $this->seed(MerchantNavyMockQuestionsSeeder::class);
        Sanctum::actingAs($this->student());

        $vault = $this->getJson('/api/curated-interview-sets')->assertOk()->getContent();

        $this->assertStringNotContainsString('merchant_navy', $vault);
        $this->assertStringNotContainsString('Second Mate', $vault);
        $this->getJson('/api/curated-interview-sets/merchant_navy-second_mate_fg-s1-set1')->assertNotFound();
    }

    // ───────────────────────────── a sitting ─────────────────────────────

    public function test_a_sitting_asks_twenty_questions_drawn_across_the_topics_not_twenty_from_one(): void
    {
        $this->fillRound(1, ['Lights' => 40, 'Buoyage' => 40, 'Radar' => 40, 'Passage planning' => 40, 'Meteorology' => 40]);
        Sanctum::actingAs($this->student());

        $round = $this->navy()['stacks'][0]['rounds'][0];
        $this->assertSame(200, $round['question_count']);
        $this->assertSame(20, $round['sitting_questions']);

        $interview = $this->start();
        $this->assertSame(20, count($interview->practice_config['mock_question_ids']));

        $topics = MockInterviewQuestion::whereIn('id', $interview->practice_config['mock_question_ids'])->pluck('topic')->countBy();

        $this->assertCount(5, $topics, 'every topic is asked about');
        $this->assertSame([4], $topics->unique()->values()->all(), '20 questions over 5 topics is 4 each');
    }

    public function test_a_small_topic_cannot_crowd_out_the_rest(): void
    {
        $this->fillRound(1, ['One-off topic' => 1, 'Big topic' => 60]);
        Sanctum::actingAs($this->student());

        $topics = MockInterviewQuestion::whereIn('id', $this->start()->practice_config['mock_question_ids'])->pluck('topic')->countBy();

        $this->assertSame(1, $topics['One-off topic']);
        $this->assertSame(19, $topics['Big topic'], 'the sitting is still 20 long: the big topic fills what the small one cannot');
    }

    public function test_a_second_sitting_prefers_questions_the_student_has_not_met(): void
    {
        $this->fillRound(1, ['Lights' => 20, 'Buoyage' => 20]);
        $student = $this->student();
        Sanctum::actingAs($student);

        $first = $this->start();
        InterviewSession::create([
            'interview_id' => $first->id, 'user_id' => $student->id, 'status' => InterviewSession::STATUS_COMPLETED,
            'started_at' => now()->subMinutes(30), 'completed_at' => now(), 'current_question_order' => 20, 'composite_score_percent' => 70,
        ]);
        $second = $this->start();

        $this->assertNotSame($first->id, $second->id);
        $this->assertSame([], array_values(array_intersect($first->practice_config['mock_question_ids'], $second->practice_config['mock_question_ids'])), '40 questions, 20 at a time: the second sitting is all new');
    }

    public function test_an_it_stack_still_samples_ten_and_has_no_topics(): void
    {
        foreach (range(1, 15) as $i) {
            MockInterviewQuestion::create(['stack_key' => 'laravel', 'round_number' => 1, 'position' => $i, 'text' => "Explain how you would approach problem number {$i} in Laravel.", 'category' => 'technical', 'duration_seconds' => 180]);
        }
        app(MockInterviewCatalog::class)->flush();
        Sanctum::actingAs($this->student());

        $interview = Interview::where('slug', $this->postJson('/api/mock-interviews/rounds/mock-laravel-r1/start')->assertCreated()->json('interview.slug'))->firstOrFail();

        $this->assertCount(10, $interview->practice_config['mock_question_ids']);
        $this->assertSame('software', $interview->discipline, 'unchanged for every IT stack');
    }

    // ───────────────────────────── how it is scored ─────────────────────────────

    public function test_the_interview_is_judged_as_a_merchant_navy_oral_and_carries_the_reference_answer(): void
    {
        $this->fillRound(1, ['Lights' => 6]);
        MockInterviewQuestion::where('position', 1)->update(['needs_review' => true, 'note' => 'Main steering gear: 35 degrees to 35 degrees.']);
        app(MockInterviewCatalog::class)->flush();
        Sanctum::actingAs($this->student());

        $interview = $this->start();

        $this->assertSame('maritime', $interview->discipline);
        $this->assertSame('maritime', $interview->effectiveDiscipline());

        $banks = InterviewQuestionBank::where('discipline', 'maritime')->get();
        $this->assertCount(6, $banks);
        $this->assertSame(0, InterviewQuestionBank::where('discipline', 'software')->count(), 'nothing leaks into the software bank');

        $flagged = $banks->first(fn ($b) => str_contains((string) $b->notes_for_reviewer, 'Main steering gear'));
        $this->assertStringContainsString('still being checked', $flagged->notes_for_reviewer, 'a figure under review is marked so for the scorer');
        $others = $banks->where('id', '!=', $flagged->id);
        $this->assertStringContainsString('Reference answer for Lights', $others->first()->notes_for_reviewer);
        $this->assertStringNotContainsString('still being checked', $others->first()->notes_for_reviewer);
    }

    public function test_a_corrected_reference_answer_is_used_the_next_time_the_question_is_asked(): void
    {
        $this->fillRound(1, ['Lights' => 5]);
        $one = MockInterviewQuestion::where('position', 1)->firstOrFail();

        Sanctum::actingAs($this->student());
        $this->start();
        $this->assertStringContainsString('Reference answer for Lights number 1', InterviewQuestionBank::where('question_text', $one->text)->firstOrFail()->notes_for_reviewer);

        // a master mariner corrects the answer in the staff screen
        $one->update(['note' => 'The corrected answer.']);
        app(MockInterviewCatalog::class)->flush();

        Sanctum::actingAs($this->student());
        $this->start();

        $this->assertSame('The corrected answer.', InterviewQuestionBank::where('question_text', $one->text)->firstOrFail()->notes_for_reviewer);
    }

    public function test_the_scorer_is_told_to_mark_like_an_examiner_against_the_reference_answer(): void
    {
        config(['services.gemini.api_key' => 'test-key']);
        $reply = ['candidates' => [['content' => ['parts' => [['text' => json_encode([['response_id' => 1, 'score' => 80, 'feedback' => 'Good.']])]]]]]];
        Http::fake(['*' => Http::response($reply)]);

        $item = ['response_id' => 1, 'question_text' => 'What is the SOLAS performance requirement for main steering gear?', 'category' => 'technical', 'difficulty' => 'standard', 'notes_for_reviewer' => '35 degrees one side to 30 degrees the other within 28 seconds.', 'transcript_text' => 'Thirty five to thirty in twenty eight seconds.'];

        $results = app(GeminiInterviewScoringService::class)->score([$item], 'Merchant Navy', 'maritime');
        $prompt = Http::recorded()->first()[0]->data()['contents'][0]['parts'][0]['text'];

        $this->assertSame(80, $results[0]['score']);
        $this->assertStringContainsString('Merchant Navy deck officer certificate oral', $prompt);
        $this->assertStringContainsString('UNSAFE or illegal at sea', $prompt);
        $this->assertStringContainsString('What a strong answer covers: 35 degrees one side to 30 degrees the other within 28 seconds.', $prompt);

        // a software interview's prompt is untouched
        Http::fake(['*' => Http::response($reply)]);
        app(GeminiInterviewScoringService::class)->score([$item], 'Laravel Developer', null);
        $this->assertStringNotContainsString('Merchant Navy', Http::recorded()->first()[0]->data()['contents'][0]['parts'][0]['text']);
    }

    public function test_practising_for_the_orals_does_not_move_the_it_readiness_score(): void
    {
        $this->fillRound(1, ['Lights' => 6]);
        Sanctum::actingAs($this->student());
        $navy = $this->start();
        $make = fn (?string $discipline) => Interview::create([
            'title' => 'Practice '.($discipline ?? 'none'), 'slug' => Interview::uniqueSlug('practice-'.($discipline ?? 'none').'-'.uniqid()),
            'status' => Interview::STATUS_PUBLISHED, 'interview_type' => Interview::INTERVIEW_TYPE_PRACTICE, 'is_mock' => true,
            'created_by' => $navy->created_by, 'audience_scope' => Interview::AUDIENCE_SCOPE_ALL, 'discipline' => $discipline,
        ]);
        $it = $make('software');
        $untagged = $make(null);

        $counted = Interview::query()->countsTowardReadiness()->pluck('interviews.id');

        $this->assertFalse($counted->contains($navy->id));
        $this->assertTrue($counted->contains($it->id));
        $this->assertTrue($counted->contains($untagged->id));
    }

    // ───────────────────────────── loading the bank ─────────────────────────────

    public function test_the_seeder_loads_the_whole_bank_idempotently_and_opens_only_the_second_mate_exam(): void
    {
        $this->seed(MerchantNavyMockQuestionsSeeder::class);
        $this->seed(MerchantNavyMockQuestionsSeeder::class);

        $perRound = array_map(fn ($r) => MockInterviewQuestion::where('stack_key', self::STACK)->where('round_number', $r)->count(), [1, 2, 3]);

        $this->assertSame([200, 200, 226], $perRound, 'Function 1, 2 and 3, with no duplicates after a second run');
        $this->assertSame(12, MockInterviewQuestion::where('needs_review', true)->count());
        $this->assertSame(0, MockInterviewQuestion::whereNull('topic')->count(), 'every question has its syllabus topic');
        $this->assertSame(0, MockInterviewQuestion::where('stack_key', '!=', self::STACK)->count(), 'the IT stacks are untouched');
        $this->assertSame(0, MockInterviewQuestion::whereNull('note')->count(), 'every question has a reference answer for the scorer');
        $this->assertSame(0, MockInterviewQuestion::whereRaw('LENGTH(text) < 15')->count());

        Sanctum::actingAs($this->student());
        $navy = $this->navy();

        $this->assertSame([true, false, false], array_column($navy['stacks'], 'live'));
        $this->assertSame(3, $navy['stacks'][0]['ready_rounds']);
        $this->assertSame(1, $navy['live_stacks_count']);
    }

    public function test_each_function_can_be_sat_as_a_twenty_question_oral(): void
    {
        $this->seed(MerchantNavyMockQuestionsSeeder::class);
        Sanctum::actingAs($this->student());

        foreach ([1, 2, 3] as $round) {
            $this->assertCount(20, $this->start($round)->practice_config['mock_question_ids']);
        }

        $this->assertSame(3, Interview::where('discipline', 'maritime')->count());
        $this->assertSame(0, InterviewQuestionBank::where('discipline', 'maritime')->whereNull('notes_for_reviewer')->count());
    }

    public function test_staff_can_load_topic_and_review_columns_from_a_spreadsheet_and_clear_the_flag(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_ADMIN_INTERNAL, 'permissions' => [User::PERM_INTERVIEWS]]));

        $rows = [
            'stack,round,question,category,seconds,note,topic,review',
            self::STACK.',1,"What is the arc of a masthead light and its colour?",technical,60,"White, 225 degrees.",Lights & Shapes,',
            self::STACK.',3,"How many lifebuoys must a cargo ship of 120 metres carry?",technical,60,"Ten.",Life-saving appliances,yes',
        ];
        $res = $this->postJson('/api/admin/mock-interview-bank/import', ['file' => UploadedFile::fake()->createWithContent('q.csv', implode("\n", $rows))])->assertOk();

        $this->assertSame(2, $res->json('added'));
        $this->assertSame([], $res->json('errors'));

        $lights = MockInterviewQuestion::where('round_number', 1)->firstOrFail();
        $this->assertSame('Lights & Shapes', $lights->topic);
        $this->assertFalse($lights->needs_review);

        $buoys = MockInterviewQuestion::where('round_number', 3)->firstOrFail();
        $this->assertTrue($buoys->needs_review);

        // somebody checks the figure and clears the flag in the staff screen
        $this->putJson("/api/admin/mock-interview-bank/questions/{$buoys->id}", ['text' => $buoys->text, 'needs_review' => false])->assertOk();
        $this->assertFalse($buoys->fresh()->needs_review);
        $this->assertSame('Life-saving appliances', $buoys->fresh()->topic, 'an edit that does not mention the topic keeps it');
    }

    public function test_the_discipline_is_known_to_the_interview_tools(): void
    {
        $this->assertContains('maritime', InterviewDiscipline::families());
        $this->assertSame('Merchant Navy (deck officer certificate orals)', InterviewDiscipline::label('maritime'));
        $this->assertStringContainsString('UNSAFE', InterviewDiscipline::scoringGuidance('maritime'));
        $this->assertLessThanOrEqual(20, strlen(InterviewDiscipline::MARITIME_KEY), 'fits the discipline columns');
    }
}
