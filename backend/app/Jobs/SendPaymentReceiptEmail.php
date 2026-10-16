<?php

namespace App\Jobs;

use App\Mail\PaymentReceiptMail;
use App\Models\PaymentOrder;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Facades\Mail;

/**
 * "Payment received — your plan is active", sent once when a purchase is fulfilled
 * (Payments\CheckoutService::fulfil). One action, one recipient, so it goes out through
 * SingleMail::afterResponse — it must arrive on a server with no queue worker — and this
 * class is only handed to the queue as the retry path if that send fails.
 *
 * Razorpay also emails its own receipt if that is switched on in the Dashboard; this one
 * says what the student cares about: which plan, until when, and what to do next.
 */
class SendPaymentReceiptEmail implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable;

    public int $tries = 3;

    public function __construct(
        public int $paymentOrderId,
    ) {}

    public function backoff(): array
    {
        return [10, 30, 60];
    }

    public function handle(): void
    {
        $order = PaymentOrder::with('user')->find($this->paymentOrderId);

        // Refunded (or never really paid) in the meantime: a receipt would be wrong.
        if ($order === null || $order->user === null || $order->status !== PaymentOrder::STATUS_PAID) {
            return;
        }

        Mail::to($order->user->email)->send(new PaymentReceiptMail($order));
    }
}
