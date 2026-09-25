<?php

namespace App\Services;

use App\Models\ContestParticipant;
use App\Models\ContestSubmission;

/**
 * Recomputes a participant's live score/penalty from their full
 * contest_submissions history — never increments. That makes it idempotent
 * under retries (a double-submit network retry can't double-count) and
 * removes any need to reason about "undoing" a previous increment. The
 * aggregate is small (a handful of problems x a few attempts each), so
 * recomputing from scratch on every submit is not a real performance
 * concern.
 *
 * Callers MUST already hold a row lock on $participant (SELECT ... FOR
 * UPDATE, inside a transaction) before calling this — see
 * ContestSubmissionController::submit(). That serializes only one user's
 * own concurrent submissions against themselves; submissions from
 * different users in the same contest never contend with each other.
 */
class ContestScoringService
{
    /** Classic ICPC-style penalty: 10 minutes per wrong attempt before the accepted one. */
    public const PENALTY_MINUTES_PER_WRONG_ATTEMPT = 10;

    public function recompute(ContestParticipant $participant): void
    {
        $submissions = ContestSubmission::where('contest_id', $participant->contest_id)
            ->where('user_id', $participant->user_id)
            ->with('contestProblem')
            ->orderBy('submitted_at')
            ->get()
            ->groupBy('contest_problem_id');

        $totalScore = 0;
        $totalPenalty = 0;
        $contestStart = $participant->contest->start_at;

        foreach ($submissions as $attempts) {
            $accepted = $attempts->firstWhere('status', ContestSubmission::STATUS_ACCEPTED);

            // Never solved: contributes zero penalty, regardless of how
            // many wrong attempts were made — standard ICPC rule.
            if ($accepted === null) {
                continue;
            }

            $wrongBeforeAccepted = $attempts
                ->filter(fn (ContestSubmission $s) => $s->submitted_at->lt($accepted->submitted_at))
                ->count();

            $totalScore += $accepted->contestProblem->points;
            $totalPenalty += $contestStart->diffInMinutes($accepted->submitted_at)
                + ($wrongBeforeAccepted * self::PENALTY_MINUTES_PER_WRONG_ATTEMPT);
        }

        $participant->update(['score' => $totalScore, 'penalty_minutes' => $totalPenalty]);
    }
}
