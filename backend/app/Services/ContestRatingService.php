<?php

namespace App\Services;

use Illuminate\Support\Collection;

/**
 * A deliberately simplified Elo-style rating delta — not full Codeforces
 * Elo (which requires an iterative binary search for "expected rank"). This
 * is correct, bounded, and easy to verify:
 *
 *   expected_i = 1 / (1 + 10^((avgRating - R_i) / 400))   — logistic,
 *     centered on the field's average rating: a player exactly at the
 *     average is expected to land at the 50th percentile.
 *   actual_i   = (N - rank_i) / (N - 1)                    — 1.0 for 1st
 *     place, 0.0 for last, among N rated participants.
 *   delta_i    = round(K * (actual_i - expected_i))
 *
 * K damps early volatility the standard way: a newer competitor's rating
 * moves faster until they've built a track record.
 *
 * Ties MUST be fed a fractional mid-rank here (average of the tied block's
 * ordinal positions), never the integer *display* rank shown on the
 * leaderboard. Without this, a contest where everyone ties (e.g. an
 * all-zero-score round — a completely ordinary outcome for a hard problem
 * set) would give every participant rank 1, so actual_i = 1.0 for
 * everyone, and the whole field would gain rating simultaneously. With the
 * mid-rank fix, an all-tied field gets mid-rank (N+1)/2 for everyone →
 * actual_i = 0.5 → delta ≈ 0 when ratings are homogeneous, which is
 * correct and stable.
 *
 * Known, accepted simplification: unlike full pairwise Elo, this
 * field-average-centered formula is not exactly zero-sum when the field's
 * ratings are heterogeneous, and independently-rounded per-participant
 * deltas add a little further drift over many contests. Both are
 * acceptable tradeoffs for a correct, simple, launch-ready formula rather
 * than a research project under a hard deadline.
 */
class ContestRatingService
{
    public const K_NEW_PLAYER = 64;

    public const K_ESTABLISHED = 32;

    public const NEW_PLAYER_CONTEST_THRESHOLD = 5;

    /**
     * @param  Collection<int, array{participantId: int, ratingBefore: int, ratedContestsBefore: int, midRank: float}>  $ratedParticipants
     * @return array<int, int> participantId => rating delta
     */
    public function computeDeltas(float $avgRating, Collection $ratedParticipants): array
    {
        $n = $ratedParticipants->count();

        if ($n <= 1) {
            return $ratedParticipants->mapWithKeys(fn ($p) => [$p['participantId'] => 0])->all();
        }

        $deltas = [];

        foreach ($ratedParticipants as $p) {
            $expected = 1 / (1 + (10 ** (($avgRating - $p['ratingBefore']) / 400)));
            $actual = ($n - $p['midRank']) / ($n - 1);
            $k = $this->kFactor($p['ratedContestsBefore']);

            $deltas[$p['participantId']] = (int) round($k * ($actual - $expected));
        }

        return $deltas;
    }

    private function kFactor(int $ratedContestsBefore): int
    {
        return $ratedContestsBefore < self::NEW_PLAYER_CONTEST_THRESHOLD ? self::K_NEW_PLAYER : self::K_ESTABLISHED;
    }
}
