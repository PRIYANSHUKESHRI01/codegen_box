<?php

namespace App\Services\Payments;

/**
 * One payment attempt as a gateway reports it, in a shape that does not care which gateway it was.
 *
 * Razorpay says "captured / authorized / failed" about a payment entity, PayU says
 * "success / failure / pending" about a transaction — and each spells its amounts, errors and ids
 * differently. Every gateway adapter turns what it was told into this, so CheckoutService (the one
 * place that decides whether a plan is handed over) has a single vocabulary and never learns what a
 * `mihpayid` or a `pay_xxx` is.
 *
 * Amounts are integer paise. `orderId` is OUR handle for the checkout as the gateway knows it
 * (`payment_orders.gateway_order_id`): a Razorpay order id, a PayU `txnid`.
 */
final class GatewayPayment
{
    /** Money has been taken and is ours. The only status that can buy a plan. */
    public const CAPTURED = 'captured';

    /** The bank approved it but the gateway has not captured it yet (Razorpay manual capture). */
    public const AUTHORIZED = 'authorized';

    /** This attempt is over and did not succeed (declined, timed out…). The order stays payable. */
    public const FAILED = 'failed';

    /** Nothing final: not paid yet, not failed either (initiated, in progress, abandoned, unknown to the gateway). */
    public const PENDING = 'pending';

    public function __construct(
        public readonly string $id,
        public readonly string $orderId,
        public readonly string $status,
        public readonly int $amountPaise,
        public readonly string $currency,
        public readonly ?string $method = null,
        public readonly ?int $feePaise = null,
        public readonly ?int $taxPaise = null,
        public readonly ?string $errorCode = null,
        public readonly ?string $errorDescription = null,
    ) {}

    public function isCaptured(): bool
    {
        return $this->status === self::CAPTURED;
    }

    public function isPaid(): bool
    {
        return in_array($this->status, [self::CAPTURED, self::AUTHORIZED], true);
    }

    public function isFailed(): bool
    {
        return $this->status === self::FAILED;
    }
}
