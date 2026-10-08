<?php

namespace App\Mail;

use App\Models\ContactRequest;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

/** Confirms receipt to whoever just submitted the "Talk to Our Team" form — sent regardless of whether a marketing employee was available to assign yet. */
class ContactRequestConfirmationMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public ContactRequest $contactRequest,
    ) {}

    public function build(): self
    {
        return $this->subject('We got your message — AptRun')
            ->view('emails.contact-request-confirmation');
    }
}
