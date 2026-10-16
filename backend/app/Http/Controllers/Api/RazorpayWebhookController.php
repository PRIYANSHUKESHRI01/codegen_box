<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Payments\RazorpayClient;
use App\Services\Payments\RazorpayWebhookHandler;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * POST /api/webhooks/razorpay — Razorpay telling us about a payment, a failure or a
 * refund whether or not the student's browser is still open.
 *
 * Public by necessity (Razorpay has no login), so everything rests on the signature:
 * `X-Razorpay-Signature` must be the HMAC-SHA256 of the RAW body under the webhook
 * secret. The body is read with getContent() and never parsed first.
 *
 * Status codes are the retry protocol: 200 = done (Razorpay stops), anything else =
 * "try again later". So a bad signature is 400 (never retry-worthy), an unconfigured
 * secret is 503, and a handler that threw is 500 — which is how a payment that could
 * not be activated this time is activated on a later delivery.
 */
class RazorpayWebhookController extends Controller
{
    public function __invoke(Request $request, RazorpayClient $gateway, RazorpayWebhookHandler $handler): JsonResponse
    {
        if (! $gateway->isWebhookConfigured()) {
            return response()->json(['message' => 'Webhook is not configured.'], 503);
        }

        $rawBody = $request->getContent();

        if (! $gateway->verifyWebhookSignature($rawBody, $request->header('X-Razorpay-Signature'))) {
            Log::warning('Razorpay webhook rejected: bad signature', ['ip' => $request->ip()]);

            return response()->json(['message' => 'Invalid signature.'], 400);
        }

        $payload = json_decode($rawBody, true);

        if (! is_array($payload) || ! isset($payload['event'])) {
            return response()->json(['message' => 'Malformed event.'], 400);
        }

        // Razorpay's own id for this delivery's event; a hash of the body only if a proxy stripped the header.
        $eventId = (string) ($request->header('X-Razorpay-Event-Id') ?: 'sha1:'.sha1($rawBody));

        // May throw → the framework answers 500 → Razorpay retries (see the class docblock).
        $outcome = $handler->handle($eventId, $payload);

        return response()->json(['status' => $outcome]);
    }
}
