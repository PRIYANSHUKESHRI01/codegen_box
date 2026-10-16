<?php

namespace Tests\Feature;

use App\Mail\VaultReadyMail;
use App\Models\College;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use App\Models\VaultProfile;
use App\Models\VaultSyncEvent;
use App\Services\PurchaseQuoteService;
use App\Services\SubscriptionService;
use App\Services\Vault\VaultSyncService;
use Database\Seeders\PlanSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\CreatesReadinessFixtures;
use Tests\TestCase;

/**
 * The Vault — being hired through Mellow Vault — comes with Expert (and Grandmaster, the Mellow Academy plan) for
 * individual students, and with a college's plan for the students that college covers. Earning the readiness score is open to everyone;
 * only being LISTED is gated. These tests pin the shape of that: what a student on each plan sees, that an
 * upgrade unlocks at once without a retake, and that a plan ending takes a live student off Mellow Vault.
 */
class VaultPlanGateTest extends TestCase
{
    use CreatesReadinessFixtures;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Queue::fake();
        Mail::fake();
        $this->seed(PlanSeeder::class);
        config(['vault.sync_url' => 'https://vault.example.test/hook', 'vault.sync_secret' => 'secret']);
    }

    /** Expert is bought at checkout; Grandmaster (Mellow Academy) is never sold online — the superadmin grants it. */
    private function buy(User $student, string $code): void
    {
        if ($code === Plan::CODE_GRANDMASTER) {
            $plan = Plan::where('code', $code)->firstOrFail();
            app(SubscriptionService::class)->grantIndividualPlan($student, $plan, User::factory()->create(['role' => User::ROLE_SUPERADMIN]), [
                'days' => (int) $plan->duration_days,
                'kind' => 'complimentary',
                'reason' => 'Test: enrolled in Mellow Academy',
            ]);

            return;
        }

        app(SubscriptionService::class)->purchase($student, app(PurchaseQuoteService::class)->quote($student, $code));
    }

    /** A student who is comfortably over the line, on the free plan (created after the plans exist, as in production). */
    private function readyStudent(?string $plan = null): User
    {
        $student = $this->strongStudent();

        if ($plan !== null) {
            $this->buy($student, $plan);
        }

        return $student->fresh();
    }

    private function profileOf(User $student): VaultProfile
    {
        return VaultProfile::where('user_id', $student->id)->firstOrFail();
    }

    private function expertSubscription(User $student): Subscription
    {
        return Subscription::where('subscriber_type', User::class)->where('subscriber_id', $student->id)
            ->whereHas('plan', fn ($q) => $q->where('code', Plan::CODE_EXPERT))->firstOrFail();
    }

    // ───────────────────────────── what each plan sees ─────────────────────────────

    public function test_a_ready_student_on_the_free_plan_sees_their_standing_and_an_upgrade_prompt_but_cannot_join(): void
    {
        $student = $this->readyStudent();
        Sanctum::actingAs($student);

        $this->getJson('/api/me/vault')->assertOk()
            ->assertJsonPath('access', false)
            ->assertJsonPath('profile.status', 'upgrade_required')
            ->assertJsonPath('profile.is_eligible', true)
            ->assertJsonPath('readiness.points_needed', 0);

        $this->postJson('/api/me/vault/consent')->assertStatus(402)
            ->assertJsonPath('code', 'plan_required')
            ->assertJsonPath('feature', 'vault');

        $this->assertNull($this->profileOf($student)->consent_given_at, 'a refused yes is not recorded');
        $this->assertSame(0, VaultSyncEvent::count());
        Mail::assertNotSent(VaultReadyMail::class);
    }

    public function test_expert_can_join(): void
    {
        $student = $this->readyStudent('expert');
        Sanctum::actingAs($student);

        $this->getJson('/api/me/vault')->assertOk()->assertJsonPath('access', true)->assertJsonPath('profile.status', 'pending_consent');
        $this->postJson('/api/me/vault/consent')->assertOk()->assertJsonPath('profile.status', 'visible');
    }

    public function test_a_mellow_academy_student_can_join_too(): void
    {
        $student = $this->readyStudent('grandmaster');
        Sanctum::actingAs($student);

        $this->getJson('/api/me/vault')->assertOk()->assertJsonPath('access', true)->assertJsonPath('profile.status', 'pending_consent');
        $this->postJson('/api/me/vault/consent')->assertOk()->assertJsonPath('profile.status', 'visible');
    }

    public function test_a_student_below_the_line_on_any_plan_is_simply_not_ready_and_a_not_ready_one_cannot_pre_consent_without_the_plan(): void
    {
        $free = $this->readinessStudent();
        Sanctum::actingAs($free);

        $this->getJson('/api/me/vault')->assertOk()->assertJsonPath('access', false)->assertJsonPath('profile', null);
        $this->postJson('/api/me/vault/consent')->assertStatus(402);
    }

    public function test_withdrawing_is_never_blocked_by_the_plan(): void
    {
        $student = $this->readyStudent('expert');
        Sanctum::actingAs($student);
        $this->postJson('/api/me/vault/consent')->assertOk();
        $this->expertSubscription($student)->update(['current_period_end' => now()->subMinute()]);

        $this->deleteJson('/api/me/vault/consent')->assertOk();
        $this->assertFalse($this->profileOf($student)->hasConsent());
    }

    // ───────────────────────────── upgrading ─────────────────────────────

    public function test_upgrading_unlocks_it_at_once_with_the_standing_kept_and_no_retake(): void
    {
        $student = $this->readyStudent();
        Sanctum::actingAs($student);
        $this->getJson('/api/me/vault')->assertOk(); // the standing is recorded while on the free plan
        $before = $this->profileOf($student);
        $this->assertSame('upgrade_required', $before->visibility_status);

        $this->buy($student, 'expert'); // no request from the student, no scheduled job

        $after = $this->profileOf($student);
        $this->assertSame('pending_consent', $after->visibility_status, 'the purchase itself moves the profile on');
        $this->assertEquals($before->qualified_at, $after->qualified_at, 'the original qualification is kept');

        $this->postJson('/api/me/vault/consent')->assertOk()->assertJsonPath('profile.status', 'visible');
    }

    // ───────────────────────────── a plan ending ─────────────────────────────

    private function liveOnMellowVault(User $student): void
    {
        Sanctum::actingAs($student);
        $this->postJson('/api/me/vault/consent')->assertOk();
        Http::fake(['*' => Http::response([], 200)]);
        app(VaultSyncService::class)->deliverDue();
        $this->assertNotNull($this->profileOf($student)->vault_listed_at, 'sanity: Mellow Vault holds the profile');
    }

    public function test_when_the_plan_ends_a_live_student_comes_off_at_once_and_mellow_vault_is_told(): void
    {
        $student = $this->readyStudent('expert');
        $this->liveOnMellowVault($student);

        $this->expertSubscription($student)->update(['current_period_end' => now()->subMinute()]);

        $profile = $this->profileOf($student);
        $this->assertSame('upgrade_required', $profile->visibility_status);
        $this->assertTrue($profile->hasConsent(), 'the yes is remembered for when they come back');
        $this->assertSame('plan_ended', VaultSyncEvent::where('type', VaultSyncEvent::TYPE_WITHDRAW)->value('reason'));

        $company = \App\Models\Company::create(['name' => 'Acme', 'slug' => 'acme']);
        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_ADMIN_COMPANY, 'company_id' => $company->id]));
        $this->getJson('/api/company/vault')->assertOk()->assertJsonCount(0, 'profiles.data');
    }

    public function test_the_nightly_expiry_job_takes_a_lapsed_student_off_too(): void
    {
        $student = $this->readyStudent('expert');
        $this->liveOnMellowVault($student);

        // A bulk update raises no model events — exactly what the nightly expiry's own query does.
        Subscription::whereKey($this->expertSubscription($student)->id)->update(['current_period_end' => now()->subDay()]);
        $this->assertSame('visible', $this->profileOf($student)->visibility_status, 'sanity: nothing has noticed yet');

        $this->assertGreaterThanOrEqual(1, app(SubscriptionService::class)->expireDue());

        $this->assertSame('upgrade_required', $this->profileOf($student)->visibility_status);
        $this->assertSame(1, VaultSyncEvent::where('type', VaultSyncEvent::TYPE_WITHDRAW)->where('reason', 'plan_ended')->count());
    }

    public function test_renewing_relists_them_automatically_because_their_yes_was_remembered(): void
    {
        $student = $this->readyStudent('expert');
        $this->liveOnMellowVault($student);
        $this->expertSubscription($student)->update(['current_period_end' => now()->subMinute()]);
        $this->assertSame('upgrade_required', $this->profileOf($student)->visibility_status);

        $this->buy($student->fresh(), 'expert');

        $this->assertSame('visible', $this->profileOf($student)->visibility_status);
        $this->assertSame(2, VaultSyncEvent::where('type', VaultSyncEvent::TYPE_UPSERT)->count(), 'listed again');
    }

    public function test_a_refund_that_cancels_the_plan_takes_them_off(): void
    {
        $student = $this->readyStudent('expert');
        $this->liveOnMellowVault($student);

        app(SubscriptionService::class)->revokePurchase($student, [$this->expertSubscription($student)->id]);

        $this->assertSame('upgrade_required', $this->profileOf($student)->visibility_status);
    }

    // ───────────────────────────── a college's plan ─────────────────────────────

    private function collegeStudent(bool $planIncludesVault): User
    {
        $college = College::create(['name' => 'Apex', 'short_code' => 'APEX'.random_int(100, 999), 'city' => 'X', 'state' => 'Y', 'tier' => 'Pro Campus', 'placement_rate' => 80]);
        $plan = Plan::where('code', 'pro-campus')->firstOrFail();
        $plan->forceFill(['vault_access' => $planIncludesVault])->save();
        app(SubscriptionService::class)->assignInstitutionPlan($college, $plan, User::factory()->create(['role' => User::ROLE_SUPERADMIN]));

        return $this->strongStudent(['college_id' => $college->id])->fresh();
    }

    public function test_a_student_covered_by_a_college_plan_that_includes_the_vault_can_join_without_buying_anything(): void
    {
        $student = $this->collegeStudent(true);
        Sanctum::actingAs($student);

        $this->getJson('/api/me/vault')->assertOk()->assertJsonPath('access', true);
        $this->postJson('/api/me/vault/consent')->assertOk()->assertJsonPath('profile.status', 'visible');
    }

    public function test_a_college_plan_without_the_vault_does_not_grant_it(): void
    {
        $student = $this->collegeStudent(false);
        Sanctum::actingAs($student);

        $this->getJson('/api/me/vault')->assertOk()->assertJsonPath('access', false);
        $this->postJson('/api/me/vault/consent')->assertStatus(402);
    }

    // ───────────────────────────── the scheduled refresh ─────────────────────────────

    public function test_the_refresh_records_a_free_student_as_ready_but_never_emails_or_lists_them(): void
    {
        $student = $this->readyStudent();
        $student->forceFill(['last_seen_at' => now()])->save();

        $this->artisan('readiness:refresh')->assertSuccessful();

        $this->assertSame('upgrade_required', $this->profileOf($student)->visibility_status);
        Mail::assertNotSent(VaultReadyMail::class);
        $this->assertSame(0, VaultSyncEvent::count());
    }

    public function test_a_student_who_upgrades_is_told_they_are_ready_once_the_refresh_runs(): void
    {
        $student = $this->readyStudent();
        $student->forceFill(['last_seen_at' => now()])->save();
        $this->artisan('readiness:refresh')->assertSuccessful();
        Mail::assertNotSent(VaultReadyMail::class);

        $this->buy($student, 'expert');
        $this->artisan('readiness:refresh')->assertSuccessful();

        Mail::assertSent(VaultReadyMail::class, 1);
    }
}
