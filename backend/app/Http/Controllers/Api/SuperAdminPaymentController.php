<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\PaymentOrder;
use App\Models\PaymentWebhookEvent;
use App\Services\Payments\CheckoutService;
use App\Services\Payments\GatewayManager;
use App\Services\Payments\GatewayRequestException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Superadmin → Payments: every plan purchase, what it is worth, and the ones that
 * need a person (money taken but the plan not handed over). Read-only apart from
 * "re-check", which asks the order's own gateway (PayU or Razorpay) again and fulfils if
 * it finds a payment. Refunds are issued from the gateway's dashboard — its refund webhook
 * then brings the order, and the student's access, in line (CheckoutService::applyRefund).
 *
 * Orders of every gateway share one list; the summary adds up one MODE (test or live) of
 * whatever gateway(s) were used in it, because test money must never be counted as revenue.
 */
class SuperAdminPaymentController extends Controller
{
    private const STATUSES = [
        PaymentOrder::STATUS_CREATED,
        PaymentOrder::STATUS_PAID,
        PaymentOrder::STATUS_EXPIRED,
        PaymentOrder::STATUS_PARTIALLY_REFUNDED,
        PaymentOrder::STATUS_REFUNDED,
        PaymentOrder::STATUS_NEEDS_REVIEW,
    ];

    private const PAID_STATUSES = [
        PaymentOrder::STATUS_PAID,
        PaymentOrder::STATUS_PARTIALLY_REFUNDED,
        PaymentOrder::STATUS_REFUNDED,
    ];

    public function index(Request $request, GatewayManager $gateways): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['nullable', 'string', 'in:'.implode(',', self::STATUSES)],
            'mode' => ['nullable', 'string', 'in:test,live'],
            'gateway' => ['nullable', 'string', 'in:'.implode(',', array_keys($gateways->all()))],
            'q' => ['nullable', 'string', 'max:100'],
        ]);

        // The gateway new checkouts go to. Null when PAYMENT_GATEWAY names something unknown (payments are off).
        $active = $gateways->active();

        // Test-mode money and live-mode money are never added together; the screen shows the mode the keys are in.
        $mode = $validated['mode'] ?? $active?->mode() ?? 'test';

        $base = PaymentOrder::where('gateway_mode', $mode)
            ->when($validated['gateway'] ?? null, fn ($q, $code) => $q->where('gateway', $code));

        $rows = (clone $base)
            ->when($validated['status'] ?? null, fn ($q, $status) => $q->where('status', $status))
            ->when($validated['q'] ?? null, function ($q, $term) {
                $like = '%'.str_replace(['%', '_'], ['\%', '\_'], $term).'%';
                $q->where(fn ($w) => $w->where('payer_email', 'like', $like)
                    ->orWhere('payer_name', 'like', $like)
                    ->orWhere('public_id', 'like', $like)
                    ->orWhere('gateway_order_id', 'like', $like)
                    ->orWhere('gateway_payment_id', 'like', $like));
            })
            ->latest('id')
            ->paginate(25);

        $paid = (clone $base)->whereIn('status', self::PAID_STATUSES);

        return response()->json([
            'mode' => $mode,
            'gateway' => $active?->code(),
            'gateway_name' => $active?->label(),
            'configured' => $active?->isConfigured() ?? false,
            'webhook_configured' => $active?->isWebhookConfigured() ?? false,
            // When the active gateway last pushed us anything. A gateway whose webhook was never set up in its
            // dashboard cannot be told apart from a quiet one by credentials alone — silence is the signal.
            'last_webhook_at' => $active === null ? null : PaymentWebhookEvent::where('gateway', $active->code())->latest('id')->value('created_at'),
            'summary' => [
                'gross' => intdiv((int) (clone $paid)->sum('amount_paise'), 100),
                'refunded' => intdiv((int) (clone $paid)->sum('refunded_paise'), 100),
                'net' => intdiv((int) (clone $paid)->sum('amount_paise') - (int) (clone $paid)->sum('refunded_paise'), 100),
                'last_30_days' => intdiv((int) (clone $paid)->where('paid_at', '>=', now()->subDays(30))->sum('amount_paise'), 100),
                'orders_paid' => (clone $paid)->count(),
                'needs_review' => (clone $base)->where('status', PaymentOrder::STATUS_NEEDS_REVIEW)->count(),
            ],
            'payments' => $rows->getCollection()->map(fn (PaymentOrder $o) => $this->row($o))->values(),
            'pagination' => [
                'current_page' => $rows->currentPage(),
                'last_page' => $rows->lastPage(),
                'total' => $rows->total(),
            ],
        ]);
    }

    public function reconcile(Request $request, PaymentOrder $payment, CheckoutService $checkout, GatewayManager $gateways): JsonResponse
    {
        $label = $this->gatewayLabel($gateways, $payment);

        try {
            $before = $payment->status;
            $payment = $checkout->reconcile($payment);
        } catch (GatewayRequestException) {
            return response()->json(['message' => "{$label} could not be reached. Try again in a moment.", 'code' => 'gateway_error'], 502);
        }

        ActivityLog::record($request->user(), "Re-checked a payment with {$label}", 'Payment', $payment->public_id, [
            'status_before' => $before,
            'status_after' => $payment->status,
        ]);

        return response()->json(['payment' => $this->row($payment->refresh())]);
    }

    /** @return array<string, mixed> */
    private function row(PaymentOrder $order): array
    {
        // array_merge, not +: the raw failure_reason must win over the student-facing one in the receipt shape.
        return array_merge($order->toReceipt(), [
            'raw_status' => $order->status,
            'payer_name' => $order->payer_name,
            'payer_email' => $order->payer_email,
            'user_id' => $order->user_id,
            'gateway' => $order->gateway,
            'gateway_order_id' => $order->gateway_order_id,
            // Chargebacks PayU has reported against this payment — a person must respond before each due date.
            'disputes' => $order->meta['disputes'] ?? null,
            'attempts' => $order->attempts,
            'failure_code' => $order->failure_code,
            'failure_reason' => $order->failure_reason,
            'refund_reason' => $order->refund_reason,
            'fulfilled_at' => $order->fulfilled_at,
        ]);
    }

    /** "PayU" / "Razorpay" — an order whose gateway is no longer known still gets a readable name. */
    private function gatewayLabel(GatewayManager $gateways, PaymentOrder $order): string
    {
        try {
            return $gateways->forOrder($order)->label();
        } catch (GatewayRequestException) {
            return ucfirst((string) $order->gateway) ?: 'The payment gateway';
        }
    }
}
