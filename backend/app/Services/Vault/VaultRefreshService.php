<?php

namespace App\Services\Vault;

use App\Models\User;
use App\Models\VaultProfile;
use App\Services\ReadinessHistoryService;
use App\Services\ReadinessScoreService;
use Throwable;

/**
 * Scores students and moves their Vault state to match — the bridge between
 * ReadinessScoreService (which only measures) and VaultService (which only
 * decides what the measurement means). Used by the scheduled `readiness:refresh`,
 * by a student opening their own Vault page, and by the few events that change a
 * score on their own (a contest being finalised, an interview being scored).
 *
 * One bulk scoring pass per chunk, then one cheap decision per student: a student
 * with no Vault profile and a score nowhere near the bar costs no Vault writes at
 * all. The same pass also records each student's score for today (ReadinessHistoryService)
 * and nudges a student whose score is slipping.
 */
class VaultRefreshService
{
    public function __construct(
        private readonly ReadinessScoreService $readiness,
        private readonly VaultService $vault,
        private readonly ReadinessHistoryService $history,
    ) {}

    /**
     * @param  iterable<int, User>  $students
     * @return array{scored: int, errors: int}
     */
    public function refresh(iterable $students): array
    {
        $students = collect($students)->filter(fn ($s) => $s instanceof User && $s->exists && $s->isStudent())->values();
        $stats = ['scored' => 0, 'errors' => 0];

        foreach ($students->chunk((int) config('readiness.chunk', 250)) as $chunk) {
            $scores = $this->readiness->compute($chunk);
            $profiles = VaultProfile::whereIn('user_id', $chunk->pluck('id'))->get()->keyBy('user_id');

            foreach ($chunk as $student) {
                $result = $scores[$student->id];
                $student->primeReadiness($result['breakdown'], $result['practice_score']);
                $stats['scored']++;

                try {
                    $profile = $this->vault->applyReadiness($student, $result['breakdown'], $profiles[$student->id] ?? null);
                    $this->history->nudge($student, $result['breakdown'], (bool) $profile?->is_eligible);
                } catch (Throwable $e) {
                    // One student's failure must not stop the other 249.
                    report($e);
                    $stats['errors']++;
                }
            }

            // The day-by-day record. Its failure (a missing table the moment before `migrate`) must not undo the scoring above.
            try {
                $this->history->record(array_map(fn (array $r) => $r['breakdown'], $scores));
            } catch (Throwable $e) {
                report($e);
                $stats['errors']++;
            }
        }

        return $stats;
    }

    /**
     * For the places that fire this as a side effect of something else (a contest
     * being finalised, a test being submitted): the thing the person actually did
     * must never fail because the Vault could not be refreshed.
     *
     * @param  array<int, int>  $userIds
     */
    public function refreshQuietly(array $userIds): void
    {
        if ($userIds === []) {
            return;
        }

        try {
            $this->refresh(User::whereIn('id', array_unique($userIds))->where('role', User::ROLE_USER)->get());
        } catch (Throwable $e) {
            report($e);
        }
    }
}
