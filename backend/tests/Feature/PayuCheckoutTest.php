<?php

namespace Tests\Feature;

use App\Mail\PaymentReceiptMail;
use App\Models\PaymentOrder;
use App\Models\PaymentWebhookEvent;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use App\Services\Payments\PayuClient;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\CreatesProjectLabFixtures;
use Tests\Concerns\FakesPayu;
use Tests\Support\FakePayuGateway;
use Tests\TestCase;

/**
 * Paying for a plan on PayU Hosted Checkout, driven the way the browser and PayU drive it, against an
 * in-memory PayU (Tests\Support\FakePayuGateway) — so the real HTTP client, the hash maths and the
 * fulfilment code all run.
 *
 *   1. the hashes              — checked against the formulas as PayU's docs write them
 *   2. opening a checkout      — the server prices it and signs the form; the browser cannot change it
 *   3. the browser's return    — believed only after the hash checks out AND PayU's own API agrees
 *   4. the webhook             — payment events (signed), refund and dispute events (unsigned, re-verified)
 *   5. reconcile / status poll — the nets under a closed tab and a lost webhook
 *   6. refunds and failures    — money taken but no plan; refunds PayU queues and may reject later
 *   7. the superadmin view, receipts, and switching gateways
 */
class PayuCheckoutTest extends TestCase
{
    use CreatesProjectLabFixtures;
    use FakesPayu;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedPlans();
        $this->seedStarterPlan();
        $this->setUpPayu();
        Mail::fake();
    }

    /** A student with the mobile number PayU's page needs. */
    private function payer(array $attributes = []): User
    {
        return $this->student(array_merge(['name' => 'Asha Rao', 'email' => 'asha@example.com', 'phone' => '9876543210'], $attributes));
    }

    /** `created_at` is not mass-assignable, so an order is aged with a query-builder update. */
    private function age(PaymentOrder $order, int $minutes): void
    {
        PaymentOrder::whereKey($order->id)->update(['created_at' => now()->subMinutes($minutes)]);
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

    /** The signed form for an order that is already open (what the first POST to /me/checkout returned). */
    private function checkoutFieldsFor(PaymentOrder $order, User $student): array
    {
        return app(\App\Services\Payments\CheckoutService::class)->checkoutOptions($order, $student)['fields'];
    }

    private function billingUrl(PaymentOrder $order, string $result): string
    {
        return 'https://app.aptrun.test/dashboard/billing?payment='.$order->public_id.'&result='.$result;
    }

    // ───────────────────────────── 1. the hashes ─────────────────────────────

    public function test_the_request_hash_is_sha512_of_the_documented_string_with_eleven_pipes_after_the_email(): void
    {
        config(['billing.payu.key' => 'JPM7Fg', 'billing.payu.salt' => 'THE_SALT']);
        $client = new PayuClient;

        // PayU docs: sha512(key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||SALT) — no udfs sent:
        $literal = 'JPM7Fg|123456789|10.00|Test Product|John|john@example.com|||||||||||THE_SALT';
        $this->assertSame(11, substr_count(substr($literal, strlen('JPM7Fg|123456789|10.00|Test Product|John|john@example.com')), '|'));

        $base = ['key' => 'JPM7Fg', 'txnid' => '123456789', 'amount' => '10.00', 'productinfo' => 'Test Product', 'firstname' => 'John', 'email' => 'john@example.com'];
        $this->assertSame(hash('sha512', $literal), $client->requestHash($base));

        // …and with udf1 and udf3 posted, every other udf slot still holds its pipe (PayU's "Scenario 2").
        $withUdfs = 'JPM7Fg|123456789|10.00|Test Product|John|john@example.com|U1||U3||||||||THE_SALT';
        $this->assertSame(hash('sha512', $withUdfs), $client->requestHash($base + ['udf1' => 'U1', 'udf3' => 'U3']));
    }

    public function test_the_response_hash_is_the_reverse_string_and_a_tampered_field_breaks_it(): void
    {
        config(['billing.payu.key' => 'JPM7Fg', 'billing.payu.salt' => 'THE_SALT']);
        $client = new PayuClient;

        // PayU docs: sha512(SALT|status||||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key)
        $response = ['status' => 'success', 'txnid' => 'T1', 'amount' => '10.00', 'productinfo' => 'Test Product', 'firstname' => 'John',
            'email' => 'john@example.com', 'key' => 'JPM7Fg', 'udf1' => 'U1', 'udf2' => '', 'udf3' => '', 'udf4' => '', 'udf5' => ''];
        $response['hash'] = hash('sha512', 'THE_SALT|success||||||||||U1|john@example.com|John|Test Product|10.00|T1|JPM7Fg');

        $this->assertTrue($client->verifyResponseHash($response));
        $this->assertTrue($client->verifyResponseHash(['hash' => strtoupper($response['hash'])] + $response), 'hex case does not matter');

        foreach (['status' => 'failure', 'amount' => '1.00', 'txnid' => 'T2', 'email' => 'x@example.com', 'udf1' => 'U2', 'productinfo' => 'Other'] as $field => $value) {
            $this->assertFalse($client->verifyResponseHash([$field => $value] + $response), "editing {$field} must break the hash");
        }

        $this->assertFalse($client->verifyResponseHash(array_diff_key($response, ['hash' => 1])), 'no hash, no trust');
        $this->assertFalse($client->verifyResponseHash(['hash' => str_repeat('0', 128)] + $response));
        $this->assertFalse($client->verifyResponseHash(['key' => 'SomeoneElse'] + $response), 'a response for another merchant account is not ours');
    }

    public function test_the_response_hash_with_additional_charges_or_split_info_prefixes_is_understood(): void
    {
        config(['billing.payu.key' => 'K', 'billing.payu.salt' => 'S']);
        $client = new PayuClient;

        $fields = ['status' => 'success', 'txnid' => 'T1', 'amount' => '10.00', 'productinfo' => 'P', 'firstname' => 'F', 'email' => 'e@x.com', 'key' => 'K'];

        // Between the status and the email sit ten empty slots (five reserved + udf5…udf1): eleven pipes.
        $gap = str_repeat('|', 11);

        // additionalCharges goes in front of the salt…
        $withCharges = $fields + ['additionalCharges' => '2.36'];
        $withCharges['hash'] = hash('sha512', '2.36|S|success'.$gap.'e@x.com|F|P|10.00|T1|K');
        $this->assertTrue($client->verifyResponseHash($withCharges));

        // …splitInfo right after the status (and the ten slots follow it)…
        $withSplit = $fields + ['splitInfo' => '{"a":1}'];
        $withSplit['hash'] = hash('sha512', 'S|success|{"a":1}'.$gap.'e@x.com|F|P|10.00|T1|K');
        $this->assertTrue($client->verifyResponseHash($withSplit));

        // …both together…
        $both = $fields + ['additionalCharges' => '2.36', 'splitInfo' => '{"a":1}'];
        $both['hash'] = hash('sha512', '2.36|S|success|{"a":1}'.$gap.'e@x.com|F|P|10.00|T1|K');
        $this->assertTrue($client->verifyResponseHash($both));

        // …and none of them is needed when the fields are simply absent.
        $plain = $fields;
        $plain['hash'] = hash('sha512', 'S|success'.$gap.'e@x.com|F|P|10.00|T1|K');
        $this->assertTrue($client->verifyResponseHash($plain));

        // …and an unsigned or wrongly-signed body with those fields present is still refused.
        $this->assertFalse($client->verifyResponseHash(array_merge($withCharges, ['hash' => hash('sha512', 'nope')])));
    }

    public function test_amounts_round_trip_between_rupees_and_paise_exactly(): void
    {
        $client = new PayuClient;

        $this->assertSame('1199.00', $client->rupees(119900));
        $this->assertSame('2999.50', $client->rupees(299950));
        $this->assertSame(119900, PayuClient::toPaise('1199.00'));
        $this->assertSame(119900, PayuClient::toPaise(1199));
        $this->assertSame(119900, PayuClient::toPaise('1,199.00'));
        $this->assertSame(-1, PayuClient::toPaise('free'), 'a non-number never equals a real amount');
        $this->assertSame(-1, PayuClient::toPaise(null));
    }

    // ───────────────────────────── 2. opening a checkout ─────────────────────────────

    public function test_checkout_needs_a_signed_in_student(): void
    {
        $this->postJson('/api/me/checkout', ['plan_code' => 'starter'])->assertUnauthorized();

        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_ADMIN_TPO]));
        $this->openPayuCheckout('starter')->assertForbidden()->assertJsonPath('code', 'student_only');
    }

    public function test_payu_is_the_default_gateway(): void
    {
        // What the shipped config says when PAYMENT_GATEWAY is not set in .env.
        $shipped = require base_path('config/billing.php');

        $this->assertSame('payu', $shipped['gateway']);
    }

    public function test_without_payu_keys_checkout_says_payments_are_not_set_up_and_never_activates_anything(): void
    {
        $this->setUpPayu(configured: false);
        $student = $this->payer();
        Sanctum::actingAs($student);

        $this->openPayuCheckout('expert')->assertStatus(503)->assertJsonPath('code', 'payments_unavailable');

        $this->assertSame(0, PaymentOrder::count());
        $this->assertSame('coder', $this->planOf($student), 'no paid plan without money moving');
        $this->getJson('/api/me/subscription')->assertOk()
            ->assertJsonPath('checkout.available', false)
            ->assertJsonPath('checkout.gateway', 'payu')
            ->assertJsonPath('checkout.gateway_name', 'PayU');
    }

    public function test_the_empty_placeholders_in_env_leave_payments_off_cleanly_and_in_test_mode(): void
    {
        Log::spy();
        // Exactly what `PAYMENT_GATEWAY=`, `PAYU_KEY=`, `PAYU_SALT=`, `PAYU_MODE=`, `PAYU_WEBHOOK_TOKEN=` give config.
        config([
            'billing.gateway' => '',
            'billing.payu.key' => '',
            'billing.payu.salt' => '',
            'billing.payu.mode' => '',
            'billing.payu.webhook_token' => '',
        ]);
        $student = $this->payer();
        Sanctum::actingAs($student);

        $this->getJson('/api/me/subscription')->assertOk()
            ->assertJsonPath('checkout.available', false)
            ->assertJsonPath('checkout.gateway', 'payu')
            ->assertJsonPath('checkout.test_mode', true);
        $this->openPayuCheckout('starter')->assertStatus(503)->assertJsonPath('code', 'payments_unavailable');
        $this->deliverPayuPaymentWebhook(['txnid' => 'x', 'status' => 'success', 'hash' => 'y'], withToken: false)->assertStatus(503);
        $this->artisan('payments:reconcile')->assertSuccessful()->expectsOutputToContain('nothing to reconcile');

        $this->assertSame(0, PaymentOrder::count());
        Http::assertNothingSent();
        Log::shouldNotHaveReceived('error');   // a blank placeholder is not a misconfiguration worth alarming anyone about
    }

    public function test_an_unknown_gateway_name_switches_payments_off_instead_of_guessing(): void
    {
        config(['billing.gateway' => 'payue']);   // a typo
        $student = $this->payer();
        Sanctum::actingAs($student);

        $this->openPayuCheckout('starter')->assertStatus(503)->assertJsonPath('code', 'payments_unavailable');
        $this->getJson('/api/me/subscription')->assertOk()->assertJsonPath('checkout.available', false)->assertJsonPath('checkout.gateway', null);
        $this->assertSame(0, PaymentOrder::count());
        Http::assertNothingSent();
    }

    public function test_the_subscription_payload_tells_the_ui_that_checkout_works_and_which_mode_it_is_in(): void
    {
        Sanctum::actingAs($this->payer());

        $this->getJson('/api/me/subscription')->assertOk()
            ->assertJsonPath('checkout.available', true)
            ->assertJsonPath('checkout.test_mode', true)
            ->assertJsonPath('checkout.gateway', 'payu')
            ->assertJsonPath('checkout.gateway_name', 'PayU');

        config(['billing.payu.mode' => 'live']);
        $this->getJson('/api/me/subscription')->assertJsonPath('checkout.test_mode', false);

        config(['billing.payu.mode' => 'anything-else']);
        $this->getJson('/api/me/subscription')->assertJsonPath('checkout.test_mode', true, 'only the exact word "live" means live');
    }

    public function test_opening_a_checkout_signs_a_payu_form_for_the_servers_price(): void
    {
        $student = $this->payer();
        Sanctum::actingAs($student);

        $response = $this->openPayuCheckout('expert', ['expected_total' => 2999])->assertCreated();

        $response
            ->assertJsonPath('checkout.gateway', 'payu')
            ->assertJsonPath('checkout.action', 'https://test.payu.in/_payment')
            ->assertJsonPath('checkout.method', 'POST')
            ->assertJsonPath('checkout.amount', 299900)
            ->assertJsonPath('checkout.test_mode', true)
            ->assertJsonPath('quote.total', 2999);

        $fields = $response->json('checkout.fields');
        $order = PaymentOrder::firstOrFail();

        $this->assertSame(FakePayuGateway::KEY, $fields['key']);
        $this->assertSame('2999.00', $fields['amount']);
        $this->assertSame('Asha', $fields['firstname']);
        $this->assertSame('asha@example.com', $fields['email']);
        $this->assertSame('9876543210', $fields['phone']);
        $this->assertSame('https://api.aptrun.test/api/payu/return', $fields['surl']);
        $this->assertSame($fields['surl'], $fields['furl']);
        $this->assertSame($fields['surl'], $fields['curl']);
        $this->assertSame($order->public_id, $fields['udf1'], 'our reference travels inside the signed part of the request');
        $this->assertSame('AptRun Expert - 1 year', $fields['productinfo']);
        $this->assertLessThanOrEqual(25, strlen($fields['txnid']));
        $this->assertSame($order->gateway_order_id, $fields['txnid']);
        $this->assertSame($fields['txnid'], substr($order->public_id, 0, strlen($fields['txnid'])), 'a support agent can go from a PayU txnid to our reference by eye');

        // PayU itself (the fake recomputes the documented formula) accepts this form: the hash is right.
        $this->payu->submitCheckout($fields);

        $this->assertSame(PaymentOrder::GATEWAY_PAYU, $order->gateway);
        $this->assertSame(PaymentOrder::STATUS_CREATED, $order->status);
        $this->assertSame('test', $order->gateway_mode);
        $this->assertSame(299900, $order->amount_paise);
        $this->assertSame($student->id, $order->user_id);
        $this->assertSame('9876543210', $order->meta['payer_phone']);
        $this->assertSame(FakePayuGateway::KEY, $order->meta['key_id']);
        $this->assertSame('coder', $this->planOf($student), 'opening Checkout buys nothing');
        $this->assertSame(0, $this->payu->calls('verify_payment'), 'nothing is sent to PayU until the browser goes there');

        $this->assertStringNotContainsString(FakePayuGateway::SALT, $response->getContent(), 'the salt never leaves the server');
        $this->assertArrayNotHasKey('salt', $fields);
    }

    public function test_the_browser_cannot_name_its_own_price(): void
    {
        Sanctum::actingAs($this->payer());

        $response = $this->postJson('/api/me/checkout', ['plan_code' => 'starter', 'amount' => 1, 'total' => 1, 'price' => 1, 'amount_paise' => 100])
            ->assertCreated()
            ->assertJsonPath('checkout.fields.amount', '1199.00');

        $this->assertSame(119900, PaymentOrder::firstOrFail()->amount_paise);
        $this->assertStringNotContainsString('"amount":"1.00"', $response->getContent());
    }

    public function test_a_form_edited_in_the_browser_is_refused_by_payu_because_the_hash_covers_the_amount(): void
    {
        Sanctum::actingAs($this->payer());
        $fields = $this->openPayuCheckout('expert')->json('checkout.fields');

        $fields['amount'] = '1.00';   // the student edits the hidden field before it is posted

        $this->expectExceptionMessage('hash mismatch');
        $this->payu->submitCheckout($fields);
    }

    public function test_a_price_that_changed_since_the_page_loaded_is_refused_with_the_new_quote_and_no_order(): void
    {
        Sanctum::actingAs($this->payer());
        Plan::where('code', 'starter')->update(['discount_percent' => 50]);

        $this->openPayuCheckout('starter', ['expected_total' => 1199])
            ->assertStatus(409)
            ->assertJsonPath('code', 'price_changed')
            ->assertJsonPath('quote.total', 1000);

        $this->assertSame(0, PaymentOrder::count());

        $this->openPayuCheckout('starter', ['expected_total' => 1000])->assertCreated()->assertJsonPath('checkout.fields.amount', '1000.00');
    }

    public function test_every_click_is_a_new_transaction_because_payu_never_takes_one_id_to_a_bank_twice(): void
    {
        Sanctum::actingAs($this->payer());

        $first = $this->openPayuCheckout('expert')->assertCreated()->json('checkout.fields.txnid');
        $second = $this->openPayuCheckout('expert')->assertCreated()->json('checkout.fields.txnid');

        $this->assertNotSame($first, $second);
        $this->assertSame(2, PaymentOrder::count());
        $this->assertNotSame(
            PaymentOrder::where('gateway_order_id', $first)->value('public_id'),
            PaymentOrder::where('gateway_order_id', $second)->value('public_id'),
        );
    }

    public function test_the_free_plan_has_nothing_to_pay_for(): void
    {
        Sanctum::actingAs($this->payer());

        $this->openPayuCheckout('coder')->assertStatus(422)->assertJsonPath('code', 'nothing_to_pay');
        $this->assertSame(0, PaymentOrder::count());
    }

    public function test_a_student_without_a_mobile_number_is_asked_for_one_and_nothing_is_created_until_they_give_it(): void
    {
        $student = $this->student(['phone' => null]);
        Sanctum::actingAs($student);

        $this->openPayuCheckout('starter')->assertStatus(422)->assertJsonPath('code', 'phone_required');
        $this->openPayuCheckout('starter', ['phone' => '12345'])->assertStatus(422)->assertJsonPath('code', 'phone_required');
        $this->assertSame(0, PaymentOrder::count());

        $response = $this->openPayuCheckout('starter', ['phone' => '+91 98765-43210'])->assertCreated();

        $this->assertSame('9876543210', $response->json('checkout.fields.phone'));
        $this->assertSame('9876543210', PaymentOrder::firstOrFail()->meta['payer_phone']);
        $this->assertNull($student->fresh()->phone, 'the number is for this payment; it is not written to their profile');
    }

    public function test_a_phone_on_file_is_used_in_any_common_format(): void
    {
        $student = $this->student(['phone' => '098765 43210']);
        Sanctum::actingAs($student);

        $this->openPayuCheckout('starter')->assertCreated()->assertJsonPath('checkout.fields.phone', '9876543210');
    }

    public function test_an_email_longer_than_payus_limit_is_refused_in_words_not_sent_to_be_truncated(): void
    {
        $student = $this->payer(['email' => 'a-very-long-local-part-for-a-student@a-rather-long-college-domain.example.edu']);
        Sanctum::actingAs($student);

        $this->openPayuCheckout('starter')->assertStatus(422)->assertJsonPath('code', 'email_unsupported');
        $this->assertSame(0, PaymentOrder::count());
    }

    public function test_a_return_url_longer_than_payus_fifty_characters_stops_checkout_with_a_clear_log_line(): void
    {
        Log::spy();
        config(['billing.payu.return_url' => 'https://api.a-quite-long-hostname.example-college-platform.com/api/payu/return']);
        Sanctum::actingAs($this->payer());

        $this->openPayuCheckout('starter')->assertStatus(503)->assertJsonPath('code', 'payments_unavailable');
        $this->assertSame(0, PaymentOrder::count());

        Log::shouldHaveReceived('critical')->withArgs(fn ($message) => str_contains($message, '50 characters'))->once();
    }

    public function test_the_return_url_defaults_to_this_apis_own_address(): void
    {
        config(['billing.payu.return_url' => null, 'app.url' => 'https://api.aptrun.com']);
        $this->assertSame('https://api.aptrun.com/api/payu/return', (new PayuClient)->returnUrl());

        // The localhost placeholder in .env is not handed to PayU: the address the request came in on is used,
        // so `php artisan serve` on :8000 works with no setup.
        config(['app.url' => 'http://localhost']);
        app('url')->forceRootUrl('http://127.0.0.1:8000');
        $this->assertSame('http://127.0.0.1:8000/api/payu/return', (new PayuClient)->returnUrl());

        // An explicit PAYU_RETURN_URL beats both.
        config(['billing.payu.return_url' => 'https://pay.aptrun.com/payu']);
        $this->assertSame('https://pay.aptrun.com/payu', (new PayuClient)->returnUrl());
    }

    public function test_names_are_made_safe_for_payus_hash_string_and_limits(): void
    {
        Sanctum::actingAs($this->payer(['name' => "O'Brien-Smith & Sons"]));
        $this->assertSame('OBrienSmith', $this->openPayuCheckout('starter')->assertCreated()->json('checkout.fields.firstname'));

        Sanctum::actingAs($this->payer(['name' => 'Bartholomewjonathanchristopherwilliam Rao', 'email' => 'b@example.com']));
        $this->assertSame(20, strlen($this->openPayuCheckout('starter')->assertCreated()->json('checkout.fields.firstname')));

        Sanctum::actingAs($this->payer(['name' => '!!! ???', 'email' => 'c@example.com']));
        $this->assertSame('Student', $this->openPayuCheckout('starter')->assertCreated()->json('checkout.fields.firstname'));

        // And the fake PayU refuses a `|` or `&` in these fields, so none of these forms would have been accepted if it slipped through.
        $this->payu->submitCheckout($this->openPayuCheckout('starter')->json('checkout.fields'));
    }

    public function test_buying_a_lower_plan_while_holding_a_higher_one_is_refused(): void
    {
        $student = $this->payer();
        $this->buy($student, 'expert');
        Sanctum::actingAs($student->fresh());

        $this->openPayuCheckout('starter')->assertStatus(409)->assertJsonPath('code', 'downgrade_blocked');
        $this->assertSame(0, PaymentOrder::count());
    }

    public function test_a_student_who_cannot_buy_the_plan_is_told_so_before_being_asked_for_a_phone_number(): void
    {
        $student = $this->student(['phone' => null]);
        $this->buy($student, 'expert');
        Sanctum::actingAs($student->fresh());

        $this->openPayuCheckout('starter')->assertStatus(409)->assertJsonPath('code', 'downgrade_blocked');
        $this->openPayuCheckout('coder')->assertStatus(422)->assertJsonPath('code', 'nothing_to_pay');
    }

    // ───────────────────────────── 3. the browser's return ─────────────────────────────

    public function test_paying_and_coming_back_activates_the_plan_and_sends_the_student_to_their_billing_page(): void
    {
        $student = $this->payer();
        $started = $this->startPayuPayment($student, 'expert');
        $this->payu->pay($started['txnid']);

        $this->payuReturn($this->payu->responseFields($started['txnid']))
            ->assertStatus(303)
            ->assertRedirect($this->billingUrl($started['order'], 'paid'));

        $order = $started['order']->refresh();
        $this->assertSame(PaymentOrder::STATUS_PAID, $order->status);
        $this->assertSame($this->payu->transactions[$started['txnid']]['mihpayid'], $order->gateway_payment_id);
        $this->assertSame('card', $order->method);
        $this->assertNotNull($order->paid_at);
        $this->assertNotNull($order->fulfilled_at);
        $this->assertSame(1, $this->payu->calls('verify_payment'), 'PayU was asked, not just listened to');

        $this->assertSame('expert', $this->planOf($student));
        $subscription = $student->fresh()->activeSubscription();
        $this->assertSame($order->public_id, $subscription->meta['purchase_ref']);
        $this->assertSame('payu', $subscription->meta['gateway']);
        $this->assertSame($order->gateway_payment_id, $subscription->meta['gateway_payment_id']);
        $this->assertSame(2999, $subscription->meta['price_paid']);
        $this->assertEqualsWithDelta(365, $subscription->daysRemaining(), 1);

        Mail::assertSent(PaymentReceiptMail::class, fn (PaymentReceiptMail $mail) => $mail->hasTo($student->email) && $mail->order->is($order));
    }

    public function test_the_status_endpoint_then_shows_the_student_a_paid_receipt(): void
    {
        $student = $this->payer();
        $order = $this->purchaseThroughPayu($student, 'starter');

        Sanctum::actingAs($student);
        $this->getJson('/api/me/payments/'.$order->public_id)->assertOk()
            ->assertJsonPath('payment.status', 'paid')
            ->assertJsonPath('payment.amount', 1199)
            ->assertJsonPath('payment.method', 'card')
            ->assertJsonPath('payment.payment_id', $order->gateway_payment_id)
            ->assertJsonPath('payment.test_mode', true);
    }

    public function test_a_forged_return_is_logged_and_cannot_activate_anything_by_itself(): void
    {
        Log::spy();
        $student = $this->payer();
        $started = $this->startPayuPayment($student, 'expert');      // the student never paid

        $forged = $this->payu->responseFields($started['txnid'], ['status' => 'success', 'unmappedstatus' => 'captured']);
        $forged['hash'] = hash('sha512', 'made up');

        $this->payuReturn($forged)->assertRedirect($this->billingUrl($started['order'], 'pending'));

        $this->assertSame('coder', $this->planOf($student));
        $this->assertSame(PaymentOrder::STATUS_CREATED, $started['order']->refresh()->status);
        Mail::assertNothingSent();
        Log::shouldHaveReceived('warning')->withArgs(fn ($message) => str_contains($message, 'response hash that does not match'))->once();
    }

    public function test_a_return_whose_hash_this_code_does_not_recognise_still_activates_a_payment_payu_itself_confirms(): void
    {
        // If PayU ever changes its hash layout, a student who really paid must not be stranded: PayU's API is the authority.
        Log::spy();
        $student = $this->payer();
        $started = $this->startPayuPayment($student, 'expert');
        $this->payu->pay($started['txnid']);

        $fields = $this->payu->responseFields($started['txnid']);
        $fields['hash'] = hash('sha512', 'a layout we do not know');

        $this->payuReturn($fields)->assertRedirect($this->billingUrl($started['order'], 'paid'));

        $this->assertSame('expert', $this->planOf($student));
        $this->assertSame(1, $this->payu->calls('verify_payment'));
        Log::shouldHaveReceived('warning')->withArgs(fn ($message) => str_contains($message, 'response hash that does not match'))->once();
    }

    public function test_an_unsigned_return_cannot_even_claim_the_student_cancelled_or_that_the_payment_failed(): void
    {
        $student = $this->payer();
        $started = $this->startPayuPayment($student, 'starter');       // still on PayU's page, per PayU

        foreach (['userCancelled' => 'failure', 'failed' => 'failure'] as $unmapped => $status) {
            $fields = $this->payu->responseFields($started['txnid'], ['status' => $status, 'unmappedstatus' => $unmapped]);
            $fields['hash'] = str_repeat('0', 128);

            $this->payuReturn($fields)->assertRedirect($this->billingUrl($started['order'], 'pending'));
        }

        $this->assertSame(0, $started['order']->refresh()->attempts, 'nothing was written to the order from an unsigned POST');
    }

    public function test_an_unsigned_return_for_a_payment_payu_says_failed_is_worded_from_what_payu_told_us(): void
    {
        $started = $this->startPayuPayment($this->payer(), 'starter');
        $this->payu->fail($started['txnid'], 'Insufficient funds in the account.');

        $fields = $this->payu->responseFields($started['txnid']);
        $fields['hash'] = str_repeat('0', 128);

        $this->payuReturn($fields)->assertRedirect($this->billingUrl($started['order'], 'failed'));
        $this->assertSame('Insufficient funds in the account.', $started['order']->refresh()->failure_reason);
    }

    public function test_a_return_that_claims_success_for_an_unpaid_transaction_activates_nothing(): void
    {
        // The hash is valid (PayU "said" success) but PayU's own record says the customer never paid:
        // it is PayU's API, not the posted status, that settles an order.
        $student = $this->payer();
        $started = $this->startPayuPayment($student, 'expert');   // still `initiated` at PayU

        $claim = $this->payu->responseFields($started['txnid'], ['status' => 'success', 'unmappedstatus' => 'captured']);

        $this->payuReturn($claim)->assertRedirect($this->billingUrl($started['order'], 'pending'));

        $this->assertSame('coder', $this->planOf($student));
        $this->assertSame(PaymentOrder::STATUS_CREATED, $started['order']->refresh()->status);
    }

    public function test_a_payment_for_the_wrong_amount_is_not_honoured_and_is_flagged(): void
    {
        $student = $this->payer();
        $started = $this->startPayuPayment($student, 'expert');
        $this->payu->pay($started['txnid'], ['amount' => '1.00']);   // ₹1 against a ₹2,999 order

        $this->payuReturn($this->payu->responseFields($started['txnid']))->assertRedirect($this->billingUrl($started['order'], 'processing'));

        $this->assertSame('coder', $this->planOf($student));
        $order = $started['order']->refresh();
        $this->assertSame(PaymentOrder::STATUS_NEEDS_REVIEW, $order->status);
        $this->assertSame('payment_mismatch', $order->failure_code);
    }

    public function test_replaying_the_return_buys_one_plan_and_sends_one_receipt(): void
    {
        $student = $this->payer();
        $started = $this->startPayuPayment($student, 'starter');
        $this->payu->pay($started['txnid']);
        $fields = $this->payu->responseFields($started['txnid']);

        $this->payuReturn($fields)->assertRedirect($this->billingUrl($started['order'], 'paid'));
        $this->payuReturn($fields)->assertRedirect($this->billingUrl($started['order'], 'paid'));

        $this->assertSame(1, $this->activeBaseSubscriptions($student));
        $this->assertSame(1, Subscription::where('subscriber_id', $student->id)->whereHas('plan', fn ($q) => $q->where('code', 'starter'))->count());
        Mail::assertSent(PaymentReceiptMail::class, 1);
    }

    public function test_a_declined_payment_is_recorded_with_its_reason_and_the_student_can_try_again_with_a_new_transaction(): void
    {
        $student = $this->payer();
        $started = $this->startPayuPayment($student, 'expert');
        $this->payu->fail($started['txnid'], 'Insufficient funds in the account.');

        $this->payuReturn($this->payu->responseFields($started['txnid']))->assertRedirect($this->billingUrl($started['order'], 'failed'));

        $order = $started['order']->refresh();
        $this->assertSame(PaymentOrder::STATUS_CREATED, $order->status, 'still payable');
        $this->assertSame(1, $order->attempts);
        $this->assertSame('E325', $order->failure_code);
        $this->assertSame('Insufficient funds in the account.', $order->failure_reason);
        $this->assertSame('coder', $this->planOf($student));

        Sanctum::actingAs($student);
        $this->getJson('/api/me/payments/'.$order->public_id)->assertOk()
            ->assertJsonPath('payment.status', 'failed')
            ->assertJsonPath('payment.failure_reason', 'Insufficient funds in the account.');

        // Trying again is a brand-new transaction; paying it works.
        $retry = $this->startPayuPayment($student, 'expert');
        $this->assertNotSame($started['txnid'], $retry['txnid']);
        $this->payu->pay($retry['txnid']);
        $this->payuReturn($this->payu->responseFields($retry['txnid']))->assertRedirect($this->billingUrl($retry['order'], 'paid'));

        $this->assertSame('expert', $this->planOf($student));
        $this->assertSame(PaymentOrder::STATUS_CREATED, $order->refresh()->status, 'the declined attempt stays a declined attempt');
    }

    public function test_cancelling_on_payus_page_is_not_a_failure_and_leaves_no_mark_on_the_history(): void
    {
        $student = $this->payer();
        $started = $this->startPayuPayment($student, 'expert');
        $this->payu->cancel($started['txnid']);

        $this->payuReturn($this->payu->responseFields($started['txnid']))->assertRedirect($this->billingUrl($started['order'], 'cancelled'));

        $order = $started['order']->refresh();
        $this->assertSame(PaymentOrder::STATUS_CREATED, $order->status);
        $this->assertSame(0, $order->attempts);
        $this->assertNull($order->failure_code);

        Sanctum::actingAs($student);
        $this->assertSame([], $this->getJson('/api/me/payments')->assertOk()->json('payments'), 'an abandoned checkout is noise, not history');
    }

    public function test_a_return_for_a_transaction_we_do_not_know_lands_on_billing_without_a_reference(): void
    {
        $started = $this->startPayuPayment($this->payer(), 'starter');
        $this->payu->pay($started['txnid']);
        $fields = $this->payu->responseFields($started['txnid']);
        $fields['txnid'] = 'DOESNOTEXIST000000000001';

        $this->post('/api/payu/return', $fields)->assertStatus(303)->assertRedirect('https://app.aptrun.test/dashboard/billing?result=unknown');
        $this->post('/api/payu/return', [])->assertStatus(303)->assertRedirect('https://app.aptrun.test/dashboard/billing?result=unknown');
    }

    public function test_opening_the_return_address_in_a_browser_just_goes_to_billing(): void
    {
        $this->get('/api/payu/return')->assertStatus(303)->assertRedirect('https://app.aptrun.test/dashboard/billing');
    }

    public function test_the_return_never_errors_even_when_payu_is_down_and_the_status_poll_finishes_the_job(): void
    {
        $student = $this->payer();
        $started = $this->startPayuPayment($student, 'expert');
        $this->payu->pay($started['txnid']);
        $fields = $this->payu->responseFields($started['txnid']);

        $this->payu->down = true;
        $this->payuReturn($fields)->assertStatus(303)->assertRedirect($this->billingUrl($started['order'], 'pending'));
        $this->assertSame('coder', $this->planOf($student), 'nothing is activated on the strength of the browser alone');
        $this->assertSame(PaymentOrder::STATUS_CREATED, $started['order']->refresh()->status);

        // PayU is back; the page the student landed on asks for the status — and that asks PayU.
        $this->payu->down = false;
        Sanctum::actingAs($student);
        $this->getJson('/api/me/payments/'.$started['order']->public_id)->assertOk()->assertJsonPath('payment.status', 'paid');
        $this->assertSame('expert', $this->planOf($student));
    }

    public function test_a_payment_the_browser_never_reported_is_found_by_the_students_own_status_check(): void
    {
        $student = $this->payer();
        $started = $this->startPayuPayment($student, 'starter');
        $this->payu->pay($started['txnid']);      // paid at the bank; the tab was closed; no return, no webhook

        Sanctum::actingAs($student);
        $this->getJson('/api/me/payments/'.$started['order']->public_id)->assertOk()->assertJsonPath('payment.status', 'paid');

        $this->assertSame('starter', $this->planOf($student));
    }

    // ───────────────────────────── 4. the webhook ─────────────────────────────

    public function test_the_webhook_answers_503_until_payu_is_configured(): void
    {
        $this->setUpPayu(configured: false);

        $this->deliverPayuPaymentWebhook(['txnid' => 'x', 'status' => 'success', 'hash' => 'y'])->assertStatus(503);
    }

    public function test_the_webhook_url_needs_its_token_when_one_is_configured(): void
    {
        $started = $this->startPayuPayment($this->payer(), 'starter');
        $this->payu->pay($started['txnid']);
        $fields = $this->payu->responseFields($started['txnid']);

        $this->deliverPayuPaymentWebhook($fields, withToken: false)->assertForbidden();
        $this->post('/api/webhooks/payu?token=wrong', $fields)->assertForbidden();

        $this->assertSame(0, PaymentWebhookEvent::count());
        $this->assertSame(PaymentOrder::STATUS_CREATED, $started['order']->refresh()->status);

        // With no token configured at all the URL is open (the signature still gates payment events).
        $this->setUpPayu(webhookToken: false);
        $this->deliverPayuPaymentWebhook($fields, withToken: false)->assertOk();
    }

    public function test_an_ip_allow_list_keeps_other_senders_out(): void
    {
        $started = $this->startPayuPayment($this->payer(), 'starter');
        $this->payu->pay($started['txnid']);
        $fields = $this->payu->responseFields($started['txnid']);

        config(['billing.payu.webhook_allowed_ips' => '3.7.89.1, 3.7.89.2']);
        $this->deliverPayuPaymentWebhook($fields)->assertForbidden();   // the test client is 127.0.0.1

        config(['billing.payu.webhook_allowed_ips' => '127.0.0.1']);
        $this->deliverPayuPaymentWebhook($fields)->assertOk();
    }

    public function test_a_payment_event_delivered_as_json_is_still_a_payment_event(): void
    {
        $student = $this->payer();
        $started = $this->startPayuPayment($student, 'starter');
        $this->payu->pay($started['txnid']);

        $this->deliverPayuJsonWebhook($this->payu->responseFields($started['txnid']))->assertOk()->assertJsonPath('status', 'processed');

        $this->assertSame('starter', $this->planOf($student));

        // …and it is held to the same standard: a bad hash is refused whatever the wire format.
        $other = $this->startPayuPayment($this->payer(['email' => 'json@example.com']), 'starter');
        $this->payu->pay($other['txnid']);
        $tampered = $this->payu->responseFields($other['txnid']);
        $tampered['amount'] = '1.00';

        $this->deliverPayuJsonWebhook($tampered)->assertStatus(400);
        $this->assertSame(PaymentOrder::STATUS_CREATED, $other['order']->refresh()->status);
    }

    public function test_a_payment_webhook_with_a_bad_hash_or_no_hash_is_refused(): void
    {
        $started = $this->startPayuPayment($this->payer(), 'starter');
        $this->payu->pay($started['txnid']);
        $fields = $this->payu->responseFields($started['txnid']);

        $tampered = $fields;
        $tampered['amount'] = '1.00';          // changed after PayU signed it
        $this->deliverPayuPaymentWebhook($tampered)->assertStatus(400);

        $unsigned = $fields;
        unset($unsigned['hash']);
        $this->deliverPayuPaymentWebhook($unsigned)->assertStatus(400);

        $this->deliverPayuPaymentWebhook(['hello' => 'world'])->assertStatus(400);

        $this->assertSame(0, PaymentWebhookEvent::count());
        $this->assertSame(PaymentOrder::STATUS_CREATED, $started['order']->refresh()->status);
    }

    public function test_a_payment_webhook_activates_the_plan_even_though_the_browser_never_came_back(): void
    {
        $student = $this->payer();
        $started = $this->startPayuPayment($student, 'expert');
        $this->payu->pay($started['txnid']);

        $this->deliverPayuPaymentWebhook($this->payu->responseFields($started['txnid']))->assertOk()->assertJsonPath('status', 'processed');

        $this->assertSame('expert', $this->planOf($student));
        $this->assertSame(PaymentOrder::STATUS_PAID, $started['order']->refresh()->status);
        $this->assertSame(1, $this->payu->calls('verify_payment'), 'the webhook is a pointer; PayU is asked what really happened');
        Mail::assertSent(PaymentReceiptMail::class, 1);

        $event = PaymentWebhookEvent::firstOrFail();
        $this->assertSame('payu', $event->gateway);
        $this->assertSame(PaymentWebhookEvent::STATUS_PROCESSED, $event->status);
        $this->assertSame($started['order']->id, $event->payment_order_id);
    }

    public function test_the_stored_webhook_payload_keeps_what_audit_needs_and_not_the_buyers_personal_details(): void
    {
        $started = $this->startPayuPayment($this->payer(), 'starter');
        $this->payu->pay($started['txnid']);

        $this->deliverPayuPaymentWebhook($this->payu->responseFields($started['txnid']))->assertOk();

        $payload = PaymentWebhookEvent::firstOrFail()->payload;
        $this->assertSame($started['txnid'], $payload['txnid']);
        $this->assertSame('success', $payload['status']);
        $this->assertSame('1199.00', $payload['amount']);
        foreach (['email', 'phone', 'firstname', 'lastname', 'address1', 'city', 'card_no', 'hash', 'cardnum'] as $personal) {
            $this->assertArrayNotHasKey($personal, $payload, "{$personal} is not kept");
        }
    }

    public function test_a_redelivered_payment_event_and_the_browser_return_together_buy_one_plan(): void
    {
        $student = $this->payer();
        $started = $this->startPayuPayment($student, 'starter');
        $this->payu->pay($started['txnid']);
        $fields = $this->payu->responseFields($started['txnid']);

        $this->deliverPayuPaymentWebhook($fields)->assertOk()->assertJsonPath('status', 'processed');
        $this->deliverPayuPaymentWebhook($fields)->assertOk()->assertJsonPath('status', 'duplicate');
        $this->payuReturn($fields)->assertRedirect($this->billingUrl($started['order'], 'paid'));

        $this->assertSame(1, $this->activeBaseSubscriptions($student));
        $this->assertSame(1, PaymentWebhookEvent::count());
        Mail::assertSent(PaymentReceiptMail::class, 1);
    }

    public function test_the_webhook_trusts_payus_current_state_not_the_events_claim(): void
    {
        $student = $this->payer();
        $started = $this->startPayuPayment($student, 'expert');
        $this->payu->fail($started['txnid']);

        // A (validly signed) success event for a transaction PayU itself says failed.
        $claim = $this->payu->responseFields($started['txnid'], ['status' => 'success', 'unmappedstatus' => 'captured']);
        $this->deliverPayuPaymentWebhook($claim)->assertOk();

        $this->assertSame('coder', $this->planOf($student));
        $this->assertNotSame(PaymentOrder::STATUS_PAID, $started['order']->refresh()->status);
    }

    public function test_when_payu_does_not_yet_know_the_transaction_the_webhook_answers_500_so_it_is_delivered_again(): void
    {
        $student = $this->payer();
        $started = $this->startPayuPayment($student, 'starter');
        $this->payu->pay($started['txnid']);
        $fields = $this->payu->responseFields($started['txnid']);

        $this->payu->down = true;
        $this->deliverPayuPaymentWebhook($fields)->assertStatus(500);
        $this->assertSame(PaymentWebhookEvent::STATUS_FAILED, PaymentWebhookEvent::firstOrFail()->status);
        $this->assertSame('coder', $this->planOf($student));

        $this->payu->down = false;
        $this->deliverPayuPaymentWebhook($fields)->assertOk()->assertJsonPath('status', 'processed');
        $this->assertSame('starter', $this->planOf($student));
        $this->assertSame(1, PaymentWebhookEvent::count());
        $this->assertSame(PaymentWebhookEvent::STATUS_PROCESSED, PaymentWebhookEvent::firstOrFail()->status);
    }

    public function test_a_failure_webhook_records_the_reason_without_closing_the_order(): void
    {
        $student = $this->payer();
        $started = $this->startPayuPayment($student, 'starter');
        $this->payu->fail($started['txnid'], 'The card has expired.');

        $this->deliverPayuPaymentWebhook($this->payu->responseFields($started['txnid']))->assertOk();

        $order = $started['order']->refresh();
        $this->assertSame(PaymentOrder::STATUS_CREATED, $order->status);
        $this->assertSame('The card has expired.', $order->failure_reason);
        $this->assertSame(1, $order->attempts);
    }

    public function test_a_late_failure_event_does_not_undo_a_payment_that_already_succeeded(): void
    {
        $student = $this->payer();
        $started = $this->startPayuPayment($student, 'starter');
        $this->payu->pay($started['txnid']);
        $this->payuReturn($this->payu->responseFields($started['txnid']))->assertRedirect();

        $this->deliverPayuPaymentWebhook($this->payu->responseFields($started['txnid'], ['status' => 'failure', 'unmappedstatus' => 'failed']))->assertOk();

        $order = $started['order']->refresh();
        $this->assertSame(PaymentOrder::STATUS_PAID, $order->status);
        $this->assertNull($order->failure_code);
        $this->assertSame('starter', $this->planOf($student));
    }

    public function test_a_webhook_for_a_transaction_that_is_not_ours_is_acknowledged_and_ignored(): void
    {
        $started = $this->startPayuPayment($this->payer(), 'starter');
        $this->payu->pay($started['txnid']);
        $fields = $this->payu->responseFields($started['txnid']);
        $other = $this->payu->responseFields($started['txnid']);
        $other['txnid'] = 'SOMEOTHERPRODUCT000000001';
        $other['hash'] = $this->payu->reverseHash($other);   // validly signed — PayU account serves other products too

        $this->deliverPayuPaymentWebhook($other)->assertOk()->assertJsonPath('status', 'ignored');

        $this->assertSame(PaymentOrder::STATUS_CREATED, $started['order']->refresh()->status);
        $this->assertSame(PaymentWebhookEvent::STATUS_IGNORED, PaymentWebhookEvent::firstOrFail()->status);
        $this->assertNotEmpty($fields);
    }

    // ───────────────────────────── refunds that arrive by webhook ─────────────────────────────

    public function test_a_full_refund_from_the_dashboard_takes_the_plan_back_and_a_second_delivery_changes_nothing(): void
    {
        $student = $this->payer();
        $order = $this->purchaseThroughPayu($student, 'expert');
        $requestId = $this->payu->dashboardRefund($order->gateway_order_id);

        $this->deliverPayuJsonWebhook($this->payu->refundWebhook($requestId))->assertOk()->assertJsonPath('status', 'processed');

        $order->refresh();
        $this->assertSame(PaymentOrder::STATUS_REFUNDED, $order->status);
        $this->assertSame(299900, $order->refunded_paise);
        $this->assertSame($requestId, $order->refund_id);
        $this->assertSame('coder', $this->planOf($student), 'the plan it bought is cancelled');

        $this->deliverPayuJsonWebhook($this->payu->refundWebhook($requestId))->assertOk()->assertJsonPath('status', 'duplicate');
        $this->assertSame(299900, $order->refresh()->refunded_paise);
    }

    public function test_a_partial_refund_is_recorded_but_leaves_the_plan_alone(): void
    {
        $student = $this->payer();
        $order = $this->purchaseThroughPayu($student, 'expert');
        $requestId = $this->payu->dashboardRefund($order->gateway_order_id, '500.00');

        $this->deliverPayuJsonWebhook($this->payu->refundWebhook($requestId))->assertOk();

        $order->refresh();
        $this->assertSame(PaymentOrder::STATUS_PARTIALLY_REFUNDED, $order->status);
        $this->assertSame(50000, $order->refunded_paise);
        $this->assertSame('expert', $this->planOf($student));
    }

    public function test_a_refund_webhook_for_a_refund_payu_does_not_have_cannot_take_a_plan_away(): void
    {
        $student = $this->payer();
        $order = $this->purchaseThroughPayu($student, 'expert');

        // Unsigned JSON from a stranger who knows the token (or the URL is open): claims a refund PayU never made.
        $forged = [
            'action' => 'refund', 'status' => 'success', 'key' => FakePayuGateway::KEY, 'amt' => '2999.00',
            'merchantTxnId' => $order->gateway_order_id, 'mihpayid' => $order->gateway_payment_id,
            'request_id' => '9999999999', 'token' => 'FORGED',
        ];

        $this->deliverPayuJsonWebhook($forged)->assertStatus(500);

        $order->refresh();
        $this->assertSame(PaymentOrder::STATUS_PAID, $order->status);
        $this->assertSame(0, $order->refunded_paise);
        $this->assertSame('expert', $this->planOf($student));
    }

    public function test_a_refund_webhook_without_the_token_is_refused_outright(): void
    {
        $order = $this->purchaseThroughPayu($this->payer(), 'starter');
        $requestId = $this->payu->dashboardRefund($order->gateway_order_id);

        $this->deliverPayuJsonWebhook($this->payu->refundWebhook($requestId), token: null)->assertForbidden();
        $this->deliverPayuJsonWebhook($this->payu->refundWebhook($requestId), token: 'nope')->assertForbidden();

        $this->assertSame(PaymentOrder::STATUS_PAID, $order->refresh()->status);
    }

    public function test_the_refund_amount_comes_from_payu_not_from_the_unsigned_body(): void
    {
        $student = $this->payer();
        $order = $this->purchaseThroughPayu($student, 'expert');
        $requestId = $this->payu->dashboardRefund($order->gateway_order_id, '100.00');

        $body = $this->payu->refundWebhook($requestId);
        $body['amt'] = '2999.00';   // the body lies; PayU's record says ₹100

        $this->deliverPayuJsonWebhook($body)->assertOk();

        $this->assertSame(PaymentOrder::STATUS_PARTIALLY_REFUNDED, $order->refresh()->status);
        $this->assertSame(10000, $order->refunded_paise);
        $this->assertSame('expert', $this->planOf($student));
    }

    public function test_a_refund_still_in_flight_at_payu_is_retried_not_applied(): void
    {
        $order = $this->purchaseThroughPayu($this->payer(), 'starter');
        $requestId = $this->payu->dashboardRefund($order->gateway_order_id, null, 'queued');

        $this->deliverPayuJsonWebhook($this->payu->refundWebhook($requestId, 'success'))->assertStatus(500);

        $this->assertSame(PaymentOrder::STATUS_PAID, $order->refresh()->status);
        $this->assertSame(PaymentWebhookEvent::STATUS_FAILED, PaymentWebhookEvent::firstOrFail()->status);
    }

    public function test_a_chargeback_is_written_onto_the_order_for_a_person_and_changes_no_access(): void
    {
        Log::spy();
        $student = $this->payer();
        $order = $this->purchaseThroughPayu($student, 'starter');

        $this->deliverPayuJsonWebhook($this->payu->disputeWebhook($order->gateway_payment_id, 'New'))->assertOk()->assertJsonPath('status', 'processed');
        $this->deliverPayuJsonWebhook($this->payu->disputeWebhook($order->gateway_payment_id, 'Pending Response'))->assertOk();
        $this->deliverPayuJsonWebhook($this->payu->disputeWebhook($order->gateway_payment_id, 'Pending Response'))->assertOk()->assertJsonPath('status', 'duplicate');

        $order->refresh();
        $this->assertSame(PaymentOrder::STATUS_PAID, $order->status);
        $this->assertSame('starter', $this->planOf($student));
        $this->assertSame('Pending Response', $order->meta['disputes']['1761758']['status']);
        $this->assertSame('2026-11-30', $order->meta['disputes']['1761758']['due_date']);

        Log::shouldHaveReceived('critical')->withArgs(fn ($m) => str_contains($m, 'chargeback'))->twice();

        // It is visible to the superadmin.
        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_SUPERADMIN]));
        $row = collect($this->getJson('/api/superadmin/payments')->assertOk()->json('payments'))->firstWhere('id', $order->public_id);
        $this->assertSame('Pending Response', $row['disputes']['1761758']['status']);
    }

    public function test_a_chargeback_on_a_payment_that_is_not_ours_is_ignored(): void
    {
        $this->deliverPayuJsonWebhook($this->payu->disputeWebhook('999999999999'))->assertOk()->assertJsonPath('status', 'ignored');
    }

    public function test_a_json_body_that_is_neither_refund_nor_dispute_is_refused(): void
    {
        $this->deliverPayuJsonWebhook(['hello' => 'world'])->assertStatus(400);
    }

    // ───────────────────────────── 5. reconcile ─────────────────────────────

    public function test_reconcile_activates_a_paid_order_whose_webhook_and_return_never_arrived(): void
    {
        $student = $this->payer();
        $started = $this->startPayuPayment($student, 'starter');
        $this->payu->pay($started['txnid']);
        $this->age($started['order'], 10);

        $this->artisan('payments:reconcile')->assertSuccessful();

        $this->assertSame('starter', $this->planOf($student));
        $this->assertSame(PaymentOrder::STATUS_PAID, $started['order']->refresh()->status);
        Mail::assertSent(PaymentReceiptMail::class, 1);
    }

    public function test_reconcile_leaves_a_fresh_order_alone_and_closes_an_abandoned_one_after_payus_window(): void
    {
        $student = $this->payer();
        $fresh = $this->startPayuPayment($student, 'starter');                  // submitted, not paid
        $abandoned = $this->startPayuPayment($student, 'expert');
        $neverReached = $this->openPayuCheckout('expert')->json('checkout.fields.txnid');   // never posted to PayU at all
        $this->age($abandoned['order'], 90);
        PaymentOrder::where('gateway_order_id', $neverReached)->update(['created_at' => now()->subMinutes(90)]);

        $this->artisan('payments:reconcile')->assertSuccessful();

        $this->assertSame(PaymentOrder::STATUS_CREATED, $fresh['order']->refresh()->status, 'under 5 minutes old: not chased yet');
        $this->assertSame(PaymentOrder::STATUS_EXPIRED, $abandoned['order']->refresh()->status);
        $this->assertSame(PaymentOrder::STATUS_EXPIRED, PaymentOrder::where('gateway_order_id', $neverReached)->value('status'));

        // The scheduled run does not keep asking PayU about orders it has already given up on.
        $callsBefore = $this->payu->calls('verify_payment');
        $this->artisan('payments:reconcile')->assertSuccessful();
        $this->assertSame($callsBefore, $this->payu->calls('verify_payment'));
    }

    public function test_an_expired_order_that_is_paid_late_is_still_honoured(): void
    {
        $student = $this->payer();
        $started = $this->startPayuPayment($student, 'starter');
        $this->age($started['order'], 90);
        $this->artisan('payments:reconcile')->assertSuccessful();
        $this->assertSame(PaymentOrder::STATUS_EXPIRED, $started['order']->refresh()->status);

        $this->payu->pay($started['txnid']);                                   // the customer finally pays
        $this->deliverPayuPaymentWebhook($this->payu->responseFields($started['txnid']))->assertOk();

        $this->assertSame(PaymentOrder::STATUS_PAID, $started['order']->refresh()->status);
        $this->assertSame('starter', $this->planOf($student));
    }

    public function test_reconcile_all_rechecks_expired_orders_too(): void
    {
        $student = $this->payer();
        $started = $this->startPayuPayment($student, 'starter');
        $this->age($started['order'], 90);
        $this->artisan('payments:reconcile')->assertSuccessful();
        $this->payu->pay($started['txnid']);

        $this->artisan('payments:reconcile')->assertSuccessful();
        $this->assertSame(PaymentOrder::STATUS_EXPIRED, $started['order']->refresh()->status, 'the scheduled run has given up on it');

        $this->artisan('payments:reconcile --all')->assertSuccessful();
        $this->assertSame(PaymentOrder::STATUS_PAID, $started['order']->refresh()->status);
    }

    public function test_reconcile_survives_payu_being_down_and_does_nothing_without_credentials(): void
    {
        $student = $this->payer();
        $started = $this->startPayuPayment($student, 'starter');
        $this->payu->pay($started['txnid']);
        $this->age($started['order'], 10);

        $this->payu->down = true;
        $this->artisan('payments:reconcile')->assertFailed();    // every order errored: the job says so
        $this->assertSame(PaymentOrder::STATUS_CREATED, $started['order']->refresh()->status);

        $this->payu->down = false;
        $this->setUpPayu(configured: false);
        $this->artisan('payments:reconcile')->assertSuccessful()->expectsOutputToContain('nothing to reconcile');
        $this->assertSame(PaymentOrder::STATUS_CREATED, $started['order']->refresh()->status);
    }

    public function test_reconcile_prunes_old_webhook_payloads_only(): void
    {
        PaymentWebhookEvent::create(['gateway' => 'payu', 'event_id' => 'old', 'event' => 'payment.success', 'status' => 'processed', 'payload' => ['a' => 1]]);
        PaymentWebhookEvent::create(['gateway' => 'payu', 'event_id' => 'new', 'event' => 'payment.success', 'status' => 'processed', 'payload' => ['a' => 1]]);
        PaymentWebhookEvent::where('event_id', 'old')->update(['created_at' => now()->subDays(120)]);

        $this->artisan('payments:reconcile')->assertSuccessful();

        $this->assertSame(['new'], PaymentWebhookEvent::pluck('event_id')->all());
    }

    // ───────────────────────────── 6. money taken, no plan ─────────────────────────────

    public function test_a_payment_for_a_deleted_account_is_refunded_automatically_through_payu_and_the_order_says_why(): void
    {
        $student = $this->payer();
        $started = $this->startPayuPayment($student, 'expert');
        $this->payu->pay($started['txnid']);
        $student->forceDelete();        // the account was removed between paying and the confirmation

        $this->payuReturn($this->payu->responseFields($started['txnid']))->assertRedirect();

        $order = $started['order']->refresh();
        $this->assertSame(PaymentOrder::STATUS_REFUNDED, $order->status);
        $this->assertSame(299900, $order->refunded_paise);
        $this->assertNotNull($order->refund_id);
        $this->assertSame('Automatic refund: the plan could not be activated.', $order->refund_reason);
        $this->assertSame('fulfilment_failed', $order->failure_code);
        $this->assertSame(1, $this->payu->calls('cancel_refund_transaction'));

        $refund = collect($this->payu->refunds)->first();
        $this->assertSame('2999.00', $refund['amt']);
        $this->assertSame($order->gateway_payment_id, $refund['mihpayid']);
        $this->assertSame('RF'.substr($order->public_id, 0, 21), $refund['token'], 'the token is stable per order, so a retry cannot refund twice');
        $this->assertLessThanOrEqual(23, strlen($refund['token']));

        // Replaying everything afterwards refunds nothing more.
        $this->payuReturn($this->payu->responseFields($started['txnid']))->assertRedirect();
        $this->deliverPayuPaymentWebhook($this->payu->responseFields($started['txnid']))->assertOk();
        $this->assertSame(1, $this->payu->calls('cancel_refund_transaction'));
        Mail::assertNothingSent();
    }

    public function test_when_payu_rejects_the_automatic_refund_the_order_waits_for_a_person(): void
    {
        Log::spy();
        $student = $this->payer();
        $started = $this->startPayuPayment($student, 'expert');
        $this->payu->pay($started['txnid']);
        $student->forceDelete();
        $this->payu->failures['cancel_refund_transaction'] = 503;

        $this->payuReturn($this->payu->responseFields($started['txnid']))->assertRedirect();

        $order = $started['order']->refresh();
        $this->assertSame(PaymentOrder::STATUS_NEEDS_REVIEW, $order->status);
        $this->assertSame('fulfilment_failed', $order->failure_code);
        Log::shouldHaveReceived('critical')->withArgs(fn ($m) => str_contains($m, 'refund this payment manually'))->once();
    }

    public function test_a_refund_payu_queued_and_then_rejected_puts_the_order_back_in_front_of_a_person(): void
    {
        Log::spy();
        $student = $this->payer();
        $started = $this->startPayuPayment($student, 'expert');
        $this->payu->pay($started['txnid']);
        $student->forceDelete();
        $this->payuReturn($this->payu->responseFields($started['txnid']))->assertRedirect();
        $this->assertSame(PaymentOrder::STATUS_REFUNDED, $started['order']->refresh()->status);

        // The bank bounces the refund; PayU says so by webhook.
        $requestId = (string) array_key_first($this->payu->refunds);
        $this->deliverPayuJsonWebhook($this->payu->settleRefund($requestId, 'failure'))->assertOk();

        $order = $started['order']->refresh();
        $this->assertSame(PaymentOrder::STATUS_NEEDS_REVIEW, $order->status);
        $this->assertSame(0, $order->refunded_paise);
        $this->assertNull($order->refund_id);
        $this->assertSame('refund_failed', $order->failure_code);
        Log::shouldHaveReceived('critical')->withArgs(fn ($m) => str_contains($m, 'refund failed at the payment gateway'))->once();
    }

    public function test_an_old_checkout_for_a_cheaper_plan_paid_after_a_dearer_one_was_bought_is_refunded_not_honoured(): void
    {
        $student = $this->payer();
        $cheap = $this->startPayuPayment($student, 'starter');           // opened, left in a forgotten tab
        $this->purchaseThroughPayu($student, 'expert');              // meanwhile they bought the dearer plan

        $this->payu->pay($cheap['txnid']);
        $this->payuReturn($this->payu->responseFields($cheap['txnid']))->assertRedirect();

        $this->assertSame('expert', $this->planOf($student), 'the dearer plan is not replaced by the cheaper one');
        $this->assertSame(PaymentOrder::STATUS_REFUNDED, $cheap['order']->refresh()->status);
        $this->assertSame(1, $this->payu->calls('cancel_refund_transaction'));
    }

    // ───────────────────────────── 7. history, superadmin, switching ─────────────────────────────

    public function test_a_student_sees_their_own_payments_and_only_theirs(): void
    {
        $asha = $this->payer();
        $other = $this->payer(['email' => 'other@example.com']);
        $this->purchaseThroughPayu($asha, 'starter');
        $this->purchaseThroughPayu($other, 'expert');

        Sanctum::actingAs($asha);
        $payments = $this->getJson('/api/me/payments')->assertOk()->json('payments');

        $this->assertCount(1, $payments);
        $this->assertSame('paid', $payments[0]['status']);
        $this->assertSame(1199, $payments[0]['amount']);

        $theirs = PaymentOrder::where('user_id', $other->id)->firstOrFail();
        $this->getJson('/api/me/payments/'.$theirs->public_id)->assertNotFound();
    }

    public function test_only_a_superadmin_can_open_the_payments_screen(): void
    {
        Sanctum::actingAs($this->payer());
        $this->getJson('/api/superadmin/payments')->assertForbidden();
    }

    public function test_the_superadmin_sees_payu_revenue_orders_and_the_ones_needing_a_person(): void
    {
        $this->purchaseThroughPayu($this->payer(), 'starter');
        $this->purchaseThroughPayu($this->payer(['email' => 'b@example.com']), 'expert');
        $stuck = $this->startPayuPayment($this->payer(['email' => 'c@example.com']), 'expert');
        $this->payu->pay($stuck['txnid'], ['amount' => '1.00']);
        $this->payuReturn($this->payu->responseFields($stuck['txnid']));

        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_SUPERADMIN]));
        $response = $this->getJson('/api/superadmin/payments')->assertOk()
            ->assertJsonPath('mode', 'test')
            ->assertJsonPath('gateway', 'payu')
            ->assertJsonPath('gateway_name', 'PayU')
            ->assertJsonPath('configured', true)
            ->assertJsonPath('webhook_configured', true)
            ->assertJsonPath('summary.gross', 1199 + 2999)
            ->assertJsonPath('summary.net', 1199 + 2999)
            ->assertJsonPath('summary.orders_paid', 2)
            ->assertJsonPath('summary.needs_review', 1);

        $this->assertNull($response->json('last_webhook_at'), 'no webhook has ever reached us — the screen can warn about that');
        $this->assertSame(['payu'], collect($response->json('payments'))->pluck('gateway')->unique()->values()->all());

        $this->getJson('/api/superadmin/payments?status=needs_review&gateway=payu')->assertOk()->assertJsonCount(1, 'payments');
        $this->getJson('/api/superadmin/payments?gateway=razorpay')->assertOk()->assertJsonCount(0, 'payments');
        $this->getJson('/api/superadmin/payments?gateway=stripe')->assertStatus(422);
    }

    public function test_the_superadmin_screen_shows_when_payu_last_called_the_webhook(): void
    {
        $started = $this->startPayuPayment($this->payer(), 'starter');
        $this->payu->pay($started['txnid']);
        $this->deliverPayuPaymentWebhook($this->payu->responseFields($started['txnid']))->assertOk();

        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_SUPERADMIN]));
        $this->assertNotNull($this->getJson('/api/superadmin/payments')->assertOk()->json('last_webhook_at'));
    }

    public function test_the_superadmin_can_recheck_a_payu_payment_and_it_is_audited_with_the_gateways_name(): void
    {
        $student = $this->payer();
        $started = $this->startPayuPayment($student, 'starter');
        $this->payu->pay($started['txnid']);

        $admin = User::factory()->create(['role' => User::ROLE_SUPERADMIN]);
        Sanctum::actingAs($admin);

        $this->postJson('/api/superadmin/payments/'.$started['order']->public_id.'/reconcile')
            ->assertOk()->assertJsonPath('payment.status', 'paid')->assertJsonPath('payment.gateway', 'payu');

        $this->assertSame('starter', $this->planOf($student));
        $this->assertDatabaseHas('activity_logs', ['actor_id' => $admin->id, 'action' => 'Re-checked a payment with PayU', 'target_label' => $started['order']->public_id]);

        $this->payu->down = true;
        $other = $this->startPayuPayment($this->payer(['email' => 'z@example.com']), 'starter');
        Sanctum::actingAs($admin);
        $this->postJson('/api/superadmin/payments/'.$other['order']->public_id.'/reconcile')->assertStatus(502)->assertJsonPath('code', 'gateway_error');
    }

    public function test_every_paid_plan_is_reached_by_really_buying_it_through_payu(): void
    {
        foreach (['starter', 'expert'] as $code) {
            $student = $this->payer(['email' => "{$code}@example.com"]);
            $this->purchaseThroughPayu($student, $code);

            Sanctum::actingAs($student->fresh());
            $this->getJson('/api/me/subscription')->assertOk()->assertJsonPath('coverage.plan.code', $code);
        }

        $this->assertSame(2, PaymentOrder::where('status', PaymentOrder::STATUS_PAID)->count());
    }

    public function test_the_razorpay_verify_endpoint_cannot_be_used_to_settle_a_payu_order(): void
    {
        $student = $this->payer();
        $started = $this->startPayuPayment($student, 'expert');
        $this->payu->pay($started['txnid']);

        $this->postJson('/api/me/checkout/verify', [
            'razorpay_order_id' => $started['txnid'],
            'razorpay_payment_id' => 'pay_whatever',
            'razorpay_signature' => hash_hmac('sha256', $started['txnid'].'|pay_whatever', 'anything'),
        ])->assertNotFound()->assertJsonPath('code', 'order_not_found');

        $this->assertSame('coder', $this->planOf($student));
    }

    public function test_no_payu_call_ever_carries_the_salt_or_hits_a_real_host(): void
    {
        $started = $this->startPayuPayment($this->payer(), 'starter');
        $this->payu->pay($started['txnid']);
        $this->payuReturn($this->payu->responseFields($started['txnid']))->assertRedirect();

        Http::assertSent(function (\Illuminate\Http\Client\Request $request) {
            return str_starts_with($request->url(), 'https://test.payu.in/merchant/')
                && ! str_contains(json_encode($request->data()), FakePayuGateway::SALT)
                && ! str_contains($request->url(), FakePayuGateway::SALT);
        });
    }

    public function test_live_mode_uses_payus_production_hosts(): void
    {
        config(['billing.payu.mode' => 'live']);
        $this->payu->install();   // (the fake answers production hosts too)

        $student = $this->payer();
        Sanctum::actingAs($student);
        $this->openPayuCheckout('starter')->assertCreated()
            ->assertJsonPath('checkout.action', 'https://secure.payu.in/_payment')
            ->assertJsonPath('checkout.test_mode', false);

        $this->assertSame('live', PaymentOrder::firstOrFail()->gateway_mode);

        $txnid = PaymentOrder::firstOrFail()->gateway_order_id;
        $this->payu->submitCheckout(['txnid' => $txnid] + $this->checkoutFieldsFor(PaymentOrder::firstOrFail(), $student));
        $this->payu->pay($txnid);
        $this->age(PaymentOrder::firstOrFail(), 10);
        $this->artisan('payments:reconcile')->assertSuccessful();
        $this->assertSame(PaymentOrder::STATUS_PAID, PaymentOrder::firstOrFail()->status);

        Http::assertSent(fn ($request) => str_starts_with($request->url(), 'https://info.payu.in/merchant/postservice.php'));
    }
}
