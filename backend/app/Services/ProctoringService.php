<?php

namespace App\Services;

use App\Jobs\SendProctoringViolationReport;
use App\Models\ContestParticipant;
use App\Models\ContestProblem;
use App\Models\ProctoringSession;
use App\Models\ProctoringViolation;
use App\Models\User;
use App\Services\Judge\JudgeQueue;
use App\Services\Judge\JudgeRequest;
use Illuminate\Support\Facades\DB;

/**
 * The server-side authority for contest proctoring — the client shows
 * warnings and records video/audio locally, but this service is what
 * actually decides when a student is locked out, and that decision is
 * durable (survives a page refresh, a killed tab, or a tampered client)
 * because it lives in the database, checked again on every single
 * run/submit/show call (see ContestSubmissionController::assertRegistered()).
 */
class ProctoringService
{
    public function __construct(private readonly JudgeQueue $judgeQueue) {}

    /**
     * Idempotent — a page refresh mid-contest must resume the existing
     * session (and its real violation_count/status), never reset it. That
     * idempotency is the whole point: it's what stops "just reload the
     * page" from being a way to erase strikes.
     */
    public function startOrResume(ContestParticipant $participant, array $deviceInfo): ProctoringSession
    {
        return DB::transaction(function () use ($participant, $deviceInfo) {
            $session = ProctoringSession::firstOrCreate(
                ['contest_participant_id' => $participant->id],
                // `violation_count` explicit rather than relying on the DB
                // column default (0) — Eloquent's in-memory model after
                // create() only reflects attributes it actually set, so a
                // caller reading $session->violation_count right after
                // creation would otherwise see null, not 0, until the next
                // fetch.
                ['status' => ProctoringSession::STATUS_ACTIVE, 'consented_at' => now(), 'device_info' => $deviceInfo, 'violation_count' => 0]
            );

            if (! $session->wasRecentlyCreated && $session->consented_at === null) {
                $session->update(['consented_at' => now(), 'device_info' => $deviceInfo]);
            }

            return $session;
        });
    }

    /**
     * Logs one event and, if it's a strike type (ProctoringViolation::
     * STRIKE_TYPES) that pushes the session's count to the configured
     * threshold, locks the session. Row-locked (`lockForUpdate`) so two
     * violations firing within milliseconds of each other (a real
     * possibility — exiting fullscreen often fires alongside a visibility
     * change) can never both slip past the threshold check and leave the
     * student unlocked despite having 4+ strikes on record.
     *
     * @return array{session: ProctoringSession, locked: bool, already_locked: bool}
     */
    public function recordViolation(
        ProctoringSession $session,
        string $type,
        ?ContestProblem $contestProblem,
        ?string $ip,
        array $meta,
        ?string $currentCode,
        ?string $language,
    ): array {
        if ($session->isLocked()) {
            $this->logViolation($session, $type, $contestProblem, $ip, $meta, false);

            return ['session' => $session, 'locked' => true, 'already_locked' => true];
        }

        $isStrike = ProctoringViolation::isStrikeType($type);

        return DB::transaction(function () use ($session, $type, $contestProblem, $ip, $meta, $isStrike, $currentCode, $language) {
            /** @var ProctoringSession $locked */
            $locked = ProctoringSession::whereKey($session->id)->lockForUpdate()->first();

            $this->logViolation($locked, $type, $contestProblem, $ip, $meta, $isStrike);

            if (! $isStrike || $locked->isLocked()) {
                return ['session' => $locked->fresh(), 'locked' => $locked->isLocked(), 'already_locked' => $locked->isLocked()];
            }

            $locked->increment('violation_count');
            $locked->refresh();

            $threshold = (int) config('proctoring.max_violations_before_lock', 3);
            $justLocked = false;

            if ($locked->violation_count >= $threshold) {
                $this->lock($locked, $contestProblem, $currentCode, $language);
                $justLocked = true;
            }

            return ['session' => $locked->fresh(), 'locked' => $justLocked, 'already_locked' => false];
        });
    }

    private function logViolation(
        ProctoringSession $session,
        string $type,
        ?ContestProblem $contestProblem,
        ?string $ip,
        array $meta,
        bool $countedTowardLock,
    ): void {
        ProctoringViolation::create([
            'proctoring_session_id' => $session->id,
            'contest_problem_id' => $contestProblem?->id,
            'type' => $type,
            'counted_toward_lock' => $countedTowardLock,
            'ip_address' => $ip,
            'meta' => $meta ?: null,
            'occurred_at' => now(),
        ]);
    }

    /**
     * Best-effort final submit of whatever the student had open, then a
     * hard lock. The lock ALWAYS takes effect even if the judge queue
     * rejects the submit (JudgeQueue::enqueue() never throws — it degrades
     * to a 429/503-shaped response instead — so there's nothing to catch
     * here, just nothing worth acting on if it didn't queue).
     */
    private function lock(ProctoringSession $session, ?ContestProblem $contestProblem, ?string $currentCode, ?string $language): void
    {
        $session->update(['status' => ProctoringSession::STATUS_LOCKED, 'locked_at' => now()]);

        if (config('proctoring.auto_submit_on_lock', true) && $contestProblem && $currentCode && $language) {
            $participant = $session->contestParticipant;

            $this->judgeQueue->enqueue(
                JudgeRequest::contest(
                    JudgeRequest::KIND_SUBMIT,
                    true,
                    $participant->user_id,
                    $contestProblem->problem_id,
                    $participant->contest_id,
                    $contestProblem->id,
                    $language,
                    $currentCode,
                ),
                $contestProblem->problem
            );
        }

        SendProctoringViolationReport::dispatch($session->id);
    }

    /** A TPO/Section Coordinator overriding a false positive — see TpoProctoringController/CoordinatorProctoringController::reinstate(). */
    public function reinstate(ProctoringSession $session, User $actor): void
    {
        $session->update(['status' => ProctoringSession::STATUS_ACTIVE, 'locked_at' => null]);
    }

    /**
     * Every flagged (violation_count > 0) session for a college, optionally
     * narrowed to one section — shared by TpoProctoringController (whole
     * college) and CoordinatorProctoringController (their own section only),
     * so the two staff views can never drift on what "flagged" means.
     */
    public function flaggedSessionsForCollege(int $collegeId, ?string $section = null)
    {
        return ProctoringSession::query()
            ->whereHas('contestParticipant.user', function ($q) use ($collegeId, $section) {
                $q->where('college_id', $collegeId);
                if ($section !== null) {
                    $q->where('section', $section);
                }
            })
            ->where('violation_count', '>', 0)
            ->with([
                'contestParticipant.user:id,name,email,section,roll_number',
                'contestParticipant.contest:id,title,slug',
            ])
            ->latest('updated_at');
    }

    /**
     * Every flagged session for a company's own assessments — used by
     * CompanyProctoringController. Deliberately scoped by CONTEST ownership
     * (owning_company_id), not by the candidate's own college_id the way
     * flaggedSessionsForCollege() above is: a candidate's college has
     * nothing to do with which company is running the assessment (they may
     * have no college at all), so reusing that college-scoped query here
     * would be a real authorization bug, not just a style mismatch.
     */
    public function flaggedSessionsForCompany(int $companyId)
    {
        return ProctoringSession::query()
            ->whereHas('contestParticipant.contest', function ($q) use ($companyId) {
                $q->where('owning_company_id', $companyId);
            })
            ->where('violation_count', '>', 0)
            ->with([
                'contestParticipant.user:id,name,email,phone',
                'contestParticipant.contest:id,title,slug',
            ])
            ->latest('updated_at');
    }
}
