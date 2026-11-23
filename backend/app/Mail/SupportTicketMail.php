<?php

namespace App\Mail;

use App\Models\SupportTicket;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class SupportTicketMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public SupportTicket $ticket
    ) {}

    public function build(): self
    {
        $fromAddress = config('mail.from.address', 'support@mellowvault.com');
        $fromName = config('mail.from.name', 'AptRun Support');

        return $this->subject("[AptBot Support] Ticket #{$this->ticket->ticket_number} — {$this->ticket->subject}")
            ->from($fromAddress, $fromName)
            ->replyTo($this->ticket->email, $this->ticket->name)
            ->view('emails.support-ticket');
    }
}
