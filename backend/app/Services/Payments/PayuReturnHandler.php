<?php

namespace App\Services\Payments;

use App\Models\PaymentOrder;
use App\Services\Payments\Gateways\PayuGateway;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * The student's browser coming back from PayU's hosted page: PayU POSTs the result to our return URL
 * (`surl` / `furl` / `curl` are all the same address) and the student's browser carries it.
 *
 * That POST has travelled through the browser, so on its own it proves nothing. A plan is handed over only
 * because PayU is asked directly, server to server, what happened to that transaction (verify_payment,
 * signed with the Salt). THAT answer — never the posted `status`, however well it is signed — settles the
 * order, so a forged return can at worst make us ask PayU a question.
 *
 * The posted response hash (it proves PayU wrote the POST, and that the amount and transaction id in it
 * were not edited on the way) decides only how far the POST's WORDING is believed: a return that fails it
 * is logged as suspicious and its claimed status and "cancelled" flag are ignored. Because PayU's API is
 * the authority either way, a hash layout this code does not know can never strand a student who has paid.
 *
 * This handler must never throw or return an error page: the person on the other end has just paid
 * (or tried to) and is staring at a browser tab. Whatever goes wrong, they are sent back to the app,
 * where the order's real state is read from our API; the webhook and the reconcile job finish
 * anything this could not.
 */
class PayuReturnHandler
{
    public function __construct(
        private readonly PayuClient $client,
        private readonly PayuGateway $gateway,
        private readonly CheckoutService $checkout,
    ) {}

    /**
     * @param  array<string, mixed>  $post  what PayU's POST carried
     * @return array{reference: ?string, result: string} `result` is only a hint for the page the student lands on
     *                                                    (paid | processing | failed | cancelled | pending | invalid | unknown) —
     *                                                    the page asks the API for the truth
     */
    public function handle(array $post): array
    {
        $txnid = trim((string) ($post['txnid'] ?? ''));

        $order = $txnid === ''
            ? null
            : PaymentOrder::where('gateway', PaymentOrder::GATEWAY_PAYU)->where('gateway_order_id', $txnid)->first();

        if ($order === null) {
            Log::warning('PayU return for a transaction we do not know', ['txnid' => mb_substr($txnid, 0, 40)]);

            return ['reference' => null, 'result' => 'unknown'];
        }

        $signed = $this->client->verifyResponseHash($post);

        if (! $signed) {
            // Someone typed this request, or PayU's hash layout changed. Nothing in the POST is believed — but PayU
            // is still asked below, because only its API can say whether the student really paid.
            Log::warning('PayU return carries a response hash that does not match — its wording is ignored, PayU is asked instead', ['order' => $order->public_id]);
        }

        try {
            $payments = $this->gateway->paymentsFor($order);

            $order = $payments === []
                ? $order->refresh()
                : $this->checkout->settleFromGateway($order, $payments[0]);
        } catch (GatewayRequestException) {
            // PayU's API could not be reached just now. The student has probably paid; do not say otherwise.
            return ['reference' => $order->public_id, 'result' => 'pending'];
        } catch (Throwable $e) {
            // e.g. the database hiccuped while handing over the plan: it is retried by the webhook / reconcile job.
            report($e);

            return ['reference' => $order->public_id, 'result' => 'pending'];
        }

        return ['reference' => $order->public_id, 'result' => $this->resultFor($order, $post, $signed)];
    }

    /**
     * @param  array<string, mixed>  $post
     */
    private function resultFor(PaymentOrder $order, array $post, bool $signed): string
    {
        if ($order->isPaid()) {
            return 'paid';
        }

        if ($order->status === PaymentOrder::STATUS_NEEDS_REVIEW) {
            return 'processing';
        }

        // Not paid, per PayU. A signed POST says how it ended, which only changes the wording shown; an unsigned
        // one is not believed even for that — what we recorded from PayU's own answer is.
        if ($signed && strtolower((string) ($post['unmappedstatus'] ?? '')) === 'usercancelled') {
            return 'cancelled';
        }

        $failed = $signed ? strtolower((string) ($post['status'] ?? '')) === 'failure' : $order->failure_code !== null;

        return $failed ? 'failed' : 'pending';
    }
}
