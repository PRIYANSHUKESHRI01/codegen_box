<?php

namespace App\Mail;

use App\Models\ContactRequest;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

/** Tells the marketing employee a "Talk to Our Team" inquiry was just assigned to them — see LeadAssignmentService::assignContactRequest(). */
class ContactRequestNotificationMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public ContactRequest $contactRequest,
    ) {}

    public function build(): self
    {
        return $this->subject("New inquiry assigned to you — {$this->contactRequest->organization_name}")
            ->view('emails.contact-request-notification');
    }
}
