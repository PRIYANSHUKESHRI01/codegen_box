<?php

namespace Tests\Unit;

use App\Support\ListeningScript;
use PHPUnit\Framework\TestCase;

/**
 * The sentence split is a contract between the server (evidence indexes), the
 * seeder (quote -> index) and the audio player (speaks one sentence at a
 * time), so its edge cases are pinned down here.
 */
class ListeningScriptTest extends TestCase
{
    public function test_splits_on_terminal_punctuation_followed_by_whitespace(): void
    {
        $this->assertSame(
            ['It opens at nine.', 'Is that right?', 'Yes, it is!'],
            ListeningScript::splitText('It opens at nine. Is that right? Yes, it is!')
        );
    }

    public function test_a_closing_quote_stays_with_its_sentence(): void
    {
        $text = 'Counselors ask "what problems do I enjoy solving." This shift helps students.';

        $this->assertSame(
            ['Counselors ask "what problems do I enjoy solving."', 'This shift helps students.'],
            ListeningScript::splitText($text)
        );
    }

    public function test_decimals_and_unpunctuated_tails_do_not_split(): void
    {
        $this->assertSame(['The fee is 3.5 percent higher.', 'No full stop here'], ListeningScript::splitText('The fee is 3.5 percent higher. No full stop here'));
    }

    public function test_whitespace_and_empty_input_are_normalised(): void
    {
        $this->assertSame(['One.', 'Two.'], ListeningScript::splitText("  One.\n\n  Two.  "));
        $this->assertSame([], ListeningScript::splitText('   '));
    }

    public function test_conversation_sentences_carry_their_speaker_and_a_global_index(): void
    {
        $turns = [
            ['speaker' => 'A', 'text' => 'Hello there. How are you?'],
            ['speaker' => 'B', 'text' => 'Fine, thanks.'],
        ];

        $sentences = ListeningScript::sentences(ListeningScript::flatten($turns), $turns);

        $this->assertSame(
            [
                ['index' => 0, 'text' => 'Hello there.', 'speaker' => 'A'],
                ['index' => 1, 'text' => 'How are you?', 'speaker' => 'A'],
                ['index' => 2, 'text' => 'Fine, thanks.', 'speaker' => 'B'],
            ],
            $sentences
        );
        $this->assertSame('Hello there. How are you? Fine, thanks.', ListeningScript::flatten($turns));
    }

    public function test_a_single_speaker_passage_has_no_speaker(): void
    {
        $sentences = ListeningScript::sentences('First one. Second one.', null);

        $this->assertCount(2, $sentences);
        $this->assertNull($sentences[0]['speaker']);
        $this->assertSame(1, $sentences[1]['index']);
    }

    public function test_locate_finds_the_one_sentence_containing_a_quote_ignoring_case_and_punctuation(): void
    {
        $sentences = ListeningScript::sentences('The talk starts at nine. Lunch is at one o\'clock. Bring your ID card.', null);

        $this->assertSame(0, ListeningScript::locate($sentences, 'STARTS AT NINE'));
        $this->assertSame(1, ListeningScript::locate($sentences, 'lunch is at one oclock'));
        $this->assertSame(2, ListeningScript::locate($sentences, 'bring your id card'));
    }

    public function test_locate_refuses_missing_ambiguous_or_too_short_quotes(): void
    {
        $sentences = ListeningScript::sentences('We meet at noon today. We meet at noon again tomorrow. Bring a pen.', null);

        $this->assertNull(ListeningScript::locate($sentences, 'a quote that is not there'));
        $this->assertNull(ListeningScript::locate($sentences, 'we meet at noon'), 'matches two sentences, so it must not guess');
        $this->assertNull(ListeningScript::locate($sentences, 'pen'), 'too short to be trustworthy');
        $this->assertNull(ListeningScript::locate($sentences, ''));
    }

    public function test_estimated_duration_scales_with_length_and_has_a_floor(): void
    {
        $this->assertSame(5, ListeningScript::estimateSeconds('Hi there.'));
        $this->assertGreaterThan(40, ListeningScript::estimateSeconds(implode(' ', array_fill(0, 100, 'word'))));
    }
}
