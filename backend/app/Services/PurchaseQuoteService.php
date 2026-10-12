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
 * add-ons, or both. Add-ons are discounted (config billing.addon_bundle_
 * discount_percent) when the buyer ends up with a PAID base plan — either one
 * in this cart or an in-date paid plan they already hold. A free Coder
 * student buying Project Lab alone pays the full add-on price.
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
     *   lines: list<array{code: string, name: string, kind: string, list_price: int, discount: int, price: int, duration_days: ?int}>,
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
            $lines[] = $this->line($basePlan, (int) $basePlan->monthly_price, 0);
        }

        $bundleApplied = false;

        foreach ($addons as $addon) {
            $list = (int) $addon->monthly_price;
            $discount = $buyerWillHavePaidBase && $percent > 0 && $list > 0
                ? $list - (int) round($list * (100 - $percent) / 100)
                : 0;

            $bundleApplied = $bundleApplied || $discount > 0;
            $lines[] = $this->line($addon, $list, $discount);
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

        // One message for "doesn't exist", "inactive" and "wrong audience/kind":
        // the caller can't tell which plans exist, and none of the three is
        // something a student can fix except by choosing again.
        if ($plan === null
            || ! $plan->is_active
            || $plan->audience !== Plan::AUDIENCE_INDIVIDUAL
            || ($plan->kind ?? Plan::KIND_BASE) !== $kind
            || $plan->monthly_price === null) {
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

    /** @return array{code: string, name: string, kind: string, list_price: int, discount: int, price: int, duration_days: ?int} */
    private function line(Plan $plan, int $listPrice, int $discount): array
    {
        return [
            'code' => $plan->code,
            'name' => $plan->name,
            'kind' => $plan->kind ?? Plan::KIND_BASE,
            'list_price' => $listPrice,
            'discount' => $discount,
            'price' => $listPrice - $discount,
            'duration_days' => $plan->duration_days,
        ];
    }
}
