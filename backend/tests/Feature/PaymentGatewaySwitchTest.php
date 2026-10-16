<?php

namespace Tests\Feature;

use App\Models\PaymentOrder;
use App\Models\User;
use App\Services\Payments\Contracts\PaymentGateway;
use App\Services\Payments\GatewayManager;
use App\Services\Payments\GatewayRequestException;
use App\Services\Payments\Gateways\PayuGateway;
use App\Services\Payments\Gateways\RazorpayGateway;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\CreatesProjectLabFixtures;
use Tests\Concerns\FakesPayu;
use Tests\Concerns\FakesRazorpay;
use Tests\Support\FakePayuGateway;
use Tests\Support\FakeRazorpayGateway;
use Tests\TestCase;

/**
 * Both gateways live side by side in the code and `PAYMENT_GATEWAY` picks the one that opens NEW checkouts.
 * What must hold when that setting changes:
 *
 *   - a checkout is opened on the gateway that is active, and has that gateway's shape
 *   - an order keeps belonging to the gateway it was opened on: its payment, webhook, re-check and refund still
 *     go through THAT gateway, so flipping the setting strands nothing that is in flight
 *   - a student's open order on one gateway is never handed back as if it were the other's
 *   - the reconcile job looks after both
 */
class PaymentGatewaySwitchTest extends TestCase
{
    use CreatesProjectLabFixtures;
    use FakesPayu;
    use FakesRazorpay;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedPlans();
        $this->seedStarterPlan();
        $this->setUpRazorpay();
        $this->setUpPayu();      // both configured, both faked; PayU selected last
        Mail::fake();
    }

    private function useGateway(string $code): void
    {
        config(['billing.gateway' => $code]);
    }

    private function planOf(User $user): string
    {
        return $user->fresh()->activeSubscription()->plan->code;
    }

    private function payer(): User
    {
        return $this->student(['name' => 'Asha Rao', 'email' => 'asha@example.com', 'phone' => '9876543210']);
    }

    public function test_the_manager_knows_both_gateways_and_refuses_unknown_ones(): void
    {
        $manager = app(GatewayManager::class);

        $this->assertSame(['payu', 'razorpay'], array_keys($manager->all()));
        $this->assertInstanceOf(PayuGateway::class, $manager->get('payu'));
        $this->assertInstanceOf(RazorpayGateway::class, $manager->get('razorpay'));
        $this->assertContainsOnlyInstancesOf(PaymentGateway::class, $manager->all());

        $this->expectException(GatewayRequestException::class);
        $manager->get('stripe');
    }

    public function test_the_active_gateway_follows_the_setting_case_insensitively_and_unknown_means_none(): void
    {
        $manager = app(GatewayManager::class);

        $this->useGateway('PayU');
        $this->assertSame('payu', $manager->active()->code());

        $this->useGateway('razorpay');
        $this->assertSame('razorpay', $manager->active()->code());

        $this->useGateway('cashfree');
        $this->assertNull($manager->active());
    }

    public function test_a_blank_gateway_setting_means_the_default_not_an_unknown_gateway(): void
    {
        // `PAYMENT_GATEWAY=` left empty in .env reaches config as "" (not as "unset"): it must mean PayU, never "payments off".
        $manager = app(GatewayManager::class);

        foreach (['', '   '] as $blank) {
            $this->useGateway($blank);
            $this->assertSame('payu', $manager->active()?->code(), 'blank = the default gateway');
        }
    }

    public function test_a_checkout_is_opened_on_the_active_gateway_with_that_gateways_shape(): void
    {
        Sanctum::actingAs($this->payer());

        $this->useGateway('payu');
        $payu = $this->openPayuCheckout('starter')->assertCreated();
        $payu->assertJsonPath('checkout.gateway', 'payu')->assertJsonPath('checkout.method', 'POST');
        $this->assertNull($payu->json('checkout.order_id'), 'there is no Razorpay order behind a PayU form');

        $this->useGateway('razorpay');
        $razorpay = $this->openCheckout('starter')->assertCreated();
        $razorpay->assertJsonPath('checkout.gateway', 'razorpay')->assertJsonPath('checkout.key', FakeRazorpayGateway::KEY_ID);
        $this->assertNull($razorpay->json('checkout.fields'));

        $this->assertSame(['payu', 'razorpay'], PaymentOrder::orderBy('id')->pluck('gateway')->all());
        $this->assertSame(1, $this->razorpay->calls('POST', '/orders'), 'only the Razorpay checkout talked to Razorpay');
        $this->assertSame(0, $this->payu->calls('verify_payment'), 'and PayU is only contacted when the browser gets there');
    }

    public function test_an_open_order_of_one_gateway_is_never_handed_back_as_the_others(): void
    {
        Sanctum::actingAs($this->payer());

        $this->useGateway('razorpay');
        $first = $this->openCheckout('starter')->assertCreated()->json('checkout.order_id');

        $this->useGateway('payu');
        $this->openPayuCheckout('starter')->assertCreated()->assertJsonPath('checkout.gateway', 'payu');

        $this->useGateway('razorpay');
        $again = $this->openCheckout('starter')->assertCreated()->json('checkout.order_id');

        $this->assertSame($first, $again, 'the Razorpay order is still the Razorpay student\'s open order');
        $this->assertSame(1, $this->razorpay->calls('POST', '/orders'));
        $this->assertSame(2, PaymentOrder::count());
    }

    public function test_a_razorpay_order_opened_before_the_switch_to_payu_can_still_be_paid_and_confirmed(): void
    {
        $student = $this->payer();
        $this->useGateway('razorpay');
        $paid = $this->payFor($student, 'expert');

        $this->useGateway('payu');     // the business moves to PayU while this student is mid-payment

        $this->postJson('/api/me/checkout/verify', $paid['callback'])->assertOk()->assertJsonPath('coverage.plan.code', 'expert');

        $order = $paid['order']->refresh();
        $this->assertSame(PaymentOrder::STATUS_PAID, $order->status);
        $this->assertSame('razorpay', $order->gateway);
        $this->assertSame(0, $this->payu->calls('verify_payment'), 'PayU is not asked about a Razorpay payment');
    }

    public function test_a_razorpay_webhook_still_lands_after_the_switch_to_payu(): void
    {
        $student = $this->payer();
        $this->useGateway('razorpay');
        $paid = $this->payFor($student, 'starter');
        $this->useGateway('payu');

        $this->deliverWebhook('payment.captured', ['payment' => $paid['payment']])->assertOk()->assertJsonPath('status', 'processed');

        $this->assertSame('starter', $this->planOf($student));
    }

    public function test_a_payu_order_opened_before_the_switch_to_razorpay_is_still_settled_by_payu(): void
    {
        $student = $this->payer();
        $this->useGateway('payu');
        $started = $this->startPayuPayment($student, 'expert');
        $this->payu->pay($started['txnid']);

        $this->useGateway('razorpay');

        $this->payuReturn($this->payu->responseFields($started['txnid']))->assertRedirect();
        $this->assertSame('expert', $this->planOf($student));
        $this->assertSame('payu', $started['order']->refresh()->gateway);

        // And the student's own status check asks the order's gateway, not the active one.
        Sanctum::actingAs($student);
        $this->getJson('/api/me/payments/'.$started['order']->public_id)->assertOk()->assertJsonPath('payment.status', 'paid');
        $this->assertSame(0, $this->razorpay->calls('GET', '/payments'), 'Razorpay is never asked about a PayU order');
    }

    public function test_one_reconcile_run_looks_after_orders_of_both_gateways(): void
    {
        $razorpayStudent = $this->student(['email' => 'rz@example.com']);
        $payuStudent = $this->payer();

        $this->useGateway('razorpay');
        $rz = $this->payFor($razorpayStudent, 'starter');       // paid at Razorpay, nobody told us

        $this->useGateway('payu');
        $started = $this->startPayuPayment($payuStudent, 'expert');
        $this->payu->pay($started['txnid']);                    // paid at PayU, nobody told us

        PaymentOrder::query()->update(['created_at' => now()->subMinutes(10)]);

        $this->artisan('payments:reconcile')->assertSuccessful();

        $this->assertSame('starter', $this->planOf($razorpayStudent));
        $this->assertSame('expert', $this->planOf($payuStudent));
        $this->assertSame(PaymentOrder::STATUS_PAID, $rz['order']->refresh()->status);
        $this->assertSame(PaymentOrder::STATUS_PAID, $started['order']->refresh()->status);
    }

    public function test_reconcile_skips_a_gateway_that_has_no_credentials_but_still_serves_the_other(): void
    {
        $this->useGateway('payu');
        $student = $this->payer();
        $started = $this->startPayuPayment($student, 'starter');
        $this->payu->pay($started['txnid']);
        PaymentOrder::query()->update(['created_at' => now()->subMinutes(10)]);

        config(['billing.razorpay.key_id' => null, 'billing.razorpay.key_secret' => null]);   // Razorpay left unconfigured

        $this->artisan('payments:reconcile')->assertSuccessful();

        $this->assertSame('starter', $this->planOf($student));
    }

    public function test_superadmin_sees_orders_of_both_gateways_in_one_list_and_can_filter(): void
    {
        $this->useGateway('razorpay');
        $this->purchaseThroughRazorpay($this->student(['email' => 'rz@example.com']), 'starter');

        $this->useGateway('payu');
        $this->purchaseThroughPayu($this->payer(), 'expert');

        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_SUPERADMIN]));

        $all = $this->getJson('/api/superadmin/payments')->assertOk()
            ->assertJsonPath('gateway', 'payu')
            ->assertJsonPath('summary.orders_paid', 2)
            ->assertJsonPath('summary.gross', 1199 + 2999);
        $this->assertEqualsCanonicalizing(['payu', 'razorpay'], collect($all->json('payments'))->pluck('gateway')->all());

        $this->getJson('/api/superadmin/payments?gateway=razorpay')->assertOk()->assertJsonPath('summary.gross', 1199)->assertJsonCount(1, 'payments');
        $this->getJson('/api/superadmin/payments?gateway=payu')->assertOk()->assertJsonPath('summary.gross', 2999)->assertJsonCount(1, 'payments');
    }

    public function test_a_students_history_lists_payments_from_both_gateways(): void
    {
        $student = $this->payer();

        $this->useGateway('razorpay');
        $this->purchaseThroughRazorpay($student, 'starter');

        $this->useGateway('payu');
        $this->purchaseThroughPayu($student->fresh(), 'expert');

        Sanctum::actingAs($student);
        $this->getJson('/api/me/payments')->assertOk()->assertJsonCount(2, 'payments')
            ->assertJsonPath('checkout.gateway', 'payu');
    }

    public function test_the_two_gateways_do_not_see_each_others_ids(): void
    {
        // A webhook that carries a Razorpay-looking order id must not touch a PayU order whose txnid is the same string, and vice versa.
        $student = $this->payer();
        $this->useGateway('payu');
        $started = $this->startPayuPayment($student, 'starter');

        $this->useGateway('razorpay');
        $this->deliverWebhook('payment.captured', ['payment' => [
            'id' => 'pay_Fake99999999', 'order_id' => $started['txnid'], 'status' => 'captured', 'amount' => 119900, 'currency' => 'INR', 'method' => 'card',
        ]])->assertOk()->assertJsonPath('status', 'ignored');

        $this->assertSame('coder', $this->planOf($student));
        $this->assertSame(PaymentOrder::STATUS_CREATED, $started['order']->refresh()->status);
    }

    public function test_payu_secrets_never_appear_in_any_response_the_browser_receives(): void
    {
        $student = $this->payer();
        $this->useGateway('payu');
        Sanctum::actingAs($student);

        $bodies = [
            $this->openPayuCheckout('starter')->getContent(),
            $this->getJson('/api/me/subscription')->getContent(),
            $this->getJson('/api/me/payments')->getContent(),
        ];

        foreach ($bodies as $body) {
            $this->assertStringNotContainsString(FakePayuGateway::SALT, $body);
            $this->assertStringNotContainsString(FakePayuGateway::WEBHOOK_TOKEN, $body);
            $this->assertStringNotContainsString(FakeRazorpayGateway::KEY_SECRET, $body);
        }
    }
}
