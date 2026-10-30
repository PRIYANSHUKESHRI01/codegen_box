<?php

namespace App\Services\Answers;

/**
 * Turns a spoken or typed answer, or a model answer, into the comparable words AnswerMatcher works with. No AI, no network, no state: the
 * same text always gives the same words.
 *
 * What it does, in order:
 *  1. lower-cases and keeps only letters and digits (a decimal point between digits is kept: "0.8"), so punctuation, "°", "%" and "&" never
 *     get in the way, and "35°" and "thirty five degrees" meet in the middle;
 *  2. turns number words into digits ("thirty five" -> 35, "one hundred and twenty" -> 120), because the browser's speech recognition
 *     writes numbers either way and a figure is exactly the thing that must match;
 *  3. unifies a few spellings and near-synonyms a candidate would naturally swap ("captain"/"master", "inform"/"notify", "maneuver"/"manoeuvre");
 *  4. drops the little words ("the", "of", "um") that carry no meaning;
 *  5. reduces what is left to a stem ("ventilating", "ventilation", "ventilated" -> "ventilat"), so word endings never cost marks.
 */
final class AnswerText
{
    /** Words that carry nothing a marker would credit - articles, linking words, and the fillers of speech. */
    private const STOPWORDS = [
        'a', 'an', 'the', 'and', 'or', 'of', 'to', 'in', 'on', 'at', 'by', 'for', 'with', 'as', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
        'it', 'its', 'this', 'that', 'these', 'those', 'from', 'into', 'than', 'then', 'so', 'if', 'when', 'which', 'who', 'whom', 'whose', 'what',
        'where', 'while', 'also', 'can', 'may', 'might', 'will', 'would', 'shall', 'should', 'could', 'do', 'does', 'did', 'have', 'has', 'had',
        'you', 'your', 'we', 'our', 'they', 'their', 'he', 'his', 'she', 'her', 'i', 'me', 'my', 'them', 'there', 'here', 'about', 'up', 'out',
        'very', 'just', 'like', 'um', 'uh', 'er', 'ah', 'okay', 'ok', 'well', 'actually', 'basically', 'kind', 'sort', 'thing', 'things',
        'because', 'etc', 'eg', 'ie', 'e', 'g', 'let', 'say', 'said', 'but', 'ones',
    ];

    /**
     * Words that appear in almost every maritime answer and so say little about whether this one was understood. They still count, but
     * for far less than a technical term or a figure.
     */
    private const GENERIC = [
        'ship', 'vessel', 'ensure', 'make', 'use', 'used', 'using', 'take', 'need', 'must', 'all', 'any', 'each', 'other', 'such', 'between',
        'during', 'before', 'after', 'only', 'until', 'within', 'both', 'either', 'every', 'over', 'way', 'time', 'good', 'proper', 'properly',
        'correct', 'correctly', 'required', 'requirement', 'requirements', 'appropriate', 'necessary', 'general', 'main', 'type', 'types',
    ];

    /** A candidate's natural swaps, folded to one word before stemming. Kept short and safe: a wrong merge would give marks for nothing. */
    private const SAME = [
        'notify' => ['inform', 'alert', 'advise', 'tell', 'report', 'contact', 'warn', 'call', 'informing', 'notifying'],
        'master' => ['captain'],
        'ship' => ['vessel', 'boat'],
        'starboard' => ['stbd'],
        'check' => ['verify', 'confirm', 'inspect', 'examine', 'verifying', 'checking', 'inspecting'],
        'stop' => ['cease', 'halt', 'terminate'],
        'start' => ['begin', 'commence', 'initiate'],
        'reduce' => ['decrease', 'lower', 'lessen', 'diminish'],
        'increase' => ['raise', 'boost'],
        'immediately' => ['instantly', 'promptly'],
        'colour' => ['color'],
        'metre' => ['meter'],
        'centre' => ['center'],
        'grey' => ['gray'],
        'tonne' => ['ton', 'tons', 'tonnes'],
        'percent' => ['percentage'],
        'knot' => ['kn', 'kt', 'kts'],
        'degree' => ['deg', 'degrees'],
        'mile' => ['nm', 'miles'],
        // words() already turns "maneuver" into "manoeuver"; the British forms are folded to the same word.
        'manoeuver' => ['manoeuvre'],
        'manoeuvers' => ['manoeuvres'],
        'manoeuvering' => ['manoeuvring'],
        'receipt' => ['acknowledgment', 'acknowledgement'],
        'onboard' => ['aboard'],
    ];

