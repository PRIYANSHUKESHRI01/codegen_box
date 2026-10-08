<?php

namespace Tests\Unit;

use App\Support\VocabularyText;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class VocabularyTextTest extends TestCase
{
    // ---- blank ------------------------------------------------------------------------------

    public function test_blank_replaces_the_whole_word_only(): void
    {
        $this->assertSame('We must _____ the risk.', VocabularyText::blank('We must mitigate the risk.', 'mitigate'));
        // "affect" must not be blanked inside "affected".
        $this->assertNull(VocabularyText::blank('The team was affected badly.', 'affect'));
    }

    public function test_blank_is_case_insensitive_and_keeps_the_rest_of_the_sentence(): void
    {
        $this->assertSame('_____ the plan before Friday.', VocabularyText::blank('Approve the plan before Friday.', 'approve'));
    }

    public function test_blank_handles_phrases_and_apostrophes(): void
    {
        $this->assertSame('I will _____ with the recruiter.', VocabularyText::blank('I will follow up with the recruiter.', 'follow up'));
        $this->assertSame('_____ important to reply.', VocabularyText::blank("It's important to reply.", "it's"));
        $this->assertSame('The company announced _____ results.', VocabularyText::blank('The company announced its results.', 'its'));
    }

    public function test_blank_only_replaces_the_first_occurrence_and_returns_null_when_absent(): void
    {
        $this->assertSame('Finish this, _____ that, then done.', VocabularyText::blank('Finish this, then that, then done.', 'then'));
        $this->assertNull(VocabularyText::blank('Nothing to see here.', 'agenda'));
        $this->assertNull(VocabularyText::blank('Anything.', ''));
    }

    public function test_blank_works_with_accented_words(): void
    {
        $this->assertSame('That is a _____ interviewers hear daily.', VocabularyText::blank('That is a cliché interviewers hear daily.', 'cliché'));
    }

    // ---- compare ----------------------------------------------------------------------------

    #[DataProvider('typedAnswers')]
    public function test_compare_judges_a_typed_answer(string $typed, string $word, string $expected): void
    {
        $this->assertSame($expected, VocabularyText::compare($typed, $word));
    }

    public static function typedAnswers(): array
    {
        return [
            'exact' => ['mitigate', 'mitigate', 'exact'],
            'case and spaces ignored' => ['  Mitigate ', 'mitigate', 'exact'],
            'trailing full stop ignored' => ['mitigate.', 'mitigate', 'exact'],
            'one letter missing is a near miss' => ['mitigat', 'mitigate', 'close'],
            'one letter wrong is a near miss' => ['mitigete', 'mitigate', 'close'],
            'one letter extra is a near miss' => ['mitigatee', 'mitigate', 'close'],
            'two letters off is wrong' => ['mitigete1', 'mitigate', 'wrong'],
            'a different word is wrong' => ['postpone', 'mitigate', 'wrong'],
            'short words never count as close' => ['the', 'then', 'wrong'],
            'empty is wrong' => ['', 'mitigate', 'wrong'],
            'accents are folded' => ['cliche', 'cliché', 'exact'],
            'phrase exact' => ['Follow  up', 'follow up', 'exact'],
            'phrase near miss' => ['follow upp', 'follow up', 'close'],
            'curly apostrophe' => ["it\u{2019}s", "it's", 'exact'],
        ];
    }

    // ---- hint -------------------------------------------------------------------------------

    public function test_hint_gives_the_first_letter_and_the_length_but_nothing_else(): void
    {
        $this->assertSame('m _ _ _ _ _ _ _', VocabularyText::hint('mitigate'));
        $this->assertSame(8, VocabularyText::letterCount('mitigate'));
    }

    public function test_hint_separates_the_words_of_a_phrase(): void
    {
        $this->assertSame('f _ _ _ _ _   u _', VocabularyText::hint('follow up'));
        $this->assertSame(8, VocabularyText::letterCount('follow up'));
    }

    public function test_hint_never_reveals_a_second_letter(): void
    {
        $hint = VocabularyText::hint('cliché');
        $this->assertSame('c _ _ _ _ _', $hint);
    }
}
