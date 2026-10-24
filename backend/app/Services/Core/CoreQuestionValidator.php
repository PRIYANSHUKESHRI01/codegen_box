<?php

namespace App\Services\Core;

use App\Models\CoreQuestion;

/**
 * The one definition of "a valid Core Prep question" — used by the authoring form, the bulk importer
 * and publishing, so a question that gets in by one door can never be one the others would refuse.
 *
 * It works on a NORMALISED row (see normalise()): ids already resolved, options as [{id, text}],
 * `correct` as option ids. Errors come back as a list of {field, message}; an empty list means valid.
 */
final class CoreQuestionValidator
{
    public function __construct(private readonly CoreTaxonomy $taxonomy) {}

    /**
     * Cleans raw input into the shape the rest of the pipeline expects: trims text, gives options their
     * a–f ids by position, lower-cases answer ids, turns "A, C" into ['a','c'], casts numbers.
     *
     * @param  array<string, mixed>  $in
     * @return array<string, mixed>
     */
    public function normalise(array $in): array
    {
        $type = isset($in['type']) ? strtolower(trim((string) $in['type'])) : CoreQuestion::TYPE_MCQ_SINGLE;
        $type = match ($type) {
            'single', 'mcq', 'mcq_single', 'mcq-single', 'msq_single' => CoreQuestion::TYPE_MCQ_SINGLE,
            'multi', 'msq', 'mcq_multi', 'mcq-multi', 'multiple', 'multi_select' => CoreQuestion::TYPE_MCQ_MULTI,
            'nat', 'numeric', 'numerical', 'number' => CoreQuestion::TYPE_NUMERIC,
            default => $type,
        };

        $row = [
            'external_id' => $this->text($in['external_id'] ?? null, 191),
            'discipline_code' => isset($in['discipline_code']) ? strtolower(trim((string) $in['discipline_code'])) : null,
            'subject_id' => isset($in['subject_id']) ? (int) $in['subject_id'] : null,
            'topic_id' => isset($in['topic_id']) && $in['topic_id'] !== '' && $in['topic_id'] !== null ? (int) $in['topic_id'] : null,
            'type' => $type,
            'stem' => trim((string) ($in['stem'] ?? '')),
            'options' => null,
            'correct' => null,
            'numeric_min' => $this->number($in['numeric_min'] ?? null),
            'numeric_max' => $this->number($in['numeric_max'] ?? null),
            'numeric_unit' => $this->text($in['numeric_unit'] ?? null, 30),
            'marks' => $this->number($in['marks'] ?? null) ?? 1.0,
            'negative_marks' => $this->number($in['negative_marks'] ?? null) ?? 0.0,
            'difficulty' => strtolower(trim((string) ($in['difficulty'] ?? 'medium'))) ?: 'medium',
            'explanation' => ($e = trim((string) ($in['explanation'] ?? ''))) === '' ? null : $e,
            'tags' => $this->list($in['tags'] ?? []),
            'companies' => $this->list($in['companies'] ?? []),
            'source' => $this->text($in['source'] ?? null, 120),
            'usage' => strtolower(trim((string) ($in['usage'] ?? 'both'))) ?: 'both',
            'status' => strtolower(trim((string) ($in['status'] ?? 'draft'))) ?: 'draft',
        ];

        if ($type === CoreQuestion::TYPE_NUMERIC) {
            // A single number is a range of one: numeric_min only → numeric_max the same.
            if ($row['numeric_min'] !== null && $row['numeric_max'] === null) {
                $row['numeric_max'] = $row['numeric_min'];
            }

            return $row;
        }

        $options = [];
        $keepIds = true;
        $seenIds = [];
        foreach (array_values((array) ($in['options'] ?? [])) as $i => $option) {
            $text = is_array($option) ? ($option['text'] ?? '') : $option;
            $text = trim((string) $text);

            if ($text === '' && ! is_array($option)) {
                continue; // an empty spreadsheet cell, not an option
            }

            $given = is_array($option) && isset($option['id']) ? strtolower(trim((string) $option['id'])) : null;
            $keepIds = $keepIds && $given !== null && in_array($given, CoreQuestion::OPTION_IDS, true) && ! isset($seenIds[$given]);
            if ($given !== null) {
                $seenIds[$given] = true;
            }

            $options[] = ['id' => $given ?? '', 'text' => $text];
        }

        // Ids the author's form sent are kept (so `correct` still points at the right option); anything
        // else — a spreadsheet, a missing or repeated id — is numbered a, b, c… by position.
        if (! $keepIds) {
            foreach ($options as $position => &$option) {
                $option['id'] = CoreQuestion::OPTION_IDS[$position] ?? 'z'.$position;
            }
            unset($option);
        }
        $row['options'] = $options;

        $correct = $in['correct'] ?? [];
        if (is_string($correct)) {
            $correct = preg_split('/[\s,;|]+/', $correct, -1, PREG_SPLIT_NO_EMPTY) ?: [];
        }
        $correctIds = array_values(array_unique(array_map(fn ($c) => strtolower(trim((string) $c)), (array) $correct)));
        sort($correctIds); // order never matters, so [a,c] and [c,a] are the same key
        $row['correct'] = $correctIds;

        return $row;
    }

