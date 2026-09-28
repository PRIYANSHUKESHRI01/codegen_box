<?php

namespace App\Jobs;

use App\Mail\ContactRequestConfirmationMail;
use App\Models\ContactRequest;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\Middleware\RateLimited;
use Illuminate\Support\Facades\Mail;

/** Fired right after a "Talk to Our Team" submission is created — see ContactRequestService::submit(). */
class SendContactRequestConfirmation implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable;

    public int $tries = 3;

    public function __construct(
        public int $contactRequestId,
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
        $contactRequest = ContactRequest::find($this->contactRequestId);

        if (! $contactRequest) {
            return;
        }

        Mail::to($contactRequest->email)->send(new ContactRequestConfirmationMail($contactRequest));
    }
}
