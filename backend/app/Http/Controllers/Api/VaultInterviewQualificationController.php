<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\Vault\VaultAiAccessService;
use App\Services\Vault\VaultInterviewQualificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Controller for Mellow Vault Technical Interview Qualification.
 *
 * Handles:
 * - Whether the student may take it yet (access): a direct AptRun user always may; a college student once their wait and readiness
 *   are met - see VaultAiAccessService.
 * - Querying candidate's current series progress, scores, and cooldown status.
 * - Launching Set 1, Set 2, or Set 3 in the student's active qualification series.
 *
 * The role is not taken from the request: the catalog says which role a stack belongs to.
 */
class VaultInterviewQualificationController extends Controller
{
    public function __construct(
        private readonly VaultInterviewQualificationService $qualificationService,
        private readonly VaultAiAccessService $access,
    ) {}

    /**
     * Where the student stands on unlocking the Vault AI Interview: drives the dashboard card, the sidebar item and the page's lock screen.
     *
     * GET /api/vault-qualification/access
     */
    public function access(Request $request): JsonResponse
    {
        $user = $this->student($request);

        return response()->json(['access' => $this->access->forUser($user, persist: ! $user->isBeingImpersonated())]);
    }

    /**
     * Get candidate's qualification status for a tech stack.
     *
     * GET /api/vault-qualification/status?stack=laravel
     */
    public function status(Request $request): JsonResponse
    {
        $user = $this->student($request);

        if ($locked = $this->lockedResponse($user)) {
            return $locked;
        }

        $validated = $request->validate([
            'stack' => ['required', 'string', 'max:50'],
        ]);

        return response()->json($this->qualificationService->getStatus($user, $validated['stack']));
    }

    /**
     * Start a specific set in the candidate's active qualification series.
     *
     * POST /api/vault-qualification/start-set
     * Payload: { "stack": "laravel", "set_number": 1 }
     */
    public function startSet(Request $request): JsonResponse
    {
        $user = $this->student($request);

        // The server decides, not the page: a locked student who calls this directly is refused all the same. Fresh, because this
        // answer decides whether an interview is actually created.
        if ($locked = $this->lockedResponse($user, fresh: true)) {
            return $locked;
        }

        $validated = $request->validate([
            'stack' => ['required', 'string', 'max:50'],
            'set_number' => ['required', 'integer', 'between:1,3'],
        ]);

        $interview = $this->qualificationService->startSet(
            $request->user(),
            $validated['stack'],
            (int) $validated['set_number']
        );

        return response()->json([
            'message' => 'Qualification set launched.',
            'interview' => [
                'id' => $interview->id,
                'title' => $interview->title,
                'slug' => $interview->slug,
                'practice_config' => $interview->practice_config,
            ],
        ]);
    }

    private function student(Request $request): User
    {
        $user = $request->user();
        abort_unless($user->isStudent(), 403, 'Vault AI Interview qualification is available to students.');

        return $user;
    }

    /** A 403 that carries the reason (and the countdown), or null when the student may go on. */
    private function lockedResponse(User $user, bool $fresh = false): ?JsonResponse
    {
        $access = $this->access->forUser($user, fresh: $fresh, persist: ! $user->isBeingImpersonated());

        if ($access['state'] === VaultAiAccessService::STATE_OPEN) {
            return null;
        }

        return response()->json([
            'message' => $access['state'] === VaultAiAccessService::STATE_UNAVAILABLE
                ? 'The Vault AI Interview is not available for your year of study.'
                : 'The Vault AI Interview is still locked for you.',
            'code' => 'vault_ai_locked',
            'access' => $access,
        ], 403);
    }
}
