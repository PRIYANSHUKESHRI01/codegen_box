<?php

namespace Tests\Concerns;

use App\Models\User;
use App\Models\VocabularyWord;
use App\Models\VocabularyWordProgress;
use Illuminate\Support\Collection;

/**
 * Small, explicit word fixtures. The words are NATO-alphabet placeholders with
 * numbered meanings, so a test never depends on the real library's wording and
 * a meaning can never accidentally contain another word.
 */
trait BuildsVocabularyWords
{
    private const PLACEHOLDER_WORDS = [
        'alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel', 'india', 'juliet',
        'kilo', 'lima', 'mike', 'november', 'oscar', 'papa', 'quebec', 'romeo', 'sierra', 'tango',
    ];

    protected function vocabStudent(array $attributes = []): User
    {
        return User::factory()->create(array_merge(['role' => User::ROLE_USER], $attributes));
    }

    protected function libraryWord(string $word, array $overrides = []): VocabularyWord
    {
        static $counter = 0;
        $counter++;

        return VocabularyWord::create(array_merge([
            'user_id' => null,
            'source' => VocabularyWord::SOURCE_LIBRARY,
            'deck' => 'workplace-essentials',
            'word' => $word,
            'part_of_speech' => 'noun',
            'level' => 'beginner',
            'meaning' => "placeholder meaning number {$counter}",
            'example' => "We discussed the {$word} during the review meeting.",
            'synonyms' => [],
            'distractors' => ['north', 'south', 'east'],
            'sort_order' => $counter,
            'is_active' => true,
        ], $overrides));
    }

    /** @return Collection<int, VocabularyWord> */
    protected function libraryPool(int $count = 12, string $deck = 'workplace-essentials'): Collection
    {
        return collect(array_slice(self::PLACEHOLDER_WORDS, 0, $count))
            ->map(fn (string $word, int $i) => $this->libraryWord($word, ['deck' => $deck, 'sort_order' => $i + 1]));
    }

    protected function privateWord(User $owner, string $word, array $overrides = []): VocabularyWord
    {
        return $this->libraryWord($word, array_merge([
            'user_id' => $owner->id,
            'source' => VocabularyWord::SOURCE_AI,
            'deck' => null,
            'distractors' => null,
        ], $overrides));
    }

    protected function progress(User $student, VocabularyWord $word, array $attributes = []): VocabularyWordProgress
    {
        return VocabularyWordProgress::create(array_merge([
            'user_id' => $student->id,
            'vocabulary_word_id' => $word->id,
            'box' => 1,
            'streak' => 1,
            'seen_count' => 1,
            'correct_count' => 1,
            'lapse_count' => 0,
            'last_seen_at' => now()->subDay(),
            'due_on' => today()->subDay(),
        ], $attributes));
    }
}
