<?php

namespace Tests\Unit;

use App\Support\VocabularyDecks;
use App\Support\VocabularyText;
use Database\Seeders\VocabularyWordBank;
use PHPUnit\Framework\TestCase;

/**
 * Guards the authored Vocabulary Sprint library. Content is where a trainer
 * like this lives or dies: one ambiguous question teaches a student the wrong
 * thing and costs their trust, so every rule a machine can check is checked
 * here — and a failure names the offending word.
 */
class VocabularyWordBankTest extends TestCase
{
    /** @var array<int, array<string, mixed>> */
    private array $words;

    protected function setUp(): void
    {
        parent::setUp();
        $this->words = VocabularyWordBank::words();
    }

    public function test_the_library_has_eight_decks_of_twenty_words(): void
    {
        $this->assertCount(160, $this->words);

        $perDeck = array_count_values(array_column($this->words, 'deck'));
        $this->assertSame(VocabularyDecks::slugs(), array_keys($perDeck), 'every deck is filled, in learning-path order');
        foreach ($perDeck as $deck => $count) {
            $this->assertSame(20, $count, "deck {$deck}");
        }
    }

    public function test_words_are_unique_and_sort_order_follows_the_authored_order(): void
    {
        $lowered = array_map(fn ($w) => mb_strtolower($w['word']), $this->words);
        $this->assertSame([], array_keys(array_filter(array_count_values($lowered), fn ($n) => $n > 1)), 'no word appears twice');

        foreach ($this->words as $w) {
            $this->assertGreaterThanOrEqual(1, $w['sort_order']);
            $this->assertLessThanOrEqual(20, $w['sort_order']);
        }
    }

    public function test_every_entry_is_complete_and_sensibly_sized(): void
    {
        foreach ($this->words as $w) {
            $name = $w['word'];

            $this->assertContains($w['level'], ['beginner', 'intermediate', 'advanced'], $name);
            $this->assertNotSame('', trim($w['part_of_speech']), $name);
            $this->assertSame(trim($name), $name, "{$name}: stray whitespace");
            $this->assertLessThanOrEqual(80, mb_strlen($name), $name);

            $this->assertGreaterThanOrEqual(8, mb_strlen($w['meaning']), "{$name}: meaning too short");
            $this->assertLessThanOrEqual(100, mb_strlen($w['meaning']), "{$name}: meaning too long for an answer option");
            $this->assertMatchesRegularExpression('/^[a-z\']/u', $w['meaning'], "{$name}: meaning starts lower-case so it reads after 'means'");
            $this->assertDoesNotMatchRegularExpression('/[.]$/', $w['meaning'], "{$name}: meaning has no trailing full stop");

            $this->assertGreaterThanOrEqual(20, mb_strlen($w['example']), $name);
            $this->assertLessThanOrEqual(170, mb_strlen($w['example']), "{$name}: example too long");
            $this->assertMatchesRegularExpression('/[.!?]$/', $w['example'], "{$name}: example is a full sentence");

            $this->assertGreaterThanOrEqual(1, count($w['synonyms']), $name);
            $this->assertLessThanOrEqual(3, count($w['synonyms']), $name);
            if ($w['note'] !== null) {
                $this->assertLessThanOrEqual(255, mb_strlen($w['note']), $name);
            }
        }
    }

    public function test_the_example_uses_the_headword_exactly_once_so_blanking_it_cannot_leak_it(): void
    {
        foreach ($this->words as $w) {
            $blanked = VocabularyText::blank($w['example'], $w['word']);
            $this->assertNotNull($blanked, "{$w['word']}: the example must contain the headword as a whole word");
            $this->assertSame(1, substr_count($blanked, VocabularyText::BLANK), $w['word']);
            $this->assertNull(VocabularyText::blank($blanked, $w['word']), "{$w['word']}: appears more than once in its own example");
        }
    }

    public function test_a_meaning_never_contains_its_own_word_or_its_stem(): void
    {
        foreach ($this->words as $w) {
            $this->assertNull(VocabularyText::blank($w['meaning'], $w['word']), "{$w['word']}: meaning contains the word");

            if (mb_strlen($w['word']) < 7 || str_contains($w['word'], ' ')) {
                continue;
            }
            $stem = mb_substr(mb_strtolower($w['word']), 0, 6);
            preg_match_all('/[a-z]+/', mb_strtolower($w['meaning']), $tokens);
            foreach ($tokens[0] as $token) {
                $this->assertNotSame($stem, mb_substr($token, 0, 6), "{$w['word']}: meaning uses '{$token}', a giveaway");
            }
        }
    }

