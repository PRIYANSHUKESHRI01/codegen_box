<?php

namespace App\Services\Answers;

/**
 * Compares what a student said (or typed) with the model answer, WITHOUT any AI: no model, no network, no cost per answer, and the same
 * answer always gets the same result. Built for study mode, where the point is not a verdict but showing the student, straight away, how
 * much of the model answer they covered and what they left out.
 *
 * How it works
 *  1. Both texts become meaningful stems (AnswerText): number words are digits, spellings and near-synonyms are unified, little words are
 *     gone, word endings are gone.
 *  2. The model answer is cut into KEY POINTS at its commas, semicolons, colons and sentence ends ("Appraisal, Planning, Execution, and
 *     Monitoring" is four points).
 *  3. Every meaningful word of the model answer is looked for in the answer, and is worth what it is worth (a figure most, a technical
 *     term next, a word every answer uses least). It is found if the answer has the same stem, or - because speech recognition mishears
 *     and people say "alteration" for "alter" - a word that begins with it or is one letter off (two for a long word).
 *  4. A key point's score is the weighted share of its words that were found: at least 70% = covered, 35% = partly, below = missed.
 *  5. The match is the weighted share of ALL the model answer's words found. It is recall on purpose: an answer is judged on whether it
 *     said what mattered, not on how it was phrased or how much else it said.
 *
 * What it cannot do - and the screen says so: it does not know whether something is RIGHT. It sees words and figures, not meaning, so an
 * answer that uses the right words in the wrong way ("alter to port" where the model says "alter to starboard, pass port to port") can
 * match well. It is a study aid that shows the model answer; it is not a marker. A wrong figure is the one error it does catch.
 */
final class AnswerMatcher
{
    /** A word is only fuzzily matched when it is at least this long: a short word one letter off is a different word ("port", "post"). */
    private const FUZZY_MIN_LENGTH = 5;

    /**
     * @param  bool  $picture  the question is about a picture (a Rule of the Road card), where the answer is mostly what colour of light is
     *                         seen and on which side: naming a different colour or side from the model answer's is then held down like a wrong figure
     */
    public function __construct(private readonly ?PictureVocabulary $vocabulary = null) {}

    public function match(string $transcript, string $reference, bool $picture = false): AnswerMatch
    {
        $points = $this->points($reference);
        // A picture's answers share most of their words from card to card; the words that tell them apart are worth more (PictureVocabulary).
        $vocabulary = $picture ? $this->vocabulary : null;

        // What was said, counted: a word said once can satisfy ONE word of the model answer, not every point that happens to contain it
        // ("safety contour and safety depth" does not also cover "shallow contour" and "deep contour"). Figures are the exception - see below.
        $pool = array_count_values(AnswerText::tokens($transcript));
        $saidNumbers = array_values(array_filter(array_map('strval', array_keys($pool)), [AnswerText::class, 'isNumber']));

        // Every word of the model answer, with its point and what it is worth.
        $slots = [];
        $seenNumbers = [];

        foreach ($points as $i => $point) {
            foreach ($point['tokens'] as $token) {
                $number = AnswerText::isNumber($token);
                // A figure the model answer repeats ("35 on one side ... 35 on the other") is worth full value once and little after.
                $weight = $number && isset($seenNumbers[$token]) ? 0.8 : AnswerText::weight($token) * ($number || $vocabulary === null ? 1.0 : $vocabulary->factor($token));
                $seenNumbers[$token] = true;
                $slots[] = ['point' => $i, 'token' => $token, 'weight' => $weight, 'number' => $number, 'found' => 0.0];
            }
        }

        // Pass 1 - the same word. A figure is found if the answer says it anywhere (saying "thirty five" once covers every 35).
        foreach ($slots as &$slot) {
            if ($slot['number']) {
                $slot['found'] = in_array($slot['token'], $saidNumbers, true) ? 1.0 : 0.0;
            } elseif (($pool[$slot['token']] ?? 0) > 0) {
                $pool[$slot['token']]--;
                $slot['found'] = 1.0;
            }
        }
        unset($slot);

        // Pass 2 - a close word, for what pass 1 did not find: speech recognition mishears, and people say "alteration" for "alter".
        foreach ($slots as &$slot) {
            if ($slot['found'] === 0.0 && ! $slot['number'] && strlen($slot['token']) >= self::FUZZY_MIN_LENGTH) {
                [$score, $word] = $this->closest($slot['token'], $pool);

                if ($word !== null) {
                    $pool[$word]--;
                    $slot['found'] = $score;
                }
            }
        }
        unset($slot);

        // A picture's colours and sides: the model answer names a colour the answer does not, and the answer names one the model answer does
        // not ("green sidelight" for "red sidelight"). Saying MORE colours than the model answer, or fewer, is not a conflict: a student who
        // also says "white masthead light" has not erred, and one who leaves a colour out loses that word's share anyway.
        $conflictTerms = [];

        if ($picture) {
            $terms = AnswerText::tokens(implode(' ', (array) config('answer_match.picture_terms', [])));
            $referenceTerms = array_unique(array_intersect(array_column($slots, 'token'), $terms));
            $saidTerms = array_unique(array_intersect(AnswerText::tokens($transcript), $terms));

            if (array_diff($referenceTerms, $saidTerms) !== [] && array_diff($saidTerms, $referenceTerms) !== []) {
                $conflictTerms = array_values(array_diff($referenceTerms, $saidTerms));
            }
        }

        $totalWeight = 0.0;
        $foundWeight = 0.0;
        $segments = [];

        foreach ($points as $i => $point) {
            $weight = 0.0;
            $found = 0.0;
            $missingFigure = false;

            foreach ($slots as $slot) {
                if ($slot['point'] !== $i) {
                    continue;
                }

                $weight += $slot['weight'];
                $found += $slot['weight'] * $slot['found'];
                // (a colour the answer got wrong counts like a figure it left out)
                $missingFigure = $missingFigure || (($slot['number'] || in_array($slot['token'], $conflictTerms, true)) && $slot['found'] === 0.0);
            }

            $totalWeight += $weight;
            $foundWeight += $found;
            $share = $weight > 0 ? $found / $weight : 0.0;

            $status = $share >= (float) config('answer_match.point.covered_from', 0.70)
                ? AnswerMatch::COVERED
                : ($share >= (float) config('answer_match.point.partial_from', 0.35) ? AnswerMatch::PARTIAL : AnswerMatch::MISSED);

            // A key point that has a figure in it (or a colour the answer got wrong) is not covered while that is missing, however many of its other words were said.
            if ($missingFigure && $status === AnswerMatch::COVERED) {
                $status = AnswerMatch::PARTIAL;
            }

            $segments[] = ['text' => $point['text'].($i < count($points) - 1 ? ' ' : ''), 'status' => $status];
        }

        $percent = $totalWeight > 0 ? 100 * $foundWeight / $totalWeight : 0.0;

        // A confident WRONG figure: the model answer has a figure the answer does not, and the answer has a figure the model answer does not
        // ("60 seconds" for "28 seconds"). The figure itself already earned nothing; the match is also held down, so it cannot read as a pass.
        $referenceNumbers = array_unique(array_column(array_filter($slots, fn (array $s) => $s['number']), 'token'));
        $missing = array_diff($referenceNumbers, $saidNumbers);
        $extra = array_diff($saidNumbers, $referenceNumbers);

        if ($missing !== [] && $extra !== []) {
            $percent = min($percent, (float) config('answer_match.wrong_figure_cap_percent', 60));
        }

        // The colour a picture's answer got wrong is held down like a wrong figure, so it cannot read as a pass.
        if ($conflictTerms !== []) {
            $percent = min($percent, (float) config('answer_match.wrong_figure_cap_percent', 60));
        }

        // "Um, I think so": hardly anything was said that could be matched.
        if (count(array_filter($slots, fn (array $s) => $s['found'] > 0.0)) < (int) config('answer_match.short_answer.min_words', 2)) {
            $percent = min($percent, (float) config('answer_match.short_answer.cap_percent', 15));
        }

        $percent = (int) max(0, min(100, round($percent)));

        return new AnswerMatch($percent, AnswerMatch::bandFor($percent), $segments);
    }

