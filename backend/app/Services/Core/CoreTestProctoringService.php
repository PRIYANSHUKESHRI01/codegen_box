<?php

namespace App\Services\Core;

use App\Models\CoreTestProctoringSession;
use App\Models\CoreTestProctoringViolation;
use App\Models\CoreTestSession;
use App\Services\Integrity\StrikeMath;
use Illuminate\Support\Facades\DB;

/**
 * Server-side authority for Core test proctoring — the same shape as SoftSkillProctoringService: consent,
 * strike counting and the lock live here, in the database, and are re-checked on every answer, so a tampered
 * client cannot walk past them. A lock grades what was autosaved and ends the attempt, never as a pass.
 */
class CoreTestProctoringService
{
    public function __construct(private readonly CoreTestGradingService $grader) {}

    /**
     * Idempotent — resuming after a refresh reuses the session and its real strike count. On the FIRST consent the
     * attempt's clock is restarted (the seconds spent granting camera / fullscreen permission must not be taken
     * out of a timed test); guarded so it happens once and only before any answer is saved.
     */
    public function startOrResume(CoreTestSession $session, array $deviceInfo): CoreTestProctoringSession
    {
        return DB::transaction(function () use ($session, $deviceInfo) {
            $proctoring = CoreTestProctoringSession::firstOrCreate(
                ['core_test_session_id' => $session->id],
                ['status' => CoreTestProctoringSession::STATUS_ACTIVE, 'consented_at' => now(), 'device_info' => $deviceInfo, 'violation_count' => 0]
            );

            if ($proctoring->wasRecentlyCreated && ! $session->responses()->whereNotNull('answered_at')->exists()) {
                $session->loadMissing('test');
                $session->update(['started_at' => now(), 'deadline_at' => now()->addMinutes($session->test->duration_minutes)]);
            } elseif ($proctoring->consented_at === null) {
                $proctoring->update(['consented_at' => now(), 'device_info' => $deviceInfo]);
            }

            return $proctoring;
        });
    }

    /**
     * Logs one event and, when a strike pushes the count to the threshold, locks the session and ends the attempt.
     * Row-locked so two violations arriving together (leaving fullscreen routinely also fires a visibility change)
     * can never both slip past the check.
     *
     * @return array{session: CoreTestProctoringSession, locked: bool, already_locked: bool}
     */
    public function recordViolation(CoreTestProctoringSession $session, string $type, ?string $ip, array $meta, ?int $strikes = null): array
    {
        if ($session->isLocked()) {
            $this->log($session, $type, $ip, $meta, false);

            return ['session' => $session, 'locked' => true, 'already_locked' => true];
        }

        // A finished attempt has nothing left to protect: keep the event for the record, never strike it.
        if ($session->testSession->isCompleted()) {
            $this->log($session, $type, $ip, $meta, false);

            return ['session' => $session, 'locked' => false, 'already_locked' => false];
        }

        // `$strikes` is set only by the integrity layer; null = the original rule.
        $isStrike = $strikes === null ? CoreTestProctoringViolation::isStrikeType($type) : $strikes > 0;

        return DB::transaction(function () use ($session, $type, $ip, $meta, $isStrike, $strikes) {
            /** @var CoreTestProctoringSession $locked */
            $locked = CoreTestProctoringSession::whereKey($session->id)->lockForUpdate()->first();

            $this->log($locked, $type, $ip, $meta, $isStrike);

            if (! $isStrike || $locked->isLocked()) {
                return ['session' => $locked->fresh(), 'locked' => $locked->isLocked(), 'already_locked' => $locked->isLocked()];
            }

            $locked->increment('violation_count', StrikeMath::toAdd($strikes, (int) $locked->violation_count));
            $locked->refresh();

            $justLocked = false;
            if ($locked->violation_count >= (int) config('proctoring.max_violations_before_lock', 3)) {
                $locked->update(['status' => CoreTestProctoringSession::STATUS_LOCKED, 'locked_at' => now()]);
                $this->grader->finalize($locked->testSession, terminatedByProctoring: true);
                $justLocked = true;
            }

            return ['session' => $locked->fresh(), 'locked' => $justLocked, 'already_locked' => false];
        });
    }

    private function log(CoreTestProctoringSession $session, string $type, ?string $ip, array $meta, bool $counted): void
    {
        CoreTestProctoringViolation::create([
            'core_test_proctoring_session_id' => $session->id,
            'type' => $type,
            'counted_toward_lock' => $counted,
            'ip_address' => $ip,
            'meta' => $meta ?: null,
            'occurred_at' => now(),
        ]);
    }
}