    private const UNITS = [
        'zero' => 0, 'one' => 1, 'two' => 2, 'three' => 3, 'four' => 4, 'five' => 5, 'six' => 6, 'seven' => 7, 'eight' => 8, 'nine' => 9,
        'ten' => 10, 'eleven' => 11, 'twelve' => 12, 'thirteen' => 13, 'fourteen' => 14, 'fifteen' => 15, 'sixteen' => 16, 'seventeen' => 17,
        'eighteen' => 18, 'nineteen' => 19,
    ];

    private const TENS = ['twenty' => 20, 'thirty' => 30, 'forty' => 40, 'fifty' => 50, 'sixty' => 60, 'seventy' => 70, 'eighty' => 80, 'ninety' => 90];

    /** @var array<string, string>|null word => the word it is folded to */
    private static ?array $folded = null;

    /** @var list<string>|null */
    private static ?array $genericStems = null;

    /** @return list<string> the stems of the meaningful words, in the order they were said */
    public static function tokens(string $text): array
    {
        $out = [];

        foreach (self::foldNumbers(self::words($text)) as $word) {
            $word = self::fold($word);

            if ($word === '' || in_array($word, self::STOPWORDS, true)) {
                continue;
            }

            // A lone letter is never a term (the "s" of "5s", the "m" of "m3"); a figure of any length is.
            if (strlen($word) < 2 && ! ctype_digit($word)) {
                continue;
            }

            $out[] = self::stem($word);
        }

        return $out;
    }

    /** How much a word is worth in the comparison: a figure counts most, a technical term next, a word everyone uses least. */
    public static function weight(string $stem): float
    {
        if (self::isNumber($stem)) {
            return 2.5;
        }

        if (in_array($stem, self::genericStems(), true)) {
            return 0.3;
        }

        return match (true) {
            strlen($stem) >= 9 => 1.4,
            strlen($stem) >= 6 => 1.1,
            strlen($stem) >= 4 => 0.9,
            default => 0.6,
        };
    }

    /** @return list<string> */
    private static function genericStems(): array
    {
        return self::$genericStems ??= array_values(array_unique(array_map(self::stem(...), self::GENERIC)));
    }

    public static function isNumber(string $token): bool
    {
        return $token !== '' && preg_match('/^\d+(?:_\d+)?$/', $token) === 1;
    }

    /**
     * A light stemmer: it only has to give two forms of the same word the same stem, not to be linguistically right. ("alteration" and
     * "alter" are brought together by AnswerMatcher's prefix rule instead of here, because stripping "ation" outright would split
     * "ventilation" from "ventilate".)
     */
    public static function stem(string $word): string
    {
        if (self::isNumber($word) || strlen($word) <= 3) {
            return $word;
        }

        $w = $word;

        if (strlen($w) > 4 && str_ends_with($w, 'ies')) {
            $w = substr($w, 0, -3).'y';
        } elseif (str_ends_with($w, 'sses')) {
            $w = substr($w, 0, -2);
        } elseif (strlen($w) > 3 && preg_match('/(?:s|x|z|ch|sh)es$/', $w)) {
            $w = substr($w, 0, -2);
        } elseif (strlen($w) > 3 && str_ends_with($w, 's') && ! preg_match('/(?:ss|us|is)$/', $w)) {
            $w = substr($w, 0, -1);
        }

        // [suffix, what it becomes, the least that must be left of the word]: "making" -> "mak", "station" is left alone.
        foreach ([['ational', 'ate', 3], ['ation', 'ate', 3], ['ing', '', 3], ['ed', '', 3], ['ly', '', 4], ['ment', '', 4], ['ness', '', 4], ['able', '', 4], ['ible', '', 4]] as [$suffix, $replace, $keep]) {
            if (str_ends_with($w, $suffix) && strlen($w) - strlen($suffix) >= $keep) {
                $w = substr($w, 0, -strlen($suffix)).$replace;
                // "stopping" -> "stopp" -> "stop"; a double l or s stays ("falling" -> "fall").
                if ($suffix === 'ing' || $suffix === 'ed') {
                    $w = preg_replace('/([^aeiouls])\1$/', '$1', $w) ?? $w;
                }
                break;
            }
        }

        // "make" and "making" must meet: both lose the e.
        if (strlen($w) > 3 && str_ends_with($w, 'e')) {
            $w = substr($w, 0, -1);
        }

        return $w;
    }

