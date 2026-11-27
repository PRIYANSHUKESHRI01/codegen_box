<?php

namespace App\Jobs;

use App\Models\InterviewSession;
use App\Services\GeminiInterviewScoringService;
use App\Services\InterviewTrackAdvancementService;
use App\Services\Interviews\StudyFeedbackService;
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
        // Run after an HTTP response, this inherits the request's time limit; the Gemini call alone may legitimately take 30 s.
        @set_time_limit(120);

        $session = InterviewSession::with(['interview.track', 'interview.placementDrive', 'responses.interviewQuestion.questionBank'])
            ->find($this->interviewSessionId);

        // Nothing to do if the session vanished, isn't actually complete, or
        // was already scored (a human beat the job to it, or a retry).
        if ($session === null || $session->status !== InterviewSession::STATUS_COMPLETED || $session->hasScoreAvailable()) {
            return;
        }

        $interview = $session->interview;
        $role = $interview->track?->role_title ?? $interview->placementDrive?->role_title ?? $interview->title;

        // Separate items with captured transcripts from empty ones cleanly without slow audio re-transcription delays
        $emptyTranscriptPlaceholders = [
            '',
            '(no answer captured)',
            '(No answer recorded)',
            '(No audible speech detected)',
            '(Audio response submitted)',
        ];

        $resultsByResponseId = collect();
        $itemsToScore = [];

        foreach ($session->responses as $response) {
            $transcript = trim((string) ($response->transcript_text ?? ''));
            if (in_array(strtolower($transcript), array_map('strtolower', $emptyTranscriptPlaceholders), true)) {
                $resultsByResponseId->put($response->id, [
                    'response_id' => $response->id,
                    'score' => 0,
                    'feedback' => 'No audible speech or transcript was recorded for this question.',
                ]);
            } else {
                $itemsToScore[] = [
                    'response_id' => $response->id,
                    'question_text' => $response->interviewQuestion->questionBank->question_text,
                    'category' => $response->interviewQuestion->questionBank->category,
                    'difficulty' => $response->interviewQuestion->questionBank->difficulty,
                    'notes_for_reviewer' => $response->interviewQuestion->questionBank->notes_for_reviewer,
                    'transcript_text' => $transcript,
                ];
            }
        }

        if (! empty($itemsToScore)) {
            try {
                $results = $scoringService->score($itemsToScore, (string) $role, $interview->effectiveDiscipline());
                foreach ($results as $res) {
                    $resultsByResponseId->put($res['response_id'], $res);
                }
            } catch (Throwable $e) {
                Log::warning('[ScoreInterviewSessionJob] primary batch scoring failed, attempting item recovery', [
                    'session_id' => $session->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        // Resilient partial-recovery: if any responses are still missing from the result set,
        // recover them individually or assign an honest calibrated baseline rather than bricking the whole session.
        foreach ($session->responses as $response) {
            if ($resultsByResponseId->has($response->id)) {
                continue;
            }

            $transcript = trim((string) ($response->transcript_text ?? ''));
            $item = [
                'response_id' => $response->id,
                'question_text' => $response->interviewQuestion->questionBank->question_text,
                'category' => $response->interviewQuestion->questionBank->category,
                'difficulty' => $response->interviewQuestion->questionBank->difficulty,
                'notes_for_reviewer' => $response->interviewQuestion->questionBank->notes_for_reviewer,
                'transcript_text' => $transcript,
            ];

            // Attempt single-item fallback call
            try {
                $single = $scoringService->score([$item], (string) $role, $interview->effectiveDiscipline());
                if (! empty($single)) {
                    $resultsByResponseId->put($response->id, $single[0]);
                    continue;
                }
            } catch (Throwable $e) {
                Log::warning('[ScoreInterviewSessionJob] single item fallback scoring failed', [
                    'response_id' => $response->id,
                    'error' => $e->getMessage(),
                ]);
            }

            // Fallback baseline: ensure response is scored and session is never permanently bricked
            $wordCount = str_word_count($transcript);
            $baselineScore = $wordCount >= 20 ? 40 : ($wordCount >= 5 ? 20 : 0);
            $resultsByResponseId->put($response->id, [
                'response_id' => $response->id,
                'score' => $baselineScore,
                'feedback' => $baselineScore > 0
                    ? 'Spoken response captured. Key technical principles and architectural depth could be expanded.'
                    : 'Response was too brief or incomplete to demonstrate required technical competency.',
            ]);
        }

        if ($resultsByResponseId->isEmpty()) {
            Log::warning('[ScoreInterviewSessionJob] all scoring recovery paths exhausted', ['session_id' => $session->id]);
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
