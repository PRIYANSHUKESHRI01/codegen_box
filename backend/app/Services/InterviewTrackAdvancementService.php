<?php

namespace App\Services;

use App\Models\Interview;
use App\Models\InterviewSession;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * The one place a track round's outcome gets decided — called by
 * AdminInterviewController/TpoInterviewController/CompanyInterviewController's
 * finalizeSession() once a reviewer has scored every response in a
 * completed session, so every caller stays in lockstep, same "one source of
 * truth" convention TalentPoolQualificationService/ContestFinalizeService
 * already establish for scoring decisions.
 *
 * Composite scoring is a category-weighted average, not a raw mean: each
 * response's InterviewQuestionBank.category is averaged first, then those
 * per-category averages are combined using the round Interview's own
 * SNAPSHOTTED category_weights (never the live InterviewRoleTemplate — see
 * that column's migration docblock). A weighted category with zero scored
 * responses in this session is excluded and the remaining weights
 * renormalized to 100 — a deliberate, conservative choice over silently
 * treating a missing category as 0.
 */
class InterviewTrackAdvancementService
{
    /**
     * `$reviewer` is null for a system/AI-triggered finalize (see
     * ScoreInterviewSessionJob) — `reviewed_by`/`invited_by` are left null in
     * that case; `ai_scored_at` on the session (set by the caller before
     * this runs) is the actual record of who/what decided it. A human
     * calling this via AdminInterviewController::finalizeSession() et al
     * still passes themselves, unchanged.
     *
     * @return array{finalized: bool, already_finalized?: bool, composite_score_percent?: float, threshold?: float, passed?: bool, advanced?: bool, partial_composite?: bool}
     */
    public function finalizeAndAdvance(InterviewSession $session, ?User $reviewer): array
    {
        // Blocks a duplicate at the SAME authority level: a retried/duplicate
        // AI call is blocked once ai_scored_at is set (so a retried job can
        // never double-invite the next round), and a repeated human call is
        // blocked once reviewed_at is set (so clicking Finalize twice is a
        // no-op). But a human's FIRST finalize is always let through even
        // when AI already scored it (reviewed_at still null) — that's the
        // deliberate override path, not a duplicate.
        $alreadyFinalizedAtThisLevel = $reviewer === null
            ? $session->ai_scored_at !== null
            : $session->reviewed_at !== null;

        if ($alreadyFinalizedAtThisLevel) {
            return ['finalized' => false, 'already_finalized' => true];
        }

        abort_unless($session->status === InterviewSession::STATUS_COMPLETED, 422, 'This session is not complete yet — it cannot be finalized until the candidate finishes the round.');

        $interview = $session->interview;
        abort_unless($interview->isTrackRound(), 422, 'Only a track-round interview can be finalized — a standalone interview is reviewed manually, never scored.');

        $responses = $session->responses()->with('interviewQuestion.questionBank:id,category')->get();
        $questionCount = $interview->interviewQuestions()->count();

        abort_if($questionCount === 0, 422, 'This round has no questions attached.');
        abort_unless($responses->count() === $questionCount, 422, 'Every question must have a response before finalizing.');
        abort_if($responses->contains(fn ($r) => ! $r->isScored()), 422, 'Score every response before finalizing.');

        ['percent' => $percent, 'partial' => $partial] = $this->computeWeightedComposite($responses, $interview->category_weights ?? []);

        $threshold = (float) $interview->qualifying_score_percent;
        $passed = $percent >= $threshold;
        $nextRound = $passed ? $interview->nextRound() : null;

        DB::transaction(function () use ($session, $reviewer, $percent, $passed, $nextRound) {
            // A system/AI finalize (reviewer null) sets ai_scored_at and
            // leaves reviewed_at/reviewed_by untouched. A human finalize
            // sets reviewed_at/reviewed_by and leaves ai_scored_at as
            // whatever it already was — preserving "AI first scored this at
            // X" as history even once a human has reviewed/overridden it.
            $session->update([
                'composite_score_percent' => $percent,
                'reviewed_at' => $reviewer ? now() : $session->reviewed_at,
                'reviewed_by' => $reviewer?->id,
                'ai_scored_at' => $reviewer === null ? now() : $session->ai_scored_at,
                'advanced' => $passed && $nextRound !== null,
            ]);

            if ($nextRound !== null) {
                InterviewSession::firstOrCreate(
                    ['interview_id' => $nextRound->id, 'user_id' => $session->user_id],
                    ['status' => InterviewSession::STATUS_INVITED, 'invited_at' => now(), 'invited_by' => $reviewer?->id, 'current_question_order' => 0]
                );
            }
        });

        return [
            'finalized' => true,
            'composite_score_percent' => $percent,
            'threshold' => $threshold,
            'passed' => $passed,
            'advanced' => $passed && $nextRound !== null,
            'partial_composite' => $partial,
        ];
    }

    /**
     * The standalone-interview counterpart to finalizeAndAdvance() — no
     * qualifying threshold, no pass/fail, no "next round" (a standalone
     * interview isn't part of a track), so there's nothing to advance.
     * Purely records the AI's composite score as informational feedback for
     * the candidate. category_weights is null for every standalone
     * interview, so computeWeightedComposite() falls into its plain-average
     * branch — reused as-is, not reimplemented.
     *
     * `$reviewer` null (system/AI) vs set (human override) follows the exact
     * same idempotency/history rules as finalizeAndAdvance() — see that
     * method's docblock.
     *
     * @return array{finalized: bool, already_finalized?: bool, composite_score_percent?: float}
     */
    public function finalizeStandaloneScoring(InterviewSession $session, ?User $reviewer = null): array
    {
        $alreadyFinalizedAtThisLevel = $reviewer === null
            ? $session->ai_scored_at !== null
            : $session->reviewed_at !== null;

        if ($alreadyFinalizedAtThisLevel) {
            return ['finalized' => false, 'already_finalized' => true];
        }

        abort_unless($session->status === InterviewSession::STATUS_COMPLETED, 422, 'This session is not complete yet.');

        $interview = $session->interview;
        abort_if($interview->isTrackRound(), 422, 'A track-round interview must go through finalizeAndAdvance(), not this.');

        $responses = $session->responses()->with('interviewQuestion.questionBank:id,category')->get();
        abort_if($responses->isEmpty(), 422, 'This session has no responses to score.');
        abort_if($responses->contains(fn ($r) => ! $r->isScored()), 422, 'Score every response before finalizing.');

        ['percent' => $percent] = $this->computeWeightedComposite($responses, $interview->category_weights ?? []);

        $session->update([
            'composite_score_percent' => $percent,
            'ai_scored_at' => $reviewer === null ? now() : $session->ai_scored_at,
            'reviewed_at' => $reviewer ? now() : $session->reviewed_at,
            'reviewed_by' => $reviewer?->id,
        ]);

        return ['finalized' => true, 'composite_score_percent' => $percent];
    }

    /**
     * @param  \Illuminate\Support\Collection<int, \App\Models\InterviewResponse>  $responses
     * @param  array<string, int|float>  $categoryWeights
     * @return array{percent: float, partial: bool}
     */
    public function computeWeightedComposite($responses, array $categoryWeights): array
    {
        if (empty($categoryWeights)) {
            $avg = $responses->avg('score') ?? 0;

            return ['percent' => round((float) $avg, 2), 'partial' => false];
        }

        $scoresByCategory = $responses->groupBy(fn ($r) => $r->interviewQuestion->questionBank->category);

        $presentWeight = 0;
        $weightedSum = 0;
        $partial = false;

        foreach ($categoryWeights as $category => $weight) {
            $categoryResponses = $scoresByCategory->get($category);

            if ($categoryResponses === null || $categoryResponses->isEmpty()) {
                $partial = true;

                continue;
            }

            $presentWeight += $weight;
            $weightedSum += $weight * $categoryResponses->avg('score');
        }

        if ($presentWeight <= 0) {
            return ['percent' => 0.0, 'partial' => true];
        }

        // Renormalize: if a weighted category had no responses, the
        // remaining categories' weights are scaled back up to sum to 100
        // rather than silently under-counting the composite.
        $percent = $weightedSum / $presentWeight;

        return ['percent' => round($percent, 2), 'partial' => $partial];
    }
}
