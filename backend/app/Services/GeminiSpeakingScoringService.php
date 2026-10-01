<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;

/**
 * Scores one Speaking Practice attempt — the flagship Learning Centre
 * module. Unlike GeminiInterviewScoringService (which only ever sees a text
 * transcript), this sends Gemini the actual recorded audio as multimodal
 * `inline_data` whenever one was captured, so clarity/fluency genuinely
 * reflect how the student sounded, not just what SpeechRecognition guessed
 * they said. The target passage and a deterministic word-overlap similarity
 * figure are always included as grounding context so the model isn't
 * inventing an "accuracy" judgement from nothing.
 *
 * `pacing_wpm` is never asked of Gemini at all — words-per-minute is
 * arithmetic (transcript word count / duration), computed here and only fed
 * to the model as context, same "never let the model hallucinate a number
 * we can compute exactly" posture as everywhere else scores are sanitized
 * in this codebase.
 *
 * If sending audio fails for any reason (encoding issue, the model
 * rejecting the media, a transient error), this transparently retries once
 * with transcript-only content instead of failing the whole attempt — a
 * technical hiccup on the audio path must never block scoring entirely.
 * Same "no key configured = clean expected error, never a 500" posture as
 * every other Gemini service here.
 */
class GeminiSpeakingScoringService
{
    private const MAX_TIPS = 4;

    /**
     * @return array{overall_score:int, clarity_score:int, fluency_score:int, accuracy_score:int, feedback:string, improvement_tips:array<int,string>, pacing_wpm:int}
     */
    public function score(
        string $passageText,
        string $transcriptText,
        int $durationSeconds,
        ?string $audioBase64,
        ?string $audioMimeType,
    ): array {
        $apiKey = config('services.gemini.api_key');

        if (! $apiKey) {
            throw new RuntimeException('AI speech scoring is not configured yet.');
        }

        $wordCount = str_word_count($transcriptText);
        $pacingWpm = $durationSeconds > 0 ? (int) round(($wordCount / $durationSeconds) * 60) : 0;
        $similarityPercent = $this->wordOverlapSimilarity($passageText, $transcriptText);

        $prompt = $this->buildPrompt($passageText, $transcriptText, $pacingWpm, $similarityPercent, hasAudio: $audioBase64 !== null);

        $result = $this->callGemini($apiKey, $prompt, $audioBase64, $audioMimeType);

        // One transcript-only retry if the multimodal (audio) call failed —
        // never let an audio-path problem sink an otherwise-scorable attempt.
        if ($result === null && $audioBase64 !== null) {
            Log::warning('[Gemini] speaking scoring with audio failed, retrying transcript-only');
            $fallbackPrompt = $this->buildPrompt($passageText, $transcriptText, $pacingWpm, $similarityPercent, hasAudio: false);
            $result = $this->callGemini($apiKey, $fallbackPrompt, null, null);
        }

        if ($result === null) {
            throw new RuntimeException('AI speech scoring is temporarily unavailable. Please try again.');
        }

        $sanitized = $this->sanitizeResult($result);

        if ($sanitized === null) {
            throw new RuntimeException('AI speech scoring returned an unexpected response.');
        }

        return [...$sanitized, 'pacing_wpm' => $pacingWpm];
    }

    /** @return array<string,mixed>|null decoded JSON result, or null on any failure */
    private function callGemini(string $apiKey, string $prompt, ?string $audioBase64, ?string $audioMimeType): ?array
    {
        $parts = [];
        if ($audioBase64 !== null && $audioMimeType !== null) {
            $parts[] = ['inline_data' => ['mime_type' => $audioMimeType, 'data' => $audioBase64]];
        }
        $parts[] = ['text' => $prompt];

        try {
            $response = Http::withHeaders(['x-goog-api-key' => $apiKey])
                ->timeout(30)
                ->post(
                    'https://generativelanguage.googleapis.com/v1beta/models/'.config('services.gemini.model').':generateContent',
                    [
                        'contents' => [['parts' => $parts]],
                        'generationConfig' => [
                            'temperature' => 0.3,
                            'maxOutputTokens' => 1024,
                            'responseMimeType' => 'application/json',
                            'responseSchema' => $this->responseSchema(),
                        ],
                    ]
                );
        } catch (\Throwable $e) {
            Log::warning('[Gemini] speaking scoring request failed', ['error' => $e->getMessage()]);

            return null;
        }

        if ($response->failed()) {
            Log::warning('[Gemini] speaking scoring non-2xx response', ['status' => $response->status(), 'body' => $response->body()]);

            return null;
        }

        $text = $response->json('candidates.0.content.parts.0.text');
        $decoded = $text ? json_decode($text, true) : null;

        return is_array($decoded) ? $decoded : null;
    }

