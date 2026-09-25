<?php

namespace App\Jobs;

use App\Mail\AccountCredentialsMail;
use App\Models\User;
use Illuminate\Bus\Batchable;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeEncrypted;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\Middleware\RateLimited;
use Illuminate\Support\Facades\Mail;

/**
 * One queued job per account — the fan-out unit for a bulk import of
 * (potentially) thousands of welcome emails, but also the single-account
 * unit used by every other account-creation path (self-registration aside,
 * which has no password to deliver and uses SendWelcomeEmail instead).
 * Deliberately NOT one big job that loops over every account and sends
 * serially: a single job doing that would (a) tie up one worker for the
 * entire run with no parallelism, (b) have to restart the *whole* batch
 * from row 1 on any transient failure, and (c) offer no natural place to
 * rate-limit against the mail provider. Fanning out to one job per
 * recipient gets automatic retry-with-backoff, failure isolation (one bad
 * email address doesn't block the rest), horizontal scaling, and rate
 * limiting for free via Laravel's queue primitives.
 *
 * ShouldBeEncrypted matters here specifically because the constructor
 * carries a plaintext password: queued jobs are serialized into the queue
 * backend (a DB table, or Redis) until a worker picks them up, so without
 * this the password would sit there in plain text for however long the job
 * waits in the queue. Encrypting the payload (via the app's APP_KEY) closes
 * that window without changing anything about how the job is dispatched or
 * consumed.
 */
class SendAccountCredentialsEmail implements ShouldQueue, ShouldBeEncrypted
{
    use Batchable, Dispatchable, InteractsWithQueue, Queueable;

    public int $tries = 3;

    public function __construct(
        public int $userId,
        public string $plainPassword,
    ) {}

    /** Exponential-ish backoff: transient SMTP/API hiccups get a moment to clear before retrying. */
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
        // A batch cancellation (e.g. an admin aborts a runaway import) stops
        // any of its jobs that haven't run yet from doing anything at all.
        if ($this->batch()?->cancelled()) {
            return;
        }

        $user = User::find($this->userId);

        // Idempotency guard: if a prior attempt got as far as sending but
        // failed to report success back to the queue (rare, but the whole
        // point of $tries=3 is that retries happen), never send a second
        // credentials email to the same account.
        if (! $user || $user->credentials_email_sent_at !== null) {
            return;
        }

        Mail::to($user->email)->send(new AccountCredentialsMail($user, $this->plainPassword));

        $user->forceFill(['credentials_email_sent_at' => now()])->save();
    }
}
