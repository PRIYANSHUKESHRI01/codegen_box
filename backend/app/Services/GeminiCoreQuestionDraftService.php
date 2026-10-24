<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;

/**
 * An optional first draft of Core Prep questions, to speed up the people writing the banks. NEVER a source of
 * truth: everything this returns lands as a DRAFT with source "AI draft", goes through the same validation as a
 * hand-written question, and must be read, corrected and published by a human reviewer. It is off unless
 * CORE_AI_DRAFTS is set (config core_prep.ai_drafts), because a plausible-looking wrong answer key is the worst
 * thing a question bank can contain.
 *
 * The service only talks to Gemini and returns plain rows; saving them is the controller's job, through
 * CoreQuestionService, so the lifecycle and audit trail are the ones every question has.
 */
class GeminiCoreQuestionDraftService
{
    private const GUIDE = [
        'ece' => 'Electronics & Communication Engineering (GATE EC level)',
        'eee' => 'Electrical & Electronics Engineering (GATE EE level)',
        'mech' => 'Mechanical Engineering (GATE ME level)',
        'civil' => 'Civil Engineering (GATE CE level)',
    ];

    /**
     * @param  list<string>  $avoidStems  existing questions in the same subject, so drafts do not repeat them
     * @return list<array<string, mixed>> rows shaped for CoreQuestionValidator::normalise()
     *
     * @throws RuntimeException with a message safe to show staff
     */
    public function draft(string $discipline, string $subject, ?string $topic, string $difficulty, string $type, int $count, array $avoidStems = []): array
    {
        $apiKey = config('services.gemini.api_key');

        if (! $apiKey) {
            throw new RuntimeException('AI drafting is not configured yet — write the questions by hand or import them.');
        }

        try {
            $response = Http::withHeaders(['x-goog-api-key' => $apiKey])
                ->timeout(40)
                ->post(
                    'https://generativelanguage.googleapis.com/v1beta/models/'.config('services.gemini.model').':generateContent',
                    [
                        'contents' => [['parts' => [['text' => $this->prompt($discipline, $subject, $topic, $difficulty, $type, $count, $avoidStems)]]]],
                        'generationConfig' => ['temperature' => 0.6, 'maxOutputTokens' => 8192, 'responseMimeType' => 'application/json', 'responseSchema' => $this->schema()],
                    ]
                );
        } catch (\Throwable $e) {
            Log::warning('[Gemini] core draft request failed', ['error' => $e->getMessage()]);
            throw new RuntimeException('AI drafting is temporarily unavailable. Try again, or write the questions by hand.');
        }

        if ($response->failed()) {
            Log::warning('[Gemini] core draft non-2xx', ['status' => $response->status(), 'body' => $response->body()]);
            throw new RuntimeException('AI drafting is temporarily unavailable. Try again, or write the questions by hand.');
        }

        $text = $response->json('candidates.0.content.parts.0.text');
        $items = $text ? json_decode($text, true) : null;

        if (! is_array($items)) {
            throw new RuntimeException('AI drafting returned an unexpected response. Try again.');
        }

        return $this->sanitise($items, $type, $difficulty);
    }

    private function prompt(string $discipline, string $subject, ?string $topic, string $difficulty, string $type, int $count, array $avoidStems): string
    {
        $level = self::GUIDE[$discipline] ?? $discipline;
        $format = match ($type) {
            'mcq_multi' => 'multiple-select: 4 options, one or more correct (a student must pick all and only the correct ones)',
            'numeric' => 'numerical answer: no options; give the final value as numeric_min/numeric_max (equal for an exact value, a small range if rounding is allowed) and the unit',
            default => 'single-correct multiple choice: exactly 4 options, exactly one correct',
        };

        $lines = [
            "You are a senior question-setter writing practice and test questions for {$level}.",
            "Write exactly {$count} question(s) on the subject \"{$subject}\"".($topic ? ", topic \"{$topic}\"" : '').".",
            "Difficulty: {$difficulty}. Format: {$format}.",
            'Rules:',
            '- Every question must be unambiguous and have a single defensible answer. Do not write a question whose answer you are not certain of.',
            '- Use Markdown for text and LaTeX in $...$ for mathematics. No images.',
            '- Distractors must be plausible results of real mistakes (a sign error, a wrong unit, a swapped formula), not nonsense.',
            '- The explanation must work the answer out step by step and say why each distractor is wrong.',
            '- Test engineering understanding, not memory of a trivia fact.',
        ];

        if ($avoidStems !== []) {
            $lines[] = 'Do not repeat or closely paraphrase these existing questions:';
            foreach (array_slice($avoidStems, 0, 25) as $stem) {
                $lines[] = '- '.mb_substr(preg_replace('/\s+/', ' ', $stem), 0, 160);
            }
        }

        $lines[] = 'Return only the JSON array matching the response schema — no markdown fences, no commentary.';

        return implode("\n", $lines);
    }

