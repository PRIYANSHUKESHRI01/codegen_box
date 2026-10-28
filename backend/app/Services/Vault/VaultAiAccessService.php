<?php

namespace App\Services\Vault;

use App\Models\User;
use App\Services\ScoreLedger;
use App\Support\AcademicYear;
use Carbon\CarbonInterface;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Who may take the Vault AI Interview, and when - the ONE place that rule lives (config/vault_ai.php holds the numbers).
 *
 *   direct AptRun user (no college)  -> open, always
 *   college student                  -> open once BOTH (a) they have been signed in for the days their year asks for (4th year 45,
 *                                       3rd year 90, counted from their first sign-in) and (b) their readiness score is at least
 *                                       the Vault line (60). The first time both hold, the unlock is written down and kept.
 *   1st / 2nd year                   -> not offered
 *   year not set by the college      -> locked until the TPO says which year they are in
 *
 * The readiness score itself is only READ here (User::readinessScore); nothing about how it is computed or how the Vault uses it
 * is touched - this interview sits on top of it.
 */
class VaultAiAccessService
{
    public const STATE_OPEN = 'open';

    public const STATE_LOCKED = 'locked';

    public const STATE_UNAVAILABLE = 'unavailable';

    public const AUDIENCE_DIRECT = 'direct';

    public const AUDIENCE_COLLEGE = 'college';

    /** Why a college student is still locked (or not offered), in the words the screens switch on. */
    public const REASON_YEAR_NOT_SET = 'year_not_set';

    public const REASON_YEAR_NOT_OFFERED = 'year_not_offered';

    public const REASON_WAITING_PERIOD = 'waiting_period';

    public const REASON_READINESS = 'readiness';

    /**
     * Where this student stands, for the dashboard card, the sidebar and the page itself.
     *
     * `$fresh` skips the short readiness cache - used when the answer decides whether an interview may actually START.
     * `$persist` lets a first unlock be written down; a superadmin's read-only "view as" passes false so looking never changes anything.
     *
     * @return array<string, mixed>
     */
    public function forUser(User $user, bool $fresh = false, bool $persist = true): array
    {
        // Their best Vault AI Interview series average so far (kept on the student), for the card and the page to show.
        $best = ['vault_ai_score' => $user->vault_ai_score];

        if (! $user->isCollegeStudent()) {
            return $this->evaluate(false, null, null, null, null) + $best;
        }

        $studyYear = $user->study_year;
        $latched = $user->vault_ai_unlocked_at;

        // Readiness is worked out only when it can still change the answer: not once the unlock is kept, and not for a year that
        // is not offered or not known.
        $needsReadiness = $latched === null && $this->unlockDaysFor($studyYear) !== null;
        $readiness = $needsReadiness ? $this->readinessOf($user, $fresh) : null;

        $result = $this->evaluate(true, $studyYear, $user->first_login_at, $readiness, $latched) + $best;

        if ($persist && $result['state'] === self::STATE_OPEN && $latched === null) {
            $this->keepUnlock($user);
        }

        return $result;
    }

