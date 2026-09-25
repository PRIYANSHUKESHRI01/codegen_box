<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

/**
 * Placeholder body for the TPO's "Send Email" bulk-notification feature on
 * the Student Cohort page. Deliberately generic/dummy content — the TPO is
 * meant to swap this for a real template (a future feature: subject/body
 * composed per-send, or a saved library of templates), but the send
 * pipeline (recipient targeting, queueing, rate limiting) needed to be real
 * today rather than waiting on that.
 */
class StudentBulkNotificationMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public User $user) {}

    public function build(): self
    {
        $subject = $this->user->college
            ? 'An update from your Placement Cell — '.$this->user->college->name
            : 'An update from the Mellow team';

        return $this->subject($subject)->view('emails.student-bulk-notification');
    }
}
