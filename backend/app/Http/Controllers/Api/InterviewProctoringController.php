<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Interview;
use App\Models\InterviewProctoringViolation;
use App\Models\InterviewQuestion;
use App\Models\InterviewSession;
use App\Services\InterviewProctoringService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Student-facing proctoring endpoints for taking an AI interview — mirrors
 * ContestProctoringController exactly. start() is called once the consent
 * gate completes (see frontend InterviewProctoringConsentGate);
 * reportViolation() is called by the client's tab-switch/fullscreen/
 * devtools detectors as they fire. The server — not the client — decides
 * when 3 strikes locks a candidate out (see InterviewProctoringService), so
 * InterviewController::start()/answer() independently re-check lock status
 * on every call regardless of what this controller reports back.
 */
class InterviewProctoringController extends Controller
{
    public function __construct(private readonly InterviewProctoringService $proctoring) {}

    public function start(Request $request, Interview $interview)
    {
        abort_unless($interview->isVisibleToUser($request->user()), 404);

        $session = $this->session($request, $interview);

        $validated = $request->validate([
            'device_info' => ['nullable', 'array'],
        ]);

        $proctoringSession = $this->proctoring->startOrResume($session, $validated['device_info'] ?? []);

        return response()->json(['session' => $this->sessionPayload($proctoringSession)]);
    }

    public function reportViolation(Request $request, Interview $interview)
    {
        $session = $this->session($request, $interview);
        $proctoringSession = $session->proctoringSession;
        abort_unless($proctoringSession, 404, 'No active proctoring session for this interview — call start first.');

        $validated = $request->validate([
            'type' => ['required', Rule::in(InterviewProctoringViolation::TYPES)],
            'meta' => ['nullable', 'array'],
        ]);

        $currentQuestion = InterviewQuestion::where('interview_id', $interview->id)
            ->orderBy('display_order')
            ->get()
            ->get($session->current_question_order);

        $result = $this->proctoring->recordViolation(
            $proctoringSession,
            $validated['type'],
            $currentQuestion,
            $request->ip(),
            $validated['meta'] ?? [],
        );

        return response()->json([
            'session' => $this->sessionPayload($result['session']),
            'locked' => $result['locked'],
        ]);
    }

    private function session(Request $request, Interview $interview): InterviewSession
    {
        $session = InterviewSession::where('interview_id', $interview->id)
            ->where('user_id', $request->user()->id)
            ->first();

        abort_unless($session, 403, 'You must start this interview first.');

        return $session;
    }

    private function sessionPayload($proctoringSession): array
    {
        return [
            'status' => $proctoringSession->status,
            'violation_count' => $proctoringSession->violation_count,
            'max_violations' => (int) config('proctoring.max_violations_before_lock', 3),
            'locked_at' => $proctoringSession->locked_at,
        ];
    }
}
