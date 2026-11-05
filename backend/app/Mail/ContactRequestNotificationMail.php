<?php

namespace App\Mail;

use App\Models\ContactRequest;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

/**
 * A "Talk to Our Team" enquiry, told to the marketing side. Two audiences, one layout:
 *  - the employee it was just assigned to (LeadAssignmentService::assignContactRequest), and
 *  - the team's shared inbox ($forTeam, SendContactRequestTeamCopy), which also hears of enquiries nobody has picked up yet.
 * Reply-To is the enquirer, so pressing Reply in the mail client answers them rather than our own support address.
 */
class ContactRequestNotificationMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public ContactRequest $contactRequest,
        public bool $forTeam = false,
    ) {}

    public function build(): self
    {
        $subject = $this->forTeam
            ? "New enquiry — {$this->contactRequest->organization_name} ({$this->contactRequest->audienceLabel()})"
            : "New inquiry assigned to you — {$this->contactRequest->organization_name}";

        return $this->subject($subject)
            ->replyTo($this->contactRequest->email, $this->contactRequest->name)
            ->view('emails.contact-request-notification');
    }
}
