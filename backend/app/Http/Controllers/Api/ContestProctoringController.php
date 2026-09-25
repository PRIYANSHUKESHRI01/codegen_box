<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Contest;
use App\Models\ContestParticipant;
use App\Models\ContestProblem;
use App\Models\ProctoringSession;
use App\Models\ProctoringViolation;
use App\Services\JudgeService;
use App\Services\ProctoringService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Student-facing proctoring endpoints for a LIVE contest problem — never
 * reachable for practice (see routes/api.php; these sit alongside
 * ContestSubmissionController's run/submit/show under the same role:user
 * contest group). start() is called once when the proctoring consent gate
 * completes (see frontend ProctoringConsentGate); reportViolation() is
 * called by the client's tab-switch/fullscreen/devtools detectors as they
 * fire. The server — not the client — decides when 3 strikes locks a
 * student out (see ProctoringService), so a modified/tampered client can
 * never talk its way out of enforcement: the very next run/submit/show call
 * is independently rejected once the session is locked.
 */
class ContestProctoringController extends Controller
{
    public function __construct(private readonly ProctoringService $proctoring) {}

    public function start(Request $request, Contest $contest, ContestProblem $contestProblem)
    {
        abort_unless($contestProblem->contest_id === $contest->id, 404);
        abort_unless($contest->isLive(), 422, 'This contest is not currently live.');

        $participant = $this->participant($request, $contest);

        $validated = $request->validate([
            'device_info' => ['nullable', 'array'],
        ]);

        $session = $this->proctoring->startOrResume($participant, $validated['device_info'] ?? []);

        return response()->json(['session' => $this->sessionPayload($session)]);
    }

    public function reportViolation(Request $request, Contest $contest, ContestProblem $contestProblem)
    {
        abort_unless($contestProblem->contest_id === $contest->id, 404);

        $participant = $this->participant($request, $contest);
        $session = $participant->proctoringSession;
        abort_unless($session, 404, 'No active proctoring session for this contest — call start first.');

        $validated = $request->validate([
            'type' => ['required', Rule::in(ProctoringViolation::TYPES)],
            'meta' => ['nullable', 'array'],
            // Sent on every violation report (not just the one that might
            // lock) so there's never a race between "client learns it just
            // hit strike 3" and "client sends the code" — the server always
            // has it in hand the instant it decides to lock.
            'current_code' => ['nullable', 'string', 'max:'.(int) config('judge.limits.max_code_length', 65536)],
            'language' => ['nullable', Rule::in(JudgeService::SUPPORTED_LANGUAGES)],
        ]);

        $result = $this->proctoring->recordViolation(
            $session,
            $validated['type'],
            $contestProblem,
            $request->ip(),
            $validated['meta'] ?? [],
            $validated['current_code'] ?? null,
            $validated['language'] ?? null,
        );

        return response()->json([
            'session' => $this->sessionPayload($result['session']),
            'locked' => $result['locked'],
        ]);
    }

    private function participant(Request $request, Contest $contest): ContestParticipant
    {
        $participant = ContestParticipant::where('contest_id', $contest->id)
            ->where('user_id', $request->user()->id)
            ->first();

        abort_unless($participant, 403, 'You must register for this contest first.');

        return $participant;
    }

    private function sessionPayload(ProctoringSession $session): array
    {
        return [
            'status' => $session->status,
            'violation_count' => $session->violation_count,
            'max_violations' => (int) config('proctoring.max_violations_before_lock', 3),
            'locked_at' => $session->locked_at,
        ];
    }
}
