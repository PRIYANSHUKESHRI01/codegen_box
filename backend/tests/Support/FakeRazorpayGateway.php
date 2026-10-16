<?php

namespace Tests\Support;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;

/**
 * An in-memory Razorpay: just enough of its REST API (orders, payments, capture, refund,
 * the "payments of an order" list) to run the real RazorpayClient + CheckoutService against,
 * with the same entity shapes, status names and error format the docs describe.
 *
 * It is stateful on purpose — a payment created here is what GET /payments/:id returns, a
 * refund flips the payment to `refunded` — so a test reads like the real sequence of events
 * rather than a list of canned responses. Requests must carry the right Basic-auth key pair,
 * like the real API, or they get Razorpay's 401 error body.
 */
class FakeRazorpayGateway
{
    public const KEY_ID = 'rzp_test_FakeKeyId0001';

    public const KEY_SECRET = 'fake_key_secret_for_tests';

    public const WEBHOOK_SECRET = 'fake_webhook_secret_for_tests';

    /** @var array<string, array<string, mixed>> order id => entity */
    public array $orders = [];

    /** @var array<string, array<string, mixed>> payment id => entity */
    public array $payments = [];

    /** @var array<string, array<string, mixed>> refund id => entity */
    public array $refunds = [];

    /** Every call fails as if the network were down. */
    public bool $down = false;

    /** @var array<string, int> "METHOD /path-suffix" => HTTP status to answer with instead, until cleared */
    public array $failures = [];

    private int $sequence = 0;

    /** Route every Razorpay API call to this fake. Call once per test. */
    public function install(): self
    {
        Http::fake(['api.razorpay.com/*' => fn (Request $request) => $this->handle($request)]);

        return $this;
    }

    // ───────────────────────────── what a test does to the "gateway" ─────────────────────────────

    /**
     * The student pays an order. Defaults to a successful, auto-captured card payment for the
     * order's exact amount; override any field to model a decline, a short payment, manual capture…
     *
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed> the payment entity
     */
    public function pay(string $orderId, array $overrides = []): array
    {
        $order = $this->orders[$orderId] ?? throw new \RuntimeException("Unknown order {$orderId}");

        $status = $overrides['status'] ?? 'captured';

        $payment = array_merge([
            'id' => 'pay_Fake'.str_pad((string) ++$this->sequence, 8, '0', STR_PAD_LEFT),
            'entity' => 'payment',
            'amount' => $order['amount'],
            'currency' => $order['currency'],
            'status' => $status,
            'order_id' => $orderId,
            'method' => 'card',
            'captured' => $status === 'captured',
            'email' => 'student@example.com',
            'contact' => '+919999999999',
            'fee' => $status === 'captured' ? (int) round($order['amount'] * 0.02) : null,
            'tax' => $status === 'captured' ? (int) round($order['amount'] * 0.02 * 0.18) : null,
            'error_code' => null,
            'error_description' => null,
            'created_at' => time(),
        ], $overrides);

        $this->payments[$payment['id']] = $payment;
        $this->orders[$orderId]['status'] = $status === 'captured' ? 'paid' : 'attempted';
        $this->orders[$orderId]['attempts'] = ($this->orders[$orderId]['attempts'] ?? 0) + 1;

        return $payment;
    }

    /** A failed attempt (declined card…), the way Razorpay reports one. */
    public function fail(string $orderId, string $description = 'Your payment was declined by the bank.'): array
    {
        return $this->pay($orderId, [
            'status' => 'failed',
            'captured' => false,
            'error_code' => 'BAD_REQUEST_ERROR',
            'error_description' => $description,
        ]);
    }

    public function lastOrderId(): string
    {
        return (string) array_key_last($this->orders);
    }

    /** The three fields Checkout's success handler hands the browser. */
    public function callback(array $payment, ?string $signature = null): array
    {
        return [
            'razorpay_order_id' => $payment['order_id'],
            'razorpay_payment_id' => $payment['id'],
            'razorpay_signature' => $signature ?? $this->signature($payment['order_id'], $payment['id']),
        ];
    }

    public function signature(string $orderId, string $paymentId): string
    {
        return hash_hmac('sha256', $orderId.'|'.$paymentId, self::KEY_SECRET);
    }

    /** Number of API calls made so far, e.g. `calls('POST', '/orders')`. */
    public function calls(string $method, string $pathSuffix): int
    {
        return Http::recorded()->filter(function (array $pair) use ($method, $pathSuffix) {
            /** @var Request $request */
            [$request] = $pair;

            return $request->method() === $method && str_ends_with(parse_url($request->url(), PHP_URL_PATH), $pathSuffix);
        })->count();
    }

    // ───────────────────────────── webhook bodies ─────────────────────────────

    /**
     * A webhook delivery as Razorpay would send it: the exact raw body and its signature.
     *
     * @param  array<string, mixed>  $entities  any of `payment`, `order`, `refund` entities
     * @return array{body: string, signature: string, event_id: string}
     */
    public function webhook(string $event, array $entities, ?string $eventId = null): array
    {
        $payload = [];
        foreach ($entities as $name => $entity) {
            $payload[$name] = ['entity' => $entity];
        }

        $body = json_encode([
            'entity' => 'event',
            'account_id' => 'acc_FakeAccount01',
            'event' => $event,
            'contains' => array_keys($entities),
            'payload' => $payload,
            'created_at' => time(),
        ], JSON_UNESCAPED_SLASHES);

        return [
            'body' => $body,
            'signature' => hash_hmac('sha256', $body, self::WEBHOOK_SECRET),
            'event_id' => $eventId ?? 'evt_Fake'.str_pad((string) ++$this->sequence, 8, '0', STR_PAD_LEFT),
        ];
    }

