<?php

namespace App\Services\Payments;

use App\Models\PaymentOrder;
use App\Models\PaymentWebhookEvent;
use App\Services\Payments\Gateways\PayuGateway;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Throwable;

/**
 * Acts on what PayU posts to /api/webhooks/payu (the controller has already checked the caller).
 * PayU sends three kinds of event, in two different wire formats:
 *
 *   payment   success / failure of a payment — form-encoded, SIGNED (same response hash as the return POST)
 *   refund    a refund reached its final status — JSON, UNSIGNED
 *   dispute   a chargeback was raised or moved on — JSON, UNSIGNED
 *
 * Because two of the three carry no signature, the rule is the same for all of them: the event only tells
 * us WHERE to look. What is believed — that a payment succeeded, for how much, that a refund went through —
 * is read back from PayU's own API (verify_payment / check_action_status), authenticated with the Salt.
 * A forged event can therefore at worst make us ask PayU a question.
 *
 *   Idempotent.  PayU may deliver an event more than once. Each event is stored under an id built from the
 *                fields that identify it; a second delivery of a finished event is acknowledged and ignored.
 *   Retryable.   If PayU's API cannot answer (or contradicts the event), the event is marked failed and the
 *                exception propagates (HTTP 500), so a retry — ours via reconcile, or PayU's — tries again.
 *                Anything that is NOT ours (the PayU account may serve other products) is acknowledged
 *                quietly, never retried.
 */
class PayuWebhookHandler
{
    public const PAYMENT = 'payment';

    public const REFUND = 'refund';

    public const DISPUTE = 'dispute';

    public function __construct(
        private readonly CheckoutService $checkout,
        private readonly PayuGateway $gateway,
        private readonly PayuClient $client,
    ) {}

