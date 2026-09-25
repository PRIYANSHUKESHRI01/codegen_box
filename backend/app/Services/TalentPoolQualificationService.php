<?php

namespace App\Services;

use App\Jobs\SendTalentPoolQualifiedEmail;
use App\Models\Contest;
use App\Models\ContestParticipant;
use App\Models\TalentPoolCandidate;

/**
 * Called by ContestFinalizeService::finalize() for a `talent_pool` contest —
 * the one place "did this candidate qualify" gets decided, so both the
 * manual (AdminContestController::finalize) and any future scheduled
 * finalize path stay in lockstep, same "one source of truth" convention
 * ContestFinalizeService's own docblock states for scoring/rating.
 *
 * A participant with no submissions (score never set) is excluded, matching
 * ContestFinalizeService's own "no-show is unrated, not punished" precedent.
 */
class TalentPoolQualificationService
{
    public function qualifyFromContest(Contest $contest): void
    {
        if (! $contest->isTalentPool()) {
            return;
        }

        $totalPoints = (int) $contest->contestProblems()->sum('points');

        if ($totalPoints <= 0) {
            return;
        }

        $threshold = (float) ($contest->qualifying_score_percent ?? 90);

        $participants = $contest->participants()->where('score', '>', 0)->get();

        foreach ($participants as $participant) {
            $this->qualifyParticipant($participant, $contest, $totalPoints, $threshold);
        }
    }

    private function qualifyParticipant(ContestParticipant $participant, Contest $contest, int $totalPoints, float $threshold): void
    {
        $percent = round($participant->score / $totalPoints * 100, 2);

        if ($percent < $threshold) {
            return;
        }

        $existing = TalentPoolCandidate::where('user_id', $participant->user_id)->first();

        // A worse retake (or a lower-scoring different assessment) never
        // overwrites an already-better standing — this is a "current best",
        // not a "most recent", record.
        if ($existing !== null && (float) $existing->score_percent >= $percent) {
            return;
        }

        // Once hired, or explicitly hidden by Mellow, re-qualifying through
        // a later assessment must never silently resurrect/re-expose the
        // candidate — only the candidate's own consent, or a fresh Mellow
        // override, can do that. A candidate who hid themselves keeps that
        // choice too; the score/source still refreshes underneath it so it's
        // accurate whenever they do opt back in.
        $preserveVisibility = $existing !== null && in_array($existing->visibility_status, [
            TalentPoolCandidate::STATUS_HIRED,
            TalentPoolCandidate::STATUS_HIDDEN_BY_MELLOW,
            TalentPoolCandidate::STATUS_HIDDEN_BY_CANDIDATE,
        ], true);

        $candidate = TalentPoolCandidate::updateOrCreate(
            ['user_id' => $participant->user_id],
            [
                'source_contest_id' => $contest->id,
                'score_percent' => $percent,
                'qualified_at' => now(),
                'visibility_status' => $preserveVisibility
                    ? $existing->visibility_status
                    : TalentPoolCandidate::STATUS_PENDING_CONSENT,
            ]
        );

        if (! $preserveVisibility && $candidate->wasRecentlyCreated) {
            SendTalentPoolQualifiedEmail::dispatch($participant->user_id, $contest->id, $percent);
        }
    }
}
