<?php

namespace App\Jobs;

use App\Mail\PasswordResetOtpMail;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeEncrypted;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\Middleware\RateLimited;
use Illuminate\Support\Facades\Mail;

/**
 * ShouldBeEncrypted for the same reason SendAccountCredentialsEmail is: the
 * constructor carries a secret (the OTP code) that would otherwise sit in
 * plaintext in the jobs table until a worker picks it up.
 *
 * No idempotency guard — unlike a welcome/credentials email, re-sending on
 * a queue retry is exactly the desired behavior here (every genuine
 * request-a-code action should result in an email), and PasswordResetOtp's
 * own expiry + single-active-row invariant is what actually guards replay,
 * not this job.
 */
class SendPasswordResetOtpEmail implements ShouldQueue, ShouldBeEncrypted
{
    use Dispatchable, InteractsWithQueue, Queueable;

    public int $tries = 3;

    public function __construct(
        public int $userId,
        public string $code,
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

        Mail::to($user->email)->send(new PasswordResetOtpMail($user, $this->code));
    }
}
