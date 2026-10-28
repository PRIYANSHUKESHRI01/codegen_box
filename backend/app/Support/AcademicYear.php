<?php

namespace App\Support;

use Carbon\CarbonInterface;

/**
 * Which year of study a college student is in.
 *
 * The thing stored on the student is the year they pass out (users.graduation_year); the year they are in is derived from it
 * and today's date, so it moves on by itself every July. All the calendar arithmetic lives here and nowhere else:
 *
 *     academic year 2026-27, programme of 4 years  ->  4th year passes out in 2027, 3rd in 2028, 2nd in 2029, 1st in 2030.
 */
final class AcademicYear
{
    /** The calendar year the current academic year began in (June 2027 is still the year that began in 2026; July 2027 starts the next). */
    public static function startYear(?CarbonInterface $at = null): int
    {
        $at ??= now();

        return $at->month >= self::startMonth() ? $at->year : $at->year - 1;
    }

    /** The year someone in `$studyYear` passes out. */
    public static function graduationYearFor(int $studyYear, ?CarbonInterface $at = null): int
    {
        return self::startYear($at) + self::programmeYears() + 1 - $studyYear;
    }

    /**
     * The year of study for a passing-out year: 1..programme while they are studying, above the programme once they have passed out,
     * below 1 for a batch that has not started yet. Null when no passing-out year is on file.
     */
    public static function studyYearOf(?int $graduationYear, ?CarbonInterface $at = null): ?int
    {
        if ($graduationYear === null) {
            return null;
        }

        return self::startYear($at) + self::programmeYears() + 1 - $graduationYear;
    }

    public static function programmeYears(): int
    {
        return max(1, (int) config('academic.programme_years', 4));
    }

    /** The years a TPO may file a student under, in order. */
    public static function selectableYears(): array
    {
        return range(1, self::programmeYears());
    }

    public static function isSelectable(mixed $year): bool
    {
        return is_int($year) && $year >= 1 && $year <= self::programmeYears();
    }

    /** "1st year" … "4th year"; "Passed out" for a batch that has left; null for a year that makes no sense. */
    public static function label(?int $studyYear): ?string
    {
        if ($studyYear === null) {
            return null;
        }

        if ($studyYear > self::programmeYears()) {
            return 'Passed out';
        }

        if ($studyYear < 1) {
            return null;
        }

        return self::ordinal($studyYear).' year';
    }

    public static function ordinal(int $n): string
    {
        return match (true) {
            $n % 100 >= 11 && $n % 100 <= 13 => "{$n}th",
            $n % 10 === 1 => "{$n}st",
            $n % 10 === 2 => "{$n}nd",
            $n % 10 === 3 => "{$n}rd",
            default => "{$n}th",
        };
    }

    /**
     * Reads a year as a person writes it in a spreadsheet: 3, "3rd", "3rd year", "Third Year", "III", "year 3", or the year they pass
     * out ("2028", "2024-2028"). Returns the study year (1..programme), or null when it is not something we can place - the caller
     * decides whether a blank is fine and a null is an error.
     */
    public static function parse(mixed $raw, ?CarbonInterface $at = null): ?int
    {
        if (is_int($raw) || is_float($raw)) {
            $raw = (string) (int) $raw;
        }

        $text = strtolower(trim((string) $raw));

        if ($text === '') {
            return null;
        }

        // A passing-out year ("2028", "batch of 2028", "2024-2028" - the last year named is the one they leave in).
        if (preg_match_all('/(?<!\d)(20\d{2})(?!\d)/', $text, $matches)) {
            $year = self::studyYearOf((int) end($matches[1]), $at);

            return self::isSelectable($year) ? $year : null;
        }

        $words = ['first' => 1, 'second' => 2, 'third' => 3, 'fourth' => 4, 'final' => self::programmeYears(), 'i' => 1, 'ii' => 2, 'iii' => 3, 'iv' => 4];

        foreach (preg_split('/[^a-z0-9]+/', $text, -1, PREG_SPLIT_NO_EMPTY) ?: [] as $token) {
            if (preg_match('/^([1-9])(?:st|nd|rd|th)?$/', $token, $m)) {
                $year = (int) $m[1];

                return self::isSelectable($year) ? $year : null;
            }

            if (isset($words[$token])) {
                return $words[$token];
            }
        }

        return null;
    }

    private static function startMonth(): int
    {
        return min(12, max(1, (int) config('academic.year_starts_in_month', 7)));
    }
}
