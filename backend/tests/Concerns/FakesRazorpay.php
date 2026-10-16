<?php

namespace Tests\Concerns;

use App\Models\PaymentOrder;
use App\Models\User;
use Illuminate\Testing\TestResponse;
use Tests\Support\FakeRazorpayGateway;

/**
 * Razorpay for feature tests: test-mode keys in config, the whole REST API faked in memory
 * (FakeRazorpayGateway), and helpers that drive a purchase the way the browser and Razorpay do.
 *
 * Call `$this->setUpRazorpay()` from setUp(). Pass `configured: false` to test the
 * "payments are not set up yet" state, `webhookSecret: false` for a missing webhook secret.
 */
trait FakesRazorpay
{
    protected FakeRazorpayGateway $razorpay;

    protected function setUpRazorpay(bool $configured = true, bool $webhookSecret = true): void
    {
        config([
            // PayU is the default gateway now; these tests are about the Razorpay one, so they select it the way .env would.
            'billing.gateway' => 'razorpay',
            'billing.razorpay.key_id' => $configured ? FakeRazorpayGateway::KEY_ID : null,
            'billing.razorpay.key_secret' => $configured ? FakeRazorpayGateway::KEY_SECRET : null,
            'billing.razorpay.webhook_secret' => $webhookSecret ? FakeRazorpayGateway::WEBHOOK_SECRET : null,
            'billing.razorpay.api_base' => 'https://api.razorpay.com/v1',
        ]);

        $this->razorpay = (new FakeRazorpayGateway)->install();
    }

    /** POST /api/me/checkout as the signed-in student. */
    protected function openCheckout(string $planCode, ?int $expectedTotal = null): TestResponse
    {
        return $this->postJson('/api/me/checkout', array_filter([
            'plan_code' => $planCode,
            'expected_total' => $expectedTotal,
        ], fn ($v) => $v !== null));
    }

    /**
     * Opens a checkout, pays it at the fake gateway and returns everything a test needs.
     * Nothing is verified yet — that is the browser's callback or a webhook, whichever the test wants.
     *
     * @param  array<string, mixed>  $paymentOverrides
     * @return array{order: PaymentOrder, payment: array<string, mixed>, callback: array<string, string>}
     */
    protected function payFor(User $student, string $planCode, array $paymentOverrides = []): array
    {
        \Laravel\Sanctum\Sanctum::actingAs($student);

        $response = $this->openCheckout($planCode)->assertCreated();
        $order = PaymentOrder::where('gateway_order_id', $response->json('checkout.order_id'))->firstOrFail();
        $payment = $this->razorpay->pay($order->gateway_order_id, $paymentOverrides);

        return ['order' => $order, 'payment' => $payment, 'callback' => $this->razorpay->callback($payment)];
    }

    /** The whole happy path: open → pay → the browser's verify call. Leaves the student on the plan. */
    protected function purchaseThroughRazorpay(User $student, string $planCode): PaymentOrder
    {
        $paid = $this->payFor($student, $planCode);

        $this->postJson('/api/me/checkout/verify', $paid['callback'])->assertOk();

        return $paid['order']->refresh();
    }

    /**
     * Razorpay delivering a webhook to us.
     *
     * @param  array<string, mixed>  $entities
     */
    protected function deliverWebhook(string $event, array $entities, ?string $eventId = null, bool $validSignature = true): TestResponse
    {
        $delivery = $this->razorpay->webhook($event, $entities, $eventId);

        return $this->deliverRawWebhook($delivery['body'], $validSignature ? $delivery['signature'] : 'deadbeef', $delivery['event_id']);
    }

    protected function deliverRawWebhook(string $body, ?string $signature, ?string $eventId = 'evt_test_1'): TestResponse
    {
        $server = ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT' => 'application/json'];

        if ($signature !== null) {
            $server['HTTP_X_RAZORPAY_SIGNATURE'] = $signature;
        }

        if ($eventId !== null) {
            $server['HTTP_X_RAZORPAY_EVENT_ID'] = $eventId;
        }

        return $this->call('POST', '/api/webhooks/razorpay', [], [], [], $server, $body);
    }
}
