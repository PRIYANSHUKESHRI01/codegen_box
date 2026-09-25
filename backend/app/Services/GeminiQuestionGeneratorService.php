<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;

/**
 * Generates real interview questions via Google's Gemini API — the
 * AI-authoring assistant for the same permanent App\Models\
 * InterviewQuestionBank the manual "Manage Questions" flow already
 * populates by hand (see InterviewQuestionGenerationController, which
 * persists whatever this returns). Nothing here is ephemeral: a generated
 * question is a real, durable, reusable bank row from the moment it's
 * created, same as one Ops typed in by hand.
 *
 * Mirrors WhatsAppService's "no real credentials configured yet" posture
 * (see config/whatsapp.php) — a missing API key is a clean, expected,
 * user-facing error, never a 500. Built against Gemini's stable, long-
 * documented `generateContent` REST endpoint; the model name is a plain
 * env var (config('services.gemini.model')) specifically so a naming/
 * version change is a one-line .env edit, not a code change.
 */
class GeminiQuestionGeneratorService
{
    private const MIN_DURATION_SECONDS = 60;

    private const MAX_DURATION_SECONDS = 300;

    private const CATEGORY_LABELS = [
        'technical' => 'Technical',
        'behavioral' => 'Behavioral',
        'hr' => 'HR',
        'situational' => 'Situational',
        'aptitude' => 'Aptitude',
    ];

    /**
     * @param  string[]  $categories  one or more of InterviewQuestionBank::CATEGORIES
     * @param  string[]  $avoidQuestionTexts  recent bank questions in the same categories, so the bank doesn't fill with near-duplicates as more interviews get created over time
     * @return array<int, array{question_text:string, category:string, difficulty:string, expected_duration_seconds:int, tags:array, notes_for_reviewer:?string}>
     */
    public function generate(
        string $role,
        string $difficulty,
        array $categories,
        int $count,
        ?string $skills,
        array $avoidQuestionTexts = [],
    ): array {
        $apiKey = config('services.gemini.api_key');

        if (! $apiKey) {
            throw new RuntimeException('AI question generation is not configured yet — add questions from the bank instead.');
        }

        $perCategoryCounts = $this->splitCountAcrossCategories($count, $categories);
        $prompt = $this->buildPrompt($role, $difficulty, $perCategoryCounts, $skills, $avoidQuestionTexts);

        try {
            $response = Http::withHeaders(['x-goog-api-key' => $apiKey])
                ->timeout(20)
                ->post(
                    'https://generativelanguage.googleapis.com/v1beta/models/'.config('services.gemini.model').':generateContent',
                    [
                        'contents' => [
                            ['parts' => [['text' => $prompt]]],
                        ],
                        'generationConfig' => [
                            'temperature' => 0.9,
                            'maxOutputTokens' => 4096,
                            'responseMimeType' => 'application/json',
                            'responseSchema' => $this->responseSchema(),
                        ],
                    ]
                );
        } catch (\Throwable $e) {
            Log::warning('[Gemini] request failed', ['error' => $e->getMessage()]);
            throw new RuntimeException('AI question generation is temporarily unavailable. Try again, or add questions from the bank.');
        }

        if ($response->failed()) {
            Log::warning('[Gemini] non-2xx response', ['status' => $response->status(), 'body' => $response->body()]);
            throw new RuntimeException('AI question generation is temporarily unavailable. Try again, or add questions from the bank.');
        }

        $text = $response->json('candidates.0.content.parts.0.text');
        $items = $text ? json_decode($text, true) : null;

        if (! is_array($items)) {
            Log::warning('[Gemini] unparseable response body', ['body' => $response->body()]);
            throw new RuntimeException('AI question generation returned an unexpected response. Try again, or add questions from the bank.');
        }

        $questions = $this->sanitizeItems($items);

        if (empty($questions)) {
            throw new RuntimeException('AI question generation did not return any usable questions. Try again, or add questions from the bank.');
        }

        return $questions;
    }

    /** @return array<string,int> category => how many of $count to ask for */
    private function splitCountAcrossCategories(int $count, array $categories): array
    {
        $categories = array_values(array_unique($categories));
        $base = intdiv($count, count($categories));
        $remainder = $count % count($categories);

        $split = [];
        foreach ($categories as $i => $category) {
            $split[$category] = $base + ($i < $remainder ? 1 : 0);
        }

        return array_filter($split);
    }

