<?php

namespace App\Services\Payments;

/**
 * A refund as a gateway reports it — Razorpay's refund entity, PayU's refund request — reduced to
 * what CheckoutService records: the gateway's id for it (the key that makes a re-delivered event a
 * no-op), how much went back, and why.
 */
final class GatewayRefund
{
    public function __construct(
        public readonly string $id,
        public readonly int $amountPaise,
        public readonly ?string $reason = null,
    ) {}
}
