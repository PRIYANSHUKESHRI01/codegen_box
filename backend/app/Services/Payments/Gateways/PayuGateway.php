<?php

namespace App\Services\Payments\Gateways;

use App\Models\PaymentOrder;
use App\Models\User;
use App\Services\Payments\Contracts\PaymentGateway;
use App\Services\Payments\GatewayPayment;
use App\Services\Payments\GatewayRefund;
use App\Services\Payments\GatewayRequestException;
use App\Services\Payments\PayuClient;
use App\Services\Payments\PaymentException;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * PayU Hosted Checkout (docs/payments-payu.md), behind the common gateway contract.
 *
 * Unlike Razorpay there is no "create an order first" call: the transaction id (`txnid`) is ours, and
 * PayU first hears of it when the student's browser POSTs the checkout form to PayU's page. So
 * `openOrder()` makes no network call — it only derives the txnid — and `checkoutPayload()` returns the
 * signed form the browser submits. What the student then does on PayU's page, and whether it worked, is
 * learned afterwards from three independent reporters (the browser's return POST, PayU's webhook, the
 * reconcile job) that all converge on `paymentsFor()`: PayU's own answer to "what happened to txnid X",
 * asked server-to-server and signed with the Salt. Nothing the browser says is believed on its own.
 *
 * One transaction id per attempt: PayU refuses a txnid it has already taken to a bank, so an abandoned
 * checkout is never handed back (`reusesOpenOrders()` is false) and every "Buy" click is a new row.
 */
class PayuGateway implements PaymentGateway
{
    /** PayU's limit on the transaction id. A ULID is 26 characters; its first 25 are still unique (50+ bits of time and randomness). */
    private const TXNID_LENGTH = 25;

    public function __construct(private readonly PayuClient $client) {}

    public function code(): string
    {
        return PaymentOrder::GATEWAY_PAYU;
    }

    public function label(): string
    {
        return 'PayU';
    }

    public function isConfigured(): bool
    {
        return $this->client->isConfigured();
    }

    /** Payment webhooks are authenticated by the same Salt as everything else, so configured means "can be checked". */
    public function isWebhookConfigured(): bool
    {
        return $this->client->isConfigured();
    }

    public function mode(): string
    {
        return $this->client->mode();
    }

    public function credentialsId(): string
    {
        return $this->client->key();
    }

    public function reusesOpenOrders(): bool
    {
        return false;
    }

    public function expireAfterMinutes(): int
    {
        return max(15, (int) config('billing.payu.order_ttl_minutes', 60));
    }

    /**
     * PayU's hosted page needs the buyer's mobile number (it is what the bank's OTP and PayU's own fraud
     * checks run on) and caps the email at 50 characters. Neither is something to guess: a missing phone
     * is asked for (the student types one in, `phone_required`), never invented.
     */
    public function prepareBuyer(User $user, array $input): array
    {
        $returnUrl = $this->client->returnUrl();

        if (strlen($returnUrl) > PayuClient::MAX_RETURN_URL_LENGTH) {
            Log::critical('PayU return URL is longer than the 50 characters PayU allows — set PAYU_RETURN_URL to a shorter address', [
                'length' => strlen($returnUrl),
            ]);

            throw PaymentException::unavailable();
        }

        $email = trim((string) $user->email);

        if ($email === '' || strlen($email) > 50) {
            throw new PaymentException(
                'Your account email is too long for our payment partner. Please change it in Settings, or contact support.',
                PaymentException::EMAIL_UNSUPPORTED,
                422,
            );
        }

        $phone = $this->normalizePhone($input['phone'] ?? null) ?? $this->normalizePhone($user->phone);

        if ($phone === null) {
            throw new PaymentException(
                'Please add your mobile number — your bank sends the payment OTP to it and PayU needs it for your receipt.',
                PaymentException::PHONE_REQUIRED,
                422,
            );
        }

        return ['payer_phone' => $phone];
    }

    /**
     * Nothing to create at PayU yet; the transaction id is ours. Derived from the order's ULID so a support
     * agent can go from a PayU transaction to our reference (and back) by eye.
     */
    public function openOrder(int $amountPaise, string $currency, string $publicId, array $notes = []): array
    {
        return ['id' => substr($publicId, 0, self::TXNID_LENGTH)];
    }

