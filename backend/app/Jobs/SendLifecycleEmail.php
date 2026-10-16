<?php

namespace App\Jobs;

use App\Enums\LifecycleEmail;
use App\Mail\LifecycleMail;
use App\Models\LifecycleEmailLog;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\Middleware\RateLimited;
use Illuminate\Support\Facades\Mail;
use Throwable;

/**
 * Sends one lifecycle e-mail (see App\Enums\LifecycleEmail). Same shape as every
 * other Send* job here: the caller runs it through App\Support\SingleMail, so it
 * goes out inside the request or console command that caused it with no queue
 * worker involved, and the queue is only the retry path if that send fails.
 *
 * It is safe to run twice. The (user, type, dedupe_key) row is claimed BEFORE
 * sending — the unique index lets exactly one caller through — and released again
 * if the send throws, so a retry can still deliver while a duplicate never does.
 *
 * Engagement mail additionally stops for a student who unsubscribed or whose
 * account is blocked, checked here at send time (not when it was queued) so an
 * unsubscribe takes effect even for a retry that was already waiting.
 */
class SendLifecycleEmail implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable;

    public int $tries = 3;

    /** @param array<string, mixed> $data plain values only — they are stored in the job */
    public function __construct(
        public int $userId,
        public string $type,
        public array $data = [],
        public string $dedupeKey = '',
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
        $type = LifecycleEmail::tryFrom($this->type);
        $user = User::find($this->userId);

        if ($type === null || $user === null || trim((string) $user->email) === '') {
            return;
        }

        if ($type->isEngagement() && ($user->is_blocked || $user->email_nudges_opt_out_at !== null)) {
            return;
        }

        $claim = LifecycleEmailLog::claim($user->id, $type, $this->dedupeKey);

        if ($claim === null) {
            return;   // already sent (or being sent right now)
        }

        try {
            Mail::to($user->email)->send(new LifecycleMail($user, $type, $this->data));
        } catch (Throwable $e) {
            $claim->delete();

            throw $e;
        }
    }
}
