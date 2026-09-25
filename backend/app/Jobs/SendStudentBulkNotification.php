<?php

namespace App\Jobs;

use App\Mail\PlacementDriveTerminationMail;
use App\Mail\StudentBulkNotificationMail;
use App\Models\User;
use Illuminate\Bus\Batchable;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\Middleware\RateLimited;
use Illuminate\Support\Facades\Mail;

/**
 * One queued job per recipient for a TPO's "Send Email" bulk action on the
 * Student Cohort page — same fan-out shape as SendAccountCredentialsEmail
 * (per-recipient retry isolation, horizontal scaling, shared rate limit)
 * since this can target an entire filtered cohort at once. No
 * ShouldBeEncrypted here — unlike the credentials email, the payload is
 * just a user id, nothing sensitive sits in the queue backend.
 */
class SendStudentBulkNotification implements ShouldQueue
{
    use Batchable, Dispatchable, InteractsWithQueue, Queueable;

    public int $tries = 3;

    public const TEMPLATE_GENERIC = 'generic';

    public const TEMPLATE_TERMINATION = 'termination';

    public function __construct(
        public int $userId,
        public string $template = self::TEMPLATE_GENERIC,
    ) {}

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
        if ($this->batch()?->cancelled()) {
            return;
        }

        $user = User::find($this->userId);

        if (! $user) {
            return;
        }

        $mailable = $this->template === self::TEMPLATE_TERMINATION
            ? new PlacementDriveTerminationMail($user)
            : new StudentBulkNotificationMail($user);

        Mail::to($user->email)->send($mailable);
    }
}
