<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

/**
 * Sent once when a Mellow Vault developer's `profile_complete` reaches >= 90%.
 * Carries their resolved tech stack (from `higher_professional_tb` via `pro_id` or profile skills)
 * and a 1-click signed link straight into their Vault AI Interview track on AptRun.
 */
class VaultStackInterviewInviteMail extends Mailable
{
    use Queueable, SerializesModels;

    /** @param list<string> $roundTitles */
    public function __construct(
        public User $user,
        public int $profilePercent,
        public ?string $stackName,
        public ?string $rawHeading,
        public string $interviewUrl,
        public ?string $unsubscribeUrl = null,
        public ?string $roleTitle = null,
        public ?string $stackBlurb = null,
        public array $roundTitles = [],
    ) {}

    public function build(): self
    {
        $track = $this->stackName ?: $this->rawHeading;
        $subject = $track
            ? "Your Mellow Vault profile hit {$this->profilePercent}% — Start your {$track} Vault AI Interview"
            : "Your Mellow Vault profile hit {$this->profilePercent}% — Start your Vault AI Interview";

        return $this->subject($subject)->view('emails.vault-stack-interview-invite');
    }
}
