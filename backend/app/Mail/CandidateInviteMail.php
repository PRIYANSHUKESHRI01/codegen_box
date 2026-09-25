<?php

namespace App\Mail;

use App\Models\Company;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

/**
 * "You've been added to a hiring pipeline" notice for a candidate who
 * ALREADY has an account — deliberately separate from AccountCredentialsMail,
 * which carries a fresh one-time password. Reusing that unconditionally here
 * would mean issuing a new password to a live account just because it got
 * invited to a job opening, a real security/UX smell. No password, just a
 * sign-in link.
 */
class CandidateInviteMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public User $user,
        public Company $company,
        public string $roleTitle,
    ) {}

    public function build(): self
    {
        return $this->subject("You've been added to a hiring pipeline — {$this->company->name}")
            ->view('emails.candidate-invite');
    }
}
