<?php

namespace Tests\Feature;

use App\Models\VocabularyWordProgress;
use App\Services\VocabularySrsService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\Concerns\BuildsVocabularyWords;
use Tests\TestCase;

/**
 * The spaced-repetition rules. These are the heart of "words mastered" meaning
 * something, so each rule is pinned on its own with a frozen clock.
 */
class VocabularySrsTest extends TestCase
{
    use BuildsVocabularyWords;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow('2026-10-10 10:00:00');
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function srs(): VocabularySrsService
    {
        return app(VocabularySrsService::class);
    }

    public function test_a_correct_first_answer_moves_a_new_word_to_box_one_due_tomorrow(): void
    {
        $student = $this->vocabStudent();
        $word = $this->libraryWord('alpha');

        $change = $this->srs()->record($student->id, $word->id, true);

        $this->assertNull($change['box_before']);
        $this->assertSame(1, $change['box_after']);
        $this->assertTrue($change['was_due']);
        $this->assertTrue($change['moved_up']);
        $this->assertFalse($change['became_mastered']);

        $progress = $change['progress']->fresh();
        $this->assertSame('2026-10-11', $progress->due_on->toDateString());
        $this->assertSame([1, 1, 1, 0], [$progress->seen_count, $progress->correct_count, $progress->streak, $progress->lapse_count]);
    }

    public function test_a_wrong_first_answer_leaves_the_word_in_box_zero_and_due_today(): void
    {
        $student = $this->vocabStudent();
        $word = $this->libraryWord('alpha');

        $change = $this->srs()->record($student->id, $word->id, false);

        $this->assertSame(0, $change['box_after']);
        $this->assertFalse($change['moved_up']);
        $progress = $change['progress']->fresh();
        $this->assertSame('2026-10-10', $progress->due_on->toDateString(), 'comes straight back');
        $this->assertSame([1, 0, 0, 0], [$progress->seen_count, $progress->correct_count, $progress->streak, $progress->lapse_count], 'a first miss is not a lapse — there was nothing to forget yet');
    }

    public function test_each_correct_review_that_is_due_climbs_one_box_on_the_agreed_schedule(): void
    {
        $student = $this->vocabStudent();
        $word = $this->libraryWord('alpha');

        $day = Carbon::parse('2026-10-10');
        $masteredEvents = 0;

        foreach ([1, 2, 3, 4, 5] as $expectedBox) {
            Carbon::setTestNow($day);
            $change = $this->srs()->record($student->id, $word->id, true);

            $this->assertSame($expectedBox, $change['box_after']);
            $expectedDue = $day->copy()->addDays(VocabularySrsService::INTERVAL_DAYS[$expectedBox]);
            $this->assertSame($expectedDue->toDateString(), $change['progress']->fresh()->due_on->toDateString(), "box {$expectedBox}");
            $masteredEvents += $change['became_mastered'] ? 1 : 0;

            $day = $expectedDue;
        }

        Carbon::setTestNow($day);
        $capped = $this->srs()->record($student->id, $word->id, true);

        $this->assertSame(VocabularyWordProgress::MAX_BOX, $capped['box_after'], 'box five is the ceiling');
        $this->assertSame(1, $masteredEvents, 'crossing into mastered is announced exactly once');
        $this->assertNotNull($capped['progress']->fresh()->mastered_at);
        $this->assertSame([1, 3, 7, 16, 35], array_slice(VocabularySrsService::INTERVAL_DAYS, 1), 'the published interval ladder');
    }

    public function test_practising_early_counts_toward_accuracy_but_cannot_rush_a_word_up_the_boxes(): void
    {
        $student = $this->vocabStudent();
        $word = $this->libraryWord('alpha');

        $this->srs()->record($student->id, $word->id, true); // box 1, due tomorrow
        $early = $this->srs()->record($student->id, $word->id, true); // same day, not due

        $this->assertFalse($early['was_due']);
        $this->assertSame(1, $early['box_after']);
        $this->assertFalse($early['moved_up']);
        $progress = $early['progress']->fresh();
        $this->assertSame('2026-10-11', $progress->due_on->toDateString(), 'the schedule is untouched');
        $this->assertSame([2, 2, 2], [$progress->seen_count, $progress->correct_count, $progress->streak]);
    }

