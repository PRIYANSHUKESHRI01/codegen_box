<?php

namespace App\Support;

/**
 * The structure of the Vocabulary Sprint word library. Decks are fixed
 * product structure (the words inside them live in `vocabulary_words`), so
 * they are plain constants rather than a table: nothing about a deck is
 * editable by a student or an admin, and a new deck always arrives together
 * with its words in a seeder.
 *
 * The array order IS the suggested learning path: gentle everyday words
 * first, the hardest verbal material last. The daily sprint follows it when
 * it needs fresh words and the student hasn't chosen a deck.
 */
final class VocabularyDecks
{
    /** @return array<string, array{title:string, tagline:string, level:string}> keyed by slug, in learning-path order */
    public static function all(): array
    {
        return [
            'workplace-essentials' => [
                'title' => 'Workplace essentials',
                'tagline' => 'The everyday words of meetings, emails and deadlines.',
                'level' => 'beginner',
            ],
            'interview-power-words' => [
                'title' => 'Interview power words',
                'tagline' => 'Words that make your answers sound sharp and credible.',
                'level' => 'intermediate',
            ],
            'communication-and-persuasion' => [
                'title' => 'Communication & persuasion',
                'tagline' => 'Say it clearly, politely and convincingly.',
                'level' => 'intermediate',
            ],
            'tech-and-engineering' => [
                'title' => 'Tech & engineering',
                'tagline' => 'How engineers talk about systems, bugs and trade-offs.',
                'level' => 'intermediate',
            ],
            'business-and-finance' => [
                'title' => 'Business & finance',
                'tagline' => 'Money, markets and the language of the boardroom.',
                'level' => 'intermediate',
            ],
            'confusing-pairs' => [
                'title' => 'Look-alike words',
                'tagline' => 'Affect or effect? Principal or principle? Get them right every time.',
                'level' => 'intermediate',
            ],
            'phrasal-verbs-and-idioms' => [
                'title' => 'Phrasal verbs & idioms',
                'tagline' => 'The phrases colleagues actually use.',
                'level' => 'intermediate',
            ],
            'reasoning-and-verbal' => [
                'title' => 'Advanced verbal',
                'tagline' => 'Sharper words for aptitude tests and reasoning.',
                'level' => 'advanced',
            ],
        ];
    }

    /** @return array<int, string> slugs in learning-path order */
    public static function slugs(): array
    {
        return array_keys(self::all());
    }

    public static function exists(?string $slug): bool
    {
        return $slug !== null && array_key_exists($slug, self::all());
    }

    public static function title(?string $slug): ?string
    {
        return self::all()[$slug]['title'] ?? null;
    }

    /** Position in the learning path — unknown decks sort last. */
    public static function position(?string $slug): int
    {
        $index = array_search($slug, self::slugs(), true);

        return $index === false ? PHP_INT_MAX : $index;
    }
}
