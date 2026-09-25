<?php

namespace App\Jobs;

use App\Mail\TalentPoolHireOfferMail;
use App\Models\Company;
use App\Models\TalentPoolInquiry;
use App\Models\User;
use Illuminate\Bus\Batchable;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\Middleware\RateLimited;
use Illuminate\Support\Facades\Mail;

class SendTalentPoolHireOfferEmail implements ShouldQueue
{
    use Batchable, Dispatchable, InteractsWithQueue, Queueable;

    public int $tries = 3;

    public function __construct(
        public int $userId,
        public int $companyId,
        public int $inquiryId,
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
        $company = Company::find($this->companyId);
        $inquiry = TalentPoolInquiry::find($this->inquiryId);

        if (! $user || ! $company || ! $inquiry) {
            return;
        }

        Mail::to($user->email)->send(new TalentPoolHireOfferMail($user, $company, $inquiry));
    }
}
