<?php

namespace App\Services\Core;

use App\Models\CoreQuestion;

/**
 * The one definition of "is this answer right, and what is it worth" — used by practice, timed tests and
 * the regrader, so the three can never disagree.
 *
 *  • single answer  — right when the chosen option is the key.
 *  • multi-select   — all or nothing: the chosen set must equal the key set (GATE MSQ has no partial credit).
 *  • numerical      — right when the number lies inside the accepted range (inclusive, with a hair of float tolerance).
 *
 * An UNANSWERED question is never wrong: it scores 0 and takes no negative marking. A wrong answer scores the
 * question's authored negative marks (usually 0 for multi-select and numerical, ⅓ of the marks for a
 * single-answer question).
 */
final class CoreGrader
{
    private const EPSILON = 1e-9;

    /**
     * @param  array<int, string>|null  $selected  Option ids chosen (MCQ).
     * @return array{answered: bool, correct: bool, marks: float}
     */
    public static function evaluate(CoreQuestion $question, ?array $selected, ?float $numeric): array
    {
        if ($question->isNumeric()) {
            if ($numeric === null) {
                return ['answered' => false, 'correct' => false, 'marks' => 0.0];
            }

            $correct = $question->numeric_min !== null && $question->numeric_max !== null
                && $numeric >= $question->numeric_min - self::EPSILON
                && $numeric <= $question->numeric_max + self::EPSILON;
        } else {
            $chosen = array_values(array_unique(array_map('strval', $selected ?? [])));

            if ($chosen === []) {
                return ['answered' => false, 'correct' => false, 'marks' => 0.0];
            }

            $key = array_values(array_map('strval', $question->correct ?? []));
            sort($chosen);
            sort($key);
            $correct = $chosen === $key;
        }

        return [
            'answered' => true,
            'correct' => $correct,
            'marks' => $correct ? (float) $question->marks : -1 * abs((float) $question->negative_marks),
        ];
    }

    /**
     * Cleans what a client sent into the two inputs evaluate() takes: option ids restricted to the question's
     * real options (anything else is dropped), at most one for a single-answer question, and a finite number.
     *
     * @return array{0: ?array<int, string>, 1: ?float}
     */
    public static function sanitise(CoreQuestion $question, mixed $selected, mixed $numeric): array
    {
        if ($question->isNumeric()) {
            $value = is_numeric($numeric) ? (float) $numeric : null;

            return [null, $value !== null && is_finite($value) ? $value : null];
        }

        $valid = collect($question->options ?? [])->pluck('id')->all();
        $chosen = array_values(array_unique(array_filter(array_map('strval', (array) $selected), fn ($id) => in_array($id, $valid, true))));

        if ($question->type === CoreQuestion::TYPE_MCQ_SINGLE) {
            $chosen = array_slice($chosen, 0, 1);
        }

        return [$chosen === [] ? null : $chosen, null];
    }
}
