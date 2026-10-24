<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ProctoringSession;
use App\Models\ProctoringViolation;
use App\Services\ProctoringService;
use App\Services\SectionCoordinatorService;
use Illuminate\Http\Request;

/**
 * Section-Coordinator-only review of proctoring activity — scoped to
 * exactly their own section, same "never see another section's/college's
 * data" posture as CoordinatorStudentController. See TpoProctoringController
 * for the college-wide equivalent; both share ProctoringService's query so
 * "flagged" can never mean something different between the two views.
 */
class CoordinatorProctoringController extends Controller
{
    public function __construct(private readonly ProctoringService $proctoring, private readonly SectionCoordinatorService $coordinators) {}

    public function index(Request $request)
    {
        $user = $request->user();

        $sessions = $this->proctoring->flaggedSessionsForCoordinator($user)->get();

        return response()->json(['sessions' => $sessions->map(fn (ProctoringSession $s) => $this->summary($s))]);
    }

    public function show(Request $request, ProctoringSession $proctoringSession)
    {
        $this->authorizeSection($request, $proctoringSession);

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
            ]);

        return response()->json([
            'session' => $this->summary($proctoringSession),
            'violations' => $violations,
        ]);
    }

    public function reinstate(Request $request, ProctoringSession $proctoringSession)
    {
        $this->authorizeSection($request, $proctoringSession);
        abort_unless($proctoringSession->isLocked(), 422, 'This session is not locked.');

        $this->proctoring->reinstate($proctoringSession, $request->user());

        return response()->json(['session' => $this->summary($proctoringSession->fresh())]);
    }

    /** A coordinator may only ever act on a session belonging to a student they look after — the same query the roster uses. */
    private function authorizeSection(Request $request, ProctoringSession $session): void
    {
        $session->loadMissing('contestParticipant.user');
        $student = $session->contestParticipant->user;

        abort_unless($student !== null && $this->coordinators->covers($request->user(), $student), 404);
    }

    private function summary(ProctoringSession $s): array
    {
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
                'roll_number' => $s->contestParticipant->user->roll_number,
            ],
            'contest' => [
                'id' => $s->contestParticipant->contest->id,
                'title' => $s->contestParticipant->contest->title,
                'slug' => $s->contestParticipant->contest->slug,
            ],
        ];
    }
}
