<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\EnforcesLearningCentreAiLimit;
use App\Http\Controllers\Controller;
use App\Models\SpeakingAttempt;
use App\Models\SpeakingPrompt;
use App\Services\GeminiSpeakingScoringService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

/**
 * Student-facing Speaking Practice: browse prompts, read the passage aloud,
 * get scored. Scoring is synchronous (not queued) — a single-paragraph
 * Gemini call is the same weight as InterviewQuestionGenerationController's
 * existing synchronous "Generate Questions" action, unlike whole-session
 * interview scoring (ScoreInterviewSessionJob) which is queued because it
 * runs mid-flow after the candidate has already moved on to the completion
 * screen. The frontend shows a brief "Scoring your speech…" state instead.
 */
class SpeakingPracticeController extends Controller
{
    use EnforcesLearningCentreAiLimit;

    public function __construct(private readonly GeminiSpeakingScoringService $scorer) {}

    public function index(Request $request)
    {
        $prompts = SpeakingPrompt::where('is_active', true)
            ->orderByRaw("FIELD(difficulty, 'beginner', 'intermediate', 'advanced')")
            ->orderBy('display_order')
            ->get();

        $bestByPrompt = SpeakingAttempt::where('user_id', $request->user()->id)
            ->whereIn('speaking_prompt_id', $prompts->pluck('id'))
            ->whereNotNull('scored_at')
            ->get()
            ->groupBy('speaking_prompt_id')
            ->map(fn ($attempts) => (int) $attempts->max('overall_score'));

        $attemptCounts = SpeakingAttempt::where('user_id', $request->user()->id)
            ->whereIn('speaking_prompt_id', $prompts->pluck('id'))
            ->get()
            ->groupBy('speaking_prompt_id')
            ->map(fn ($attempts) => $attempts->count());

        return response()->json([
            'prompts' => $prompts->map(fn (SpeakingPrompt $prompt) => [
                'id' => $prompt->id,
                'title' => $prompt->title,
                'category' => $prompt->category,
                'difficulty' => $prompt->difficulty,
                'word_count' => $prompt->wordCount(),
                'best_score' => $bestByPrompt->get($prompt->id),
                'attempt_count' => $attemptCounts->get($prompt->id, 0),
            ]),
        ]);
    }

    public function show(Request $request, SpeakingPrompt $speakingPrompt)
    {
        abort_unless($speakingPrompt->is_active, 404);

        $attempts = SpeakingAttempt::where('user_id', $request->user()->id)
            ->where('speaking_prompt_id', $speakingPrompt->id)
            ->orderByDesc('created_at')
            ->limit(5)
            ->get();

        return response()->json([
            'prompt' => [
                'id' => $speakingPrompt->id,
                'title' => $speakingPrompt->title,
                'passage_text' => $speakingPrompt->passage_text,
                'category' => $speakingPrompt->category,
                'difficulty' => $speakingPrompt->difficulty,
                'word_count' => $speakingPrompt->wordCount(),
                'target_wpm_min' => $speakingPrompt->target_wpm_min,
                'target_wpm_max' => $speakingPrompt->target_wpm_max,
            ],
            'recent_attempts' => $attempts->map(fn (SpeakingAttempt $a) => $this->attemptPayload($a))->values(),
        ]);
    }

    public function submit(Request $request, SpeakingPrompt $speakingPrompt)
    {
        abort_unless($speakingPrompt->is_active, 404);

        $this->assertWithinDailyLearningCentreAiLimit($request);

        $validated = $request->validate([
            'transcript_text' => ['required', 'string', 'min:1'],
            'duration_seconds' => ['required', 'integer', 'min:1', 'max:600'],
            'audio' => ['nullable', 'file', 'mimes:webm,ogg,wav,mp3,m4a', 'max:20480'],
        ]);

        $attemptNumber = SpeakingAttempt::where('user_id', $request->user()->id)
            ->where('speaking_prompt_id', $speakingPrompt->id)
            ->count() + 1;

        $audioPath = null;
        $audioMimeType = null;
        if ($request->hasFile('audio')) {
            $audioMimeType = $request->file('audio')->getMimeType();
            $audioPath = $request->file('audio')->store("learning-centre/speaking/{$request->user()->id}", 'local');
        }

        $attempt = SpeakingAttempt::create([
            'user_id' => $request->user()->id,
            'speaking_prompt_id' => $speakingPrompt->id,
            'attempt_number' => $attemptNumber,
            'transcript_text' => $validated['transcript_text'],
            'audio_path' => $audioPath,
            'duration_seconds' => $validated['duration_seconds'],
        ]);

        try {
            $audioBase64 = $audioPath !== null ? base64_encode(Storage::disk('local')->get($audioPath)) : null;

            $result = $this->scorer->score(
                $speakingPrompt->passage_text,
                $validated['transcript_text'],
                $validated['duration_seconds'],
                $audioBase64,
                $audioMimeType,
            );

            $attempt->update([
                'overall_score' => $result['overall_score'],
                'clarity_score' => $result['clarity_score'],
                'fluency_score' => $result['fluency_score'],
                'accuracy_score' => $result['accuracy_score'],
                'pacing_wpm' => $result['pacing_wpm'],
                'feedback' => $result['feedback'],
                'improvement_tips' => $result['improvement_tips'],
                'passed' => $result['overall_score'] >= SpeakingAttempt::PASS_THRESHOLD,
                'scored_at' => now(),
            ]);
        } catch (RuntimeException $e) {
            $attempt->update(['scoring_failed_at' => now()]);

            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json(['attempt' => $this->attemptPayload($attempt->fresh())]);
    }

    private function attemptPayload(SpeakingAttempt $attempt): array
    {
        return [
            'id' => $attempt->id,
            'attempt_number' => $attempt->attempt_number,
            'transcript_text' => $attempt->transcript_text,
            'has_audio' => $attempt->audio_path !== null,
            'duration_seconds' => $attempt->duration_seconds,
            'pacing_wpm' => $attempt->pacing_wpm,
            'overall_score' => $attempt->overall_score,
            'clarity_score' => $attempt->clarity_score,
            'fluency_score' => $attempt->fluency_score,
            'accuracy_score' => $attempt->accuracy_score,
            'feedback' => $attempt->feedback,
            'improvement_tips' => $attempt->improvement_tips ?? [],
            'passed' => $attempt->passed,
            'scoring_failed' => $attempt->scoringFailed(),
            'created_at' => $attempt->created_at,
        ];
    }
}
