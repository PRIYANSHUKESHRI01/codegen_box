<?php

namespace App\Services;

use App\Models\SoftSkillResponse;
use App\Models\SoftSkillSession;
use App\Services\Vault\VaultRefreshService;
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
        $justFinalized = false;

        $finalized = DB::transaction(function () use ($session, $terminatedByProctoring, &$justFinalized) {
            /** @var SoftSkillSession $locked */
            $locked = SoftSkillSession::whereKey($session->id)->lockForUpdate()->first();

            if ($locked->isCompleted()) {
                return $locked;
            }

            $justFinalized = true;

            $locked->loadMissing('assessment');
            $responses = $locked->responses()->with('assessmentQuestion.question')->get();

            $categoryTally = [];
            $correctCount = 0;
            $correctIds = [];
            $incorrectIds = [];

            foreach ($responses as $response) {
                $question = $response->assessmentQuestion->question;
                $isCorrect = $response->selected_index !== null && (int) $response->selected_index === (int) $question->correct_index;
                if ($isCorrect) {
                    $correctIds[] = $response->id;
                } else {
                    $incorrectIds[] = $response->id;
                }

                $categoryTally[$question->category] ??= ['correct' => 0, 'total' => 0];
                $categoryTally[$question->category]['total']++;
                if ($isCorrect) {
                    $categoryTally[$question->category]['correct']++;
                    $correctCount++;
                }
            }

            if ($correctIds !== []) {
                SoftSkillResponse::whereIn('id', $correctIds)->update(['is_correct' => true]);
            }
            if ($incorrectIds !== []) {
                SoftSkillResponse::whereIn('id', $incorrectIds)->update(['is_correct' => false]);
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

        // A finished test is part of the student's readiness (and so, maybe, of the
        // Vault) — re-score after the HTTP response flushes in web requests so submitting
        // feels instantaneous in production, while console/test runs still execute inline.
        if ($justFinalized) {
            $userId = (int) $finalized->user_id;
            if (app()->runningInConsole()) {
                app(VaultRefreshService::class)->refreshQuietly([$userId]);
            } else {
                $ran = false;
                app()->terminating(static function () use ($userId, &$ran) {
                    if ($ran) {
                        return;
                    }
                    $ran = true;
                    app(VaultRefreshService::class)->refreshQuietly([$userId]);
                });
            }
        }

        return $finalized;
    }
}
