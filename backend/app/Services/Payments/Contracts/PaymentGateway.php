<?php

namespace App\Services\Payments\Contracts;

use App\Models\PaymentOrder;
use App\Models\User;
use App\Services\Payments\GatewayPayment;
use App\Services\Payments\GatewayRefund;
use App\Services\Payments\GatewayRequestException;
use App\Services\Payments\PaymentException;

/**
 * What CheckoutService needs from a payment gateway, and nothing it does not.
 *
 * The lifecycle of a purchase — price it, open an order, believe a payment only once the gateway
 * itself says so, hand the plan over exactly once, refund, reconcile — is the same whichever
 * gateway takes the money, so it lives once, in CheckoutService. What differs is how a gateway is
 * talked to and how a buyer is handed to it (Razorpay opens a modal over our page; PayU takes the
 * browser to its own), and that is all this interface covers.
 *
 * Gateway-specific entry points that are NOT here (Razorpay's signed browser callback, PayU's
 * return POST and hash-signed webhooks) live on the concrete gateway and its own controller; they
 * all end in CheckoutService::settleFromGateway() with a GatewayPayment.
 */
interface PaymentGateway
{
    /** The value stored in `payment_orders.gateway` and used in `PAYMENT_GATEWAY`: `payu`, `razorpay`. */
    public function code(): string;

    /** What a person calls it: "PayU", "Razorpay". */
    public function label(): string;

    /** Credentials present. When false nobody can pay and the UI says "payments launching soon". */
    public function isConfigured(): bool;

    /** Whether events pushed by the gateway can be authenticated here. */
    public function isWebhookConfigured(): bool;

    /** `test` or `live`. Money in the two is never added together. */
    public function mode(): string;

    /** Identifies the credentials an order was opened under, so an order is never handed back under other ones. */
    public function credentialsId(): string;

    /** Whether a student who comes back to an unpaid checkout is given the same order again (Razorpay) or a new one (PayU). */
    public function reusesOpenOrders(): bool;

    /** Minutes an unpaid order is chased before it is closed as `expired` (a late payment is still honoured). */
    public function expireAfterMinutes(): int;

    /**
     * Checks what the gateway needs to know about the buyer and returns whatever must be kept on the order
     * (e.g. the phone number PayU requires). Refuses with a PaymentException a student can act on.
     *
     * @param  array<string, mixed>  $input  extra fields the buyer sent with the checkout request
     * @return array<string, mixed>
     *
     * @throws PaymentException
     */
    public function prepareBuyer(User $user, array $input): array;

    /**
     * Opens the gateway side of a checkout for exactly this amount. `publicId` is our reference for it.
     *
     * @param  array<string, string>  $notes
     * @return array{id: string, meta?: array<string, mixed>} `id` becomes `payment_orders.gateway_order_id`
     *
     * @throws GatewayRequestException
     */
    public function openOrder(int $amountPaise, string $currency, string $publicId, array $notes = []): array;

    /**
     * What the browser needs to take the payment — assembled by the server from its own price, so the
     * browser is handed nothing it could alter to its advantage. Always carries `gateway`.
     *
     * @return array<string, mixed>
     */
    public function checkoutPayload(PaymentOrder $order, User $user): array;

    /**
     * Every payment attempt the gateway knows for this order (usually none or one).
     *
     * @return list<GatewayPayment>
     *
     * @throws GatewayRequestException
     */
    public function paymentsFor(PaymentOrder $order): array;

    /**
     * Turns an authorized payment into a captured one. Gateways that capture on their own return it unchanged.
     *
     * @throws GatewayRequestException
     */
    public function capture(GatewayPayment $payment): GatewayPayment;

    /**
     * Refunds a paid order — in full when `$amountPaise` is null.
     *
     * @throws GatewayRequestException
     */
    public function refund(PaymentOrder $order, ?int $amountPaise, string $reason): GatewayRefund;

    /**
     * A payment entity exactly as the gateway sent it (an API answer, a webhook body) as a GatewayPayment.
     *
     * @param  array<string, mixed>  $raw
     */
    public function normalizePayment(array $raw): GatewayPayment;
}
