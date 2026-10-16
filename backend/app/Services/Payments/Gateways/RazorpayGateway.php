<?php

namespace App\Services\Payments\Gateways;

use App\Models\PaymentOrder;
use App\Models\User;
use App\Services\Payments\Contracts\PaymentGateway;
use App\Services\Payments\GatewayPayment;
use App\Services\Payments\GatewayRefund;
use App\Services\Payments\GatewayRequestException;
use App\Services\Payments\RazorpayClient;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Razorpay Standard Checkout on the Orders API, behind the common gateway contract.
 *
 * All of the behaviour here is what CheckoutService used to do inline for Razorpay — moved, not
 * changed: the order Razorpay creates is checked against what we asked for before a student is sent
 * to it, an `authorized` payment is captured (with "already captured" read as success), the browser
 * is handed the `new Razorpay(options)` object. Razorpay's own wire format (HTTP Basic, HMAC
 * signatures) stays in RazorpayClient.
 *
 * The parts of Razorpay that have no equivalent elsewhere — the signed browser callback and the
 * signed webhook — are exposed here as plain delegating methods for CheckoutService::confirm() and
 * RazorpayWebhookHandler.
 */
class RazorpayGateway implements PaymentGateway
{
    public function __construct(private readonly RazorpayClient $client) {}

    public function code(): string
    {
        return PaymentOrder::GATEWAY_RAZORPAY;
    }

    public function label(): string
    {
        return 'Razorpay';
    }

    public function isConfigured(): bool
    {
        return $this->client->isConfigured();
    }

    public function isWebhookConfigured(): bool
    {
        return $this->client->isWebhookConfigured();
    }

    public function mode(): string
    {
        return $this->client->mode();
    }

    public function credentialsId(): string
    {
        return $this->client->keyId();
    }

    public function reusesOpenOrders(): bool
    {
        return true;
    }

    public function expireAfterMinutes(): int
    {
        return (int) config('billing.expire_after_hours', 24) * 60;
    }

    public function prepareBuyer(User $user, array $input): array
    {
        return [];
    }

    public function openOrder(int $amountPaise, string $currency, string $publicId, array $notes = []): array
    {
        $remote = $this->client->createOrder($amountPaise, $currency, $publicId, $notes);

        // Belt and braces: never open Checkout against an order that is not exactly what we asked for.
        if (($remote['id'] ?? '') === '' || (int) ($remote['amount'] ?? -1) !== $amountPaise || ($remote['currency'] ?? '') !== $currency) {
            Log::error('Razorpay returned an order that does not match the request', ['expected_paise' => $amountPaise, 'receipt' => $publicId]);

            throw new GatewayRequestException('Razorpay returned an order that does not match the request.');
        }

        return ['id' => (string) $remote['id']];
    }

    /**
     * The options object `new Razorpay(options)` needs — assembled here so the browser is handed exactly
     * what the server priced and nothing it could alter to its advantage (a changed amount in the browser
     * would simply fail at Razorpay, which holds the real one).
     */
    public function checkoutPayload(PaymentOrder $order, User $user): array
    {
        $phone = preg_replace('/[^\d+]/', '', (string) $user->phone);

        return [
            'gateway' => $this->code(),
            'key' => $this->client->keyId(),
            'order_id' => $order->gateway_order_id,
            'amount' => $order->amount_paise,
            'currency' => $order->currency,
            'name' => (string) config('billing.razorpay.merchant_name', 'AptRun'),
            'description' => $order->description().' · '.$order->termLabel(),
            'theme_color' => (string) config('billing.razorpay.theme_color', '#4F46E5'),
            'prefill' => array_filter([
                'name' => $user->name,
                'email' => $user->email,
                // Checkout wants +<country code><number>; a bare 10-digit Indian number gets +91.
                'contact' => preg_match('/^\+?\d{10,14}$/', $phone) ? (str_starts_with($phone, '+') ? $phone : (strlen($phone) === 10 ? '+91'.$phone : '+'.$phone)) : null,
            ]),
            'reference' => $order->public_id,
            'test_mode' => $order->gateway_mode !== 'live',
        ];
    }

    public function paymentsFor(PaymentOrder $order): array
    {
        return array_map(
            fn (array $payment) => $this->normalizePayment($payment),
            $this->client->fetchOrderPayments($order->gateway_order_id),
        );
    }

    /**
     * Only needed when the Razorpay account is on manual capture; with the default automatic capture a
     * payment is already `captured` when we see it. A capture refused only because it already happened
     * (automatic capture got there first, or another of our reporters did) is read back, not failed.
     */
    public function capture(GatewayPayment $payment): GatewayPayment
    {
        if ($payment->status !== GatewayPayment::AUTHORIZED) {
            return $payment;
        }

        try {
            return $this->normalizePayment($this->client->capturePayment($payment->id, $payment->amountPaise, $payment->currency));
        } catch (GatewayRequestException $e) {
            if (! $e->isAlreadyDone()) {
                throw $e;
            }

            return $this->fetchPayment($payment->id);
        }
    }

    public function refund(PaymentOrder $order, ?int $amountPaise, string $reason): GatewayRefund
    {
        $refund = $this->client->refundPayment(
            (string) $order->gateway_payment_id,
            $amountPaise,
            ['reason' => Str::limit($reason, 250, ''), 'purchase_ref' => $order->public_id],
        );

        return new GatewayRefund((string) ($refund['id'] ?? ''), (int) ($refund['amount'] ?? $order->amount_paise), $reason);
    }

    public function normalizePayment(array $raw): GatewayPayment
    {
        $status = match ($raw['status'] ?? null) {
            'captured' => GatewayPayment::CAPTURED,
            'authorized' => GatewayPayment::AUTHORIZED,
            'failed' => GatewayPayment::FAILED,
            default => GatewayPayment::PENDING,
        };

        return new GatewayPayment(
            id: (string) ($raw['id'] ?? ''),
            orderId: (string) ($raw['order_id'] ?? ''),
            status: $status,
            amountPaise: (int) ($raw['amount'] ?? -1),
            currency: strtoupper((string) ($raw['currency'] ?? '')),
            method: isset($raw['method']) ? (string) $raw['method'] : null,
            feePaise: isset($raw['fee']) ? (int) $raw['fee'] : null,
            taxPaise: isset($raw['tax']) ? (int) $raw['tax'] : null,
            errorCode: isset($raw['error_code']) ? (string) $raw['error_code'] : null,
            errorDescription: isset($raw['error_description']) ? (string) $raw['error_description'] : null,
        );
    }

    // ───────────────────────────── Razorpay-only entry points ─────────────────────────────

    /** @throws GatewayRequestException */
    public function fetchPayment(string $paymentId): GatewayPayment
    {
        return $this->normalizePayment($this->client->fetchPayment($paymentId));
    }

    public function verifyPaymentSignature(string $orderId, string $paymentId, string $signature): bool
    {
        return $this->client->verifyPaymentSignature($orderId, $paymentId, $signature);
    }

    public function verifyWebhookSignature(string $rawBody, ?string $signature): bool
    {
        return $this->client->verifyWebhookSignature($rawBody, $signature);
    }
}
