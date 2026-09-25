<?php

namespace App\Mail;

use App\Models\Company;
use App\Models\TalentPoolInquiry;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

/** "You've been hired" — dispatched by CompanyTalentPoolController::hire(). */
class TalentPoolHireOfferMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public User $user,
        public Company $company,
        public TalentPoolInquiry $inquiry,
    ) {}

    public function build(): self
    {
        return $this->subject("Congratulations! {$this->company->name} wants to hire you")
            ->view('emails.talent-pool-hire-offer');
    }
}
