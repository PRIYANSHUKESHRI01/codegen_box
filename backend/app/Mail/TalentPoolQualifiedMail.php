<?php

namespace App\Mail;

use App\Models\Contest;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

/**
 * "You qualified for the Mellow Talent Pool" — dispatched by
 * TalentPoolQualificationService the first time a candidate ever clears a
 * talent_pool assessment's threshold. Deliberately the ask-for-consent
 * moment, not an auto-publish notice — see TalentPoolCandidate::
 * STATUS_PENDING_CONSENT.
 */
class TalentPoolQualifiedMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public User $user,
        public Contest $contest,
        public float $scorePercent,
    ) {}

    public function build(): self
    {
        return $this->subject("You qualified for the Mellow Talent Pool ({$this->scorePercent}%)")
            ->view('emails.talent-pool-qualified');
    }
}
