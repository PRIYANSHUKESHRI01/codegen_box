<?php

namespace App\Mail;

use App\Models\ProctoringSession;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

/**
 * Sent to every TPO at a student's college, plus their Section Coordinator
 * (if one is assigned), once a proctored contest attempt ends with at least
 * one violation on record — either immediately (the attempt was locked at
 * 3 strikes) or at contest finalize time (fewer than 3, but at least 1).
 * One of these per recipient — see SendProctoringViolationReport, the
 * queued unit that dispatches it and marks `reported_at`.
 */
class ProctoringViolationReportMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public User $recipient,
        public ProctoringSession $session,
    ) {}

    public function build(): self
    {
        $student = $this->session->contestParticipant->user;
        $contest = $this->session->contestParticipant->contest;
        $subjectPrefix = $this->session->isLocked() ? 'Locked out' : 'Flagged';

        return $this->subject("{$subjectPrefix}: {$student->name} — proctoring report for {$contest->title}")
            ->view('emails.proctoring-violation-report');
    }
}
