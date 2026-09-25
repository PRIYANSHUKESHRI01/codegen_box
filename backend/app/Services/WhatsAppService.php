<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;

/**
 * Provider-agnostic WhatsApp sender, deliberately mirroring how Laravel's
 * own Mail facade stays the same call site regardless of MAIL_MAILER.
 * There is no way to actually deliver a WhatsApp message without a real
 * WhatsApp Business Platform account — see config/whatsapp.php — so the
 * default "log" provider writes the intended message to the app log
 * instead of pretending to send it. Once real Meta Cloud API credentials
 * are added to .env (WHATSAPP_PROVIDER=meta + the phone number id/access
 * token), this same method call starts actually delivering messages.
 */
class WhatsAppService
{
    public function send(string $toPhone, string $message): void
    {
        $provider = config('whatsapp.provider');

        match ($provider) {
            'meta' => $this->sendViaMeta($toPhone, $message),
            default => $this->logOnly($toPhone, $message),
        };
    }

    private function logOnly(string $toPhone, string $message): void
    {
        Log::info('[WhatsApp:log-driver] Would send WhatsApp message', [
            'to' => $toPhone,
            'message' => $message,
        ]);
    }

    private function sendViaMeta(string $toPhone, string $message): void
    {
        $phoneNumberId = config('whatsapp.meta.phone_number_id');
        $accessToken = config('whatsapp.meta.access_token');
        $apiVersion = config('whatsapp.meta.api_version');

        if (! $phoneNumberId || ! $accessToken) {
            throw new RuntimeException('WHATSAPP_PROVIDER=meta but WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_ACCESS_TOKEN are not set.');
        }

        // Meta requires E.164 (no leading +, no spaces/dashes) for the "to" field.
        $normalizedPhone = preg_replace('/[^0-9]/', '', $toPhone);

        $response = Http::withToken($accessToken)
            ->post("https://graph.facebook.com/{$apiVersion}/{$phoneNumberId}/messages", [
                'messaging_product' => 'whatsapp',
                'to' => $normalizedPhone,
                'type' => 'text',
                'text' => ['body' => $message],
            ]);

        if ($response->failed()) {
            throw new RuntimeException('WhatsApp send failed: '.$response->body());
        }
    }
}