    // ───────────────────────────── the fake API ─────────────────────────────

    private function handle(Request $request)
    {
        if ($this->down) {
            throw new ConnectionException('cURL error 7: Failed to connect to api.razorpay.com (fake outage)');
        }

        $path = (string) preg_replace('#^/v1#', '', parse_url($request->url(), PHP_URL_PATH));
        $method = $request->method();
        $data = $request->data();

        foreach ($this->failures as $signature => $status) {
            [$failMethod, $failSuffix] = explode(' ', $signature, 2);
            if ($failMethod === $method && str_ends_with($path, $failSuffix)) {
                return $this->error($status, 'SERVER_ERROR', 'The gateway had a problem (injected by the test).');
            }
        }

        $expected = 'Basic '.base64_encode(self::KEY_ID.':'.self::KEY_SECRET);
        if (($request->header('Authorization')[0] ?? '') !== $expected) {
            return $this->error(401, 'BAD_REQUEST_ERROR', 'The api key provided is invalid');
        }

        if ($method === 'POST' && $path === '/orders') {
            return $this->createOrder($data);
        }

        if ($method === 'GET' && preg_match('#^/payments/([^/]+)$#', $path, $m)) {
            return isset($this->payments[$m[1]])
                ? Http::response($this->payments[$m[1]])
                : $this->error(400, 'BAD_REQUEST_ERROR', 'The id provided does not exist');
        }

        if ($method === 'GET' && preg_match('#^/orders/([^/]+)/payments$#', $path, $m)) {
            $items = array_values(array_filter($this->payments, fn ($p) => $p['order_id'] === $m[1]));

            return Http::response(['entity' => 'collection', 'count' => count($items), 'items' => $items]);
        }

        if ($method === 'POST' && preg_match('#^/payments/([^/]+)/capture$#', $path, $m)) {
            return $this->capture($m[1], $data);
        }

        if ($method === 'POST' && preg_match('#^/payments/([^/]+)/refund$#', $path, $m)) {
            return $this->refund($m[1], $data);
        }

        return $this->error(404, 'BAD_REQUEST_ERROR', "The requested URL was not found: {$method} {$path}");
    }

    private function createOrder(array $data)
    {
        $amount = (int) ($data['amount'] ?? 0);

        if ($amount < 100) {
            return $this->error(400, 'BAD_REQUEST_ERROR', 'Order amount less than minimum amount allowed');
        }

        $id = 'order_Fake'.str_pad((string) ++$this->sequence, 8, '0', STR_PAD_LEFT);

        return Http::response($this->orders[$id] = [
            'id' => $id,
            'entity' => 'order',
            'amount' => $amount,
            'amount_paid' => 0,
            'amount_due' => $amount,
            'currency' => $data['currency'] ?? 'INR',
            'receipt' => $data['receipt'] ?? null,
            'offer_id' => null,
            'status' => 'created',
            'attempts' => 0,
            'notes' => $data['notes'] ?? [],
            'created_at' => time(),
        ]);
    }

    private function capture(string $paymentId, array $data)
    {
        $payment = $this->payments[$paymentId] ?? null;

        if ($payment === null) {
            return $this->error(400, 'BAD_REQUEST_ERROR', 'The id provided does not exist');
        }

        if ($payment['status'] === 'captured') {
            return $this->error(400, 'BAD_REQUEST_ERROR', 'This payment has already been captured');
        }

        if ($payment['status'] !== 'authorized' || (int) ($data['amount'] ?? 0) !== $payment['amount']) {
            return $this->error(400, 'BAD_REQUEST_ERROR', 'The amount must be equal to the authorized amount');
        }

        $this->payments[$paymentId]['status'] = 'captured';
        $this->payments[$paymentId]['captured'] = true;
        $this->orders[$payment['order_id']]['status'] = 'paid';

        return Http::response($this->payments[$paymentId]);
    }

    private function refund(string $paymentId, array $data)
    {
        $payment = $this->payments[$paymentId] ?? null;

        if ($payment === null) {
            return $this->error(400, 'BAD_REQUEST_ERROR', 'The id provided does not exist');
        }

        if ($payment['status'] === 'refunded') {
            return $this->error(400, 'BAD_REQUEST_ERROR', 'The payment has been fully refunded already');
        }

        if ($payment['status'] !== 'captured') {
            return $this->error(400, 'BAD_REQUEST_ERROR', 'The payment is not captured, so it cannot be refunded');
        }

        $amount = (int) ($data['amount'] ?? $payment['amount']);
        $id = 'rfnd_Fake'.str_pad((string) ++$this->sequence, 8, '0', STR_PAD_LEFT);

        $this->refunds[$id] = [
            'id' => $id,
            'entity' => 'refund',
            'amount' => $amount,
            'currency' => $payment['currency'],
            'payment_id' => $paymentId,
            'notes' => $data['notes'] ?? [],
            'receipt' => $data['receipt'] ?? null,
            'status' => 'processed',
            'speed_processed' => 'normal',
            'created_at' => time(),
        ];

        if ($amount >= $payment['amount']) {
            $this->payments[$paymentId]['status'] = 'refunded';
        }

        return Http::response($this->refunds[$id]);
    }

    private function error(int $status, string $code, string $description)
    {
        return Http::response(['error' => [
            'code' => $code,
            'description' => $description,
            'source' => 'business',
            'step' => 'payment_initiation',
            'reason' => 'input_validation_failed',
            'metadata' => [],
        ]], $status);
    }
}
