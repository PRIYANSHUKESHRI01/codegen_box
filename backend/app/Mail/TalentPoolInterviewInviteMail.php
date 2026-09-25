<?php

namespace App\Mail;

use App\Models\Company;
use App\Models\TalentPoolInquiry;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

/** "An HR interview has been scheduled" — dispatched by CompanyTalentPoolController::scheduleInterview(). */
class TalentPoolInterviewInviteMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public User $user,
        public Company $company,
        public TalentPoolInquiry $inquiry,
    ) {}

    public function build(): self
    {
        return $this->subject("HR interview scheduled with {$this->company->name}")
            ->view('emails.talent-pool-interview-invite');
    }
}
