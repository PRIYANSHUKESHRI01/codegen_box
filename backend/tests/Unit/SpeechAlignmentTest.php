<?php

namespace Tests\Unit;

use App\Support\SpeechAlignment;
use PHPUnit\Framework\TestCase;

class SpeechAlignmentTest extends TestCase
{
    private const PASSAGE = "Every morning, I wake up at seven o'clock and get ready for the day. I brush my teeth, take a quick shower, and eat a simple breakfast.";

    private function statuses(array $result): array
    {
        return array_column($result['words'], 'status', 'word');
    }

    public function test_a_perfect_read_is_one_hundred_percent_and_ignores_punctuation_and_case(): void
    {
        $heard = "every morning i wake up at seven o'clock and get ready for the day i brush my teeth take a quick shower and eat a simple breakfast";

        $r = SpeechAlignment::align(self::PASSAGE, $heard);

        $this->assertSame(100, $r['accuracy']);
        $this->assertSame($r['total'], $r['matched']);
        $this->assertSame(0, $r['extra']);
    }

    public function test_skipped_words_are_reported_as_missed_and_lower_accuracy(): void
    {
        $r = SpeechAlignment::align(self::PASSAGE, 'every morning i wake up at seven oclock and get ready for the day');

        $this->assertSame(27, $r['total']);
        $this->assertSame(14, $r['matched']);
        $this->assertSame(13, $r['missed']);
        $this->assertSame(52, $r['accuracy']); // 14 / 27
        $this->assertSame('missed', $r['words'][26]['status']); // the very last word, "breakfast."
    }

    public function test_a_different_word_is_flagged_with_what_was_heard(): void
    {
        $heard = "every morning i wake up at seven o'clock and get ready for the day i brush my teeth take a quick shore and eat a simple breakfast";

        $r = SpeechAlignment::align(self::PASSAGE, $heard);

        $shower = collect($r['words'])->firstWhere('word', 'shower,');
        $this->assertSame('wrong', $shower['status']);
        $this->assertSame('shore', $shower['heard']);
        $this->assertSame(1, $r['wrong']);
        $this->assertSame(96, $r['accuracy']);
    }

    public function test_a_near_identical_word_is_close_and_earns_half_credit(): void
    {
        $r = SpeechAlignment::align('I read the messages today', 'i read the message today');

        $this->assertSame('close', collect($r['words'])->firstWhere('word', 'messages')['status']);
        $this->assertSame(90, $r['accuracy']); // (4 + 0.5) / 5
    }

    public function test_filler_sounds_are_removed_and_counted_not_treated_as_extra_words(): void
    {
        $r = SpeechAlignment::align('I wake up at seven', 'um i uh wake up at er seven');

        $this->assertSame(100, $r['accuracy']);
        $this->assertSame(3, $r['filler_count']);
        $this->assertSame(0, $r['extra']);
    }

    public function test_spoken_numbers_match_digits_and_split_compounds_match(): void
    {
        // A transcriber may write "8:30" for "eight thirty" and "o clock" for "o'clock"; neither is a reading error.
        $r = SpeechAlignment::align("I leave at eight thirty by seven o'clock", 'i leave at 8:30 by seven o clock');

        $this->assertSame(100, $r['accuracy']);
    }

    public function test_a_word_split_in_two_by_the_transcriber_is_not_an_error(): void
    {
        $this->assertSame(100, SpeechAlignment::align('a simple breakfast', 'a simple break fast')['accuracy']);
    }

    public function test_added_words_are_counted_and_slightly_reduce_accuracy(): void
    {
        $r = SpeechAlignment::align('I wake up at seven', 'i really wake up at around seven');

        $this->assertSame(2, $r['extra']);
        $this->assertSame(83, $r['accuracy']); // 5 / (5 + 0.5*2)
    }

    public function test_reading_a_completely_different_passage_scores_near_zero(): void
    {
        $r = SpeechAlignment::align(self::PASSAGE, 'last weekend i visited a park near my house with two of my friends');

        $this->assertLessThan(20, $r['accuracy']);
    }

    public function test_nothing_heard_means_everything_is_missed(): void
    {
        $r = SpeechAlignment::align('one two three', '');

        $this->assertSame(0, $r['accuracy']);
        $this->assertSame(3, $r['missed']);
        $this->assertSame(0, SpeechAlignment::spokenWordCount('um uh'));
    }

    public function test_repeated_words_and_false_starts_are_extra_not_fatal(): void
    {
        $r = SpeechAlignment::align('I wake up at seven', 'i i wake wake up at seven');

        $this->assertSame(5, $r['matched']);
        $this->assertSame(2, $r['extra']);
        $this->assertGreaterThan(80, $r['accuracy']);
    }

    public function test_display_words_keep_the_passages_own_punctuation(): void
    {
        $r = SpeechAlignment::align('Hello, world!', 'hello world');

        $this->assertSame(['Hello,', 'world!'], array_column($r['words'], 'word'));
    }

    public function test_hyphenated_passage_words_align_on_their_parts(): void
    {
        $r = SpeechAlignment::align('my final-year project', 'my final year project');

        $this->assertSame(100, $r['accuracy']);
        $this->assertCount(3, $r['words']); // still three display words
    }
}
