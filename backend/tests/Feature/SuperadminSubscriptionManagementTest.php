<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\College;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use App\Services\PlanGate;
use App\Services\PlanRequiredException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\CreatesProjectLabFixtures;
use Tests\TestCase;

/**
 * Superadmin → Subscriptions: giving a student a plan by hand, adding days, ending
 * a plan, and the list of every plan anyone holds.
 *
 * The properties that matter, each pinned below:
 *   - it takes effect at once, through the same entitlement code every gate reads;
 *   - a free gift is never counted as revenue and never turns a lead into a customer;
 *   - one student's plan can't be shortened by accident;
 *   - ending a COLLEGE's plan (which switches off its students) needs the password;
 *   - nobody but a superadmin can reach any of it.
 */
class SuperadminSubscriptionManagementTest extends TestCase
{
    use CreatesProjectLabFixtures;
    use RefreshDatabase;

    private const PASSWORD = 'correct-horse-battery';

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedPlans();
    }

    private function superadmin(): User
    {
        return User::factory()->create(['role' => User::ROLE_SUPERADMIN, 'password' => Hash::make(self::PASSWORD)]);
    }

    private function collegePlan(array $overrides = []): Plan
    {
        return Plan::create(array_merge([
            'code' => 'inst-'.uniqid(),
            'name' => 'Standard',
            'audience' => Plan::AUDIENCE_INSTITUTION,
            'kind' => Plan::KIND_BASE,
            'list_price' => null,
            'annual_price' => 149000,
            'duration_days' => 365,
            'is_active' => true,
            'sort_order' => 1,
            'drive_access' => true,
            'hackathon_access' => true,
            'max_students' => 500,
        ], $overrides));
    }

    private function college(array $subscription = []): College
    {
        $plan = $this->collegePlan();
        $college = College::create(['name' => 'Apex Institute', 'short_code' => 'APX-'.uniqid(), 'tier' => $plan->name]);

        Subscription::create(array_merge([
            'subscriber_type' => College::class,
            'subscriber_id' => $college->id,
            'plan_id' => $plan->id,
            'status' => Subscription::STATUS_ACTIVE,
            'started_at' => now()->subMonth(),
            'current_period_end' => now()->addMonths(6),
            'auto_renew' => false,
        ], $subscription));

        return $college;
    }

    private function grant(User $student, array $body = [])
    {
        return $this->postJson("/api/superadmin/users/{$student->id}/subscription", array_merge([
            'plan_code' => 'grandmaster',
            'days' => 90,
            'kind' => 'complimentary',
            'reason' => 'Scholarship — placement drive prep',
        ], $body));
    }

    private function planOf(User $user): ?string
    {
        return $user->fresh()->subscriptionCoverage()['plan']?->code;
    }

    // ───────────────────────────── giving a plan ─────────────────────────────

    public function test_a_complimentary_plan_takes_effect_immediately_and_unlocks_what_the_plan_unlocks(): void
    {
        $student = $this->student();
        $this->assertSame('coder', $this->planOf($student));
        $this->assertFalse($student->effectiveEntitlements()['hackathon_access']);

        Sanctum::actingAs($this->superadmin());
        $response = $this->grant($student)->assertCreated();

        $response->assertJsonPath('subscription.plan.code', 'grandmaster')
            ->assertJsonPath('subscription.state', 'active')
            ->assertJsonPath('subscription.source', 'admin_grant')
            ->assertJsonPath('subscription.complimentary', true)
            ->assertJsonPath('subscription.price_paid', 0)
            ->assertJsonPath('coverage.plan.code', 'grandmaster');

        $this->assertSame('grandmaster', $this->planOf($student));
        $this->assertTrue($student->fresh()->effectiveEntitlements()['hackathon_access'], 'Hack Arena is open at once');

        $subscription = Subscription::findOrFail($response->json('subscription.id'));
        $this->assertEqualsWithDelta(90, now()->diffInDays($subscription->current_period_end, true), 1, 'the chosen 90-day term, not the plan\'s 365');
        $this->assertFalse($subscription->is_trial, 'a hand-picked term is not a demo');
        $this->assertSame(1, $student->subscriptions()->where('status', Subscription::STATUS_ACTIVE)->count(), 'the free plan it replaced is no longer active');
    }

    public function test_the_student_sees_the_new_plan_on_their_own_screen_and_the_change_signal_moves(): void
    {
        $student = $this->student();

        Sanctum::actingAs($student);
        $before = $this->getJson('/api/me/plan-signal')->assertOk()->json();
        $this->assertSame('coder', $before['plan']['code']);

        Sanctum::actingAs($this->superadmin());
        $this->grant($student)->assertCreated();

        Sanctum::actingAs($student->fresh());
        $this->getJson('/api/me/subscription')->assertOk()
            ->assertJsonPath('coverage.plan.code', 'grandmaster')
            ->assertJsonPath('entitlements.hackathon_access', true);

        $after = $this->getJson('/api/me/plan-signal')->assertOk()->json();
        $this->assertSame('grandmaster', $after['plan']['code']);
        $this->assertNotSame($before['signature'], $after['signature'], 'open dashboards notice the change and refetch');

        $this->assertSame($after['signature'], $this->getJson('/api/me/plan-signal')->json('signature'), 'and it is stable while nothing changes');
    }

    public function test_a_gifted_plan_is_not_revenue(): void
    {
        Sanctum::actingAs($this->superadmin());
        $baseline = $this->getJson('/api/superadmin/overview')->assertOk()->json('individual_recurring.monthly_total');

        $this->grant($this->student())->assertCreated();

        $this->getJson('/api/superadmin/overview')->assertOk()
            ->assertJsonPath('individual_recurring.monthly_total', $baseline);
    }

    public function test_a_plan_paid_for_offline_counts_the_amount_actually_received_over_the_term_actually_given(): void
    {
        Sanctum::actingAs($this->superadmin());
        $baseline = $this->getJson('/api/superadmin/overview')->json('individual_recurring.monthly_total');

        $response = $this->grant($this->student(), [
            'kind' => 'offline_payment',
            'amount' => 900,
            'days' => 90,
            'reference' => 'UPI 4081-2231',
        ])->assertCreated();

        $response->assertJsonPath('subscription.price_paid', 900)
            ->assertJsonPath('subscription.complimentary', false)
            ->assertJsonPath('subscription.payment_reference', 'UPI 4081-2231');

        // ₹900 over 90 days is ₹300 a month — not ₹900 spread over the plan's usual 365 days.
        $this->assertSame($baseline + 300, $this->getJson('/api/superadmin/overview')->json('individual_recurring.monthly_total'));
    }

    public function test_only_a_real_payment_converts_a_lead_into_a_customer(): void
    {
        $gifted = $this->student(['lead_status' => User::LEAD_STATUS_NEW]);
        $paid = $this->student(['lead_status' => User::LEAD_STATUS_NEW]);
        $this->assertTrue($gifted->isMellowDirectLead());

        Sanctum::actingAs($this->superadmin());
        $this->grant($gifted)->assertCreated();
        $this->grant($paid, ['kind' => 'offline_payment', 'amount' => 2999])->assertCreated();

        $this->assertSame(User::LEAD_STATUS_NEW, $gifted->fresh()->lead_status, 'a free gift is not a sale');
        $this->assertSame(User::LEAD_STATUS_CONVERTED, $paid->fresh()->lead_status);
    }

    public function test_an_offline_payment_needs_an_amount_and_every_grant_needs_a_reason(): void
    {
        $student = $this->student();
        Sanctum::actingAs($this->superadmin());

        $this->grant($student, ['kind' => 'offline_payment'])->assertStatus(422)->assertJsonValidationErrors('amount');
        $this->grant($student, ['reason' => ''])->assertStatus(422)->assertJsonValidationErrors('reason');
        $this->grant($student, ['kind' => 'free'])->assertStatus(422)->assertJsonValidationErrors('kind');
        $this->grant($student, ['days' => 0])->assertStatus(422)->assertJsonValidationErrors('days');
        $this->grant($student, ['days' => 5000])->assertStatus(422)->assertJsonValidationErrors('days');

        $this->assertSame('coder', $this->planOf($student), 'nothing was granted by any of those');
    }

    public function test_only_a_paid_individual_plan_can_be_given_to_a_student(): void
    {
        $student = $this->student();
        $college = $this->college();
        $collegePlan = $college->activeSubscription()->plan;
        Sanctum::actingAs($this->superadmin());

        $this->grant($student, ['plan_code' => 'coder'])->assertStatus(422)->assertJsonValidationErrors('plan_code');
        $this->grant($student, ['plan_code' => $collegePlan->code])->assertStatus(422)->assertJsonValidationErrors('plan_code');
        $this->grant($student, ['plan_code' => 'no-such-plan'])->assertStatus(422)->assertJsonValidationErrors('plan_code');

        Plan::where('code', 'expert')->update(['is_active' => false]);
        $this->grant($student, ['plan_code' => 'expert'])->assertStatus(422)->assertJsonValidationErrors('plan_code');

        $tpo = User::factory()->create(['role' => User::ROLE_ADMIN_TPO, 'college_id' => $college->id]);
        $this->grant($tpo)->assertStatus(422)->assertJsonValidationErrors('user');
    }

    public function test_it_will_not_shorten_a_plan_the_student_already_has_more_time_on(): void
    {
        $student = $this->student();
        Sanctum::actingAs($this->superadmin());
        $this->grant($student, ['days' => 300])->assertCreated();

        $this->grant($student, ['days' => 30])
            ->assertStatus(422)
            ->assertJsonValidationErrors('days');

        $this->assertSame(1, $student->subscriptions()->where('status', Subscription::STATUS_ACTIVE)->count());
        $this->assertGreaterThan(290, $student->fresh()->subscriptionCoverage()['days_remaining']);

        // A longer term, or a different plan, is a deliberate change and goes through.
        $this->grant($student, ['days' => 365])->assertCreated();
        $this->grant($student, ['plan_code' => 'expert', 'days' => 30])->assertCreated();
        $this->assertSame('expert', $this->planOf($student));
    }

    public function test_a_college_covered_student_is_warned_that_their_own_plan_waits(): void
    {
        $college = $this->college();
        $student = $this->student(['college_id' => $college->id]);
        $this->assertSame('institution', $student->subscriptionCoverage()['source']);

        Sanctum::actingAs($this->superadmin());
        $response = $this->grant($student)->assertCreated();

        $this->assertStringContainsString('Apex Institute', $response->json('warning'));
        $this->assertSame('institution', $student->fresh()->subscriptionCoverage()['source'], 'the college plan still governs');
        $this->assertNotNull($student->subscriptions()->where('status', Subscription::STATUS_ACTIVE)->whereHas('plan', fn ($p) => $p->where('code', 'grandmaster'))->first(), 'but the grant is on file for when it ends');
    }

    public function test_every_change_is_audited_with_who_why_and_which_account(): void
    {
        $student = $this->student();
        $admin = $this->superadmin();
        Sanctum::actingAs($admin);

        $this->grant($student, ['reason' => 'Winner of the October contest'])->assertCreated();

        $log = ActivityLog::where('action', 'Granted a complimentary plan')->firstOrFail();
        $this->assertSame($admin->id, $log->actor_id);
        $this->assertSame($student->id, $log->meta['user_id']);
        $this->assertSame('grandmaster', $log->meta['plan_code']);
        $this->assertSame('Winner of the October contest', $log->meta['reason']);
    }

    // ───────────────────────────── extending ─────────────────────────────

    public function test_extending_adds_days_to_the_end_date_and_nothing_else(): void
    {
        $student = $this->student();
        Sanctum::actingAs($this->superadmin());
        $id = $this->grant($student, ['days' => 30])->json('subscription.id');
        $endBefore = Subscription::find($id)->current_period_end;

        $this->postJson("/api/superadmin/subscriptions/{$id}/extend", ['days' => 15, 'reason' => 'Contest outage compensation'])
            ->assertOk()
            ->assertJsonPath('subscription.extensions', 1)
            ->assertJsonPath('subscription.plan.code', 'grandmaster');

        $after = Subscription::find($id);
        $this->assertTrue($after->current_period_end->equalTo($endBefore->copy()->addDays(15)));
        $this->assertSame('active', $after->status);
        $this->assertSame('admin_grant', $after->source());
    }

    public function test_a_plan_that_never_expires_or_has_already_ended_cannot_be_extended(): void
    {
        $student = $this->student();
        $free = $student->activeSubscription();
        Sanctum::actingAs($this->superadmin());

        $this->postJson("/api/superadmin/subscriptions/{$free->id}/extend", ['days' => 10, 'reason' => 'x y z'])
            ->assertStatus(422)->assertJsonValidationErrors('subscription');

        $id = $this->grant($student, ['days' => 10])->json('subscription.id');
        Subscription::whereKey($id)->update(['current_period_end' => now()->subDay()]);

        $this->postJson("/api/superadmin/subscriptions/{$id}/extend", ['days' => 10, 'reason' => 'x y z'])
            ->assertStatus(422)->assertJsonValidationErrors('subscription');
    }

    public function test_extending_a_colleges_plan_works_too(): void
    {
        $college = $this->college();
        $subscription = $college->activeSubscription();
        $endBefore = $subscription->current_period_end;
        Sanctum::actingAs($this->superadmin());

        $this->postJson("/api/superadmin/subscriptions/{$subscription->id}/extend", ['days' => 30, 'reason' => 'Renewal in progress'])->assertOk();

        $this->assertTrue($subscription->fresh()->current_period_end->equalTo($endBefore->copy()->addDays(30)));
        $this->assertSame('College', ActivityLog::where('action', 'Extended a College plan')->firstOrFail()->target_type);
    }

    // ───────────────────────────── cancelling ─────────────────────────────

    public function test_cancelling_a_students_plan_returns_them_to_the_free_plan_at_once(): void
    {
        $student = $this->student();
        Sanctum::actingAs($this->superadmin());
        $id = $this->grant($student)->json('subscription.id');
        $this->assertTrue($student->fresh()->effectiveEntitlements()['hackathon_access']);

        $this->postJson("/api/superadmin/subscriptions/{$id}/cancel", ['reason' => 'Granted to the wrong account'])
            ->assertOk()
            ->assertJsonPath('subscription.state', 'canceled')
            ->assertJsonPath('subscription.cancel_reason', 'Granted to the wrong account')
            ->assertJsonPath('coverage.plan.code', 'coder');

        $this->assertSame('coder', $this->planOf($student));
        $this->assertFalse($student->fresh()->effectiveEntitlements()['hackathon_access'], 'Hack Arena closes at once');
        $this->assertNotNull(Subscription::find($id)->canceled_at, 'kept in the history, not deleted');
        $this->assertSame(1, $student->subscriptions()->where('status', Subscription::STATUS_ACTIVE)->count(), 'exactly one running plan: the free one');
    }

    public function test_a_cancelled_student_is_refused_by_the_real_gate_not_just_hidden_in_the_ui(): void
    {
        $student = $this->student();
        Sanctum::actingAs($this->superadmin());
        $id = $this->grant($student)->json('subscription.id');
        $this->postJson("/api/superadmin/subscriptions/{$id}/cancel", ['reason' => 'Trial over'])->assertOk();

        // The Hack Arena comes with the plan, and PlanGate is what every route that guards it asks.
        try {
            app(PlanGate::class)->requireHackathonAccess($student->fresh());
            $this->fail('A cancelled plan must close the Hack Arena.');
        } catch (PlanRequiredException $e) {
            $this->assertSame(PlanRequiredException::CODE_PLAN_REQUIRED, $e->errorCode);
            $this->assertSame(PlanGate::FEATURE_HACKATHONS, $e->feature);
        }

        Sanctum::actingAs($student->fresh());
        $this->getJson('/api/me/plan-signal')->assertOk()->assertJsonPath('plan.code', 'coder');
    }

    public function test_the_free_plan_row_itself_cannot_be_cancelled_into_nothing(): void
    {
        $student = $this->student();
        $free = $student->activeSubscription();
        Sanctum::actingAs($this->superadmin());

        $this->postJson("/api/superadmin/subscriptions/{$free->id}/cancel", ['reason' => 'because'])->assertOk();

        // Cancelling it just puts a fresh one back: the invariant "every student has a plan" holds.
        $this->assertSame('coder', $this->planOf($student));
        $this->assertNotSame($free->id, $student->fresh()->activeSubscription()->id);
    }

    public function test_cancelling_twice_is_refused(): void
    {
        $student = $this->student();
        Sanctum::actingAs($this->superadmin());
        $id = $this->grant($student)->json('subscription.id');
        $this->postJson("/api/superadmin/subscriptions/{$id}/cancel", ['reason' => 'first'])->assertOk();

        $this->postJson("/api/superadmin/subscriptions/{$id}/cancel", ['reason' => 'second'])->assertStatus(422);
    }

    public function test_cancelling_a_colleges_plan_needs_the_superadmins_password_and_ends_its_students_coverage(): void
    {
        $college = $this->college();
        $student = $this->student(['college_id' => $college->id]);
        $subscription = $college->activeSubscription();
        $this->assertSame('institution', $student->subscriptionCoverage()['source']);
        Sanctum::actingAs($this->superadmin());

        $this->postJson("/api/superadmin/subscriptions/{$subscription->id}/cancel", ['reason' => 'Contract ended'])
            ->assertStatus(422)->assertJsonValidationErrors('password');
        $this->postJson("/api/superadmin/subscriptions/{$subscription->id}/cancel", ['reason' => 'Contract ended', 'password' => 'wrong'])
            ->assertStatus(422)->assertJsonValidationErrors('password');
        $this->assertSame('active', $subscription->fresh()->status, 'a refused attempt cancels nothing');

        $this->postJson("/api/superadmin/subscriptions/{$subscription->id}/cancel", ['reason' => 'Contract ended', 'password' => self::PASSWORD])
            ->assertOk()->assertJsonPath('subscription.subscriber.type', 'college');

        $this->assertFalse($college->fresh()->hasActiveSubscription());
        $this->assertSame('coder', $this->planOf($student), 'their students fall back to the plan they hold themselves');
    }

    // ───────────────────────────── the list ─────────────────────────────

    public function test_the_list_shows_paid_and_institutional_plans_but_not_the_free_default(): void
    {
        $this->student();
        $this->student();
        $paid = $this->student(['name' => 'Priya Paid']);
        $this->college();
        $this->buy($paid, 'expert');

        Sanctum::actingAs($this->superadmin());
        $response = $this->getJson('/api/superadmin/subscriptions')->assertOk();

        $names = collect($response->json('subscriptions'))->pluck('plan.name')->sort()->values()->all();
        $this->assertSame(['Expert', 'Standard'], $names, 'the two students on the free plan are not listed');
        $this->assertSame(2, $response->json('pagination.total'));

        // With the free ones: the two free-plan students, the paying student (whose own free row was
        // replaced when they bought, so it is no longer running) and the college.
        $this->getJson('/api/superadmin/subscriptions?include_free=1')->assertOk()
            ->assertJsonPath('pagination.total', 4);
    }

    public function test_the_list_filters_by_state_audience_source_and_who(): void
    {
        $gifted = $this->student(['name' => 'Gita Gifted', 'email' => 'gita@example.com']);
        $bought = $this->student(['name' => 'Bala Bought', 'email' => 'bala@example.com']);
        $ended = $this->student(['name' => 'Eli Ended']);
        $this->college();
        $this->buy($bought, 'expert');
        Sanctum::actingAs($this->superadmin());
        $this->grant($gifted)->assertCreated();
        $endedId = $this->grant($ended)->json('subscription.id');
        $this->postJson("/api/superadmin/subscriptions/{$endedId}/cancel", ['reason' => 'refunded off-platform'])->assertOk();

        $names = fn (string $query) => collect($this->getJson("/api/superadmin/subscriptions?{$query}")->assertOk()->json('subscriptions'))
            ->pluck('subscriber.name')->sort()->values()->all();

        $this->assertSame(['Apex Institute', 'Bala Bought', 'Gita Gifted'], $names('state=active'));
        $this->assertSame(['Eli Ended'], $names('state=canceled'));
        $this->assertSame(['Gita Gifted'], $names('source=admin_grant&state=active'));
        $this->assertSame(['Bala Bought'], $names('source=purchase'));
        $this->assertSame(['Apex Institute'], $names('audience=institution'));
        $this->assertSame(['Gita Gifted'], $names('q=gita@example'));
        $this->assertSame(['Apex Institute'], $names('q=Apex'));
        $this->assertSame(['Bala Bought', 'Eli Ended', 'Gita Gifted'], $names('audience=individual&state=all'));
    }

    public function test_the_list_summary_counts_what_is_running_and_what_is_free_of_charge(): void
    {
        $this->college();
        $paying = $this->student();
        $this->buy($paying, 'expert');
        Sanctum::actingAs($this->superadmin());
        $this->grant($this->student())->assertCreated();
        $this->grant($this->student(), ['kind' => 'offline_payment', 'amount' => 1500, 'days' => 5])->assertCreated();

        $summary = $this->getJson('/api/superadmin/subscriptions')->assertOk()->json('summary');

        $this->assertSame(3, $summary['paid_individual']);
        $this->assertSame(1, $summary['complimentary'], 'only the gift — the offline payment brought money in');
        $this->assertSame(1, $summary['colleges']);
        $this->assertSame(1, $summary['ending_7_days'], 'the 5-day plan');
    }

    public function test_the_accounts_filter_bar_counts_follow_a_chosen_plan(): void
    {
        $payer = $this->student(['name' => 'Pia Payer']);
        $this->student(['name' => 'Fred Free']);
        $this->student(['name' => 'Gina Free']);
        $this->buy($payer, 'expert');
        User::factory()->create(['role' => User::ROLE_ADMIN_INTERNAL]);

        Sanctum::actingAs($this->superadmin());

        $totalOf = fn (string $q) => $this->getJson("/api/superadmin/users?{$q}")->assertOk()->json('total');
        $facets = fn (string $q) => $this->getJson("/api/superadmin/users/facets?{$q}")->assertOk();

        $everyone = $facets('')->json();
        $this->assertSame($totalOf(''), $everyone['total'], 'the All chip equals the whole directory');
        $this->assertSame($everyone['total'], array_sum($everyone['roles']));

        foreach (['paid', 'free', 'none'] as $plan) {
            $f = $facets("role=user&plan={$plan}");
            $expected = $totalOf("role=user&plan={$plan}");

            $this->assertSame($expected, $f->json('roles.user'), "Students chip, plan {$plan}");
            $this->assertSame($expected, $f->json('total'), "All chip, plan {$plan} (only the students on it are listed)");
        }

        $this->assertSame(1, $facets('role=user&plan=paid')->json('total'));
        $this->assertSame(2, $facets('role=user&plan=free')->json('total'));
        $this->assertSame(1, $facets('role=user&plan=paid')->json('roles.user'));
        $this->assertSame(1, $facets('role=user&plan=paid')->json('roles.admin_internal'), 'other roles are untouched — choosing their chip clears the plan');
    }

    public function test_a_plan_left_behind_by_a_deleted_account_is_not_running_and_is_not_counted(): void
    {
        $live = $this->college();
        $gone = $this->college();
        $goneStudent = $this->student(['name' => 'Gone Student']);
        $this->buy($goneStudent, 'expert');
        $this->buy($this->student(['name' => 'Still Here']), 'expert');

        // Deleted the way older code and one-off clean-ups did: the account goes, its subscription rows stay behind
        // (polymorphic owner: there is no foreign key to cascade).
        $gone->delete();
        $goneStudent->delete();

        Sanctum::actingAs($this->superadmin());
        $names = fn (string $query) => collect($this->getJson("/api/superadmin/subscriptions?{$query}")->assertOk()->json('subscriptions'))
            ->pluck('subscriber.name')->sort()->values()->all();

        $this->assertSame([$live->name, 'Still Here'], $names('state=active'), 'only plans that still govern an account are running');
        $this->assertContains('Deleted account', $names('state=all&include_free=1'), 'the history is still there under All');
        $this->assertNotContains('Deleted account', $names('state=active&include_free=1'));
        $this->assertNotContains('Deleted account', $names('ending_within=365'));

        $summary = $this->getJson('/api/superadmin/subscriptions')->assertOk()->json('summary');
        $this->assertSame(1, $summary['colleges'], 'the deleted college is not a college "with a running plan"');
        $this->assertSame(1, $summary['paid_individual'], 'nor is the deleted student a paying one');
    }

    public function test_a_mellow_academy_enrolment_runs_three_years_and_shows_up_wherever_paid_plans_do(): void
    {
        $student = $this->student(['name' => 'Anika Academy']);
        Sanctum::actingAs($this->superadmin());

        // No term given: the plan's own length — three years — is what the team means by Mellow Academy.
        $response = $this->postJson("/api/superadmin/users/{$student->id}/subscription", [
            'plan_code' => 'grandmaster',
            'kind' => 'offline_payment',
            'amount' => 60000,
            'reference' => 'NEFT-7781',
            'reason' => 'Mellow Academy fee received by bank transfer',
        ])->assertCreated()
            ->assertJsonPath('subscription.plan.code', 'grandmaster')
            ->assertJsonPath('subscription.plan.is_free', false)
            ->assertJsonPath('subscription.price_paid', 60000)
            ->assertJsonPath('subscription.complimentary', false);

        $subscription = Subscription::findOrFail($response->json('subscription.id'));
        $this->assertEqualsWithDelta(1095, now()->diffInDays($subscription->current_period_end, true), 1);
        $this->assertSame(1095, $subscription->meta['term_days']);
        $this->assertTrue($student->fresh()->effectiveEntitlements()['vault_access']);

        // A plan with no online price is still a PAID plan: it is not buried with the free Coder rows…
        $names = fn (string $query) => collect($this->getJson("/api/superadmin/subscriptions?{$query}")->assertOk()->json('subscriptions'))->pluck('subscriber.name')->all();
        $this->assertSame(['Anika Academy'], $names('state=active'));
        $this->assertSame(['Anika Academy'], $names('plan=grandmaster'));
        $this->assertSame(1, $this->getJson('/api/superadmin/subscriptions')->json('summary.paid_individual'));

        // …nor missing from the student directory's "any paid plan" filter.
        $paid = collect($this->getJson('/api/superadmin/users?role=user&plan=paid')->assertOk()->json('data'))->pluck('name')->all();
        $this->assertSame(['Anika Academy'], $paid);
    }

    public function test_student_search_for_the_grant_dialog_finds_by_name_or_email_and_reports_the_current_plan(): void
    {
        $this->student(['name' => 'Anika Rao', 'email' => 'anika@example.com']);
        $this->student(['name' => 'Someone Else']);
        Sanctum::actingAs($this->superadmin());

        $this->getJson('/api/superadmin/students/search?q=anika')->assertOk()
            ->assertJsonCount(1, 'students')
            ->assertJsonPath('students.0.email', 'anika@example.com')
            ->assertJsonPath('students.0.plan_name', 'Coder');

        $this->getJson('/api/superadmin/students/search?q=a')->assertOk()->assertJsonCount(0, 'students');
    }

    // ───────────────────────────── who may use it ─────────────────────────────

    public function test_nobody_but_a_superadmin_can_reach_any_of_it(): void
    {
        $student = $this->student();
        $subscription = $student->activeSubscription();

        foreach ([
            User::factory()->create(['role' => User::ROLE_ADMIN_INTERNAL, 'permissions' => User::PERMISSIONS_INTERNAL]),
            User::factory()->create(['role' => User::ROLE_ADMIN_MARKETING]),
            $this->student(),
        ] as $caller) {
            Sanctum::actingAs($caller);
            $this->getJson('/api/superadmin/subscriptions')->assertForbidden();
            $this->getJson('/api/superadmin/students/search?q=anything')->assertForbidden();
            $this->postJson("/api/superadmin/users/{$student->id}/subscription", ['plan_code' => 'grandmaster', 'kind' => 'complimentary', 'reason' => 'nope'])->assertForbidden();
            $this->postJson("/api/superadmin/subscriptions/{$subscription->id}/extend", ['days' => 5, 'reason' => 'nope'])->assertForbidden();
            $this->postJson("/api/superadmin/subscriptions/{$subscription->id}/cancel", ['reason' => 'nope'])->assertForbidden();
        }

        $this->assertSame('coder', $this->planOf($student));
    }

    // ───────────────────────────── the change signal ─────────────────────────────

    public function test_the_signal_moves_when_a_plan_runs_out_or_its_limits_are_edited(): void
    {
        $student = $this->student();
        Sanctum::actingAs($this->superadmin());
        $id = $this->grant($student, ['days' => 30])->json('subscription.id');

        Sanctum::actingAs($student->fresh());
        $granted = $this->getJson('/api/me/plan-signal')->json('signature');

        // Someone changes what Grandmaster includes: people already on it must hear about it.
        Plan::where('code', 'grandmaster')->first()->forceFill(['updated_at' => now()->addMinute()])->save();
        $edited = $this->getJson('/api/me/plan-signal')->json('signature');
        $this->assertNotSame($granted, $edited);

        // The end date passes with nobody doing anything.
        Subscription::whereKey($id)->update(['current_period_end' => now()->subMinute()]);
        $lapsed = $this->getJson('/api/me/plan-signal')->assertOk();
        $this->assertNotSame($edited, $lapsed->json('signature'));
        $this->assertNull($lapsed->json('plan'), 'a plan past its end date is no longer reported as held');
    }

    public function test_the_signal_works_for_a_tpo_and_is_inert_for_staff(): void
    {
        $college = $this->college();
        $tpo = User::factory()->create(['role' => User::ROLE_ADMIN_TPO, 'college_id' => $college->id]);
        Sanctum::actingAs($tpo);
        $this->getJson('/api/me/plan-signal')->assertOk()
            ->assertJsonPath('source', 'institution')
            ->assertJsonPath('plan.name', 'Standard');

        Sanctum::actingAs($this->superadmin());
        $this->getJson('/api/me/plan-signal')->assertOk()->assertJsonPath('source', 'none')->assertJsonPath('plan', null);
    }
}
