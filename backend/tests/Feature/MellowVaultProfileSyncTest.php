<?php

namespace Tests\Feature;

use App\Jobs\SendVaultStackInterviewInviteJob;
use App\Mail\VaultStackInterviewInviteMail;
use App\Models\User;
use App\Models\VaultInterviewInvite;
use App\Services\Vault\MellowVaultProfileSyncService;
use Database\Seeders\MellowVaultProfileSyncSeeder;
use Database\Seeders\PlanSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class MellowVaultProfileSyncTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(PlanSeeder::class);
        $this->seed(MellowVaultProfileSyncSeeder::class);

        // Simulate production AWS where external `mellow_vault` DB is NOT configured.
        config(['database.connections.mellow_vault.database' => null]);
    }

    public function test_aptrun_only_users_remain_null_for_mv_columns(): void
    {
        $aptrunUser = User::factory()->create([
            'role' => User::ROLE_USER,
            'email' => 'aptrun.only@example.test',
        ]);

        $this->assertNull($aptrunUser->mv_profile_percentage);
        $this->assertNull($aptrunUser->mv_skill);
        $this->assertNull($aptrunUser->mellow_vault_profile_percent);
        $this->assertFalse($aptrunUser->isMellowVaultUser());

        $origin = MellowVaultProfileSyncService::decorateOriginFields($aptrunUser);
        $this->assertSame('aptrun', $origin['account_origin']);
        $this->assertFalse($origin['is_mellow_vault_user']);
        $this->assertNull($origin['mv_profile_percentage']);
        $this->assertNull($origin['mv_skill']);
        $this->assertNull($origin['mellow_vault_profile_percent']);

        Sanctum::actingAs($aptrunUser);
        $this->getJson('/api/vault/profile-sync/status')
            ->assertOk()
            ->assertJsonPath('is_mellow_vault_user', false)
            ->assertJsonPath('account_origin', 'aptrun')
            ->assertJsonPath('profile_percent', null)
            ->assertJsonPath('mv_profile_percentage', null)
            ->assertJsonPath('mv_skill', null)
            ->assertJsonPath('hit_90', false);
    }

    public function test_direct_mv_columns_trigger_stack_resolution_and_90_percent_invite(): void
    {
        Queue::fake();

        $mvUser = User::factory()->create([
            'role' => User::ROLE_USER,
            'email' => 'mv.dev@example.test',
            'mv_profile_percentage' => 75,
            'mv_skill' => 'ReactJS, TypeScript',
        ]);

        $mvUser->refresh();
        $this->assertTrue($mvUser->isMellowVaultUser());
        $this->assertSame(75, $mvUser->mv_profile_percentage);
        $this->assertNotNull($mvUser->mellow_vault_stack_key);
        $this->assertNull($mvUser->vault_ai_invite_sent_at);
        Queue::assertNothingPushed();

        // Cross 90% directly via model update
        $mvUser->update([
            'mv_profile_percentage' => 92,
            'mv_skill' => 'ReactJS',
        ]);

        $mvUser->refresh();
        $this->assertSame(92, $mvUser->mv_profile_percentage);
        $this->assertSame(92, $mvUser->mellow_vault_profile_percent);
        $this->assertNotNull($mvUser->vault_ai_invite_sent_at);

        Queue::assertPushed(SendVaultStackInterviewInviteJob::class, 1);

        $invite = VaultInterviewInvite::where('user_id', $mvUser->id)->firstOrFail();
        $this->assertSame(92, $invite->profile_percent);
        $this->assertNotNull($invite->stack_key);
        $this->assertStringContainsString('/dashboard/vault-interviews?stack='.$invite->stack_key, $invite->invite_url);

        // Second save above 90% must never dispatch a duplicate invite
        $mvUser->update(['mv_profile_percentage' => 100]);
        Queue::assertPushed(SendVaultStackInterviewInviteJob::class, 1);
    }

    public function test_push_api_and_raw_sql_sync_work_without_external_mellow_vault_db(): void
    {
        Mail::fake();
        config(['vault.api_key' => 'test-secret-key']);

        $apiUser = User::factory()->create([
            'role' => User::ROLE_USER,
            'email' => 'api.mv@example.test',
        ]);

        // Single push endpoint using new mv_profile_percentage + mv_skill fields
        $res = $this->withHeader('X-Api-Key', 'test-secret-key')
            ->postJson('/api/vault/sync/profile-completion', [
                'email' => 'api.mv@example.test',
                'mv_profile_percentage' => 95,
                'mv_skill' => 'Node.js',
                'sync_dispatch' => true,
            ]);

        $res->assertOk()
            ->assertJsonPath('synced', true)
            ->assertJsonPath('mv_profile_percentage', 95)
            ->assertJsonPath('mv_skill', 'Node.js')
            ->assertJsonPath('invite_dispatched', true);

        Mail::assertSent(VaultStackInterviewInviteMail::class, 1);

        // Simulate raw SQL write bypassing Eloquent events, processed by artisan syncAll
        $rawSqlUser = User::factory()->create([
            'role' => User::ROLE_USER,
            'email' => 'sql.mv@example.test',
        ]);
        DB::table('users')->where('id', $rawSqlUser->id)->update([
            'mv_profile_percentage' => 90,
            'mv_skill' => 'Laravel PHP',
        ]);

        $this->artisan('mellow-vault:sync-profile-completion', ['--sync' => true])
            ->assertSuccessful();

        $rawSqlUser->refresh();
        $this->assertNotNull($rawSqlUser->vault_ai_invite_sent_at);
        Mail::assertSent(VaultStackInterviewInviteMail::class, 2);
    }
}
