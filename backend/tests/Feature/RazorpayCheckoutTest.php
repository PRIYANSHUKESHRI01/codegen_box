<?php

namespace Tests\Feature;

use App\Mail\PaymentReceiptMail;
use App\Models\College;
use App\Models\PaymentOrder;
use App\Models\PaymentWebhookEvent;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use App\Services\Payments\CheckoutService;
use App\Services\SubscriptionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\CreatesProjectLabFixtures;
use Tests\Concerns\FakesRazorpay;
use Tests\Support\FakeRazorpayGateway;
use Tests\TestCase;

/**
 * Paying for a plan on Razorpay Standard Checkout, driven the way the browser and Razorpay drive it,
 * against an in-memory fake of Razorpay's REST API (Tests\Support\FakeRazorpayGateway) — so the real
 * HTTP client, signature checks and fulfilment code all run.
 *
 *   1. opening a checkout    — the server prices it, the browser cannot
 *   2. the success callback  — verify: believed only with a valid signature AND Razorpay's say-so
 *   3. the webhook           — the safety net for a closed tab; idempotent; signature-gated
 *   4. reconcile             — the net under a lost webhook
 *   5. receipts and the superadmin view
 */
class RazorpayCheckoutTest extends TestCase
{
    use CreatesProjectLabFixtures;
    use FakesRazorpay;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedPlans();
        $this->seedStarterPlan();
        $this->setUpRazorpay();
        Mail::fake();
    }

    private function planOf(User $user): string
    {
        return $user->fresh()->activeSubscription()->plan->code;
    }

    private function activeBaseSubscriptions(User $user): int
    {
        return Subscription::where('subscriber_type', User::class)->where('subscriber_id', $user->id)
            ->where('status', Subscription::STATUS_ACTIVE)->whereHas('plan', fn ($q) => $q->where('kind', Plan::KIND_BASE))->count();
    }

    // ───────────────────────────── 1. opening a checkout ─────────────────────────────

    public function test_checkout_needs_a_signed_in_student(): void
    {
        $this->postJson('/api/me/checkout', ['plan_code' => 'starter'])->assertUnauthorized();

        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_ADMIN_TPO]));
        $this->openCheckout('starter')->assertForbidden()->assertJsonPath('code', 'student_only');
        $this->postJson('/api/me/checkout/verify', ['razorpay_order_id' => 'o', 'razorpay_payment_id' => 'p', 'razorpay_signature' => 's'])->assertForbidden();
    }

    public function test_without_razorpay_keys_checkout_says_payments_are_not_set_up_and_never_activates_anything(): void
    {
        $this->setUpRazorpay(configured: false);
        $student = $this->student();
        Sanctum::actingAs($student);

        $this->openCheckout('expert')->assertStatus(503)->assertJsonPath('code', 'payments_unavailable');

        $this->assertSame(0, PaymentOrder::count());
        $this->assertSame('coder', $this->planOf($student), 'no paid plan without money moving');
        $this->getJson('/api/me/subscription')->assertOk()->assertJsonPath('checkout.available', false);
    }

    public function test_the_subscription_payload_tells_the_ui_that_checkout_works_and_which_mode_it_is_in(): void
    {
        Sanctum::actingAs($this->student());

        $this->getJson('/api/me/subscription')->assertOk()
            ->assertJsonPath('checkout.available', true)
            ->assertJsonPath('checkout.test_mode', true);

        config(['billing.razorpay.key_id' => 'rzp_live_RealKey000001']);
        $this->getJson('/api/me/subscription')->assertJsonPath('checkout.test_mode', false);
    }

    public function test_the_old_instant_activation_endpoint_is_gone(): void
    {
        $student = $this->student();
        Sanctum::actingAs($student);

        // Anyone could "buy" Expert for free through this before there was a gateway.
        $this->postJson('/api/me/subscription', ['plan_code' => 'expert'])->assertStatus(405);

        $this->assertSame('coder', $this->planOf($student));
    }

    public function test_opening_a_checkout_creates_a_razorpay_order_for_the_servers_price(): void
    {
        $student = $this->student(['name' => 'Asha Rao', 'email' => 'asha@example.com', 'phone' => '9876543210']);
        Sanctum::actingAs($student);

        $response = $this->openCheckout('expert', expectedTotal: 2999)->assertCreated();

        $response
            ->assertJsonPath('checkout.key', FakeRazorpayGateway::KEY_ID)
            ->assertJsonPath('checkout.amount', 299900)
            ->assertJsonPath('checkout.currency', 'INR')
            ->assertJsonPath('checkout.name', 'AptRun')
            ->assertJsonPath('checkout.test_mode', true)
            ->assertJsonPath('checkout.prefill.name', 'Asha Rao')
            ->assertJsonPath('checkout.prefill.email', 'asha@example.com')
            ->assertJsonPath('checkout.prefill.contact', '+919876543210')
            ->assertJsonPath('quote.total', 2999);

        $orderId = $response->json('checkout.order_id');
        $this->assertSame(299900, $this->razorpay->orders[$orderId]['amount']);
        $this->assertSame(1, $this->razorpay->calls('POST', '/orders'));

        $order = PaymentOrder::firstOrFail();
        $this->assertSame(PaymentOrder::STATUS_CREATED, $order->status);
        $this->assertSame($orderId, $order->gateway_order_id);
        $this->assertSame($order->public_id, $this->razorpay->orders[$orderId]['receipt']);
        $this->assertSame($student->id, $order->user_id);
        $this->assertSame('test', $order->gateway_mode);
        $this->assertSame(299900, $order->amount_paise);

        $this->assertSame('coder', $this->planOf($student), 'opening Checkout buys nothing');
        $this->assertStringNotContainsString(FakeRazorpayGateway::KEY_SECRET, $response->getContent(), 'the key secret never leaves the server');
    }

    public function test_the_browser_cannot_name_its_own_price(): void
    {
        Sanctum::actingAs($this->student());

        $response = $this->postJson('/api/me/checkout', ['plan_code' => 'starter', 'amount' => 100, 'total' => 1, 'price' => 1, 'amount_paise' => 100])
            ->assertCreated()
            ->assertJsonPath('checkout.amount', 119900);

        $this->assertSame(119900, $this->razorpay->orders[$response->json('checkout.order_id')]['amount']);
    }

    public function test_a_price_that_changed_since_the_page_loaded_is_refused_with_the_new_quote_and_no_order(): void
    {
        Sanctum::actingAs($this->student());
        Plan::where('code', 'starter')->update(['discount_percent' => 50]);

        $this->openCheckout('starter', expectedTotal: 1199)
            ->assertStatus(409)
            ->assertJsonPath('code', 'price_changed')
            ->assertJsonPath('quote.total', 1000);

        $this->assertSame(0, $this->razorpay->calls('POST', '/orders'), 'Razorpay was never asked to create an order');
        $this->assertSame(0, PaymentOrder::count());

        $this->openCheckout('starter', expectedTotal: 1000)->assertCreated()->assertJsonPath('checkout.amount', 100000);
    }

    public function test_opening_checkout_again_reuses_the_open_order_instead_of_piling_up_orders(): void
    {
        $student = $this->student();
        Sanctum::actingAs($student);

        $first = $this->openCheckout('expert')->assertCreated()->json('checkout.order_id');
        $second = $this->openCheckout('expert')->assertCreated()->json('checkout.order_id');

        $this->assertSame($first, $second);
        $this->assertSame(1, $this->razorpay->calls('POST', '/orders'));
        $this->assertSame(1, PaymentOrder::count());

        // A different plan is a different order; so is the same plan once the old order has gone stale.
        $this->assertNotSame($first, $this->openCheckout('starter')->json('checkout.order_id'));

        PaymentOrder::where('gateway_order_id', $first)->update(['created_at' => now()->subHours(2)]);
        $this->assertNotSame($first, $this->openCheckout('expert')->json('checkout.order_id'));
    }

    public function test_the_free_plan_has_nothing_to_pay_for(): void
    {
        Sanctum::actingAs($this->student());

        $this->openCheckout('coder')->assertStatus(422)->assertJsonPath('code', 'nothing_to_pay');
        $this->assertSame(0, $this->razorpay->calls('POST', '/orders'));
    }

    public function test_an_empty_or_unknown_cart_is_a_validation_error_and_the_retired_add_on_cannot_be_bought(): void
    {
        Sanctum::actingAs($this->student());

        $this->postJson('/api/me/checkout', [])->assertStatus(422)->assertJsonValidationErrors('plan_code');
        $this->openCheckout('no-such-plan')->assertStatus(422)->assertJsonValidationErrors('plan_code');
        $this->postJson('/api/me/checkout', ['addons' => ['project-lab']])->assertStatus(422)->assertJsonValidationErrors('addons');
        $this->openCheckout('standard')->assertStatus(422)->assertJsonValidationErrors('plan_code');   // a college plan is not self-serve

        $this->assertSame(0, PaymentOrder::count());
    }

    public function test_a_student_whose_college_already_covers_them_is_not_charged(): void
    {
        $college = College::create(['name' => 'Covered College', 'short_code' => 'CC-1', 'tier' => 'Standard']);
        app(SubscriptionService::class)->assignInstitutionPlan($college, Plan::where('code', 'standard')->firstOrFail(), User::factory()->create(['role' => User::ROLE_SUPERADMIN]));

        $student = $this->student(['college_id' => $college->id]);
        Sanctum::actingAs($student);

        $this->openCheckout('expert')->assertStatus(409)->assertJsonPath('code', 'covered_by_institution');
        $this->assertSame(0, PaymentOrder::count());
    }

    public function test_a_paid_student_cannot_buy_a_lower_plan_over_time_they_have_already_paid_for(): void
    {
        $student = $this->onPlan('expert');
        Sanctum::actingAs($student);

        $this->openCheckout('starter')->assertStatus(409)->assertJsonPath('code', 'downgrade_blocked');
        $this->assertSame(0, PaymentOrder::count());

        // Renewing what they hold, or going up from a lower plan, is fine.
        $this->openCheckout('expert')->assertCreated();

        $starter = $this->onPlan('starter');
        Sanctum::actingAs($starter);
        $this->openCheckout('expert')->assertCreated();
    }

    public function test_a_lapsed_paid_plan_can_be_replaced_by_a_lower_one(): void
    {
        $student = $this->onPlan('expert');
        Subscription::where('subscriber_id', $student->id)->whereHas('plan', fn ($q) => $q->where('code', 'expert'))
            ->update(['current_period_end' => now()->subDay()]);
        Sanctum::actingAs($student->fresh());

        $this->openCheckout('starter')->assertCreated();
    }

    public function test_a_gateway_failure_opening_the_order_leaves_no_trace_and_no_charge(): void
    {
        Sanctum::actingAs($this->student());

        $this->razorpay->failures['POST /orders'] = 500;
        $this->openCheckout('starter')->assertStatus(502)->assertJsonPath('code', 'gateway_error');

        $this->razorpay->down = true;
        $this->openCheckout('starter')->assertStatus(502)->assertJsonPath('code', 'gateway_error');

        $this->assertSame(0, PaymentOrder::count());
    }

    public function test_wrong_api_keys_surface_as_a_gateway_error_not_a_crash(): void
    {
        config(['billing.razorpay.key_secret' => 'a-different-secret']);
        Sanctum::actingAs($this->student());

        $this->openCheckout('starter')->assertStatus(502)->assertJsonPath('code', 'gateway_error');
    }

    // ───────────────────────────── 2. the browser's success callback ─────────────────────────────

    public function test_a_verified_payment_activates_the_plan_and_returns_the_new_state(): void
    {
        $student = $this->student();
        $paid = $this->payFor($student, 'expert');

        $this->postJson('/api/me/checkout/verify', $paid['callback'])
            ->assertOk()
            ->assertJsonPath('coverage.plan.code', 'expert')
            ->assertJsonPath('entitlements.hackathon_access', true)
            ->assertJsonPath('project_lab.enabled', true)
            ->assertJsonPath('payment.status', 'paid')
            ->assertJsonPath('payment.amount', 2999)
            ->assertJsonPath('payment.payment_id', $paid['payment']['id']);

        $order = $paid['order']->refresh();
        $this->assertSame(PaymentOrder::STATUS_PAID, $order->status);
        $this->assertSame($paid['payment']['id'], $order->gateway_payment_id);
        $this->assertNotNull($order->paid_at);
        $this->assertNotNull($order->fulfilled_at);
        $this->assertSame('card', $order->method);

        $subscription = $student->fresh()->activeSubscription();
        $this->assertSame('expert', $subscription->plan->code);
        $this->assertEqualsWithDelta(365, $subscription->daysRemaining(), 1);
        $this->assertSame($order->public_id, $subscription->meta['purchase_ref']);
        $this->assertSame($paid['payment']['id'], $subscription->meta['gateway_payment_id']);
        $this->assertSame(2999, $subscription->meta['price_paid']);
        $this->assertSame([$subscription->id], $order->meta['subscription_ids']);

        Mail::assertSent(PaymentReceiptMail::class, fn (PaymentReceiptMail $mail) => $mail->hasTo($student->email) && $mail->order->is($order));
    }

    public function test_a_bad_signature_activates_nothing(): void
    {
        $student = $this->student();
        $paid = $this->payFor($student, 'expert');

        $forged = $paid['callback'];
        $forged['razorpay_signature'] = hash_hmac('sha256', $forged['razorpay_order_id'].'|'.$forged['razorpay_payment_id'], 'not-the-secret');

        $this->postJson('/api/me/checkout/verify', $forged)->assertStatus(422)->assertJsonPath('code', 'signature_invalid');

        $this->assertSame('coder', $this->planOf($student));
        $this->assertSame(PaymentOrder::STATUS_CREATED, $paid['order']->refresh()->status);
        Mail::assertNothingSent();
    }

    public function test_a_valid_signature_for_a_different_payment_id_is_not_accepted(): void
    {
        $student = $this->student();
        $paid = $this->payFor($student, 'expert');

        $callback = $paid['callback'];
        $callback['razorpay_payment_id'] = 'pay_SomeoneElses1';    // signature was computed for the real payment id

        $this->postJson('/api/me/checkout/verify', $callback)->assertStatus(422)->assertJsonPath('code', 'signature_invalid');
        $this->assertSame('coder', $this->planOf($student));
    }

    public function test_a_student_cannot_confirm_somebody_elses_order(): void
    {
        $victim = $this->student();
        $paid = $this->payFor($victim, 'expert');

        $attacker = $this->student();
        Sanctum::actingAs($attacker);

        $this->postJson('/api/me/checkout/verify', $paid['callback'])->assertNotFound()->assertJsonPath('code', 'order_not_found');

        $this->assertSame('coder', $this->planOf($attacker));
        $this->assertSame('coder', $this->planOf($victim), 'and the victim is not activated by someone else probing it');
    }

    public function test_the_callback_cannot_be_pointed_at_a_cheaper_order(): void
    {
        $student = $this->student();
        Sanctum::actingAs($student);

        // Two open orders: Starter (cheap) and Expert. The student pays only for the cheap one…
        $starterOrder = $this->openCheckout('starter')->json('checkout.order_id');
        $expertOrder = $this->openCheckout('expert')->json('checkout.order_id');
        $payment = $this->razorpay->pay($starterOrder);

        // …and claims that payment (with a valid signature for ITS order) against the Expert order.
        $this->postJson('/api/me/checkout/verify', [
            'razorpay_order_id' => $expertOrder,
            'razorpay_payment_id' => $payment['id'],
            'razorpay_signature' => $this->razorpay->signature($starterOrder, $payment['id']),
        ])->assertStatus(422)->assertJsonPath('code', 'signature_invalid');

        $this->assertSame('coder', $this->planOf($student));
    }

    public function test_verifying_twice_buys_one_plan(): void
    {
        $student = $this->student();
        $paid = $this->payFor($student, 'starter');

        $this->postJson('/api/me/checkout/verify', $paid['callback'])->assertOk();
        $this->postJson('/api/me/checkout/verify', $paid['callback'])->assertOk()->assertJsonPath('payment.status', 'paid');

        $this->assertSame(1, $this->activeBaseSubscriptions($student));
        $this->assertSame(1, Subscription::where('subscriber_id', $student->id)->whereHas('plan', fn ($q) => $q->where('code', 'starter'))->count());
        Mail::assertSent(PaymentReceiptMail::class, 1);
    }

    public function test_a_payment_for_the_wrong_amount_is_not_honoured_and_is_flagged(): void
    {
        $student = $this->student();
        $paid = $this->payFor($student, 'expert', ['amount' => 100]);   // ₹1 against a ₹2,999 order

        $this->postJson('/api/me/checkout/verify', $paid['callback'])->assertStatus(409)->assertJsonPath('code', 'payment_mismatch');

        $this->assertSame('coder', $this->planOf($student));
        $this->assertSame(PaymentOrder::STATUS_NEEDS_REVIEW, $paid['order']->refresh()->status);
        $this->assertSame('payment_mismatch', $paid['order']->failure_code);
    }

    public function test_a_payment_that_belongs_to_a_different_order_is_not_honoured(): void
    {
        $student = $this->student();
        $paid = $this->payFor($student, 'expert', ['order_id' => 'order_SomeOtherOrder']);

        // The callback names our order and carries a signature that is valid for (our order, this payment id),
        // but Razorpay says that payment was made against some other order.
        $order = $paid['order'];
        $this->postJson('/api/me/checkout/verify', [
            'razorpay_order_id' => $order->gateway_order_id,
            'razorpay_payment_id' => $paid['payment']['id'],
            'razorpay_signature' => $this->razorpay->signature($order->gateway_order_id, $paid['payment']['id']),
        ])->assertStatus(409)->assertJsonPath('code', 'payment_mismatch');

        $this->assertSame('coder', $this->planOf($student));
        $this->assertSame(PaymentOrder::STATUS_NEEDS_REVIEW, $order->refresh()->status);
    }

    public function test_an_authorized_payment_is_captured_then_activated(): void
    {
        // A Razorpay account on manual capture: the money is only held until we capture it.
        $student = $this->student();
        $paid = $this->payFor($student, 'starter', ['status' => 'authorized']);

        $this->postJson('/api/me/checkout/verify', $paid['callback'])->assertOk()->assertJsonPath('coverage.plan.code', 'starter');

        $this->assertSame(1, $this->razorpay->calls('POST', '/capture'));
        $this->assertSame('captured', $this->razorpay->payments[$paid['payment']['id']]['status']);
    }

    public function test_a_payment_captured_by_razorpay_between_our_read_and_our_capture_is_still_activated(): void
    {
        // Our read said "authorized"; automatic capture won the race, so our capture call is told "already captured".
        $student = $this->student();
        $paid = $this->payFor($student, 'starter', ['status' => 'authorized']);
        $this->razorpay->payments[$paid['payment']['id']]['status'] = 'captured';
        $this->razorpay->payments[$paid['payment']['id']]['captured'] = true;
        $this->razorpay->failures = [];

        $order = $paid['order'];
        $stale = ['status' => 'authorized'] + $this->razorpay->payments[$paid['payment']['id']];
        app(CheckoutService::class)->settleFromGateway($order, $stale);

        $this->assertSame('starter', $this->planOf($student));
    }

    public function test_a_payment_that_has_not_completed_activates_nothing(): void
    {
        $student = $this->student();
        $paid = $this->payFor($student, 'starter', ['status' => 'created', 'captured' => false]);

        $this->postJson('/api/me/checkout/verify', $paid['callback'])->assertStatus(409)->assertJsonPath('code', 'payment_not_complete');
        $this->assertSame('coder', $this->planOf($student));
    }

    public function test_a_declined_payment_is_recorded_with_its_reason_and_the_order_stays_payable(): void
    {
        $student = $this->student();
        Sanctum::actingAs($student);
        $orderId = $this->openCheckout('expert')->json('checkout.order_id');

        $failed = $this->razorpay->fail($orderId, 'Your card was declined. Try another payment method.');
        $this->postJson('/api/me/checkout/verify', $this->razorpay->callback($failed))->assertStatus(409);

        $order = PaymentOrder::where('gateway_order_id', $orderId)->firstOrFail();
        $this->assertSame(PaymentOrder::STATUS_CREATED, $order->status);
        $this->assertSame(1, $order->attempts);
        $this->assertSame('Your card was declined. Try another payment method.', $order->failure_reason);

        $this->getJson('/api/me/payments')->assertOk()
            ->assertJsonPath('payments.0.status', 'failed')
            ->assertJsonPath('payments.0.failure_reason', 'Your card was declined. Try another payment method.');

        // Second try, on the same order, with another card: it succeeds and activates.
        $ok = $this->razorpay->pay($orderId);
        $this->postJson('/api/me/checkout/verify', $this->razorpay->callback($ok))->assertOk()->assertJsonPath('coverage.plan.code', 'expert');
        $this->assertNull($order->refresh()->failure_reason);
    }

    public function test_when_razorpay_cannot_be_reached_at_verify_time_the_student_is_told_it_will_activate_and_it_does(): void
    {
        $student = $this->student();
        $paid = $this->payFor($student, 'starter');

        $this->razorpay->down = true;
        $this->postJson('/api/me/checkout/verify', $paid['callback'])->assertStatus(503)->assertJsonPath('code', 'activation_delayed');
        $this->assertSame('coder', $this->planOf($student));

        // Razorpay is back: the status poll (and the scheduled reconcile) finish the job. No second payment.
        $this->razorpay->down = false;
        $this->getJson("/api/me/payments/{$paid['order']->public_id}")->assertOk()->assertJsonPath('payment.status', 'paid');
        $this->assertSame('starter', $this->planOf($student));
    }

    public function test_an_upgrade_starts_a_fresh_year_and_replaces_the_old_plan(): void
    {
        $student = $this->onPlan('starter');
        $this->purchaseThroughRazorpay($student, 'expert');

        $this->assertSame('expert', $this->planOf($student));
        $this->assertSame(1, $this->activeBaseSubscriptions($student), 'one plan governs a student at a time');
        $this->assertEqualsWithDelta(365, $student->fresh()->activeSubscription()->daysRemaining(), 1);
    }

    public function test_renewing_the_plan_you_hold_stacks_onto_the_days_you_have_left(): void
    {
        $student = $this->onPlan('starter');
        Subscription::where('subscriber_id', $student->id)->whereHas('plan', fn ($q) => $q->where('code', 'starter'))
            ->update(['current_period_end' => now()->addDays(100)]);

        $this->purchaseThroughRazorpay($student->fresh(), 'starter');

        $this->assertEqualsWithDelta(465, $student->fresh()->activeSubscription()->daysRemaining(), 1, 'paying early never forfeits paid time');
    }

    public function test_a_converted_lead_is_recognised_when_their_payment_goes_through(): void
    {
        $student = $this->student(['lead_status' => User::LEAD_STATUS_NEW]);
        $this->assertTrue($student->fresh()->isMellowDirectLead());

        $this->purchaseThroughRazorpay($student, 'starter');

        $this->assertSame(User::LEAD_STATUS_CONVERTED, $student->fresh()->lead_status);
    }

    // ───────────────────────────── 3. the webhook ─────────────────────────────

    public function test_the_webhook_refuses_a_bad_signature_a_missing_signature_and_a_tampered_body(): void
    {
        $student = $this->student();
        $paid = $this->payFor($student, 'starter');
        $delivery = $this->razorpay->webhook('payment.captured', ['payment' => $paid['payment']]);

        $this->deliverRawWebhook($delivery['body'], 'deadbeef', $delivery['event_id'])->assertStatus(400);
        $this->deliverRawWebhook($delivery['body'], null, $delivery['event_id'])->assertStatus(400);
        $this->deliverRawWebhook(str_replace('"amount"', '"amount" ', $delivery['body']), $delivery['signature'], $delivery['event_id'])->assertStatus(400);

        $this->assertSame('coder', $this->planOf($student));
        $this->assertSame(0, PaymentWebhookEvent::count(), 'an unauthenticated body is not even stored');
    }

    public function test_the_webhook_secret_is_not_the_api_key_secret(): void
    {
        $student = $this->student();
        $paid = $this->payFor($student, 'starter');
        $delivery = $this->razorpay->webhook('payment.captured', ['payment' => $paid['payment']]);

        $signedWithKeySecret = hash_hmac('sha256', $delivery['body'], FakeRazorpayGateway::KEY_SECRET);
        $this->deliverRawWebhook($delivery['body'], $signedWithKeySecret, $delivery['event_id'])->assertStatus(400);
    }

    public function test_the_webhook_answers_503_until_a_webhook_secret_is_configured(): void
    {
        $this->setUpRazorpay(webhookSecret: false);

        $this->deliverRawWebhook('{"event":"payment.captured"}', hash_hmac('sha256', '{"event":"payment.captured"}', ''), 'evt_1')->assertStatus(503);
    }

    public function test_a_malformed_but_signed_body_is_refused(): void
    {
        $body = 'not json at all';
        $this->deliverRawWebhook($body, hash_hmac('sha256', $body, FakeRazorpayGateway::WEBHOOK_SECRET), 'evt_x')->assertStatus(400);
    }

    public function test_a_captured_payment_webhook_activates_the_plan_even_though_the_browser_never_called_back(): void
    {
        $student = $this->student();
        $paid = $this->payFor($student, 'expert');   // the student paid, then closed the tab

        $this->deliverWebhook('payment.captured', ['payment' => $paid['payment']])->assertOk()->assertJsonPath('status', 'processed');

        $this->assertSame('expert', $this->planOf($student));
        $this->assertSame(PaymentOrder::STATUS_PAID, $paid['order']->refresh()->status);
        Mail::assertSent(PaymentReceiptMail::class, 1);
    }

    public function test_a_redelivered_event_changes_nothing(): void
    {
        $student = $this->student();
        $paid = $this->payFor($student, 'starter');
        $delivery = $this->razorpay->webhook('payment.captured', ['payment' => $paid['payment']], 'evt_dup_1');

        $this->deliverRawWebhook($delivery['body'], $delivery['signature'], 'evt_dup_1')->assertOk()->assertJsonPath('status', 'processed');
        $this->deliverRawWebhook($delivery['body'], $delivery['signature'], 'evt_dup_1')->assertOk()->assertJsonPath('status', 'duplicate');

        $this->assertSame(1, PaymentWebhookEvent::where('event_id', 'evt_dup_1')->count());
        $this->assertSame(1, Subscription::where('subscriber_id', $student->id)->whereHas('plan', fn ($q) => $q->where('code', 'starter'))->count());
        $this->assertSame(1, $this->razorpay->calls('GET', "/payments/{$paid['payment']['id']}"), 'the duplicate did no work at all');
    }

    public function test_the_browser_callback_and_two_different_webhooks_for_one_payment_buy_one_plan(): void
    {
        $student = $this->student();
        $paid = $this->payFor($student, 'expert');

        $this->deliverWebhook('payment.authorized', ['payment' => $paid['payment']])->assertOk();
        $this->postJson('/api/me/checkout/verify', $paid['callback'])->assertOk();
        $this->deliverWebhook('payment.captured', ['payment' => $paid['payment']])->assertOk();
        $this->deliverWebhook('order.paid', ['payment' => $paid['payment'], 'order' => $this->razorpay->orders[$paid['order']->gateway_order_id]])->assertOk();

        $this->assertSame(1, Subscription::where('subscriber_id', $student->id)->whereHas('plan', fn ($q) => $q->where('code', 'expert'))->count());
        $this->assertSame(1, $this->activeBaseSubscriptions($student));
        Mail::assertSent(PaymentReceiptMail::class, 1);
    }

    public function test_a_payment_for_an_order_that_is_not_ours_is_acknowledged_and_ignored(): void
    {
        // The Razorpay account may also serve other products: their events must not be retried forever.
        $foreign = ['id' => 'pay_Foreign000001', 'order_id' => 'order_Foreign000001', 'amount' => 5000, 'currency' => 'INR', 'status' => 'captured'];

        $this->deliverWebhook('payment.captured', ['payment' => $foreign])->assertOk()->assertJsonPath('status', 'ignored');
        $this->deliverWebhook('refund.processed', ['refund' => ['id' => 'rfnd_x', 'payment_id' => 'pay_Foreign000001', 'amount' => 5000]])->assertOk()->assertJsonPath('status', 'ignored');
        $this->deliverWebhook('subscription.charged', ['payment' => $foreign])->assertOk()->assertJsonPath('status', 'ignored');

        $this->assertSame(0, Subscription::where('plan_id', Plan::where('code', 'expert')->value('id'))->count());
    }

    public function test_a_failure_webhook_records_the_reason_without_closing_the_order(): void
    {
        $student = $this->student();
        Sanctum::actingAs($student);
        $orderId = $this->openCheckout('expert')->json('checkout.order_id');
        $failed = $this->razorpay->fail($orderId, 'UPI request timed out.');

        $delivery = fn () => $this->deliverWebhook('payment.failed', ['payment' => $failed], 'evt_fail_1');
        $delivery()->assertOk();
        $delivery()->assertOk()->assertJsonPath('status', 'duplicate');
        $this->deliverWebhook('payment.failed', ['payment' => $failed], 'evt_fail_2')->assertOk();   // same payment, new event id

        $order = PaymentOrder::where('gateway_order_id', $orderId)->firstOrFail();
        $this->assertSame(PaymentOrder::STATUS_CREATED, $order->status);
        $this->assertSame(1, $order->attempts, 'the same failed payment is not counted twice');
        $this->assertSame('UPI request timed out.', $order->failure_reason);

        // …and a later successful attempt still activates.
        $this->deliverWebhook('payment.captured', ['payment' => $this->razorpay->pay($orderId)])->assertOk();
        $this->assertSame('expert', $this->planOf($student));
    }

    public function test_a_late_failure_event_does_not_undo_a_payment_that_already_succeeded(): void
    {
        $student = $this->student();
        $paid = $this->payFor($student, 'starter');
        $this->postJson('/api/me/checkout/verify', $paid['callback'])->assertOk();

        $this->deliverWebhook('payment.failed', ['payment' => ['status' => 'failed', 'error_code' => 'X', 'error_description' => 'late'] + $paid['payment']])->assertOk();

        $order = $paid['order']->refresh();
        $this->assertSame(PaymentOrder::STATUS_PAID, $order->status);
        $this->assertNull($order->failure_reason);
        $this->assertSame('starter', $this->planOf($student));
    }

    public function test_when_handling_fails_the_webhook_answers_500_so_razorpay_retries_and_the_retry_succeeds(): void
    {
        $student = $this->student();
        $paid = $this->payFor($student, 'expert');
        $delivery = $this->razorpay->webhook('payment.captured', ['payment' => $paid['payment']], 'evt_retry_1');

        $this->razorpay->failures['GET /'.$paid['payment']['id']] = 500;
        $this->deliverRawWebhook($delivery['body'], $delivery['signature'], 'evt_retry_1')->assertStatus(500);

        $this->assertSame('failed', PaymentWebhookEvent::where('event_id', 'evt_retry_1')->value('status'));
        $this->assertSame('coder', $this->planOf($student));

        $this->razorpay->failures = [];
        $this->deliverRawWebhook($delivery['body'], $delivery['signature'], 'evt_retry_1')->assertOk()->assertJsonPath('status', 'processed');

        $this->assertSame('expert', $this->planOf($student));
        $this->assertSame('processed', PaymentWebhookEvent::where('event_id', 'evt_retry_1')->value('status'));
        $this->assertSame(1, PaymentWebhookEvent::where('event_id', 'evt_retry_1')->count());
    }

    public function test_the_webhook_trusts_razorpays_current_state_not_the_events_claim(): void
    {
        // A forged-but-correctly-signed event can't exist without the secret; this pins the second line of
        // defence: an event that says "captured" for a payment Razorpay says is only `created` buys nothing.
        $student = $this->student();
        $paid = $this->payFor($student, 'expert', ['status' => 'created', 'captured' => false]);

        $claimed = ['status' => 'captured', 'captured' => true] + $paid['payment'];
        $this->deliverWebhook('payment.captured', ['payment' => $claimed])->assertOk();

        $this->assertSame('coder', $this->planOf($student));
    }

    // ───────────────────────────── refunds ─────────────────────────────

    public function test_a_full_refund_takes_the_plan_back_and_a_second_event_changes_nothing(): void
    {
        $student = $this->student();
        $order = $this->purchaseThroughRazorpay($student, 'expert');
        $this->assertTrue($student->fresh()->effectiveEntitlements()['hackathon_access']);

        // Finance refunds it from the Razorpay Dashboard; Razorpay tells us.
        $refund = $this->razorpay->refunds[array_key_last($this->razorpay->refunds)] ?? [
            'id' => 'rfnd_Dash0001', 'amount' => 299900, 'payment_id' => $order->gateway_payment_id, 'status' => 'processed', 'notes' => ['reason' => 'Customer asked'],
        ];
        $this->deliverWebhook('refund.processed', ['refund' => $refund], 'evt_ref_1')->assertOk()->assertJsonPath('status', 'processed');
        $this->deliverWebhook('refund.processed', ['refund' => $refund], 'evt_ref_2')->assertOk();   // re-sent under a new event id

        $order->refresh();
        $this->assertSame(PaymentOrder::STATUS_REFUNDED, $order->status);
        $this->assertSame(299900, $order->refunded_paise);
        $this->assertNotNull($order->refunded_at);

        $student = $student->fresh();
        $entitlements = $student->effectiveEntitlements();
        $this->assertFalse($entitlements['hackathon_access']);
        $this->assertFalse($student->hasProjectLabAccess());
        $this->assertSame('coder', $this->planOf($student), 'back on the free plan, not left with no plan at all');
        $this->assertSame(1, $this->activeBaseSubscriptions($student));
    }

    public function test_a_partial_refund_is_recorded_but_leaves_the_plan_alone(): void
    {
        $student = $this->student();
        $order = $this->purchaseThroughRazorpay($student, 'expert');

        $this->deliverWebhook('refund.processed', ['refund' => ['id' => 'rfnd_Part0001', 'payment_id' => $order->gateway_payment_id, 'amount' => 50000, 'notes' => []]])->assertOk();

        $order->refresh();
        $this->assertSame(PaymentOrder::STATUS_PARTIALLY_REFUNDED, $order->status);
        $this->assertSame(50000, $order->refunded_paise);
        $this->assertSame('expert', $this->planOf($student));

        // The rest goes back later: now it is a full refund.
        $this->deliverWebhook('refund.processed', ['refund' => ['id' => 'rfnd_Part0002', 'payment_id' => $order->gateway_payment_id, 'amount' => 249900, 'notes' => []]])->assertOk();
        $this->assertSame(PaymentOrder::STATUS_REFUNDED, $order->refresh()->status);
        $this->assertSame('coder', $this->planOf($student));
    }

    public function test_refunding_an_old_purchase_never_reaches_into_the_plan_held_now(): void
    {
        $student = $this->student();
        $starterOrder = $this->purchaseThroughRazorpay($student, 'starter');
        $this->purchaseThroughRazorpay($student->fresh(), 'expert');   // upgraded later

        $this->deliverWebhook('refund.processed', ['refund' => ['id' => 'rfnd_Old00001', 'payment_id' => $starterOrder->gateway_payment_id, 'amount' => 119900, 'notes' => []]])->assertOk();

        $this->assertSame(PaymentOrder::STATUS_REFUNDED, $starterOrder->refresh()->status);
        $this->assertSame('expert', $this->planOf($student), 'the Expert they still paid for is untouched');
    }

    // ───────────────────────────── when handing over the plan is impossible ─────────────────────────────

    public function test_a_payment_for_a_deleted_account_is_refunded_automatically_and_the_order_says_why(): void
    {
        $student = $this->student();
        $paid = $this->payFor($student, 'starter');

        // The account is purged (e.g. a college deletion) between paying and the webhook arriving.
        User::whereKey($student->id)->delete();
        $this->assertNull($paid['order']->refresh()->user_id, 'the payment record outlives the account');
        $this->assertSame($student->email, $paid['order']->payer_email);

        $this->deliverWebhook('payment.captured', ['payment' => $paid['payment']])->assertOk();

        $order = $paid['order']->refresh();
        $this->assertSame(1, $this->razorpay->calls('POST', '/refund'), 'the money was sent back');
        $this->assertSame('refunded', $this->razorpay->payments[$paid['payment']['id']]['status']);

        // Closed out at once from the refund API's own answer — not left "needs review" waiting for a webhook —
        // and the reason it happened stays on the record.
        $this->assertSame(PaymentOrder::STATUS_REFUNDED, $order->status);
        $this->assertSame('fulfilment_failed', $order->failure_code);
        $this->assertStringContainsString('no longer has an account', $order->failure_reason);
        $this->assertStringContainsString('could not be activated', $order->refund_reason);
        $this->assertSame($order->amount_paise, $order->refunded_paise);
        $this->assertNotNull($order->refund_id);

        // Razorpay's own refund.processed webhook then arrives: it changes nothing.
        $this->deliverWebhook('refund.processed', ['refund' => $this->razorpay->refunds[$order->refund_id]])->assertOk();
        $this->assertSame(PaymentOrder::STATUS_REFUNDED, $order->refresh()->status);
        $this->assertSame($order->amount_paise, $order->refunded_paise, 'counted once, not twice');
    }

    public function test_an_old_checkout_for_a_cheaper_plan_paid_after_a_dearer_one_was_bought_is_refunded_not_honoured(): void
    {
        $student = $this->student();
        Sanctum::actingAs($student);

        // Two tabs: Starter is opened first, and left unpaid…
        $starterOrder = $this->openCheckout('starter')->assertCreated()->json('checkout.order_id');

        // …Expert is then bought…
        $this->purchaseThroughRazorpay($student, 'expert');
        $this->assertSame('expert', $this->planOf($student));

        // …and the forgotten Starter window is paid at last.
        $latePayment = $this->razorpay->pay($starterOrder);
        $this->deliverWebhook('payment.captured', ['payment' => $latePayment])->assertOk();

        // What they hold is untouched; the cheaper payment went back.
        $this->assertSame('expert', $this->planOf($student), 'never swapped for less');
        $this->assertSame(1, $this->activeBaseSubscriptions($student));

        $late = PaymentOrder::where('gateway_order_id', $starterOrder)->firstOrFail();
        $this->assertSame(PaymentOrder::STATUS_REFUNDED, $late->status);
        $this->assertStringContainsString('higher plan', $late->failure_reason);
        $this->assertSame('refunded', $this->razorpay->payments[$latePayment['id']]['status']);

        // The student's own callback for it (if their tab was still open) is told plainly — not "success".
        $this->postJson('/api/me/checkout/verify', $this->razorpay->callback($latePayment))
            ->assertStatus(409)
            ->assertJsonPath('code', 'payment_refunded');
    }

    public function test_a_transient_failure_while_activating_is_retried_not_refunded(): void
    {
        $student = $this->student();
        $paid = $this->payFor($student, 'starter');

        // The first attempt dies mid-activation (a deadlock, a dropped DB connection…).
        Subscription::creating(function () {
            throw new \RuntimeException('simulated transient database failure');
        });

        $this->deliverWebhook('payment.captured', ['payment' => $paid['payment']], 'evt_transient')->assertStatus(500);
        $this->assertSame(0, $this->razorpay->calls('POST', '/refund'), 'a hiccup is not a reason to give the money back');
        $this->assertSame(PaymentOrder::STATUS_CREATED, $paid['order']->refresh()->status);

        Subscription::flushEventListeners();

        $this->deliverWebhook('payment.captured', ['payment' => $paid['payment']], 'evt_transient')->assertOk();
        $this->assertSame('starter', $this->planOf($student));
    }

    // ───────────────────────────── 4. reconcile ─────────────────────────────

    public function test_reconcile_activates_a_paid_order_whose_webhook_and_callback_never_arrived(): void
    {
        $student = $this->student();
        $paid = $this->payFor($student, 'expert');
        $this->ageOrder($paid['order'], minutes: 10);

        $this->artisan('payments:reconcile')->assertSuccessful();

        $this->assertSame('expert', $this->planOf($student));
        $this->assertSame(PaymentOrder::STATUS_PAID, $paid['order']->refresh()->status);
        Mail::assertSent(PaymentReceiptMail::class, 1);

        $this->artisan('payments:reconcile')->assertSuccessful();
        $this->assertSame(1, $this->activeBaseSubscriptions($student));
    }

    public function test_reconcile_leaves_a_fresh_order_alone_and_expires_an_abandoned_one(): void
    {
        $student = $this->student();
        Sanctum::actingAs($student);
        $this->openCheckout('starter')->assertCreated();           // just opened: the student may be mid-payment
        $fresh = PaymentOrder::firstOrFail();

        $this->openCheckout('expert')->assertCreated();
        $abandoned = PaymentOrder::where('plan_code', 'expert')->firstOrFail();
        $this->ageOrder($abandoned, minutes: 25 * 60);

        $this->artisan('payments:reconcile')->assertSuccessful();

        $this->assertSame(PaymentOrder::STATUS_CREATED, $fresh->refresh()->status);
        $this->assertSame(PaymentOrder::STATUS_EXPIRED, $abandoned->refresh()->status);
        $this->assertSame('coder', $this->planOf($student));
    }

    public function test_an_expired_order_that_is_paid_late_is_still_honoured(): void
    {
        $student = $this->student();
        $paid = $this->payFor($student, 'starter');
        $this->ageOrder($paid['order'], minutes: 2 * 24 * 60);
        $paid['order']->update(['status' => PaymentOrder::STATUS_EXPIRED]);

        $this->deliverWebhook('payment.captured', ['payment' => $paid['payment']])->assertOk();

        $this->assertSame('starter', $this->planOf($student), 'they paid; they get what they paid for');
        $this->assertSame(PaymentOrder::STATUS_PAID, $paid['order']->refresh()->status);
    }

    public function test_reconcile_survives_razorpay_being_down_and_does_nothing_without_keys(): void
    {
        $student = $this->student();
        $paid = $this->payFor($student, 'starter');
        $this->ageOrder($paid['order'], minutes: 10);

        $this->razorpay->down = true;
        $this->artisan('payments:reconcile')->assertFailed();
        $this->assertSame(PaymentOrder::STATUS_CREATED, $paid['order']->refresh()->status, 'left for the next run');

        $this->setUpRazorpay(configured: false);
        $this->artisan('payments:reconcile')->assertSuccessful();
    }

    public function test_reconcile_prunes_old_webhook_payloads_only(): void
    {
        $old = PaymentWebhookEvent::create(['event_id' => 'evt_old', 'event' => 'payment.captured', 'status' => 'processed', 'payload' => []]);
        $old->forceFill(['created_at' => now()->subDays(100)])->save();
        PaymentWebhookEvent::create(['event_id' => 'evt_new', 'event' => 'payment.captured', 'status' => 'processed', 'payload' => []]);

        $this->artisan('payments:reconcile')->assertSuccessful();

        $this->assertSame(['evt_new'], PaymentWebhookEvent::pluck('event_id')->all());
    }

    // ───────────────────────────── 5. history and the superadmin view ─────────────────────────────

    public function test_a_student_sees_their_own_payments_and_only_theirs(): void
    {
        $student = $this->student();
        $this->purchaseThroughRazorpay($student, 'starter');
        Sanctum::actingAs($student);
        $this->openCheckout('expert')->assertCreated();   // opened but never paid: not history

        $other = $this->student();
        $this->purchaseThroughRazorpay($other, 'expert');

        Sanctum::actingAs($student);
        $response = $this->getJson('/api/me/payments')->assertOk();

        $response->assertJsonCount(1, 'payments')
            ->assertJsonPath('payments.0.status', 'paid')
            ->assertJsonPath('payments.0.description', 'Starter')
            ->assertJsonPath('payments.0.amount', 1199)
            ->assertJsonPath('payments.0.list_price', 1999)
            ->assertJsonPath('payments.0.discount', 800)
            ->assertJsonPath('payments.0.test_mode', true)
            ->assertJsonPath('checkout.available', true);

        $this->assertArrayNotHasKey('gateway_order_id', $response->json('payments.0'));
        $this->assertArrayNotHasKey('user_id', $response->json('payments.0'));
    }

    public function test_a_student_cannot_read_another_students_payment(): void
    {
        $owner = $this->student();
        $order = $this->purchaseThroughRazorpay($owner, 'starter');

        Sanctum::actingAs($this->student());
        $this->getJson("/api/me/payments/{$order->public_id}")->assertNotFound();
    }

    public function test_the_status_check_asks_razorpay_when_the_order_is_still_unpaid(): void
    {
        $student = $this->student();
        $paid = $this->payFor($student, 'starter');   // paid at Razorpay; we have heard nothing

        $this->getJson("/api/me/payments/{$paid['order']->public_id}")->assertOk()->assertJsonPath('payment.status', 'paid');
        $this->assertSame('starter', $this->planOf($student));
    }

    public function test_only_a_superadmin_can_open_the_payments_screen(): void
    {
        foreach ([User::ROLE_USER, User::ROLE_ADMIN_TPO, User::ROLE_ADMIN_INTERNAL, User::ROLE_ADMIN_MARKETING] as $role) {
            Sanctum::actingAs(User::factory()->create(['role' => $role]));
            $this->getJson('/api/superadmin/payments')->assertForbidden();
        }
    }

    public function test_the_superadmin_sees_revenue_orders_and_the_ones_needing_a_person(): void
    {
        $one = $this->student(['email' => 'one@example.com']);
        $two = $this->student(['email' => 'two@example.com']);
        $this->purchaseThroughRazorpay($one, 'starter');
        $expert = $this->purchaseThroughRazorpay($two, 'expert');
        $this->deliverWebhook('refund.processed', ['refund' => ['id' => 'rfnd_Adm00001', 'payment_id' => $expert->gateway_payment_id, 'amount' => 100000, 'notes' => []]]);
        PaymentOrder::create([
            'user_id' => $one->id, 'payer_name' => 'x', 'payer_email' => 'x@example.com', 'gateway_order_id' => 'order_stuck', 'status' => PaymentOrder::STATUS_NEEDS_REVIEW,
            'currency' => 'INR', 'amount_paise' => 100000, 'cart' => [], 'quote' => ['lines' => []], 'gateway_mode' => 'test',
        ]);

        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_SUPERADMIN]));

        $this->getJson('/api/superadmin/payments')->assertOk()
            ->assertJsonPath('mode', 'test')
            ->assertJsonPath('configured', true)
            ->assertJsonPath('webhook_configured', true)
            ->assertJsonPath('summary.gross', 1199 + 2999)
            ->assertJsonPath('summary.refunded', 1000)
            ->assertJsonPath('summary.net', 1199 + 2999 - 1000)
            ->assertJsonPath('summary.orders_paid', 2)
            ->assertJsonPath('summary.needs_review', 1)
            ->assertJsonPath('pagination.total', 3);

        $this->getJson('/api/superadmin/payments?status=needs_review')->assertOk()->assertJsonCount(1, 'payments')->assertJsonPath('payments.0.gateway_order_id', 'order_stuck');
        $this->getJson('/api/superadmin/payments?q=two@example.com')->assertOk()->assertJsonCount(1, 'payments')->assertJsonPath('payments.0.payer_email', $two->email);
        $this->getJson('/api/superadmin/payments?status=bogus')->assertStatus(422);
    }

    public function test_the_superadmin_can_recheck_a_payment_with_razorpay_and_it_is_audited(): void
    {
        $student = $this->student();
        $paid = $this->payFor($student, 'starter');   // paid, but nobody told us

        $admin = User::factory()->create(['role' => User::ROLE_SUPERADMIN]);
        Sanctum::actingAs($admin);

        $this->postJson("/api/superadmin/payments/{$paid['order']->public_id}/reconcile")
            ->assertOk()
            ->assertJsonPath('payment.status', 'paid');

        $this->assertSame('starter', $this->planOf($student));
        $this->assertDatabaseHas('activity_logs', ['actor_id' => $admin->id, 'action' => 'Re-checked a payment with Razorpay', 'target_label' => $paid['order']->public_id]);

        $this->razorpay->down = true;
        $this->postJson("/api/superadmin/payments/{$paid['order']->public_id}/reconcile")->assertOk();   // already paid: nothing to ask
    }

    // ───────────────────────────── helpers ─────────────────────────────

    /** Makes an order look `$minutes` old (created_at is deliberately not mass-assignable). */
    private function ageOrder(PaymentOrder $order, int $minutes): void
    {
        PaymentOrder::whereKey($order->id)->update(['created_at' => now()->subMinutes($minutes)]);
    }

    private function onPlan(string $code): User
    {
        $user = $this->student();
        $this->buy($user, $code);

        return $user->fresh();
    }
}
