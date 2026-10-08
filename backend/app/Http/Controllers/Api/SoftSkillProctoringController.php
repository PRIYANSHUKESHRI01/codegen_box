<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SoftSkillProctoringSession;
use App\Models\SoftSkillProctoringViolation;
use App\Models\SoftSkillSession;
use App\Services\SoftSkillProctoringService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Student-facing proctoring endpoints for taking a Soft Skills test — mirrors
 * InterviewProctoringController / ContestProctoringController. start() is
 * called once the consent gate completes (frontend ProctoringConsentGate);
 * reportViolation() is called by the client's tab-switch/fullscreen/devtools
 * detectors as they fire. The server — not the client — decides when the
 * strike limit ends an attempt (SoftSkillProctoringService), and
 * SoftSkillController::answer()/submit() independently re-check the lock on
 * every call regardless of what this controller reports back.
 */
class SoftSkillProctoringController extends Controller
{
    public function __construct(private readonly SoftSkillProctoringService $proctoring) {}

    public function start(Request $request, SoftSkillSession $softSkillSession)
    {
        $this->authorizeOwner($request, $softSkillSession);

        // A finished attempt has nothing left to protect, and must not grow a
        // fresh proctoring session after the fact.
        abort_if($softSkillSession->isCompleted(), 422, 'This assessment has already been submitted.');

        $validated = $request->validate([
            'device_info' => ['nullable', 'array'],
        ]);

        $proctoringSession = $this->proctoring->startOrResume($softSkillSession, $validated['device_info'] ?? []);

        return response()->json(['session' => $this->sessionPayload($proctoringSession)]);
    }

    public function reportViolation(Request $request, SoftSkillSession $softSkillSession)
    {
        $this->authorizeOwner($request, $softSkillSession);

        $proctoringSession = $softSkillSession->proctoringSession;
        abort_unless($proctoringSession, 404, 'No active proctoring session for this test — call start first.');

        $validated = $request->validate([
            'type' => ['required', Rule::in(SoftSkillProctoringViolation::TYPES)],
            'meta' => ['nullable', 'array'],
        ]);

        $result = $this->proctoring->recordViolation(
            $proctoringSession,
            $validated['type'],
            $request->ip(),
            $validated['meta'] ?? [],
        );

        return response()->json([
            'session' => $this->sessionPayload($result['session']),
            'locked' => $result['locked'],
        ]);
    }

    private function authorizeOwner(Request $request, SoftSkillSession $softSkillSession): void
    {
        abort_unless($softSkillSession->user_id === $request->user()->id, 404);
    }

    /** Same JSON keys as the contest/interview payload (frontend ProctoringSessionState). */
    private function sessionPayload(SoftSkillProctoringSession $proctoringSession): array
    {
        return [
            'status' => $proctoringSession->status,
            'violation_count' => $proctoringSession->violation_count,
            'max_violations' => (int) config('proctoring.max_violations_before_lock', 3),
            'locked_at' => $proctoringSession->locked_at,
        ];
    }
}
