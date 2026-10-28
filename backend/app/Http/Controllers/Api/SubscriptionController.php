<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Subscription;
use App\Models\User;
use App\Services\PurchaseQuoteService;
use App\Services\SubscriptionPresenter;
use Illuminate\Http\Request;

/**
 * Every role's Settings → Billing tab and the /pricing page (when signed
 * in) read from GET /me/subscription. Buying is a separate, payment-backed
 * flow — see CheckoutController: nothing here activates a plan, and an
 * institutional plan is admin-assigned (SubscriptionService), never self-serve.
 */
class SubscriptionController extends Controller
{
    public function __construct(
        private readonly SubscriptionPresenter $presenter,
    ) {}

    public function mine(Request $request)
    {
        $user = $request->user();

        if ($user->role === User::ROLE_ADMIN_TPO) {
            $college = $user->college;
            $subscription = $college?->activeSubscription();
            $coverage = $this->coverageFromSubscription($subscription, 'institution');

            return response()->json(['scope' => 'institution', 'coverage' => $this->presenter->formatCoverage($coverage)]);
        }

        if ($user->role === User::ROLE_ADMIN_INTERNAL || $user->role === User::ROLE_SUPERADMIN) {
            return response()->json(['scope' => 'internal', 'coverage' => null]);
        }

        return response()->json($this->presenter->individual($user));
    }

    /**
     * "Did my plan change?" — the cheap question every open dashboard asks every
     * few seconds, so that a plan a superadmin grants, extends or cancels (or a
     * plan whose limits were edited, or that simply ran out) shows up on the
     * student's screen without a reload or a new login.
     *
     * It answers with a signature over everything that decides what the account
     * may do — which plan governs it, that plan's last edit, the subscription's
     * status and end date, and any add-ons — plus just enough to word a "your plan
     * changed" notice. The browser compares signatures and only then refetches the
     * full /me/subscription. No usage counts and no gateway call, on purpose: this
     * runs far more often than anything else in the app.
     */
    public function signal(Request $request)
    {
        $user = $request->user();

        $coverage = match (true) {
            $user->role === User::ROLE_ADMIN_TPO => $this->coverageFromSubscription($user->college?->activeSubscription(), 'institution'),
            $user->role === User::ROLE_USER => $user->subscriptionCoverage(),
            default => ['source' => 'none', 'subscription' => null, 'plan' => null, 'days_remaining' => null, 'is_trial' => false],
        };

        $subscription = $coverage['subscription'];
        $plan = $coverage['plan'];
        $running = $subscription?->isActive() ?? false;

        $addons = $user->role === User::ROLE_USER
            ? $user->activeAddonSubscriptions()->map(fn (Subscription $s) => $s->id.':'.$s->current_period_end?->getTimestamp())->all()
            : [];

        $signature = substr(sha1(json_encode([
            $coverage['source'],
            $subscription?->id,
            $subscription?->status,
            $subscription?->current_period_end?->getTimestamp(),
            $running,
            $plan?->id,
            // Editing a plan's limits must reach people already on it.
            $plan?->updated_at?->getTimestamp(),
            $addons,
        ])), 0, 16);

        return response()->json([
            'signature' => $signature,
            // What the college has filed about this student (year, section). A separate marker, not part of the plan signature: a TPO
            // moving someone up a year is not a plan change and must never read as one.
            'academic_signature' => $user->role === User::ROLE_USER
                ? substr(sha1(json_encode([$user->college_id, $user->getRawOriginal('graduation_year'), $user->section])), 0, 16)
                : null,
            'source' => $coverage['source'],
            'plan' => $plan && $running ? ['code' => $plan->code, 'name' => $plan->name] : null,
            'days_remaining' => $running ? $coverage['days_remaining'] : null,
        ]);
    }

    /**
     * What a cart would cost this student right now — plan, add-ons, or both —
     * so the pricing page can show a live total. Read-only; the same
     * PurchaseQuoteService prices the real checkout (CheckoutService::begin).
     */
    public function quote(Request $request, PurchaseQuoteService $quotes)
    {
        $user = $request->user();

        abort_unless($user->role === User::ROLE_USER, 403, 'Only individual student accounts can purchase plans.');

        $validated = $request->validate([
            'plan_code' => ['nullable', 'string'],
            'addons' => ['nullable', 'array', 'max:5'],
            'addons.*' => ['string'],
        ]);

        return response()->json(['quote' => $quotes->quote($user, $validated['plan_code'] ?? null, $validated['addons'] ?? [])]);
    }

    private function coverageFromSubscription(?Subscription $subscription, string $sourceWhenActive): array
    {
        if ($subscription === null || ! $subscription->isActive()) {
            return ['source' => 'none', 'subscription' => null, 'plan' => null, 'days_remaining' => null, 'is_trial' => false];
        }

        return [
            'source' => $sourceWhenActive,
            'subscription' => $subscription,
            'plan' => $subscription->plan,
            'days_remaining' => $subscription->daysRemaining(),
            'is_trial' => $subscription->is_trial,
        ];
    }
}
