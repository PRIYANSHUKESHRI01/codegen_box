<?php

namespace App\Services;

use App\Models\Contest;
use App\Models\ContestParticipant;
use App\Models\User;
use Illuminate\Support\Collection;

/**
 * The report a contest's creator opens to see how it actually went —
 * previously nonexistent: the mock-contests list showed a bare
 * `participants_count` and nothing else, no rank, no score, no way to see
 * who solved what. Shared by TpoContestController and AdminContestController
 * the same way ContestScoringService already is; this class only reads.
 */
class ContestReportService
{
    /**
     * One row per registrant, ranked field intact (null for anyone in an
     * un-finalized contest — see ContestFinalizeService) plus enough of
     * their own identity for a report table (name, roll number, section) so
     * a TPO doesn't need a second lookup per row.
     */
    public function participants(Contest $contest): Collection
    {
        return ContestParticipant::where('contest_id', $contest->id)
            ->with('user:id,name,email,roll_number,branch,section')
            ->orderByRaw('rank IS NULL, rank ASC')
            ->get()
            ->map(fn (ContestParticipant $p) => [
                'participant_id' => $p->id,
                'user_id' => $p->user->id,
                'name' => $p->user->name,
                'email' => $p->user->email,
                'roll_number' => $p->user->roll_number,
                'branch' => $p->user->branch,
                'section' => $p->user->section,
                'registered_at' => $p->registered_at,
                'score' => $p->score,
                'penalty_minutes' => $p->penalty_minutes,
                'rank' => $p->rank,
                'rating_before' => $p->rating_before,
                'rating_after' => $p->rating_after,
            ])
            ->values();
    }

    /**
     * One participant's full per-problem submission trail for this contest
     * — every attempt, not just the accepted one, since a wrong attempt is
     * exactly what a penalty-minute review needs to see.
     *
     * `code` is deliberately NOT included here, unlike an earlier version of
     * this method — this is still a LIST (every attempt at once), and the
     * same reasoning that keeps `code` out of Submission::$hidden's default
     * serialization applies just as much to a contest participant's list:
     * shipping every attempt's full source before anyone has asked to see
     * any one of them is needless payload, multiplied by however many
     * submissions this participant made. The frontend fetches one
     * submission's code by id (GET .../contest-submissions/{id}) only when
     * a reviewer actually clicks to view it.
     */
    public function participantSubmissions(Contest $contest, User $student): Collection
    {
        return $contest->contestSubmissions()
            ->where('user_id', $student->id)
            ->with('contestProblem.problem:id,slug,title')
            ->orderBy('submitted_at')
            ->get()
            ->map(fn ($s) => [
                'id' => $s->id,
                'problem_title' => $s->contestProblem->problem->title,
                'problem_slug' => $s->contestProblem->problem->slug,
                'language' => $s->language,
                'status' => $s->status,
                'points_awarded' => $s->points_awarded,
                'submitted_at' => $s->submitted_at,
            ])
            ->values();
    }
}
