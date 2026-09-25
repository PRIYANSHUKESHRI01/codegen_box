<?php

namespace App\Jobs;

use App\Services\WhatsAppService;
use Illuminate\Bus\Batchable;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\Middleware\RateLimited;

/**
 * One queued job per recipient, same fan-out shape as the email
 * notification jobs — a WhatsApp Business API has its own per-second/
 * per-day rate limits just like an email provider does, so this reuses the
 * identical 'transactional-emails' limiter rather than inventing a second
 * one (both exist to protect the same class of "don't get throttled or
 * banned by a third-party messaging provider" problem).
 */
class SendWhatsAppNotification implements ShouldQueue
{
    use Batchable, Dispatchable, InteractsWithQueue, Queueable;

    public int $tries = 3;

    public function __construct(
        public string $toPhone,
        public string $message,
    ) {}

    public function backoff(): array
    {
        return [10, 30, 60];
    }

    public function middleware(): array
    {
        return [new RateLimited('transactional-emails')];
    }

    public function handle(WhatsAppService $whatsApp): void
    {
        if ($this->batch()?->cancelled()) {
            return;
        }

        $whatsApp->send($this->toPhone, $this->message);
    }
}
