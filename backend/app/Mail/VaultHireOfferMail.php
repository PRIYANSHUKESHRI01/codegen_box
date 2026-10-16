<?php

namespace App\Mail;

use App\Models\Company;
use App\Models\VaultInquiry;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

/** "You've been hired" — dispatched by CompanyVaultController::hire(). */
class VaultHireOfferMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public User $user,
        public Company $company,
        public VaultInquiry $inquiry,
    ) {}

    public function build(): self
    {
        return $this->subject("Congratulations! {$this->company->name} wants to hire you")
            ->view('emails.vault-hire-offer');
    }
}
