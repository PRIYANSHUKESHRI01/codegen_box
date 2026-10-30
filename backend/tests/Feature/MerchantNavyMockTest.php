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
 * Second Mate (FG) orals - 23 SETS of 30 (10 + 10 + 10 questions of the three functions), a sitting being one whole set, answers scored by an
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

    private function start(int $round = 1, string $stack = self::STACK): Interview
    {
        $slug = $this->postJson("/api/mock-interviews/rounds/mock-{$stack}-r{$round}/start")->assertCreated()->json('interview.slug');

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
        $this->assertSame(['stack' => 'exam', 'stacks' => 'exams', 'round' => 'set', 'rounds' => 'sets'], $navy['terms']);
        $this->assertSame([self::STACK, 'chief_mate_fg', 'ror_cards', 'master_fg'], array_column($navy['stacks'], 'key'));
        $this->assertNull($roles['backend']['terms'], 'an IT domain keeps the default wording');
        $this->assertFalse($navy['stacks'][0]['counts_toward_readiness'], 'the page must not promise readiness credit for exam practice');
        $this->assertTrue($roles['backend']['stacks'][0]['counts_toward_readiness']);

        $second = $navy['stacks'][0];
        $this->assertSame('Second Mate (FG) Orals', $second['name']);
        $this->assertCount(23, $second['rounds'], 'sets, not three function rounds');
        $this->assertSame('mock-second_mate_fg-r1', $second['rounds'][0]['id']);
        $this->assertSame('mock-second_mate_fg-r23', $second['rounds'][22]['id']);
        $this->assertSame(['Set 1', 'Set 2', 'Set 3'], array_column(array_slice($second['rounds'], 0, 3), 'title'));
        $this->assertStringNotContainsString('Function', json_encode($second['rounds']), 'nothing function-wise is shown to students');
        $this->assertCount(20, $navy['stacks'][1]['rounds'], 'Chief Mate is 20 sets');
        $this->assertCount(10, $navy['stacks'][2]['rounds'], 'the ROR cards are 10 sets');
        $this->assertCount(10, $navy['stacks'][3]['rounds']);
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

    public function test_a_set_is_asked_whole_and_a_bigger_bank_is_drawn_across_its_topics(): void
    {
        // A set of 26 questions is one complete sitting: nothing is sampled away.
        $this->fillRound(2, ['Lights' => 13, 'Radar' => 13]);
        Sanctum::actingAs($this->student());

        $set = $this->navy()['stacks'][0]['rounds'][1];
        $this->assertSame(26, $set['question_count']);
        $this->assertSame(26, $set['sitting_questions']);
        $this->assertCount(26, $this->start(2)->practice_config['mock_question_ids']);

        // A round of 200 (staff tools, or an old bank) is capped at the stack's sitting length and drawn across its topics.
        $this->fillRound(1, ['Lights' => 40, 'Buoyage' => 40, 'Radar' => 40, 'Passage planning' => 40, 'Meteorology' => 40]);
        $interview = $this->start(1);
        $topics = MockInterviewQuestion::whereIn('id', $interview->practice_config['mock_question_ids'])->pluck('topic')->countBy();

        $this->assertCount(30, $interview->practice_config['mock_question_ids']);
        $this->assertCount(5, $topics, 'every topic is asked about');
        $this->assertSame([6], $topics->unique()->values()->all(), '30 questions over 5 topics is 6 each');
    }

    public function test_a_small_topic_cannot_crowd_out_the_rest(): void
    {
        $this->fillRound(1, ['One-off topic' => 1, 'Big topic' => 60]);
        Sanctum::actingAs($this->student());

        $topics = MockInterviewQuestion::whereIn('id', $this->start()->practice_config['mock_question_ids'])->pluck('topic')->countBy();

        $this->assertSame(1, $topics['One-off topic']);
        $this->assertSame(29, $topics['Big topic'], 'the sitting is still 30 long: the big topic fills what the small one cannot');
    }

    public function test_a_second_sitting_prefers_questions_the_student_has_not_met(): void
    {
        $this->fillRound(1, ['Lights' => 20, 'Buoyage' => 20]);
        $student = $this->student();
        Sanctum::actingAs($student);

        $first = $this->start();
        InterviewSession::create([
            'interview_id' => $first->id, 'user_id' => $student->id, 'status' => InterviewSession::STATUS_COMPLETED,
            'started_at' => now()->subMinutes(30), 'completed_at' => now(), 'current_question_order' => 30, 'composite_score_percent' => 70,
        ]);
        $second = $this->start();

        $this->assertNotSame($first->id, $second->id);
        $repeats = array_intersect($first->practice_config['mock_question_ids'], $second->practice_config['mock_question_ids']);
        $this->assertCount(20, $repeats, '40 questions, 30 at a time: the 10 unseen come first, so only 20 have to repeat');
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

        // Study mode: the student reads the model answer, so it is exactly what was written - and the unchecked flag is kept to tell them.
        $flagged = $banks->first(fn ($b) => str_contains((string) $b->notes_for_reviewer, 'Main steering gear'));
        $this->assertSame('Main steering gear: 35 degrees to 35 degrees.', $flagged->notes_for_reviewer);
        $this->assertTrue($flagged->reference_unverified);
        $others = $banks->where('id', '!=', $flagged->id);
        $this->assertStringContainsString('Reference answer for Lights', $others->first()->notes_for_reviewer);
        $this->assertFalse((bool) $others->first()->reference_unverified);
    }

    public function test_an_exam_that_is_not_a_study_exam_is_still_scored_by_ai_with_the_unchecked_figure_noted_for_the_scorer(): void
    {
        config(['mock_interviews.extra_roles.merchant_navy.stacks.second_mate_fg.study_mode' => false]);
        $this->fillRound(1, ['Lights' => 6]);
        MockInterviewQuestion::where('position', 1)->update(['needs_review' => true, 'note' => 'Main steering gear: 35 degrees to 35 degrees.']);
        app(MockInterviewCatalog::class)->flush();
        Sanctum::actingAs($this->student());

        $interview = $this->start();

        $this->assertFalse($interview->isStudyMode());
        $flagged = InterviewQuestionBank::where('discipline', 'maritime')->get()->first(fn ($b) => str_contains((string) $b->notes_for_reviewer, 'Main steering gear'));
        $this->assertStringContainsString('still being checked', $flagged->notes_for_reviewer, 'a figure under review is marked so for the AI scorer');
    }

    public function test_the_questions_written_by_aptrun_are_spread_over_the_sets_not_bunched_in_a_few(): void
    {
        $this->seed(MerchantNavyMockQuestionsSeeder::class);

        $perSet = MockInterviewQuestion::where('origin', 'generated')->selectRaw('round_number, count(*) as n')->groupBy('round_number')->pluck('n', 'round_number')->map(fn ($n) => (int) $n);

        $this->assertSame(64, $perSet->sum());
        $this->assertLessThanOrEqual(6, $perSet->max(), 'no set is mostly unchecked questions');
        $this->assertGreaterThanOrEqual(18, $perSet->count(), 'nearly every set has some, none is entirely free of them or entirely made of them');
        $this->assertGreaterThanOrEqual(20, $perSet->filter(fn ($n, $set) => $set <= 11)->sum(), 'the first half of the sets carries its share');
        $this->assertGreaterThanOrEqual(20, $perSet->filter(fn ($n, $set) => $set > 11)->sum(), 'and so does the second half');
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

        // the answer is part of a study question's identity, so the corrected wording is a bank row of its own - the one the new sitting
        // asks - while the row an earlier sitting was marked against is left exactly as it was
        $rows = InterviewQuestionBank::where('question_text', $one->text)->pluck('notes_for_reviewer')->all();
        $this->assertContains('The corrected answer.', $rows);
        $this->assertCount(2, $rows);
        $this->assertStringContainsString('Reference answer for Lights number 1', implode(' ', array_diff($rows, ['The corrected answer.'])));
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

    /** The ten syllabus sections of each function, as the bank names them: how a test tells which function a question belongs to. */
    private const FUNCTION_TOPICS = [
        1 => [
            'Bridge Watchkeeping & Handover Procedures', 'Passage Planning & Chart / ECDIS Management', 'Steering, Gyro & Magnetic Compass Operations',
            'Radar, ARPA & Bridge Instruments', 'Collision Avoidance & Traffic Situations', 'Lights, Shapes & Sound Signals',
            'Buoyage Systems & Pilotage', 'Celestial & Terrestrial Navigation Principles', 'Marine Meteorology & Tropical Cyclones',
            'Navigational Emergencies, SAR & GMDSS',
        ],
        2 => [
            "General Cargo Operations, Stowage & Mate's Receipts", 'Dry Bulk Cargoes & IMSBC Operational Principles', 'High-Risk Bulk Commodities (Coal, Iron Ore, Concentrates)',
            'Grain Carriage & Stability Considerations', 'Container Operations, Bay Plans & Securing', 'Packaged Dangerous Goods (IMDG Concepts)',
            'Lifting Gear, Derricks, Cranes & Rope/Wire Care', 'Oil Tanker Operations, Inert Gas & COW Concepts', 'Chemical & Gas Carrier Fundamentals',
            'Hatch Covers, Ballast Management & Cargo Space Inspections',
        ],
    ];

    private function functionOf(string $topic): int
    {
        foreach (self::FUNCTION_TOPICS as $fn => $topics) {
            if (in_array($topic, $topics, true)) {
                return $fn;
            }
        }

        return 3;
    }

    /** The Chief Mate document's own syllabus sections; Function 3 is everything else. */
    private const CHIEF_FUNCTION_TOPICS = [
        1 => [
            'COLREGs / Rules of the Road & Situations', 'Bridge Watchkeeping, Passage Planning & Navigational Emergencies', 'Radar, ARPA & Electronic Navigation Aids',
            'Magnetic & Gyro Compasses', 'Meteorology & Oceanography', 'Celestial Navigation & Tidal Theory',
        ],
        2 => [
            'Cargo Planning and General Cargo Concepts', 'Cargo Gear and Lifting Appliances', 'Solid Bulk Cargoes (IMSBC Code)', 'Grain Cargoes (International Grain Code)',
            'Dangerous Goods (IMDG Code)', 'Containers, Securing and Ro-Ro', 'Oil Tanker Operations', 'Gas and Chemical Carriers, Timber, Liability and Miscellaneous',
        ],
    ];

    private function chiefFunctionOf(?string $topic): int
    {
        foreach (self::CHIEF_FUNCTION_TOPICS as $fn => $topics) {
            if (in_array($topic, $topics, true)) {
                return $fn;
            }
        }

        return 3;
    }

    public function test_the_seeder_loads_690_questions_as_23_sets_of_30_idempotently_and_opens_the_second_and_chief_mate_exams(): void
    {
        $this->seed(MerchantNavyMockQuestionsSeeder::class);
        $this->seed(MerchantNavyMockQuestionsSeeder::class);

        $sizes = MockInterviewQuestion::where('stack_key', self::STACK)->selectRaw('round_number, count(*) as n')->groupBy('round_number')->orderBy('round_number')->pluck('n', 'round_number');

        $this->assertSame(range(1, 23), $sizes->keys()->map(fn ($k) => (int) $k)->all(), 'sets 1 to 23, no more, no fewer');
        $this->assertSame([30], $sizes->map(fn ($n) => (int) $n)->unique()->values()->all(), 'every set is exactly 30 questions');
        $this->assertSame(690, MockInterviewQuestion::where('stack_key', self::STACK)->count(), '626 from the document + 64 written to fill the short functions, once each after two runs');
        $this->assertSame(626, MockInterviewQuestion::where('stack_key', self::STACK)->where('origin', 'document')->count());
        $this->assertSame(64, MockInterviewQuestion::where('origin', 'generated')->count(), 'nothing had to be written for Chief Mate');
        $this->assertSame(0, MockInterviewQuestion::where('origin', 'generated')->where('needs_review', false)->count(), 'every question AptRun wrote is flagged for a master mariner');
        $this->assertSame(12 + 64, MockInterviewQuestion::where('needs_review', true)->count(), '12 [Verify] answers + the 64 written');
        $this->assertSame(0, MockInterviewQuestion::whereNull('topic')->count(), 'every question keeps its syllabus topic');
        $this->assertSame(0, MockInterviewQuestion::whereNotIn('stack_key', [self::STACK, 'chief_mate_fg', 'ror_cards'])->count(), 'the IT stacks are untouched');
        $this->assertSame(0, MockInterviewQuestion::whereNull('note')->count(), 'every question has a model answer');
        $this->assertSame(0, MockInterviewQuestion::whereRaw('LENGTH(text) < 15')->count());
        $this->assertSame(690, MockInterviewQuestion::where('stack_key', self::STACK)->distinct()->count('text'), 'no question appears twice across the sets');

        // Chief Mate: 600 questions straight from the document, 20 sets of 30, nothing written to fill them
        $chief = MockInterviewQuestion::where('stack_key', 'chief_mate_fg');
        $chiefSizes = (clone $chief)->selectRaw('round_number, count(*) as n')->groupBy('round_number')->orderBy('round_number')->pluck('n', 'round_number');
        $this->assertSame(range(1, 20), $chiefSizes->keys()->map(fn ($k) => (int) $k)->all());
        $this->assertSame([30], $chiefSizes->map(fn ($n) => (int) $n)->unique()->values()->all());
        $this->assertSame(600, (clone $chief)->count());
        $this->assertSame(600, (clone $chief)->where('origin', 'document')->where('needs_review', false)->count());
        $this->assertSame(600, (clone $chief)->distinct()->count('text'));
        $this->assertSame(0, (clone $chief)->whereNull('topic')->count());
        foreach ($chiefSizes->keys() as $set) {
            $functions = MockInterviewQuestion::where('stack_key', 'chief_mate_fg')->where('round_number', $set)->orderBy('position')->pluck('topic')->map(fn ($t) => $this->chiefFunctionOf($t))->all();
            $this->assertSame([...array_fill(0, 10, 1), ...array_fill(0, 10, 2), ...array_fill(0, 10, 3)], $functions, "Chief Mate set {$set} is 10 + 10 + 10 in function order");
        }
        $this->assertSame(0, (clone $chief)->where('note', 'like', '%^%')->count(), 'no equation was left half-converted');
        $this->assertSame(0, (clone $chief)->where('note', 'like', '%$%')->count(), 'no LaTeX was left in an answer');

        // every set is 10 of Function 1, then 10 of Function 2, then 10 of Function 3 - in that order
        foreach ($sizes->keys() as $set) {
            $functions = MockInterviewQuestion::where('stack_key', self::STACK)->where('round_number', $set)->orderBy('position')->pluck('topic')->map(fn ($t) => $this->functionOf($t))->all();

            $this->assertSame([...array_fill(0, 10, 1), ...array_fill(0, 10, 2), ...array_fill(0, 10, 3)], $functions, "set {$set} is 10 + 10 + 10 in function order");
            $this->assertGreaterThanOrEqual(20, MockInterviewQuestion::where('round_number', $set)->distinct()->count('topic'), "set {$set} spans the syllabus");
        }

        Sanctum::actingAs($this->student());
        $navy = $this->navy();

        $this->assertSame([true, true, true, false], array_column($navy['stacks'], 'live'));
        $this->assertSame(23, $navy['stacks'][0]['ready_rounds']);
        $this->assertSame(20, $navy['stacks'][1]['ready_rounds']);
        $this->assertSame(10, $navy['stacks'][2]['ready_rounds']);
        $this->assertSame(3, $navy['live_stacks_count']);

        // the length on a set's card is what its questions add up to (what the briefing page will say), not a fixed guess
        $seconds = (int) MockInterviewQuestion::where('stack_key', self::STACK)->where('round_number', 3)->sum('duration_seconds');
        $this->assertSame((int) ceil($seconds / 60), $navy['stacks'][0]['rounds'][2]['duration_minutes']);
        $this->assertSame(30, $navy['stacks'][3]['rounds'][0]['duration_minutes'], 'a set with no questions yet shows the configured stand-in');
    }

    public function test_every_set_can_be_sat_whole(): void
    {
        $this->seed(MerchantNavyMockQuestionsSeeder::class);
        Sanctum::actingAs($this->student());

        foreach (range(1, 23) as $set) {
            $interview = $this->start($set);
            $this->assertCount(30, $interview->practice_config['mock_question_ids'], "set {$set} is asked whole");
        }

        $this->assertSame(23, Interview::where('discipline', 'maritime')->count());
        $this->assertSame(690, InterviewQuestionBank::where('discipline', 'maritime')->count(), 'all 690 reach the student with their own bank row');
        $this->assertSame(0, InterviewQuestionBank::where('discipline', 'maritime')->whereNull('notes_for_reviewer')->count());
        $this->assertSame(76, InterviewQuestionBank::where('discipline', 'maritime')->where('reference_unverified', true)->count(), 'the unchecked ones are remembered, to tell the student');
    }

    public function test_every_chief_mate_set_can_be_sat_whole_and_shares_no_model_answer_with_second_mate(): void
    {
        $this->seed(MerchantNavyMockQuestionsSeeder::class);
        $this->withoutMiddleware(\Illuminate\Routing\Middleware\ThrottleRequests::class); // 43 sittings in one go
        Sanctum::actingAs($this->student());

        // Second Mate first, then Chief Mate: the 24 questions the two exams word identically must each keep their own answer
        foreach (range(1, 23) as $set) {
            $this->start($set);
        }
        foreach (range(1, 20) as $set) {
            $interview = $this->start($set, 'chief_mate_fg');
            $this->assertCount(30, $interview->practice_config['mock_question_ids'], "Chief Mate set {$set} is asked whole");
            $this->assertTrue($interview->isStudyMode());
        }

        $shared = MockInterviewQuestion::where('stack_key', 'chief_mate_fg')
            ->whereIn('text', MockInterviewQuestion::where('stack_key', self::STACK)->pluck('text'))->get();
        $this->assertGreaterThanOrEqual(20, $shared->count(), 'the two banks really do word some questions alike');

        foreach ($shared as $chiefQuestion) {
            $secondQuestion = MockInterviewQuestion::where('stack_key', self::STACK)->where('text', $chiefQuestion->text)->first();
            $this->assertNotSame($secondQuestion->note, $chiefQuestion->note, 'the test needs two different answers to mean anything');
            $this->assertSame(
                1,
                InterviewQuestionBank::where('discipline', 'maritime')->where('question_text', $chiefQuestion->text)->where('notes_for_reviewer', $chiefQuestion->note)->count(),
                "Chief Mate keeps its own answer to: {$chiefQuestion->text}"
            );
            $this->assertSame(
                1,
                InterviewQuestionBank::where('discipline', 'maritime')->where('question_text', $secondQuestion->text)->where('notes_for_reviewer', $secondQuestion->note)->count(),
                "Second Mate keeps its own answer to: {$secondQuestion->text}"
            );
        }

        $this->assertSame(1290, InterviewQuestionBank::where('discipline', 'maritime')->count(), 'one bank row per question per exam: 690 + 600');
    }

    public function test_the_one_time_migrations_clear_the_old_layouts_and_nothing_else(): void
    {
        $functionWise = require database_path('migrations/2026_11_11_100000_clear_function_wise_merchant_navy_bank.php');
        $twentyFiveSets = require database_path('migrations/2026_11_12_100100_clear_25_set_merchant_navy_layout.php');

        // the first shape: Function 1 as "round 1" holding 200 questions
        $this->fillRound(1, ['Old function' => 200]);
        $this->fillRound(1, ['Laravel stuff' => 6], 'laravel');
        $functionWise->up();
        $this->assertSame(0, MockInterviewQuestion::where('stack_key', self::STACK)->count(), 'the function-wise layout is cleared');
        $this->assertSame(6, MockInterviewQuestion::where('stack_key', 'laravel')->count(), 'an IT stack is never touched');

        // the second shape: 25 sets, of which 24 and 25 no longer exist
        foreach ([1, 23, 24, 25] as $set) {
            $this->fillRound($set, ['Old set' => 3]);
        }
        $twentyFiveSets->up();
        $this->assertSame([1, 23], MockInterviewQuestion::where('stack_key', self::STACK)->distinct()->orderBy('round_number')->pluck('round_number')->map(fn ($n) => (int) $n)->all(), 'sets 24 and 25 are gone, 1 and 23 stay');

        // the new shape (23 sets of 30) is left alone by both, even if they were to run again
        MockInterviewQuestion::where('stack_key', self::STACK)->delete();
        $this->seed(MerchantNavyMockQuestionsSeeder::class);
        $functionWise->up();
        $twentyFiveSets->up();
        $this->assertSame(690, MockInterviewQuestion::where('stack_key', self::STACK)->count());
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

        // a set number the stack does not have is refused with the real range (23 sets for Second Mate, 20 for Chief Mate); the column may be called "set"
        $bad = $this->postJson('/api/admin/mock-interview-bank/import', ['file' => UploadedFile::fake()->createWithContent('bad.csv', implode("\n", [
            'stack,set,question,category,seconds,note',
            self::STACK.',24,"What is the arc of a sternlight and its colour?",technical,60,"White, 135 degrees."',
            'chief_mate_fg,21,"What does the Master expect in the night orders?",technical,60,"Clear call-out criteria."',
            self::STACK.',23,"What is the arc of a sternlight and its colour?",technical,60,"White, 135 degrees."',
        ]))])->assertOk();
        $this->assertSame(1, $bad->json('added'));
        $this->assertSame('Round must be a number from 1 to 23 for this stack.', $bad->json('errors.0.message'));
        $this->assertSame('Round must be a number from 1 to 20 for this stack.', $bad->json('errors.1.message'));

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
