<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

/**
 * Plain welcome/confirmation email for a self-registered ("Mellow Direct")
 * account — structurally different from AccountCredentialsMail, since the
 * user already picked their own password and there's nothing to deliver.
 */
class WelcomeMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public User $user,
    ) {}

    public function build(): self
    {
        return $this->subject('Welcome to AptRun')
            ->view('emails.welcome');
    }
}
