<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\StudySitting;
use App\Models\StudySittingViolation;
use App\Services\Integrity\IntegrityService;
use App\Services\StudySittingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Student-facing proctoring for Core Prep practice and Skill Drills — the endpoints the shared proctoring hook calls
 * (`${basePath}/proctoring/start` and `/proctoring/violations`, with basePath = `/me/sittings/{id}`). See StudySittingService.
 */
class StudySittingController extends Controller
{
    public function __construct(private readonly StudySittingService $sittings, private readonly IntegrityService $integrity) {}

    /**
     * Opens a sitting. `proctored: false` (and no sitting) when the campus has switched study proctoring off — the page then runs as
     * plain practice and sends no sitting id.
     */
    public function store(Request $request): JsonResponse
    {
        abort_unless($request->user()->isStudent(), 403);

        $validated = $request->validate([
            'kind' => ['required', Rule::in(StudySitting::KINDS)],
            'subject' => ['nullable', 'string', 'max:80'],
        ]);

        if (! $this->sittings->enabled()) {
            return response()->json(['proctored' => false, 'sitting' => null]);
        }

        $sitting = $this->sittings->open($request->user(), $validated['kind'], $validated['subject'] ?? null);

        return response()->json(['proctored' => true, 'sitting' => $this->payload($sitting)], 201);
    }

    public function start(Request $request, StudySitting $sitting): JsonResponse
    {
        $this->own($request, $sitting);

        $validated = $request->validate(['device_info' => ['nullable', 'array'], 'integrity' => ['nullable', 'array']]);

        // Before consent is recorded: may this sitting begin from here, on this machine?
        $this->integrity->preflight($request->user(), 'study', $request);

        $started = $this->sittings->startOrResume($sitting, $validated['device_info'] ?? []);

        // The integrity layer (heartbeat, evidence, device/address binding). Null when it is switched off.
        $integrity = $this->integrity->attach($request->user(), 'study', $started, ($validated['integrity'] ?? []) + ['context' => ['kind' => $started->kind]], $request);

        return response()->json(['session' => $this->payload($started), 'integrity' => $integrity]);
    }

    public function reportViolation(Request $request, StudySitting $sitting): JsonResponse
    {
        $this->own($request, $sitting);
        abort_unless($sitting->isConsented(), 404, 'No active proctoring for this sitting — call start first.');

        $validated = $request->validate([
            'type' => ['required', Rule::in(StudySittingViolation::TYPES)],
            'meta' => ['nullable', 'array'],
        ]);

        $result = $this->sittings->recordViolation($sitting, $validated['type'], $request->ip(), $validated['meta'] ?? []);

        return response()->json(['session' => $this->payload($result['sitting']), 'locked' => $result['locked']]);
    }

    /** The student finished (or left): ends the sitting. Idempotent. */
    public function complete(Request $request, StudySitting $sitting): JsonResponse
    {
        $this->own($request, $sitting);

        return response()->json(['session' => $this->payload($this->sittings->complete($sitting))]);
    }

    private function own(Request $request, StudySitting $sitting): void
    {
        abort_unless($request->user()->isStudent() && $sitting->user_id === $request->user()->id, 404);
    }

    /** Same JSON keys as every other proctoring payload (the frontend's ProctoringSessionState), plus the sitting's id. */
    private function payload(StudySitting $s): array
    {
        return [
            'id' => $s->id,
            'kind' => $s->kind,
            'status' => $s->status,
            'violation_count' => $s->violation_count,
            'max_violations' => (int) config('proctoring.max_violations_before_lock', 3),
            'locked_at' => $s->locked_at,
        ];
    }
}
