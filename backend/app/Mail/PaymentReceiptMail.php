<?php

namespace App\Mail;

use App\Models\PaymentOrder;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

/** The receipt a student gets right after paying — see SendPaymentReceiptEmail. */
class PaymentReceiptMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public PaymentOrder $order,
    ) {}

    public function build(): self
    {
        return $this->subject("Payment received — {$this->order->description()} is active")
            ->view('emails.payment-receipt');
    }
}
