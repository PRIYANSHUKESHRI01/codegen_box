<?php

namespace App\Mail;

use App\Models\Company;
use App\Models\VaultInquiry;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

/** "An HR interview has been scheduled" — dispatched by CompanyVaultController::scheduleInterview(). */
class VaultInterviewInviteMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public User $user,
        public Company $company,
        public VaultInquiry $inquiry,
    ) {}

    public function build(): self
    {
        return $this->subject("HR interview scheduled with {$this->company->name}")
            ->view('emails.vault-interview-invite');
    }
}
