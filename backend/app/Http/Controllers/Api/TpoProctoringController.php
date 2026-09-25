<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ProctoringSession;
use App\Models\ProctoringViolation;
use App\Services\ProctoringService;
use Illuminate\Http\Request;

/**
 * College-TPO-only review of proctoring activity across their WHOLE college
 * (every section) — the section-scoped equivalent is
 * CoordinatorProctoringController. Read-only except reinstate(), a
 * false-positive override for a locked student — see
 * ProctoringService::reinstate().
 */
class TpoProctoringController extends Controller
{
    public function __construct(private readonly ProctoringService $proctoring) {}

    public function index(Request $request)
    {
        $collegeId = $request->user()->college_id;

        if (! $collegeId) {
            return response()->json(['sessions' => []]);
        }

        $sessions = $this->proctoring->flaggedSessionsForCollege($collegeId)->get();

        return response()->json(['sessions' => $sessions->map(fn (ProctoringSession $s) => $this->summary($s))]);
    }

    public function show(Request $request, ProctoringSession $proctoringSession)
    {
        $this->authorizeCollege($request, $proctoringSession);

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
        $this->authorizeCollege($request, $proctoringSession);
        abort_unless($proctoringSession->isLocked(), 422, 'This session is not locked.');

        $this->proctoring->reinstate($proctoringSession, $request->user());

        return response()->json(['session' => $this->summary($proctoringSession->fresh())]);
    }

    private function authorizeCollege(Request $request, ProctoringSession $session): void
    {
        $session->loadMissing('contestParticipant.user');
        abort_unless($session->contestParticipant->user->college_id === $request->user()->college_id, 404);
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
                'section' => $s->contestParticipant->user->section,
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