    private function buildPrompt(string $passageText, string $transcriptText, int $pacingWpm, int $similarityPercent, bool $hasAudio): string
    {
        $lines = [
            $hasAudio
                ? 'You are an expert, encouraging English speaking coach. Listen to the attached audio recording of a student reading the passage below aloud, and evaluate how clearly and fluently they spoke.'
                : 'You are an expert, encouraging English speaking coach. No audio is available for this attempt — evaluate using only the speech-to-text transcript below of a student reading the passage aloud.',
            '',
            'Target passage (what they were asked to read):',
            "\"{$passageText}\"",
            '',
            'Transcript of what was captured (speech-to-text, may contain minor recognition errors):',
            "\"{$transcriptText}\"",
            '',
            "For reference only, computed automatically (do not treat as ground truth, transcription is imperfect): reading pace was approximately {$pacingWpm} words per minute, and a rough word-overlap similarity to the target passage is {$similarityPercent}%.",
            '',
            'Score 0-100 on each dimension:',
            '- clarity_score: how clearly articulated and easy to understand the speech is'.($hasAudio ? ' (pronunciation, enunciation, from the audio itself)' : ' (inferred from transcript coherence, since no audio was available)'),
            '- fluency_score: smoothness — natural phrasing, minimal hesitation/filler words/false starts, steady flow',
            '- accuracy_score: how faithfully the content matches the target passage (missed/added/substituted words or phrases)',
            '- overall_score: your holistic judgement, not necessarily the average of the above',
            'Be honest, not generous — a short, garbled, or clearly-not-the-passage transcript should score low. This is a LEARNING tool: feedback should be specific and actionable, never harsh.',
            'feedback: 2-3 encouraging but honest sentences written directly TO the student ("You read smoothly through the first half, but..." not "The student...").',
            'improvement_tips: up to '.self::MAX_TIPS.' short, concrete, actionable tips.',
            'Return only the JSON object matching the response schema, no markdown, no commentary.',
        ];

        return implode("\n", $lines);
    }

    private function responseSchema(): array
    {
        return [
            'type' => 'OBJECT',
            'properties' => [
                'overall_score' => ['type' => 'INTEGER'],
                'clarity_score' => ['type' => 'INTEGER'],
                'fluency_score' => ['type' => 'INTEGER'],
                'accuracy_score' => ['type' => 'INTEGER'],
                'feedback' => ['type' => 'STRING'],
                'improvement_tips' => ['type' => 'ARRAY', 'items' => ['type' => 'STRING']],
            ],
            'required' => ['overall_score', 'clarity_score', 'fluency_score', 'accuracy_score', 'feedback', 'improvement_tips'],
        ];
    }

    /** Never trusts Gemini's output blindly — clamps every score 0-100 and requires non-empty feedback, same posture as GeminiInterviewScoringService::sanitizeResults(). */
    private function sanitizeResult(array $result): ?array
    {
        $clamp = fn ($v) => max(0, min(100, (int) ($v ?? 0)));

        $feedback = trim((string) ($result['feedback'] ?? ''));
        if ($feedback === '') {
            return null;
        }

        $tips = is_array($result['improvement_tips'] ?? null)
            ? array_values(array_filter(array_map(fn ($t) => trim((string) $t), $result['improvement_tips']), fn ($t) => $t !== ''))
            : [];

        return [
            'overall_score' => $clamp($result['overall_score'] ?? null),
            'clarity_score' => $clamp($result['clarity_score'] ?? null),
            'fluency_score' => $clamp($result['fluency_score'] ?? null),
            'accuracy_score' => $clamp($result['accuracy_score'] ?? null),
            'feedback' => $feedback,
            'improvement_tips' => array_slice($tips, 0, self::MAX_TIPS),
        ];
    }

    /** A rough, deterministic grounding signal fed into the prompt — not the final accuracy score itself (Gemini owns that judgement). */
    private function wordOverlapSimilarity(string $a, string $b): int
    {
        $normalize = fn (string $s) => trim(preg_replace('/[^a-z0-9\s]/', '', strtolower($s)) ?? '');
        $percent = 0.0;
        similar_text($normalize($a), $normalize($b), $percent);

        return (int) round($percent);
    }
}
