<?php

namespace App\Services;

use App\Models\Plan;
use App\Models\User;
use Illuminate\Validation\ValidationException;

/**
 * The one place a student's price is decided. Everything that charges — the
 * live total on the pricing page, POST /me/subscription, and (later) the
 * payment-gateway order — takes its amount from here, so the browser can
 * never be the source of a price.
 *
 * What a student can buy in one checkout: one base plan, any number of
 * add-ons, or both.
 *
 *   - A base plan is charged its SALE price: list_price minus the plan's own
 *     discount_percent, both set by the superadmin (Plan::salePrice()). The
 *     line carries the list price and the discount separately so the receipt,
 *     the audit trail and the pricing page all show the same "was / now".
 *   - An add-on is discounted by config billing.addon_bundle_discount_percent
 *     when the buyer ends up with a PAID base plan — either one in this cart
 *     or an in-date paid plan they already hold. No add-on is on sale today
 *     (Project Lab became part of Expert), but the mechanism is kept
 *     because the next add-on will want it.
 *
 * Pure of side effects: it reads plans and the buyer's subscription, writes
 * nothing, and is safe to call on every keystroke of the pricing toggle.
 */
class PurchaseQuoteService
{
    /**
     * @param  list<string>  $addonCodes
     * @return array{
     *   currency: string,
     *   lines: list<array{code: string, name: string, kind: string, list_price: int, discount: int, discount_percent: int, price: int, duration_days: ?int}>,
     *   subtotal: int,
     *   discount: int,
     *   total: int,
     *   bundle_applied: bool,
     * }
     *
     * @throws ValidationException on an empty cart, an unknown/inactive plan or a plan that isn't self-serve
     */
    public function quote(User $buyer, ?string $planCode, array $addonCodes = []): array
    {
        $addonCodes = array_values(array_unique(array_filter($addonCodes)));

        if ($planCode === null && $addonCodes === []) {
            throw ValidationException::withMessages(['plan_code' => ['Choose a plan or an add-on to purchase.']]);
        }

        $basePlan = $planCode !== null ? $this->resolve($planCode, Plan::KIND_BASE, 'plan_code') : null;

        $addons = [];
        foreach ($addonCodes as $code) {
            $addons[] = $this->resolve($code, Plan::KIND_ADDON, 'addons');
        }

        $buyerWillHavePaidBase = $basePlan !== null
            ? ! $basePlan->isFree()
            : $this->holdsPaidBasePlan($buyer);

        $percent = max(0, min(100, (int) config('billing.addon_bundle_discount_percent', 0)));

        $lines = [];

        if ($basePlan !== null) {
            $lines[] = $this->line($basePlan, $basePlan->listPrice(), $basePlan->discountAmount(), (int) $basePlan->discount_percent);
        }

        $bundleApplied = false;

        foreach ($addons as $addon) {
            $list = $addon->listPrice();
            $discount = $buyerWillHavePaidBase && $percent > 0 && $list > 0
                ? $list - (int) round($list * (100 - $percent) / 100)
                : 0;

            $bundleApplied = $bundleApplied || $discount > 0;
            $lines[] = $this->line($addon, $list, $discount, $discount > 0 ? $percent : 0);
        }

        $subtotal = array_sum(array_column($lines, 'list_price'));
        $discountTotal = array_sum(array_column($lines, 'discount'));

        return [
            'currency' => config('billing.currency', 'INR'),
            'lines' => $lines,
            'subtotal' => $subtotal,
            'discount' => $discountTotal,
            'total' => $subtotal - $discountTotal,
            'bundle_applied' => $bundleApplied,
        ];
    }

    private function resolve(string $code, string $kind, string $field): Plan
    {
        $plan = Plan::where('code', $code)->first();

        // One message for "doesn't exist", "inactive", "wrong audience/kind" and "sold by the team"
        // (Grandmaster / Mellow Academy): the caller can't tell which plans exist, and none of
        // these is something a student can fix except by choosing again. The contact-only check
        // comes before any price is read — a plan with no online price must never be bought at ₹0.
        if ($plan === null
            || ! $plan->is_active
            || $plan->audience !== Plan::AUDIENCE_INDIVIDUAL
            || ($plan->kind ?? Plan::KIND_BASE) !== $kind
            || $plan->isContactOnly()
            || $plan->list_price === null) {
            throw ValidationException::withMessages([$field => ['That option is not available for self-serve purchase.']]);
        }

        return $plan;
    }

    private function holdsPaidBasePlan(User $buyer): bool
    {
        $subscription = $buyer->activeSubscription();

        return $subscription !== null
            && $subscription->isActive()
            && $subscription->plan !== null
            && ! $subscription->plan->isFree();
    }

    /** @return array{code: string, name: string, kind: string, list_price: int, discount: int, discount_percent: int, price: int, duration_days: ?int} */
    private function line(Plan $plan, int $listPrice, int $discount, int $discountPercent): array
    {
        return [
            'code' => $plan->code,
            'name' => $plan->name,
            'kind' => $plan->kind ?? Plan::KIND_BASE,
            'list_price' => $listPrice,
            'discount' => $discount,
            'discount_percent' => $discountPercent,
            'price' => $listPrice - $discount,
            'duration_days' => $plan->duration_days,
        ];
    }
}
