<?php

namespace Tests\Feature;

use App\Mail\VaultHireOfferMail;
use App\Mail\VaultInterestMail;
use App\Mail\VaultInterviewResponseMail;
use App\Mail\VaultOutreachMail;
use App\Models\ActivityLog;
use App\Models\Company;
use App\Models\User;
use App\Models\VaultInquiry;
use App\Models\VaultProfile;
use App\Models\VaultSyncEvent;
use Database\Seeders\PlanSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\CreatesReadinessFixtures;
use Tests\TestCase;

/** Every screen of the Vault, from each of the four seats: the student, a hiring partner, Mellow staff, and Mellow Vault itself. */
class VaultEndpointsTest extends TestCase
{
    use CreatesReadinessFixtures;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Queue::fake();
        Mail::fake();
    }

    private function company(string $name = 'Acme'): array
    {
        $company = Company::create(['name' => $name, 'slug' => str($name)->slug().'-'.uniqid()]);

        return [$company, User::factory()->create(['role' => User::ROLE_ADMIN_COMPANY, 'company_id' => $company->id])];
    }

    /** A student who is live in the Vault, set up directly (the state machine has its own tests). */
    private function liveProfile(array $user = [], array $profile = []): VaultProfile
    {
        $student = $this->readinessStudent($user);

        return VaultProfile::create($profile + [
            'user_id' => $student->id,
            'visibility_status' => VaultProfile::STATUS_VISIBLE,
            'is_eligible' => true,
            'readiness_score' => 70,
            'peak_readiness' => 70,
            'readiness_tier' => 'In Progress',
            'readiness_components' => [['key' => 'interview_performance', 'label' => 'AI Interviews', 'score' => 70, 'weight_percent' => 20, 'contribution' => 14, 'detail' => 'x']],
            'qualified_at' => now()->subDay(),
            'consent_given_at' => now()->subDay(),
        ]);
    }

    private function staff(array $permissions = [User::PERM_VAULT]): User
    {
        return User::factory()->create(['role' => User::ROLE_ADMIN_INTERNAL, 'permissions' => $permissions]);
    }

    // ═════════════════════════════ the student ═════════════════════════════

    public function test_a_newcomer_sees_their_score_and_how_far_it_is_from_the_bar(): void
    {
        Sanctum::actingAs($this->readinessStudent());

        $this->getJson('/api/me/vault')->assertOk()
            ->assertJsonPath('profile', null)
            ->assertJsonPath('readiness.score', 0)
            ->assertJsonPath('readiness.threshold', 60)
            ->assertJsonPath('readiness.points_needed', 60)
            ->assertJsonCount(7, 'readiness.components')
            ->assertJsonPath('mellow_vault_connected', false);
    }

    public function test_opening_the_page_notices_a_student_who_has_become_ready(): void
    {
        $student = $this->strongStudent();
        Sanctum::actingAs($student);

        $response = $this->getJson('/api/me/vault')->assertOk()
            ->assertJsonPath('profile.status', 'pending_consent')
            ->assertJsonPath('profile.is_eligible', true)
            ->assertJsonPath('profile.consent.given', false)
            ->assertJsonPath('readiness.points_needed', 0);

        $this->assertGreaterThanOrEqual(60, $response->json('readiness.score'));
        $this->assertNotEmpty($response->json('shared_fields'));
        $this->assertNotEmpty($response->json('never_shared'));
    }

    public function test_the_consent_screen_never_promises_less_than_is_shared(): void
    {
        $listed = implode(' ', \App\Http\Controllers\Api\StudentVaultController::SHARED_FIELDS);

        foreach (['email', 'resume', 'readiness', 'GitHub', 'CGPA'] as $field) {
            $this->assertStringContainsString($field, $listed);
        }
        $this->assertStringContainsString('phone', implode(' ', \App\Http\Controllers\Api\StudentVaultController::NEVER_SHARED));
    }

    public function test_one_click_of_consent_makes_a_ready_student_live_and_queues_the_hand_off(): void
    {
        $student = $this->strongStudent();
        Sanctum::actingAs($student);
        $this->getJson('/api/me/vault')->assertOk();

        $this->postJson('/api/me/vault/consent')->assertOk()
            ->assertJsonPath('profile.status', 'visible')
            ->assertJsonPath('profile.consent.given', true);

        $this->assertSame(1, VaultSyncEvent::where('type', VaultSyncEvent::TYPE_UPSERT)->count());
    }

    public function test_a_student_can_say_yes_before_they_are_ready_and_nothing_is_shared_until_they_are(): void
    {
        Sanctum::actingAs($this->readinessStudent());

        $this->postJson('/api/me/vault/consent')->assertOk()
            ->assertJsonPath('profile.status', 'not_ready')
            ->assertJsonPath('profile.consent.given', true);

        $this->assertSame(0, VaultSyncEvent::count());
    }

    public function test_withdrawing_consent_takes_effect_at_once(): void
    {
        $profile = $this->liveProfile();
        Sanctum::actingAs($profile->user);

        $this->deleteJson('/api/me/vault/consent')->assertOk()
            ->assertJsonPath('profile.status', 'hidden_by_candidate')
            ->assertJsonPath('profile.consent.given', false);

        [, $companyUser] = $this->company();
        Sanctum::actingAs($companyUser);
        $this->getJson('/api/company/vault')->assertOk()->assertJsonCount(0, 'profiles.data');
    }

    public function test_the_free_plan_cannot_join_the_vault_but_still_sees_its_score(): void
    {
        $this->seed(PlanSeeder::class);
        $student = $this->strongStudent(); // created after the plans exist: on the free Coder plan
        Sanctum::actingAs($student);

        $this->getJson('/api/me/vault')->assertOk()->assertJsonPath('access', false)->assertJsonPath('profile.status', 'upgrade_required');
        $this->postJson('/api/me/vault/consent')->assertStatus(402)->assertJsonPath('feature', 'vault');
    }

    public function test_a_hired_student_cannot_change_their_consent(): void
    {
        $profile = $this->liveProfile(profile: ['hired_at' => now(), 'hired_via' => 'aptrun_partner', 'visibility_status' => 'hired']);
        Sanctum::actingAs($profile->user);

        $this->postJson('/api/me/vault/consent')->assertStatus(422);
        $this->deleteJson('/api/me/vault/consent')->assertStatus(422);
    }

    public function test_only_students_have_a_vault_page(): void
    {
        [, $companyUser] = $this->company();
        Sanctum::actingAs($companyUser);

        $this->getJson('/api/me/vault')->assertForbidden();
    }

    public function test_a_student_can_accept_or_decline_an_interview_but_only_their_own(): void
    {
        [$company, $companyUser] = $this->company();
        $profile = $this->liveProfile();
        $inquiry = VaultInquiry::create([
            'vault_profile_id' => $profile->id, 'company_id' => $company->id, 'initiated_by' => $companyUser->id,
            'status' => VaultInquiry::STATUS_INTERVIEW_SCHEDULED, 'interview_scheduled_at' => now()->addDays(2), 'interview_mode' => 'online', 'interview_location' => 'meet.example',
        ]);

        Sanctum::actingAs($this->liveProfile()->user);
        $this->postJson("/api/me/vault/inquiries/{$inquiry->id}/respond", ['decision' => 'accept'])->assertNotFound();

        Sanctum::actingAs($profile->user);
        $this->postJson("/api/me/vault/inquiries/{$inquiry->id}/respond", ['decision' => 'decline'])->assertOk();

        $this->assertSame(VaultInquiry::STATUS_DECLINED_BY_CANDIDATE, $inquiry->fresh()->status);
        Mail::assertSent(VaultInterviewResponseMail::class);
    }

    public function test_the_students_page_lists_hiring_partner_activity(): void
    {
        [$company, $companyUser] = $this->company('Globex');
        $profile = $this->liveProfile();
        VaultInquiry::create(['vault_profile_id' => $profile->id, 'company_id' => $company->id, 'initiated_by' => $companyUser->id, 'status' => 'interested']);
        Sanctum::actingAs($profile->user);

        $this->getJson('/api/me/vault')->assertOk()->assertJsonPath('inquiries.0.company.name', 'Globex');
    }

    // ═════════════════════════════ a hiring partner ═════════════════════════════

    public function test_a_company_sees_only_live_students_ranked_by_readiness(): void
    {
        [, $companyUser] = $this->company();
        $low = $this->liveProfile(['name' => 'Low'], ['readiness_score' => 62]);
        $high = $this->liveProfile(['name' => 'High'], ['readiness_score' => 91]);
        $mid = $this->liveProfile(['name' => 'Mid'], ['readiness_score' => 75]);
        $this->liveProfile(['name' => 'Pending'], ['visibility_status' => 'pending_consent', 'readiness_score' => 99]);
        $this->liveProfile(['name' => 'Hidden'], ['visibility_status' => 'hidden_by_candidate', 'readiness_score' => 99]);
        $this->liveProfile(['name' => 'NotReady'], ['visibility_status' => 'not_ready', 'readiness_score' => 30]);
        Sanctum::actingAs($companyUser);

        $ids = collect($this->getJson('/api/company/vault')->assertOk()->json('profiles.data'))->pluck('id')->all();

        $this->assertSame([$high->id, $mid->id, $low->id], $ids);
    }

    public function test_a_company_can_set_a_minimum_readiness(): void
    {
        [, $companyUser] = $this->company();
        $this->liveProfile([], ['readiness_score' => 62]);
        $strong = $this->liveProfile([], ['readiness_score' => 88]);
        Sanctum::actingAs($companyUser);

        $ids = collect($this->getJson('/api/company/vault?min_readiness=80')->assertOk()->json('profiles.data'))->pluck('id')->all();

        $this->assertSame([$strong->id], $ids);
    }

    public function test_a_fuller_profile_breaks_a_tie_on_readiness_and_complete_sort_can_flip_the_order(): void
    {
        [, $companyUser] = $this->company();
        $thin = $this->liveProfile(['profile_completion_percent' => 10], ['readiness_score' => 70]);
        $full = $this->liveProfile(['profile_completion_percent' => 90], ['readiness_score' => 70]);
        $stronger = $this->liveProfile(['profile_completion_percent' => 5], ['readiness_score' => 80]);
        Sanctum::actingAs($companyUser);

        $byReadiness = collect($this->getJson('/api/company/vault')->json('profiles.data'))->pluck('id')->all();
        $byCompleteness = collect($this->getJson('/api/company/vault?sort=complete')->json('profiles.data'))->pluck('id')->all();

        $this->assertSame([$stronger->id, $full->id, $thin->id], $byReadiness);
        $this->assertSame([$full->id, $thin->id, $stronger->id], $byCompleteness);
    }

    public function test_search_matches_a_skill_keyword_not_just_the_name(): void
    {
        [, $companyUser] = $this->company();
        $matching = $this->liveProfile(['name' => 'Priya Sharma', 'skills' => ['Laravel', 'React']]);
        $other = $this->liveProfile(['name' => 'Rohit Verma', 'skills' => ['Python', 'Django']]);
        Sanctum::actingAs($companyUser);

        $ids = collect($this->getJson('/api/company/vault?search=laravel')->assertOk()->json('profiles.data'))->pluck('id');

        $this->assertTrue($ids->contains($matching->id));
        $this->assertFalse($ids->contains($other->id));
    }

    public function test_a_company_never_sees_contact_details_or_the_integration_plumbing(): void
    {
        [, $companyUser] = $this->company();
        $profile = $this->liveProfile(['email' => 'secret@example.test', 'phone' => '9999999999', 'parent_phone' => '8888888888', 'resume_path' => 'resumes/1.pdf']);
        $profile->update(['external_id' => 'mv-77', 'payload_hash' => 'abc']);
        Sanctum::actingAs($companyUser);

        $list = $this->getJson('/api/company/vault')->assertOk()->getContent();
        $detail = $this->getJson("/api/company/vault/{$profile->id}")->assertOk()->getContent();

        foreach ([$list, $detail] as $body) {
            foreach (['secret@example.test', '9999999999', '8888888888', 'resumes/1.pdf', 'mv-77', 'payload_hash', 'public_id', 'consent_given_at', 'hired_via'] as $leak) {
                $this->assertStringNotContainsString($leak, $body, "{$leak} must not reach a hiring partner");
            }
        }
    }

    public function test_a_companys_own_engagement_is_marked_on_the_list(): void
    {
        [$company, $companyUser] = $this->company();
        $profile = $this->liveProfile();
        VaultInquiry::create(['vault_profile_id' => $profile->id, 'company_id' => $company->id, 'initiated_by' => $companyUser->id, 'status' => 'interview_scheduled']);
        Sanctum::actingAs($companyUser);

        $this->getJson('/api/company/vault')->assertOk()->assertJsonPath('profiles.data.0.my_inquiry_status', 'interview_scheduled');
    }

    public function test_the_detail_shows_the_live_readiness_breakdown(): void
    {
        [, $companyUser] = $this->company();
        $student = $this->strongStudent(['bio' => str_repeat('x', 45), 'linkedin_url' => 'https://www.linkedin.com/in/priya', 'resume_path' => 'resumes/999.pdf']);
        $profile = VaultProfile::create(['user_id' => $student->id, 'visibility_status' => 'visible', 'is_eligible' => true, 'consent_given_at' => now(), 'qualified_at' => now()]);
        Sanctum::actingAs($companyUser);

        $response = $this->getJson("/api/company/vault/{$profile->id}")->assertOk();

        $this->assertGreaterThanOrEqual(60, $response->json('readiness.score'));
        $this->assertCount(7, $response->json('readiness.components'));
        $this->assertTrue($response->json('profile.user.has_resume'));
        $this->assertSame('https://www.linkedin.com/in/priya', $response->json('profile.user.linkedin_url'));
        $this->assertArrayNotHasKey('resume_path', $response->json('profile.user'));
    }

    public function test_a_company_cannot_open_a_student_who_is_not_listed_unless_it_already_has_a_relationship(): void
    {
        [$company, $companyUser] = $this->company();
        [, $stranger] = $this->company('Stranger');
        $profile = $this->liveProfile(profile: ['visibility_status' => 'hidden_by_candidate']);

        Sanctum::actingAs($companyUser);
        $this->getJson("/api/company/vault/{$profile->id}")->assertNotFound();

        VaultInquiry::create(['vault_profile_id' => $profile->id, 'company_id' => $company->id, 'initiated_by' => $companyUser->id, 'status' => 'interested']);
        $this->getJson("/api/company/vault/{$profile->id}")->assertOk();

        Sanctum::actingAs($stranger);
        $this->getJson("/api/company/vault/{$profile->id}")->assertNotFound();
    }

    public function test_resume_download_requires_a_real_relationship(): void
    {
        Storage::fake('local');
        Storage::disk('local')->put('resumes/7.pdf', '%PDF-fake');
        [, $companyUser] = $this->company();
        $listed = $this->liveProfile(['resume_path' => 'resumes/7.pdf', 'resume_original_name' => 'asha.pdf']);
        $hidden = $this->liveProfile(['resume_path' => 'resumes/7.pdf'], ['visibility_status' => 'hidden_by_candidate']);
        $noResume = $this->liveProfile();
        Sanctum::actingAs($companyUser);

        $this->get("/api/company/vault/{$listed->id}/resume")->assertOk();
        $this->getJson("/api/company/vault/{$hidden->id}/resume")->assertNotFound();
        $this->getJson("/api/company/vault/{$noResume->id}/resume")->assertNotFound();
    }

    public function test_expressing_interest_creates_one_inquiry_and_emails_once(): void
    {
        [$company, $companyUser] = $this->company();
        $profile = $this->liveProfile();
        Sanctum::actingAs($companyUser);

        $this->postJson("/api/company/vault/{$profile->id}/interest")->assertCreated();
        $this->postJson("/api/company/vault/{$profile->id}/interest")->assertOk();

        $this->assertSame(1, VaultInquiry::where('company_id', $company->id)->count());
        Mail::assertSent(VaultInterestMail::class, 1);
    }

    public function test_scheduling_an_interview_validates_and_records_it(): void
    {
        [, $companyUser] = $this->company();
        $profile = $this->liveProfile();
        Sanctum::actingAs($companyUser);

        $this->postJson("/api/company/vault/{$profile->id}/interview", ['scheduled_at' => now()->subDay()->toIso8601String(), 'mode' => 'online', 'location' => 'x'])
            ->assertUnprocessable();

        $this->postJson("/api/company/vault/{$profile->id}/interview", ['scheduled_at' => now()->addDays(2)->toIso8601String(), 'mode' => 'online', 'location' => 'https://meet.example/abc'])
            ->assertOk()->assertJsonPath('inquiry.status', 'interview_scheduled');
    }

    public function test_a_message_to_a_student_is_logged_and_emailed(): void
    {
        [, $companyUser] = $this->company();
        $profile = $this->liveProfile();
        Sanctum::actingAs($companyUser);

        $this->postJson("/api/company/vault/{$profile->id}/notify", ['message' => 'We would love to talk.'])->assertCreated();

        Mail::assertSent(VaultOutreachMail::class);
        $this->assertSame(1, \App\Models\VaultMessage::count());
    }

    public function test_hiring_takes_the_student_out_of_the_vault_for_everyone_and_off_mellow_vault(): void
    {
        [$company, $companyUser] = $this->company();
        [, $otherCompanyUser] = $this->company('Rival');
        $profile = $this->liveProfile();
        // Mellow Vault was told about this student earlier.
        $profile->forceFill(['vault_listed_at' => now()->subHour(), 'sync_state' => 'delivered'])->save();
        Sanctum::actingAs($companyUser);

        $this->postJson("/api/company/vault/{$profile->id}/hire", ['ctc_offered' => 600000])->assertOk()
            ->assertJsonPath('inquiry.status', 'hired')
            ->assertJsonPath('profile.visibility_status', 'hired');

        $profile = $profile->fresh();
        $this->assertSame($company->id, $profile->hired_by_company_id);
        $this->assertSame(VaultProfile::HIRED_VIA_PARTNER, $profile->hired_via);
        Mail::assertSent(VaultHireOfferMail::class);
        $this->assertSame('hired', VaultSyncEvent::where('type', VaultSyncEvent::TYPE_WITHDRAW)->value('reason'));

        Sanctum::actingAs($otherCompanyUser);
        $this->getJson('/api/company/vault')->assertOk()->assertJsonCount(0, 'profiles.data');
        $this->postJson("/api/company/vault/{$profile->id}/hire")->assertNotFound();
    }

    public function test_the_same_student_cannot_be_hired_twice(): void
    {
        [$company, $companyUser] = $this->company();
        $profile = $this->liveProfile();
        VaultInquiry::create(['vault_profile_id' => $profile->id, 'company_id' => $company->id, 'initiated_by' => $companyUser->id, 'status' => 'interested']);
        Sanctum::actingAs($companyUser);

        $this->postJson("/api/company/vault/{$profile->id}/hire")->assertOk();
        $this->postJson("/api/company/vault/{$profile->id}/hire")->assertStatus(422);
    }

    public function test_the_vault_is_for_hiring_partners_only(): void
    {
        Sanctum::actingAs($this->readinessStudent());
        $this->getJson('/api/company/vault')->assertForbidden();

        Sanctum::actingAs($this->staff());
        $this->getJson('/api/company/vault')->assertForbidden();
    }

    // ═════════════════════════════ Mellow staff ═════════════════════════════

    public function test_staff_see_the_roster_counts_and_the_state_of_the_connection(): void
    {
        $this->liveProfile();
        $this->liveProfile(profile: ['visibility_status' => 'pending_consent']);
        $this->liveProfile(profile: ['visibility_status' => 'not_ready', 'is_eligible' => false, 'consent_given_at' => null]);
        Sanctum::actingAs($this->staff());

        $this->getJson('/api/admin/vault/summary')->assertOk()
            ->assertJsonPath('by_status.visible', 1)
            ->assertJsonPath('by_status.pending_consent', 1)
            ->assertJsonPath('by_status.not_ready', 1)
            ->assertJsonPath('by_status.hired', 0)
            ->assertJsonPath('eligible', 2)
            ->assertJsonPath('thresholds.enter', 60)
            ->assertJsonPath('sync.configured', false);
    }

    public function test_staff_can_filter_and_search_the_roster(): void
    {
        $asha = $this->liveProfile(['name' => 'Asha Rao', 'email' => 'asha@example.test'], ['readiness_score' => 90]);
        $this->liveProfile(['name' => 'Bala Iyer'], ['readiness_score' => 61, 'visibility_status' => 'pending_consent']);
        Sanctum::actingAs($this->staff());

        $this->assertSame([$asha->id], collect($this->getJson('/api/admin/vault/profiles?search=asha')->json('profiles.data'))->pluck('id')->all());
        $this->assertSame([$asha->id], collect($this->getJson('/api/admin/vault/profiles?min_readiness=80')->json('profiles.data'))->pluck('id')->all());
        $this->assertCount(1, $this->getJson('/api/admin/vault/profiles?visibility_status=pending_consent')->json('profiles.data'));
        $this->assertSame('asha@example.test', $this->getJson('/api/admin/vault/profiles?search=asha')->json('profiles.data.0.user.email'));
    }

    public function test_staff_can_hide_and_unhide_a_profile_and_it_is_audited(): void
    {
        [, $companyUser] = $this->company();
        $profile = $this->liveProfile();
        $staff = $this->staff();
        Sanctum::actingAs($staff);

        $this->postJson("/api/admin/vault/profiles/{$profile->id}/visibility", ['action' => 'hide', 'reason' => 'Fake resume'])->assertOk();
        $this->assertSame('hidden_by_mellow', $profile->fresh()->visibility_status);
        $this->assertSame('Fake resume', $profile->fresh()->hidden_reason);
        $this->assertTrue(ActivityLog::where('action', 'Hid a Vault profile')->where('actor_id', $staff->id)->exists());

        Sanctum::actingAs($companyUser);
        $this->getJson('/api/company/vault')->assertJsonCount(0, 'profiles.data');

        Sanctum::actingAs($staff);
        $this->postJson("/api/admin/vault/profiles/{$profile->id}/visibility", ['action' => 'unhide'])->assertOk();
        $this->assertSame('visible', $profile->fresh()->visibility_status);
    }

    public function test_staff_cannot_unhide_what_they_did_not_hide_or_hide_a_hired_student(): void
    {
        $withdrawn = $this->liveProfile(profile: ['visibility_status' => 'hidden_by_candidate', 'consent_withdrawn_at' => now()]);
        $hired = $this->liveProfile(profile: ['visibility_status' => 'hired', 'hired_at' => now()]);
        Sanctum::actingAs($this->staff());

        $this->postJson("/api/admin/vault/profiles/{$withdrawn->id}/visibility", ['action' => 'unhide'])->assertStatus(422);
        $this->postJson("/api/admin/vault/profiles/{$hired->id}/visibility", ['action' => 'hide'])->assertStatus(422);
    }

    public function test_staff_can_resync_a_live_profile_only(): void
    {
        $live = $this->liveProfile();
        $notLive = $this->liveProfile(profile: ['visibility_status' => 'pending_consent']);
        Sanctum::actingAs($this->staff());

        $this->postJson("/api/admin/vault/profiles/{$live->id}/resync")->assertOk();
        $this->postJson("/api/admin/vault/profiles/{$notLive->id}/resync")->assertStatus(422);
    }

    public function test_staff_can_see_stuck_syncs_and_retry_them(): void
    {
        VaultSyncEvent::create(['profile_public_id' => 'A', 'type' => 'profile.upsert', 'payload' => [], 'status' => 'dead', 'attempts' => 8, 'last_error' => 'HTTP 500']);
        VaultSyncEvent::create(['profile_public_id' => 'B', 'type' => 'profile.upsert', 'payload' => [], 'status' => 'delivered']);
        Sanctum::actingAs($this->staff());

        $events = $this->getJson('/api/admin/vault/sync-events')->assertOk()->json('events.data');
        $this->assertCount(1, $events, 'delivered ones are not interesting by default');
        $this->assertSame('dead', $events[0]['status']);

        $this->assertCount(1, $this->getJson('/api/admin/vault/sync-events?status=delivered')->json('events.data'));

        $this->postJson('/api/admin/vault/sync-events/retry')->assertOk()->assertJsonPath('requeued', 1);
        $this->assertSame('pending', VaultSyncEvent::where('profile_public_id', 'A')->value('status'));
    }

    public function test_the_admin_vault_needs_the_vault_permission(): void
    {
        Sanctum::actingAs($this->staff([User::PERM_CONTESTS]));
        $this->getJson('/api/admin/vault/summary')->assertForbidden();

        Sanctum::actingAs($this->readinessStudent());
        $this->getJson('/api/admin/vault/summary')->assertForbidden();

        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_SUPERADMIN]));
        $this->getJson('/api/admin/vault/summary')->assertOk();
    }

    // ═════════════════════════════ Mellow Vault calling in ═════════════════════════════

    private function asVault(): array
    {
        config(['vault.api_key' => 'mv-key-123']);

        return ['Authorization' => 'Bearer mv-key-123'];
    }

    public function test_the_integration_api_is_closed_until_a_key_is_configured(): void
    {
        $this->getJson('/api/vault/v1/ping', ['Authorization' => 'Bearer anything'])->assertStatus(503)->assertJsonPath('code', 'vault_not_configured');
    }

    public function test_the_integration_api_rejects_a_missing_or_wrong_key(): void
    {
        config(['vault.api_key' => 'mv-key-123']);

        $this->getJson('/api/vault/v1/ping')->assertUnauthorized();
        $this->getJson('/api/vault/v1/ping', ['Authorization' => 'Bearer nope'])->assertUnauthorized();
        $this->getJson('/api/vault/v1/ping', $this->asVault())->assertOk()->assertJsonPath('ok', true);
    }

    public function test_a_users_own_session_token_is_not_a_credential_for_the_integration_api(): void
    {
        config(['vault.api_key' => 'mv-key-123']);
        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_SUPERADMIN]));

        $this->getJson('/api/vault/v1/profiles')->assertUnauthorized();
    }

    public function test_the_pull_api_lists_only_live_profiles_with_the_full_listing(): void
    {
        $live = $this->liveProfile(['name' => 'Asha Rao', 'email' => 'asha@example.test', 'skills' => ['Laravel']]);
        $this->liveProfile(profile: ['visibility_status' => 'pending_consent']);
        $this->liveProfile(profile: ['visibility_status' => 'hidden_by_candidate']);

        $response = $this->getJson('/api/vault/v1/profiles', $this->asVault())->assertOk();

        $this->assertCount(1, $response->json('profiles'));
        $this->assertSame($live->public_id, $response->json('profiles.0.id'));
        $this->assertSame('asha@example.test', $response->json('profiles.0.email'));
        $this->assertSame(['Laravel'], $response->json('profiles.0.skills'));
        $this->assertSame(70, $response->json('profiles.0.readiness.score'));
        $this->assertFalse($response->json('has_more'));
    }

    public function test_the_pull_api_pages_by_cursor(): void
    {
        foreach (range(1, 5) as $_) {
            $this->liveProfile();
        }

        $first = $this->getJson('/api/vault/v1/profiles?limit=2', $this->asVault())->assertOk();
        $this->assertCount(2, $first->json('profiles'));
        $this->assertTrue($first->json('has_more'));

        $second = $this->getJson('/api/vault/v1/profiles?limit=2&after='.$first->json('next_after'), $this->asVault())->assertOk();
        $this->assertCount(2, $second->json('profiles'));
        $this->assertNotSame($first->json('profiles.0.id'), $second->json('profiles.0.id'));

        $third = $this->getJson('/api/vault/v1/profiles?limit=2&after='.$second->json('next_after'), $this->asVault())->assertOk();
        $this->assertCount(1, $third->json('profiles'));
        $this->assertFalse($third->json('has_more'));
    }

    public function test_the_pull_api_can_list_what_to_take_down(): void
    {
        $gone = $this->liveProfile(profile: ['visibility_status' => 'hidden_by_candidate', 'last_synced_at' => now()->subDay()]);
        $this->liveProfile(profile: ['visibility_status' => 'hidden_by_candidate']); // never told to Mellow Vault: nothing to take down
        $hired = $this->liveProfile(profile: ['visibility_status' => 'hired', 'hired_at' => now(), 'last_synced_at' => now()->subDay()]);

        $rows = collect($this->getJson('/api/vault/v1/profiles?status=withdrawn', $this->asVault())->assertOk()->json('profiles'))->keyBy('id');

        $this->assertSame(['withdrawn', 'hired'], [$rows[$gone->public_id]['status'], $rows[$hired->public_id]['status']]);
        $this->assertCount(2, $rows);
    }

    public function test_one_profile_is_served_while_live_and_gone_when_not(): void
    {
        $live = $this->liveProfile();
        $hidden = $this->liveProfile(profile: ['visibility_status' => 'hidden_by_candidate']);

        $this->getJson("/api/vault/v1/profiles/{$live->public_id}", $this->asVault())->assertOk()->assertJsonPath('profile.id', $live->public_id);
        $this->getJson("/api/vault/v1/profiles/{$hidden->public_id}", $this->asVault())->assertStatus(410)
            ->assertJsonPath('code', 'vault_profile_not_live')
            ->assertJsonMissingPath('profile');
        $this->getJson('/api/vault/v1/profiles/NOSUCHPROFILE', $this->asVault())->assertNotFound();
        $this->getJson("/api/vault/v1/profiles/{$live->id}", $this->asVault())->assertNotFound(); // the internal id is not an identifier
    }

    public function test_the_resume_is_served_for_a_live_profile_only(): void
    {
        Storage::fake('local');
        Storage::disk('local')->put('resumes/9.pdf', '%PDF-fake');
        $live = $this->liveProfile(['resume_path' => 'resumes/9.pdf']);
        $hidden = $this->liveProfile(['resume_path' => 'resumes/9.pdf'], ['visibility_status' => 'hidden_by_candidate']);

        $this->get("/api/vault/v1/profiles/{$live->public_id}/resume", $this->asVault())->assertOk();
        $this->getJson("/api/vault/v1/profiles/{$hidden->public_id}/resume", $this->asVault())->assertStatus(410);
    }

    public function test_mellow_vault_can_report_a_hire_and_telling_us_twice_changes_nothing(): void
    {
        $profile = $this->liveProfile();

        $this->postJson("/api/vault/v1/profiles/{$profile->public_id}/status", ['status' => 'hired', 'employer' => 'Initech'], $this->asVault())
            ->assertOk()->assertJsonPath('status', 'hired');
        $hiredAt = $profile->fresh()->hired_at;

        $this->postJson("/api/vault/v1/profiles/{$profile->public_id}/status", ['status' => 'hired', 'employer' => 'Someone Else'], $this->asVault())->assertOk();

        $profile = $profile->fresh();
        $this->assertSame('hired', $profile->visibility_status);
        $this->assertSame(VaultProfile::HIRED_VIA_VAULT, $profile->hired_via);
        $this->assertSame('Initech', $profile->hired_employer_name);
        $this->assertEquals($hiredAt, $profile->hired_at);
    }

    public function test_only_a_hire_can_be_reported(): void
    {
        $profile = $this->liveProfile();

        $this->postJson("/api/vault/v1/profiles/{$profile->public_id}/status", ['status' => 'live'], $this->asVault())->assertUnprocessable();
        $this->assertSame('visible', $profile->fresh()->visibility_status);
    }
}
