<?php

namespace Tests\Feature;

use App\Models\VocabularyAttempt;
use App\Models\VocabularyWord;
use Database\Seeders\VocabularyWordSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\BuildsVocabularyWords;
use Tests\TestCase;

/**
 * What goes into a practice session, and the rules for starting, resuming and
 * authorising one.
 */
class VocabularySessionTest extends TestCase
{
    use BuildsVocabularyWords;
    use RefreshDatabase;

    private function start(array $payload = ['kind' => 'daily'])
    {
        return $this->postJson('/api/learning-centre/vocabulary/sessions', $payload);
    }

    /** The stored (answer-key) questions of a session — what the server holds, not what the browser gets. */
    private function stored(int $attemptId): array
    {
        return VocabularyAttempt::findOrFail($attemptId)->questions;
    }

    private function wordIds(int $attemptId): array
    {
        return array_values(array_unique(array_column($this->stored($attemptId), 'word_id')));
    }

    // ---- a first-day student ------------------------------------------------------------------

    public function test_a_new_student_meets_four_new_words_and_is_asked_about_each_of_them_twice(): void
    {
        $this->seed(VocabularyWordSeeder::class);
        Sanctum::actingAs($this->vocabStudent());

        $body = $this->start()->assertStatus(201)->json();

        $this->assertSame('daily', $body['kind']);
        $this->assertSame(8, $body['total']);
        $this->assertSame([4, 0], [$body['new_count'], $body['review_count']]);
        $this->assertFalse($body['practice']);

        // The first deck on the learning path, in authored order.
        $this->assertSame(['deadline', 'agenda', 'minutes', 'postpone'], array_column($body['cards'], 'word'));

        $questions = $body['questions'];
        $this->assertSame(array_fill(0, 4, 'meaning'), array_column(array_slice($questions, 0, 4), 'type'), 'every new word starts with recognition');
        $this->assertSame([false, false, false, false], array_column(array_slice($questions, 0, 4), 'is_echo'));
        $this->assertSame([true, true, true, true], array_column(array_slice($questions, 4), 'is_echo'), 'the second look comes later in the session');
        $this->assertNotContains('meaning', array_column(array_slice($questions, 4), 'type'), 'and from a different angle');
    }

    public function test_the_browser_receives_no_answers_in_a_session(): void
    {
        $this->seed(VocabularyWordSeeder::class);
        Sanctum::actingAs($this->vocabStudent());

        $body = $this->start()->json();

        foreach ($body['questions'] as $q) {
            foreach (['correct_index', 'answer', 'explanation', 'example', 'meaning', 'synonyms', 'word_id'] as $secret) {
                $this->assertArrayNotHasKey($secret, $q, $secret);
            }
        }
        $this->assertSame([], $body['results']);
        $this->assertNull($body['summary']);
    }

    // ---- reviews and the new-word allowance ----------------------------------------------------

    public function test_due_reviews_come_first_and_a_bigger_backlog_means_fewer_new_words(): void
    {
        foreach ([[3, 4, 3], [6, 3, 6], [9, 3, 6], [10, 2, 8], [30, 2, 8]] as [$due, $expectedNew, $expectedReviews]) {
            $student = $this->vocabStudent();
            Sanctum::actingAs($student);
            VocabularyWord::query()->delete();
            $words = collect(range(1, 40))->map(fn ($i) => $this->libraryWord("w{$i}x", ['sort_order' => $i]));
            foreach ($words->take($due) as $word) {
                $this->progress($student, $word, ['box' => 2]);
            }

            $body = $this->start()->assertStatus(201)->json();

            $this->assertSame([$expectedNew, $expectedReviews], [$body['new_count'], $body['review_count']], "{$due} due");
            $this->assertLessThanOrEqual(12, $body['total'], 'a sprint is always short');
        }
    }

    public function test_the_words_closest_to_being_forgotten_are_reviewed_first(): void
    {
        $student = $this->vocabStudent();
        Sanctum::actingAs($student);
        $words = collect(range(1, 14))->map(fn ($i) => $this->libraryWord("w{$i}x", ['sort_order' => $i]));
        foreach ($words as $i => $word) {
            $this->progress($student, $word, ['box' => 2, 'due_on' => today()->subDays(20 - $i)]); // w1x is the most overdue
        }
        $this->libraryPool(6); // unseen words, so the review allowance is the usual eight

        $attempt = $this->start()->json('attempt_id');

        $reviewed = collect($this->stored($attempt))->where('is_new', false)->where('is_echo', false)->pluck('word')->all();
        $this->assertEqualsCanonicalizing(['w1x', 'w2x', 'w3x', 'w4x', 'w5x', 'w6x', 'w7x', 'w8x'], $reviewed);
    }

    public function test_a_review_that_is_not_due_yet_is_left_alone(): void
    {
        $student = $this->vocabStudent();
        Sanctum::actingAs($student);
        $words = $this->libraryPool(10);
        $this->progress($student, $words[0], ['box' => 3, 'due_on' => today()->addDays(5)]);

        $attempt = $this->start()->json('attempt_id');

        $this->assertNotContains($words[0]->id, $this->wordIds($attempt));
    }

