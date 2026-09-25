<?php

namespace App\Jobs;

use App\Mail\WelcomeMail;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\Middleware\RateLimited;
use Illuminate\Support\Facades\Mail;

/**
 * Fired once, right after a self-registered ("Mellow Direct") account is
 * created — the counterpart to SendAccountCredentialsEmail for the one
 * creation path where there's no temporary password to deliver (the user
 * already chose their own). Same rate-limited queue shape as every other
 * transactional send in this app, but no ShouldBeEncrypted and no
 * idempotency guard: the payload is just a user id (nothing sensitive), and
 * register() runs exactly once per account, so a duplicate welcome email on
 * a rare queue retry is cosmetically harmless rather than a real concern.
 */
class SendWelcomeEmail implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable;

    public int $tries = 3;

    public function __construct(
        public int $userId,
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
        $user = User::find($this->userId);

        if (! $user) {
            return;
        }

        Mail::to($user->email)->send(new WelcomeMail($user));
    }
}
