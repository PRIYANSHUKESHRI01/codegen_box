<?php

namespace Tests\Feature;

use App\Enums\LifecycleEmail;
use App\Mail\LifecycleMail;
use App\Models\ActivityLog;
use App\Models\College;
use App\Models\PaymentOrder;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use App\Models\UserNotification;
use App\Services\SubscriptionService;
use Database\Seeders\PlanSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\CreatesProjectLabFixtures;
use Tests\Concerns\FakesPayu;
use Tests\TestCase;

/**
 * The free offer: a plan the superadmin discounts by 100% is claimed with one click — no payment gateway, no payment
 * order — while every plan with a price keeps going through checkout. The money rule is enforced on BOTH doors by
 * the server (checkout refuses ₹0, redeem refuses anything above ₹0), and a free plan can't be piled up by repeating.
 *
 * Http::preventStrayRequests() (FakesPayu) makes any call to a payment gateway fail the test, so "no gateway was involved"
 * is proven, not assumed.
 */
class OfferRedemptionTest extends TestCase
{
    use CreatesProjectLabFixtures;
    use FakesPayu;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Queue::fake();
        Mail::fake();
        $this->seedPlans();
        $this->setUpPayu();
    }

    private function superadmin(): User
    {
        return User::factory()->create(['role' => User::ROLE_SUPERADMIN]);
    }

    private function plan(string $code): Plan
    {
        return Plan::where('code', $code)->firstOrFail();
    }

    /** The superadmin has discounted Expert by 100% (set directly: the editor's own rules are tested separately). */
    private function makeExpertFree(): void
    {
        $this->plan('expert')->update(['discount_percent' => 100]);
    }

    private function redeem(array $body = ['plan_code' => 'expert', 'expected_total' => 0])
    {
        return $this->postJson('/api/me/checkout/redeem', $body);
    }

    private function noGatewayWasCalled(): void
    {
        Http::assertNothingSent();
        $this->assertSame(0, PaymentOrder::count(), 'a free plan leaves no payment order behind');
    }

    // ───────────────────────────── what "free" means ─────────────────────────────

    public function test_a_plan_is_redeemable_only_when_a_priced_plan_is_discounted_to_nothing(): void
    {
        $expert = $this->plan('expert');
        $this->assertFalse($expert->isRedeemable(), 'launch pricing: 40% off is still a price');
        $this->assertFalse($expert->pricing()['redeemable']);

        $expert->update(['discount_percent' => 99]);
        $this->assertFalse($expert->fresh()->isRedeemable(), '₹50 is a price');

        $expert->update(['discount_percent' => 100]);
        $this->assertTrue($expert->fresh()->isRedeemable());
        $this->assertSame(0, $expert->fresh()->salePrice());
        $this->assertSame(100, $expert->fresh()->pricing()['discount_percent']);
        $this->assertTrue($expert->fresh()->pricing()['redeemable']);
        $this->assertFalse($expert->fresh()->isFree(), 'a free offer is still a paid-tier plan, never "the free plan"');

        // ₹1 at 99% rounds to ₹0 — judged on what would be charged, not on the number 100.
        $expert->update(['list_price' => 1, 'discount_percent' => 99]);
        $this->assertTrue($expert->fresh()->isRedeemable());
    }

    public function test_the_free_plan_the_team_sold_plan_and_a_switched_off_plan_are_never_redeemable(): void
    {
        $this->assertFalse($this->plan('coder')->isRedeemable(), 'Coder is free, not an offer');

        $grandmaster = $this->plan('grandmaster');
        $grandmaster->update(['discount_percent' => 100]);
        $this->assertFalse($grandmaster->fresh()->isRedeemable());

        $this->makeExpertFree();
        $this->plan('expert')->update(['is_active' => false]);
        $this->assertFalse($this->plan('expert')->isRedeemable());
    }

    public function test_the_public_price_list_says_which_plan_is_free_to_redeem(): void
    {
        $this->getJson('/api/public/plans')->assertOk()
            ->assertJsonPath('plans.1.redeemable', false)
            ->assertJsonPath('plans.1.sale_price', 2999);

        $etag = $this->getJson('/api/public/plans')->headers->get('ETag');
        $this->makeExpertFree();

        $after = $this->getJson('/api/public/plans', ['If-None-Match' => $etag])->assertOk();
        $after->assertJsonPath('plans.1.redeemable', true)
            ->assertJsonPath('plans.1.sale_price', 0)
            ->assertJsonPath('plans.1.list_price', 4999)
            ->assertJsonPath('plans.1.discount_percent', 100)
            ->assertJsonPath('plans.0.redeemable', false)
            ->assertJsonPath('plans.2.redeemable', false);
    }

    // ───────────────────────────── the superadmin's editor ─────────────────────────────

    public function test_the_editor_allows_up_to_100_percent_but_only_when_the_superadmin_confirms_it(): void
    {
        $admin = $this->superadmin();
        Sanctum::actingAs($admin);

        $this->getJson('/api/superadmin/plans')->assertOk()->assertJsonPath('limits.max_discount_percent', 100);

        // Without the confirmation: refused, nothing changes — a stray 100 for 10 must not give a year away.
        $this->putJson('/api/superadmin/plans/expert', ['list_price' => 4999, 'discount_percent' => 100, 'version' => '4999-40'])
            ->assertStatus(422)->assertJsonValidationErrors('confirm_free_offer');
        $this->assertSame(40, $this->plan('expert')->discount_percent);

        $this->putJson('/api/superadmin/plans/expert', ['list_price' => 4999, 'discount_percent' => 100, 'confirm_free_offer' => false, 'version' => '4999-40'])
            ->assertStatus(422)->assertJsonValidationErrors('confirm_free_offer');

        // Confirmed: live at once, and the audit log says a free offer was turned on.
        $this->putJson('/api/superadmin/plans/expert', ['list_price' => 4999, 'discount_percent' => 100, 'confirm_free_offer' => true, 'version' => '4999-40'])
            ->assertOk()
            ->assertJsonPath('plan.redeemable', true)
            ->assertJsonPath('plan.sale_price', 0)
            ->assertJsonPath('plan.discount_percent', 100)
            ->assertJsonPath('plan.version', '4999-100');

        $log = ActivityLog::where('action', 'Changed plan pricing')->sole();
        $this->assertSame('turned_on', $log->meta['free_offer']);
        $this->assertSame(['list_price' => 4999, 'discount_percent' => 100, 'sale_price' => 0], $log->meta['to']);
    }

    public function test_a_big_discount_that_still_leaves_a_price_needs_no_confirmation(): void
    {
        Sanctum::actingAs($this->superadmin());

        $this->putJson('/api/superadmin/plans/expert', ['list_price' => 4999, 'discount_percent' => 99])
            ->assertOk()->assertJsonPath('plan.sale_price', 50)->assertJsonPath('plan.redeemable', false);

        $this->assertArrayNotHasKey('free_offer', ActivityLog::where('action', 'Changed plan pricing')->sole()->meta);
    }

    public function test_more_than_100_percent_is_refused(): void
    {
        Sanctum::actingAs($this->superadmin());

        $this->putJson('/api/superadmin/plans/expert', ['list_price' => 4999, 'discount_percent' => 101, 'confirm_free_offer' => true])
            ->assertStatus(422)->assertJsonValidationErrors('discount_percent');
        $this->assertSame(40, $this->plan('expert')->discount_percent);
    }

    public function test_turning_the_offer_off_and_retuning_a_plan_that_is_already_free_need_no_confirmation(): void
    {
        $this->makeExpertFree();
        Sanctum::actingAs($this->superadmin());

        // Already free: changing the list price doesn't hand anything new to anyone.
        $this->putJson('/api/superadmin/plans/expert', ['list_price' => 5999, 'discount_percent' => 100])->assertOk()->assertJsonPath('plan.redeemable', true);

        // Back to a price.
        $this->putJson('/api/superadmin/plans/expert', ['list_price' => 5999, 'discount_percent' => 40])
            ->assertOk()->assertJsonPath('plan.redeemable', false)->assertJsonPath('plan.sale_price', 3599);

        $this->assertSame('turned_off', ActivityLog::where('action', 'Changed plan pricing')->latest('id')->first()->meta['free_offer']);
    }

    public function test_the_editor_reports_how_many_students_took_the_offer(): void
    {
        $this->makeExpertFree();
        $first = $this->student();
        $second = $this->student();
        app(SubscriptionService::class)->redeemOffer($first, $this->plan('expert'));
        app(SubscriptionService::class)->redeemOffer($second, $this->plan('expert'));
        $this->buy($this->student(), 'expert');   // a different way of getting the plan: not a redemption

        Sanctum::actingAs($this->superadmin());
        $this->getJson('/api/superadmin/plans')->assertOk()
            ->assertJsonPath('plans.0.redemptions', 0)
            ->assertJsonPath('plans.1.redemptions', 2);
    }

    // ───────────────────────────── redeeming ─────────────────────────────

    public function test_a_student_redeems_a_free_plan_and_has_it_at_once_without_any_gateway(): void
    {
        $this->makeExpertFree();
        $student = $this->student();
        $this->assertSame('coder', $student->activeSubscription()->plan->code);
        Sanctum::actingAs($student);

        $this->redeem()
            ->assertCreated()
            ->assertJsonPath('coverage.plan.code', 'expert')
            ->assertJsonPath('coverage.source', 'individual')
            ->assertJsonPath('redemption.plan_code', 'expert')
            ->assertJsonPath('redemption.plan_name', 'Expert')
            ->assertJsonPath('entitlements.hackathon_access', true)
            ->assertJsonPath('entitlements.vault_access', true);

        $this->noGatewayWasCalled();

        $subscription = $student->fresh()->activeSubscription();
        $this->assertSame('expert', $subscription->plan->code);
        $this->assertTrue($subscription->isActive());
        $this->assertEqualsWithDelta(365, $subscription->daysRemaining(), 1, 'a redeemed plan runs its full term');

        // It says how it came to be, and that no money moved.
        $this->assertSame(Subscription::SOURCE_OFFER_REDEEMED, $subscription->source());
        $this->assertSame(0, $subscription->pricePaid());
        $this->assertSame(4999, $subscription->meta['list_price']);
        $this->assertSame(100, $subscription->meta['discount_percent']);
        $this->assertNotEmpty($subscription->meta['redemption_ref']);
        $this->assertArrayNotHasKey('purchase_ref', $subscription->meta, 'it must never read as a purchase');
        $this->assertArrayNotHasKey('gateway_payment_id', $subscription->meta);

        // The free Coder row it replaced is closed, so they hold exactly one plan.
        $this->assertSame(1, $student->subscriptions()->where('status', Subscription::STATUS_ACTIVE)->count());

        $log = ActivityLog::where('action', 'Redeemed a free plan offer')->sole();
        $this->assertSame($student->id, $log->actor_id);
        $this->assertSame('expert', $log->meta['plan_code']);
    }

    public function test_the_student_is_told_in_app_and_by_email(): void
    {
        $this->makeExpertFree();
        $student = $this->student();
        Sanctum::actingAs($student);

        $this->redeem()->assertCreated();

        $note = UserNotification::where('user_id', $student->id)->where('group_key', 'like', 'plan.redeemed:%')->sole();
        $this->assertStringContainsString('Expert', $note->title);

        $mail = Mail::sent(LifecycleMail::class, fn (LifecycleMail $m) => $m->type === LifecycleEmail::PlanGranted && $m->hasTo($student->email))->sole();
        $this->assertTrue($mail->data['redeemed']);
        $this->assertStringContainsString('redeemed', implode(' ', $mail->content['paragraphs']));
        $this->assertStringContainsString('nothing was charged', implode(' ', $mail->content['paragraphs']));
    }

    public function test_redeeming_works_while_the_payment_gateway_is_not_set_up(): void
    {
        $this->setUpPayu(configured: false);
        $this->makeExpertFree();
        $student = $this->student();
        Sanctum::actingAs($student);

        $this->redeem()->assertCreated()->assertJsonPath('coverage.plan.code', 'expert');

        $this->assertSame('expert', $student->fresh()->activeSubscription()->plan->code);
        $this->noGatewayWasCalled();
    }

    public function test_it_is_never_counted_as_revenue(): void
    {
        $this->makeExpertFree();
        $student = $this->student();
        Sanctum::actingAs($student);

        $this->redeem()->assertCreated();

        $subscription = $student->fresh()->activeSubscription();
        $this->assertSame(0, $subscription->pricePaid(), 'the overview sums price_paid, so a free plan adds nothing to revenue');
        $this->assertSame(0, $subscription->meta['quote_total']);
    }

    // ───────────────────────────── two doors, one money rule ─────────────────────────────

    public function test_a_plan_with_a_price_cannot_be_redeemed(): void
    {
        $student = $this->student();
        Sanctum::actingAs($student);

        // 40% off is still ₹2,999.
        $this->redeem(['plan_code' => 'expert', 'expected_total' => 2999])->assertStatus(409)->assertJsonPath('code', 'payment_required')->assertJsonPath('quote.total', 2999);
        $this->redeem(['plan_code' => 'expert'])->assertStatus(409)->assertJsonPath('code', 'payment_required');

        // Even at 99% off, ₹50 must be paid.
        $this->plan('expert')->update(['discount_percent' => 99]);
        $this->redeem(['plan_code' => 'expert'])->assertStatus(409)->assertJsonPath('code', 'payment_required')->assertJsonPath('quote.total', 50);

        $this->assertSame('coder', $student->fresh()->activeSubscription()->plan->code);
        $this->noGatewayWasCalled();
    }

    public function test_checkout_still_refuses_a_free_plan_so_nothing_is_ever_sent_to_a_gateway_for_zero_rupees(): void
    {
        $this->makeExpertFree();
        Sanctum::actingAs($this->student());

        $this->postJson('/api/me/checkout', ['plan_code' => 'expert', 'expected_total' => 0])->assertStatus(422)->assertJsonPath('code', 'nothing_to_pay');
        $this->postJson('/api/me/checkout', ['plan_code' => 'expert'])->assertStatus(422)->assertJsonPath('code', 'nothing_to_pay');

        $this->noGatewayWasCalled();
    }

    public function test_a_price_that_moved_since_the_student_looked_is_refused_both_ways(): void
    {
        $student = $this->student();
        Sanctum::actingAs($student);

        // They were looking at a price; it has since become free: paying is refused, and so is redeeming "at the old price".
        $this->makeExpertFree();
        $this->postJson('/api/me/checkout', ['plan_code' => 'expert', 'expected_total' => 2999])->assertStatus(409)->assertJsonPath('code', 'price_changed');
        $this->redeem(['plan_code' => 'expert', 'expected_total' => 2999])->assertStatus(409)->assertJsonPath('code', 'price_changed')->assertJsonPath('quote.total', 0);

        // They were looking at "Redeem"; the offer has since ended: nothing is activated for free.
        $this->plan('expert')->update(['discount_percent' => 40]);
        $this->redeem(['plan_code' => 'expert', 'expected_total' => 0])->assertStatus(409)->assertJsonPath('code', 'price_changed')->assertJsonPath('quote.total', 2999);

        $this->assertSame('coder', $student->fresh()->activeSubscription()->plan->code);
        $this->noGatewayWasCalled();
    }

    public function test_the_free_coder_plan_the_team_sold_plan_and_unknown_plans_cannot_be_redeemed(): void
    {
        $this->plan('grandmaster')->update(['discount_percent' => 100]);
        $student = $this->student();
        Sanctum::actingAs($student);

        // Coder prices at ₹0 too, but it is not an offer.
        $this->redeem(['plan_code' => 'coder', 'expected_total' => 0])->assertStatus(422)->assertJsonPath('code', 'offer_unavailable');
        $this->redeem(['plan_code' => 'grandmaster', 'expected_total' => 0])->assertStatus(422)->assertJsonValidationErrors('plan_code');
        $this->redeem(['plan_code' => 'no-such-plan'])->assertStatus(422)->assertJsonValidationErrors('plan_code');
        $this->redeem(['plan_code' => 'project-lab', 'expected_total' => 0])->assertStatus(422);
        $this->redeem([])->assertStatus(422)->assertJsonValidationErrors('plan_code');

        $this->makeExpertFree();
        $this->plan('expert')->update(['is_active' => false]);
        $this->redeem()->assertStatus(422)->assertJsonValidationErrors('plan_code');

        $this->assertSame('coder', $student->fresh()->activeSubscription()->plan->code);
    }

    // ───────────────────────────── free time must not pile up ─────────────────────────────

    public function test_redeeming_again_while_the_plan_is_running_is_refused(): void
    {
        $this->makeExpertFree();
        $student = $this->student();
        Sanctum::actingAs($student);

        $this->redeem()->assertCreated();
        $end = $student->fresh()->activeSubscription()->current_period_end;

        $this->redeem()->assertStatus(409)->assertJsonPath('code', 'already_on_plan');
        $this->redeem()->assertStatus(409)->assertJsonPath('code', 'already_on_plan');

        $subscription = $student->fresh()->activeSubscription();
        $this->assertTrue($end->equalTo($subscription->current_period_end), 'the end date did not move');
        $this->assertSame(1, $student->subscriptions()->whereHas('plan', fn ($q) => $q->where('code', 'expert'))->count(), 'one row, not three');
        $this->assertSame(1, ActivityLog::where('action', 'Redeemed a free plan offer')->count());
    }

    public function test_a_student_whose_plan_was_given_or_bought_cannot_redeem_it_on_top_either(): void
    {
        $this->makeExpertFree();
        $bought = $this->student();
        $this->buy($bought, 'expert');
        Sanctum::actingAs($bought);
        $this->redeem()->assertStatus(409)->assertJsonPath('code', 'already_on_plan');

        $granted = $this->student();
        app(SubscriptionService::class)->grantIndividualPlan($granted, $this->plan('expert'), $this->superadmin(), ['days' => 400, 'kind' => 'complimentary', 'reason' => 'test']);
        Sanctum::actingAs($granted);
        $this->redeem()->assertStatus(409)->assertJsonPath('code', 'already_on_plan');
    }

    public function test_inside_the_renewal_window_it_can_be_redeemed_again_and_stacks_like_a_paid_renewal(): void
    {
        $this->makeExpertFree();
        $student = $this->student();
        Sanctum::actingAs($student);

        $this->redeem()->assertCreated();
        $subscription = $student->fresh()->activeSubscription();
        $subscription->update(['current_period_end' => now()->addDays(10)]);

        $this->redeem()->assertCreated()->assertJsonPath('redemption.plan_code', 'expert');

        $renewed = $student->fresh()->activeSubscription();
        $this->assertEqualsWithDelta(10 + 365, $renewed->daysRemaining(), 1, 'the new year starts when the old one ends');
        $this->assertSame(1, $student->subscriptions()->where('status', Subscription::STATUS_ACTIVE)->count(), 'the old row is closed, not left running beside it');
        $this->assertSame(2, ActivityLog::where('action', 'Redeemed a free plan offer')->count());

        // And now it is far from ending again.
        $this->redeem()->assertStatus(409)->assertJsonPath('code', 'already_on_plan');
    }

    public function test_the_renewal_window_boundary_is_exact(): void
    {
        $this->makeExpertFree();
        $student = $this->student();
        Sanctum::actingAs($student);
        $this->redeem()->assertCreated();

        $student->fresh()->activeSubscription()->update(['current_period_end' => now()->addDays(32)]);
        $this->redeem()->assertStatus(409)->assertJsonPath('code', 'already_on_plan');

        $student->fresh()->activeSubscription()->update(['current_period_end' => now()->addDays(30)->addHours(2)]);
        $this->redeem()->assertCreated();
    }

    public function test_after_the_plan_has_ended_it_can_be_redeemed_again_while_the_offer_lasts(): void
    {
        $this->makeExpertFree();
        $student = $this->student();
        Sanctum::actingAs($student);
        $this->redeem()->assertCreated();

        $student->fresh()->activeSubscription()->update(['current_period_end' => now()->subDay()]);
        $this->artisan('subscriptions:expire')->assertSuccessful();
        $this->assertSame('coder', $student->fresh()->activeSubscription()?->plan->code ?? 'coder');

        $this->redeem()->assertCreated();
        $this->assertSame('expert', $student->fresh()->activeSubscription()->plan->code);
        $this->assertEqualsWithDelta(365, $student->fresh()->activeSubscription()->daysRemaining(), 1);
    }

    // ───────────────────────────── who may redeem ─────────────────────────────

    public function test_a_student_covered_by_their_college_is_not_given_a_second_plan(): void
    {
        $this->makeExpertFree();
        $college = College::create(['name' => 'Covered College', 'short_code' => 'CC-1', 'tier' => 'Standard']);
        app(SubscriptionService::class)->assignInstitutionPlan($college, $this->plan('standard'), $this->superadmin());

        $student = $this->student(['college_id' => $college->id]);
        Sanctum::actingAs($student);

        $this->redeem()->assertStatus(409)->assertJsonPath('code', 'covered_by_institution');
        $this->assertSame(0, $student->subscriptions()->whereHas('plan', fn ($q) => $q->where('code', 'expert'))->count());
    }

    public function test_it_cannot_cut_a_higher_plans_paid_time_short(): void
    {
        $this->plan('expert')->update(['discount_percent' => 100]);
        $starter = $this->seedStarterPlan();
        $starter->update(['discount_percent' => 100]);

        // Starter sits below Expert: a student on Expert with time left must not swap down to it.
        $student = $this->studentOnExpert();
        Sanctum::actingAs($student);
        $this->redeem(['plan_code' => 'starter', 'expected_total' => 0])->assertStatus(409)->assertJsonPath('code', 'downgrade_blocked');

        // A student on the team-sold Grandmaster keeps it too.
        $academy = $this->studentOnAcademy();
        Sanctum::actingAs($academy);
        $this->redeem()->assertStatus(409)->assertJsonPath('code', 'downgrade_blocked');

        $this->assertSame('expert', $student->fresh()->activeSubscription()->plan->code);
        $this->assertSame('grandmaster', $academy->fresh()->activeSubscription()->plan->code);
    }

    public function test_moving_up_to_a_free_plan_is_allowed(): void
    {
        $starter = $this->seedStarterPlan();   // priced, not free
        $this->makeExpertFree();
        $student = $this->student();
        $this->buy($student, 'starter');
        Sanctum::actingAs($student);

        $this->redeem()->assertCreated();

        $this->assertSame('expert', $student->fresh()->activeSubscription()->plan->code);
        $this->assertSame(1, $student->subscriptions()->where('status', Subscription::STATUS_ACTIVE)->count());
        $this->assertSame(1, $student->subscriptions()->where('status', Subscription::STATUS_CANCELED)->where('plan_id', $starter->id)->count(), 'the plan they moved up from is closed');
    }

    public function test_only_a_signed_in_student_can_redeem(): void
    {
        $this->makeExpertFree();

        $this->redeem()->assertUnauthorized();

        foreach ([User::ROLE_ADMIN_TPO, User::ROLE_SUPERADMIN, User::ROLE_ADMIN_INTERNAL] as $role) {
            Sanctum::actingAs(User::factory()->create(['role' => $role]));
            $this->redeem()->assertStatus(403)->assertJsonPath('code', 'student_only');
        }

        $this->assertSame(0, Subscription::where('meta->source', Subscription::SOURCE_OFFER_REDEEMED)->count());
    }

    public function test_a_superadmin_viewing_as_a_student_cannot_redeem_for_them(): void
    {
        $this->makeExpertFree();
        $student = $this->student();

        $token = $student->createToken('view-as', [User::IMPERSONATION_ABILITY])->plainTextToken;

        $this->withHeader('Authorization', 'Bearer '.$token)->postJson('/api/me/checkout/redeem', ['plan_code' => 'expert', 'expected_total' => 0])->assertStatus(403);

        $this->assertSame('coder', $student->fresh()->activeSubscription()->plan->code);
    }

    // ───────────────────────────── what the superadmin sees ─────────────────────────────

    public function test_a_redemption_shows_in_the_subscriptions_list_as_such_and_never_as_a_purchase_or_revenue(): void
    {
        $this->makeExpertFree();
        $student = $this->student();
        Sanctum::actingAs($student);
        $this->redeem()->assertCreated();

        $this->buy($this->student(), 'expert');   // a paid one, for contrast
        $this->plan('expert')->update(['discount_percent' => 40]);

        Sanctum::actingAs($this->superadmin());

        $redeemed = $this->getJson('/api/superadmin/subscriptions?source=offer_redeemed')->assertOk();
        $redeemed->assertJsonCount(1, 'subscriptions')
            ->assertJsonPath('subscriptions.0.source', 'offer_redeemed')
            ->assertJsonPath('subscriptions.0.price_paid', 0)
            ->assertJsonPath('subscriptions.0.complimentary', false)
            ->assertJsonPath('subscriptions.0.paid_through_gateway', false)
            ->assertJsonPath('subscriptions.0.subscriber.email', $student->email)
            ->assertJsonPath('summary.redeemed', 1);

        // The "Purchased" filter is for real purchases only.
        $purchased = $this->getJson('/api/superadmin/subscriptions?source=purchase')->assertOk();
        $purchased->assertJsonCount(1, 'subscriptions');
        $this->assertNotSame($student->email, $purchased->json('subscriptions.0.subscriber.email'));
    }

    public function test_a_superadmin_ending_a_redeemed_plan_puts_the_student_back_on_coder(): void
    {
        $this->makeExpertFree();
        $student = $this->student();
        Sanctum::actingAs($student);
        $this->redeem()->assertCreated();
        $subscription = $student->fresh()->activeSubscription();

        Sanctum::actingAs($this->superadmin());
        $this->postJson("/api/superadmin/subscriptions/{$subscription->id}/cancel", ['reason' => 'abuse'])->assertOk();

        $this->assertSame('coder', $student->fresh()->activeSubscription()->plan->code);
    }
}
