<?php

namespace App\Mail;

use App\Models\NewsletterSubscriber;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

/** Confirms a footer newsletter signup — sent once, whether this is a first-time subscribe or a resubscribe. */
class NewsletterWelcomeMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public NewsletterSubscriber $subscriber,
    ) {}

    public function build(): self
    {
        return $this->subject("You're on the list — CodeGen Box")
            ->view('emails.newsletter-welcome');
    }
}
