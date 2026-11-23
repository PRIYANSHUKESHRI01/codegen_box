<?php

namespace App\Services;

use App\Support\InterviewDiscipline;
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
     * Resolves the tiered model hierarchy in priority order:
     * 1. Primary configured model (e.g. gemini-2.5-flash, or gemini-3.* if explicitly set)
     * 2. gemini-2.5-flash
     * 3. gemini-2.0-flash
     * 4. gemini-1.5-flash
     * 5. gemini-2.0-flash-lite
     * 6. gemini-1.5-pro
     *
     * @return string[]
     */
    public function getModelHierarchy(): array
    {
        $primary = (string) config('services.gemini.model', 'gemini-2.5-flash');
        $configuredFallbacks = config('services.gemini.fallback_models');

        if (! is_array($configuredFallbacks) || empty($configuredFallbacks)) {
            $configuredFallbacks = [
                'gemini-2.5-flash',
                'gemini-2.0-flash',
                'gemini-1.5-flash',
                'gemini-2.0-flash-lite',
                'gemini-1.5-pro',
            ];
        }

        // Deduplicate and preserve priority cascade
        $chain = array_values(array_unique(array_filter([$primary, ...$configuredFallbacks])));

        return ! empty($chain) ? $chain : ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
    }

    /**
     * Robust parser for Gemini JSON output. Strips markdown code fences (```json ... ```)
     * and handles raw or wrapped JSON arrays without failing on commentary.
     */
    public function parseJsonResponse(?string $raw): ?array
    {
        if ($raw === null || trim($raw) === '') {
            return null;
        }

        $trimmed = trim($raw);

        // Strip markdown code fences if present (e.g. ```json ... ``` or ``` ...)
        $clean = preg_replace('/^```(?:json)?\s*/i', '', $trimmed);
        $clean = preg_replace('/\s*```$/', '', (string) $clean);
        $clean = trim((string) $clean);

        $decoded = json_decode($clean, true);
        if (is_array($decoded)) {
            return $decoded;
        }

        // Substring extraction fallback between first '[' and last ']'
        $firstBracket = strpos($clean, '[');
        $lastBracket = strrpos($clean, ']');
        if ($firstBracket !== false && $lastBracket !== false && $lastBracket > $firstBracket) {
            $jsonSub = substr($clean, $firstBracket, $lastBracket - $firstBracket + 1);
            $subDecoded = json_decode($jsonSub, true);
            if (is_array($subDecoded)) {
                return $subDecoded;
            }
        }

        return null;
    }

    /**
     * @param  array<int, array{response_id:int, question_text:string, category:string, difficulty:string, notes_for_reviewer:?string, transcript_text:string}>  $items
     * @return array<int, array{response_id:int, score:int, feedback:string}>
     */
    public function score(array $items, string $role, ?string $discipline = null): array
    {
        $rotationService = app(GeminiKeyRotationService::class);
        $apiKey = $rotationService->getActiveApiKeyString();

        if (! $apiKey) {
            throw new RuntimeException('AI interview scoring is not configured yet.');
        }

        if (empty($items)) {
            return [];
        }

        $prompt = $this->buildPrompt($items, $role, $discipline);
        $models = $this->getModelHierarchy();
        $validResponseIds = array_map(fn (array $item) => $item['response_id'], $items);

        $lastException = null;

        // Multi-tier model fallback: cascades through primary (e.g. gemini-3.* or gemini-2.5-flash)
        // to gemini-2.0-flash, gemini-1.5-flash, etc. if any model endpoint is unavailable, 404, or fails.
        foreach ($models as $model) {
            try {
                $response = $rotationService->runWithFallback(function (string $currentKey) use ($prompt, $model) {
                    return Http::withHeaders(['x-goog-api-key' => $currentKey])
                        ->timeout(30)
                        ->retry(2, 1000, fn ($exception) => $exception instanceof \Illuminate\Http\Client\ConnectionException)
                        ->post(
                            "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent",
                            [
                                'contents' => [
                                    ['parts' => [['text' => $prompt]]],
                                ],
                                'generationConfig' => [
                                    // Lower temperature for consistent, repeatable evaluation
                                    'temperature' => 0.2,
                                    'maxOutputTokens' => 4096,
                                    'responseMimeType' => 'application/json',
                                    'responseSchema' => $this->responseSchema(),
                                ],
                            ]
                        );
                });

                if ($response->failed()) {
                    Log::warning("[GeminiScoring] Model '{$model}' returned non-2xx ({$response->status()}). Cascading to next model...", [
                        'status' => $response->status(),
                        'body' => substr($response->body(), 0, 300),
                    ]);
                    continue;
                }

                $rawText = $response->json('candidates.0.content.parts.0.text');
                $results = $this->parseJsonResponse($rawText);

                if (! is_array($results)) {
                    Log::warning("[GeminiScoring] Model '{$model}' returned unparseable text. Cascading to next model...", [
                        'text' => substr((string) $rawText, 0, 300),
                    ]);
                    continue;
                }

                $sanitized = $this->sanitizeResults($results, $validResponseIds);

                if (! empty($sanitized)) {
                    return $sanitized;
                }

                Log::warning("[GeminiScoring] Model '{$model}' produced no usable sanitized results. Trying next model...");
            } catch (\Throwable $e) {
                Log::warning("[GeminiScoring] Model '{$model}' call failed: {$e->getMessage()}. Cascading to next fallback model...");
                $lastException = $e;
            }
        }

        Log::warning('[GeminiScoring] All models in hierarchy failed or returned invalid outputs', [
            'models' => $models,
            'last_error' => $lastException?->getMessage(),
        ]);

        throw new RuntimeException('AI interview scoring is temporarily unavailable across all models.');
    }

    private function buildPrompt(array $items, string $role, ?string $discipline = null): string
    {
        $lines = [
            'You are an expert, calibrated technical interviewer evaluating candidate SPOKEN answers for the role: "'.$role.'".',
            'Transcripts are verbatim speech-to-text. Minor conversational filler words should not penalize the candidate if the technical meaning is solid.',
            'Score each answer from 0 to 100 based on standard industry calibration:',
            '- 90-100: Exceptional / Deep mastery. Covers core principles, architecture, edge cases, and best practices with precision.',
            '- 75-89: Strong / Hire-ready. Technically accurate, covers key mechanisms clearly with appropriate terminology.',
            '- 60-74: Acceptable / Passing baseline. Demonstrates fundamental understanding, but misses secondary nuances or depth.',
            '- 30-59: Weak / Incomplete. Surface-level or partially incorrect; lacks vital architectural or logical concepts.',
            '- 0-29: Poor / Off-topic / Silent. Vague, completely incorrect, irrelevant, or empty transcript.',
            self::CATEGORY_GUIDANCE,
            // Only for a core-branch interview (ECE, EEE, Mechanical, Civil): how to judge a spoken technical answer there.
            ...array_filter([InterviewDiscipline::scoringGuidance($discipline)]),
            'For each answer, provide:',
            '1. "score": An integer from 0 to 100.',
            '2. "feedback": Exactly 1-2 constructive, direct sentences written TO the candidate ("You clearly explained X, but in a technical round be sure to also discuss Y...").',
            'Be honest, objective, and fair — neither overly generous nor unfairly punishing for casual speech.',
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
