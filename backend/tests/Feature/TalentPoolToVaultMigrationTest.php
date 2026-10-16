<?php

namespace Tests\Feature;

use App\Models\Company;
use App\Models\User;
use App\Models\VaultInquiry;
use App\Models\VaultMessage;
use App\Models\VaultProfile;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * The one-off move of the old Talent Pool's rows into the Vault. It runs once, on
 * real data, so it is tested for the things that would hurt: ids must survive (every
 * engagement and email link points at them), consent must NOT be carried over (it
 * covered AptRun's hiring partners, not a hand-off to Mellow Vault), an opt-out must
 * stay an opt-out, and running it a second time must change nothing.
 */
class TalentPoolToVaultMigrationTest extends TestCase
{
    use RefreshDatabase;

    private function runMigration(): void
    {
        (require database_path('migrations/2026_10_17_100100_migrate_talent_pool_to_vault.php'))->up();
    }

    private function legacyCandidate(string $status, array $extra = []): int
    {
        $user = User::factory()->create(['role' => User::ROLE_USER]);

        return DB::table('talent_pool_candidates')->insertGetId($extra + [
            'user_id' => $user->id,
            'score_percent' => 94.5,
            'qualified_at' => now()->subMonth(),
            'visibility_status' => $status,
            'consent_given_at' => in_array($status, ['visible', 'hidden_by_candidate', 'hired'], true) ? now()->subWeeks(3) : null,
            'created_at' => now()->subMonth(),
            'updated_at' => now()->subWeek(),
        ]);
    }

    public function test_every_legacy_candidate_keeps_their_id_and_lands_in_the_right_state(): void
    {
        $company = Company::create(['name' => 'Acme', 'slug' => 'acme']);
        $visible = $this->legacyCandidate('visible');
        $pending = $this->legacyCandidate('pending_consent');
        $optedOut = $this->legacyCandidate('hidden_by_candidate');
        $hiddenByStaff = $this->legacyCandidate('hidden_by_mellow');
        $hired = $this->legacyCandidate('hired', ['hired_by_company_id' => $company->id, 'hired_at' => now()->subDays(5)]);

        $this->runMigration();

        $this->assertSame(5, VaultProfile::count());
        $byId = VaultProfile::all()->keyBy('id');

        $this->assertSame(VaultProfile::STATUS_PENDING_CONSENT, $byId[$visible]->visibility_status, 'old consent was for AptRun partners only — a visible student must say yes again');
        $this->assertNull($byId[$visible]->consent_given_at);
        $this->assertSame(VaultProfile::STATUS_PENDING_CONSENT, $byId[$pending]->visibility_status);

        $this->assertSame(VaultProfile::STATUS_HIDDEN_BY_CANDIDATE, $byId[$optedOut]->visibility_status, 'an opt-out stays an opt-out');
        $this->assertFalse($byId[$optedOut]->hasConsent());

        $this->assertSame(VaultProfile::STATUS_HIDDEN_BY_MELLOW, $byId[$hiddenByStaff]->visibility_status);
        $this->assertNotNull($byId[$hiddenByStaff]->hidden_by_staff_at);

        $this->assertSame(VaultProfile::STATUS_HIRED, $byId[$hired]->visibility_status);
        $this->assertSame($company->id, $byId[$hired]->hired_by_company_id);
        $this->assertSame(VaultProfile::HIRED_VIA_PARTNER, $byId[$hired]->hired_via);

        $this->assertTrue($byId[$visible]->is_eligible, 'they qualified under the old rule; the first readiness refresh re-judges them');
        $this->assertSame(VaultProfile::SOURCE_LEGACY_CONTEST, $byId[$visible]->qualification_source);
        $this->assertEquals(94.5, $byId[$visible]->legacy_score_percent);
        $this->assertSame(26, strlen($byId[$visible]->public_id));
    }

    public function test_engagements_and_messages_keep_their_ids_and_point_at_the_same_person(): void
    {
        $company = Company::create(['name' => 'Acme', 'slug' => 'acme']);
        $recruiter = User::factory()->create(['role' => User::ROLE_ADMIN_COMPANY, 'company_id' => $company->id]);
        $candidate = $this->legacyCandidate('visible');

        $inquiryId = DB::table('talent_pool_inquiries')->insertGetId([
            'talent_pool_candidate_id' => $candidate, 'company_id' => $company->id, 'initiated_by' => $recruiter->id,
            'status' => 'interview_scheduled', 'interview_scheduled_at' => now()->addDays(3), 'interview_mode' => 'online', 'interview_location' => 'meet.example',
            'ctc_offered' => 500000, 'created_at' => now(), 'updated_at' => now(),
        ]);
        $messageId = DB::table('talent_pool_messages')->insertGetId(['talent_pool_inquiry_id' => $inquiryId, 'sender_id' => $recruiter->id, 'message' => 'Hello', 'created_at' => now()]);

        $this->runMigration();

        $inquiry = VaultInquiry::findOrFail($inquiryId);
        $this->assertSame($candidate, $inquiry->vault_profile_id);
        $this->assertSame('interview_scheduled', $inquiry->status);
        $this->assertEquals(500000, $inquiry->ctc_offered);
        $this->assertSame('Hello', VaultMessage::findOrFail($messageId)->message);
        $this->assertSame($candidate, $inquiry->profile->id);
    }

    public function test_running_it_twice_changes_nothing(): void
    {
        $this->legacyCandidate('visible');
        $this->legacyCandidate('hired', ['hired_at' => now()]);

        $this->runMigration();
        $publicIds = VaultProfile::orderBy('id')->pluck('public_id')->all();
        $this->runMigration();

        $this->assertSame(2, VaultProfile::count());
        $this->assertSame($publicIds, VaultProfile::orderBy('id')->pluck('public_id')->all(), 'a student\'s external id must never change');
    }

    public function test_a_student_who_somehow_already_has_a_vault_profile_is_left_alone(): void
    {
        $candidate = $this->legacyCandidate('visible');
        $userId = DB::table('talent_pool_candidates')->where('id', $candidate)->value('user_id');
        VaultProfile::create(['user_id' => $userId, 'readiness_score' => 77]);

        $this->runMigration();

        $this->assertSame(1, VaultProfile::where('user_id', $userId)->count());
        $this->assertSame(77, VaultProfile::where('user_id', $userId)->value('readiness_score'));
    }

    public function test_the_old_tables_are_left_untouched(): void
    {
        $this->legacyCandidate('visible');
        $this->runMigration();

        $this->assertSame(1, DB::table('talent_pool_candidates')->count());
        $this->assertSame('visible', DB::table('talent_pool_candidates')->value('visibility_status'));
    }

    public function test_the_staff_permission_is_renamed_and_nothing_else_about_it_changes(): void
    {
        $staff = User::factory()->create(['role' => User::ROLE_ADMIN_INTERNAL]);
        DB::table('users')->where('id', $staff->id)->update(['permissions' => json_encode(['contests', 'talent_pool', 'articles'])]);
        $without = User::factory()->create(['role' => User::ROLE_ADMIN_INTERNAL]);
        DB::table('users')->where('id', $without->id)->update(['permissions' => json_encode(['contests'])]);

        $this->runMigration();
        $this->runMigration();

        $this->assertSame(['contests', 'vault', 'articles'], $staff->fresh()->permissions);
        $this->assertTrue($staff->fresh()->hasPermission(User::PERM_VAULT));
        $this->assertSame(['contests'], $without->fresh()->permissions);
    }
}
