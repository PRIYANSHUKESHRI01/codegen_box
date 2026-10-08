<?php

namespace App\Services;

use App\Models\VocabularyWord;
use App\Models\VocabularyWordProgress;
use App\Support\VocabularyText;
use Illuminate\Support\Collection;
use Random\Engine\Mt19937;
use Random\Engine\Secure;
use Random\Randomizer;

/**
 * Turns a word into a question — deterministically, from the word bank, with
 * no AI call. The question TYPE gets harder as the student's memory of the
 * word gets stronger:
 *
 *   new / just-learned  → meaning  (word → pick its meaning)
 *   box 1               → word     (meaning → pick the word)
 *   box 2–3             → cloze    (pick the word that fits a sentence)
 *   box 4–5             → recall   (type the word from its meaning)
 *
 * Recognising a word is easy and recalling it from nothing is hard; moving the
 * student along that ladder is what turns "I've seen this word" into "I can
 * use it in an interview". Distractors are real words from the bank: the
 * look-alike partner first (so the confusing-pairs deck actually tests the
 * confusion), then words of the same part of speech, and never a listed
 * synonym of the answer.
 *
 * The optional seed makes shuffling reproducible for tests; production leaves
 * it null and uses a secure random source.
 */
class VocabularyQuestionFactory
{
    public const TYPE_MEANING = 'meaning';

    public const TYPE_WORD = 'word';

    public const TYPE_CLOZE = 'cloze';

    public const TYPE_RECALL = 'recall';

    private Randomizer $rng;

    public function __construct(?int $seed = null)
    {
        $this->rng = new Randomizer($seed === null ? new Secure : new Mt19937($seed));
    }

    /**
     * @template T
     *
     * @param  array<int|string, T>  $items
     * @return array<int, T>
     */
    public function shuffle(array $items): array
    {
        return $this->rng->shuffleArray(array_values($items));
    }

    public function typeFor(?VocabularyWordProgress $progress, VocabularyWord $word): string
    {
        $box = $progress?->box ?? 0;

        return match (true) {
            $box >= 4 => self::TYPE_RECALL,
            $box >= 2 => $word->supportsCloze() ? self::TYPE_CLOZE : self::TYPE_WORD,
            $box === 1 => self::TYPE_WORD,
            default => self::TYPE_MEANING,
        };
    }

    /** The second question about a brand-new word in the same session — deliberately a different angle on it. */
    public function echoTypeFor(VocabularyWord $word, string $firstType): string
    {
        if ($firstType === self::TYPE_MEANING) {
            return $word->supportsCloze() ? self::TYPE_CLOZE : self::TYPE_WORD;
        }

        return self::TYPE_MEANING;
    }

    /**
     * The full question, answer key included, or null when this type can't be
     * built for this word (no cloze material, or a pool too small to draw
     * three distractors from) — callers then fall back to another type.
     *
     * @param  Collection<int, VocabularyWord>  $pool  every word distractors may be drawn from
     */
    public function build(VocabularyWord $word, string $type, Collection $pool, bool $isNew = false, bool $isEcho = false): ?array
    {
        $base = [
            'type' => $type,
            'word_id' => $word->id,
            'word' => $word->word,
            'part_of_speech' => $word->part_of_speech,
            'meaning' => $word->meaning,
            'example' => $word->example,
            'synonyms' => array_values($word->synonyms ?? []),
            'note' => $word->note,
            'is_new' => $isNew,
            'is_echo' => $isEcho,
        ];

        return match ($type) {
            self::TYPE_MEANING => $this->meaning($word, $pool, $base),
            self::TYPE_WORD => $this->wordFromMeaning($word, $pool, $base),
            self::TYPE_CLOZE => $this->cloze($word, $base),
            self::TYPE_RECALL => $this->recall($word, $base),
            default => null,
        };
    }

    /**
     * An AI-quiz item (already sanitised) in the same stored shape as every
     * other question, so one answer path grades them all. `$wordId` is set when
     * the word also exists in the library.
     */
    public function fromAiItem(array $item, ?int $wordId): array
    {
        return [
            'type' => self::TYPE_CLOZE,
            'word_id' => $wordId,
            'word' => $item['word'],
            'part_of_speech' => $item['part_of_speech'],
            'meaning' => $item['meaning'],
            'example' => $item['example'],
            'synonyms' => [],
            'note' => null,
            'is_new' => false,
            'is_echo' => false,
            'prompt' => 'Choose the word that fits the sentence.',
            'sentence' => $item['sentence'],
            'options' => $item['options'],
            'correct_index' => $item['correct_index'],
            'answer' => $item['options'][$item['correct_index']],
            'explanation' => $item['explanation'],
        ];
    }

    private function meaning(VocabularyWord $word, Collection $pool, array $base): ?array
    {
        $distractors = $this->distractors($word, $pool);
        if ($distractors->count() < 3) {
            return null;
        }

        [$options, $correctIndex] = $this->placeCorrect($word->meaning, $distractors->pluck('meaning')->all());

        return $base + [
            'prompt' => "What does \u{201C}{$word->word}\u{201D} mean?",
            'options' => $options,
            'correct_index' => $correctIndex,
            'answer' => $word->meaning,
            'explanation' => "\u{201C}{$word->word}\u{201D} ({$word->part_of_speech}) means {$word->meaning}.",
        ];
    }

