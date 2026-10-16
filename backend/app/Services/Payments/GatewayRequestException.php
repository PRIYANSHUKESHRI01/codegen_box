<?php

namespace App\Services\Payments;

use RuntimeException;

/**
 * A payment gateway (Razorpay, PayU) answered with an error, or could not be reached. Carries what the
 * gateway said for the logs and for the few branches that need it (e.g. "this
 * payment has already been captured" is success for our purposes). It is never
 * shown to a student — CheckoutService turns it into a PaymentException.
 */
class GatewayRequestException extends RuntimeException
{
    public function __construct(
        string $message,
        public readonly ?int $httpStatus = null,
        public readonly ?string $gatewayCode = null,
        public readonly ?string $gatewayDescription = null,
    ) {
        parent::__construct($message);
    }

    /** A capture/refund the gateway refused only because it had already happened. */
    public function isAlreadyDone(): bool
    {
        $text = strtolower((string) $this->gatewayDescription);

        return str_contains($text, 'already been captured')
            || str_contains($text, 'already captured')
            || str_contains($text, 'already been fully refunded')
            || str_contains($text, 'fully refunded')
            // PayU: every refund request carries a token that must be new. Ours is stable per order, so
            // "token already used" means this very refund was already asked for — by an earlier attempt
            // whose answer we never saw.
            || str_contains($text, 'token already used');
    }

    /** The request never got an answer (DNS, TLS, timeout) — worth retrying later, nothing is known about its effect. */
    public function isUnreachable(): bool
    {
        return $this->httpStatus === null;
    }
}
