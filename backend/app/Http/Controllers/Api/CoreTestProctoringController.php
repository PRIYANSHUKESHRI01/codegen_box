<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CoreTestProctoringSession;
use App\Models\CoreTestProctoringViolation;
use App\Models\CoreTestSession;
use App\Services\Core\CoreTestProctoringService;
use App\Services\Integrity\IntegrityService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Student-facing proctoring endpoints for a Core test — mirrors SoftSkillProctoringController. start() runs once
 * the consent gate completes; reportViolation() as the client's detectors fire. The SERVER decides when the
 * strike limit ends an attempt, and every answer re-checks the lock regardless of what this reports back.
 */
class CoreTestProctoringController extends Controller
{
    public function __construct(private readonly CoreTestProctoringService $proctoring, private readonly IntegrityService $integrity) {}

    public function start(Request $request, CoreTestSession $session)
    {
        $this->authorizeOwner($request, $session);
        abort_if($session->isCompleted(), 422, 'This test has already been submitted.');

        $validated = $request->validate(['device_info' => ['nullable', 'array'], 'integrity' => ['nullable', 'array']]);

        // Before anything is created (this call restarts the test's clock): may it begin from here, on this machine?
        $this->integrity->preflight($request->user(), 'core_test', $request);

        $proctoring = $this->proctoring->startOrResume($session, $validated['device_info'] ?? []);

        // The integrity layer (heartbeat, evidence, device/address binding). Null when it is switched off.
        $integrity = $this->integrity->attach($request->user(), 'core_test', $proctoring, $validated['integrity'] ?? [], $request);

        return response()->json(['session' => $this->payload($proctoring), 'integrity' => $integrity]);
    }

    public function reportViolation(Request $request, CoreTestSession $session)
    {
        $this->authorizeOwner($request, $session);

        $proctoring = $session->proctoringSession;
        abort_unless($proctoring, 404, 'No active proctoring session for this test — call start first.');

        $validated = $request->validate([
            'type' => ['required', Rule::in(CoreTestProctoringViolation::TYPES)],
            'meta' => ['nullable', 'array'],
        ]);

        $result = $this->proctoring->recordViolation($proctoring, $validated['type'], $request->ip(), $validated['meta'] ?? []);

        return response()->json(['session' => $this->payload($result['session']), 'locked' => $result['locked']]);
    }

    private function authorizeOwner(Request $request, CoreTestSession $session): void
    {
        abort_unless($session->user_id === $request->user()->id, 404);
    }

    /** Same JSON keys as every other proctoring payload (frontend ProctoringSessionState). */
    private function payload(CoreTestProctoringSession $s): array
    {
        return [
            'status' => $s->status,
            'violation_count' => $s->violation_count,
            'max_violations' => (int) config('proctoring.max_violations_before_lock', 3),
            'locked_at' => $s->locked_at,
        ];
    }
}
