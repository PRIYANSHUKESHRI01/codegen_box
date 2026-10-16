<?php

namespace Tests\Feature;

use App\Mail\VaultReadyMail;
use App\Models\User;
use App\Models\VaultProfile;
use App\Models\VaultSyncEvent;
use App\Services\Vault\VaultRefreshService;
use App\Services\Vault\VaultService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Tests\Concerns\CreatesReadinessFixtures;
use Tests\TestCase;

/**
 * Who is in the Vault, and when. The rule: reach the bar and you are eligible;
 * say yes (once, before or after) and you are live; fall clearly below it and you
 * come off; a hire is permanent. Every state is one function of a handful of facts
 * on the profile row, so these tests walk the facts rather than the plumbing.
 */
class VaultEligibilityTest extends TestCase
{
    use CreatesReadinessFixtures;
    use RefreshDatabase;

    private VaultService $vault;

    protected function setUp(): void
    {
        parent::setUp();

        Queue::fake();
        Mail::fake();
        $this->vault = app(VaultService::class);
    }

    /** What ReadinessScoreService hands over, as far as the Vault is concerned. */
    private function breakdown(int $score): array
    {
        return [
            'score' => $score,
            'tier' => $score >= 75 ? 'Placement Ready' : ($score >= 45 ? 'In Progress' : 'Needs Training'),
            'components' => [['key' => 'interview_performance', 'label' => 'AI Interviews', 'score' => $score, 'weight_percent' => 20, 'contribution' => 0, 'detail' => 'x']],
        ];
    }

    private function score(User $student, int $score): ?VaultProfile
    {
        return $this->vault->applyReadiness($student, $this->breakdown($score));
    }

    // ───────────────────────────── getting in ─────────────────────────────

    public function test_a_student_below_the_bar_with_no_profile_costs_nothing(): void
    {
        $student = $this->readinessStudent();

        $this->assertNull($this->score($student, 59));
        $this->assertSame(0, VaultProfile::count());
    }

    public function test_reaching_the_bar_makes_a_student_eligible_but_nothing_is_shared_yet(): void
    {
        $student = $this->readinessStudent();

        $profile = $this->score($student, 60);

        $this->assertTrue($profile->is_eligible);
        $this->assertSame(VaultProfile::STATUS_PENDING_CONSENT, $profile->visibility_status);
        $this->assertNotNull($profile->qualified_at);
        $this->assertSame(60, $profile->readiness_score);
        $this->assertSame(0, VaultSyncEvent::count(), 'without consent nothing may be queued for Mellow Vault');
    }

    public function test_the_ready_email_is_sent_once_the_first_time_only(): void
    {
        $student = $this->readinessStudent();

        $this->score($student, 61);
        $this->score($student, 70);
        $this->score($student, 80);

        Mail::assertSent(VaultReadyMail::class, 1);
    }

    public function test_a_student_carried_over_from_the_talent_pool_is_still_told_once_to_confirm(): void
    {
        $student = $this->readinessStudent();
        VaultProfile::create([
            'user_id' => $student->id, 'visibility_status' => VaultProfile::STATUS_PENDING_CONSENT, 'is_eligible' => true,
            'qualification_source' => VaultProfile::SOURCE_LEGACY_CONTEST, 'qualified_at' => now()->subMonth(),
        ]);

        $this->score($student, 70);
        $this->score($student, 72);

        Mail::assertSent(VaultReadyMail::class, 1);
    }

    public function test_a_carried_over_student_who_is_no_longer_ready_is_not_told_they_are(): void
    {
        $student = $this->readinessStudent();
        VaultProfile::create(['user_id' => $student->id, 'visibility_status' => VaultProfile::STATUS_PENDING_CONSENT, 'is_eligible' => true]);

        $profile = $this->score($student, 20);

        $this->assertFalse($profile->is_eligible);
        Queue::assertNothingPushed();
    }

    public function test_nobody_is_emailed_who_cannot_act_on_it(): void
    {
        $hired = $this->readinessStudent();
        $held = $this->readinessStudent();
        VaultProfile::create(['user_id' => $hired->id, 'visibility_status' => 'hired', 'is_eligible' => true, 'hired_at' => now()]);
        VaultProfile::create(['user_id' => $held->id, 'visibility_status' => 'hidden_by_mellow', 'is_eligible' => true, 'hidden_by_staff_at' => now()]);

        $this->score($hired, 90);
        $this->score($held, 90);

        Queue::assertNothingPushed();
    }

