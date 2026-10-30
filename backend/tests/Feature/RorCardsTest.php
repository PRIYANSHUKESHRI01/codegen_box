<?php

namespace Tests\Feature;

use App\Models\Interview;
use App\Models\InterviewQuestionBank;
use App\Models\MockInterviewQuestion;
use App\Models\Plan;
use App\Models\User;
use App\Services\Answers\AnswerMatcher;
use App\Services\Answers\PictureVocabulary;
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
 * The Rule of the Road picture cards (Merchant Navy): 102 cards, each a picture with two or three questions, dealt into 10 sets. A picture
 * question differs from every other in three ways, and each is tested here: the set is asked WHOLE and IN ORDER (a card's questions stay
 * together), the room is handed the picture with every question, and "What are your Rule, role and action?" - asked of a hundred different
 * cards - is never mistaken for another card's.
 */
class RorCardsTest extends TestCase
{
    use RefreshDatabase;

    private const STACK = 'ror_cards';

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

    /** @return \Illuminate\Support\Collection<int, MockInterviewQuestion> */
    private function set(int $n)
    {
        return MockInterviewQuestion::where('stack_key', self::STACK)->where('round_number', $n)->orderBy('position')->get();
    }

    // ───────────────────────────── the bank ─────────────────────────────

    public function test_the_seeder_loads_102_cards_and_231_questions_as_ten_sets_idempotently(): void
    {
        $this->seed(MerchantNavyMockQuestionsSeeder::class);

        $all = MockInterviewQuestion::where('stack_key', self::STACK)->get();
        $this->assertCount(231, $all);
        $this->assertSame(range(1, 10), $all->pluck('round_number')->unique()->sort()->values()->all());
        $this->assertCount(102, $all->pluck('image')->unique(), '102 cards, 102 pictures');
        $this->assertSame(0, $all->whereNull('image')->count());
        $this->assertSame(0, $all->where('needs_review', true)->count());
        $this->assertSame(231, $all->where('origin', 'document')->count(), 'nothing was written by AptRun');
        $this->assertSame(0, $all->filter(fn ($q) => ! preg_match('#^/ror-cards/card-\d{3}\.png$#', $q->image))->count());

        foreach (range(1, 10) as $n) {
            $set = $this->set($n);
            $this->assertGreaterThanOrEqual(21, $set->count(), "set {$n}");
            $this->assertLessThanOrEqual(27, $set->count(), "set {$n}");
            $this->assertCount(count(array_unique($set->pluck('image')->all())), array_unique($set->pluck('topic', 'image')->all()), "set {$n}: no kind of situation is dealt twice into one set");
            $this->assertGreaterThanOrEqual(10, count(array_unique($set->pluck('image')->all())), "set {$n} is about ten cards");
            $this->assertLessThanOrEqual(11, count(array_unique($set->pluck('image')->all())), "set {$n} is about ten cards");

            // a card's questions are together, in a row: the same picture never comes back after another card's
            $seen = [];
            $previous = null;
            foreach ($set as $q) {
                if ($q->image !== $previous) {
                    $this->assertArrayNotHasKey($q->image, $seen, "set {$n}: card {$q->image} is split up");
                    $seen[$q->image] = true;
                }
                $previous = $q->image;
            }
        }

        // the sets are the same size as what they total: 102 cards dealt, none twice, none lost
        $this->assertSame(102, collect(range(1, 10))->sum(fn ($n) => count(array_unique($this->set($n)->pluck('image')->all()))));
    }

    public function test_no_question_gives_away_what_the_card_is(): void
    {
        // The card's heading is the answer to "what vessel is this?", the FIRST question of every card. (Later questions are the document's own
        // wording and may name the vessel by then: "Which light identifies an air-cushion vessel?".)
        foreach (MockInterviewQuestion::where('stack_key', self::STACK)->orderBy('round_number')->orderBy('position')->get()->groupBy(fn ($q) => $q->round_number.$q->image) as $card) {
            $this->assertStringNotContainsStringIgnoringCase((string) $card[0]->topic, $card[0]->text, 'the heading of a card is its answer and must not be in its first question');
        }

        foreach (MockInterviewQuestion::where('stack_key', self::STACK)->get() as $q) {
            $this->assertStringNotContainsString('°', $q->text, 'what the voice reads is in words');
            $this->assertStringNotContainsString(' nm', $q->text);
        }

        $this->assertSame(0, MockInterviewQuestion::where('stack_key', self::STACK)->whereRaw('LENGTH(text) < 15')->count());
        $this->assertSame(0, MockInterviewQuestion::where('stack_key', self::STACK)->whereNull('note')->count());
    }

