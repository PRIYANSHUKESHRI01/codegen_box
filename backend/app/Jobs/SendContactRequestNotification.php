<?php

namespace App\Jobs;

use App\Mail\ContactRequestNotificationMail;
use App\Models\ContactRequest;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\Middleware\RateLimited;
use Illuminate\Support\Facades\Mail;

/** Fired once a "Talk to Our Team" submission has been assigned to a marketing employee — see ContactRequestService::submit(). */
class SendContactRequestNotification implements ShouldQueue
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
        $contactRequest = ContactRequest::with('assignedMarketing')->find($this->contactRequestId);

        if (! $contactRequest || ! $contactRequest->assignedMarketing) {
            return;
        }

        Mail::to($contactRequest->assignedMarketing->email)->send(new ContactRequestNotificationMail($contactRequest));
    }
}
