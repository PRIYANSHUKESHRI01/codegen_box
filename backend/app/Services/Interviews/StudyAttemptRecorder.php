<?php

namespace App\Services\Interviews;

use App\Models\InterviewResponse;
use App\Models\InterviewSession;
use App\Models\MockInterviewQuestion;
use App\Models\StudyAttempt;
use App\Services\Answers\AnswerMatch;
use Illuminate\Support\Facades\Log;

/**
 * Keeps a permanent record of every FINISHED sitting of a study set: its score, and a snapshot of what the student was asked, said and was
 * shown (see the study_attempts migration for why it is a table of its own).
 *
 * It is called from StudyFeedbackService::finalize() the moment a sitting is complete, and from the result endpoint for a sitting finished
 * before this existed. It is idempotent: a sitting (interview + completion time) is recorded once, however often this runs.
 */
class StudyAttemptRecorder
{
    /** A sitting open for more than this long was left in a tab, not sat: its duration is not shown. */
    private const MAX_PLAUSIBLE_SECONDS = 4 * 3600;

    public function __construct(private readonly StudyFeedbackService $study) {}

    /** Records the sitting, never letting a problem here reach the student (their result must show whatever happens). */
    public function recordQuietly(InterviewSession $session): ?StudyAttempt
    {
        try {
            return $this->record($session);
        } catch (\Throwable $e) {
            Log::warning('[StudyAttemptRecorder] could not record a finished sitting', ['session_id' => $session->id, 'error' => $e->getMessage()]);

            return null;
        }
    }

    public function record(InterviewSession $session): ?StudyAttempt
    {
        $interview = $session->interview;

        if ($interview === null || ! $interview->isStudyMode() || $session->status !== InterviewSession::STATUS_COMPLETED || $session->completed_at === null) {
            return null;
        }

        $existing = StudyAttempt::where('interview_id', $interview->id)->where('completed_at', $session->completed_at)->first();

        if ($existing !== null) {
            return $existing;
        }

        $responses = $session->responses()->with('interviewQuestion.questionBank')->get()
            ->filter(fn (InterviewResponse $r) => $r->interviewQuestion?->questionBank !== null)
            ->sortBy(fn (InterviewResponse $r) => $r->interviewQuestion->display_order)
            ->values();

        if ($responses->isEmpty()) {
            return null;
        }

        $topics = $this->topics($interview, $interview->interviewQuestions()->count());
        $results = [];
        $counts = ['green' => 0, 'yellow' => 0, 'red' => 0];

        foreach ($responses as $response) {
            $bank = $response->interviewQuestion->questionBank;
            $shown = $this->study->stored($response, $bank);
            $percent = (int) round((float) ($response->score ?? 0));
            $band = $shown['band'] ?? AnswerMatch::bandFor($percent);
            $counts[$band] = ($counts[$band] ?? 0) + 1;

            $results[] = [
                'question' => $bank->question_text,
                'image' => $bank->image,
                'topic' => $topics[$response->interviewQuestion->display_order] ?? null,
                'answer' => (string) $response->transcript_text,
                'model_answer' => $shown['reference_answer'] ?? (string) $bank->notes_for_reviewer,
                'percent' => $percent,
                'band' => $band,
                'missed' => $shown['missed'] ?? [],
                'unverified' => (bool) ($shown['unverified'] ?? $bank->reference_unverified),
            ];
        }

        $config = (array) $interview->practice_config;
        $setNumber = (int) ($config['set_number'] ?? 1);
        $score = (int) round((float) ($session->composite_score_percent ?? collect($results)->avg('percent')));
        $seconds = $session->started_at !== null ? (int) $session->started_at->diffInSeconds($session->completed_at, true) : null;

        return StudyAttempt::create([
            'user_id' => $session->user_id,
            'interview_id' => $interview->id,
            'stack_key' => (string) ($config['stack_key'] ?? ''),
            'exam_name' => (string) ($config['stack_name'] ?? 'Practice'),
            'round_id' => (string) ($config['mock_round_id'] ?? $config['set_id'] ?? ''),
            'set_number' => $setNumber,
            'set_title' => "Set {$setNumber}",
            'score' => max(0, min(100, $score)),
            'question_count' => (int) $interview->interviewQuestions()->count(),
            'answered_count' => count($results),
            'green_count' => $counts['green'],
            'yellow_count' => $counts['yellow'],
            'red_count' => $counts['red'],
            'duration_seconds' => $seconds !== null && $seconds > 0 && $seconds <= self::MAX_PLAUSIBLE_SECONDS ? $seconds : null,
            'completed_at' => $session->completed_at,
            'results' => $results,
        ]);
    }

    /**
     * The syllabus topic of each question, by display order, from the questions this sitting was drawn from (null where the bank has since lost
     * one, or the sitting predates the ids being kept). A topic is shown only in the report, after the sitting: for a ROR card it names the
     * kind of vessel, which is the answer.
     *
     * @return array<int, ?string>
     */
    private function topics($interview, int $questionCount): array
    {
        $ids = array_values((array) ($interview->practice_config['mock_question_ids'] ?? []));

        if ($ids === [] || count($ids) !== $questionCount) {
            return [];
        }

        $byId = MockInterviewQuestion::whereIn('id', $ids)->pluck('topic', 'id');

        return array_map(fn ($id) => $byId[$id] ?? null, $ids);
    }
}
