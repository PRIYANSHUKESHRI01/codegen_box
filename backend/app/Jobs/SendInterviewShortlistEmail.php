<?php

namespace App\Jobs;

use App\Mail\InterviewShortlistMail;
use App\Models\Company;
use App\Models\Interview;
use App\Models\User;
use Illuminate\Bus\Batchable;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\Middleware\RateLimited;
use Illuminate\Support\Facades\Mail;

/** Mirrors SendCandidateInviteEmail's exact shape — see that job's docblock. */
class SendInterviewShortlistEmail implements ShouldQueue
{
    use Batchable, Dispatchable, InteractsWithQueue, Queueable;

    public int $tries = 3;

    public function __construct(
        public int $userId,
        public int $companyId,
        public int $interviewId,
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
        $interview = Interview::find($this->interviewId);

        if (! $user || ! $company || ! $interview) {
            return;
        }

        Mail::to($user->email)->send(new InterviewShortlistMail($user, $company, $interview));
    }
}
