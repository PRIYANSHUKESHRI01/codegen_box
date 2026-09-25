<?php

namespace App\Mail;

use App\Models\Company;
use App\Models\Interview;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

/**
 * "You've been shortlisted for an interview" notice — dispatched by
 * CompanyInterviewController::inviteCandidates() once a candidate is added
 * to an interview's session list. Mirrors CandidateInviteMail's shape (an
 * already-existing account, no fresh password) — see that class's docblock.
 */
class InterviewShortlistMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public User $user,
        public Company $company,
        public Interview $interview,
    ) {}

    public function build(): self
    {
        $roleTitle = $this->interview->placementDrive?->role_title ?? 'the role';

        return $this->subject("You've been shortlisted for an interview — {$this->company->name}")
            ->view('emails.interview-shortlist')
            ->with(['roleTitle' => $roleTitle]);
    }
}
