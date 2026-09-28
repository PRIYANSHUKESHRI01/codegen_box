<?php

namespace App\Jobs;

use App\Mail\NewsletterWelcomeMail;
use App\Models\NewsletterSubscriber;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\Middleware\RateLimited;
use Illuminate\Support\Facades\Mail;

/** Fired right after a newsletter signup (new or resubscribe) — see NewsletterController::subscribe(). */
class SendNewsletterWelcomeEmail implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable;

    public int $tries = 3;

    public function __construct(
        public int $subscriberId,
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
        $subscriber = NewsletterSubscriber::find($this->subscriberId);

        if (! $subscriber) {
            return;
        }

        Mail::to($subscriber->email)->send(new NewsletterWelcomeMail($subscriber));
    }
}