    // ───────────────────────────── internals ─────────────────────────────

    /** @return list<string> the lower-case words of a text, punctuation gone, "per cent" mended */
    private static function words(string $text): array
    {
        $t = mb_strtolower($text);
        $t = str_replace(['°', '%', '&'], [' degree ', ' percent ', ' and '], $t);
        $t = preg_replace('/\bper\s+cent\b/', 'percent', $t) ?? $t;
        $t = preg_replace('/\bon[\s-]+board\b/', 'onboard', $t) ?? $t;
        // The spelling that differs between British and American English at the root of many words.
        $t = preg_replace('/maneuv/', 'manoeuv', $t) ?? $t;
        // A decimal point stays inside the figure ("0.8" -> "0_8"); every other mark becomes a space.
        $t = preg_replace('/(?<=\d)[.,](?=\d)/', '_', $t) ?? $t;
        $t = preg_replace('/[^a-z0-9_]+/', ' ', $t) ?? $t;
        // "35deg", "5s", "x2": split where letters meet digits.
        $t = preg_replace('/(?<=\d)(?=[a-z])|(?<=[a-z])(?=\d)/', ' ', $t) ?? $t;

        return preg_split('/\s+/', trim($t), -1, PREG_SPLIT_NO_EMPTY) ?: [];
    }

    /**
     * "thirty five" -> "35", "one hundred and twenty" -> "120", "two thousand" -> "2000". Figures already written as digits pass through.
     *
     * @param  list<string>  $words
     * @return list<string>
     */
    private static function foldNumbers(array $words): array
    {
        $out = [];
        $n = count($words);

        for ($i = 0; $i < $n; $i++) {
            if (! self::startsNumber($words[$i])) {
                $out[] = $words[$i];

                continue;
            }

            $start = $i;
            $total = 0;
            $current = 0;
            $used = false;

            while ($i < $n) {
                $w = $words[$i];

                if (isset(self::UNITS[$w])) {
                    $current += self::UNITS[$w];
                } elseif (isset(self::TENS[$w])) {
                    $current += self::TENS[$w];
                } elseif ($w === 'hundred' && ($used || $current > 0)) {
                    $current = max(1, $current) * 100;
                } elseif ($w === 'thousand' && ($used || $current > 0)) {
                    $total += max(1, $current) * 1000;
                    $current = 0;
                } elseif ($w === 'and' && $used && isset($words[$i + 1]) && self::startsNumber($words[$i + 1]) && $current >= 100) {
                    // "one hundred AND twenty": the "and" belongs to the figure.
                } else {
                    break;
                }

                $used = true;
                $i++;
            }

            $i--; // the for loop adds one back

            // A bare "one" ("one of the", "no one") is a pronoun far more often than a figure; a figure of 1 is written as a digit.
            if ($i === $start && $words[$start] === 'one') {
                continue;
            }

            $out[] = (string) ($total + $current);
        }

        return $out;
    }

    private static function startsNumber(string $word): bool
    {
        return isset(self::UNITS[$word]) || isset(self::TENS[$word]);
    }

    private static function fold(string $word): string
    {
        if (self::$folded === null) {
            self::$folded = [];

            foreach (self::SAME as $canon => $variants) {
                foreach ($variants as $variant) {
                    self::$folded[$variant] = $canon;
                }
            }
        }

        return self::$folded[$word] ?? $word;
    }
}
