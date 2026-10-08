<?php

namespace App\Services;

use App\Models\SoftSkillSession;
use Illuminate\Support\Facades\DB;

/**
 * The one place a Soft Skills attempt gets graded and finalized — exact
 * selected_index === correct_index matching against the question bank,
 * never trusted or precomputed from the client. Extracted verbatim from
 * SoftSkillController::submit() so the two ways an attempt can end (the
 * student submitting, or proctoring ending it — see
 * SoftSkillProctoringService) share one implementation and can never
 * disagree about how a score is computed.
 */
class SoftSkillGradingService
{
    /**
     * Idempotent: finalizing an already-completed attempt is a no-op that
     * returns it unchanged, so a student's submit racing a proctoring lock
     * (or a double-click) can never grade twice or flip a result.
     *
     * `$terminatedByProctoring` attempts still get a real score (shown for
     * transparency, built from whatever had been autosaved) but can never be
     * marked passed — an attempt ended for cheating signals must not count
     * as a pass.
     */
    public function finalize(SoftSkillSession $session, bool $terminatedByProctoring = false): SoftSkillSession
    {
        return DB::transaction(function () use ($session, $terminatedByProctoring) {
            /** @var SoftSkillSession $locked */
            $locked = SoftSkillSession::whereKey($session->id)->lockForUpdate()->first();

            if ($locked->isCompleted()) {
                return $locked;
            }

            $locked->loadMissing('assessment');
            $responses = $locked->responses()->with('assessmentQuestion.question')->get();

            $categoryTally = [];
            $correctCount = 0;

            foreach ($responses as $response) {
                $question = $response->assessmentQuestion->question;
                $isCorrect = $response->selected_index !== null && (int) $response->selected_index === (int) $question->correct_index;
                $response->update(['is_correct' => $isCorrect]);

                $categoryTally[$question->category] ??= ['correct' => 0, 'total' => 0];
                $categoryTally[$question->category]['total']++;
                if ($isCorrect) {
                    $categoryTally[$question->category]['correct']++;
                    $correctCount++;
                }
            }

            $totalQuestions = $responses->count();
            $scorePercent = $totalQuestions > 0 ? round(($correctCount / $totalQuestions) * 100, 2) : 0;

            $locked->update([
                'status' => SoftSkillSession::STATUS_COMPLETED,
                'completed_at' => now(),
                'score_percent' => $scorePercent,
                'passed' => ! $terminatedByProctoring && $scorePercent >= $locked->assessment->pass_percentage,
                'category_breakdown' => $categoryTally,
            ]);

            return $locked->fresh();
        });
    }
}
