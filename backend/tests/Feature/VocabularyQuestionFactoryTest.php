<?php

namespace Tests\Feature;

use App\Models\VocabularyAttempt;
use App\Models\VocabularyWord;
use App\Models\VocabularyWordProgress;
use App\Services\VocabularyQuestionFactory;
use Database\Seeders\VocabularyWordSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsVocabularyWords;
use Tests\TestCase;

class VocabularyQuestionFactoryTest extends TestCase
{
    use BuildsVocabularyWords;
    use RefreshDatabase;

    private function factory(int $seed = 7): VocabularyQuestionFactory
    {
        return new VocabularyQuestionFactory($seed);
    }

    // ---- the difficulty ladder ---------------------------------------------------------------

    public function test_the_question_type_gets_harder_as_the_word_gets_stronger(): void
    {
        $word = $this->libraryWord('alpha');
        $factory = $this->factory();
        $at = fn (?int $box) => $factory->typeFor($box === null ? null : new VocabularyWordProgress(['box' => $box]), $word);

        $this->assertSame('meaning', $at(null), 'brand new');
        $this->assertSame('meaning', $at(0), 'lapsed');
        $this->assertSame('word', $at(1));
        $this->assertSame('cloze', $at(2));
        $this->assertSame('cloze', $at(3));
        $this->assertSame('recall', $at(4), 'mastered words are typed from memory');
        $this->assertSame('recall', $at(5));
    }

    public function test_a_word_without_sentence_material_steps_down_from_cloze_to_word(): void
    {
        $word = $this->privateWord($this->vocabStudent(), 'alpha'); // no authored wrong answers

        $this->assertSame('word', $this->factory()->typeFor(new VocabularyWordProgress(['box' => 3]), $word));
    }

    public function test_the_echo_question_approaches_a_new_word_from_a_different_angle(): void
    {
        $withCloze = $this->libraryWord('alpha');
        $withoutCloze = $this->libraryWord('bravo', ['distractors' => null]);
        $factory = $this->factory();

        $this->assertSame('cloze', $factory->echoTypeFor($withCloze, 'meaning'));
        $this->assertSame('word', $factory->echoTypeFor($withoutCloze, 'meaning'));
        $this->assertSame('meaning', $factory->echoTypeFor($withCloze, 'word'));
    }

    // ---- building each type ------------------------------------------------------------------

    public function test_a_meaning_question_offers_the_right_meaning_among_four_distinct_ones(): void
    {
        $pool = $this->libraryPool(8);
        $word = $pool[0];

        $q = $this->factory()->build($word, 'meaning', $pool, isNew: true);

        $this->assertSame('meaning', $q['type']);
        $this->assertCount(4, $q['options']);
        $this->assertCount(4, array_unique($q['options']));
        $this->assertSame($word->meaning, $q['options'][$q['correct_index']]);
        $this->assertSame($word->meaning, $q['answer']);
        $this->assertStringContainsString('alpha', $q['prompt']);
        $this->assertTrue($q['is_new']);
        $this->assertFalse($q['is_echo']);
    }

    public function test_a_word_question_asks_for_the_word_given_its_meaning(): void
    {
        $pool = $this->libraryPool(8);
        $word = $pool[2];

        $q = $this->factory()->build($word, 'word', $pool);

        $this->assertStringContainsString($word->meaning, $q['prompt']);
        $this->assertSame('charlie', $q['options'][$q['correct_index']]);
        $this->assertCount(4, array_unique($q['options']));
    }

    public function test_a_cloze_question_blanks_the_word_and_uses_the_authored_wrong_answers(): void
    {
        $pool = $this->libraryPool(6);
        $word = $pool[0];

        $q = $this->factory()->build($word, 'cloze', $pool);

        $this->assertSame('We discussed the _____ during the review meeting.', $q['sentence']);
        $this->assertEqualsCanonicalizing(['alpha', 'north', 'south', 'east'], $q['options']);
        $this->assertSame('alpha', $q['options'][$q['correct_index']]);
    }

    public function test_cloze_is_not_built_without_three_usable_wrong_answers_or_a_blankable_example(): void
    {
        $pool = $this->libraryPool(6);

        $tooFew = $this->libraryWord('uniform', ['distractors' => ['north', 'NORTH', 'uniform']]); // duplicates + the answer itself
        $noBlank = $this->libraryWord('victor', ['example' => 'We never mention that name here.']);

        $this->assertNull($this->factory()->build($tooFew, 'cloze', $pool));
        $this->assertNull($this->factory()->build($noBlank, 'cloze', $pool));
    }

    public function test_a_recall_question_gives_a_hint_and_has_no_options_to_guess_from(): void
    {
        $pool = $this->libraryPool(6);

        $q = $this->factory()->build($pool[0], 'recall', $pool);

        $this->assertSame('a _ _ _ _', $q['hint']);
        $this->assertSame(5, $q['letters']);
        $this->assertSame(1, $q['word_count']);
        $this->assertArrayNotHasKey('options', $q);
        $this->assertSame('alpha', $q['answer']);
    }

    public function test_a_small_pool_cannot_make_a_multiple_choice_question(): void
    {
        $pool = $this->libraryPool(3);

        $this->assertNull($this->factory()->build($pool[0], 'meaning', $pool));
        $this->assertNull($this->factory()->build($pool[0], 'word', $pool));
        $this->assertNotNull($this->factory()->build($pool[0], 'recall', $pool), 'typing needs no distractors');
    }

    // ---- distractor quality ------------------------------------------------------------------

