<?php

namespace App\Services;

use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Remembers a student's two headline scores on the student (users.readiness_score, users.vault_ai_score) so a roster can be
 * filtered, sorted and exported by score with an indexed column.
 *
 * Bookkeeping, not an edit: raw updates that skip the user's save hooks and leave updated_at alone, that write only when the
 * value actually moved (a roster refreshed every day costs nothing for students whose score did not change), and that can
 * never stand between a student and what they were doing - a missing column (code deployed before `migrate`) is logged and skipped.
 */
class ScoreLedger
{
    /** The student's readiness score, as last worked out. */
    public function readiness(int $userId, int $score): void
    {
        $score = max(0, min(100, $score));

        $this->write(fn () => DB::table('users')
            ->where('id', $userId)
            ->where(fn ($q) => $q->whereNull('readiness_score')->orWhere('readiness_score', '!=', $score))
            ->update(['readiness_score' => $score, 'readiness_scored_at' => now()]));
    }

    /**
     * A completed Vault AI Interview series' average. The stored value is the BEST one so far: a student who improves on a
     * later series moves up, one who does worse keeps the score they have earned.
     */
    public function vaultAi(int $userId, float $seriesAverage): void
    {
        $average = round(max(0, min(100, $seriesAverage)), 2);

        $this->write(fn () => DB::table('users')
            ->where('id', $userId)
            ->where(fn ($q) => $q->whereNull('vault_ai_score')->orWhere('vault_ai_score', '<', $average))
            ->update(['vault_ai_score' => $average, 'vault_ai_scored_at' => now()]));
    }

    private function write(callable $update): void
    {
        try {
            $update();
        } catch (QueryException $e) {
            if (Cache::add('score-ledger-write-failed', true, 3600)) {
                Log::warning('Could not store a score on users: '.$e->getMessage());
            }
        }
    }
}
