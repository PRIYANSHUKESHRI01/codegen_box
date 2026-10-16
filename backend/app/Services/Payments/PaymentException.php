<?php

namespace App\Services\Payments;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

/**
 * A checkout refusal the student can read: HTTP status + a stable machine
 * `code` (the frontend switches on it, never on the message), same shape as
 * PlanRequiredException. Extra fields (e.g. the fresh `quote` on a price change)
 * ride along in `context`.
 *
 * Gateway internals never reach the message — what the gateway said is logged,
 * and the student gets a sentence they can act on.
 */
class PaymentException extends RuntimeException
{
    public const PAYMENTS_UNAVAILABLE = 'payments_unavailable';

    public const GATEWAY_ERROR = 'gateway_error';

    public const PRICE_CHANGED = 'price_changed';

    public const ALREADY_COVERED = 'covered_by_institution';

    public const DOWNGRADE_BLOCKED = 'downgrade_blocked';

    public const NOTHING_TO_PAY = 'nothing_to_pay';

    public const ORDER_NOT_FOUND = 'order_not_found';

    public const SIGNATURE_INVALID = 'signature_invalid';

    public const PAYMENT_MISMATCH = 'payment_mismatch';

    public const PAYMENT_NOT_COMPLETE = 'payment_not_complete';

    public const PAYMENT_REFUNDED = 'payment_refunded';

    /** The gateway needs a mobile number for the bank's OTP and the receipt, and the student has none on file. */
    public const PHONE_REQUIRED = 'phone_required';

    public const EMAIL_UNSUPPORTED = 'email_unsupported';

    /** @param array<string, mixed> $context */
    public function __construct(
        string $message,
        public readonly string $errorCode,
        public readonly int $httpStatus = 422,
        public readonly array $context = [],
    ) {
        parent::__construct($message);
    }

    public static function unavailable(): self
    {
        return new self(
            'Online payments are not available right now. Please try again later or contact support.',
            self::PAYMENTS_UNAVAILABLE,
            503,
        );
    }

    public static function gateway(string $message = "We couldn't reach the payment gateway. You have not been charged — please try again in a moment."): self
    {
        return new self($message, self::GATEWAY_ERROR, 502);
    }

    public function render(Request $request): JsonResponse
    {
        return response()->json(['message' => $this->getMessage(), 'code' => $this->errorCode] + $this->context, $this->httpStatus);
    }

    /** Refusals the student causes or can fix are normal traffic; only the gateway/availability ones are worth a log line (and they are logged where they happen). */
    public function report(): bool
    {
        return true;
    }
}