    /**
     * The form the browser POSTs to PayU. Everything in it was decided here: the amount comes from the order
     * we priced, and the hash covers the amount, txnid and buyer — if any of it is edited on the way, PayU
     * rejects the request. The Salt is not in it (only a hash made with the Salt is).
     */
    public function checkoutPayload(PaymentOrder $order, User $user): array
    {
        $returnUrl = $this->client->returnUrl();

        $fields = [
            'key' => $this->client->key(),
            'txnid' => $order->gateway_order_id,
            'amount' => $this->client->rupees($order->amount_paise),
            'productinfo' => $this->productInfo($order),
            'firstname' => $this->firstName((string) ($order->payer_name ?: $user->name)),
            'email' => (string) ($order->payer_email ?: $user->email),
            'phone' => (string) ($order->meta['payer_phone'] ?? $this->normalizePhone($user->phone) ?? ''),
            'surl' => $returnUrl,
            'furl' => $returnUrl,
            'curl' => $returnUrl,
            // udf1 carries our reference through PayU and back, inside the signed part of the request.
            'udf1' => $order->public_id,
        ];

        $fields['hash'] = $this->client->requestHash($fields);

        return [
            'gateway' => $this->code(),
            'action' => $this->client->checkoutUrl(),
            'method' => 'POST',
            'fields' => $fields,
            'amount' => $order->amount_paise,
            'currency' => $order->currency,
            'reference' => $order->public_id,
            'test_mode' => $order->gateway_mode !== 'live',
        ];
    }

    /**
     * PayU's answer for this transaction id: zero payments when it has never been to PayU's page, otherwise
     * one (PayU reports the transaction, not each attempt inside it).
     */
    public function paymentsFor(PaymentOrder $order): array
    {
        $entry = $this->client->verifyPayment($order->gateway_order_id);

        if ($entry === null) {
            return [];
        }

        return [$this->normalizePayment($entry + ['txnid' => $order->gateway_order_id])];
    }

    /** PayU captures on its own (an account on pre-authorisation settles from its dashboard), so there is nothing to do. */
    public function capture(GatewayPayment $payment): GatewayPayment
    {
        return $payment;
    }

    /**
     * Asks PayU to send the money back. PayU only QUEUES it — whether it reached the customer is reported
     * later by the refund webhook — so a failure after this point is handled by CheckoutService::revertRefund().
     *
     * The refund token is derived from the order, not random: a call that timed out and is made again carries
     * the same token, which PayU refuses ("token already used") instead of refunding twice.
     */
    public function refund(PaymentOrder $order, ?int $amountPaise, string $reason): GatewayRefund
    {
        if (blank($order->gateway_payment_id)) {
            throw new GatewayRequestException('This order has no PayU payment to refund.');
        }

        $amount = $amountPaise ?? $order->amount_paise;
        $token = $amount >= $order->amount_paise
            ? 'RF'.substr($order->public_id, 0, 21)
            : substr('RP'.substr($order->public_id, 0, 12).$amount, 0, 23);

        $answer = $this->client->refund((string) $order->gateway_payment_id, $token, $amount, $reason);

        return new GatewayRefund((string) ($answer['request_id'] ?? $answer['txn_update_id'] ?? $token), $amount, $reason);
    }

