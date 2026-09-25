<?php

namespace App\Jobs;

use App\Models\InterviewSession;
use App\Services\GeminiInterviewScoringService;
use App\Services\InterviewTrackAdvancementService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Dispatched the instant a candidate finishes ANY interview (track round or
 * standalone — see InterviewController::answer()) so they see a real score
 * moments later instead of waiting on a human reviewer. Scores the whole
 * session in one batched Gemini call (GeminiInterviewScoringService), writes
 * each response's score/feedback, computes the session's composite, and for
 * a track round auto-advances via InterviewTrackAdvancementService.
 *
 * On any failure (missing key, API error, malformed/partial response) the
 * session is left unscored with `scoring_failed_at` set — GET
 * /interviews/{interview}/result reads that and tells the frontend to stop
 * polling and fall back to "a person will review this" — this job never
 * fabricates a score, same posture as every other Gemini call site in this
 * app. A human can still open ReviewSessionsModal and score/finalize the
 * session manually at any point, scored or not.
 */
class ScoreInterviewSessionJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 2;

    public function __construct(private readonly int $interviewSessionId)
    {
    }

    public function handle(GeminiInterviewScoringService $scoringService, InterviewTrackAdvancementService $advancementService): void
    {
        $session = InterviewSession::with(['interview.track', 'interview.placementDrive', 'responses.interviewQuestion.questionBank'])
            ->find($this->interviewSessionId);

        // Nothing to do if the session vanished, isn't actually complete, or
        // was already scored (a human beat the job to it, or a retry).
        if ($session === null || $session->status !== InterviewSession::STATUS_COMPLETED || $session->hasScoreAvailable()) {
            return;
        }

        $interview = $session->interview;
        $role = $interview->track?->role_title ?? $interview->placementDrive?->role_title ?? $interview->title;

        $items = $session->responses->map(fn ($response) => [
            'response_id' => $response->id,
            'question_text' => $response->interviewQuestion->questionBank->question_text,
            'category' => $response->interviewQuestion->questionBank->category,
            'difficulty' => $response->interviewQuestion->questionBank->difficulty,
            'notes_for_reviewer' => $response->interviewQuestion->questionBank->notes_for_reviewer,
            'transcript_text' => $response->transcript_text ?? '',
        ])->all();

        if (empty($items)) {
            $session->update(['scoring_failed_at' => now()]);

            return;
        }

        try {
            $results = $scoringService->score($items, (string) $role);
        } catch (Throwable $e) {
            Log::warning('[ScoreInterviewSessionJob] scoring failed', ['session_id' => $session->id, 'error' => $e->getMessage()]);
            $session->update(['scoring_failed_at' => now()]);

            return;
        }

        $resultsByResponseId = collect($results)->keyBy('response_id');

        // Gemini dropped one or more responses from the batch (a malformed
        // item sanitizeResults() had to discard) — the session isn't safely
        // scoreable on incomplete data, fail clean rather than finalize with
        // some responses silently left at score=null.
        if ($resultsByResponseId->count() < $session->responses->count()) {
            Log::warning('[ScoreInterviewSessionJob] partial scoring result', [
                'session_id' => $session->id,
                'expected' => $session->responses->count(),
                'got' => $resultsByResponseId->count(),
            ]);
            $session->update(['scoring_failed_at' => now()]);

            return;
        }

        foreach ($session->responses as $response) {
            $result = $resultsByResponseId->get($response->id);
            $response->update([
                'score' => $result['score'],
                'review_notes' => $result['feedback'],
                'ai_scored' => true,
                'scored_at' => now(),
            ]);
        }

        if ($interview->isTrackRound()) {
            $advancementService->finalizeAndAdvance($session, null);
        } else {
            $advancementService->finalizeStandaloneScoring($session);
        }
    }

    public function failed(Throwable $exception): void
    {
        Log::error('[ScoreInterviewSessionJob] job failed', ['session_id' => $this->interviewSessionId, 'error' => $exception->getMessage()]);
        InterviewSession::where('id', $this->interviewSessionId)->update(['scoring_failed_at' => now()]);
    }
}
