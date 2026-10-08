<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\VocabularyAnswer;
use App\Models\VocabularyAttempt;
use App\Models\VocabularyWordProgress;
use Database\Seeders\VocabularyWordSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\BuildsVocabularyWords;
use Tests\TestCase;

/**
 * Answering one question at a time: the key is revealed only after the student
 * commits, every answer is recorded immediately, and a repeat is harmless.
 */
class VocabularyAnswerFlowTest extends TestCase
{
    use BuildsVocabularyWords;
    use RefreshDatabase;

    private User $student;

    protected function setUp(): void
    {
        parent::setUp();
        $this->student = $this->vocabStudent();
        Sanctum::actingAs($this->student);
    }

    private function startDaily(): int
    {
        return $this->postJson('/api/learning-centre/vocabulary/sessions', ['kind' => 'daily'])->assertSuccessful()->json('attempt_id');
    }

    private function answer(int $attempt, int $index, mixed $answer, ?int $ms = null)
    {
        return $this->postJson("/api/learning-centre/vocabulary/attempts/{$attempt}/answer", array_filter(
            ['index' => $index, 'answer' => $answer, 'response_ms' => $ms],
            fn ($v) => $v !== null
        ));
    }

    private function key(int $attempt, int $index): array
    {
        return VocabularyAttempt::findOrFail($attempt)->questions[$index];
    }

    /** What a student who knows the answer would send. */
    private function correct(array $question): int|string
    {
        return ($question['type'] ?? 'cloze') === 'recall' ? $question['answer'] : $question['correct_index'];
    }

    private function wrong(array $question): int|string
    {
        return ($question['type'] ?? 'cloze') === 'recall' ? 'definitelywrong' : ($question['correct_index'] + 1) % 4;
    }

    // ---- one answer -------------------------------------------------------------------------------

    public function test_a_correct_answer_is_confirmed_and_the_word_starts_climbing(): void
    {
        $this->libraryPool(10);
        $attempt = $this->startDaily();
        $q = $this->key($attempt, 0);

        $res = $this->answer($attempt, 0, $q['correct_index'], 4200)->assertStatus(200)->json();

        $this->assertTrue($res['is_correct']);
        $this->assertSame($q['correct_index'], $res['correct_index']);
        $this->assertSame($q['correct_index'], $res['selected_index']);
        $this->assertSame($q['word'], $res['card']['word']);
        $this->assertSame($q['meaning'], $res['card']['meaning']);
        $this->assertSame([null, 1, 'learning', true], [$res['progress']['box_before'], $res['progress']['box_after'], $res['progress']['status'], $res['progress']['moved_up']]);
        $this->assertSame('tomorrow', $res['progress']['next_review']);
        $this->assertFalse($res['complete']);
        $this->assertSame([1, $q['word_id']], [VocabularyAnswer::count(), VocabularyAnswer::first()->vocabulary_word_id]);
        $this->assertSame(4200, VocabularyAnswer::first()->response_ms);
    }

    public function test_a_wrong_answer_reveals_the_right_one_with_the_explanation_and_sends_the_word_back(): void
    {
        $this->libraryPool(10);
        $attempt = $this->startDaily();
        $q = $this->key($attempt, 0);
        $wrong = $this->wrong($q);

        $res = $this->answer($attempt, 0, $wrong)->assertStatus(200)->json();

        $this->assertFalse($res['is_correct']);
        $this->assertSame($wrong, $res['selected_index']);
        $this->assertSame($q['correct_index'], $res['correct_index'], 'the key is revealed only now');
        $this->assertSame($q['explanation'], $res['explanation']);
        $this->assertSame(0, $res['progress']['box_after']);
        $this->assertFalse($res['progress']['moved_up']);
        $this->assertSame('today', $res['progress']['next_review']);

        $progress = VocabularyWordProgress::where('vocabulary_word_id', $q['word_id'])->first();
        $this->assertSame([1, 0], [$progress->seen_count, $progress->correct_count]);
        $this->assertSame(today()->toDateString(), $progress->due_on->toDateString());
    }

