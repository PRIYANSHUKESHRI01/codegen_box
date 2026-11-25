<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

/**
 * Email sent by a TPO / Coordinator via Bulk Notify. Supports both the legacy
 * preset notice and custom composed subject + message text.
 */
class StudentBulkNotificationMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public User $user,
        public ?string $customSubject = null,
        public ?string $customMessage = null,
    ) {}

    public function build(): self
    {
        if ($this->customSubject !== null && trim($this->customSubject) !== '') {
            $subject = trim($this->customSubject);
        } else {
            $subject = $this->user->college
                ? 'An update from your Placement Cell — '.$this->user->college->name
                : 'An update from the AptRun team';
        }

        return $this->subject($subject)->view('emails.student-bulk-notification');
    }
}