    public function test_it_is_a_card_in_the_merchant_navy_section_and_every_set_is_asked_whole(): void
    {
        Sanctum::actingAs($this->student());
        $navy = collect($this->getJson('/api/mock-interviews/catalog')->assertOk()->json('roles'))->firstWhere('key', 'merchant_navy');
        $ror = collect($navy['stacks'])->firstWhere('key', self::STACK);

        $this->assertSame('Rule of the Road (ROR) Cards', $ror['name']);
        $this->assertTrue($ror['live']);
        $this->assertTrue($ror['study']);
        $this->assertFalse($ror['counts_toward_readiness']);
        $this->assertCount(10, $ror['rounds']);
        $this->assertSame('Set 1', $ror['rounds'][0]['title']);

        foreach ($ror['rounds'] as $round) {
            $this->assertSame($round['question_count'], $round['sitting_questions'], 'a card\'s questions are never sampled away: the whole set is asked');
        }
    }

    // ───────────────────────────── a sitting ─────────────────────────────

    public function test_a_sitting_gives_the_picture_with_every_question_in_order_and_each_card_keeps_its_own_answers(): void
    {
        Sanctum::actingAs($this->student());
        $expected = $this->set(2);

        $slug = $this->postJson('/api/mock-interviews/rounds/mock-ror_cards-r2/start')->assertCreated()->json('interview.slug');
        $interview = Interview::where('slug', $slug)->firstOrFail();
        $this->assertTrue($interview->isStudyMode());
        $this->assertSame('maritime', $interview->discipline);
        $this->assertCount($expected->count(), $interview->practice_config['mock_question_ids'], 'the whole set');

        // identical wording on different cards must not collapse: one bank row per question, and every row is its own card's
        $bank = $interview->interviewQuestions()->orderBy('display_order')->with('questionBank')->get()->pluck('questionBank');
        $this->assertCount($expected->count(), $bank->pluck('id')->unique());
        $this->assertSame($expected->pluck('image')->all(), $bank->pluck('image')->all());
        $this->assertSame($expected->pluck('note')->all(), $bank->pluck('notes_for_reviewer')->all());

        $start = $this->postJson("/api/interviews/{$slug}/start")->assertOk();
        $question = $start->json('question');
        $this->assertSame($expected->count(), $start->json('total_questions'));

        foreach ($expected as $i => $row) {
            $this->assertSame($row->image, $question['image'], 'the picture comes with question '.($i + 1));
            $this->assertSame($row->text, $question['question_text']);

            $answer = $this->postJson("/api/interviews/{$slug}/answer", ['interview_question_id' => $question['interview_question_id'], 'transcript_text' => $row->note])->assertOk();
            $this->assertSame(100, $answer->json('feedback.match_percent'), 'the model answer matches itself');
            $this->assertSame('green', $answer->json('feedback.band'));
            $this->assertSame($row->note, $answer->json('feedback.reference_answer'));
            $question = $answer->json('next_question');
        }

        $this->assertNull($question);
        $result = $this->getJson("/api/interviews/{$slug}/result")->assertOk();
        $this->assertSame('scored', $result->json('status'));
        $this->assertSame($expected->pluck('image')->all(), array_column($result->json('responses'), 'image'), 'the summary can show each question\'s card again');
        $this->assertCount(0, Http::recorded(fn ($request) => str_contains($request->body(), 'transcript') || str_contains($request->body(), 'Candidate')), 'no answer was sent anywhere');
    }

    public function test_two_sets_never_share_a_bank_row_even_when_a_question_is_worded_alike(): void
    {
        Sanctum::actingAs($this->student());

        foreach ([1, 2, 3] as $n) {
            $this->postJson("/api/mock-interviews/rounds/mock-ror_cards-r{$n}/start")->assertCreated();
        }

        $expected = collect([1, 2, 3])->sum(fn ($n) => $this->set($n)->count());
        $this->assertSame($expected, InterviewQuestionBank::where('discipline', 'maritime')->count(), 'one bank row per picture question');
        $this->assertGreaterThan(0, InterviewQuestionBank::where('question_text', 'What are your Rule, role and action?')->count());
        $this->assertSame(InterviewQuestionBank::where('question_text', 'What are your Rule, role and action?')->count(), InterviewQuestionBank::where('question_text', 'What are your Rule, role and action?')->distinct()->count('image'));
    }