    public function test_answering_the_same_question_again_returns_the_first_result_and_changes_nothing(): void
    {
        $this->libraryPool(10);
        $attempt = $this->startDaily();
        $q = $this->key($attempt, 0);

        $first = $this->answer($attempt, 0, $q['correct_index'])->json();
        $second = $this->answer($attempt, 0, $this->wrong($q))->assertStatus(200)->json();

        $this->assertTrue($second['is_correct'], 'a second try cannot overwrite the first');
        $this->assertSame($first['selected_index'], $second['selected_index']);
        $this->assertSame(1, VocabularyAnswer::count());
        $this->assertSame(1, VocabularyWordProgress::where('vocabulary_word_id', $q['word_id'])->value('seen_count'), 'and cannot double-count the word');
    }

    public function test_the_second_look_at_a_new_word_never_changes_its_box_but_a_miss_brings_it_back_today(): void
    {
        $this->libraryPool(10);
        $attempt = $this->startDaily();
        $stored = VocabularyAttempt::findOrFail($attempt)->questions;

        $primaryIndex = collect($stored)->search(fn ($q) => ! $q['is_echo']);
        $primary = $stored[$primaryIndex];
        $echoIndex = collect($stored)->search(fn ($q) => $q['is_echo'] && $q['word_id'] === $primary['word_id']);

        $this->answer($attempt, $primaryIndex, $primary['correct_index'])->assertStatus(200);
        $echo = $this->answer($attempt, $echoIndex, $this->wrong($stored[$echoIndex]))->assertStatus(200)->json();

        $this->assertFalse($echo['is_correct']);
        $this->assertSame(1, $echo['progress']['box_after'], 'one miss on a repeat does not undo the first success');
        $this->assertFalse($echo['progress']['moved_up']);
        $progress = VocabularyWordProgress::where('vocabulary_word_id', $primary['word_id'])->first();
        $this->assertSame(1, $progress->seen_count);
        $this->assertSame(today()->toDateString(), $progress->due_on->toDateString());
    }

    // ---- typed answers ------------------------------------------------------------------------------

    private function sessionWithATypedQuestion(): array
    {
        $words = $this->libraryPool(10);
        $this->progress($this->student, $words[0], ['box' => 4, 'due_on' => today()->subDay(), 'mastered_at' => now()->subWeek()]);
        $attempt = $this->startDaily();
        $index = collect(VocabularyAttempt::findOrFail($attempt)->questions)->search(fn ($q) => $q['type'] === 'recall');

        return [$attempt, $index, $words[0]];
    }

    public function test_a_typed_answer_is_checked_for_spelling_and_a_slip_is_called_a_near_miss(): void
    {
        [$attempt, $index] = $this->sessionWithATypedQuestion();
        $q = $this->key($attempt, $index);

        $this->assertSame('a _ _ _ _', $this->getJson("/api/learning-centre/vocabulary/attempts/{$attempt}")->json("questions.{$index}.hint"));

        $res = $this->answer($attempt, $index, 'alph')->assertStatus(200)->json();

        $this->assertFalse($res['is_correct']);
        $this->assertTrue($res['close'], 'one letter off is a spelling slip, and the student is told so');
        $this->assertSame('alph', $res['response']);
        $this->assertSame('alpha', $res['correct_answer']);
        $this->assertNull($res['correct_index']);
        $this->assertSame(2, $res['progress']['box_after'], 'a near-miss still counts as not remembered');
    }

    public function test_a_correct_typed_answer_ignores_case_and_spaces_and_completes_the_climb(): void
    {
        [$attempt, $index] = $this->sessionWithATypedQuestion();

        $res = $this->answer($attempt, $index, '  ALPHA ')->assertStatus(200)->json();

        $this->assertTrue($res['is_correct']);
        $this->assertFalse($res['close']);
        $this->assertSame(5, $res['progress']['box_after']);
        $this->assertSame('mastered', $res['progress']['status']);
        $this->assertSame('in 5 weeks', $res['progress']['next_review']);
    }

    public function test_a_blank_typed_answer_is_refused_rather_than_marked_wrong(): void
    {
        [$attempt, $index] = $this->sessionWithATypedQuestion();

        $this->answer($attempt, $index, '   ')->assertStatus(422);
        $this->assertSame(0, VocabularyAnswer::count());
    }

