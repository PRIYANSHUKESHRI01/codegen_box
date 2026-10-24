<?php

namespace App\Support;

/**
 * Turns whatever a college typed for a branch into one comparable key.
 *
 * "Mechanical Engg.", "mechanical engineering", "B.Tech - MECHANICAL" and
 * "Mechanical" are the same thing; "CSE (AI & ML)" and "cse ai and ml" too.
 * Pure and dependency-free on purpose: the data migration that back-fills
 * every existing student calls it, and it must keep behaving the same way
 * forever (a stored `branch_key` is compared against keys made later).
 *
 * Steps: lower-case → "&" becomes a word → every non-alphanumeric run becomes
 * one space → a leading degree ("b tech", "b e", "bachelor of technology") is
 * dropped → filler words (engineering, department, of, and, in …) are dropped.
 * Dropping "and" means "Electrical & Electronics" and "Electrical Electronics"
 * collide on purpose.
 */
final class BranchNormalizer
{
    /** Words that carry no information about WHICH branch it is. */
    private const NOISE = [
        'engineering', 'engg', 'engineer', 'eng', 'and', 'the', 'of', 'in', 'department', 'dept', 'branch',
        'btech', 'be', 'bachelor', 'degree', 'program', 'programme', 'course', 'with', 'specialization', 'specialisation',
    ];

    public static function key(?string $raw): ?string
    {
        if ($raw === null) {
            return null;
        }

        $text = mb_strtolower(trim($raw));
        $text = str_replace('&', ' and ', $text);
        $text = (string) preg_replace('/[^\p{L}\p{N}]+/u', ' ', $text);
        $text = trim($text);

        // A leading degree: "b tech", "b e", "b.tech" (already "b tech"), "bachelor of technology/engineering".
        $text = (string) preg_replace('/^(b tech|b e|btech|bachelor of (technology|engineering))\b\s*/u', '', $text);

        $words = array_values(array_filter(
            explode(' ', $text),
            fn (string $w) => $w !== '' && ! in_array($w, self::NOISE, true),
        ));

        $key = implode(' ', $words);

        return $key === '' ? null : mb_substr($key, 0, 150);
    }
}
