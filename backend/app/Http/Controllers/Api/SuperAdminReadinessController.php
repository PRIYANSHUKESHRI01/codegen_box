<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\User;
use App\Services\ReadinessOverrideService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * Superadmin → one student's readiness score (the "Set score" button of the Manage drawer). A score set here replaces the calculated
 * one everywhere at once (ReadinessScoreService applies it, ReadinessOverrideService makes it immediate), and is undone by
 * removing it - the student is then scored from their activity again.
 *
 * The reason is required and is shown only here: the student is told their score changed, not why.
 */
class SuperAdminReadinessController extends Controller
{
    public function __construct(
        private readonly ReadinessOverrideService $overrides,
    ) {}

    /** One student: the score, what it is made of, the hand-set number if any, and every change anyone made to it. */
    public function show(User $user): JsonResponse
    {
        return response()->json($this->detail($this->student($user)));
    }

    public function update(Request $request, User $user): JsonResponse
    {
        $validated = $request->validate([
            'score' => ['required', 'integer', 'min:0', 'max:100'],
            'reason' => ['required', 'string', 'min:3', 'max:300'],
            'days' => ['nullable', 'integer', 'min:1', 'max:365'],
        ]);

        $this->overrides->set($this->student($user), (int) $validated['score'], $validated['reason'], $request->user(), $validated['days'] ?? null);

        return response()->json($this->detail($user->fresh()));
    }

    public function destroy(Request $request, User $user): JsonResponse
    {
        $validated = $request->validate(['reason' => ['required', 'string', 'min:3', 'max:300']]);

        if (! $this->overrides->clear($this->student($user), $validated['reason'], $request->user())) {
            return response()->json(['message' => 'This student has no hand-set score to remove.'], 422);
        }

        return response()->json($this->detail($user->fresh()));
    }

    // ─────────────────────────────────── shaping ───────────────────────────────────

    /** @return array<string, mixed> */
    private function detail(User $user): array
    {
        $breakdown = $user->readinessBreakdown();
        $held = $this->overrides->latest($user);
        $override = $breakdown['override'] ?? null;

        return [
            'student' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'college' => $user->college?->name,
                'study_year' => $user->study_year,
            ],
            'score' => $breakdown['score'],
            'tier' => $breakdown['tier'],
            'calculated_score' => $override['calculated_score'] ?? $breakdown['score'],
            'calculated_tier' => $override['calculated_tier'] ?? $breakdown['tier'],
            'vault' => $breakdown['vault'],
            'components' => collect($breakdown['components'])->map(fn (array $c) => [
                'key' => $c['key'],
                'label' => $c['label'],
                'score' => $c['score'] ?? null,
                'weight' => $c['weight_percent'] ?? null,
                'contribution' => $c['contribution'] ?? null,
            ])->values(),
            'missed_day_penalty' => (int) ($breakdown['decay']['points'] ?? 0),
            'override' => $held === null ? null : [
                'score' => $held->score,
                'reason' => $held->reason,
                'set_by' => $held->setBy?->name,
                'set_at' => $held->updated_at?->toIso8601String(),
                'expires_at' => $held->expires_at?->toIso8601String(),
                'in_force' => $held->isInForce(),
            ],
            'history' => ActivityLog::where('target_type', 'Student readiness')
                ->where('meta->user_id', $user->id)
                ->latest('id')
                ->limit(30)
                ->get()
                ->map(fn (ActivityLog $l) => [
                    'at' => $l->created_at?->toIso8601String(),
                    'by' => $l->actor_name,
                    'action' => $l->action,
                    'score' => $l->meta['score'] ?? null,
                    'score_before' => $l->meta['score_before'] ?? null,
                    'score_after' => $l->meta['score_after'] ?? null,
                    'reason' => $l->meta['reason'] ?? null,
                ])->values(),
        ];
    }

    private function student(User $user): User
    {
        if ($user->role !== User::ROLE_USER) {
            throw new NotFoundHttpException('That account is not a student.');
        }

        return $user;
    }
}
