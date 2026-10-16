<?php

namespace Tests\Concerns;

use App\Models\PaymentOrder;
use App\Models\User;
use Illuminate\Support\Facades\Http;
use Illuminate\Testing\TestResponse;
use Laravel\Sanctum\Sanctum;
use Tests\Support\FakePayuGateway;

/**
 * PayU for feature tests: test-mode credentials in config, the whole server-to-server API faked in memory
 * (FakePayuGateway), and helpers that drive a purchase the way the browser and PayU do —
 * open checkout → the browser POSTs the signed form to PayU → the customer pays → PayU POSTs back to us.
 *
 * Call `$this->setUpPayu()` from setUp(). Pass `configured: false` to test the "payments are not set up
 * yet" state, `webhookToken: false` for a webhook URL with no secret on it.
 */
trait FakesPayu
{
    protected FakePayuGateway $payu;

    protected function setUpPayu(bool $configured = true, bool $webhookToken = true): void
    {
        config([
            'billing.gateway' => 'payu',
            'billing.payu.key' => $configured ? FakePayuGateway::KEY : null,
            'billing.payu.salt' => $configured ? FakePayuGateway::SALT : null,
            'billing.payu.mode' => 'test',
            'billing.payu.webhook_token' => $webhookToken ? FakePayuGateway::WEBHOOK_TOKEN : null,
            'billing.payu.webhook_allowed_ips' => null,
            'billing.payu.return_url' => 'https://api.aptrun.test/api/payu/return',
            'billing.payu.checkout_url' => null,
            'billing.payu.api_url' => null,
            'app.frontend_url' => 'https://app.aptrun.test',
        ]);

        // A request to any host nobody faked (a real gateway!) must fail the test, not leave the machine.
        Http::preventStrayRequests();

        $this->payu = (new FakePayuGateway)->install();
    }

    /** POST /api/me/checkout as the signed-in student. */
    protected function openPayuCheckout(string $planCode, array $extra = []): TestResponse
    {
        return $this->postJson('/api/me/checkout', ['plan_code' => $planCode] + $extra);
    }

    /**
     * Opens a checkout and has the browser POST the signed form to PayU's page. Nothing is paid yet.
     *
     * @return array{order: PaymentOrder, fields: array<string, string>, txnid: string}
     */
    protected function startPayuPayment(User $student, string $planCode, array $extra = []): array
    {
        Sanctum::actingAs($student);

        $response = $this->openPayuCheckout($planCode, $extra)->assertCreated();
        $fields = $response->json('checkout.fields');
        $this->payu->submitCheckout($fields);

        return [
            'order' => PaymentOrder::where('gateway_order_id', $fields['txnid'])->firstOrFail(),
            'fields' => $fields,
            'txnid' => $fields['txnid'],
        ];
    }

    /** PayU POSTing the student's browser back to our return URL with `$fields`. */
    protected function payuReturn(array $fields): TestResponse
    {
        return $this->post('/api/payu/return', $fields);
    }

    /**
     * The whole happy path: open → submit to PayU → pay → the browser comes back. Leaves the student on the plan.
     */
    protected function purchaseThroughPayu(User $student, string $planCode): PaymentOrder
    {
        $started = $this->startPayuPayment($student, $planCode);
        $this->payu->pay($started['txnid']);
        $this->payuReturn($this->payu->responseFields($started['txnid']))->assertRedirect();

        return $started['order']->refresh();
    }

    /** A payment webhook (form-encoded, signed) delivered to us. */
    protected function deliverPayuPaymentWebhook(array $fields, bool $withToken = true): TestResponse
    {
        return $this->post('/api/webhooks/payu'.($withToken ? '?token='.FakePayuGateway::WEBHOOK_TOKEN : ''), $fields);
    }

    /** A refund / dispute webhook (JSON, unsigned) delivered to us. */
    protected function deliverPayuJsonWebhook(array $payload, ?string $token = FakePayuGateway::WEBHOOK_TOKEN): TestResponse
    {
        $uri = '/api/webhooks/payu'.($token !== null ? '?token='.$token : '');

        return $this->call('POST', $uri, [], [], [], ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT' => 'application/json'], (string) json_encode($payload));
    }
}