    // ---- bad requests --------------------------------------------------------------------------------

    public function test_malformed_answers_are_refused_and_record_nothing(): void
    {
        $this->libraryPool(10);
        $attempt = $this->startDaily();

        $this->answer($attempt, 0, 4)->assertStatus(422);
        $this->answer($attempt, 0, -1)->assertStatus(422);
        $this->answer($attempt, 0, 'alpha')->assertStatus(422);
        $this->answer($attempt, 0, str_repeat('x', 200))->assertStatus(422);
        $this->answer($attempt, 99, 0)->assertStatus(422);
        $this->postJson("/api/learning-centre/vocabulary/attempts/{$attempt}/answer", ['answer' => 0])->assertStatus(422);
        $this->postJson("/api/learning-centre/vocabulary/attempts/{$attempt}/answer", ['index' => 0])->assertStatus(422);

        $this->assertSame(0, VocabularyAnswer::count());
    }

    public function test_a_numeric_string_is_accepted_for_a_multiple_choice_answer(): void
    {
        $this->libraryPool(10);
        $attempt = $this->startDaily();
        $q = $this->key($attempt, 0);

        $this->answer($attempt, 0, (string) $q['correct_index'])->assertStatus(200)->assertJsonPath('is_correct', true);
    }

    public function test_nobody_else_can_answer_or_read_a_session(): void
    {
        $this->libraryPool(10);
        $attempt = $this->startDaily();

        Sanctum::actingAs($this->vocabStudent());
        $this->answer($attempt, 0, 0)->assertStatus(404);
        $this->getJson("/api/learning-centre/vocabulary/attempts/{$attempt}")->assertStatus(404);
        $this->assertSame(0, VocabularyAnswer::count());
    }

    // ---- finishing -----------------------------------------------------------------------------------

    public function test_the_last_answer_finishes_the_session_with_a_summary(): void
    {
        $this->libraryPool(10);
        $attempt = $this->startDaily();
        $total = count(VocabularyAttempt::findOrFail($attempt)->questions);

        $last = null;
        foreach (range(0, $total - 1) as $i) {
            $last = $this->answer($attempt, $i, $this->correct($this->key($attempt, $i)), 3000)->assertStatus(200)->json();
            $this->assertSame($i === $total - 1, $last['complete'], "question {$i}");
        }

        $summary = $last['summary'];
        $this->assertSame(100, $summary['score']);
        $this->assertSame([8, 8], [$summary['correct'], $summary['total']]);
        $this->assertSame(24, $summary['duration_seconds']);
        $this->assertSame(4, $summary['new_words_met']);
        $this->assertSame(4, $summary['words_moved_up']);
        $this->assertSame([], $summary['missed']);
        $this->assertSame([8, 10, false], [$summary['daily_goal']['answered'], $summary['daily_goal']['goal'], $summary['daily_goal']['reached']]);
        $this->assertSame(1, $summary['streak_days']);
        $this->assertFalse($summary['can_retry_missed']);

        $stored = VocabularyAttempt::findOrFail($attempt);
        $this->assertTrue($stored->isSubmitted());
        $this->assertSame([100, true], [$stored->score, $stored->passed]);
    }

    public function test_the_summary_lists_each_missed_word_once_with_its_meaning_and_offers_a_retry(): void
    {
        $this->libraryPool(10);
        $attempt = $this->startDaily();
        $total = count(VocabularyAttempt::findOrFail($attempt)->questions);
        $victim = $this->key($attempt, 0)['word_id'];

        $last = null;
        foreach (range(0, $total - 1) as $i) {
            $q = $this->key($attempt, $i);
            $last = $this->answer($attempt, $i, $q['word_id'] === $victim ? $this->wrong($q) : $this->correct($q))->json();
        }

        $summary = $last['summary'];
        $this->assertCount(1, $summary['missed'], 'asked twice, listed once');
        $this->assertSame($victim, $summary['missed'][0]['word_id']);
        $this->assertNotSame('', $summary['missed'][0]['meaning']);
        $this->assertSame(75, $summary['score']);
        $this->assertSame(3, $summary['words_moved_up']);
        $this->assertTrue($summary['can_retry_missed']);
    }

