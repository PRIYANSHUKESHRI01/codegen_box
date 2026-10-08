<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\EnforcesLearningCentreAiLimit;
use App\Http\Controllers\Controller;
use App\Models\SpeakingAttempt;
use App\Models\SpeakingPrompt;
use App\Services\GeminiSpeakingPassageService;
use App\Services\GeminiSpeakingScoringService;
use App\Services\NoSpeechDetectedException;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use RuntimeException;

/**
 * Student-facing Speaking Practice: browse passages (the shared library plus
 * ones generated for this student), read one aloud, get scored.
 *
 * Scoring is synchronous (not queued) — one recording is a single short
 * Gemini round trip, and the student is waiting on the result screen. It is
 * audio-first: the recording is the only input that counts (see
 * GeminiSpeakingScoringService), and it is processed in memory and never
 * stored — a student's voice is personal data, nothing in the product plays it
 * back, so keeping it would be liability with no benefit.
 */
class SpeakingPracticeController extends Controller
{
    use EnforcesLearningCentreAiLimit;

    public function __construct(
        private readonly GeminiSpeakingScoringService $scorer,
        private readonly GeminiSpeakingPassageService $passageWriter,
    ) {}

    public function index(Request $request)
    {
        $userId = $request->user()->id;

        $prompts = SpeakingPrompt::visibleTo($userId)
            ->where('is_active', true)
            // CASE rather than MySQL's FIELD() so the same query runs on the SQLite the tests use.
            ->orderByRaw("CASE difficulty WHEN 'beginner' THEN 0 WHEN 'intermediate' THEN 1 ELSE 2 END")
            ->orderBy('display_order')
            ->orderBy('id')
            ->get();

        // One aggregate query instead of loading every attempt row the student has ever made.
        $stats = SpeakingAttempt::where('user_id', $userId)
            ->whereIn('speaking_prompt_id', $prompts->pluck('id'))
            ->selectRaw('speaking_prompt_id, COUNT(*) as attempt_count, MAX(CASE WHEN scored_at IS NOT NULL THEN overall_score END) as best_score')
            ->groupBy('speaking_prompt_id')
            ->get()
            ->keyBy('speaking_prompt_id');

        $summaries = $prompts->map(fn (SpeakingPrompt $prompt) => [
            'id' => $prompt->id,
            'title' => $prompt->title,
            'category' => $prompt->category,
            'difficulty' => $prompt->difficulty,
            'word_count' => $prompt->wordCount(),
            'best_score' => ($best = $stats->get($prompt->id)?->best_score) !== null ? (int) $best : null,
            'attempt_count' => (int) ($stats->get($prompt->id)?->attempt_count ?? 0),
            'source' => $prompt->source,
            'interest' => $prompt->interest,
            'is_mine' => $prompt->user_id !== null,
        ]);

        return response()->json([
            'prompts' => $summaries->where('is_mine', false)->values(),
            // Newest first, so a passage generated a moment ago is the first thing they see.
            'my_prompts' => $prompts->where('user_id', $userId)->sortByDesc('id')->map(fn (SpeakingPrompt $p) => $summaries->firstWhere('id', $p->id))->values(),
        ]);
    }

    public function show(Request $request, SpeakingPrompt $speakingPrompt)
    {
        abort_unless($speakingPrompt->is_active && $speakingPrompt->isVisibleTo($request->user()->id), 404);

        $attempts = SpeakingAttempt::where('user_id', $request->user()->id)
            ->where('speaking_prompt_id', $speakingPrompt->id)
            ->orderByDesc('created_at')
            ->limit(5)
            ->get();

        return response()->json([
            'prompt' => $this->promptPayload($speakingPrompt),
            'recent_attempts' => $attempts->map(fn (SpeakingAttempt $a) => $this->attemptPayload($a))->values(),
        ]);
    }