    public function test_every_word_has_three_distinct_wrong_answers_that_are_not_synonyms(): void
    {
        foreach ($this->words as $w) {
            $name = mb_strtolower($w['word']);
            $distractors = array_map('mb_strtolower', $w['distractors']);
            $synonyms = array_map('mb_strtolower', $w['synonyms']);

            $this->assertCount(3, $distractors, $w['word']);
            $this->assertCount(3, array_unique($distractors), "{$w['word']}: duplicate wrong answers");
            $this->assertNotContains($name, $distractors, "{$w['word']}: the answer is among its own wrong answers");
            $this->assertSame([], array_values(array_intersect($distractors, $synonyms)), "{$w['word']}: a wrong answer is a synonym");
            $this->assertSame([], array_values(array_intersect($synonyms, [$name])), $w['word']);
        }
    }

    public function test_a_synonym_is_never_another_headword(): void
    {
        $headwords = array_flip(array_map(fn ($w) => mb_strtolower($w['word']), $this->words));

        foreach ($this->words as $w) {
            foreach ($w['synonyms'] as $synonym) {
                $this->assertArrayNotHasKey(mb_strtolower($synonym), $headwords, "{$w['word']}: synonym '{$synonym}' is itself a headword, so two words would mean the same thing");
            }
        }
    }

    public function test_the_article_before_a_blank_never_gives_the_answer_away(): void
    {
        $vowelSound = function (string $word): bool {
            $word = mb_strtolower($word);
            if (preg_match('/^(uni|use|eu|one)/', $word)) {
                return false;
            }
            if (preg_match('/^(hour|honest|honour)/', $word)) {
                return true;
            }

            return (bool) preg_match('/^[aeiou]/', $word);
        };

        foreach ($this->words as $w) {
            $blanked = VocabularyText::blank($w['example'], $w['word']);
            if (! preg_match('/\b(a|an) '.preg_quote(VocabularyText::BLANK, '/').'/i', $blanked)) {
                continue;
            }

            $expected = $vowelSound($w['word']);
            foreach ($w['distractors'] as $distractor) {
                $this->assertSame($expected, $vowelSound($distractor), "{$w['word']}: 'a/an' before the blank rules out '{$distractor}'");
            }
        }
    }

    public function test_look_alike_partners_point_at_each_other(): void
    {
        $byWord = [];
        foreach ($this->words as $w) {
            $byWord[mb_strtolower($w['word'])] = $w;
        }

        $pairs = 0;
        foreach ($this->words as $w) {
            if ($w['pair_word'] === null) {
                continue;
            }
            $pairs++;
            $partner = $byWord[mb_strtolower($w['pair_word'])] ?? null;
            $this->assertNotNull($partner, "{$w['word']}: partner '{$w['pair_word']}' is not in the library");
            $this->assertSame(mb_strtolower($w['word']), mb_strtolower((string) $partner['pair_word']), "{$w['word']}: pairing is not mutual");
            $this->assertSame('confusing-pairs', $w['deck']);
            $this->assertContains(mb_strtolower($w['pair_word']), array_map('mb_strtolower', $w['distractors']), "{$w['word']}: its look-alike must be one of its wrong answers");
        }
        $this->assertSame(20, $pairs, 'the whole look-alike deck is paired');
    }

    public function test_no_two_words_in_a_deck_have_a_near_identical_meaning(): void
    {
        $stop = array_flip(explode(' ', 'a an the to of or and in on for that is are be it with by as at from so up who which someone something you your their they them can into than not no more most very any all one when what how while without'));
        $tokens = function (string $text) use ($stop): array {
            preg_match_all("/[a-z']+/", mb_strtolower($text), $m);

            return array_values(array_unique(array_filter(array_map(
                fn ($t) => rtrim($t, 's'),
                array_filter($m[0], fn ($t) => ! isset($stop[$t]) && strlen($t) > 2)
            ))));
        };

        $count = count($this->words);
        for ($i = 0; $i < $count; $i++) {
            for ($j = $i + 1; $j < $count; $j++) {
                $a = $tokens($this->words[$i]['meaning']);
                $b = $tokens($this->words[$j]['meaning']);
                $union = count(array_unique(array_merge($a, $b)));
                $similarity = $union === 0 ? 0 : count(array_intersect($a, $b)) / $union;

                $this->assertLessThan(0.5, $similarity, "'{$this->words[$i]['word']}' and '{$this->words[$j]['word']}' have near-identical meanings");
            }
        }
    }

    public function test_decks_cover_every_level_so_a_beginner_and_an_advanced_student_both_have_a_start(): void
    {
        $byDeck = [];
        foreach ($this->words as $w) {
            $byDeck[$w['deck']][] = $w['level'];
        }

        $this->assertContains('beginner', $byDeck['workplace-essentials']);
        $this->assertContains('advanced', $byDeck['reasoning-and-verbal']);
        foreach (VocabularyDecks::all() as $slug => $deck) {
            $this->assertContains($deck['level'], ['beginner', 'intermediate', 'advanced'], $slug);
            $this->assertNotSame('', $deck['title']);
            $this->assertNotSame('', $deck['tagline']);
        }
    }
}
