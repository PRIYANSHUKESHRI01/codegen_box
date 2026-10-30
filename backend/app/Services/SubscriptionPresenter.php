<?php

namespace App\Services;

use App\Models\Interview;
use App\Models\InterviewSession;
use App\Models\Submission;
use App\Models\Subscription;
use App\Models\User;
use App\Services\Core\CoreAccess;
use App\Services\Payments\GatewayManager;
use App\Services\ProjectLab\ProjectLabAccess;

/**
 * The student-facing description of a plan: the body of GET /me/subscription,
 * and — because a purchase has to hand the browser the new state in one
 * round trip — of POST /me/checkout/verify too. One place builds it, so what a
 * student sees right after paying is exactly what a reload would show.
 */
class SubscriptionPresenter
{
    public function __construct(
        private readonly GatewayManager $gateways,
    ) {}

    /** @return array<string, mixed> */
    public function individual(User $user): array
    {
        return [
            'scope' => 'individual',
            'coverage' => $this->formatCoverage($user->subscriptionCoverage()),
            'entitlements' => $this->entitlementsWithUsage($user),
            'addons' => $user->activeAddonSubscriptions()->map(fn (Subscription $s) => [
                'code' => $s->plan->code,
                'name' => $s->plan->name,
                'days_remaining' => $s->daysRemaining(),
                'current_period_end' => $s->current_period_end,
                'price_paid' => $s->meta['price_paid'] ?? null,
            ])->values(),
            'project_lab' => app(ProjectLabAccess::class)->summary($user),
            // Whether the Buy buttons can work at all — false until the active gateway's keys are set, so the UI
            // says "payments are being set up" instead of failing at the click. `gateway` / `gateway_name` say
            // whose secure page the student is about to be sent to (PayU, Razorpay).
            'checkout' => $this->checkoutInfo(),
        ];
    }

    /** @return array{available: bool, test_mode: bool, gateway: ?string, gateway_name: ?string} */
    private function checkoutInfo(): array
    {
        $gateway = $this->gateways->active();

        return [
            'available' => $gateway?->isConfigured() ?? false,
            'test_mode' => ($gateway?->mode() ?? 'test') !== 'live',
            'gateway' => $gateway?->code(),
            'gateway_name' => $gateway?->label(),
        ];
    }

    /**
     * The limits AND how much of today's quota is already used — the
     * "X of Y used today" the frontend shows before a candidate hits a
     * wall (see InterviewController::assertWithinDailyMockInterviewLimit()/
     * SubmissionController::assertWithinDailyPracticeLimit() and PlanGate for
     * the actual enforcement this only mirrors for display purposes).
     *
     * @return array<string, mixed>
     */
    public function entitlementsWithUsage(User $user): array
    {
        $entitlements = $user->effectiveEntitlements();

        $practiceUsedToday = Submission::where('user_id', $user->id)
            ->where('submitted_on', today())
            ->distinct('problem_id')
            ->count('problem_id');

        $mockInterviewsUsedToday = InterviewSession::where('user_id', $user->id)
            ->whereDate('started_at', today())
            ->whereHas('interview', fn ($q) => $q->usesMockAllowance())
            ->count();

        return [
            'max_practice_problems_per_day' => $entitlements['max_practice_problems_per_day'],
            'practice_problems_used_today' => $practiceUsedToday,
            'max_mock_interviews_per_day' => $entitlements['max_mock_interviews_per_day'],
            'mock_interviews_used_today' => $mockInterviewsUsedToday,
            'drive_access' => $entitlements['drive_access'],
            'hackathon_access' => $entitlements['hackathon_access'],
            'vault_access' => $entitlements['vault_access'],
            // Core Prep (branch technical practice and tests). `core_prep.available` is what puts it in the student's
            // navigation: their branch is a core family, staff switched it live, and there is published material.
            'max_core_practice_per_day' => $entitlements['max_core_practice_per_day'],
            'core_practice_used_today' => app(PlanGate::class)->corePracticeUsedToday($user),
            'core_tests_access' => $entitlements['core_tests_access'],
            'core_prep' => app(CoreAccess::class)->state($user),
            // The free plan's one-time tries and how many are spent; null on every plan without a trial cap.
            'feature_trial' => app(PlanGate::class)->trialSummary($user),
        ];
    }

    /**
     * @param  array{source: string, subscription: ?Subscription, plan: ?\App\Models\Plan, days_remaining: ?int, is_trial?: bool}  $coverage
     * @return array<string, mixed>
     */
    public function formatCoverage(array $coverage): array
    {
        $subscription = $coverage['subscription'];
        $plan = $coverage['plan'];

        return [
            'source' => $coverage['source'],
            'days_remaining' => $coverage['days_remaining'],
            'is_trial' => $coverage['is_trial'] ?? false,
            'status' => $subscription?->status,
            'started_at' => $subscription?->started_at,
            'current_period_end' => $subscription?->current_period_end,
            'plan' => $plan ? [
                'code' => $plan->code,
                'name' => $plan->name,
                'audience' => $plan->audience,
            ] : null,
        ];
    }
}
