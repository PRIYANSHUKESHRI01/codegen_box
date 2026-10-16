<?php

namespace App\Services\Payments;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * The only code that talks to Razorpay: its REST API over Laravel's HTTP client
 * (so tests use Http::fake() and no SDK has to be added to the deployed vendor/),
 * plus the two HMAC checks that make a callback or a webhook believable.
 *
 * Amounts are integers in paise, as Razorpay expects. Every call authenticates
 * with HTTP Basic (key id : key secret) over HTTPS.
 *
 * Reads (GET) are retried on a network failure; writes (create order, capture,
 * refund) are not — a write that timed out may have happened, and retrying it
 * blind is how you refund twice. The callers re-check state instead.
 */
class RazorpayClient
{
    public function isConfigured(): bool
    {
        return $this->keyId() !== '' && $this->keySecret() !== '';
    }

    public function isWebhookConfigured(): bool
    {
        return trim((string) config('billing.razorpay.webhook_secret')) !== '';
    }

    public function keyId(): string
    {
        return trim((string) config('billing.razorpay.key_id'));
    }

    /** `rzp_live_…` keys are live; anything else (rzp_test_…) is test mode. */
    public function mode(): string
    {
        return str_starts_with($this->keyId(), 'rzp_live_') ? 'live' : 'test';
    }

    // ───────────────────────────── orders & payments ─────────────────────────────

    /**
     * @param  array<string, string>  $notes  at most 15 pairs of 256 characters (Razorpay's limit)
     * @return array<string, mixed> the order entity: id, amount, currency, receipt, status…
     *
     * @throws GatewayRequestException
     */
    public function createOrder(int $amountPaise, string $currency, string $receipt, array $notes = []): array
    {
        return $this->send('post', '/orders', [
            'amount' => $amountPaise,
            'currency' => $currency,
            'receipt' => $receipt,
            'notes' => $notes,
        ], retry: false);
    }

    /** @return array<string, mixed> @throws GatewayRequestException */
    public function fetchPayment(string $paymentId): array
    {
        return $this->send('get', '/payments/'.rawurlencode($paymentId));
    }

    /**
     * Every payment attempt made against an order (a student who fails on one card and
     * succeeds on another has two).
     *
     * @return list<array<string, mixed>>
     *
     * @throws GatewayRequestException
     */
    public function fetchOrderPayments(string $orderId): array
    {
        return $this->send('get', '/orders/'.rawurlencode($orderId).'/payments')['items'] ?? [];
    }

    /**
     * Moves an `authorized` payment to `captured` — the money only reaches the account once it is.
     * Accounts on Razorpay's default automatic capture never need this; it is the safety net for one
     * switched to manual capture (an authorized payment left alone is refunded after 3 days).
     *
     * @return array<string, mixed>
     *
     * @throws GatewayRequestException
     */
    public function capturePayment(string $paymentId, int $amountPaise, string $currency): array
    {
        return $this->send('post', '/payments/'.rawurlencode($paymentId).'/capture', [
            'amount' => $amountPaise,
            'currency' => $currency,
        ], retry: false);
    }

    /**
     * A normal (not instant) refund of a captured payment, whole unless an amount is given.
     *
     * @param  array<string, string>  $notes
     * @return array<string, mixed>
     *
     * @throws GatewayRequestException
     */
    public function refundPayment(string $paymentId, ?int $amountPaise = null, array $notes = [], ?string $receipt = null): array
    {
        return $this->send('post', '/payments/'.rawurlencode($paymentId).'/refund', array_filter([
            'amount' => $amountPaise,
            'speed' => 'normal',
            'notes' => $notes ?: null,
            'receipt' => $receipt,
        ], fn ($v) => $v !== null), retry: false);
    }

    // ───────────────────────────── signatures ─────────────────────────────

    /**
     * Checkout's three callback fields prove the payment only if this holds:
     * HMAC-SHA256 of "<order_id>|<payment_id>" keyed with the API key secret.
     * `$orderId` must be the id WE stored for this checkout, never the one the
     * browser sent back — otherwise a payment for someone else's cheaper order
     * would verify against ours.
     */
    public function verifyPaymentSignature(string $orderId, string $paymentId, string $signature): bool
    {
        if (! $this->isConfigured() || $orderId === '' || $paymentId === '' || $signature === '') {
            return false;
        }

        return hash_equals(hash_hmac('sha256', $orderId.'|'.$paymentId, $this->keySecret()), $signature);
    }

    /**
     * A webhook is genuine only if its `X-Razorpay-Signature` header equals HMAC-SHA256 of the
     * RAW request body keyed with the webhook secret. Raw means byte-for-byte as received — a
     * body that went through json_decode/json_encode no longer hashes the same.
     */
    public function verifyWebhookSignature(string $rawBody, ?string $signature): bool
    {
        $secret = trim((string) config('billing.razorpay.webhook_secret'));

        if ($secret === '' || $signature === null || $signature === '') {
            return false;
        }

        return hash_equals(hash_hmac('sha256', $rawBody, $secret), $signature);
    }

    // ───────────────────────────── transport ─────────────────────────────

    private function keySecret(): string
    {
        return trim((string) config('billing.razorpay.key_secret'));
    }

    private function http(bool $retry): PendingRequest
    {
        $request = Http::baseUrl(rtrim((string) config('billing.razorpay.api_base'), '/'))
            ->withBasicAuth($this->keyId(), $this->keySecret())
            ->acceptJson()
            ->asJson()
            ->connectTimeout(5)
            ->timeout((int) config('billing.razorpay.timeout_seconds', 15));

        // Only a connection failure is retried, and only for reads.
        return $retry
            ? $request->retry(2, 250, fn ($e) => $e instanceof ConnectionException, throw: false)
            : $request;
    }

    /**
     * @param  array<string, mixed>  $body
     * @return array<string, mixed>
     *
     * @throws GatewayRequestException
     */
    private function send(string $method, string $path, array $body = [], bool $retry = true): array
    {
        if (! $this->isConfigured()) {
            throw new GatewayRequestException('Razorpay keys are not configured.');
        }

        try {
            $response = $method === 'get'
                ? $this->http($retry)->get($path)
                : $this->http(false)->post($path, $body);
        } catch (ConnectionException $e) {
            Log::warning('Razorpay unreachable', ['path' => $path, 'error' => $e->getMessage()]);

            throw new GatewayRequestException('Razorpay could not be reached.');
        }

        return $this->decode($response, $path);
    }

    /** @return array<string, mixed> @throws GatewayRequestException */
    private function decode(Response $response, string $path): array
    {
        if ($response->successful()) {
            return $response->json() ?? [];
        }

        $error = $response->json('error') ?? [];
        $code = is_array($error) ? ($error['code'] ?? null) : null;
        $description = is_array($error) ? ($error['description'] ?? null) : null;

        // What Razorpay said goes to the log, never to the student. No request body, no credentials.
        Log::error('Razorpay request failed', [
            'path' => $path,
            'status' => $response->status(),
            'code' => $code,
            'description' => $description,
        ]);

        throw new GatewayRequestException(
            "Razorpay answered {$response->status()} for {$path}.",
            $response->status(),
            $code,
            $description,
        );
    }
}