    /**
     * A PayU transaction record (verify_payment's answer, or the fields of a success/failure webhook) as a
     * GatewayPayment.
     *
     * `status` is PayU's own verdict and the one its docs say orders must be mapped from: `success` is paid
     * (whether PayU calls the state `captured`, or `auth` on a pre-authorisation account). Failure covers what
     * PayU really finished as failed. The states that are merely "the student has not paid (yet)" — initiated,
     * in progress, bounced (they never pressed Pay), userCancelled — are PENDING, not failures: they must not
     * be written into someone's payment history as a decline, and a student still on PayU's page may yet pay.
     *
     * @param  array<string, mixed>  $raw
     */
    public function normalizePayment(array $raw): GatewayPayment
    {
        $status = strtolower(trim((string) ($raw['status'] ?? '')));
        $unmapped = strtolower(trim((string) ($raw['unmappedstatus'] ?? '')));

        $mapped = match (true) {
            $status === 'success' && in_array($unmapped, ['', 'captured', 'auth'], true) => GatewayPayment::CAPTURED,
            in_array($unmapped, ['failed', 'dropped', 'autorefund'], true) => GatewayPayment::FAILED,
            $status === 'failure' && ! in_array($unmapped, ['bounced', 'usercancelled', 'initiated', 'in progress', 'inprogress', 'pending'], true) => GatewayPayment::FAILED,
            default => GatewayPayment::PENDING,
        };

        // The amount the cart was priced at, as PayU records it. `amt` can be the post-discount figure when a
        // PayU offer applied, so the original (`transaction_amount` / the webhook's `amount`) comes first.
        $amount = $raw['transaction_amount'] ?? $raw['amount'] ?? $raw['amt'] ?? null;

        $errorCode = trim((string) ($raw['error_code'] ?? $raw['error'] ?? ''));
        $errorText = trim((string) ($raw['error_Message'] ?? $raw['error_message'] ?? $raw['field9'] ?? ''));

        return new GatewayPayment(
            id: trim((string) ($raw['mihpayid'] ?? '')),
            orderId: trim((string) ($raw['txnid'] ?? '')),
            status: $mapped,
            amountPaise: $amount === null ? -1 : PayuClient::toPaise($amount),
            currency: 'INR',
            method: $this->method($raw['mode'] ?? null),
            errorCode: ($errorCode === '' || $errorCode === 'E000') ? null : Str::limit($errorCode, 80, ''),
            errorDescription: ($errorText === '' || strcasecmp($errorText, 'no error') === 0) ? null : Str::limit($errorText, 500, ''),
        );
    }

    // ───────────────────────────── PayU-only helpers ─────────────────────────────

    /** PayU's `mode` codes in the same words Razorpay uses, so history and the admin panel read the same either way. */
    private function method(mixed $mode): ?string
    {
        $mode = strtoupper(trim((string) $mode));

        return match ($mode) {
            '' => null,
            'CC', 'DC' => 'card',
            'NB' => 'netbanking',
            'UPI' => 'upi',
            'CASH' => 'wallet',
            'EMI', 'CLEMI' => 'emi',
            'BNPL' => 'paylater',
            'NEFTRTGS' => 'bank_transfer',
            'QR' => 'qr',
            default => Str::limit(strtolower($mode), 30, ''),
        };
    }

    /** "+91 98765-43210" / "098765 43210" / "9876543210" → "9876543210". Null when it cannot be a mobile number. */
    private function normalizePhone(mixed $phone): ?string
    {
        $digits = preg_replace('/\D+/', '', (string) $phone) ?? '';

        if (strlen($digits) === 12 && str_starts_with($digits, '91')) {
            $digits = substr($digits, 2);
        } elseif (strlen($digits) === 11 && str_starts_with($digits, '0')) {
            $digits = substr($digits, 1);
        }

        return strlen($digits) >= 10 && strlen($digits) <= 15 ? $digits : null;
    }

    /** PayU rejects most punctuation in `firstname` and caps it at 20 characters in its sandbox (60 live). */
    private function firstName(string $name): string
    {
        $first = preg_split('/\s+/', trim($name), -1, PREG_SPLIT_NO_EMPTY)[0] ?? '';
        $clean = (string) preg_replace('/[^A-Za-z0-9]/', '', Str::ascii($first));

        return Str::limit($clean !== '' ? $clean : 'Student', 20, '');
    }

    /** "AptRun Expert - 1 year": letters, digits, spaces, dots and hyphens only — a `|` or `&` here would corrupt the hash. */
    private function productInfo(PaymentOrder $order): string
    {
        $text = 'AptRun '.$order->description().' - '.$order->termLabel();

        return Str::limit(trim((string) preg_replace('/[^A-Za-z0-9 .\-]/', '', Str::ascii($text))), 100, '');
    }
}