    public function test_a_review_question_is_pitched_at_the_strength_of_the_word(): void
    {
        $student = $this->vocabStudent();
        Sanctum::actingAs($student);
        $words = $this->libraryPool(12);
        foreach ([[0, 1], [1, 2], [2, 3], [3, 4]] as [$i, $box]) {
            $this->progress($student, $words[$i], ['box' => $box]);
        }

        $attempt = $this->start()->json('attempt_id');
        $typeByWord = collect($this->stored($attempt))->where('is_new', false)->pluck('type', 'word')->all();

        $this->assertSame('word', $typeByWord['alpha'], 'box 1');
        $this->assertSame('cloze', $typeByWord['bravo'], 'box 2');
        $this->assertSame('cloze', $typeByWord['charlie'], 'box 3');
        $this->assertSame('recall', $typeByWord['delta'], 'box 4 is typed from memory');
    }

    // ---- other kinds of session -----------------------------------------------------------------

    public function test_a_deck_session_stays_inside_its_deck(): void
    {
        $student = $this->vocabStudent();
        Sanctum::actingAs($student);
        $work = $this->libraryPool(8, 'workplace-essentials');
        $tech = collect(['quartz', 'zephyr', 'yonder', 'xenon', 'walrus', 'velvet'])->map(fn ($w, $i) => $this->libraryWord($w, ['deck' => 'tech-and-engineering', 'sort_order' => $i + 1]));
        $this->progress($student, $work[0]); // due, but in another deck
        $this->progress($student, $tech[0]);  // due, in the deck being practised

        $attempt = $this->start(['kind' => 'deck', 'deck' => 'tech-and-engineering'])->assertStatus(201)->json();

        $this->assertSame('deck', $attempt['kind']);
        $this->assertSame('tech-and-engineering', $attempt['deck']);
        $this->assertSame('Tech & engineering', $attempt['title']);
        $decks = VocabularyWord::whereIn('id', $this->wordIds($attempt['attempt_id']))->pluck('deck')->unique()->all();
        $this->assertSame(['tech-and-engineering'], $decks);
        $this->assertContains($tech[0]->id, $this->wordIds($attempt['attempt_id']));
    }

    public function test_with_nothing_due_and_nothing_new_the_student_still_gets_free_practice(): void
    {
        $student = $this->vocabStudent();
        Sanctum::actingAs($student);
        foreach ($this->libraryPool(8) as $word) {
            $this->progress($student, $word, ['box' => 2, 'due_on' => today()->addDays(4)]);
        }

        $body = $this->start()->assertStatus(201)->json();

        $this->assertTrue($body['practice']);
        $this->assertSame('Free practice', $body['title']);
        $this->assertSame([], $body['cards']);
        $this->assertSame(8, $body['total']);
    }

    public function test_a_weak_words_session_contains_only_weak_words(): void
    {
        $student = $this->vocabStudent();
        Sanctum::actingAs($student);
        $words = $this->libraryPool(8);
        $this->progress($student, $words[0], ['seen_count' => 5, 'correct_count' => 1, 'box' => 1]);
        $this->progress($student, $words[1], ['seen_count' => 4, 'correct_count' => 0, 'box' => 0]);
        $this->progress($student, $words[2], ['seen_count' => 5, 'correct_count' => 5, 'box' => 3]); // strong

        $body = $this->start(['kind' => 'weak'])->assertStatus(201)->json();

        $this->assertSame('Fix your weak words', $body['title']);
        $this->assertEqualsCanonicalizing([$words[0]->id, $words[1]->id], $this->wordIds($body['attempt_id']));
        $this->assertSame([], $body['cards'], 'weak words are not new');
    }

    public function test_there_is_a_friendly_refusal_when_no_word_is_weak(): void
    {
        $student = $this->vocabStudent();
        Sanctum::actingAs($student);
        $this->progress($student, $this->libraryPool(6)[0], ['seen_count' => 5, 'correct_count' => 5, 'box' => 3]);

        $this->start(['kind' => 'weak'])->assertStatus(422)->assertJsonPath('message', fn ($m) => str_contains($m, 'No weak words'));
    }

    public function test_the_words_missed_in_a_session_can_be_practised_straight_away(): void
    {
        $student = $this->vocabStudent();
        Sanctum::actingAs($student);
        $this->libraryPool(10);
        $first = $this->start()->json();

        // Answer everything correctly except the first two distinct words.
        $stored = $this->stored($first['attempt_id']);
        $missed = [];
        foreach ($stored as $i => $q) {
            $wrong = count($missed) < 2 && ! in_array($q['word_id'], $missed, true) && ! $q['is_echo'];
            if ($wrong) {
                $missed[] = $q['word_id'];
            }
            $answer = in_array($q['word_id'], $missed, true) ? ($q['correct_index'] + 1) % 4 : $q['correct_index'];
            $this->postJson("/api/learning-centre/vocabulary/attempts/{$first['attempt_id']}/answer", ['index' => $i, 'answer' => $answer])->assertStatus(200);
        }

        $retry = $this->start(['kind' => 'weak', 'from_attempt' => $first['attempt_id']])->assertStatus(201)->json();

        $this->assertSame('Practise your missed words', $retry['title']);
        $this->assertEqualsCanonicalizing($missed, $this->wordIds($retry['attempt_id']));
    }

