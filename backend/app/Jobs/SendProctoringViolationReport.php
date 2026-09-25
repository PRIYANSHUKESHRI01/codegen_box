<?php

namespace App\Jobs;

use App\Mail\ProctoringViolationReportMail;
use App\Models\ProctoringSession;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\Middleware\RateLimited;
use Illuminate\Support\Facades\Mail;

/**
 * Fans out one proctoring session's activity report to every TPO at the
 * student's college plus their Section Coordinator (if one is assigned to
 * their section) — dispatched either immediately on lock
 * (ProctoringService::lock()) or in a batch at contest finalize time for
 * sessions that ended with 1-2 (non-locking) violations
 * (ContestFinalizeService::dispatchProctoringReports()). Idempotent via
 * `reported_at`, same convention as SendAccountCredentialsEmail's
 * credentials_email_sent_at guard — safe to enqueue more than once for the
 * same session.
 */
class SendProctoringViolationReport implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable;

    public int $tries = 3;

    public function __construct(public int $proctoringSessionId) {}

    public function backoff(): array
    {
        return [10, 30, 60];
    }

    public function middleware(): array
    {
        return [new RateLimited('transactional-emails')];
    }

    public function handle(): void
    {
        $session = ProctoringSession::with([
            'contestParticipant.user.college',
            'contestParticipant.contest',
            'violations.contestProblem.problem:id,title',
        ])->find($this->proctoringSessionId);

        if (! $session || $session->reported_at !== null) {
            return;
        }

        $participant = $session->contestParticipant;
        $student = $participant->user;
        $college = $student->college;

        if (! $college) {
            // A "Mellow Direct" student with no college has no TPO/coordinator to notify.
            $session->update(['reported_at' => now()]);

            return;
        }

        $recipients = $college->tpoAdmins()->get();

        if ($student->section) {
            $coordinator = User::where('college_id', $college->id)
                ->where('role', User::ROLE_SECTION_COORDINATOR)
                ->where('section', $student->section)
                ->first();

            if ($coordinator) {
                $recipients->push($coordinator);
            }
        }

        $recipients = $recipients->unique('id');

        foreach ($recipients as $recipient) {
            Mail::to($recipient->email)->send(new ProctoringViolationReportMail($recipient, $session));
        }

        $session->update(['reported_at' => now()]);
    }
}