    /**
     * The rule as pure data - the same function the TPO's cohort rows use (they already hold the readiness score), so the student
     * and their TPO can never be told two different things.
     *
     * @return array<string, mixed>
     */
    public function evaluate(
        bool $isCollegeStudent,
        ?int $studyYear,
        ?CarbonInterface $firstLoginAt,
        ?int $readiness,
        ?CarbonInterface $unlockedAt,
        ?CarbonInterface $now = null,
    ): array {
        $now ??= now();
        $minReadiness = (int) config('vault_ai.min_readiness', 60);

        $base = [
            'state' => self::STATE_OPEN,
            'audience' => $isCollegeStudent ? self::AUDIENCE_COLLEGE : self::AUDIENCE_DIRECT,
            'study_year' => $studyYear,
            'year_label' => AcademicYear::label($studyYear),
            'reasons' => [],
            'required_days' => null,
            'first_login_at' => $firstLoginAt?->toIso8601String(),
            'unlocks_at' => null,
            'days_remaining' => null,
            'waiting_period_met' => null,
            'readiness' => null,
        ];

        // A direct AptRun user has no college to wait on: it is simply theirs.
        if (! $isCollegeStudent) {
            return $base;
        }

        $days = $this->unlockDaysFor($studyYear);

        if ($studyYear === null) {
            return [...$base, 'state' => self::STATE_LOCKED, 'reasons' => [self::REASON_YEAR_NOT_SET]];
        }

        if ($days === null) {
            return [...$base, 'state' => self::STATE_UNAVAILABLE, 'reasons' => [self::REASON_YEAR_NOT_OFFERED]];
        }

        $base['required_days'] = $days;

        // Kept once earned: readiness decays daily and must never lock someone out of a series they are in the middle of.
        if ($unlockedAt !== null) {
            return [...$base, 'waiting_period_met' => true];
        }

        // The wait counts from the first sign-in. With none on file the clock has not started, so the whole wait is still ahead.
        $unlocksAt = $firstLoginAt?->copy()->addDays($days);
        $secondsLeft = $unlocksAt === null ? $days * 86400 : (int) $now->diffInSeconds($unlocksAt, false);
        $waitingMet = $unlocksAt !== null && $secondsLeft <= 0;
        $readinessMet = $readiness !== null && $readiness >= $minReadiness;

        $reasons = array_values(array_filter([
            $waitingMet ? null : self::REASON_WAITING_PERIOD,
            $readinessMet ? null : self::REASON_READINESS,
        ]));

        return [
            ...$base,
            'state' => $reasons === [] ? self::STATE_OPEN : self::STATE_LOCKED,
            'reasons' => $reasons,
            'unlocks_at' => $unlocksAt?->toIso8601String(),
            // Whole days still to go, counting a started day as a day: 45 on the first day, 44 on the next ... 0 once it is over.
            'days_remaining' => $waitingMet ? 0 : (int) ceil($secondsLeft / 86400),
            'waiting_period_met' => $waitingMet,
            'readiness' => [
                'score' => $readiness,
                'required' => $minReadiness,
                'met' => $readinessMet,
                'points_needed' => $readiness === null ? $minReadiness : max(0, $minReadiness - $readiness),
            ],
        ];
    }

    /** Days a student of this year must have been signed in; null = the year is not offered the interview. */
    public function unlockDaysFor(?int $studyYear): ?int
    {
        if ($studyYear === null) {
            return null;
        }

        // A batch that has passed out is held to the final year's rule, not locked out of the interview for having finished.
        $year = min($studyYear, AcademicYear::programmeYears());
        $days = config("vault_ai.unlock_days.{$year}");

        return $days === null ? null : (int) $days;
    }

    public function isOpen(User $user, bool $fresh = true): bool
    {
        return $this->forUser($user, $fresh)['state'] === self::STATE_OPEN;
    }

    private function readinessOf(User $user, bool $fresh): ?int
    {
        $key = "vault-ai-access:readiness:{$user->id}";

        if ($fresh) {
            Cache::forget($key);
        }

        try {
            return (int) Cache::remember($key, (int) config('vault_ai.readiness_cache_seconds', 120), function () use ($user) {
                $score = $user->readinessScore();
                app(ScoreLedger::class)->readiness($user->id, $score);

                return $score;
            });
        } catch (\Throwable $e) {
            // A score that cannot be worked out right now must not break the page: the student is simply told readiness is short.
            report($e);

            return null;
        }
    }

    /** Writes the unlock down. A raw update: bookkeeping, not an edit, so it neither bumps updated_at nor runs the user's save hooks. */
    private function keepUnlock(User $user): void
    {
        // A superadmin looking at the account ("view as") is not the student: looking must never change their record.
        if ($user->isBeingImpersonated()) {
            return;
        }

        $now = now();

        try {
            DB::table('users')->where('id', $user->id)->whereNull('vault_ai_unlocked_at')->update(['vault_ai_unlocked_at' => $now]);
        } catch (QueryException $e) {
            // Code reaching a database before the migration that adds the column: the unlock is simply re-derived next time.
            if (Cache::add('vault-ai-unlock-write-failed', true, 3600)) {
                Log::warning('Could not keep users.vault_ai_unlocked_at: '.$e->getMessage());
            }

            return;
        }

        $user->setAttribute('vault_ai_unlocked_at', $now);
        $user->syncOriginalAttribute('vault_ai_unlocked_at');
    }
}
