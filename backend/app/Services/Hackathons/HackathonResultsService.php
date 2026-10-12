<?php

namespace App\Services\Hackathons;

use App\Models\Hackathon;
use App\Models\HackathonSubmission;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Judging: turning a host's per-criterion marks into a score, a rank and a prize.
 *
 * The host marks each criterion 0–10; the score is the weighted average scaled
 * to 0–100 using the criteria's weights. Ranks are strictly ordered — ties are
 * broken in favour of the team that submitted first, so every place maps to
 * exactly one team and a prize is never ambiguous. Disqualified and unsubmitted
 * projects are never ranked.
 *
 * Scores stay private to the host until publish() runs; publishing can be
 * repeated after a correction, which simply recomputes the ranks.
 */
class HackathonResultsService
{
    /**
     * @param  array<string, int|float|string>  $marks  criterion name => 0–10
     */
    public function weightedScore(Hackathon $hackathon, array $marks): float
    {
        $criteria = $hackathon->effectiveCriteria();
        $weighted = 0.0;
        $weightSum = 0.0;
        $errors = [];

        foreach ($criteria as $criterion) {
            $mark = $marks[$criterion['name']] ?? null;

            if ($mark === null || ! is_numeric($mark) || $mark < 0 || $mark > 10) {
                $errors['scores'][] = "Give “{$criterion['name']}” a mark between 0 and 10.";

                continue;
            }

            $weighted += ((float) $mark / 10) * (float) $criterion['weight'];
            $weightSum += (float) $criterion['weight'];
        }

        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }

        // Normalised, so a hackathon whose weights do not sum to exactly 100 still scores out of 100.
        return round($weighted * (100 / max($weightSum, 1)), 2);
    }

    /**
     * @param  array<string, int|float|string>  $marks
     */
    public function score(HackathonSubmission $submission, User $judge, array $marks, ?string $feedback): HackathonSubmission
    {
        $hackathon = $submission->hackathon;

        if (! $submission->isSubmitted()) {
            throw new HackathonRuleException('Only submitted projects can be scored.', 'not_submitted', 409);
        }

        if (! $hackathon->hasEnded()) {
            throw new HackathonRuleException('Judging opens once the submission deadline has passed.', 'judging_not_open', 409);
        }

        $final = $this->weightedScore($hackathon, $marks);

        $submission->update([
            'scores' => $this->cleanMarks($hackathon, $marks),
            'final_score' => $final,
            'feedback' => $feedback,
            'scored_by' => $judge->id,
            'scored_at' => now(),
        ]);

        return $submission->fresh();
    }

    public function disqualify(HackathonSubmission $submission, string $reason): HackathonSubmission
    {
        $submission->update([
            'is_disqualified' => true,
            'disqualified_reason' => $reason,
            'rank' => null,
            'award_label' => null,
        ]);

        return $submission->fresh();
    }

    public function reinstate(HackathonSubmission $submission): HackathonSubmission
    {
        $submission->update(['is_disqualified' => false, 'disqualified_reason' => null]);

        return $submission->fresh();
    }

    /** Submitted, in-contention projects the host has not scored yet. */
    public function unscoredCount(Hackathon $hackathon): int
    {
        return $hackathon->submissions()
            ->where('status', HackathonSubmission::STATUS_SUBMITTED)
            ->where('is_disqualified', false)
            ->whereNull('final_score')
            ->count();
    }

    /**
     * Rank every scored project, attach prizes, and release the results to students.
     *
     * @return array{ranked: int, disqualified: int}
     */
    public function publish(Hackathon $hackathon): array
    {
        return DB::transaction(function () use ($hackathon) {
            $hackathon = Hackathon::whereKey($hackathon->id)->lockForUpdate()->firstOrFail();

            if (! $hackathon->isPublished()) {
                throw new HackathonRuleException('Only a published hackathon can have results.', 'not_published', 409);
            }

            if (! $hackathon->hasEnded()) {
                throw new HackathonRuleException('Results can be published once the submission deadline has passed.', 'not_ended', 409);
            }

            $entries = $hackathon->submissions()->where('status', HackathonSubmission::STATUS_SUBMITTED)->get();

            $unscored = $entries->filter(fn (HackathonSubmission $s) => ! $s->is_disqualified && ! $s->isScored())->count();

            if ($unscored > 0) {
                throw new HackathonRuleException(
                    "Score or disqualify the remaining {$unscored} project".($unscored === 1 ? '' : 's').' before publishing results.',
                    'unscored_submissions'
                );
            }

            $ranked = $entries
                ->filter(fn (HackathonSubmission $s) => ! $s->is_disqualified && $s->isScored())
                ->sort(function (HackathonSubmission $a, HackathonSubmission $b) {
                    return [(float) $b->final_score, $a->submitted_at->getTimestamp(), $a->id]
                        <=> [(float) $a->final_score, $b->submitted_at->getTimestamp(), $b->id];
                })
                ->values();

            if ($ranked->isEmpty()) {
                throw new HackathonRuleException('There are no scored projects to rank yet.', 'nothing_to_rank');
            }

            // Start clean so a re-publish after a correction cannot leave a stale rank behind.
            $hackathon->submissions()->update(['rank' => null, 'award_label' => null]);

            foreach ($ranked as $index => $submission) {
                $place = $index + 1;

                $submission->update([
                    'rank' => $place,
                    'award_label' => $hackathon->prizeForPlace($place)['title'] ?? null,
                ]);
            }

            $hackathon->update(['results_published_at' => $hackathon->results_published_at ?? now()]);

            return [
                'ranked' => $ranked->count(),
                'disqualified' => $entries->where('is_disqualified', true)->count(),
            ];
        });
    }

    /**
     * Keep only marks for criteria that exist, as numbers — so a stray key in a request can never end up stored.
     *
     * @param  array<string, int|float|string>  $marks
     * @return array<string, float>
     */
    private function cleanMarks(Hackathon $hackathon, array $marks): array
    {
        $clean = [];

        foreach ($hackathon->effectiveCriteria() as $criterion) {
            $clean[$criterion['name']] = round((float) $marks[$criterion['name']], 1);
        }

        return $clean;
    }
}