    // ---- starting, resuming, refusing -----------------------------------------------------------

    public function test_tapping_start_twice_resumes_the_same_session_instead_of_splitting_it(): void
    {
        Sanctum::actingAs($this->vocabStudent());
        $this->libraryPool(10);

        $first = $this->start()->assertStatus(201)->json('attempt_id');
        $again = $this->start()->assertStatus(200)->json('attempt_id');

        $this->assertSame($first, $again);
        $this->assertSame(1, VocabularyAttempt::count());
    }

    public function test_a_finished_session_is_not_resumed_and_each_kind_resumes_independently(): void
    {
        $student = $this->vocabStudent();
        Sanctum::actingAs($student);
        $this->libraryPool(10);

        $first = $this->start()->json('attempt_id');
        VocabularyAttempt::whereKey($first)->update(['submitted_at' => now()]);
        $second = $this->start()->assertStatus(201)->json('attempt_id');
        $deck = $this->start(['kind' => 'deck', 'deck' => 'workplace-essentials'])->assertStatus(201)->json('attempt_id');

        $this->assertNotSame($first, $second);
        $this->assertNotSame($second, $deck);
    }

    public function test_an_old_unfinished_session_is_not_resumed(): void
    {
        $student = $this->vocabStudent();
        Sanctum::actingAs($student);
        $this->libraryPool(10);
        $stale = $this->start()->json('attempt_id');
        VocabularyAttempt::whereKey($stale)->update(['created_at' => now()->subHours(13)]);

        $this->assertNotSame($stale, $this->start()->assertStatus(201)->json('attempt_id'));
    }

    public function test_request_validation(): void
    {
        Sanctum::actingAs($this->vocabStudent());

        $this->start([])->assertStatus(422)->assertJsonValidationErrors('kind');
        $this->start(['kind' => 'custom'])->assertStatus(422)->assertJsonValidationErrors('kind');
        $this->start(['kind' => 'deck'])->assertStatus(422)->assertJsonValidationErrors('deck');
        $this->start(['kind' => 'deck', 'deck' => 'no-such-deck'])->assertStatus(422)->assertJsonValidationErrors('deck');
        $this->start(['kind' => 'daily', 'from_attempt' => 1])->assertStatus(422);
    }

    public function test_missed_words_of_someone_elses_session_are_off_limits(): void
    {
        $owner = $this->vocabStudent();
        $this->libraryPool(10);
        $attempt = VocabularyAttempt::create(['user_id' => $owner->id, 'kind' => 'daily', 'topic' => 't', 'difficulty' => 'mixed', 'questions' => []]);

        Sanctum::actingAs($this->vocabStudent());
        $this->start(['kind' => 'weak', 'from_attempt' => $attempt->id])->assertStatus(404);
    }

    public function test_an_empty_library_says_so_instead_of_failing(): void
    {
        Sanctum::actingAs($this->vocabStudent());

        $this->start()->assertStatus(422)->assertJsonPath('message', fn ($m) => str_contains($m, 'not ready'));
    }

    public function test_anonymous_visitors_cannot_start_a_session(): void
    {
        $this->start()->assertStatus(401);
    }

    // ---- private words ---------------------------------------------------------------------------

    public function test_a_students_own_saved_words_come_back_for_review_but_nobody_elses_do(): void
    {
        $mine = $this->vocabStudent();
        $theirs = $this->vocabStudent();
        $this->libraryPool(10);
        $myWord = $this->privateWord($mine, 'zebra');
        $theirWord = $this->privateWord($theirs, 'yak');
        $this->progress($mine, $myWord, ['box' => 0]);
        $this->progress($theirs, $theirWord, ['box' => 0]);

        Sanctum::actingAs($mine);
        $attempt = $this->start()->json('attempt_id');

        $this->assertContains($myWord->id, $this->wordIds($attempt));
        $this->assertNotContains($theirWord->id, $this->wordIds($attempt));
    }

    // ---- reading a session back --------------------------------------------------------------------

    public function test_only_the_owner_can_read_a_session(): void
    {
        $owner = $this->vocabStudent();
        $this->libraryPool(10);
        Sanctum::actingAs($owner);
        $attempt = $this->start()->json('attempt_id');

        $this->getJson("/api/learning-centre/vocabulary/attempts/{$attempt}")->assertStatus(200)->assertJsonPath('attempt_id', $attempt);

        Sanctum::actingAs($this->vocabStudent());
        $this->getJson("/api/learning-centre/vocabulary/attempts/{$attempt}")->assertStatus(404);
    }
}
