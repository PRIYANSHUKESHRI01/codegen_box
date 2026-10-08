<?php

namespace App\Services;

use App\Models\SoftSkillProctoringSession;
use App\Models\SoftSkillProctoringViolation;
use App\Models\SoftSkillSession;
use Illuminate\Support\Facades\DB;

/**
 * The server-side authority for Soft Skills proctoring — mirrors
 * InterviewProctoringService / ProctoringService for consent, violation and
 * lock bookkeeping. The client shows warnings and records video/audio
 * locally; this decides when an attempt is actually ended, durably (it lives
 * in the database and is re-checked on every answer/submit — see
 * SoftSkillController::assertNotLocked()).
 *
 * What a lock does here: contest proctoring auto-submits the student's open
 * code and locks them out; an interview can only stop further interaction.
 * A Soft Skills attempt sits in between — its "current work" is already on
 * the server (every selection autosaves), so the locking strike grades what
 * was saved and ends the attempt via SoftSkillGradingService, marked as
 * terminated by proctoring (never a pass). That also leaves no dangling
 * in-progress attempt that nobody could ever finish or reinstate.
 */
class SoftSkillProctoringService
{
    public function __construct(private readonly SoftSkillGradingService $grader) {}

    /**
     * Idempotent — resuming after a refresh must reuse the existing session
     * and its real violation_count/status, never reset it (that idempotency
     * is what stops "just reload the page" from erasing strikes).
     *
     * On the FIRST consent only, the attempt's clock is restarted: the
     * student pressed "Start" before the camera/fullscreen gate, and the
     * seconds spent granting permissions must not be taken out of a timed
     * test. Guarded so it can only ever happen once and only before any
     * answer has been saved — it can't be used to buy extra time mid-test.
     */
    public function startOrResume(SoftSkillSession $session, array $deviceInfo): SoftSkillProctoringSession
    {
        return DB::transaction(function () use ($session, $deviceInfo) {
            $proctoringSession = SoftSkillProctoringSession::firstOrCreate(
                ['soft_skill_session_id' => $session->id],
                // Explicit violation_count=0 — Model::create() never
                // backfills DB-default columns onto the in-memory instance,
                // so a caller reading it right after creation would
                // otherwise see null.
                ['status' => SoftSkillProctoringSession::STATUS_ACTIVE, 'consented_at' => now(), 'device_info' => $deviceInfo, 'violation_count' => 0]
            );

            if ($proctoringSession->wasRecentlyCreated) {
                $hasAnswers = $session->responses()->whereNotNull('answered_at')->exists();
                if (! $hasAnswers) {
                    $session->update(['started_at' => now()]);
                }
            } elseif ($proctoringSession->consented_at === null) {
                $proctoringSession->update(['consented_at' => now(), 'device_info' => $deviceInfo]);
            }

            return $proctoringSession;
        });
    }

    /**
     * Logs one event and, if it's a strike type that pushes the session's
     * count to the configured threshold, locks it and ends the attempt.
     * Row-locked so two violations firing within milliseconds of each other
     * (exiting fullscreen routinely fires alongside a visibility change) can
     * never both slip past the threshold check.
     *
     * @return array{session: SoftSkillProctoringSession, locked: bool, already_locked: bool}
     */
    public function recordViolation(SoftSkillProctoringSession $session, string $type, ?string $ip, array $meta): array
    {
        if ($session->isLocked()) {
            $this->logViolation($session, $type, $ip, $meta, false);

            return ['session' => $session, 'locked' => true, 'already_locked' => true];
        }

        // An attempt that was already submitted normally has nothing left to
        // protect — a stray event arriving after the fact (e.g. a late
        // fullscreen change while the page navigates to the result) is kept
        // for the record but must never lock or strike a finished attempt.
        if ($session->softSkillSession->isCompleted()) {
            $this->logViolation($session, $type, $ip, $meta, false);

            return ['session' => $session, 'locked' => false, 'already_locked' => false];
        }

        $isStrike = SoftSkillProctoringViolation::isStrikeType($type);

        return DB::transaction(function () use ($session, $type, $ip, $meta, $isStrike) {
            /** @var SoftSkillProctoringSession $locked */
            $locked = SoftSkillProctoringSession::whereKey($session->id)->lockForUpdate()->first();

            $this->logViolation($locked, $type, $ip, $meta, $isStrike);

            if (! $isStrike || $locked->isLocked()) {
                return ['session' => $locked->fresh(), 'locked' => $locked->isLocked(), 'already_locked' => $locked->isLocked()];
            }

            $locked->increment('violation_count');
            $locked->refresh();

            $threshold = (int) config('proctoring.max_violations_before_lock', 3);
            $justLocked = false;

            if ($locked->violation_count >= $threshold) {
                $locked->update(['status' => SoftSkillProctoringSession::STATUS_LOCKED, 'locked_at' => now()]);
                $this->grader->finalize($locked->softSkillSession, terminatedByProctoring: true);
                $justLocked = true;
            }

            return ['session' => $locked->fresh(), 'locked' => $justLocked, 'already_locked' => false];
        });
    }

    private function logViolation(SoftSkillProctoringSession $session, string $type, ?string $ip, array $meta, bool $countedTowardLock): void
    {
        SoftSkillProctoringViolation::create([
            'soft_skill_proctoring_session_id' => $session->id,
            'type' => $type,
            'counted_toward_lock' => $countedTowardLock,
            'ip_address' => $ip,
            'meta' => $meta ?: null,
            'occurred_at' => now(),
        ]);
    }
}
