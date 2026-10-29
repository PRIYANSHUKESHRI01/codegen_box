<?php

namespace App\Services;

use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use App\Services\Payments\CheckoutService;
use App\Services\Payments\PaymentException;
use Illuminate\Contracts\Cache\LockTimeoutException;
use Illuminate\Support\Facades\Cache;

/**
 * The free offer: a plan the superadmin has discounted by 100% is claimed with one click, never paid for.
 *
 * It is the other half of CheckoutService. Same server-side price (PurchaseQuoteService), same rules about who may
 * take a plan (college cover, no downgrade that wastes paid time), opposite money rule: CheckoutService refuses a
 * ₹0 cart (nothing_to_pay) and this refuses a cart above ₹0 (payment_required), so the two doors can never both
 * open for the same price, and a plan can never be activated for less than its price without the superadmin having
 * set that price to ₹0 on purpose.
 *
 * It needs no payment gateway — it must keep working while PayU's credentials are not set up.
 */
class OfferRedemptionService
{
    public function __construct(
        private readonly PurchaseQuoteService $quotes,
        private readonly CheckoutService $checkout,
        private readonly SubscriptionService $subscriptions,
    ) {}

    /**
     * @param  ?int  $expectedTotal  the total the student was looking at — 0 for a free offer. A mismatch is refused (409
     *                               price_changed), never silently honoured: they must see the new price first.
     *
     * @throws PaymentException
     */
    public function redeem(User $user, string $planCode, ?int $expectedTotal = null): Subscription
    {
        // The same lock a paid checkout takes: a double-click, two tabs, or a redeem racing a purchase run one at a time.
        $lock = Cache::lock('checkout:user:'.$user->id, 30);

        try {
            $lock->block(5);
        } catch (LockTimeoutException) {
            throw new PaymentException('Your request is still being processed. Please wait a few seconds and try again.', 'checkout_busy', 429);
        }

        try {
            // A plan that doesn't exist, is switched off or is sold by the team is refused here with the usual message.
            $quote = $this->quotes->quote($user, $planCode);

            if ($expectedTotal !== null && $expectedTotal !== $quote['total']) {
                throw new PaymentException(
                    'The price changed since you opened this page. Please review the new price.',
                    PaymentException::PRICE_CHANGED,
                    409,
                    ['quote' => $quote],
                );
            }

            if ($quote['total'] > 0) {
                throw new PaymentException(
                    'This plan is not free right now, so it has to be paid for.',
                    PaymentException::PAYMENT_REQUIRED,
                    409,
                    ['quote' => $quote],
                );
            }

            $plan = Plan::where('code', $planCode)->firstOrFail();

            // A ₹0 quote is also what the free Coder plan prices at: only a PRICED plan with its price discounted away is an offer.
            if (! $plan->isRedeemable()) {
                throw new PaymentException('There is no free offer on that plan.', PaymentException::OFFER_UNAVAILABLE, 422);
            }

            $this->checkout->assertAllowedToHold($user, $quote);

            return $this->subscriptions->redeemOffer($user, $plan);
        } finally {
            $lock->release();
        }
    }
}
