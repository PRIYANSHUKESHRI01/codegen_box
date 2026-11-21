<?php

namespace App\Mail;

use App\Models\Hackathon;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

/**
 * Announcement email sent when a new hackathon is published on AptRun.
 * Dispatched to every eligible student (open to all AptRun users or specific college students).
 */
class HackathonPublishedMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public User $user,
        public Hackathon $hackathon
    ) {}

    public function build(): self
    {
        $subject = '🔥 New Hackathon: ' . $this->hackathon->title . ' on AptRun';

        if ($this->hackathon->durationHours()) {
            $subject = '🔥 ' . $this->hackathon->durationHours() . 'h Hackathon: ' . $this->hackathon->title;
        }

        return $this->subject($subject)->view('emails.hackathon-published');
    }
}