    private function wordFromMeaning(VocabularyWord $word, Collection $pool, array $base): ?array
    {
        $distractors = $this->distractors($word, $pool);
        if ($distractors->count() < 3) {
            return null;
        }

        [$options, $correctIndex] = $this->placeCorrect($word->word, $distractors->pluck('word')->all());

        return $base + [
            'prompt' => "Which word means \u{201C}{$word->meaning}\u{201D}?",
            'part_of_speech' => $word->part_of_speech,
            'options' => $options,
            'correct_index' => $correctIndex,
            'answer' => $word->word,
            'explanation' => "\u{201C}{$word->word}\u{201D} means {$word->meaning}.",
        ];
    }

    private function cloze(VocabularyWord $word, array $base): ?array
    {
        $sentence = $word->cloze();
        $distractors = $this->usableClozeDistractors($word);
        if ($sentence === null || count($distractors) < 3) {
            return null;
        }

        [$options, $correctIndex] = $this->placeCorrect($word->word, array_slice($distractors, 0, 3));

        return $base + [
            'prompt' => 'Choose the word that fits the sentence.',
            'sentence' => $sentence,
            'options' => $options,
            'correct_index' => $correctIndex,
            'answer' => $word->word,
            'explanation' => "\u{201C}{$word->word}\u{201D} fits here \u{2014} it means {$word->meaning}.",
        ];
    }

    private function recall(VocabularyWord $word, array $base): array
    {
        return $base + [
            'prompt' => "Type the word that means \u{201C}{$word->meaning}\u{201D}.",
            'hint' => VocabularyText::hint($word->word),
            'letters' => VocabularyText::letterCount($word->word),
            'word_count' => count(preg_split('/\s+/u', trim($word->word), -1, PREG_SPLIT_NO_EMPTY) ?: [1]),
            'answer' => $word->word,
            'explanation' => "The word is \u{201C}{$word->word}\u{201D} \u{2014} {$word->meaning}.",
        ];
    }

    /** @return array<int, string> authored wrong answers, trimmed, de-duplicated, never equal to the word */
    private function usableClozeDistractors(VocabularyWord $word): array
    {
        $seen = [mb_strtolower($word->word) => true];
        $usable = [];

        foreach ($word->distractors ?? [] as $candidate) {
            $candidate = trim((string) $candidate);
            $key = mb_strtolower($candidate);
            if ($candidate === '' || isset($seen[$key])) {
                continue;
            }
            $seen[$key] = true;
            $usable[] = $candidate;
        }

        return $usable;
    }

    /**
     * Three other words to use as wrong answers: the look-alike partner first,
     * then same-part-of-speech words, then anything. Listed synonyms (either
     * direction), identical meanings and identical spellings are excluded.
     *
     * @return Collection<int, VocabularyWord>
     */
    private function distractors(VocabularyWord $word, Collection $pool): Collection
    {
        $own = mb_strtolower($word->word);
        $ownSynonyms = array_map('mb_strtolower', $word->synonyms ?? []);
        $ownMeaning = mb_strtolower($word->meaning);
        $partner = $word->pair_word ? mb_strtolower($word->pair_word) : null;

        $eligible = $pool->filter(function (VocabularyWord $candidate) use ($word, $own, $ownSynonyms, $ownMeaning) {
            $candidateWord = mb_strtolower($candidate->word);

            return $candidate->id !== $word->id
                && $candidateWord !== $own
                && ! in_array($candidateWord, $ownSynonyms, true)
                && ! in_array($own, array_map('mb_strtolower', $candidate->synonyms ?? []), true)
                && mb_strtolower($candidate->meaning) !== $ownMeaning
                && ! str_contains(mb_strtolower($candidate->meaning), $own);
        })->unique(fn (VocabularyWord $c) => mb_strtolower($c->word))->values();

        $picked = collect();

        if ($partner !== null) {
            $partnerWord = $eligible->first(fn (VocabularyWord $c) => mb_strtolower($c->word) === $partner);
            if ($partnerWord) {
                $picked->push($partnerWord);
            }
        }

        $rest = $eligible->reject(fn (VocabularyWord $c) => $picked->contains('id', $c->id));
        $samePos = $rest->filter(fn (VocabularyWord $c) => $c->part_of_speech === $word->part_of_speech);
        $others = $rest->reject(fn (VocabularyWord $c) => $c->part_of_speech === $word->part_of_speech);

        foreach ([$samePos, $others] as $tier) {
            foreach ($this->shuffle($tier->all()) as $candidate) {
                if ($picked->count() >= 3) {
                    break 2;
                }
                $picked->push($candidate);
            }
        }

        return $picked->take(3)->values();
    }

    /**
     * Shuffle the correct answer in among the wrong ones.
     *
     * @param  array<int, string>  $wrong
     * @return array{0: array<int, string>, 1: int} the four options and where the correct one landed
     */
    private function placeCorrect(string $correct, array $wrong): array
    {
        $options = $this->shuffle(array_merge([$correct], array_values($wrong)));

        return [$options, (int) array_search($correct, $options, true)];
    }
}
