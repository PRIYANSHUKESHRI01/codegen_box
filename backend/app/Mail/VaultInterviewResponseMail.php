<?php

namespace App\Mail;

use App\Models\VaultInquiry;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

/** Notifies the recruiter who scheduled the interview whether the candidate accepted or declined — dispatched by StudentVaultController::respondToInterview(). */
class VaultInterviewResponseMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public User $recruiter,
        public VaultInquiry $inquiry,
        public string $decision,
    ) {}

    public function build(): self
    {
        $candidateName = $this->inquiry->profile->user->name ?? 'The candidate';
        $verb = $this->decision === 'decline' ? 'declined' : 'confirmed';

        return $this->subject("{$candidateName} {$verb} your HR interview invite")
            ->view('emails.vault-interview-response');
    }
}
