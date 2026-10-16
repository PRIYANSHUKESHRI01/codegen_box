<?php

namespace App\Services\Payments;

use App\Models\PaymentOrder;
use App\Models\PaymentWebhookEvent;
use App\Services\Payments\Gateways\RazorpayGateway;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;
use Throwable;

/**
 * Acts on the events Razorpay posts to /api/webhooks/razorpay (the controller has
 * already verified the signature over the raw body). Subscribed events:
 *
 *   payment.authorized / payment.captured / order.paid   → settle the order (fulfil once)
 *   payment.failed                                       → remember why, order stays payable
 *   refund.processed                                     → record it; a full refund revokes the plan
 *
 * Three properties matter more than the individual handlers:
 *
 *   Idempotent.  Razorpay delivers at least once. Each event id is stored on first
 *                sight; a second delivery of a finished event is acknowledged and ignored.
 *   Re-reads.    Events can arrive out of order (`payment.captured` before
 *                `payment.authorized`), so for payments we ask Razorpay for the payment's
 *                CURRENT state instead of acting on what the event claimed.
 *   Retryable.   If handling throws, the event is marked failed and the exception
 *                propagates (HTTP 500) so Razorpay retries it later — the retry re-enters
 *                here and tries again. Anything that is NOT ours (the Razorpay account may
 *                also serve other products) is acknowledged quietly, never retried.
 */
class RazorpayWebhookHandler
{
    public function __construct(
        private readonly CheckoutService $checkout,
        private readonly RazorpayGateway $gateway,
    ) {}

    /**
     * @param  array<string, mixed>  $payload  the decoded event
     * @return 'processed'|'ignored'|'duplicate'
     *
     * @throws Throwable
     */
    public function handle(string $eventId, array $payload): string
    {
        $record = $this->claim($eventId, $payload);

        if (in_array($record->status, [PaymentWebhookEvent::STATUS_PROCESSED, PaymentWebhookEvent::STATUS_IGNORED], true)) {
            return 'duplicate';
        }

        try {
            $order = $this->dispatch((string) ($payload['event'] ?? ''), $payload);
        } catch (Throwable $e) {
            $record->update(['status' => PaymentWebhookEvent::STATUS_FAILED, 'error' => Str::limit($e->getMessage(), 1000, '')]);

            throw $e;
        }

        $record->update([
            'status' => $order === null ? PaymentWebhookEvent::STATUS_IGNORED : PaymentWebhookEvent::STATUS_PROCESSED,
            'payment_order_id' => $order?->id,
            'error' => null,
            'processed_at' => now(),
        ]);

        return $order === null ? 'ignored' : 'processed';
    }

    /** First sight of an event stores it; a repeat finds the stored row (and its outcome). */
    private function claim(string $eventId, array $payload): PaymentWebhookEvent
    {
        $attributes = ['gateway' => PaymentOrder::GATEWAY_RAZORPAY, 'event_id' => $eventId];

        $existing = PaymentWebhookEvent::where($attributes)->first();
        if ($existing !== null) {
            return $existing;
        }

        try {
            return PaymentWebhookEvent::create($attributes + [
                'event' => Str::limit((string) ($payload['event'] ?? 'unknown'), 60, ''),
                'status' => PaymentWebhookEvent::STATUS_RECEIVED,
                'payload' => $payload,
            ]);
        } catch (UniqueConstraintViolationException) {
            // The same event delivered twice at the same instant; the other request won the insert.
            return PaymentWebhookEvent::where($attributes)->firstOrFail();
        }
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return ?PaymentOrder the order the event concerned, null when it was not ours or not actionable
     *
     * @throws GatewayRequestException
     */
    private function dispatch(string $event, array $payload): ?PaymentOrder
    {
        return match ($event) {
            'payment.authorized', 'payment.captured', 'order.paid' => $this->onPayment($payload),
            'payment.failed' => $this->onPaymentFailed($payload),
            'refund.processed' => $this->onRefundProcessed($payload),
            default => null,
        };
    }

    private function onPayment(array $payload): ?PaymentOrder
    {
        $entity = $payload['payload']['payment']['entity'] ?? [];
        $order = $this->orderFor($entity['order_id'] ?? ($payload['payload']['order']['entity']['id'] ?? null));

        if ($order === null || empty($entity['id'])) {
            return null;
        }

        // The event told us a payment exists; Razorpay tells us what state it is in now.
        return $this->checkout->settleFromGateway($order, $this->gateway->fetchPayment($entity['id']));
    }

    private function onPaymentFailed(array $payload): ?PaymentOrder
    {
        $entity = $payload['payload']['payment']['entity'] ?? [];
        $order = $this->orderFor($entity['order_id'] ?? null);

        if ($order === null) {
            return null;
        }

        $this->checkout->recordFailure($order, $this->gateway->normalizePayment($entity));

        return $order;
    }

    private function onRefundProcessed(array $payload): ?PaymentOrder
    {
        $refund = $payload['payload']['refund']['entity'] ?? [];
        $paymentId = $refund['payment_id'] ?? ($payload['payload']['payment']['entity']['id'] ?? null);

        $order = $paymentId === null ? null : PaymentOrder::where('gateway', PaymentOrder::GATEWAY_RAZORPAY)->where('gateway_payment_id', $paymentId)->first();

        if ($order === null || empty($refund['id'])) {
            return null;
        }

        return $this->checkout->applyRefund($order, new GatewayRefund(
            (string) $refund['id'],
            (int) ($refund['amount'] ?? 0),
            Arr::get(is_array($refund['notes'] ?? null) ? $refund['notes'] : [], 'reason'),
        ));
    }

    /** Only Razorpay orders: an id that happens to look like one of ours but belongs to another gateway is not this webhook's business. */
    private function orderFor(?string $gatewayOrderId): ?PaymentOrder
    {
        return $gatewayOrderId === null ? null : PaymentOrder::where('gateway', PaymentOrder::GATEWAY_RAZORPAY)->where('gateway_order_id', $gatewayOrderId)->first();
    }
}
