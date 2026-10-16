<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Payments\PayuClient;
use App\Services\Payments\PayuWebhookHandler;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * POST /api/webhooks/payu — PayU telling us about a payment, a refund or a chargeback whether or not the
 * student's browser is still open. Set up in PayU Dashboard → Developers → Webhooks (one webhook per event
 * type: Successful, Failed, Refund, Dispute), all pointing at this URL.
 *
 * Public by necessity (PayU has no login), so the request is vetted in layers:
 *
 *   • payment events are form-encoded and carry PayU's response hash — checked against the Salt;
 *   • refund and dispute events are JSON with NO signature, so the optional `?token=` secret in the URL
 *     (PAYU_WEBHOOK_TOKEN) and optional source-IP allow-list keep strangers out, and — what really matters —
 *     PayuWebhookHandler believes nothing in any event until PayU's own API confirms it.
 *
 * Status codes are the retry protocol: 200 = done, anything else = "try again later". A bad hash, token or
 * body is never retry-worthy (4xx); a handler that threw — PayU's API unreachable, our database — is 500, so
 * the event is delivered again.
 */
class PayuWebhookController extends Controller
{
    public function __invoke(Request $request, PayuClient $client, PayuWebhookHandler $handler): JsonResponse
    {
        if (! $client->isConfigured()) {
            return response()->json(['message' => 'Webhook is not configured.'], 503);
        }

        $allowed = $client->webhookAllowedIps();

        if ($allowed !== [] && ! in_array((string) $request->ip(), $allowed, true)) {
            Log::warning('PayU webhook rejected: source IP not allowed', ['ip' => $request->ip()]);

            return response()->json(['message' => 'Forbidden.'], 403);
        }

        if (! $client->webhookTokenMatches($request->query('token'))) {
            Log::warning('PayU webhook rejected: bad token', ['ip' => $request->ip()]);

            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $raw = $request->getContent();

        if ($request->isJson() || str_starts_with(ltrim($raw), '{')) {
            $payload = json_decode($raw, true);
            $payload = is_array($payload) ? $payload : [];

            $kind = match (true) {
                ($payload['action'] ?? null) === 'refund' || isset($payload['merchantTxnId']) => PayuWebhookHandler::REFUND,
                ($payload['event'] ?? null) === 'dispute' || isset($payload['cb_id']) => PayuWebhookHandler::DISPUTE,
                // PayU documents payment events as form-encoded, but an account configured for JSON delivery is still a payment event.
                isset($payload['txnid'], $payload['status'], $payload['hash']) => PayuWebhookHandler::PAYMENT,
                default => null,
            };
        } else {
            $payload = $request->post();
            $kind = isset($payload['txnid'], $payload['status'], $payload['hash']) ? PayuWebhookHandler::PAYMENT : null;
        }

        if ($kind === null) {
            return response()->json(['message' => 'Malformed event.'], 400);
        }

        if ($kind === PayuWebhookHandler::PAYMENT && ! $client->verifyResponseHash($payload)) {
            Log::warning('PayU webhook rejected: bad hash', ['ip' => $request->ip()]);

            return response()->json(['message' => 'Invalid hash.'], 400);
        }

        // May throw → the framework answers 500 → the event is delivered again (see the class docblock).
        $outcome = $handler->handle(PayuWebhookHandler::eventId($kind, $payload), $kind, $payload);

        return response()->json(['status' => $outcome]);
    }
}