    public function test_reaching_the_daily_goal_is_reported(): void
    {
        $words = $this->libraryPool(14);
        foreach ($words->take(8) as $word) {
            $this->progress($this->student, $word, ['box' => 2]);
        }
        $attempt = $this->startDaily(); // 2 new words (x2) + 8 reviews = 12 questions
        $total = count(VocabularyAttempt::findOrFail($attempt)->questions);
        $this->assertSame(12, $total);

        $last = null;
        foreach (range(0, $total - 1) as $i) {
            $last = $this->answer($attempt, $i, $this->correct($this->key($attempt, $i)))->json();
        }

        $this->assertTrue($last['summary']['daily_goal']['reached']);
        $this->assertSame(12, $last['summary']['daily_goal']['answered']);
    }

    public function test_answering_after_the_session_is_complete_just_replays_the_stored_result(): void
    {
        $this->libraryPool(10);
        $attempt = $this->startDaily();
        $total = count(VocabularyAttempt::findOrFail($attempt)->questions);
        foreach (range(0, $total - 1) as $i) {
            $this->answer($attempt, $i, $this->correct($this->key($attempt, $i)));
        }

        $replay = $this->answer($attempt, 0, $this->wrong($this->key($attempt, 0)))->assertStatus(200)->json();

        $this->assertTrue($replay['is_correct']);
        $this->assertTrue($replay['complete']);
        $this->assertSame($total, VocabularyAnswer::count());
    }

    // ---- resuming ------------------------------------------------------------------------------------

    public function test_a_session_can_be_picked_up_where_it_was_left(): void
    {
        $this->libraryPool(10);
        $attempt = $this->startDaily();
        $fresh = $this->getJson("/api/learning-centre/vocabulary/attempts/{$attempt}")->json();
        $this->assertCount(4, $fresh['cards'], 'a session nobody has started still introduces its new words');

        $q0 = $this->key($attempt, 0);
        $q1 = $this->key($attempt, 1);
        $this->answer($attempt, 0, $q0['correct_index']);
        $this->answer($attempt, 1, $this->wrong($q1));

        $resumed = $this->getJson("/api/learning-centre/vocabulary/attempts/{$attempt}")->assertStatus(200)->json();

        $this->assertSame(2, $resumed['answered']);
        $this->assertFalse($resumed['complete']);
        $this->assertSame([], $resumed['cards'], 'no re-introducing words once the practice is under way');
        $this->assertSame([true, false], array_column($resumed['results'], 'is_correct'));
        $this->assertSame($q1['correct_index'], $resumed['results'][1]['correct_index']);
        $this->assertCount(8, $resumed['questions']);
        $this->assertArrayNotHasKey('correct_index', $resumed['questions'][5], 'unanswered questions stay sealed');
    }

    // ---- end to end on the real library ----------------------------------------------------------------

    public function test_a_full_first_day_on_the_real_library_leaves_exactly_the_right_memory_behind(): void
    {
        $this->seed(VocabularyWordSeeder::class);
        $attempt = $this->startDaily();
        $total = count(VocabularyAttempt::findOrFail($attempt)->questions);

        foreach (range(0, $total - 1) as $i) {
            $this->answer($attempt, $i, $this->correct($this->key($attempt, $i)))->assertStatus(200);
        }

        $rows = VocabularyWordProgress::with('word')->where('user_id', $this->student->id)->get();
        $this->assertSame(['agenda', 'deadline', 'minutes', 'postpone'], $rows->pluck('word.word')->sort()->values()->all());
        foreach ($rows as $row) {
            $this->assertSame([1, 1], [$row->box, $row->seen_count], 'asked twice, counted once');
            $this->assertSame(today()->addDay()->toDateString(), $row->due_on->toDateString());
        }

        // Tomorrow those four are due, and a new sprint reviews them alongside fresh words.
        $this->travelTo(now()->addDay());
        $next = $this->postJson('/api/learning-centre/vocabulary/sessions', ['kind' => 'daily'])->assertStatus(201)->json();
        $this->assertSame(4, $next['review_count']);
        $this->assertSame(4, $next['new_count']);
        $this->assertSame(12, $next['total']);
    }
}
