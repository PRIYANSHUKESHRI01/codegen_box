<?php

namespace App\Services;

use App\Models\SoftSkillQuestion;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;

/**
 * Generates real, permanent soft_skill_questions bank rows via Gemini —
 * the "add 100s of questions later" tool, mirroring
 * GeminiQuestionGeneratorService exactly (same request shape, same
 * "no key configured = clean expected error, never a 500" posture, same
 * never-trust-the-model sanitization). Shared across every authoring role
 * (Ops/TPO/Company), same as InterviewQuestionGenerationController already is.
 */
class GeminiSoftSkillQuestionGeneratorService
{
    private const CATEGORY_GUIDANCE = [
        SoftSkillQuestion::CATEGORY_APTITUDE => 'Quantitative aptitude: percentages, profit/loss, averages, ratios, time-speed-distance, time-work, simple/compound interest, number series, permutations/probability basics. Include the calculation, not just the concept.',
        SoftSkillQuestion::CATEGORY_REASONING => 'Logical reasoning: number/letter series, coding-decoding, blood relations, directions, syllogisms, analogies, odd-one-out.',
        SoftSkillQuestion::CATEGORY_ENGLISH => 'Verbal/English ability: synonyms, antonyms, one-word substitution, sentence correction, grammar, vocabulary-in-context.',
        SoftSkillQuestion::CATEGORY_SITUATIONAL => 'Workplace situational judgment: a short realistic scenario (teamwork, deadlines, conflict, professionalism, communication) with the BEST professional response among the options — no single objectively "correct" calculation, but one clearly best answer.',
    ];

    /**
     * @return array<int, array{question_text:string, options:array<int,string>, correct_index:int, explanation:string}>
     */
    public function generate(string $category, string $difficulty, int $count): array
    {
        $apiKey = config('services.gemini.api_key');

        if (! $apiKey) {
            throw new RuntimeException('AI question generation is not configured yet — add questions manually instead.');
        }

        $prompt = $this->buildPrompt($category, $difficulty, $count);

        try {
            $response = Http::withHeaders(['x-goog-api-key' => $apiKey])
                ->timeout(25)
                ->post(
                    'https://generativelanguage.googleapis.com/v1beta/models/'.config('services.gemini.model').':generateContent',
                    [
                        'contents' => [['parts' => [['text' => $prompt]]]],
                        'generationConfig' => [
                            'temperature' => 0.85,
                            'maxOutputTokens' => 4096,
                            'responseMimeType' => 'application/json',
                            'responseSchema' => $this->responseSchema(),
                        ],
                    ]
                );
        } catch (\Throwable $e) {
            Log::warning('[Gemini] soft skill question request failed', ['error' => $e->getMessage()]);
            throw new RuntimeException('AI question generation is temporarily unavailable. Try again, or add questions manually.');
        }

        if ($response->failed()) {
            Log::warning('[Gemini] soft skill question non-2xx response', ['status' => $response->status(), 'body' => $response->body()]);
            throw new RuntimeException('AI question generation is temporarily unavailable. Try again, or add questions manually.');
        }

        $text = $response->json('candidates.0.content.parts.0.text');
        $items = $text ? json_decode($text, true) : null;

        if (! is_array($items)) {
            Log::warning('[Gemini] soft skill question unparseable response', ['body' => $response->body()]);
            throw new RuntimeException('AI question generation returned an unexpected response. Try again, or add questions manually.');
        }

        $questions = $this->sanitizeItems($items);

        if (empty($questions)) {
            throw new RuntimeException('AI question generation did not return any usable questions. Try again, or add questions manually.');
        }

        return $questions;
    }

    private function buildPrompt(string $category, string $difficulty, int $count): string
    {
        return implode("\n", [
            'You are building a campus-placement soft skills / aptitude test question bank, in the style of real platforms like AMCAT, CoCubes and TCS NQT.',
            "Generate exactly {$count} multiple-choice questions, category: \"{$category}\", difficulty: {$difficulty}.",
            self::CATEGORY_GUIDANCE[$category] ?? '',
            'Each question: exactly 4 answer options, exactly one correct, three plausible-but-wrong distractors of similar difficulty — never an ambiguous or trick question.',
            'explanation: one short sentence on why the correct option is right (shown to the student after they answer, for genuine learning value).',
            'Vary the question across the batch — no repeats or near-duplicates.',
            'Return only the JSON array matching the response schema, no markdown, no commentary.',
        ]);
    }

    private function responseSchema(): array
    {
        return [
            'type' => 'ARRAY',
            'items' => [
                'type' => 'OBJECT',
                'properties' => [
                    'question_text' => ['type' => 'STRING'],
                    'options' => ['type' => 'ARRAY', 'items' => ['type' => 'STRING']],
                    'correct_index' => ['type' => 'INTEGER'],
                    'explanation' => ['type' => 'STRING'],
                ],
                'required' => ['question_text', 'options', 'correct_index', 'explanation'],
            ],
        ];
    }

    /** Never trusts external output — drops malformed items, requires exactly 4 options, clamps correct_index into range. */
    private function sanitizeItems(array $items): array
    {
        $sanitized = [];

        foreach ($items as $item) {
            if (! is_array($item)) {
                continue;
            }

            $questionText = trim((string) ($item['question_text'] ?? ''));
            $options = is_array($item['options'] ?? null) ? array_values(array_map('strval', $item['options'])) : [];
            $explanation = trim((string) ($item['explanation'] ?? ''));

            if ($questionText === '' || count($options) !== 4 || $explanation === '') {
                continue;
            }

            $correctIndex = (int) ($item['correct_index'] ?? -1);
            if ($correctIndex < 0 || $correctIndex > 3) {
                continue;
            }

            $sanitized[] = [
                'question_text' => $questionText,
                'options' => $options,
                'correct_index' => $correctIndex,
                'explanation' => $explanation,
            ];
        }

        return $sanitized;
    }
}
