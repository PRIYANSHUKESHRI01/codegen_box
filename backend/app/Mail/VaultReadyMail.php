<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

/**
 * "Your readiness reached the Vault line" — sent once, the first time a
 * student's score reaches it (VaultService::applyReadiness()). It is the ask for
 * consent, not a notice that anything was shared: nothing leaves AptRun until the
 * student says yes on the Vault page (VaultProfile's `pending_consent`).
 */
class VaultReadyMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public User $user,
        public int $score,
        public int $threshold,
        public bool $alreadyConsented = false,
    ) {}

    public function build(): self
    {
        return $this->subject("Your readiness score is {$this->score} — you're ready for the Vault")
            ->view('emails.vault-ready');
    }
}