    public function test_a_wrong_answer_drops_two_boxes_makes_the_word_due_today_and_loses_mastery(): void
    {
        $student = $this->vocabStudent();
        $word = $this->libraryWord('alpha');
        $this->progress($student, $word, ['box' => 4, 'mastered_at' => now()->subWeek(), 'due_on' => today()->addDays(10), 'streak' => 4, 'seen_count' => 6, 'correct_count' => 6]);

        $change = $this->srs()->record($student->id, $word->id, false);

        $this->assertSame(2, $change['box_after']);
        $progress = $change['progress']->fresh();
        $this->assertSame('2026-10-10', $progress->due_on->toDateString(), 'being wrong is honest even when practising early');
        $this->assertNull($progress->mastered_at);
        $this->assertSame([0, 1], [$progress->streak, $progress->lapse_count]);
    }

    public function test_a_wrong_answer_never_drops_below_box_zero(): void
    {
        $student = $this->vocabStudent();
        $word = $this->libraryWord('alpha');
        $this->progress($student, $word, ['box' => 1]);

        $this->assertSame(0, $this->srs()->record($student->id, $word->id, false)['box_after']);
        $this->assertSame(0, $this->srs()->record($student->id, $word->id, false)['box_after']);
    }

    public function test_an_echo_question_never_moves_the_box_even_when_correct(): void
    {
        $student = $this->vocabStudent();
        $word = $this->libraryWord('alpha');
        $this->srs()->record($student->id, $word->id, true); // primary: box 1, due tomorrow

        $echo = $this->srs()->record($student->id, $word->id, true, primary: false);

        $this->assertSame(1, $echo['box_after']);
        $progress = $echo['progress']->fresh();
        $this->assertSame([1, 1], [$progress->seen_count, $progress->correct_count], 'answering twice in five minutes proves nothing about next month');
        $this->assertSame('2026-10-11', $progress->due_on->toDateString());
    }

    public function test_a_missed_echo_brings_the_word_back_today_without_changing_its_box(): void
    {
        $student = $this->vocabStudent();
        $word = $this->libraryWord('alpha');
        $this->srs()->record($student->id, $word->id, true); // box 1, due tomorrow

        $echo = $this->srs()->record($student->id, $word->id, false, primary: false);

        $this->assertSame(1, $echo['box_after']);
        $progress = $echo['progress']->fresh();
        $this->assertSame('2026-10-10', $progress->due_on->toDateString());
        $this->assertSame(0, $progress->streak);
        $this->assertSame(1, $progress->seen_count);
    }

    public function test_status_buckets_follow_the_box(): void
    {
        $this->assertSame('new', VocabularyWordProgress::statusForBox(null));
        $this->assertSame('learning', VocabularyWordProgress::statusForBox(0));
        $this->assertSame('learning', VocabularyWordProgress::statusForBox(1));
        $this->assertSame('familiar', VocabularyWordProgress::statusForBox(2));
        $this->assertSame('familiar', VocabularyWordProgress::statusForBox(3));
        $this->assertSame('mastered', VocabularyWordProgress::statusForBox(4));
        $this->assertSame('mastered', VocabularyWordProgress::statusForBox(5));
    }

    public function test_a_word_is_weak_after_repeated_misses_or_a_lapse_it_has_not_recovered_from(): void
    {
        $student = $this->vocabStudent();
        $words = $this->libraryPool(4);

        $this->assertTrue($this->progress($student, $words[0], ['seen_count' => 5, 'correct_count' => 2, 'box' => 3])->isWeak());
        $this->assertFalse($this->progress($student, $words[1], ['seen_count' => 5, 'correct_count' => 4, 'box' => 3])->isWeak());
        $this->assertFalse($this->progress($student, $words[2], ['seen_count' => 1, 'correct_count' => 0, 'box' => 0])->isWeak(), 'one miss on a new word is not a pattern');
        $this->assertTrue($this->progress($student, $words[3], ['seen_count' => 3, 'correct_count' => 2, 'lapse_count' => 1, 'box' => 1])->isWeak());
    }

    public function test_next_review_is_described_in_plain_words(): void
    {
        $today = today();

        $this->assertSame('today', VocabularySrsService::describeDue($today));
        $this->assertSame('today', VocabularySrsService::describeDue($today->copy()->subDays(3)), 'overdue still reads as today');
        $this->assertSame('tomorrow', VocabularySrsService::describeDue($today->copy()->addDay()));
        $this->assertSame('in 3 days', VocabularySrsService::describeDue($today->copy()->addDays(3)));
        $this->assertSame('in 3 weeks', VocabularySrsService::describeDue($today->copy()->addDays(20)));
        $this->assertSame('in 2 months', VocabularySrsService::describeDue($today->copy()->addDays(70)));
        $this->assertNull(VocabularySrsService::describeDue(null));
    }
}
