<?php

namespace App\Jobs;

use App\Mail\TalentPoolInterviewResponseMail;
use App\Models\TalentPoolInquiry;
use Illuminate\Bus\Batchable;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\Middleware\RateLimited;
use Illuminate\Support\Facades\Mail;

class SendTalentPoolInterviewResponseEmail implements ShouldQueue
{
    use Batchable, Dispatchable, InteractsWithQueue, Queueable;

    public int $tries = 3;

    public function __construct(
        public int $inquiryId,
        public string $decision,
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
        $inquiry = TalentPoolInquiry::with(['initiatedBy', 'candidate.user'])->find($this->inquiryId);

        if (! $inquiry || ! $inquiry->initiatedBy) {
            return;
        }

        Mail::to($inquiry->initiatedBy->email)->send(new TalentPoolInterviewResponseMail($inquiry->initiatedBy, $inquiry, $this->decision));
    }
}
