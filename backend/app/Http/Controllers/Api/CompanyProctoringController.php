<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ProctoringSession;
use App\Models\ProctoringViolation;
use App\Services\ProctoringService;
use Illuminate\Http\Request;

/**
 * Company-hiring-tenant review of proctoring activity across their own
 * assessments — mirrors TpoProctoringController's shape (index/show/
 * reinstate), but scoped by CONTEST ownership rather than the candidate's
 * college: see ProctoringService::flaggedSessionsForCompany()'s docblock for
 * why copying TpoProctoringController::authorizeCollege() verbatim here
 * would be a real authorization bug, not just a style mismatch.
 */
class CompanyProctoringController extends Controller
{
    public function __construct(private readonly ProctoringService $proctoring) {}

    public function index(Request $request)
    {
        $companyId = $request->user()->company_id;

        if (! $companyId) {
            return response()->json(['sessions' => []]);
        }

        $sessions = $this->proctoring->flaggedSessionsForCompany($companyId)->get();

        return response()->json(['sessions' => $sessions->map(fn (ProctoringSession $s) => $this->summary($s))]);
    }

    public function show(Request $request, ProctoringSession $proctoringSession)
    {
        $this->authorizeCompany($request, $proctoringSession);

        $violations = $proctoringSession->violations()
            ->with('contestProblem.problem:id,title')
            ->orderBy('occurred_at')
            ->get()
            ->map(fn (ProctoringViolation $v) => [
                'id' => $v->id,
                'type' => $v->type,
                'label' => ProctoringViolation::label($v->type),
                'counted_toward_lock' => $v->counted_toward_lock,
                'occurred_at' => $v->occurred_at,
                'problem' => $v->contestProblem?->problem?->title,
                'ip_address' => $v->ip_address,
            ]);

        return response()->json([
            'session' => $this->summary($proctoringSession),
            'violations' => $violations,
        ]);
    }

    public function reinstate(Request $request, ProctoringSession $proctoringSession)
    {
        $this->authorizeCompany($request, $proctoringSession);
        abort_unless($proctoringSession->isLocked(), 422, 'This session is not locked.');

        $this->proctoring->reinstate($proctoringSession, $request->user());

        return response()->json(['session' => $this->summary($proctoringSession->fresh())]);
    }

    private function authorizeCompany(Request $request, ProctoringSession $session): void
    {
        $session->loadMissing('contestParticipant.contest');
        abort_unless($session->contestParticipant->contest->owning_company_id === $request->user()->company_id, 404);
    }

    /**
     * Deliberately keyed `student` (not `candidate`) — this is the exact
     * shape TpoProctoringController::summary() emits, which lets the
     * frontend reuse `ProctoringSessionList`/`ProctoringSessionSummary`
     * completely unmodified (see that component's docblock: already shared
     * between the TPO and Section Coordinator views via `apiBasePath`).
     * `roll_number`/`section` are always null here — a candidate isn't a
     * student, but the component only ever conditionally renders them.
     */
    private function summary(ProctoringSession $s): array
    {
        $s->loadMissing('contestParticipant.user', 'contestParticipant.contest');

        return [
            'id' => $s->id,
            'status' => $s->status,
            'violation_count' => $s->violation_count,
            'locked_at' => $s->locked_at,
            'completed_at' => $s->completed_at,
            'consented_at' => $s->consented_at,
            'student' => [
                'id' => $s->contestParticipant->user->id,
                'name' => $s->contestParticipant->user->name,
                'email' => $s->contestParticipant->user->email,
                'roll_number' => null,
            ],
            'contest' => [
                'id' => $s->contestParticipant->contest->id,
                'title' => $s->contestParticipant->contest->title,
                'slug' => $s->contestParticipant->contest->slug,
            ],
        ];
    }
}