    private function buildPrompt(string $role, string $difficulty, array $perCategoryCounts, ?string $skills, array $avoidQuestionTexts): string
    {
        $breakdown = collect($perCategoryCounts)
            ->map(fn (int $n, string $category) => "{$n} ".self::CATEGORY_LABELS[$category].($n === 1 ? ' question' : ' questions'))
            ->implode(', ');

        $lines = [
            'You are helping build a permanent question bank for a professional AI-powered voice interview platform used by colleges and hiring companies to screen real students and job candidates.',
            "Generate exactly: {$breakdown}.",
            "Target role: \"{$role}\". Difficulty level: {$difficulty}.",
        ];

        if ($skills) {
            $lines[] = "Focus areas / key skills to probe: {$skills}.";
        }

        $lines[] = 'Requirements for every question:';
        $lines[] = '- Must be answerable OUT LOUD in a spoken interview — never ask to write code, draw a diagram, or use a whiteboard.';
        $lines[] = '- Professional, realistic, and genuinely appropriate for evaluating a candidate for this specific role and difficulty level.';
        $lines[] = '- Technical questions: favor reasoning, system design, and conceptual understanding over rote trivia lookup.';
        $lines[] = '- Behavioral/situational questions: phrase as a real scenario the candidate can answer with a concrete example (STAR-friendly).';
        $lines[] = '- HR questions: genuinely about motivation, fit, and career goals — not generic filler.';
        $lines[] = '- expected_duration_seconds should realistically reflect how long a thoughtful spoken answer takes (60-300 seconds).';
        $lines[] = '- tags: 2-4 short lowercase topic tags.';
        $lines[] = '- notes_for_reviewer: one short sentence on what a strong answer should cover — this is shown only to the human who reviews the candidate\'s recorded answer afterward, never to the candidate.';

        if (! empty($avoidQuestionTexts)) {
            $lines[] = 'Do not repeat or closely paraphrase any of these already-existing questions:';
            foreach (array_slice($avoidQuestionTexts, 0, 30) as $existing) {
                $lines[] = "- {$existing}";
            }
        }

        $lines[] = 'Return only the JSON array matching the response schema — no markdown, no commentary.';

        return implode("\n", $lines);
    }

    private function responseSchema(): array
    {
        return [
            'type' => 'ARRAY',
            'items' => [
                'type' => 'OBJECT',
                'properties' => [
                    'question_text' => ['type' => 'STRING'],
                    'category' => ['type' => 'STRING', 'enum' => array_keys(self::CATEGORY_LABELS)],
                    'difficulty' => ['type' => 'STRING', 'enum' => ['easy', 'medium', 'hard']],
                    'expected_duration_seconds' => ['type' => 'INTEGER'],
                    'tags' => ['type' => 'ARRAY', 'items' => ['type' => 'STRING']],
                    'notes_for_reviewer' => ['type' => 'STRING'],
                ],
                'required' => ['question_text', 'category', 'difficulty', 'expected_duration_seconds'],
            ],
        ];
    }

    /**
     * Never trust an external API's output to directly drive a real UI
     * timer or land malformed rows in the database — drops any item
     * missing a required field instead of failing the whole batch, and
     * clamps the duration to a sane range regardless of what the model
     * returned.
     */
    private function sanitizeItems(array $items): array
    {
        $categories = array_keys(self::CATEGORY_LABELS);
        $difficulties = ['easy', 'medium', 'hard'];
        $sanitized = [];

        foreach ($items as $item) {
            if (! is_array($item)) {
                continue;
            }

            $questionText = trim((string) ($item['question_text'] ?? ''));
            $category = $item['category'] ?? null;
            $difficulty = $item['difficulty'] ?? null;

            if ($questionText === '' || ! in_array($category, $categories, true) || ! in_array($difficulty, $difficulties, true)) {
                continue;
            }

            $duration = (int) ($item['expected_duration_seconds'] ?? 180);
            $duration = max(self::MIN_DURATION_SECONDS, min(self::MAX_DURATION_SECONDS, $duration));

            $tags = is_array($item['tags'] ?? null)
                ? array_values(array_filter(array_map('strval', $item['tags']), fn ($t) => trim($t) !== ''))
                : [];

            $sanitized[] = [
                'question_text' => $questionText,
                'category' => $category,
                'difficulty' => $difficulty,
                'expected_duration_seconds' => $duration,
                'tags' => $tags,
                'notes_for_reviewer' => trim((string) ($item['notes_for_reviewer'] ?? '')) ?: null,
            ];
        }

        return $sanitized;
    }
}