    public function generate(Request $request)
    {
        $this->assertWithinDailyLearningCentreAiLimit($request);

        $validated = $request->validate([
            'topic' => ['required', 'string', 'min:3', 'max:80'],
            'difficulty' => ['required', Rule::in(SpeakingPrompt::DIFFICULTIES)],
            'purpose' => ['nullable', Rule::in(array_keys(GeminiSpeakingPassageService::PURPOSES))],
        ]);

        try {
            $passage = $this->passageWriter->generate($validated['topic'], $validated['difficulty'], $validated['purpose'] ?? 'interview');
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        $prompt = SpeakingPrompt::create([
            'user_id' => $request->user()->id,
            'title' => $passage['title'],
            'passage_text' => $passage['passage_text'],
            'category' => $passage['category'],
            'difficulty' => $validated['difficulty'],
            'source' => SpeakingPrompt::SOURCE_AI,
            'interest' => GeminiSpeakingPassageService::cleanTopic($validated['topic']),
            'target_wpm_min' => 110,
            'target_wpm_max' => 160,
            'is_active' => true,
            'display_order' => 0,
        ]);

        // Keep a student's list tidy: archive (never delete — their attempts reference it) beyond the cap.
        $stale = SpeakingPrompt::where('user_id', $request->user()->id)
            ->where('source', SpeakingPrompt::SOURCE_AI)
            ->where('is_active', true)
            ->orderByDesc('id')
            ->skip(SpeakingPrompt::MAX_ACTIVE_AI_PER_USER)
            ->limit(1000)
            ->pluck('id');
        if ($stale->isNotEmpty()) {
            SpeakingPrompt::whereIn('id', $stale)->update(['is_active' => false]);
        }

        return response()->json(['prompt' => $this->promptPayload($prompt)], 201);
    }

    public function submit(Request $request, SpeakingPrompt $speakingPrompt)
    {
        abort_unless($speakingPrompt->is_active && $speakingPrompt->isVisibleTo($request->user()->id), 404);

        $this->assertWithinDailyLearningCentreAiLimit($request);

        $validated = $request->validate([
            // The recording is the only thing that is scored. `transcript_text` is the browser's live
            // caption, kept for reference only — it is never trusted or sent to the scorer.
            'audio' => ['required', 'file', 'mimes:webm,ogg,oga,wav,mp3,m4a,mp4', 'min:2', 'max:20480'],
            'duration_seconds' => ['required', 'integer', 'min:1', 'max:300'],
            'transcript_text' => ['nullable', 'string', 'max:6000'],
        ]);

        $file = $request->file('audio');

        $attempt = SpeakingAttempt::create([
            'user_id' => $request->user()->id,
            'speaking_prompt_id' => $speakingPrompt->id,
            'attempt_number' => SpeakingAttempt::where('user_id', $request->user()->id)
                ->where('speaking_prompt_id', $speakingPrompt->id)
                ->whereNull('scoring_failed_at')
                ->count() + 1,
            'transcript_text' => $validated['transcript_text'] ?? null,
            'duration_seconds' => $validated['duration_seconds'],
        ]);

        try {
            $result = $this->scorer->score(
                $speakingPrompt->passage_text,
                $validated['duration_seconds'],
                base64_encode((string) file_get_contents($file->getRealPath())),
                $this->geminiMimeType((string) $file->getMimeType()),
                $speakingPrompt->target_wpm_min,
                $speakingPrompt->target_wpm_max,
            );
        } catch (NoSpeechDetectedException $e) {
            // Nothing to score — drop the row so a muted mic doesn't count as an attempt.
            $attempt->delete();

            return response()->json(['message' => $e->getMessage(), 'code' => 'no_speech'], 422);
        } catch (RuntimeException $e) {
            $attempt->update(['scoring_failed_at' => now()]);

            return response()->json(['message' => $e->getMessage(), 'code' => 'scoring_failed'], 422);
        }

        $attempt->update([
            'heard_transcript' => $result['heard_transcript'],
            'overall_score' => $result['overall_score'],
            'clarity_score' => $result['clarity_score'],
            'fluency_score' => $result['fluency_score'],
            'accuracy_score' => $result['accuracy_score'],
            'pacing_wpm' => $result['pacing_wpm'],
            'filler_count' => $result['filler_count'],
            'feedback' => $result['feedback'],
            'improvement_tips' => $result['improvement_tips'],
            'word_feedback' => $result['word_feedback'],
            'passed' => $result['overall_score'] >= SpeakingAttempt::PASS_THRESHOLD,
            'scored_with_audio' => true,
            'scored_at' => now(),
        ]);

        return response()->json(['attempt' => $this->attemptPayload($attempt->fresh())]);
    }

    /** The browser reports what the container looks like; Gemini wants an audio-ish type it recognises. */
    private function geminiMimeType(string $detected): string
    {
        return match (strtolower($detected)) {
            'audio/x-wav', 'audio/wave', 'audio/vnd.wave' => 'audio/wav',
            'application/ogg', 'video/ogg' => 'audio/ogg',
            'audio/x-m4a', 'video/mp4' => 'audio/mp4',
            'audio/mpeg3', 'audio/x-mpeg-3' => 'audio/mpeg',
            // Chrome's audio-only MediaRecorder output is sniffed as video/webm — Gemini accepts it (verified live).
            default => $detected,
        };
    }

    private function promptPayload(SpeakingPrompt $prompt): array
    {
        return [
            'id' => $prompt->id,
            'title' => $prompt->title,
            'passage_text' => $prompt->passage_text,
            'category' => $prompt->category,
            'difficulty' => $prompt->difficulty,
            'word_count' => $prompt->wordCount(),
            'target_wpm_min' => $prompt->target_wpm_min,
            'target_wpm_max' => $prompt->target_wpm_max,
            'source' => $prompt->source,
            'interest' => $prompt->interest,
            'is_mine' => $prompt->user_id !== null,
        ];
    }

    private function attemptPayload(SpeakingAttempt $attempt): array
    {
        $feedback = $attempt->word_feedback ?? [];

        return [
            'id' => $attempt->id,
            'attempt_number' => $attempt->attempt_number,
            // What the scorer actually heard when available (older rows only have the browser's caption).
            'transcript_text' => $attempt->heard_transcript ?? $attempt->transcript_text,
            'has_audio' => $attempt->scored_with_audio,
            'duration_seconds' => $attempt->duration_seconds,
            'pacing_wpm' => $attempt->pacing_wpm,
            'filler_count' => $attempt->filler_count,
            'overall_score' => $attempt->overall_score,
            'clarity_score' => $attempt->clarity_score,
            'fluency_score' => $attempt->fluency_score,
            'accuracy_score' => $attempt->accuracy_score,
            'feedback' => $attempt->feedback,
            'improvement_tips' => $attempt->improvement_tips ?? [],
            'words' => $feedback['words'] ?? [],
            'pronunciation' => $feedback['pronunciation'] ?? [],
            'accuracy_note' => $feedback['accuracy_note'] ?? null,
            'long_pauses' => $feedback['long_pauses'] ?? null,
            'passed' => $attempt->passed,
            'scoring_failed' => $attempt->scoringFailed(),
            'created_at' => $attempt->created_at,
        ];
    }
}