    public function test_the_threshold_comes_from_config(): void
    {
        config(['vault.enter_score' => 70, 'vault.exit_score' => 65]);
        $student = $this->readinessStudent();

        $this->assertNull($this->score($student, 69));
        $this->assertTrue($this->score($student, 70)->is_eligible);
    }

    public function test_the_exit_line_can_never_sit_above_the_entry_line(): void
    {
        config(['vault.enter_score' => 60, 'vault.exit_score' => 90]);

        $this->assertSame(['enter' => 60, 'exit' => 60], $this->vault->thresholds());
    }

    // ───────────────────────────── hysteresis ─────────────────────────────

    public function test_a_student_who_dips_a_little_stays_in_and_one_who_drops_clearly_leaves(): void
    {
        $student = $this->readinessStudent();
        $this->score($student, 62);

        $this->assertTrue($this->score($student, 56)->is_eligible, '56 is below 60 but above the exit line of 55 — no flapping');
        $this->assertTrue($this->score($student, 55)->is_eligible, 'the exit line itself still keeps you');

        $left = $this->score($student, 54);
        $this->assertFalse($left->is_eligible);
        $this->assertSame(VaultProfile::STATUS_NOT_READY, $left->visibility_status);
        $this->assertNotNull($left->left_at);
    }

    public function test_after_leaving_a_student_must_climb_back_to_the_full_bar(): void
    {
        $student = $this->readinessStudent();
        $this->score($student, 62);
        $this->score($student, 50);

        $this->assertFalse($this->score($student, 58)->is_eligible, 'between the lines you stay out until you reach 60 again');
        $this->assertTrue($this->score($student, 60)->is_eligible);
    }

    public function test_peak_readiness_only_ever_goes_up(): void
    {
        $student = $this->readinessStudent();
        $this->score($student, 80);

        $this->assertSame(80, $this->score($student, 61)->peak_readiness);
    }

    // ───────────────────────────── consent ─────────────────────────────

    public function test_consent_makes_an_eligible_student_live_and_queues_exactly_one_listing(): void
    {
        $student = $this->readinessStudent();
        $this->score($student, 70);

        $profile = $this->vault->giveConsent($student);

        $this->assertSame(VaultProfile::STATUS_VISIBLE, $profile->visibility_status);
        $this->assertSame(1, VaultSyncEvent::where('type', VaultSyncEvent::TYPE_UPSERT)->count());
    }

    public function test_consent_given_ahead_of_time_lists_the_student_the_moment_they_become_ready(): void
    {
        $student = $this->readinessStudent();

        $early = $this->vault->giveConsent($student);
        $this->assertSame(VaultProfile::STATUS_NOT_READY, $early->visibility_status, 'a yes is remembered, but not ready means not listed');
        $this->assertSame(0, VaultSyncEvent::count());

        $profile = $this->score($student, 63);

        $this->assertSame(VaultProfile::STATUS_VISIBLE, $profile->visibility_status, 'standing consent: no second click');
        $this->assertSame(1, VaultSyncEvent::where('type', VaultSyncEvent::TYPE_UPSERT)->count());
    }

    public function test_withdrawing_consent_takes_the_student_off_and_consenting_again_puts_them_back(): void
    {
        $student = $this->readinessStudent();
        $this->score($student, 70);
        $this->vault->giveConsent($student);

        $hidden = $this->vault->withdrawConsent($student);
        $this->assertSame(VaultProfile::STATUS_HIDDEN_BY_CANDIDATE, $hidden->visibility_status);

        $this->assertSame(VaultProfile::STATUS_VISIBLE, $this->vault->giveConsent($student)->visibility_status);
    }

    public function test_a_withdrawn_student_stays_hidden_however_high_the_score_goes(): void
    {
        $student = $this->readinessStudent();
        $this->score($student, 70);
        $this->vault->giveConsent($student);
        $this->vault->withdrawConsent($student);

        $this->assertSame(VaultProfile::STATUS_HIDDEN_BY_CANDIDATE, $this->score($student, 95)->visibility_status);
    }

    public function test_falling_out_keeps_the_consent_and_climbing_back_relists_automatically(): void
    {
        $student = $this->readinessStudent();
        $this->score($student, 70);
        $this->vault->giveConsent($student);

        $this->assertSame(VaultProfile::STATUS_NOT_READY, $this->score($student, 40)->visibility_status);
        $this->assertSame(VaultProfile::STATUS_VISIBLE, $this->score($student, 66)->visibility_status);
    }

    // ───────────────────────────── staff, hires, blocking ─────────────────────────────

