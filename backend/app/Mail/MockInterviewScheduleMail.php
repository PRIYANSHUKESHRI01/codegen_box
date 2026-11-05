<?php

namespace App\Mail;

use App\Jobs\SendMockInterviewMail;
use App\Models\Interview;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

/**
 * "Your placement cell scheduled an AI mock interview" — and its follow-ups (changed, starting soon, closing soon). One
 * mailable, one view; the wording switches on `$kind`.
 */
class MockInterviewScheduleMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public User $user,
        public Interview $interview,
        public string $kind = SendMockInterviewMail::KIND_SCHEDULED,
    ) {}

    public function build(): self
    {
        $subject = match ($this->kind) {
            SendMockInterviewMail::KIND_CHANGED => "Updated: {$this->interview->title}",
            SendMockInterviewMail::KIND_OPENING_SOON => "Starting soon: {$this->interview->title}",
            SendMockInterviewMail::KIND_CLOSING_SOON => "Closing soon: {$this->interview->title}",
            default => "AI mock interview scheduled: {$this->interview->title}",
        };

        return $this->subject($subject)->view('emails.mock-interview');
    }
}
