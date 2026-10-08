<?php

namespace App\Support;

/**
 * Word-level alignment of a target passage against what a student was
 * actually heard saying. This is the deterministic half of Speaking Practice
 * scoring: "accuracy" is arithmetic over an edit-distance alignment, never a
 * number a language model is asked to guess, so the same recording always
 * produces the same accuracy and the UI can show exactly which words were
 * skipped or changed.
 *
 * Per passage word the result is one of:
 *   ok      — said as written (full credit)
 *   close   — said as something very similar, e.g. "shower" -> "shore" (half credit)
 *   wrong   — replaced by an unrelated word (no credit)
 *   missed  — skipped entirely (no credit)
 * Words the student added that are not in the passage are counted as `extra`
 * and mildly reduce accuracy. Filler sounds ("um", "uh") are stripped before
 * aligning and counted separately — they affect fluency, not accuracy.
 */
final class SpeechAlignment
{
    /** Hesitation sounds — removed before alignment, counted separately. */
    private const FILLERS = ['uh', 'um', 'umm', 'uhh', 'er', 'erm', 'ah', 'hmm', 'hm', 'mm', 'eh'];

    private const COST_CLOSE = 0.4;

    private const COST_WRONG = 1.0;

    private const COST_GAP = 1.0;

    private const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];

    private const TENS = [2 => 'twenty', 3 => 'thirty', 4 => 'forty', 5 => 'fifty', 6 => 'sixty', 7 => 'seventy', 8 => 'eighty', 9 => 'ninety'];

    /**
     * @return array{
     *     words: list<array{word:string, status:string, heard:?string}>,
     *     matched: int, close: int, wrong: int, missed: int, extra: int, total: int,
     *     accuracy: int, filler_count: int
     * }
     */
    public static function align(string $passage, string $heard): array
    {
        // Display tokens keep the passage's own capitalisation/punctuation; each
        // may expand to several comparison tokens (e.g. "well-known").
        $display = preg_split('/\s+/u', trim($passage), -1, PREG_SPLIT_NO_EMPTY) ?: [];

        $target = [];   // flat comparison tokens of the passage
        $owner = [];    // flat index -> display index
        foreach ($display as $di => $word) {
            foreach (self::tokens($word) as $t) {
                $target[] = $t;
                $owner[] = $di;
            }
        }

        [$spoken, $fillerCount] = self::spokenTokens($heard);

        $ops = self::diff($target, $spoken);

        // Fold the flat per-token ops back onto the passage's display words.
        $rank = ['ok' => 0, 'close' => 1, 'wrong' => 2, 'missed' => 3];
        $status = array_fill(0, count($display), 'ok');
        $heardAs = array_fill(0, count($display), null);
        $extra = 0;

        foreach ($ops as $op) {
            if ($op['type'] === 'extra') {
                $extra++;

                continue;
            }
            $di = $owner[$op['t']];
            if ($rank[$op['type']] > $rank[$status[$di]]) {
                $status[$di] = $op['type'];
            }
            if ($op['type'] === 'close' || $op['type'] === 'wrong') {
                $heardAs[$di] = $spoken[$op['s']];
            }
        }

        $counts = ['ok' => 0, 'close' => 0, 'wrong' => 0, 'missed' => 0];
        $words = [];
        foreach ($display as $di => $word) {
            $counts[$status[$di]]++;
            $words[] = [
                'word' => $word,
                'status' => $status[$di],
                'heard' => $status[$di] === 'ok' || $status[$di] === 'missed' ? null : $heardAs[$di],
            ];
        }

        $total = count($display);
        $credit = $counts['ok'] + 0.5 * $counts['close'];
        $accuracy = $total === 0 ? 0 : (int) round(100 * $credit / ($total + 0.5 * $extra));

        return [
            'words' => $words,
            'matched' => $counts['ok'],
            'close' => $counts['close'],
            'wrong' => $counts['wrong'],
            'missed' => $counts['missed'],
            'extra' => $extra,
            'total' => $total,
            'accuracy' => max(0, min(100, $accuracy)),
            'filler_count' => $fillerCount,
        ];
    }

    /** How many words (fillers excluded) were actually heard — used to detect silent/empty recordings. */
    public static function spokenWordCount(string $heard): int
    {
        return count(self::spokenTokens($heard)[0]);
    }

    /** @return array{0: list<string>, 1: int} comparison tokens with fillers removed, and how many fillers there were */
    private static function spokenTokens(string $heard): array
    {
        $tokens = [];
        $fillers = 0;
        foreach (self::tokens($heard) as $t) {
            if (in_array($t, self::FILLERS, true)) {
                $fillers++;
            } else {
                $tokens[] = $t;
            }
        }

        return [$tokens, $fillers];
    }

    /** @return list<string> lowercase alphanumeric tokens; apostrophes dropped ("o'clock" -> "oclock"), small numbers spelled out */
    private static function tokens(string $text): array
    {
        $text = mb_strtolower($text);
        $text = str_replace(["'", "\u{2019}", "\u{2018}", '`'], '', $text);
        $text = preg_replace_callback('/\d+/u', fn (array $m) => ' '.self::numberWords((int) $m[0]).' ', $text) ?? $text;
        $text = preg_replace('/[^\p{L}\p{N}]+/u', ' ', $text) ?? '';

        return preg_split('/\s+/u', trim($text), -1, PREG_SPLIT_NO_EMPTY) ?: [];
    }

    private static function numberWords(int $n): string
    {
        if ($n < 20) {
            return self::ONES[$n];
        }
        if ($n < 100) {
            return self::TENS[intdiv($n, 10)].($n % 10 ? ' '.self::ONES[$n % 10] : '');
        }

        return (string) $n; // larger numbers are left as digits rather than guessed at
    }

    /** Two different words that are near-identical (a likely mispronunciation / recognition variant), not just any short pair. */
    private static function isClose(string $a, string $b): bool
    {
        $len = max(strlen($a), strlen($b));
        if ($len < 5) {
            return false;
        }

        return levenshtein($a, $b) <= ($len >= 9 ? 2 : 1);
    }

    /**
     * Minimum-cost alignment (Levenshtein-style DP with a cheap "close" substitution).
     *
     * @param  list<string>  $target
     * @param  list<string>  $spoken
     * @return list<array{type:string, t?:int, s?:int}> ops in passage order; `extra` ops carry only the spoken index
     */
    private static function diff(array $target, array $spoken): array
    {
        $n = count($target);
        $m = count($spoken);

        $cost = [];
        for ($i = 0; $i <= $n; $i++) {
            $cost[$i] = array_fill(0, $m + 1, 0.0);
            $cost[$i][0] = $i * self::COST_GAP;
        }
        for ($j = 0; $j <= $m; $j++) {
            $cost[0][$j] = $j * self::COST_GAP;
        }

        for ($i = 1; $i <= $n; $i++) {
            for ($j = 1; $j <= $m; $j++) {
                $a = $target[$i - 1];
                $b = $spoken[$j - 1];
                $sub = $a === $b ? 0.0 : (self::isClose($a, $b) ? self::COST_CLOSE : self::COST_WRONG);
                $cost[$i][$j] = min(
                    $cost[$i - 1][$j - 1] + $sub,
                    $cost[$i - 1][$j] + self::COST_GAP,
                    $cost[$i][$j - 1] + self::COST_GAP,
                );
                // A word heard as two ("o clock", "break fast") is a transcription spacing choice, not an error.
                if ($j >= 2 && $spoken[$j - 2].$spoken[$j - 1] === $a) {
                    $cost[$i][$j] = min($cost[$i][$j], $cost[$i - 1][$j - 2]);
                }
            }
        }

        // Walk back from the end, preferring a diagonal move on ties.
        $ops = [];
        $i = $n;
        $j = $m;
        while ($i > 0 || $j > 0) {
            if ($i > 0 && $j >= 2 && $spoken[$j - 2].$spoken[$j - 1] === $target[$i - 1]
                && abs($cost[$i][$j] - $cost[$i - 1][$j - 2]) < 1e-9) {
                $ops[] = ['type' => 'ok', 't' => $i - 1, 's' => $j - 1];
                $i--;
                $j -= 2;

                continue;
            }
            if ($i > 0 && $j > 0) {
                $a = $target[$i - 1];
                $b = $spoken[$j - 1];
                $isSame = $a === $b;
                $sub = $isSame ? 0.0 : (self::isClose($a, $b) ? self::COST_CLOSE : self::COST_WRONG);
                if (abs($cost[$i][$j] - ($cost[$i - 1][$j - 1] + $sub)) < 1e-9) {
                    $ops[] = ['type' => $isSame ? 'ok' : ($sub === self::COST_CLOSE ? 'close' : 'wrong'), 't' => $i - 1, 's' => $j - 1];
                    $i--;
                    $j--;

                    continue;
                }
            }
            if ($i > 0 && ($j === 0 || abs($cost[$i][$j] - ($cost[$i - 1][$j] + self::COST_GAP)) < 1e-9)) {
                $ops[] = ['type' => 'missed', 't' => $i - 1];
                $i--;

                continue;
            }
            $ops[] = ['type' => 'extra', 's' => $j - 1];
            $j--;
        }

        return array_reverse($ops);
    }
}
