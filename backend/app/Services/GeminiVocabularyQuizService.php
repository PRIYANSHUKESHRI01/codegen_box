<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;

/**
 * Generates a fresh vocabulary-in-context multiple-choice quiz on demand —
 * same "generate structured content via Gemini" shape as
 * GeminiQuestionGeneratorService, just for Vocabulary Sprint instead of the
 * interview question bank. Unlike that service, nothing generated here is
 * persisted to a permanent content bank — VocabularyController::generate()
 * stores the full result (including correct_index) directly on the
 * ephemeral vocabulary_attempts row it creates.
 */
class GeminiVocabularyQuizService
{
    private const QUESTION_COUNT = 6;

    /**
     * @return array<int, array{word:string, sentence:string, options:array<int,string>, correct_index:int, explanation:string}>
     */
    public function generate(string $topic, string $difficulty): array
    {
        $apiKey = config('services.gemini.api_key');

        if (! $apiKey) {
            throw new RuntimeException('AI vocabulary quiz generation is not configured yet.');
        }

        $prompt = $this->buildPrompt($topic, $difficulty);

        try {
            $response = Http::withHeaders(['x-goog-api-key' => $apiKey])
                ->timeout(20)
                ->post(
                    'https://generativelanguage.googleapis.com/v1beta/models/'.config('services.gemini.model').':generateContent',
                    [
                        'contents' => [['parts' => [['text' => $prompt]]]],
                        'generationConfig' => [
                            'temperature' => 0.8,
                            'maxOutputTokens' => 2048,
                            'responseMimeType' => 'application/json',
                            'responseSchema' => $this->responseSchema(),
                        ],
                    ]
                );
        } catch (\Throwable $e) {
            Log::warning('[Gemini] vocabulary quiz request failed', ['error' => $e->getMessage()]);
            throw new RuntimeException('AI vocabulary quiz generation is temporarily unavailable. Please try again.');
        }

        if ($response->failed()) {
            Log::warning('[Gemini] vocabulary quiz non-2xx response', ['status' => $response->status(), 'body' => $response->body()]);
            throw new RuntimeException('AI vocabulary quiz generation is temporarily unavailable. Please try again.');
        }

        $text = $response->json('candidates.0.content.parts.0.text');
        $items = $text ? json_decode($text, true) : null;

        if (! is_array($items)) {
            Log::warning('[Gemini] vocabulary quiz unparseable response', ['body' => $response->body()]);
            throw new RuntimeException('AI vocabulary quiz generation returned an unexpected response.');
        }

        $questions = $this->sanitizeItems($items);

        if (count($questions) < 3) {
            throw new RuntimeException('AI vocabulary quiz generation did not return enough usable questions. Please try again.');
        }

        return $questions;
    }

    private function buildPrompt(string $topic, string $difficulty): string
    {
        return implode("\n", [
            'You are building a vocabulary-in-context quiz for a college student improving their professional English, for an interactive learning app.',
            'Generate exactly '.self::QUESTION_COUNT.' multiple-choice questions on the topic: "'.$topic.'", at '.$difficulty.' difficulty.',
            'Each question: pick one real, useful English word relevant to the topic, use it naturally in an example sentence with the word itself replaced by a blank ("_____"), then give 4 answer options (one correct word, three plausible-but-wrong distractor words of similar difficulty), and a one-sentence explanation of why the correct word fits.',
            'Every question must have a clear single best answer — no ambiguous options.',
            'Vary the words across questions — no repeats.',
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
                    'word' => ['type' => 'STRING'],
                    'sentence' => ['type' => 'STRING'],
                    'options' => ['type' => 'ARRAY', 'items' => ['type' => 'STRING']],
                    'correct_index' => ['type' => 'INTEGER'],
                    'explanation' => ['type' => 'STRING'],
                ],
                'required' => ['word', 'sentence', 'options', 'correct_index', 'explanation'],
            ],
        ];
    }

    /** Never trusts external output — drops malformed items, clamps correct_index into range, requires exactly 4 options. */
    private function sanitizeItems(array $items): array
    {
        $sanitized = [];

        foreach ($items as $item) {
            if (! is_array($item)) {
                continue;
            }

            $word = trim((string) ($item['word'] ?? ''));
            $sentence = trim((string) ($item['sentence'] ?? ''));
            $options = is_array($item['options'] ?? null) ? array_values(array_map('strval', $item['options'])) : [];
            $explanation = trim((string) ($item['explanation'] ?? ''));

            if ($word === '' || $sentence === '' || count($options) !== 4 || $explanation === '') {
                continue;
            }

            $correctIndex = (int) ($item['correct_index'] ?? -1);
            if ($correctIndex < 0 || $correctIndex > 3) {
                continue;
            }

            $sanitized[] = [
                'word' => $word,
                'sentence' => $sentence,
                'options' => $options,
                'correct_index' => $correctIndex,
                'explanation' => $explanation,
            ];
        }

        return $sanitized;
    }
}
