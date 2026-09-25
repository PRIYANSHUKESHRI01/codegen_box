<?php

namespace App\Mail;

use App\Models\TalentPoolInquiry;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

/** Notifies the recruiter who scheduled the interview whether the candidate accepted or declined — dispatched by StudentTalentPoolController::respondToInterview(). */
class TalentPoolInterviewResponseMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public User $recruiter,
        public TalentPoolInquiry $inquiry,
        public string $decision,
    ) {}

    public function build(): self
    {
        $candidateName = $this->inquiry->candidate->user->name ?? 'The candidate';
        $verb = $this->decision === 'decline' ? 'declined' : 'confirmed';

        return $this->subject("{$candidateName} {$verb} your HR interview invite")
            ->view('emails.talent-pool-interview-response');
    }
}