    public function test_a_listed_synonym_is_never_used_as_a_wrong_answer_in_either_direction(): void
    {
        $pool = collect([
            $this->libraryWord('alpha', ['synonyms' => ['bravo']]),
            $this->libraryWord('bravo'),
            $this->libraryWord('charlie', ['synonyms' => ['alpha']]),
            ...$this->libraryPool(0),
        ]);
        $pool->push($this->libraryWord('delta'), $this->libraryWord('echo'), $this->libraryWord('foxtrot'));
        $alpha = $pool[0];

        foreach (range(1, 40) as $seed) {
            $q = $this->factory($seed)->build($alpha, 'word', $pool);
            $this->assertNotContains('bravo', $q['options'], 'a synonym of the answer');
            $this->assertNotContains('charlie', $q['options'], 'a word that lists the answer as its synonym');
        }
    }

    public function test_the_look_alike_partner_is_always_offered_when_testing_a_confusable_word(): void
    {
        $this->seed(VocabularyWordSeeder::class);
        $pool = VocabularyWord::all();
        $affect = $pool->firstWhere('word', 'affect');
        $effect = $pool->firstWhere('word', 'effect');

        foreach (range(1, 25) as $seed) {
            $word = $this->factory($seed)->build($affect, 'word', $pool);
            $this->assertContains('effect', $word['options'], 'the confusion IS the question');

            $meaning = $this->factory($seed)->build($affect, 'meaning', $pool);
            $this->assertContains($effect->meaning, $meaning['options']);
        }
    }

    public function test_wrong_answers_prefer_the_same_part_of_speech(): void
    {
        $verbs = collect(['alpha', 'bravo', 'charlie', 'delta', 'echo'])->map(fn ($w) => $this->libraryWord($w, ['part_of_speech' => 'verb']));
        $nouns = collect(['golf', 'hotel', 'india'])->map(fn ($w) => $this->libraryWord($w, ['part_of_speech' => 'noun']));
        $pool = $verbs->concat($nouns);

        foreach (range(1, 20) as $seed) {
            $q = $this->factory($seed)->build($verbs[0], 'word', $pool);
            $this->assertEmpty(array_intersect($q['options'], ['golf', 'hotel', 'india']), 'plenty of verbs available, so no nouns');
        }
    }

    public function test_the_same_seed_reproduces_a_question_and_different_seeds_move_the_answer_around(): void
    {
        $pool = $this->libraryPool(10);

        $this->assertSame(
            $this->factory(5)->build($pool[0], 'meaning', $pool),
            $this->factory(5)->build($pool[0], 'meaning', $pool)
        );

        $positions = collect(range(1, 40))->map(fn ($seed) => $this->factory($seed)->build($pool[0], 'meaning', $pool)['correct_index'])->unique();
        $this->assertCount(4, $positions, 'the right answer is not stuck in one slot');
    }

    // ---- what the browser may see ------------------------------------------------------------

    public function test_the_public_question_never_carries_the_answer_the_explanation_or_the_card(): void
    {
        $pool = $this->libraryPool(8);

        foreach (['meaning', 'word', 'cloze', 'recall'] as $type) {
            $question = $this->factory()->build($pool[0], $type, $pool, isNew: true);
            $public = VocabularyAttempt::publicQuestion($question, 3);

            foreach (['correct_index', 'answer', 'meaning', 'example', 'explanation', 'synonyms', 'note', 'word_id', 'is_new'] as $secret) {
                $this->assertArrayNotHasKey($secret, $public, "{$type}: {$secret}");
            }
            $this->assertSame(3, $public['index']);
            $this->assertSame($type, $public['type']);
        }
    }

    public function test_the_word_is_only_shown_when_it_is_the_thing_being_asked_about(): void
    {
        $pool = $this->libraryPool(8);

        $this->assertSame('alpha', VocabularyAttempt::publicQuestion($this->factory()->build($pool[0], 'meaning', $pool), 0)['word']);
        foreach (['word', 'cloze', 'recall'] as $type) {
            $this->assertArrayNotHasKey('word', VocabularyAttempt::publicQuestion($this->factory()->build($pool[0], $type, $pool), 0), $type);
        }
    }

    public function test_an_old_stored_question_without_a_type_is_treated_as_a_sentence_blank(): void
    {
        $legacy = ['word' => 'mitigate', 'sentence' => 'We must _____ the risk.', 'options' => ['a', 'b', 'c', 'd'], 'correct_index' => 1, 'explanation' => 'x'];

        $public = VocabularyAttempt::publicQuestion($legacy, 0);

        $this->assertSame('cloze', $public['type']);
        $this->assertSame('We must _____ the risk.', $public['sentence']);
        $this->assertArrayNotHasKey('word', $public, 'the old payload leaked the answer here');
        $this->assertArrayNotHasKey('correct_index', $public);
    }

    public function test_an_ai_item_is_stored_in_the_same_shape_as_every_other_question(): void
    {
        $item = [
            'word' => 'frugal', 'part_of_speech' => 'adjective', 'meaning' => 'careful with money',
            'example' => 'She is frugal.', 'sentence' => 'She is _____.', 'options' => ['frugal', 'lavish', 'shy', 'tall'],
            'correct_index' => 0, 'explanation' => 'Careful with money.',
        ];

        $q = $this->factory()->fromAiItem($item, 99);

        $this->assertSame('cloze', $q['type']);
        $this->assertSame(99, $q['word_id']);
        $this->assertSame('frugal', $q['answer']);
        $this->assertSame(0, $q['correct_index']);
        $this->assertNull($this->factory()->fromAiItem($item, null)['word_id']);
    }
}
