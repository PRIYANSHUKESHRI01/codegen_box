<?php

namespace App\Jobs;

use App\Mail\MockInterviewScheduleMail;
use App\Models\Interview;
use App\Models\User;
use Illuminate\Bus\Batchable;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\Middleware\RateLimited;
use Illuminate\Support\Facades\Mail;

/**
 * One queued e-mail per student about a college's scheduled mock AI interview (scheduled, changed, "starting soon",
 * "closing soon"). Same fan-out shape as SendStudentBulkNotification: per-recipient retries, the shared mail rate limit,
 * and nothing sensitive in the payload (ids only). It re-checks at send time, so a student who finished it, or an
 * interview that was cancelled in the meantime, never gets a stale mail.
 */
class SendMockInterviewMail implements ShouldQueue
{
    use Batchable, Dispatchable, InteractsWithQueue, Queueable;

    public const KIND_SCHEDULED = 'scheduled';

    public const KIND_CHANGED = 'changed';

    public const KIND_OPENING_SOON = 'opening_soon';

    public const KIND_CLOSING_SOON = 'closing_soon';

    public int $tries = 3;

    public function __construct(
        public int $userId,
        public int $interviewId,
        public string $kind = self::KIND_SCHEDULED,
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

        $user = User::with('college')->find($this->userId);
        $interview = Interview::find($this->interviewId);

        if (! $user || ! $interview || $user->is_blocked || ! $interview->isPublished()) {
            return;
        }

        if ($this->kind === self::KIND_CLOSING_SOON
            && $interview->sessions()->where('user_id', $user->id)->where('status', 'completed')->exists()) {
            return;
        }

        Mail::to($user->email)->send(new MockInterviewScheduleMail($user, $interview, $this->kind));
    }
}
