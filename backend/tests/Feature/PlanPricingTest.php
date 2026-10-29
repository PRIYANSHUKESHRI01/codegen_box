<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use App\Services\PurchaseQuoteService;
use App\Services\SubscriptionService;
use Database\Seeders\PlanSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Concerns\CreatesProjectLabFixtures;
use Tests\Concerns\FakesRazorpay;
use Tests\TestCase;

/**
 * What the individual plans cost and who controls it: the shipped catalogue
 * (Coder free; Expert ₹4,999 a year at 40% off at launch; Grandmaster, the Mellow
 * Academy plan, with no online price at all), the discount arithmetic, the public
 * price list the pricing page polls, the checkout that must charge exactly what the
 * superadmin has set — and the superadmin's Plans & Pricing API itself. Prices come
 * from the real PlanSeeder.
 */
class PlanPricingTest extends TestCase
{
    use CreatesProjectLabFixtures;
    use FakesRazorpay;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedPlans();
        $this->setUpRazorpay();
    }

    private function superadmin(): User
    {
        return User::factory()->create(['role' => User::ROLE_SUPERADMIN]);
    }

    private function plan(string $code): Plan
    {
        return Plan::where('code', $code)->firstOrFail();
    }

    private function edit(string $code, array $body)
    {
        return $this->putJson("/api/superadmin/plans/{$code}", $body);
    }

    // ───────────────────────────── the arithmetic ─────────────────────────────

    public function test_a_discount_is_rounded_to_a_whole_rupee_in_one_place(): void
    {
        $this->assertSame(800, Plan::discountFor(1999, 40));    // 799.6 → 800, so 1,999 → 1,199
        $this->assertSame(2000, Plan::discountFor(4999, 40));   // 1999.6 → 2000, so 4,999 → 2,999
        $this->assertSame(0, Plan::discountFor(4999, 0));
        $this->assertSame(0, Plan::discountFor(0, 40), 'nothing to discount on a free plan');
        $this->assertSame(0, Plan::discountFor(4999, -5), 'a negative percent is no discount');
        $this->assertSame(4999, Plan::discountFor(4999, 250), 'an absurd percent is clamped to 100%');
    }

    public function test_the_shipped_catalogue_has_one_plan_for_sale_and_one_the_team_sells(): void
    {
        $coder = $this->plan('coder');
        $expert = $this->plan('expert');
        $grandmaster = $this->plan('grandmaster');

        $this->assertTrue($coder->isFree());
        $this->assertSame(0, $coder->salePrice());
        $this->assertNull($coder->duration_days, 'free Coder never expires');

        // Expert: ₹4,999 a year, 40% off at launch.
        $this->assertFalse($expert->isFree());
        $this->assertFalse($expert->isContactOnly());
        $this->assertSame([4999, 40, 2000, 2999], [$expert->listPrice(), $expert->discount_percent, $expert->discountAmount(), $expert->salePrice()]);
        $this->assertSame(365, $expert->duration_days);
        $this->assertSame('year', $expert->termUnit());
        $this->assertTrue($expert->hasDiscount());
        $this->assertTrue($expert->isPriceEditable());

        // Grandmaster (Mellow Academy): sold by the team — no price, not free, three years.
        $this->assertTrue($grandmaster->isContactOnly());
        $this->assertFalse($grandmaster->isFree(), 'a plan with no online price is arranged with the team, not free');
        $this->assertNull($grandmaster->list_price);
        $this->assertSame(0, $grandmaster->salePrice());
        $this->assertFalse($grandmaster->hasDiscount());
        $this->assertSame(1095, $grandmaster->duration_days);
        $this->assertSame('3 years', $grandmaster->termUnit());
        $this->assertFalse($grandmaster->isPriceEditable(), 'there is no price for the superadmin to edit');
    }

    public function test_the_price_block_every_surface_renders_carries_both_prices(): void
    {
        $this->assertSame([
            'code' => 'expert',
            'name' => 'Expert',
            'list_price' => 4999,
            'discount_percent' => 40,
            'discount_amount' => 2000,
            'sale_price' => 2999,
            'term_days' => 365,
            'term_unit' => 'year',
            'is_free' => false,
            'contact_only' => false,
            'redeemable' => false,
        ], $this->plan('expert')->pricing());
    }

    public function test_the_team_sold_plans_price_block_says_so_and_carries_no_figures(): void
    {
        $this->assertSame([
            'code' => 'grandmaster',
            'name' => 'Grandmaster',
            'list_price' => 0,
            'discount_percent' => 0,
            'discount_amount' => 0,
            'sale_price' => 0,
            'term_days' => 1095,
            'term_unit' => '3 years',
            'is_free' => false,
            'contact_only' => true,
            'redeemable' => false,
        ], $this->plan('grandmaster')->pricing());
    }

    public function test_a_longer_term_is_worded_in_years(): void
    {
        $plan = new Plan;

        foreach ([[365, 'year'], [30, 'month'], [730, '2 years'], [1095, '3 years'], [90, '90 days'], [400, '400 days'], [null, null]] as [$days, $word]) {
            $plan->duration_days = $days;
            $this->assertSame($word, $plan->termUnit(), (string) $days);
        }
    }

    // ───────────────────────────── the entitlement matrix ─────────────────────────────

    public function test_each_plan_includes_exactly_what_the_pricing_page_promises(): void
    {
        $this->assertSame([
            'practice_problems_per_day' => 1,
            'mock_interviews_per_day' => null,
            'free_trial_uses' => 1,
            'drive_access' => false,
            'hackathon_access' => false,
            'vault_access' => false,
            'project_lab_access' => false,
            'workspace_hours_per_month' => null,
            'active_projects' => null,
            'core_practice_per_day' => 10,
            'core_tests_access' => false,
        ], $this->plan('coder')->entitlementSummary());

        // Expert is complete; Grandmaster carries the very same access for its three years.
        foreach (['expert', 'grandmaster'] as $code) {
            $this->assertSame([
                'practice_problems_per_day' => null,
                'mock_interviews_per_day' => 10,
                'free_trial_uses' => null,
                'drive_access' => true,
                'hackathon_access' => true,
                'vault_access' => true,
                'project_lab_access' => true,
                'workspace_hours_per_month' => 80,
                'active_projects' => 3,
                'core_practice_per_day' => null,
                'core_tests_access' => true,
            ], $this->plan($code)->entitlementSummary(), $code);
        }
    }

    public function test_project_lab_is_no_longer_for_sale_on_its_own_but_its_row_remains(): void
    {
        $lab = $this->plan(Plan::CODE_PROJECT_LAB);

        $this->assertFalse($lab->is_active);
        $this->assertTrue($lab->isAddon());
    }

    public function test_college_plans_keep_hack_arena_and_vault_access(): void
    {
        foreach (['standard', 'pro-campus', 'academic-enterprise'] as $code) {
            $this->assertTrue($this->plan($code)->hackathon_access, "{$code} must keep Hack Arena");
            $this->assertTrue($this->plan($code)->vault_access, "{$code} must keep the Vault for the students it covers");
            $this->assertNull($this->plan($code)->feature_trial_uses, "{$code} is never capped to a free trial");
            $this->assertFalse($this->plan($code)->isContactOnly(), "{$code} is assigned by Ops, which is a different thing from the team-sold individual plan");
        }
    }

    public function test_reseeding_refreshes_entitlements_but_never_overwrites_the_superadmins_price(): void
    {
        $expert = $this->plan('expert');
        $expert->update(['list_price' => 2499, 'discount_percent' => 25, 'max_practice_problems_per_day' => 99]);

        $this->seed(PlanSeeder::class);

        $expert = $expert->fresh();
        $this->assertSame(2499, $expert->list_price, 'a re-run seeder must not put the shipped price back');
        $this->assertSame(25, $expert->discount_percent);
        $this->assertNull($expert->max_practice_problems_per_day, 'but everything else is refreshed');
    }

    public function test_reseeding_keeps_grandmaster_a_team_sold_plan_with_no_price(): void
    {
        $this->plan('grandmaster')->update(['contact_only' => false, 'duration_days' => 365]);

        $this->seed(PlanSeeder::class);

        $grandmaster = $this->plan('grandmaster')->fresh();
        $this->assertTrue($grandmaster->isContactOnly());
        $this->assertSame(1095, $grandmaster->duration_days);
        $this->assertNull($grandmaster->list_price, 'there is no operator-owned price on it to protect, and none is invented');
    }

    // ───────────────────────────── the public price list ─────────────────────────────

    public function test_anyone_can_read_the_live_individual_prices_without_signing_in(): void
    {
        $response = $this->getJson('/api/public/plans')->assertOk();

        $response->assertJsonPath('currency', 'INR')
            ->assertJsonCount(3, 'plans')
            ->assertJsonPath('plans.0.code', 'coder')
            ->assertJsonPath('plans.0.sale_price', 0)
            ->assertJsonPath('plans.0.contact_only', false)
            ->assertJsonPath('plans.1.code', 'expert')
            ->assertJsonPath('plans.1.list_price', 4999)
            ->assertJsonPath('plans.1.discount_percent', 40)
            ->assertJsonPath('plans.1.sale_price', 2999)
            ->assertJsonPath('plans.1.term_unit', 'year')
            ->assertJsonPath('plans.1.contact_only', false)
            ->assertJsonPath('plans.1.entitlements.hackathon_access', true)
            ->assertJsonPath('plans.1.entitlements.project_lab_access', true)
            ->assertJsonPath('plans.2.code', 'grandmaster')
            ->assertJsonPath('plans.2.contact_only', true)
            ->assertJsonPath('plans.2.is_free', false)
            ->assertJsonPath('plans.2.sale_price', 0)
            ->assertJsonPath('plans.2.term_days', 1095)
            ->assertJsonPath('plans.2.term_unit', '3 years')
            ->assertJsonPath('plans.2.entitlements.project_lab_access', true);
    }

    public function test_the_public_list_never_includes_add_ons_or_college_and_company_plans(): void
    {
        $codes = collect($this->getJson('/api/public/plans')->assertOk()->json('plans'))->pluck('code')->all();

        $this->assertSame(['coder', 'expert', 'grandmaster'], $codes);
    }

    public function test_a_plan_switched_off_disappears_from_the_public_list(): void
    {
        $this->plan('expert')->update(['is_active' => false]);

        $codes = collect($this->getJson('/api/public/plans')->assertOk()->json('plans'))->pluck('code')->all();

        $this->assertSame(['coder', 'grandmaster'], $codes);
    }

    public function test_the_public_list_is_etagged_so_polling_it_is_nearly_free(): void
    {
        $first = $this->getJson('/api/public/plans')->assertOk();
        $etag = $first->headers->get('ETag');

        $this->assertNotEmpty($etag);
        $this->assertStringContainsString('public', (string) $first->headers->get('Cache-Control'));

        // Unchanged: an empty 304.
        $this->getJson('/api/public/plans', ['If-None-Match' => $etag])->assertStatus(304);

        // A price change moves the ETag, so the next poll gets the new body at once.
        Sanctum::actingAs($this->superadmin());
        $this->edit('expert', ['list_price' => 5999, 'discount_percent' => 40])->assertOk();

        $after = $this->getJson('/api/public/plans', ['If-None-Match' => $etag])->assertOk();
        $this->assertNotSame($etag, $after->headers->get('ETag'));
        $after->assertJsonPath('plans.1.list_price', 5999)->assertJsonPath('plans.1.sale_price', 3599);
    }

    // ───────────────────────────── quote and checkout ─────────────────────────────

    public function test_a_plan_is_quoted_and_charged_at_its_sale_price(): void
    {
        $student = $this->student();
        Sanctum::actingAs($student);

        $this->getJson('/api/me/purchase-quote?plan_code=expert')
            ->assertOk()
            ->assertJsonPath('quote.subtotal', 4999)
            ->assertJsonPath('quote.discount', 2000)
            ->assertJsonPath('quote.total', 2999)
            ->assertJsonPath('quote.lines.0.list_price', 4999)
            ->assertJsonPath('quote.lines.0.discount_percent', 40)
            ->assertJsonPath('quote.lines.0.price', 2999);

        $order = $this->postJson('/api/me/checkout', ['plan_code' => 'expert', 'expected_total' => 2999])
            ->assertCreated()
            ->assertJsonPath('checkout.amount', 299900);
        $this->assertSame(299900, $this->razorpay->orders[$order->json('checkout.order_id')]['amount'], 'Razorpay is asked for the sale price, in paise');

        $this->postJson('/api/me/checkout/verify', $this->razorpay->callback($this->razorpay->pay($order->json('checkout.order_id'))))
            ->assertOk()
            ->assertJsonPath('coverage.plan.code', 'expert')
            ->assertJsonPath('payment.amount', 2999);

        $sub = $student->fresh()->activeSubscription();
        $this->assertSame(2999, $sub->meta['price_paid']);
        $this->assertSame(4999, $sub->meta['list_price']);
        $this->assertSame(2000, $sub->meta['discount']);
        $this->assertEqualsWithDelta(365, $sub->daysRemaining(), 1, 'a plan is a year, not a month');
    }

    public function test_the_team_sold_plan_can_neither_be_quoted_nor_bought_whatever_the_request_says(): void
    {
        $student = $this->student();
        Sanctum::actingAs($student);

        $this->getJson('/api/me/purchase-quote?plan_code=grandmaster')->assertStatus(422)->assertJsonValidationErrors('plan_code');
        $this->postJson('/api/me/checkout', ['plan_code' => 'grandmaster'])->assertStatus(422)->assertJsonValidationErrors('plan_code');
        $this->postJson('/api/me/checkout', ['plan_code' => 'grandmaster', 'expected_total' => 0])->assertStatus(422);
        $this->postJson('/api/me/checkout', ['plan_code' => 'grandmaster', 'expected_total' => 2999, 'amount' => 1, 'price' => 1])->assertStatus(422);

        // It stays unbuyable even if someone later gives the row a price: the flag, not the missing price, is the guard.
        $this->plan('grandmaster')->update(['list_price' => 4999, 'discount_percent' => 40]);
        $this->postJson('/api/me/checkout', ['plan_code' => 'grandmaster', 'expected_total' => 2999])->assertStatus(422);

        $this->assertSame(0, $this->razorpay->calls('POST', '/orders'), 'the gateway was never asked for an order');
        $this->assertSame('coder', $student->fresh()->activeSubscription()->plan->code);
        $this->assertSame(0, Subscription::whereHas('plan', fn ($q) => $q->where('code', 'grandmaster'))->count());
    }

    public function test_the_free_plan_costs_nothing(): void
    {
        $quote = app(PurchaseQuoteService::class)->quote($this->student(), 'coder');

        $this->assertSame(0, $quote['total']);
        $this->assertSame(0, $quote['discount']);
    }

    public function test_the_project_lab_add_on_can_no_longer_be_bought(): void
    {
        Sanctum::actingAs($this->student());

        $this->getJson('/api/me/purchase-quote?addons[]=project-lab')->assertStatus(422)->assertJsonValidationErrors('addons');
        $this->postJson('/api/me/checkout', ['addons' => ['project-lab']])->assertStatus(422)->assertJsonValidationErrors('addons');
    }

    public function test_a_price_changed_after_the_student_opened_the_page_is_refused_not_silently_charged(): void
    {
        $student = $this->student();
        Sanctum::actingAs($student);

        // The page showed 2,999. Meanwhile the superadmin takes the discount to 50% (→ 2,500).
        $this->plan('expert')->update(['discount_percent' => 50]);

        $this->postJson('/api/me/checkout', ['plan_code' => 'expert', 'expected_total' => 2999])
            ->assertStatus(409)
            ->assertJsonPath('code', 'price_changed')
            ->assertJsonPath('quote.total', 2500);

        $this->assertSame('coder', $student->fresh()->activeSubscription()->plan->code, 'nothing was bought');
        $this->assertSame(0, $this->razorpay->calls('POST', '/orders'), 'and Razorpay was never asked for an order');

        // Confirming the new price goes through.
        $order = $this->postJson('/api/me/checkout', ['plan_code' => 'expert', 'expected_total' => 2500])->assertCreated();
        $this->postJson('/api/me/checkout/verify', $this->razorpay->callback($this->razorpay->pay($order->json('checkout.order_id'))))
            ->assertOk()
            ->assertJsonPath('coverage.plan.code', 'expert');
    }

    public function test_a_new_price_applies_to_new_purchases_but_never_reprices_a_subscription_already_running(): void
    {
        $early = $this->student();
        $this->buy($early, 'expert');
        $before = $early->fresh()->activeSubscription();

        $this->plan('expert')->update(['list_price' => 3999, 'discount_percent' => 0]);

        $after = $early->fresh()->activeSubscription();
        $this->assertSame($before->id, $after->id);
        $this->assertSame(2999, $after->meta['price_paid'], 'what they paid is history');

        $late = $this->student();
        $quote = $this->buy($late, 'expert');
        $this->assertSame(3999, $quote['total']);
        $this->assertSame(3999, $late->fresh()->activeSubscription()->meta['price_paid']);
    }

    // ───────────────────────────── the superadmin's Plans & Pricing ─────────────────────────────

    public function test_the_editor_lists_the_individual_plans_with_who_is_on_each(): void
    {
        $this->buy($this->student(), 'expert');
        $this->buy($this->student(), 'expert');
        $this->studentOnAcademy();
        Sanctum::actingAs($this->superadmin());

        $response = $this->getJson('/api/superadmin/plans')->assertOk();

        $response->assertJsonPath('limits.max_discount_percent', 100)
            ->assertJsonCount(3, 'plans')
            ->assertJsonPath('plans.0.code', 'coder')
            ->assertJsonPath('plans.0.is_editable', false)
            ->assertJsonPath('plans.1.code', 'expert')
            ->assertJsonPath('plans.1.is_editable', true)
            ->assertJsonPath('plans.1.contact_only', false)
            ->assertJsonPath('plans.1.active_subscribers', 2)
            ->assertJsonPath('plans.1.version', '4999-40')
            ->assertJsonPath('plans.1.sale_price', 2999)
            ->assertJsonPath('plans.2.code', 'grandmaster')
            ->assertJsonPath('plans.2.is_editable', false)
            ->assertJsonPath('plans.2.contact_only', true)
            ->assertJsonPath('plans.2.active_subscribers', 1);
    }

    public function test_only_a_superadmin_may_read_or_change_plan_prices(): void
    {
        $this->getJson('/api/superadmin/plans')->assertUnauthorized();
        $this->putJson('/api/superadmin/plans/expert', ['list_price' => 1, 'discount_percent' => 0])->assertUnauthorized();

        foreach ([
            $this->student(),
            User::factory()->create(['role' => User::ROLE_ADMIN_INTERNAL, 'permissions' => [User::PERM_HACKATHONS]]),
            User::factory()->create(['role' => User::ROLE_ADMIN_TPO]),
            User::factory()->create(['role' => User::ROLE_ADMIN_MARKETING]),
        ] as $user) {
            Sanctum::actingAs($user);
            $this->getJson('/api/superadmin/plans')->assertForbidden();
            $this->edit('expert', ['list_price' => 1, 'discount_percent' => 0])->assertForbidden();
        }

        $this->assertSame(4999, $this->plan('expert')->list_price, 'nothing changed');
    }

    public function test_the_superadmin_changes_a_price_and_discount_and_it_is_live_and_audited(): void
    {
        $admin = $this->superadmin();
        Sanctum::actingAs($admin);

        $this->edit('expert', ['list_price' => 5499, 'discount_percent' => 20, 'version' => '4999-40'])
            ->assertOk()
            ->assertJsonPath('plan.list_price', 5499)
            ->assertJsonPath('plan.discount_percent', 20)
            ->assertJsonPath('plan.sale_price', 4399)
            ->assertJsonPath('plan.version', '5499-20')
            ->assertJsonPath('plan.pricing_updated_by_name', $admin->name);

        $expert = $this->plan('expert');
        $this->assertSame(5499, $expert->list_price);
        $this->assertSame($admin->id, $expert->pricing_updated_by);
        $this->assertNotNull($expert->pricing_updated_at);

        // Live: the public page and the checkout both see it at once.
        $this->getJson('/api/public/plans')->assertJsonPath('plans.1.sale_price', 4399)->assertJsonPath('plans.1.list_price', 5499);
        $this->assertSame(4399, app(PurchaseQuoteService::class)->quote($this->student(), 'expert')['total']);

        $log = ActivityLog::where('action', 'Changed plan pricing')->sole();
        $this->assertSame($admin->id, $log->actor_id);
        $this->assertSame('Expert', $log->target_label);
        $this->assertSame(['list_price' => 4999, 'discount_percent' => 40, 'sale_price' => 2999], $log->meta['from']);
        $this->assertSame(['list_price' => 5499, 'discount_percent' => 20, 'sale_price' => 4399], $log->meta['to']);
    }

    public function test_the_discount_can_be_removed_entirely(): void
    {
        Sanctum::actingAs($this->superadmin());

        $this->edit('expert', ['list_price' => 4999, 'discount_percent' => 0])
            ->assertOk()
            ->assertJsonPath('plan.discount_percent', 0)
            ->assertJsonPath('plan.sale_price', 4999);

        $this->getJson('/api/public/plans')->assertJsonPath('plans.1.discount_percent', 0)->assertJsonPath('plans.1.sale_price', 4999);
    }

    public function test_saving_the_same_numbers_again_changes_and_logs_nothing(): void
    {
        Sanctum::actingAs($this->superadmin());

        $this->edit('expert', ['list_price' => 4999, 'discount_percent' => 40])->assertOk();

        $this->assertSame(0, ActivityLog::where('action', 'Changed plan pricing')->count());
        $this->assertNull($this->plan('expert')->pricing_updated_at);
    }

    #[DataProvider('badPrices')]
    public function test_nonsense_prices_and_discounts_are_refused(array $body, string $field): void
    {
        Sanctum::actingAs($this->superadmin());

        $this->edit('expert', $body)->assertStatus(422)->assertJsonValidationErrors($field);

        $this->assertSame(4999, $this->plan('expert')->list_price);
        $this->assertSame(40, $this->plan('expert')->discount_percent);
    }

    public static function badPrices(): array
    {
        return [
            'a free paid plan' => [['list_price' => 0, 'discount_percent' => 40], 'list_price'],
            'a negative price' => [['list_price' => -10, 'discount_percent' => 40], 'list_price'],
            'a stray extra zero' => [['list_price' => 5000000, 'discount_percent' => 40], 'list_price'],
            'a fractional price' => [['list_price' => 1999.5, 'discount_percent' => 40], 'list_price'],
            'a price in words' => [['list_price' => 'cheap', 'discount_percent' => 40], 'list_price'],
            'no price' => [['discount_percent' => 40], 'list_price'],
            'a discount of 400 for 40' => [['list_price' => 1999, 'discount_percent' => 400], 'discount_percent'],
            'a discount past 100%' => [['list_price' => 1999, 'discount_percent' => 101], 'discount_percent'],
            'a 100% discount nobody confirmed' => [['list_price' => 1999, 'discount_percent' => 100], 'confirm_free_offer'],
            'a negative discount' => [['list_price' => 1999, 'discount_percent' => -1], 'discount_percent'],
            'a fractional discount' => [['list_price' => 1999, 'discount_percent' => 12.5], 'discount_percent'],
            'no discount field' => [['list_price' => 1999], 'discount_percent'],
        ];
    }

    public function test_free_coder_the_team_sold_plan_and_non_individual_plans_cannot_be_priced_here(): void
    {
        Sanctum::actingAs($this->superadmin());

        $this->edit('coder', ['list_price' => 100, 'discount_percent' => 0])->assertStatus(422)->assertJsonValidationErrors('plan');
        $this->edit('grandmaster', ['list_price' => 4999, 'discount_percent' => 40])->assertStatus(422)->assertJsonValidationErrors('plan');
        $this->edit('project-lab', ['list_price' => 100, 'discount_percent' => 0])->assertStatus(422)->assertJsonValidationErrors('plan');
        $this->edit('standard', ['list_price' => 100, 'discount_percent' => 0])->assertStatus(422)->assertJsonValidationErrors('plan');
        $this->edit('no-such-plan', ['list_price' => 100, 'discount_percent' => 0])->assertNotFound();

        $this->assertSame(0, $this->plan('coder')->list_price);
        $this->assertNull($this->plan('grandmaster')->list_price, 'Grandmaster still has no price: it cannot be turned into a priced plan by accident');
    }

    public function test_what_the_team_sold_plan_includes_is_still_editable(): void
    {
        Sanctum::actingAs($this->superadmin());
        $limits = $this->getJson('/api/superadmin/plans')->assertOk()->json('plans.2.limits');
        $limits['max_mock_interviews_per_day'] = 20;

        $this->putJson('/api/superadmin/plans/grandmaster/entitlements', $limits)
            ->assertOk()
            ->assertJsonPath('plan.entitlements.mock_interviews_per_day', 20)
            ->assertJsonPath('plan.contact_only', true);
    }

    public function test_a_stale_editor_cannot_overwrite_a_change_someone_else_saved(): void
    {
        Sanctum::actingAs($this->superadmin());

        // Another superadmin moved Expert to 5,499 after this editor loaded "4999-40".
        $this->plan('expert')->update(['list_price' => 5499]);

        $this->edit('expert', ['list_price' => 3799, 'discount_percent' => 40, 'version' => '4999-40'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('version');

        $this->assertSame(5499, $this->plan('expert')->list_price, "the other superadmin's change survives");
    }

    public function test_the_revenue_overview_spreads_each_term_over_its_own_length(): void
    {
        $this->buy($this->student(), 'expert'); // ₹2,999 for 365 days

        // A Mellow Academy enrolment paid for outside the gateway: ₹60,000 for the plan's three years.
        $academy = $this->plan('grandmaster');
        app(SubscriptionService::class)->grantIndividualPlan($this->student(), $academy, $this->superadmin(), [
            'days' => (int) $academy->duration_days,
            'kind' => 'offline_payment',
            'amount' => 60000,
            'reference' => 'NEFT-1',
            'reason' => 'Mellow Academy fee, received by bank transfer',
        ]);
        Sanctum::actingAs($this->superadmin());

        $recurring = $this->getJson('/api/superadmin/overview')->assertOk()->json('individual_recurring');

        $this->assertSame((int) round(2999 * 30 / 365 + 60000 * 30 / 1095), $recurring['monthly_total'], 'a yearly price is not a monthly one, and nor is a three-year fee');
    }

    // ───────────────────────────── the migration that made it so ─────────────────────────────

    /** These tests alter the schema, which MySQL commits implicitly (the test's rollback could not undo it): SQLite only. */
    private function skipUnlessSqlite(): void
    {
        if (DB::getDriverName() !== 'sqlite') {
            $this->markTestSkipped('Changes the schema inside the test; MySQL commits DDL implicitly. (Verified by hand on MariaDB — see docs/pricing-and-plans.md §6.)');
        }
    }

    public function test_the_migration_moves_grandmasters_price_limits_and_subscribers_onto_expert_and_can_be_undone(): void
    {
        $this->skipUnlessSqlite();
        $migration = require database_path('migrations/2026_10_18_100000_make_expert_the_full_plan_and_grandmaster_the_academy_plan.php');

        // Put the database back the way production has it today: Expert the ₹1,999 mid tier, Grandmaster the complete plan —
        // at a price the superadmin has since changed, which must travel with it.
        Schema::table('plans', fn ($table) => $table->dropColumn('contact_only'));
        DB::table('plans')->where('code', 'expert')->update([
            'list_price' => 1999, 'discount_percent' => 40, 'duration_days' => 365,
            'max_practice_problems_per_day' => 10, 'max_mock_interviews_per_day' => 3,
            'hackathon_access' => false, 'vault_access' => false, 'project_lab_access' => false,
            'max_workspace_hours_per_month' => null, 'max_active_projects' => null,
        ]);
        DB::table('plans')->where('code', 'grandmaster')->update([
            'list_price' => 5499, 'discount_percent' => 35, 'duration_days' => 365,
        ]);

        $expert = $this->plan('expert');
        $grandmaster = $this->plan('grandmaster');
        $oldGrandmasterBuyer = $this->student();
        $oldExpertBuyer = $this->student();
        $boughtGrandmaster = $this->subscription($oldGrandmasterBuyer, $grandmaster, ['purchase_ref' => 'x1', 'price_paid' => 3574]);
        $boughtExpert = $this->subscription($oldExpertBuyer, $expert, ['purchase_ref' => 'x2', 'price_paid' => 1199]);

        $migration->up();

        // Expert is now what Grandmaster was — its price (as the superadmin last set it), its term, every limit and switch.
        $expert = $this->plan('expert');
        $this->assertSame([5499, 35, 365], [$expert->list_price, $expert->discount_percent, $expert->duration_days]);
        $this->assertSame(
            ['practice_problems_per_day' => null, 'mock_interviews_per_day' => 10, 'free_trial_uses' => null, 'drive_access' => true, 'hackathon_access' => true, 'vault_access' => true, 'project_lab_access' => true, 'workspace_hours_per_month' => 80, 'active_projects' => 3, 'core_practice_per_day' => null, 'core_tests_access' => true],
            $expert->entitlementSummary()
        );
        $this->assertFalse($expert->isContactOnly());

        // Grandmaster is the Academy plan: team-sold, no price, three years, all the same access.
        $grandmaster = $this->plan('grandmaster');
        $this->assertTrue($grandmaster->isContactOnly());
        $this->assertTrue((bool) $grandmaster->is_active);
        $this->assertNull($grandmaster->list_price);
        $this->assertSame([0, 1095], [$grandmaster->discount_percent, $grandmaster->duration_days]);
        $this->assertTrue($grandmaster->vault_access && $grandmaster->hackathon_access && $grandmaster->project_lab_access);

        // The ₹2,999-era buyer bought what is now called Expert, so that is what they hold — dates and price untouched.
        $moved = $boughtGrandmaster->fresh();
        $this->assertSame($expert->id, $moved->plan_id);
        $this->assertSame('grandmaster', $moved->meta['moved_from_plan']);
        $this->assertSame(3574, $moved->meta['price_paid']);
        $this->assertEquals($boughtGrandmaster->current_period_end, $moved->current_period_end);
        $this->assertSame($expert->id, $boughtExpert->fresh()->plan_id);
        $this->assertArrayNotHasKey('moved_from_plan', $boughtExpert->fresh()->meta);
        $this->assertSame(0, Subscription::where('plan_id', $grandmaster->id)->count(), 'nobody is an Academy student by accident');

        // And it can be undone.
        $migration->down();

        $this->assertFalse(Schema::hasColumn('plans', 'contact_only'));
        $this->assertSame($grandmaster->id, $boughtGrandmaster->fresh()->plan_id, 'the moved subscription goes back to where it was bought');
        $this->assertArrayNotHasKey('moved_from_plan', $boughtGrandmaster->fresh()->meta);
        $this->assertSame($expert->id, $boughtExpert->fresh()->plan_id);
        $restored = DB::table('plans')->where('code', 'grandmaster')->first();
        $this->assertSame([5499, 35, 365], [(int) $restored->list_price, (int) $restored->discount_percent, (int) $restored->duration_days]);
        $back = DB::table('plans')->where('code', 'expert')->first();
        $this->assertSame([1999, 40, 10, 3, 0], [(int) $back->list_price, (int) $back->discount_percent, (int) $back->max_practice_problems_per_day, (int) $back->max_mock_interviews_per_day, (int) $back->hackathon_access]);
    }

    public function test_the_migration_on_a_fresh_install_only_adds_the_column(): void
    {
        $this->skipUnlessSqlite();
        $migration = require database_path('migrations/2026_10_18_100000_make_expert_the_full_plan_and_grandmaster_the_academy_plan.php');

        Schema::table('plans', fn ($table) => $table->dropColumn('contact_only'));
        DB::table('subscriptions')->delete();
        DB::table('plans')->delete();

        $migration->up();

        $this->assertTrue(Schema::hasColumn('plans', 'contact_only'));
        $this->assertSame(0, DB::table('plans')->count(), 'PlanSeeder creates the rows with the right values; the migration invents none');
    }

    private function subscription(User $user, Plan $plan, array $meta): Subscription
    {
        return Subscription::create([
            'subscriber_type' => User::class,
            'subscriber_id' => $user->id,
            'plan_id' => $plan->id,
            'status' => Subscription::STATUS_ACTIVE,
            'started_at' => now()->subDays(10),
            'current_period_end' => now()->addDays(200),
            'meta' => $meta,
        ]);
    }
}