    /**
     * @param  array<string, mixed>  $row  A normalised row.
     * @return list<array{field: string, message: string}>
     */
    public function validate(array $row): array
    {
        $errors = [];
        $add = function (string $field, string $message) use (&$errors) {
            $errors[] = ['field' => $field, 'message' => $message];
        };

        // ── taxonomy ──
        $discipline = $row['discipline_code'] ?? null;
        if ($discipline === null || ! $this->taxonomy->hasDiscipline($discipline)) {
            $add('discipline', 'Choose a branch family: '.implode(', ', $this->taxonomy->disciplines()).'.');
        }

        $subject = isset($row['subject_id']) ? $this->taxonomy->subjectById((int) $row['subject_id']) : null;
        if ($subject === null) {
            $add('subject', 'Choose a subject.');
        } elseif ($discipline !== null && $subject['discipline'] !== $discipline) {
            $add('subject', "“{$subject['name']}” belongs to {$subject['discipline']}, not {$discipline}.");
        }

        if (($row['topic_id'] ?? null) !== null) {
            if ($subject === null || ! $this->taxonomy->topicBelongsTo((int) $row['topic_id'], $subject['id'])) {
                $add('topic', 'That topic is not part of the chosen subject.');
            }
        }

        // ── content ──
        if (! in_array($row['type'], CoreQuestion::TYPES, true)) {
            $add('type', 'Type must be one of: '.implode(', ', CoreQuestion::TYPES).'.');
        }

        if ($row['stem'] === '') {
            $add('stem', 'The question text is empty.');
        } elseif (mb_strlen($row['stem']) > 20000) {
            $add('stem', 'The question text is too long (20,000 characters at most).');
        }

        if (! in_array($row['difficulty'], CoreQuestion::DIFFICULTIES, true)) {
            $add('difficulty', 'Difficulty must be easy, medium or hard.');
        }

        if (! in_array($row['usage'], CoreQuestion::USAGES, true)) {
            $add('usage', 'Usage must be practice, test or both.');
        }

        if (! in_array($row['status'], CoreQuestion::STATUSES, true)) {
            $add('status', 'Status must be draft, in_review, published or retired.');
        }

        // ── marking ──
        $min = (float) config('core_prep.marks.min', 0.25);
        $max = (float) config('core_prep.marks.max', 10);
        if ($row['marks'] < $min || $row['marks'] > $max) {
            $add('marks', "Marks must be between {$min} and {$max}.");
        }
        if ($row['negative_marks'] < 0 || $row['negative_marks'] > $row['marks']) {
            $add('negative_marks', 'Negative marks must be between 0 and the question’s marks.');
        }

        // ── answer ──
        if ($row['type'] === CoreQuestion::TYPE_NUMERIC) {
            if ($row['numeric_min'] === null || $row['numeric_max'] === null) {
                $add('numeric_min', 'A numerical question needs its accepted answer (a value, or a range).');
            } elseif ($row['numeric_min'] > $row['numeric_max']) {
                $add('numeric_min', 'The lower bound is above the upper bound.');
            }

            return $errors;
        }

        $options = $row['options'] ?? [];
        $count = count($options);

        if ($count < 2 || $count > 6) {
            $add('options', "A multiple-choice question needs 2 to 6 options (this has {$count}).");
        }

        $texts = [];
        foreach ($options as $option) {
            if (trim($option['text']) === '') {
                $add('options', 'An option is empty.');
                break;
            }
            $texts[] = mb_strtolower(trim($option['text']));
        }
        if (count($texts) !== count(array_unique($texts))) {
            $add('options', 'Two options have identical text.');
        }

        $ids = array_column($options, 'id');
        $correct = $row['correct'] ?? [];

        if ($correct === []) {
            $add('correct', 'Mark the correct answer.');
        } elseif (array_diff($correct, $ids) !== []) {
            $add('correct', 'The correct answer ('.implode(', ', $correct).') is not one of the options ('.implode(', ', $ids).').');
        } elseif ($row['type'] === CoreQuestion::TYPE_MCQ_SINGLE && count($correct) !== 1) {
            $add('correct', 'A single-answer question has exactly one correct option.');
        } elseif ($row['type'] === CoreQuestion::TYPE_MCQ_MULTI && count($correct) < 1) {
            $add('correct', 'Mark at least one correct option.');
        }

        return $errors;
    }

    /**
     * Extra requirements for a question that students will see (in_review / published): practice shows
     * the answer with its explanation, so a practice question must have one.
     *
     * @param  array<string, mixed>  $row
     * @return list<array{field: string, message: string}>
     */
    public function publishErrors(array $row): array
    {
        $errors = [];

        if (in_array($row['usage'] ?? 'both', [CoreQuestion::USAGE_PRACTICE, CoreQuestion::USAGE_BOTH], true)
            && mb_strlen((string) ($row['explanation'] ?? '')) < 10) {
            $errors[] = ['field' => 'explanation', 'message' => 'Add an explanation — practice shows it after every answer. (A test-only question can skip it.)'];
        }

        return $errors;
    }

    private function text(mixed $value, int $max): ?string
    {
        $text = trim((string) ($value ?? ''));

        return $text === '' ? null : mb_substr($text, 0, $max);
    }

    private function number(mixed $value): ?float
    {
        if ($value === null || $value === '') {
            return null;
        }

        return is_numeric($value) ? (float) $value : null;
    }

    /** @return list<string> */
    private function list(mixed $value): array
    {
        if (is_string($value)) {
            $value = preg_split('/[;,|]+/', $value, -1, PREG_SPLIT_NO_EMPTY) ?: [];
        }

        return array_values(array_unique(array_filter(array_map(fn ($t) => mb_substr(trim((string) $t), 0, 60), (array) $value))));
    }
}
