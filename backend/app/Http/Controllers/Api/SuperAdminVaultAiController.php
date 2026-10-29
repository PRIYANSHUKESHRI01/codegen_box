<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\VaultInterviewQualification;
use App\Models\VaultProfile;
use App\Services\Vault\CuratedCatalog;
use App\Services\Vault\VaultAiAccessService;
use App\Services\Vault\VaultQualificationAdminService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * Superadmin → a student's Vault AI Interview (the "Vault AI" tab of the Manage drawer): their qualifications, and the hand tools to manage it - give a blocked
 * student their attempts back, correct marks, qualify someone outright, take a qualification back, open the interview for
 * a student still waiting at the gate. The rules themselves live in VaultQualificationAdminService; this class validates,
 * finds the student, and answers with the student's whole Vault AI picture as it now stands.
 */
class SuperAdminVaultAiController extends Controller
{
    public function __construct(
        private readonly VaultQualificationAdminService $admin,
        private readonly CuratedCatalog $catalog,
    ) {}

    /** One student's whole Vault AI picture: the gate, every stack they have touched, their Vault standing. */
    public function show(User $user): JsonResponse
    {
        return response()->json($this->payload($this->student($user)));
    }

    public function reset(Request $request, User $user, string $stackKey): JsonResponse
    {
        $validated = $request->validate(['reason' => ['required', 'string', 'min:3', 'max:300']]);
        $this->knownStack($stackKey);

        $this->admin->reset($this->student($user), $stackKey, $request->user(), $validated['reason']);

        return response()->json($this->payload($user->fresh()));
    }

    public function scores(Request $request, User $user, string $stackKey): JsonResponse
    {
        $validated = $request->validate([
            'scores' => ['required', 'array'],
            'scores.*' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'attempt_index' => ['nullable', 'integer', 'min:0', 'max:200'],
            'reason' => ['required', 'string', 'min:3', 'max:300'],
        ]);
        $this->knownStack($stackKey);

        $this->admin->setScores(
            $this->student($user), $stackKey, $validated['scores'], $request->user(), $validated['reason'], $validated['attempt_index'] ?? null
        );

        return response()->json($this->payload($user->fresh()));
    }

    public function qualify(Request $request, User $user, string $stackKey): JsonResponse
    {
        $validated = $request->validate([
            'average' => ['required', 'numeric', 'min:'.VaultInterviewQualification::PASSING_THRESHOLD, 'max:100'],
            'reason' => ['required', 'string', 'min:3', 'max:300'],
        ]);
        $this->knownStack($stackKey);

        $this->admin->markQualified($this->student($user), $stackKey, (float) $validated['average'], $request->user(), $validated['reason']);

        return response()->json($this->payload($user->fresh()));
    }

    public function unlockAccess(Request $request, User $user): JsonResponse
    {
        $validated = $request->validate(['reason' => ['required', 'string', 'min:3', 'max:300']]);

        $this->admin->unlockAccess($this->student($user), $request->user(), $validated['reason']);

        return response()->json($this->payload($user->fresh()));
    }

    // ─────────────────────────────────── shaping ───────────────────────────────────

    /** @return array<string, mixed> */
    private function payload(User $student): array
    {
        $qualifications = VaultInterviewQualification::where('user_id', $student->id)
            ->with(['user:id,name,email,college_id', 'user.college:id,name'])
            ->latest('updated_at')
            ->get();

        $profile = VaultProfile::where('user_id', $student->id)->first();
        $breakdown = $student->readinessBreakdown();

        return [
            'student' => [
                'id' => $student->id,
                'name' => $student->name,
                'email' => $student->email,
                'college' => $student->college?->name,
                'study_year' => $student->study_year,
                'is_blocked' => (bool) $student->is_blocked,
                'vault_ai_score' => $student->vault_ai_score !== null ? (float) $student->vault_ai_score : null,
            ],
            // Read-only: looking at a student must never write their unlock.
            'gate' => app(VaultAiAccessService::class)->forUser($student, true, false),
            'readiness' => [
                'score' => $breakdown['score'],
                'tier' => $breakdown['tier'],
                'overridden' => isset($breakdown['override']),
            ],
            'vault' => $profile === null ? null : [
                'status' => $profile->visibility_status,
                'is_eligible' => (bool) $profile->is_eligible,
                'source' => $profile->qualification_source,
                'ai_interview_stack' => $profile->ai_interview_stack,
            ],
            'qualifications' => $qualifications->map(fn (VaultInterviewQualification $q) => $this->row($q, detail: true))->values(),
            'stacks' => $this->stacks(),
        ];
    }

    /** @return array<string, mixed> */
    private function row(VaultInterviewQualification $q, bool $detail = false): array
    {
        $found = $this->catalog->stack($q->stack_key);
        $history = $q->attempt_history ?? [];
        $cycleStart = (int) $q->cycle_start;

        $row = [
            'id' => $q->id,
            'user' => [
                'id' => $q->user_id,
                'name' => $q->user?->name,
                'email' => $q->user?->email,
                'college' => $q->user?->college?->name,
            ],
            'stack_key' => $q->stack_key,
            'stack_name' => $found['stack']['name'] ?? ucwords(str_replace('_', ' ', $q->stack_key)),
            'role_name' => $found['role']['title'] ?? $q->role_key,
            'status' => $q->status,
            'is_blocked' => $q->isCoolingDown(),
            // Blocked on paper, but the 45 days are over: the student can sit again without anyone doing anything.
            'cooldown_over' => $q->status === VaultInterviewQualification::STATUS_COOLING_DOWN && ! $q->isCoolingDown(),
            'current_attempt' => $q->current_attempt,
            'max_attempts' => $q->max_attempts,
            'failed_attempts' => max(0, count($history) - $cycleStart),
            'series_scores' => (object) ($q->series_scores ?? []),
            'series_average' => $q->series_average,
            'cooldown_until' => $q->cooldown_until?->toIso8601String(),
            'cooldown_days_remaining' => $q->getRemainingCooldownDays(),
            'qualified_at' => $q->qualified_at?->toIso8601String(),
            'qualified_by_admin' => $q->qualified_by_admin_id !== null,
            'updated_at' => $q->updated_at?->toIso8601String(),
        ];

        if ($detail) {
            $row['attempt_history'] = collect($history)->map(fn (array $a, int $i) => $a + ['index' => $i, 'this_cycle' => $i >= $cycleStart])->values();
            $row['admin_log'] = array_reverse($q->admin_log ?? []);
        }

        return $row;
    }

    /** @return list<array{key: string, name: string, role: string, live: bool}> */
    private function stacks(): array
    {
        $out = [];

        foreach ($this->catalog->roles() as $role) {
            foreach ($role['stacks'] as $key => $stack) {
                $out[] = [
                    'key' => (string) $key,
                    'name' => (string) $stack['name'],
                    'role' => (string) ($role['title'] ?? $role['key']),
                    'live' => $this->catalog->progress($stack)['live'],
                ];
            }
        }

        return $out;
    }

    private function student(User $user): User
    {
        if ($user->role !== User::ROLE_USER) {
            throw new NotFoundHttpException('That account is not a student.');
        }

        return $user;
    }

    private function knownStack(string $stackKey): void
    {
        if ($this->catalog->stack($stackKey) === null) {
            throw new NotFoundHttpException("Unknown interview stack [{$stackKey}].");
        }
    }
}