    // ───────────────────────────── the colours ─────────────────────────────

    public function test_naming_the_wrong_colour_is_held_down_on_a_picture_but_extra_true_detail_is_not(): void
    {
        $matcher = new AnswerMatcher;
        $reference = 'You see her red (port) sidelight and masthead light(s). She is crossing your bow from your starboard side to your port side.';
        $right = 'I can see her red port sidelight and her masthead light, so she is crossing my bow from starboard to port.';
        $moreDetail = 'I see a white masthead light and a red sidelight on her port side. She is crossing my bow from my starboard side to my port side.';
        $wrong = 'I can see her green sidelight and her masthead light. She is crossing my bow from my starboard side to my port side.';

        $this->assertGreaterThanOrEqual(70, $matcher->match($right, $reference, picture: true)->percent);
        $this->assertGreaterThanOrEqual(70, $matcher->match($moreDetail, $reference, picture: true)->percent, 'a white masthead light is true and is not an error');
        $this->assertSame('green', $matcher->match($right, $reference, picture: true)->band);

        $capped = $matcher->match($wrong, $reference, picture: true);
        $this->assertLessThanOrEqual(60, $capped->percent, 'green for red cannot read as a pass');
        $this->assertNotSame('covered', $capped->segments[0]['status'], 'the key point that names the colour is not shown as covered when the colour was wrong');
        $this->assertSame('covered', $matcher->match($right, $reference, picture: true)->segments[0]['status']);
        $this->assertGreaterThan($capped->percent, $matcher->match($wrong, $reference)->percent, 'an ordinary question is judged by its words only: nothing changes for them');
    }

    public function test_the_words_that_tell_the_cards_apart_count_for_more_than_the_words_every_card_uses(): void
    {
        $answers = MockInterviewQuestion::whereNotNull('image')->pluck('note')->all();
        $vocabulary = new PictureVocabulary($answers);

        // "sidelight" is in most answers, "trawling" in a handful
        $this->assertLessThan(1.0, $vocabulary->factor('sidelight'));
        $this->assertGreaterThan(1.5, $vocabulary->factor('trawl'));
        $this->assertSame(1.0, $vocabulary->factor('a-word-no-answer-uses'));
        $this->assertSame(1.0, (new PictureVocabulary(['too few answers to learn from']))->factor('anything'));

        // naming the wrong vessel but describing the aspect rightly: the shared half of the answer is worth less than it was
        $first = fn (string $topic) => MockInterviewQuestion::where('topic', $topic)->where('text', 'like', 'Night%')->firstOrFail()->note;
        $reference = $first('Vessel aground');
        $student = $first('Pilot vessel on duty');

        $plain = (new AnswerMatcher)->match($student, $reference, picture: true)->percent;
        $weighted = (new AnswerMatcher($vocabulary))->match($student, $reference, picture: true)->percent;
        $this->assertLessThan($plain, $weighted);
        $this->assertSame(100, (new AnswerMatcher($vocabulary))->match($reference, $reference, picture: true)->percent, 'the model answer still matches itself');

        // and it is only for pictures: an ordinary question is weighted exactly as before
        $this->assertSame((new AnswerMatcher)->match($student, $reference)->percent, (new AnswerMatcher($vocabulary))->match($student, $reference)->percent);
    }

    // ───────────────────────────── staff ─────────────────────────────

    public function test_staff_can_correct_a_cards_answer_although_other_cards_ask_the_same_question(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_ADMIN_INTERNAL, 'permissions' => [User::PERM_INTERVIEWS]]));

        $question = $this->set(1)->first(fn ($q) => $q->text === 'What are your Rule, role and action?');
        $this->assertNotNull($question);
        $this->assertGreaterThan(1, $this->set(1)->where('text', $question->text)->count(), 'the same words are on several cards of this set');

        $this->putJson("/api/admin/mock-interview-bank/questions/{$question->id}", ['text' => $question->text, 'note' => 'A corrected model answer.'])->assertOk();

        $this->assertSame('A corrected model answer.', $question->fresh()->note);
        $this->assertSame($question->image, $question->fresh()->image, 'a correction keeps the picture');

        $detail = $this->getJson('/api/admin/mock-interview-bank/stacks/'.self::STACK)->assertOk();
        $this->assertSame($question->image, collect($detail->json('stack.rounds.0.questions'))->firstWhere('id', $question->id)['image'], 'the staff screen can show the picture');
    }
}
