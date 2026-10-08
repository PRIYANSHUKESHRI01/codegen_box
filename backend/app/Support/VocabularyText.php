<?php

namespace App\Support;

/**
 * Small, pure text helpers for Vocabulary Sprint: blanking a word out of its
 * example sentence, building the "m _ _ _ _ _ _ _" hint for a typed answer,
 * and deciding whether a typed answer is right, nearly right, or wrong.
 */
final class VocabularyText
{
    public const BLANK = '_____';

    /**
     * The sentence with the first whole-word occurrence of `$word` replaced by
     * a blank, or null when the word doesn't appear (so no cloze question can
     * be made from it). Matching is case-insensitive and treats a space inside
     * a phrase as any run of whitespace.
     */
    public static function blank(string $sentence, string $word): ?string
    {
        $word = trim($word);
        if ($word === '') {
            return null;
        }

        $pattern = '/(?<![\p{L}\p{N}])'.str_replace('\ ', '\s+', preg_quote($word, '/')).'(?![\p{L}\p{N}])/iu';
        $count = 0;
        $blanked = preg_replace($pattern, self::BLANK, $sentence, 1, $count);

        return $count === 1 && is_string($blanked) ? $blanked : null;
    }

    /** True when the whole word (or phrase) appears in the sentence. */
    public static function contains(string $sentence, string $word): bool
    {
        return self::blank($sentence, $word) !== null;
    }

    /** Lower-cased, trimmed, inner whitespace collapsed, edge punctuation and curly quotes stripped. */
    public static function normalise(string $text): string
    {
        $text = mb_strtolower(trim($text));
        $text = str_replace(["\u{2019}", "\u{2018}"], "'", $text);
        $text = preg_replace('/\s+/u', ' ', $text) ?? $text;

        return trim($text, " \t\n\r\0\x0B.,;:!?\"'()[]");
    }

    /**
     * How a typed answer compares to the word: 'exact', 'close' (one letter
     * off — a spelling slip, not a different word) or 'wrong'. Very short
     * words never count as close: one letter off is a different word there.
     */
    public static function compare(string $typed, string $word): string
    {
        $typed = self::fold(self::normalise($typed));
        $word = self::fold(self::normalise($word));

        if ($typed === '' || $word === '') {
            return 'wrong';
        }
        if ($typed === $word) {
            return 'exact';
        }
        if (mb_strlen($word) >= 5 && self::editDistance(mb_str_split($typed), mb_str_split($word)) <= 1) {
            return 'close';
        }

        return 'wrong';
    }

    /**
     * "m _ _ _ _ _ _ _" for a single word; words of a phrase are separated by
     * a wider gap ("f _ _ _ _ _   u _"). Gives the first letter and the length
     * without giving the word away.
     */
    public static function hint(string $word): string
    {
        $parts = preg_split('/\s+/u', trim($word), -1, PREG_SPLIT_NO_EMPTY) ?: [];

        return implode('   ', array_map(function (string $part): string {
            $letters = mb_str_split($part);
            $first = array_shift($letters);

            return trim($first.' '.implode(' ', array_fill(0, count($letters), '_')));
        }, $parts));
    }

    /** Number of letters, ignoring spaces — for "8 letters" next to the hint. */
    public static function letterCount(string $word): int
    {
        return mb_strlen(preg_replace('/\s+/u', '', trim($word)) ?? '');
    }

    /** Accented letters compare as their plain form, so "resume" is an exact match for "résumé". */
    private static function fold(string $text): string
    {
        return strtr($text, [
            'á' => 'a', 'à' => 'a', 'â' => 'a', 'ä' => 'a', 'ã' => 'a', 'å' => 'a',
            'é' => 'e', 'è' => 'e', 'ê' => 'e', 'ë' => 'e',
            'í' => 'i', 'ì' => 'i', 'î' => 'i', 'ï' => 'i',
            'ó' => 'o', 'ò' => 'o', 'ô' => 'o', 'ö' => 'o', 'õ' => 'o',
            'ú' => 'u', 'ù' => 'u', 'û' => 'u', 'ü' => 'u',
            'ñ' => 'n', 'ç' => 'c',
        ]);
    }

    /**
     * Plain Levenshtein distance over arrays of characters. PHP's levenshtein()
     * counts bytes, which is wrong for any multi-byte letter.
     *
     * @param  array<int, string>  $a
     * @param  array<int, string>  $b
     */
    private static function editDistance(array $a, array $b): int
    {
        $previous = range(0, count($b));

        foreach ($a as $i => $charA) {
            $current = [$i + 1];
            foreach ($b as $j => $charB) {
                $current[$j + 1] = min(
                    $previous[$j + 1] + 1,
                    $current[$j] + 1,
                    $previous[$j] + ($charA === $charB ? 0 : 1)
                );
            }
            $previous = $current;
        }

        return $previous[count($b)];
    }
}