    /**
     * @param  array<string, mixed>  $payload
     * @return 'processed'|'ignored'|'duplicate'
     *
     * @throws Throwable
     */
    public function handle(string $eventId, string $kind, array $payload): string
    {
        $record = $this->claim($eventId, $kind, $payload);

        if (in_array($record->status, [PaymentWebhookEvent::STATUS_PROCESSED, PaymentWebhookEvent::STATUS_IGNORED], true)) {
            return 'duplicate';
        }

        try {
            $order = match ($kind) {
                self::PAYMENT => $this->onPayment($payload),
                self::REFUND => $this->onRefund($payload),
                self::DISPUTE => $this->onDispute($payload),
                default => null,
            };
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

    /**
     * The id this event is stored (and de-duplicated) under. PayU sends no event id, so it is built from what
     * identifies the event: a payment's PayU id and verdict; a refund's id and status; a dispute's id and stage.
     * Two genuinely different events never share one, and a redelivery always does.
     *
     * @param  array<string, mixed>  $payload
     */
    public static function eventId(string $kind, array $payload): string
    {
        $lower = fn (string $key): string => strtolower(trim((string) ($payload[$key] ?? '')));

        [$subject, $state] = match ($kind) {
            self::PAYMENT => [trim((string) ($payload['mihpayid'] ?? $payload['txnid'] ?? '')), $lower('status').':'.$lower('unmappedstatus')],
            self::REFUND => [trim((string) ($payload['request_id'] ?? $payload['token'] ?? '')), $lower('status')],
            default => [trim((string) ($payload['cb_id'] ?? '')), $lower('cb_status')],
        };

        // A body without the field that identifies it must not collapse into one shared id with every other such body.
        if ($subject === '') {
            return 'raw:'.sha1((string) json_encode($payload));
        }

        return Str::limit("{$kind}:{$subject}:{$state}", 100, '');
    }

    /** First sight of an event stores it; a repeat finds the stored row (and its outcome). */
    private function claim(string $eventId, string $kind, array $payload): PaymentWebhookEvent
    {
        $attributes = ['gateway' => PaymentOrder::GATEWAY_PAYU, 'event_id' => $eventId];

        $existing = PaymentWebhookEvent::where($attributes)->first();
        if ($existing !== null) {
            return $existing;
        }

        try {
            return PaymentWebhookEvent::create($attributes + [
                'event' => Str::limit($kind.'.'.strtolower((string) ($payload['status'] ?? $payload['cb_status'] ?? 'event')), 60, ''),
                'status' => PaymentWebhookEvent::STATUS_RECEIVED,
                'payload' => $this->audit($kind, $payload),
            ]);
        } catch (UniqueConstraintViolationException) {
            // The same event delivered twice at the same instant; the other request won the insert.
            return PaymentWebhookEvent::where($attributes)->firstOrFail();
        }
    }

    /**
     * What is kept of an event for audit and dispute handling. A payment webhook carries the buyer's name,
     * email, phone, address and masked card — none of which is needed to answer "what did PayU tell us, and
     * when", so only the identifying and outcome fields are stored.
     *
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    private function audit(string $kind, array $payload): array
    {
        if ($kind !== self::PAYMENT) {
            return $payload;   // refund and dispute bodies hold ids, amounts and statuses only
        }

        return Arr::only($payload, [
            'mihpayid', 'mode', 'status', 'unmappedstatus', 'key', 'txnid', 'amount', 'net_amount_debit', 'discount',
            'addedon', 'productinfo', 'error', 'error_Message', 'PG_TYPE', 'bank_ref_num', 'bankcode', 'udf1',
        ]);
    }

    // ───────────────────────────── payment ─────────────────────────────

    /**
     * @param  array<string, mixed>  $payload
     *
     * @throws GatewayRequestException
     */
    private function onPayment(array $payload): ?PaymentOrder
    {
        $order = $this->orderByTxnid((string) ($payload['txnid'] ?? ''));

        if ($order === null) {
            return null;
        }

        // The event said a payment happened; PayU says what state it is in now (events can arrive late or twice).
        $payments = $this->gateway->paymentsFor($order);

        if ($payments === []) {
            throw new GatewayRequestException('PayU announced a payment for '.$order->public_id.' but its API does not know the transaction yet.');
        }

        return $this->checkout->settleFromGateway($order, $payments[0]);
    }

    // ───────────────────────────── refund ─────────────────────────────

    /**
     * @param  array<string, mixed>  $payload
     *
     * @throws GatewayRequestException
     */
    private function onRefund(array $payload): ?PaymentOrder
    {
        $mihpayid = trim((string) ($payload['mihpayid'] ?? ''));
        $requestId = trim((string) ($payload['request_id'] ?? ''));

        $order = $this->orderByTxnid((string) ($payload['merchantTxnId'] ?? ''))
            ?? ($mihpayid === '' ? null : PaymentOrder::where('gateway', PaymentOrder::GATEWAY_PAYU)->where('gateway_payment_id', $mihpayid)->first());

        if ($order === null || $requestId === '' || blank($order->gateway_payment_id)) {
            return null;
        }

        // The body is unsigned: look the refund up at PayU and use ITS status and amount, not the payload's.
        $action = $this->refundAction((string) $order->gateway_payment_id, $requestId);

        if ($action === null) {
            throw new GatewayRequestException("PayU does not list refund {$requestId} for {$order->public_id} yet.");
        }

        $status = strtolower(trim((string) ($action['status'] ?? '')));

        if ($status === 'success') {
            return $this->checkout->applyRefund($order, new GatewayRefund(
                $requestId,
                PayuClient::toPaise($action['amt'] ?? $payload['amt'] ?? 0),
                null,
            ));
        }

        if (in_array($status, ['failure', 'failed'], true)) {
            return $this->checkout->revertRefund($order, $requestId);
        }

        // PayU announces refunds at their final status; if its API still shows one as in flight, try again later.
        throw new GatewayRequestException("PayU reports refund {$requestId} as \"{$status}\" although it announced a final status.");
    }

    /** @return ?array<string, mixed> the `refund` action with this PayU request id, from PayU's own record of the payment */
    private function refundAction(string $mihpayid, string $requestId): ?array
    {
        foreach ($this->client->actionStatus($mihpayid) as $key => $row) {
            if (strtolower((string) ($row['action'] ?? '')) === 'refund'
                && ((string) ($row['request_id'] ?? $key) === $requestId || (string) $key === $requestId)) {
                return $row;
            }
        }

        return null;
    }

    // ───────────────────────────── dispute ─────────────────────────────

    /**
     * A chargeback. Nothing here can be decided automatically — whether to accept it or fight it, and with
     * what evidence, is a person's call with a due date — so it is written onto the order, where the
     * superadmin sees it, and logged as critical. Access is not touched.
     *
     * @param  array<string, mixed>  $payload
     */
    private function onDispute(array $payload): ?PaymentOrder
    {
        $mihpayid = trim((string) ($payload['txn_id'] ?? ''));

        $order = $mihpayid === '' ? null : PaymentOrder::where('gateway', PaymentOrder::GATEWAY_PAYU)->where('gateway_payment_id', $mihpayid)->first();

        if ($order === null) {
            return null;
        }

        $cbId = (string) ($payload['cb_id'] ?? 'unknown');
        $meta = $order->meta ?? [];
        $meta['disputes'][$cbId] = [
            'status' => (string) ($payload['cb_status'] ?? ''),
            'amount' => (string) ($payload['cb_amount'] ?? ''),
            'reason' => (string) ($payload['reason_code'] ?? ''),
            'due_date' => (string) ($payload['due_date'] ?? ''),
            'updated_at' => now()->toIso8601String(),
        ];

        $order->forceFill(['meta' => $meta])->save();

        Log::critical('PayU chargeback on a payment — a person must respond before the due date', [
            'order' => $order->public_id,
            'payment_id' => $order->gateway_payment_id,
            'chargeback' => $cbId,
            'status' => $payload['cb_status'] ?? null,
            'due_date' => $payload['due_date'] ?? null,
        ]);

        return $order;
    }

    private function orderByTxnid(string $txnid): ?PaymentOrder
    {
        $txnid = trim($txnid);

        return $txnid === '' ? null : PaymentOrder::where('gateway', PaymentOrder::GATEWAY_PAYU)->where('gateway_order_id', $txnid)->first();
    }
}
