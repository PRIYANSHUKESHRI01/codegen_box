<?php

namespace App\Jobs;

use App\Mail\VaultReadyMail;
use App\Models\User;
use Illuminate\Bus\Batchable;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\Middleware\RateLimited;
use Illuminate\Support\Facades\Mail;

/**
 * Mirrors SendInterviewShortlistEmail's exact shape — see that job's docblock.
 * Queued rather than sent inline (the SingleMail rule): when a contest or a
 * nightly refresh lifts a roomful of students over the line at once, that is
 * genuine fan-out, and the `transactional-emails` limiter is what keeps it from
 * hammering the mail server.
 */
class SendVaultReadyEmail implements ShouldQueue
{
    use Batchable, Dispatchable, InteractsWithQueue, Queueable;

    public int $tries = 3;

    public function __construct(public int $userId) {}

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
        $user = User::with('vaultProfile')->find($this->userId);

        if (! $user || ! $user->vaultProfile) {
            return;
        }

        Mail::to($user->email)->send(new VaultReadyMail(
            $user,
            (int) $user->vaultProfile->readiness_score,
            (int) config('vault.enter_score', 60),
            $user->vaultProfile->hasConsent(),
        ));
    }
}
