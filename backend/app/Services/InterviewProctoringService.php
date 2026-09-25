<?php

namespace App\Services;

use App\Models\InterviewProctoringSession;
use App\Models\InterviewProctoringViolation;
use App\Models\InterviewQuestion;
use App\Models\InterviewSession;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * The server-side authority for AI interview proctoring — mirrors
 * ProctoringService (contest proctoring) exactly for consent/violation/
 * lock bookkeeping. The one deliberate difference: contest proctoring
 * auto-submits the student's current code as a real judged submission on
 * lock (there's a well-defined "current work" to save); an interview has no
 * equivalent — a spoken answer only becomes a real InterviewResponse once
 * the candidate has finished reviewing and explicitly submitted it (see
 * InterviewController::answer()), so there's nothing safe to fabricate a
 * submission from. Locking here only ever stops further interaction
 * (InterviewController::start()/answer() reject once locked) — it never
 * silently invents an answer on the candidate's behalf.
 */
class InterviewProctoringService
{
    /**
     * Idempotent — resuming after a refresh must reuse the existing session
     * and its real violation_count/status, never reset it.
     */
    public function startOrResume(InterviewSession $session, array $deviceInfo): InterviewProctoringSession
    {
        return DB::transaction(function () use ($session, $deviceInfo) {
            $proctoringSession = InterviewProctoringSession::firstOrCreate(
                ['interview_session_id' => $session->id],
                // Explicit violation_count=0 — Model::create() never
                // backfills DB-default columns onto the in-memory instance
                // (see InterviewController::start()'s identical note), so a
                // caller reading it right after creation would otherwise
                // see null.
                ['status' => InterviewProctoringSession::STATUS_ACTIVE, 'consented_at' => now(), 'device_info' => $deviceInfo, 'violation_count' => 0]
            );

            if (! $proctoringSession->wasRecentlyCreated && $proctoringSession->consented_at === null) {
                $proctoringSession->update(['consented_at' => now(), 'device_info' => $deviceInfo]);
            }

            return $proctoringSession;
        });
    }

    /**
     * Logs one event and, if it's a strike type that pushes the session's
     * count to the configured threshold, locks it. Row-locked so two
     * violations firing within milliseconds of each other can never both
     * slip past the threshold check.
     *
     * @return array{session: InterviewProctoringSession, locked: bool, already_locked: bool}
     */
    public function recordViolation(
        InterviewProctoringSession $session,
        string $type,
        ?InterviewQuestion $question,
        ?string $ip,
        array $meta,
    ): array {
        if ($session->isLocked()) {
            $this->logViolation($session, $type, $question, $ip, $meta, false);

            return ['session' => $session, 'locked' => true, 'already_locked' => true];
        }

        $isStrike = InterviewProctoringViolation::isStrikeType($type);

        return DB::transaction(function () use ($session, $type, $question, $ip, $meta, $isStrike) {
            /** @var InterviewProctoringSession $locked */
            $locked = InterviewProctoringSession::whereKey($session->id)->lockForUpdate()->first();

            $this->logViolation($locked, $type, $question, $ip, $meta, $isStrike);

            if (! $isStrike || $locked->isLocked()) {
                return ['session' => $locked->fresh(), 'locked' => $locked->isLocked(), 'already_locked' => $locked->isLocked()];
            }

            $locked->increment('violation_count');
            $locked->refresh();

            $threshold = (int) config('proctoring.max_violations_before_lock', 3);
            $justLocked = false;

            if ($locked->violation_count >= $threshold) {
                $locked->update(['status' => InterviewProctoringSession::STATUS_LOCKED, 'locked_at' => now()]);
                $justLocked = true;
            }

            return ['session' => $locked->fresh(), 'locked' => $justLocked, 'already_locked' => false];
        });
    }

    private function logViolation(
        InterviewProctoringSession $session,
        string $type,
        ?InterviewQuestion $question,
        ?string $ip,
        array $meta,
        bool $countedTowardLock,
    ): void {
        InterviewProctoringViolation::create([
            'interview_proctoring_session_id' => $session->id,
            'interview_question_id' => $question?->id,
            'type' => $type,
            'counted_toward_lock' => $countedTowardLock,
            'ip_address' => $ip,
            'meta' => $meta ?: null,
            'occurred_at' => now(),
        ]);
    }

    /** A TPO/hiring-partner overriding a false positive — see TpoInterviewController/CompanyInterviewController::reinstateProctoring(). */
    public function reinstate(InterviewProctoringSession $session, User $actor): void
    {
        $session->update(['status' => InterviewProctoringSession::STATUS_ACTIVE, 'locked_at' => null]);
    }
}
