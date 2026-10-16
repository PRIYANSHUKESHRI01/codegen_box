<?php

namespace App\Mail;

use App\Models\Company;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

/** A free-text note from a hiring partner — dispatched by CompanyVaultController::notify(). The only Vault email with company-authored body content, so it's rendered as a plain quoted block, never raw HTML. */
class VaultOutreachMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public User $user,
        public Company $company,
        public string $messageText,
    ) {}

    public function build(): self
    {
        return $this->subject("A message from {$this->company->name}")
            ->view('emails.vault-outreach');
    }
}
