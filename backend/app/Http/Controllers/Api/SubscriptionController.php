<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Interview;
use App\Models\InterviewSession;
use App\Models\Plan;
use App\Models\Submission;
use App\Models\Subscription;
use App\Models\User;
use App\Services\SubscriptionService;
use Illuminate\Http\Request;

/**
 * Every role's Settings → Billing tab and the /pricing page (when signed
 * in) read from GET /me/subscription; only a student (role: user) can
 * self-serve activate via POST — see SubscriptionService for why
 * institutional plans are admin-assigned instead.
 */
class SubscriptionController extends Controller
{
    public function mine(Request $request)
    {
        $user = $request->user();

        if ($user->role === User::ROLE_ADMIN_TPO) {
            $college = $user->college;
            $subscription = $college?->activeSubscription();
            $coverage = $this->coverageFromSubscription($subscription, 'institution');

            return response()->json(['scope' => 'institution', 'coverage' => $this->formatCoverage($coverage)]);
        }

        if ($user->role === User::ROLE_ADMIN_INTERNAL || $user->role === User::ROLE_SUPERADMIN) {
            return response()->json(['scope' => 'internal', 'coverage' => null]);
        }

        return response()->json([
            'scope' => 'individual',
            'coverage' => $this->formatCoverage($user->subscriptionCoverage()),
            'entitlements' => $this->entitlementsWithUsage($user),
        ]);
    }

    /**
     * The self-serve "checkout" stand-in — instantly activates, no payment
     * gateway wired up yet. Restricted to student accounts; a TPO's college
     * plan is assigned by Mellow staff (see AdminController::assignCollegeSubscription).
     */
    public function subscribe(Request $request, SubscriptionService $service)
    {
        $user = $request->user();

        if ($user->role !== User::ROLE_USER) {
            return response()->json(['message' => 'Only individual student accounts can self-serve subscribe.'], 403);
        }

        $validated = $request->validate([
            'plan_code' => ['required', 'string', 'exists:plans,code'],
        ]);

        $plan = Plan::where('code', $validated['plan_code'])->first();

        if ($plan->audience !== Plan::AUDIENCE_INDIVIDUAL || ! $plan->is_active) {
            return response()->json(['message' => 'That plan is not available for self-serve signup.'], 422);
        }

        $service->subscribeIndividual($user, $plan);

        return response()->json([
            'scope' => 'individual',
            'coverage' => $this->formatCoverage($user->subscriptionCoverage()),
            'entitlements' => $this->entitlementsWithUsage($user),
        ]);
    }

    /**
     * The limits AND how much of today's quota is already used — the
     * "X of Y used today" the frontend shows before a candidate hits a
     * wall (see InterviewController::assertWithinDailyMockInterviewLimit()/
     * SubmissionController::assertWithinDailyPracticeLimit() for the actual
     * enforcement this only mirrors for display purposes).
     */
    private function entitlementsWithUsage(User $user): array
    {
        $entitlements = $user->effectiveEntitlements();

        $practiceUsedToday = Submission::where('user_id', $user->id)
            ->where('submitted_on', today())
            ->distinct('problem_id')
            ->count('problem_id');

        $mockInterviewsUsedToday = InterviewSession::where('user_id', $user->id)
            ->whereDate('started_at', today())
            ->whereHas('interview', function ($q) {
                $q->whereNull('interview_track_id')
                    ->where(function ($q2) {
                        $q2->where('is_mock', true)->orWhere('interview_type', Interview::INTERVIEW_TYPE_TPO_MOCK);
                    });
            })
            ->count();

        return [
            'max_practice_problems_per_day' => $entitlements['max_practice_problems_per_day'],
            'practice_problems_used_today' => $practiceUsedToday,
            'max_mock_interviews_per_day' => $entitlements['max_mock_interviews_per_day'],
            'mock_interviews_used_today' => $mockInterviewsUsedToday,
            'drive_access' => $entitlements['drive_access'],
        ];
    }

    private function coverageFromSubscription(?Subscription $subscription, string $sourceWhenActive): array
    {
        if ($subscription === null || ! $subscription->isActive()) {
            return ['source' => 'none', 'subscription' => null, 'plan' => null, 'days_remaining' => null];
        }

        return [
            'source' => $sourceWhenActive,
            'subscription' => $subscription,
            'plan' => $subscription->plan,
            'days_remaining' => $subscription->daysRemaining(),
        ];
    }

    private function formatCoverage(array $coverage): array
    {
        $subscription = $coverage['subscription'];
        $plan = $coverage['plan'];

        return [
            'source' => $coverage['source'],
            'days_remaining' => $coverage['days_remaining'],
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
