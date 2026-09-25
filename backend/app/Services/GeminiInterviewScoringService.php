<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;

/**
 * Scores a completed interview session's responses via Gemini — one
 * batched call per session (every question's transcript in one prompt),
 * not one call per question, same reasoning GeminiQuestionGeneratorService
 * batches question generation: cheaper, faster, and one shared system
 * prompt instead of N repeated ones. Called by ScoreInterviewSessionJob
 * right when a session completes, for every interview now (track round or
 * standalone), not just tracks.
 *
 * Same "no real key configured yet is a clean, expected error, never a 500"
 * posture as GeminiQuestionGeneratorService/WhatsAppService — a failure
 * here leaves the session unscored (see ScoreInterviewSessionJob's
 * scoring_failed_at path) rather than ever fabricating a score.
 */
class GeminiInterviewScoringService
{
    private const CATEGORY_GUIDANCE = 'Score based on correctness/depth for technical questions, structure and specificity (STAR-style) for behavioral/situational questions, and genuine motivation/fit for HR/aptitude questions.';

    /**
     * @param  array<int, array{response_id:int, question_text:string, category:string, difficulty:string, notes_for_reviewer:?string, transcript_text:string}>  $items
     * @return array<int, array{response_id:int, score:int, feedback:string}>
     */
    public function score(array $items, string $role): array
    {
        $apiKey = config('services.gemini.api_key');

        if (! $apiKey) {
            throw new RuntimeException('AI interview scoring is not configured yet.');
        }

        if (empty($items)) {
            return [];
        }

        $prompt = $this->buildPrompt($items, $role);

        try {
            $response = Http::withHeaders(['x-goog-api-key' => $apiKey])
                ->timeout(30)
                ->post(
                    'https://generativelanguage.googleapis.com/v1beta/models/'.config('services.gemini.model').':generateContent',
                    [
                        'contents' => [
                            ['parts' => [['text' => $prompt]]],
                        ],
                        'generationConfig' => [
                            // Lower than question generation's 0.9 — evaluation
                            // should be consistent for the same answer, not creative.
                            'temperature' => 0.2,
                            'maxOutputTokens' => 4096,
                            'responseMimeType' => 'application/json',
                            'responseSchema' => $this->responseSchema(),
                        ],
                    ]
                );
        } catch (\Throwable $e) {
            Log::warning('[Gemini] interview scoring request failed', ['error' => $e->getMessage()]);
            throw new RuntimeException('AI interview scoring is temporarily unavailable.');
        }

        if ($response->failed()) {
            Log::warning('[Gemini] interview scoring non-2xx response', ['status' => $response->status(), 'body' => $response->body()]);
            throw new RuntimeException('AI interview scoring is temporarily unavailable.');
        }

        $text = $response->json('candidates.0.content.parts.0.text');
        $results = $text ? json_decode($text, true) : null;

        if (! is_array($results)) {
            Log::warning('[Gemini] interview scoring unparseable response', ['body' => $response->body()]);
            throw new RuntimeException('AI interview scoring returned an unexpected response.');
        }

        $validResponseIds = array_map(fn (array $item) => $item['response_id'], $items);
        $sanitized = $this->sanitizeResults($results, $validResponseIds);

        if (empty($sanitized)) {
            throw new RuntimeException('AI interview scoring did not return any usable results.');
        }

        return $sanitized;
    }

    private function buildPrompt(array $items, string $role): string
    {
        $lines = [
            'You are an expert, fair, consistent interviewer evaluating a candidate\'s SPOKEN interview answers (already transcribed to text) for the role: "'.$role.'".',
            'For each answer below, give a score from 0 to 100 reflecting how strong that specific answer is for its question/category/difficulty, and one short (1-2 sentence) piece of feedback written directly TO the candidate ("You explained X well, but..." not "The candidate...").',
            self::CATEGORY_GUIDANCE,
            'Be honest, not generous — a short, vague, or off-topic answer should score low. If a transcript is empty, garbled, or clearly not a real answer to the question, score it 0-20 and say so plainly.',
            '',
        ];

        foreach ($items as $item) {
            $lines[] = "### response_id: {$item['response_id']}";
            $lines[] = "Category: {$item['category']} | Difficulty: {$item['difficulty']}";
            $lines[] = "Question: {$item['question_text']}";
            if (! empty($item['notes_for_reviewer'])) {
                $lines[] = "What a strong answer covers: {$item['notes_for_reviewer']}";
            }
            $transcript = trim($item['transcript_text']) !== '' ? $item['transcript_text'] : '(no answer captured)';
            $lines[] = "Candidate's answer (transcribed): \"{$transcript}\"";
            $lines[] = '';
        }

        $lines[] = 'Return only the JSON array matching the response schema, exactly one entry per response_id listed above, no markdown, no commentary.';

        return implode("\n", $lines);
    }

    private function responseSchema(): array
    {
        return [
            'type' => 'ARRAY',
            'items' => [
                'type' => 'OBJECT',
                'properties' => [
                    'response_id' => ['type' => 'INTEGER'],
                    'score' => ['type' => 'INTEGER'],
                    'feedback' => ['type' => 'STRING'],
                ],
                'required' => ['response_id', 'score', 'feedback'],
            ],
        ];
    }

    /**
     * Never trusts the model's output blindly — drops any entry whose
     * response_id doesn't match a real response in this session (or is a
     * duplicate), and clamps score to 0-100, same defensive posture as
     * GeminiQuestionGeneratorService::sanitizeItems().
     *
     * @param  int[]  $validResponseIds
     * @return array<int, array{response_id:int, score:int, feedback:string}>
     */
    private function sanitizeResults(array $results, array $validResponseIds): array
    {
        $sanitized = [];
        $seen = [];

        foreach ($results as $result) {
            if (! is_array($result)) {
                continue;
            }

            $responseId = (int) ($result['response_id'] ?? 0);
            if (! in_array($responseId, $validResponseIds, true) || isset($seen[$responseId])) {
                continue;
            }

            $score = (int) ($result['score'] ?? -1);
            if ($score < 0 || $score > 100) {
                continue;
            }

            $feedback = trim((string) ($result['feedback'] ?? ''));
            if ($feedback === '') {
                continue;
            }

            $sanitized[] = ['response_id' => $responseId, 'score' => $score, 'feedback' => $feedback];
            $seen[$responseId] = true;
        }

        return $sanitized;
    }
}
