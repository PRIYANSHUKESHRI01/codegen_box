<?php

namespace App\Services;

use App\Jobs\SendProctoringViolationReport;
use App\Models\ActivityLog;
use App\Models\Contest;
use App\Models\ContestParticipant;
use App\Models\ContestSubmission;
use App\Models\ProctoringSession;
use Illuminate\Support\Facades\DB;

/**
 * Idempotent via Contest::finalized_at — safe to call twice, whether
 * triggered by the scheduled `contests:finalize` command or an admin's
 * manual override (this repo's own scheduler only fires with a real server
 * cron entry running `schedule:run`, which may not exist yet, so the manual
 * path matters for launch).
 *
 * Participants who registered but never submitted are excluded from N,
 * the average rating, and ranking entirely — a no-show is unrated for that
 * contest, not punished as if they finished last. See ContestRatingService
 * for why ties are fed a fractional mid-rank instead of the integer
 * display rank.
 */
class ContestFinalizeService
{
    public function __construct(
        private readonly ContestRatingService $ratingService,
        private readonly TalentPoolQualificationService $talentPoolService,
    ) {}

    public function finalize(Contest $contest): array
    {
        if ($contest->finalized_at !== null) {
            return ['already_finalized' => true];
        }

        $result = DB::transaction(function () use ($contest) {
            $participatedIds = ContestSubmission::where('contest_id', $contest->id)
                ->distinct()
                ->pluck('user_id')
                ->all();

            $ranked = $contest->participants()
                ->with('user')
                ->get()
                ->filter(fn (ContestParticipant $p) => in_array($p->user_id, $participatedIds, true))
                ->sortBy([
                    ['score', 'desc'],
                    ['penalty_minutes', 'asc'],
                ])
                ->values();

            $n = $ranked->count();
            [$displayRanks, $midRanks] = $this->assignRanks($ranked);

            foreach ($ranked as $p) {
                $p->update(['rank' => $displayRanks[$p->id]]);
            }

            if ($contest->is_rated && $n > 0) {
                $this->applyRatingDeltas($ranked, $midRanks);
            }

            $contest->update(['finalized_at' => now()]);

            if ($contest->createdBy !== null) {
                ActivityLog::record(
                    $contest->createdBy,
                    'Finalized a contest',
                    'Contest',
                    $contest->title,
                    ['participants_ranked' => $n, 'rated' => $contest->is_rated]
                );
            }

            return ['finalized' => true, 'participants_ranked' => $n];
        });

        // Dispatched AFTER the transaction commits, not inside it — a
        // sync-driver queue (local/tests) would otherwise run the report
        // job mid-transaction, before `finalized_at` and the flagged
        // sessions' final state are actually durable.
        $this->dispatchProctoringReports($contest);

        // Same "after commit" reasoning applies here — qualification reads
        // Contest::participants().score, which must already be durably
        // ranked/finalized before this runs.
        $this->talentPoolService->qualifyFromContest($contest);

        return $result;
    }

    /**
     * Every flagged (violation_count > 0) session for this contest that
     * DIDN'T already get an immediate report at lock time (see
     * ProctoringService::lock()) — i.e. a student who finished with 1-2
     * violations but was never locked out. Excluding already-locked
     * sessions here is what keeps this idempotent without a separate
     * "dispatched" flag: a locked session's report was already sent the
     * moment it was locked, so `status = locked` alone is enough to skip it.
     */
    private function dispatchProctoringReports(Contest $contest): void
    {
        $sessions = ProctoringSession::whereHas('contestParticipant', fn ($q) => $q->where('contest_id', $contest->id))
            ->where('violation_count', '>', 0)
            ->where('status', '!=', ProctoringSession::STATUS_LOCKED)
            ->whereNull('reported_at')
            ->get();

        foreach ($sessions as $session) {
            $session->update(['status' => ProctoringSession::STATUS_COMPLETED, 'completed_at' => now()]);
            SendProctoringViolationReport::dispatch($session->id);
        }
    }

    /**
     * Competition ranking (1, 1, 3 for a tied top pair) for display, plus a
     * fractional mid-rank per tied block (each tied participant's average
     * ordinal position) reserved for feeding the rating formula only.
     *
     * @return array{0: array<int,int>, 1: array<int,float>} [participantId => displayRank], [participantId => midRank]
     */
    private function assignRanks($ranked): array
    {
        $displayRanks = [];
        $midRanks = [];
        $position = 1;
        $n = $ranked->count();
        $i = 0;

        while ($i < $n) {
            $tieStart = $i;
            while (
                $i + 1 < $n
                && $ranked[$i + 1]->score === $ranked[$tieStart]->score
                && $ranked[$i + 1]->penalty_minutes === $ranked[$tieStart]->penalty_minutes
            ) {
                $i++;
            }
            $tieSize = $i - $tieStart + 1;
            $midRank = $position + ($tieSize - 1) / 2;

            for ($j = $tieStart; $j <= $i; $j++) {
                $displayRanks[$ranked[$j]->id] = $position;
                $midRanks[$ranked[$j]->id] = $midRank;
            }

            $position += $tieSize;
            $i++;
        }

        return [$displayRanks, $midRanks];
    }

    private function applyRatingDeltas($ranked, array $midRanks): void
    {
        $avgRating = $ranked->avg(fn (ContestParticipant $p) => $p->user->current_rating);

        $ratingInputs = $ranked->map(fn (ContestParticipant $p) => [
            'participantId' => $p->id,
            'ratingBefore' => $p->user->current_rating,
            'ratedContestsBefore' => $p->user->rated_contests_count,
            'midRank' => $midRanks[$p->id],
        ]);

        $deltas = $this->ratingService->computeDeltas($avgRating, $ratingInputs);

        foreach ($ranked as $p) {
            $delta = $deltas[$p->id] ?? 0;
            $newRating = max(0, $p->user->current_rating + $delta);

            $p->update([
                'rating_before' => $p->user->current_rating,
                'rating_after' => $newRating,
            ]);

            $p->user->forceFill([
                'current_rating' => $newRating,
                'rated_contests_count' => $p->user->rated_contests_count + 1,
            ])->save();
        }
    }
}