    private function schema(): array
    {
        return [
            'type' => 'ARRAY',
            'items' => [
                'type' => 'OBJECT',
                'properties' => [
                    'stem' => ['type' => 'STRING'],
                    'options' => ['type' => 'ARRAY', 'items' => ['type' => 'STRING']],
                    'correct_indexes' => ['type' => 'ARRAY', 'items' => ['type' => 'INTEGER']],
                    'numeric_min' => ['type' => 'NUMBER'],
                    'numeric_max' => ['type' => 'NUMBER'],
                    'numeric_unit' => ['type' => 'STRING'],
                    'explanation' => ['type' => 'STRING'],
                    'tags' => ['type' => 'ARRAY', 'items' => ['type' => 'STRING']],
                ],
                'required' => ['stem', 'explanation'],
            ],
        ];
    }

    /**
     * What Gemini says is never trusted into the bank: each item is reduced to the fields a question has, options are
     * lettered by position, the key is taken from the positions it named, and an item that does not hold together is
     * dropped. (The real validation runs again, on the real service, when the row is saved.)
     *
     * @param  array<int, mixed>  $items
     * @return list<array<string, mixed>>
     */
    private function sanitise(array $items, string $type, string $difficulty): array
    {
        $rows = [];

        foreach ($items as $item) {
            if (! is_array($item) || trim((string) ($item['stem'] ?? '')) === '') {
                continue;
            }

            $row = [
                'type' => $type,
                'stem' => trim((string) $item['stem']),
                'difficulty' => $difficulty,
                'explanation' => trim((string) ($item['explanation'] ?? '')),
                'tags' => array_slice(array_values(array_filter(array_map('strval', (array) ($item['tags'] ?? [])))), 0, 6),
                'source' => 'AI draft',
            ];

            if ($type === 'numeric') {
                if (! isset($item['numeric_min']) || ! is_numeric($item['numeric_min'])) {
                    continue;
                }
                $row['numeric_min'] = (float) $item['numeric_min'];
                $row['numeric_max'] = isset($item['numeric_max']) && is_numeric($item['numeric_max']) ? (float) $item['numeric_max'] : $row['numeric_min'];
                $row['numeric_unit'] = trim((string) ($item['numeric_unit'] ?? '')) ?: null;
            } else {
                $options = array_values(array_filter(array_map(fn ($o) => trim((string) $o), (array) ($item['options'] ?? [])), fn ($o) => $o !== ''));
                $picked = array_values(array_unique(array_filter(array_map('intval', (array) ($item['correct_indexes'] ?? [])), fn ($i) => $i >= 0 && $i < count($options))));

                if (count($options) < 2 || $picked === [] || ($type === 'mcq_single' && count($picked) !== 1)) {
                    continue;
                }

                $letters = ['a', 'b', 'c', 'd', 'e', 'f'];
                $row['options'] = array_map(fn ($text, $i) => ['id' => $letters[$i], 'text' => $text], array_slice($options, 0, 6), array_keys(array_slice($options, 0, 6)));
                $row['correct'] = array_map(fn ($i) => $letters[$i], $picked);
            }

            $rows[] = $row;
        }

        return $rows;
    }
}