    /**
     * The word the answer still has that is closest to this word of the model answer, if any is close enough.
     *
     * @param  array<string, int>  $pool  the answer's stems still unused => how many are left
     * @return array{0: float, 1: ?string} how well it matches, and the word
     */
    private function closest(string $token, array $pool): array
    {
        $best = [0.0, null];

        foreach ($pool as $candidate => $left) {
            $candidate = (string) $candidate;

            if ($left <= 0 || strlen($candidate) < self::FUZZY_MIN_LENGTH || AnswerText::isNumber($candidate)) {
                continue;
            }

            $score = 0.0;

            // "alter" and "alterat(ion)": one is the beginning of the other and not much longer.
            [$short, $long] = strlen($token) <= strlen($candidate) ? [$token, $candidate] : [$candidate, $token];

            if (str_starts_with($long, $short) && strlen($long) - strlen($short) <= 4) {
                $score = 0.9;
            } else {
                // Speech recognition and typing slips: one letter off, or two in a long word.
                $allowed = min(strlen($token), strlen($candidate)) >= 9 ? 2 : 1;

                if (abs(strlen($token) - strlen($candidate)) <= $allowed && levenshtein($token, $candidate) <= $allowed) {
                    $score = 0.85;
                }
            }

            if ($score > $best[0]) {
                $best = [$score, $candidate];
            }
        }

        return $best;
    }

    /**
     * The model answer cut into key points: [text exactly as written, its stems]. A piece with no meaningful word in it ("etc.", a stray
     * bracket) is not a point of its own; it stays attached to the point before it so the text still reads as written.
     *
     * @return list<array{text: string, tokens: list<string>}>
     */
    private function points(string $reference): array
    {
        $reference = trim(preg_replace('/\s+/u', ' ', $reference) ?? $reference);

        if ($reference === '') {
            return [];
        }

        $points = [];
        $carry = '';

        // Cut after , ; : and after a full stop that starts a new sentence - not inside "15-20" or "e.g.,".
        foreach (preg_split('/(?<=[;,:])\s+|(?<=[.!?])\s+(?=[A-Z0-9(])/u', $reference) ?: [$reference] as $piece) {
            $tokens = AnswerText::tokens($piece);

            if ($tokens === []) {
                if ($points === []) {
                    $carry .= $piece.' ';
                } else {
                    $points[array_key_last($points)]['text'] .= ' '.$piece;
                }

                continue;
            }

            $points[] = ['text' => $carry.$piece, 'tokens' => $tokens];
            $carry = '';
        }

        // A model answer with no meaningful word at all: keep it, as a point that can only be missed.
        return $points === [] ? [['text' => $reference, 'tokens' => []]] : $points;
    }
}
