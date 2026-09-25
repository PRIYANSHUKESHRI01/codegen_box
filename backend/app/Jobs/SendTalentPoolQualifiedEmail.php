<?php

namespace App\Jobs;

use App\Mail\TalentPoolQualifiedMail;
use App\Models\Contest;
use App\Models\User;
use Illuminate\Bus\Batchable;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\Middleware\RateLimited;
use Illuminate\Support\Facades\Mail;

/** Mirrors SendInterviewShortlistEmail's exact shape — see that job's docblock. */
class SendTalentPoolQualifiedEmail implements ShouldQueue
{
    use Batchable, Dispatchable, InteractsWithQueue, Queueable;

    public int $tries = 3;

    public function __construct(
        public int $userId,
        public int $contestId,
        public float $scorePercent,
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
        $contest = Contest::find($this->contestId);

        if (! $user || ! $contest) {
            return;
        }

        Mail::to($user->email)->send(new TalentPoolQualifiedMail($user, $contest, $this->scorePercent));
    }
}
