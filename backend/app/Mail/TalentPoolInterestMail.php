<?php

namespace App\Mail;

use App\Models\Company;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

/** "A hiring partner is interested in you" — dispatched by CompanyTalentPoolController::expressInterest(). */
class TalentPoolInterestMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public User $user,
        public Company $company,
    ) {}

    public function build(): self
    {
        return $this->subject("{$this->company->name} is interested in your Talent Pool profile")
            ->view('emails.talent-pool-interest');
    }
}
