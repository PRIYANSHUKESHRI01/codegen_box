<?php

namespace App\Jobs;

use App\Mail\TalentPoolOutreachMail;
use App\Models\Company;
use App\Models\TalentPoolMessage;
use App\Models\User;
use Illuminate\Bus\Batchable;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\Middleware\RateLimited;
use Illuminate\Support\Facades\Mail;

class SendTalentPoolOutreachEmail implements ShouldQueue
{
    use Batchable, Dispatchable, InteractsWithQueue, Queueable;

    public int $tries = 3;

    public function __construct(
        public int $userId,
        public int $companyId,
        public int $messageId,
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
        $message = TalentPoolMessage::find($this->messageId);

        if (! $user || ! $company || ! $message) {
            return;
        }

        Mail::to($user->email)->send(new TalentPoolOutreachMail($user, $company, $message->message));
    }
}