    public function test_a_staff_hide_overrides_a_consenting_students_listing_and_unhide_restores_it(): void
    {
        $student = $this->readinessStudent();
        $staff = User::factory()->create(['role' => User::ROLE_ADMIN_INTERNAL, 'permissions' => [User::PERM_VAULT]]);
        $this->score($student, 70);
        $profile = $this->vault->giveConsent($student);

        $hidden = $this->vault->staffHide($profile, $staff, 'Profile photo issue');
        $this->assertSame(VaultProfile::STATUS_HIDDEN_BY_MELLOW, $hidden->visibility_status);
        $this->assertSame('Profile photo issue', $hidden->hidden_reason);

        $this->assertSame(VaultProfile::STATUS_VISIBLE, $this->vault->staffUnhide($hidden)->visibility_status);
    }

    public function test_unhiding_never_overrides_the_students_own_withdrawal(): void
    {
        $student = $this->readinessStudent();
        $staff = User::factory()->create(['role' => User::ROLE_ADMIN_INTERNAL, 'permissions' => [User::PERM_VAULT]]);
        $this->score($student, 70);
        $profile = $this->vault->giveConsent($student);
        $profile = $this->vault->staffHide($profile, $staff);
        $this->vault->withdrawConsent($student);

        $this->assertSame(VaultProfile::STATUS_HIDDEN_BY_CANDIDATE, $this->vault->staffUnhide($profile->fresh())->visibility_status);
    }

    public function test_a_hire_is_permanent(): void
    {
        $student = $this->readinessStudent();
        $this->score($student, 70);
        $profile = $this->vault->giveConsent($student);

        $hired = $this->vault->markHired($profile, VaultProfile::HIRED_VIA_VAULT, null, 'Acme Corp');

        $this->assertSame(VaultProfile::STATUS_HIRED, $hired->visibility_status);
        $this->assertSame('Acme Corp', $hired->hired_employer_name);
        $this->assertSame(VaultProfile::STATUS_HIRED, $this->score($student, 99)->visibility_status, 'no score can bring a hired student back');
        $this->assertSame(VaultProfile::STATUS_HIRED, $this->vault->giveConsent($student)->visibility_status);
    }

    public function test_a_blocked_account_comes_off_immediately_and_returns_when_unblocked(): void
    {
        $student = $this->readinessStudent();
        $this->score($student, 70);
        $this->vault->giveConsent($student);
        $profileId = VaultProfile::where('user_id', $student->id)->value('id');

        $student->forceFill(['is_blocked' => true])->save();
        $this->assertSame(VaultProfile::STATUS_HIDDEN_BY_MELLOW, VaultProfile::find($profileId)->visibility_status);

        $student->forceFill(['is_blocked' => false])->save();
        $this->assertSame(VaultProfile::STATUS_VISIBLE, VaultProfile::find($profileId)->visibility_status);
    }

    public function test_only_students_ever_get_a_profile(): void
    {
        $tpo = User::factory()->create(['role' => User::ROLE_ADMIN_TPO]);

        $this->assertNull($this->score($tpo, 99));
        $this->assertSame(0, VaultProfile::count());
    }

    // ───────────────────────────── the real pipeline ─────────────────────────────

    public function test_a_genuinely_strong_student_is_picked_up_by_the_refresh(): void
    {
        $student = $this->strongStudent();

        $stats = app(VaultRefreshService::class)->refresh([$student]);

        $profile = VaultProfile::where('user_id', $student->id)->firstOrFail();
        $this->assertSame(1, $stats['scored']);
        $this->assertTrue($profile->is_eligible);
        $this->assertGreaterThanOrEqual(60, $profile->readiness_score);
        $this->assertNotEmpty($profile->readiness_components);
    }

    public function test_the_refresh_command_scores_recently_seen_students_only(): void
    {
        $seen = $this->strongStudent(['last_seen_at' => now()->subMinutes(5)]);
        $away = $this->strongStudent(['last_seen_at' => now()->subDays(10)]);

        $this->artisan('readiness:refresh')->assertSuccessful();

        $this->assertTrue(VaultProfile::where('user_id', $seen->id)->exists());
        $this->assertFalse(VaultProfile::where('user_id', $away->id)->exists());

        $this->artisan('readiness:refresh --all')->assertSuccessful();
        $this->assertTrue(VaultProfile::where('user_id', $away->id)->exists());
    }

    public function test_a_failure_for_one_student_does_not_stop_the_rest(): void
    {
        $a = $this->strongStudent();
        $b = $this->strongStudent();

        $stats = app(VaultRefreshService::class)->refresh([$a, $b]);

        $this->assertSame(['scored' => 2, 'errors' => 0], $stats);
        $this->assertSame(2, VaultProfile::count());
    }
}
