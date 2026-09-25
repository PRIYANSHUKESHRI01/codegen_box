<?php

namespace App\Jobs;

use App\Mail\CandidateInviteMail;
use App\Models\Company;
use App\Models\User;
use Illuminate\Bus\Batchable;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\Middleware\RateLimited;
use Illuminate\Support\Facades\Mail;

/** Mirrors SendAccountCredentialsEmail's shape (one job per recipient, batchable, rate-limited) but for an already-existing account — see CandidateInviteMail's docblock for why this can't just reuse that job. */
class SendCandidateInviteEmail implements ShouldQueue
{
    use Batchable, Dispatchable, InteractsWithQueue, Queueable;

    public int $tries = 3;

    public function __construct(
        public int $userId,
        public int $companyId,
        public string $roleTitle,
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
        $company = Company::find($this->companyId);

        if (! $user || ! $company) {
            return;
        }

        Mail::to($user->email)->send(new CandidateInviteMail($user, $company, $this->roleTitle));
    }
}
