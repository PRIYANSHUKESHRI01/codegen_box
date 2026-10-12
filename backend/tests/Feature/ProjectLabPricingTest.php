<?php

namespace Tests\Feature;

use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use App\Services\PurchaseQuoteService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Concerns\CreatesProjectLabFixtures;
use Tests\TestCase;

/**
 * "Plan only → pay for the plan, Project Lab only → pay for Lab, both → pay the
 * combined price." Prices come from the real PlanSeeder; this is where the
 * numbers advertised to students are pinned.
 */
class ProjectLabPricingTest extends TestCase
{
    use CreatesProjectLabFixtures;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedPlans();
    }

    private function quote(User $user, ?string $plan, array $addons = []): array
    {
        return app(PurchaseQuoteService::class)->quote($user, $plan, $addons);
    }

    public function test_a_plan_alone_costs_exactly_its_price(): void
    {
        $quote = $this->quote($this->student(), 'expert');

        $this->assertSame(399, $quote['total']);
        $this->assertSame(0, $quote['discount']);
        $this->assertFalse($quote['bundle_applied']);
        $this->assertCount(1, $quote['lines']);
    }

    public function test_project_lab_alone_on_the_free_plan_costs_full_price(): void
    {
        $quote = $this->quote($this->student(), null, [Plan::CODE_PROJECT_LAB]);

        $this->assertSame(499, $quote['total']);
        $this->assertSame(0, $quote['discount']);
        $this->assertFalse($quote['bundle_applied']);
    }

    public function test_expert_plus_project_lab_is_bundled(): void
    {
        $quote = $this->quote($this->student(), 'expert', [Plan::CODE_PROJECT_LAB]);

        $this->assertSame(399 + 349, $quote['total']);
        $this->assertSame(150, $quote['discount']);
        $this->assertSame(399 + 499, $quote['subtotal']);
        $this->assertTrue($quote['bundle_applied']);

        $lab = collect($quote['lines'])->firstWhere('code', Plan::CODE_PROJECT_LAB);
        $this->assertSame(499, $lab['list_price']);
        $this->assertSame(349, $lab['price']);
    }

    public function test_grandmaster_plus_project_lab_is_bundled(): void
    {
        $quote = $this->quote($this->student(), 'grandmaster', [Plan::CODE_PROJECT_LAB]);

        $this->assertSame(799 + 349, $quote['total']);
    }

    public function test_a_free_base_plan_in_the_cart_does_not_earn_the_bundle_discount(): void
    {
        $quote = $this->quote($this->student(), 'coder', [Plan::CODE_PROJECT_LAB]);

        $this->assertSame(499, $quote['total']);
        $this->assertFalse($quote['bundle_applied']);
    }

    public function test_an_existing_paid_plan_holder_gets_the_bundle_price_when_adding_lab_later(): void
    {
        $student = $this->student();
        $this->buy($student, 'expert');

        $quote = $this->quote($student->fresh(), null, [Plan::CODE_PROJECT_LAB]);

        $this->assertSame(349, $quote['total']);
        $this->assertTrue($quote['bundle_applied']);
    }

    public function test_an_expired_paid_plan_does_not_earn_the_discount(): void
    {
        $student = $this->student();
        $this->buy($student, 'expert');
        Subscription::query()->where('subscriber_id', $student->id)->whereHas('plan', fn ($q) => $q->where('code', 'expert'))
            ->update(['current_period_end' => now()->subDay()]);

        $quote = $this->quote($student->fresh(), null, [Plan::CODE_PROJECT_LAB]);

        $this->assertSame(499, $quote['total']);
    }

    public function test_the_bundle_discount_can_be_switched_off(): void
    {
        config(['billing.addon_bundle_discount_percent' => 0]);

        $quote = $this->quote($this->student(), 'expert', [Plan::CODE_PROJECT_LAB]);

        $this->assertSame(399 + 499, $quote['total']);
        $this->assertFalse($quote['bundle_applied']);
    }

    public function test_duplicate_addon_codes_are_charged_once(): void
    {
        $quote = $this->quote($this->student(), null, [Plan::CODE_PROJECT_LAB, Plan::CODE_PROJECT_LAB]);

        $this->assertSame(499, $quote['total']);
        $this->assertCount(1, $quote['lines']);
    }

    #[DataProvider('invalidCarts')]
    public function test_invalid_carts_are_rejected(?string $plan, array $addons): void
    {
        $this->expectException(ValidationException::class);

        $this->quote($this->student(), $plan, $addons);
    }

    public static function invalidCarts(): array
    {
        return [
            'empty cart' => [null, []],
            'unknown plan' => ['nope', []],
            'an add-on offered as the plan' => [Plan::CODE_PROJECT_LAB, []],
            'a plan offered as an add-on' => [null, ['expert']],
            'an institution plan' => ['standard', []],
            'unknown add-on' => [null, ['nope']],
        ];
    }

    public function test_an_inactive_plan_cannot_be_bought(): void
    {
        Plan::where('code', Plan::CODE_PROJECT_LAB)->update(['is_active' => false]);

        $this->expectException(ValidationException::class);

        $this->quote($this->student(), null, [Plan::CODE_PROJECT_LAB]);
    }

    // ─────────────────────────── purchasing ───────────────────────────

    public function test_buying_both_creates_two_subscriptions_and_records_what_was_charged(): void
    {
        $student = $this->student();

        $this->buy($student, 'expert', [Plan::CODE_PROJECT_LAB]);

        $subs = Subscription::where('subscriber_id', $student->id)->where('subscriber_type', User::class)
            ->where('status', Subscription::STATUS_ACTIVE)->with('plan')->get()->keyBy(fn ($s) => $s->plan->code);

        $this->assertEqualsCanonicalizing(['expert', Plan::CODE_PROJECT_LAB], $subs->keys()->all());
        $this->assertSame(349, $subs[Plan::CODE_PROJECT_LAB]->meta['price_paid']);
        $this->assertSame(499, $subs[Plan::CODE_PROJECT_LAB]->meta['list_price']);
        $this->assertSame(150, $subs[Plan::CODE_PROJECT_LAB]->meta['discount']);
        $this->assertSame(399, $subs['expert']->meta['price_paid']);
        $this->assertSame(748, $subs['expert']->meta['quote_total']);
        $this->assertSame($subs['expert']->meta['purchase_ref'], $subs[Plan::CODE_PROJECT_LAB]->meta['purchase_ref']);
    }

    public function test_an_addon_never_changes_the_students_plan_or_limits(): void
    {
        $student = $this->student();
        $this->buy($student, 'expert');
        $before = $student->fresh()->effectiveEntitlements();

        $this->buy($student, null, [Plan::CODE_PROJECT_LAB]);
        $student = $student->fresh();

        $this->assertSame('expert', $student->activeSubscription()->plan->code, 'activeSubscription() must stay base-only');
        $this->assertSame($before, $student->effectiveEntitlements());
        $this->assertSame('expert', $student->subscriptionCoverage()['plan']->code);
        $this->assertTrue($student->hasProjectLabAccess());
    }

    public function test_the_addon_can_be_the_most_recent_row_and_activeSubscription_still_answers_with_the_plan(): void
    {
        $student = $this->student();
        $this->buy($student, null, [Plan::CODE_PROJECT_LAB]);

        // Free Coder was created first; Lab is newer — the old "latest active" rule would have returned Lab.
        $this->assertSame('coder', $student->fresh()->activeSubscription()->plan->code);
    }

    public function test_changing_plan_does_not_cancel_the_addon_and_vice_versa(): void
    {
        $student = $this->student();
        $this->buy($student, 'expert', [Plan::CODE_PROJECT_LAB]);

        $this->buy($student, 'grandmaster');
        $student = $student->fresh();

        $this->assertSame('grandmaster', $student->activeSubscription()->plan->code);
        $this->assertTrue($student->hasProjectLabAccess(), 'upgrading the plan must not cost the student Project Lab');
        $this->assertSame(1, Subscription::where('subscriber_id', $student->id)->where('status', Subscription::STATUS_CANCELED)
            ->whereHas('plan', fn ($q) => $q->where('code', 'expert'))->count());

        $this->buy($student, null, [Plan::CODE_PROJECT_LAB]);
        $this->assertSame('grandmaster', $student->fresh()->activeSubscription()->plan->code, 'renewing Lab must not touch the plan');
    }

    public function test_renewing_the_addon_early_stacks_the_remaining_days(): void
    {
        $student = $this->student();
        $this->buy($student, null, [Plan::CODE_PROJECT_LAB]);
        $first = $student->fresh()->activeAddonSubscription(Plan::CODE_PROJECT_LAB);

        $this->buy($student->fresh(), null, [Plan::CODE_PROJECT_LAB]);
        $second = $student->fresh()->activeAddonSubscription(Plan::CODE_PROJECT_LAB);

        $this->assertNotSame($first->id, $second->id);
        $this->assertSame(Subscription::STATUS_CANCELED, $first->fresh()->status);
        $this->assertEqualsWithDelta(60, $second->daysRemaining(), 1, 'a second 30 days must stack on the first, not replace it');
        $this->assertSame(1, $student->activeAddonSubscriptions()->count());
    }

    public function test_an_expired_addon_stops_granting_access_even_before_the_nightly_sweep(): void
    {
        $student = $this->studentWithLab();
        $this->assertTrue($student->hasProjectLabAccess());

        Subscription::where('subscriber_id', $student->id)->whereHas('plan', fn ($q) => $q->where('code', Plan::CODE_PROJECT_LAB))
            ->update(['current_period_end' => now()->subMinute()]);

        $this->assertFalse($student->fresh()->hasProjectLabAccess());
    }

    public function test_a_plan_that_grants_project_lab_covers_the_student_without_an_addon(): void
    {
        $student = $this->student();
        Plan::where('code', 'coder')->update(['project_lab_access' => true, 'max_workspace_hours_per_month' => 10, 'max_active_projects' => 1]);

        $coverage = $student->fresh()->projectLabCoverage();

        $this->assertTrue($coverage['access']);
        $this->assertSame('plan', $coverage['source']);
        $this->assertSame(10, $coverage['max_workspace_hours_per_month']);
    }

    // ─────────────────────────── the endpoints ───────────────────────────

    public function test_the_quote_endpoint_prices_a_cart_without_buying_anything(): void
    {
        $student = $this->student();
        Sanctum::actingAs($student);

        $this->getJson('/api/me/purchase-quote?plan_code=expert&addons[]=project-lab')
            ->assertOk()
            ->assertJsonPath('quote.total', 748)
            ->assertJsonPath('quote.discount', 150)
            ->assertJsonPath('quote.bundle_applied', true);

        $this->assertFalse($student->fresh()->hasProjectLabAccess());
        $this->assertSame('coder', $student->fresh()->activeSubscription()->plan->code);
    }

    public function test_checkout_charges_the_server_price_and_returns_the_new_state(): void
    {
        $student = $this->student();
        Sanctum::actingAs($student);

        $this->postJson('/api/me/subscription', ['plan_code' => 'expert', 'addons' => ['project-lab'], 'expected_total' => 748])
            ->assertOk()
            ->assertJsonPath('coverage.plan.code', 'expert')
            ->assertJsonPath('project_lab.enabled', true)
            ->assertJsonPath('project_lab.source', 'addon')
            ->assertJsonPath('purchase.total', 748)
            ->assertJsonPath('addons.0.code', 'project-lab')
            ->assertJsonPath('addons.0.price_paid', 349);
    }

    public function test_checkout_refuses_when_the_price_the_student_saw_is_stale(): void
    {
        $student = $this->student();
        Sanctum::actingAs($student);

        $this->postJson('/api/me/subscription', ['plan_code' => 'expert', 'addons' => ['project-lab'], 'expected_total' => 898])
            ->assertStatus(409)
            ->assertJsonPath('code', 'price_changed')
            ->assertJsonPath('quote.total', 748);

        $this->assertFalse($student->fresh()->hasProjectLabAccess());
        $this->assertSame('coder', $student->fresh()->activeSubscription()->plan->code);
    }

    public function test_the_client_cannot_name_its_own_price(): void
    {
        $student = $this->student();
        Sanctum::actingAs($student);

        $this->postJson('/api/me/subscription', ['addons' => ['project-lab'], 'price' => 1, 'total' => 1, 'amount' => 1])
            ->assertOk()
            ->assertJsonPath('purchase.total', 499);

        $this->assertSame(499, $student->fresh()->activeAddonSubscription(Plan::CODE_PROJECT_LAB)->meta['price_paid']);
    }

    public function test_the_original_plan_only_request_still_works(): void
    {
        $student = $this->student();
        Sanctum::actingAs($student);

        $this->postJson('/api/me/subscription', ['plan_code' => 'expert'])
            ->assertOk()
            ->assertJsonPath('coverage.plan.code', 'expert')
            ->assertJsonPath('project_lab.enabled', false);
    }

    public function test_an_empty_cart_is_a_validation_error(): void
    {
        Sanctum::actingAs($this->student());

        $this->postJson('/api/me/subscription', [])->assertStatus(422)->assertJsonValidationErrors('plan_code');
    }

    public function test_only_students_can_buy_or_quote(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_ADMIN_TPO]));

        $this->postJson('/api/me/subscription', ['addons' => ['project-lab']])->assertForbidden();
        $this->getJson('/api/me/purchase-quote?addons[]=project-lab')->assertForbidden();
    }

    public function test_subscription_state_lists_lab_and_its_offer_for_a_student_without_it(): void
    {
        Sanctum::actingAs($this->student());

        $this->getJson('/api/me/subscription')
            ->assertOk()
            ->assertJsonPath('project_lab.enabled', false)
            ->assertJsonPath('project_lab.source', 'none')
            ->assertJsonPath('project_lab.offer.code', 'project-lab')
            ->assertJsonPath('project_lab.offer.monthly_price', 499)
            ->assertJsonPath('addons', []);
    }

    public function test_subscription_state_reports_hours_and_projects_for_a_student_with_lab(): void
    {
        Sanctum::actingAs($this->studentWithLab());

        $this->getJson('/api/me/subscription')
            ->assertOk()
            ->assertJsonPath('project_lab.enabled', true)
            ->assertJsonPath('project_lab.hours.limit', 80)
            ->assertJsonPath('project_lab.hours.used', 0)
            ->assertJsonPath('project_lab.hours.remaining', 80)
            ->assertJsonPath('project_lab.projects.limit', 3)
            ->assertJsonPath('project_lab.projects.active', 0);
    }

    public function test_a_mellow_direct_lead_who_buys_only_project_lab_is_converted_to_a_customer(): void
    {
        $lead = $this->student(); // no college => a Mellow Direct lead
        $this->assertTrue($lead->isMellowDirectLead());

        $this->buy($lead, null, [Plan::CODE_PROJECT_LAB]);

        $this->assertSame(User::LEAD_STATUS_CONVERTED, $lead->fresh()->lead_status);
    }

    public function test_adjusting_a_colleges_seats_keeps_its_project_lab_settings(): void
    {
        // adjustSeatLimit() flips colleges.tier to 'Custom', which the SQLite test driver's CHECK
        // constraint rejects — a known gap in 2026_09_29_020000 documented in
        // AdminCollegeSubscriptionTest. Same guard, same reason; the MySQL behaviour is what matters.
        if (DB::getDriverName() !== 'mysql') {
            $this->markTestSkipped('colleges.tier CHECK constraint on the non-MySQL test driver; see AdminCollegeSubscriptionTest.');
        }

        // adjustSeatLimit() clones a plan field by field; a field it forgets silently resets to default.
        $college = \App\Models\College::create(['name' => 'Seat Test College', 'short_code' => 'STC', 'tier' => 'Standard']);
        $plan = Plan::where('code', 'standard')->firstOrFail();
        $plan->update(['project_lab_access' => true, 'max_workspace_hours_per_month' => 40, 'max_active_projects' => 2]);
        $staff = User::factory()->create(['role' => User::ROLE_SUPERADMIN]);
        $service = app(\App\Services\SubscriptionService::class);
        $service->assignInstitutionPlan($college, $plan, $staff);

        $service->adjustSeatLimit($college, 750, $staff);

        $custom = $college->fresh()->activeSubscription()->plan;
        $this->assertSame(750, $custom->max_students);
        $this->assertTrue($custom->project_lab_access);
        $this->assertSame(40, $custom->max_workspace_hours_per_month);
        $this->assertSame(2, $custom->max_active_projects);
    }
}
