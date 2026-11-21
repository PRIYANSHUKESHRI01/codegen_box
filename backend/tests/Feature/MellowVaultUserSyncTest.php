<?php

namespace Tests\Feature;

use App\Models\College;
use App\Models\User;
use App\Services\Vault\MellowVaultUserSyncService;
use Database\Seeders\PlanSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Schema;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class MellowVaultUserSyncTest extends TestCase
{
    use RefreshDatabase;

    private const CONN = 'mellow_vault';

    protected function setUp(): void
    {
        parent::setUp();

        Queue::fake();
        Mail::fake();
        $this->seed(PlanSeeder::class);

        config([
            'vault.driver' => 'database',
            'database.connections.'.self::CONN => [
                'driver' => 'sqlite',
                'database' => ':memory:',
                'prefix' => '',
                'foreign_key_constraints' => false,
            ],
        ]);
        DB::purge(self::CONN);
        $this->app->forgetInstance(MellowVaultUserSyncService::class);

        Schema::connection(self::CONN)->create('developer_details_tb', function ($t) {
            $t->increments('dev_id');
            $t->integer('pro_id');
            $t->string('name', 20);
            $t->string('last_name', 20);
            $t->tinyInteger('gender')->default(0);
            $t->string('phone', 10);
            $t->string('email', 50);
            $t->string('password', 500);
            $t->string('show_password', 500);
            $t->tinyInteger('professional_status')->nullable();
            $t->string('tpo_hod_email')->nullable();
            $t->tinyInteger('hod_verified')->default(0);
            $t->string('language', 50)->nullable();
            $t->string('clg_name', 100)->nullable();
            $t->string('education', 500)->nullable();
            $t->string('degree', 100)->nullable();
            $t->string('passing_year', 20)->nullable();
            $t->string('description', 1000)->nullable();
            $t->string('skills', 255)->nullable();
            $t->tinyInteger('developer_status')->nullable()->default(0);
            $t->integer('profile_complete')->nullable();
            $t->integer('login_status')->default(0);
            $t->date('date');
            $t->integer('college_id')->nullable();
            $t->tinyInteger('is_working_in_org')->default(0);
            $t->tinyInteger('is_aptrun_synced')->default(0);
            $t->unsignedBigInteger('aptrun_user_id')->nullable();
            $t->timestamp('aptrun_synced_at')->nullable();
        });
    }

    private function mv()
    {
        return DB::connection(self::CONN)->table('developer_details_tb');
    }

    public function test_direct_user_registration_syncs_to_mellow_vault_with_matching_credentials(): void
    {
        $payload = [
            'name' => 'Aarav Sharma',
            'email' => 'aarav.sharma@example.test',
            'handle' => 'aarav_sharma',
            'password' => 'AaravSecret123!',
            'password_confirmation' => 'AaravSecret123!',
            'phone' => '+91 9876543210',
        ];

        $res = $this->postJson('/api/register', $payload);
        $res->assertCreated();

        $user = User::where('email', 'aarav.sharma@example.test')->firstOrFail();

        $dev = $this->mv()->where('email', 'aarav.sharma@example.test')->first();
        $this->assertNotNull($dev, 'User was not synced to Mellow Vault developer_details_tb');
        $this->assertEquals('Aarav', $dev->name);
        $this->assertEquals('Sharma', $dev->last_name);
        $this->assertEquals('9876543210', $dev->phone);
        $this->assertEquals(md5('AaravSecret123!'), $dev->password);
        $this->assertEquals('AaravSecret123!', $dev->show_password);
        $this->assertEquals(1, (int) $dev->login_status);
        $this->assertEquals(2, (int) $dev->developer_status);
        $this->assertEquals(1, (int) $dev->is_aptrun_synced);
        $this->assertEquals($user->id, (int) $dev->aptrun_user_id);
        $this->assertEquals('Direct / AptRun', $dev->clg_name);
    }

    public function test_college_student_syncs_to_mellow_vault_with_college_details(): void
    {
        $college = College::create([
            'name' => 'National Institute of Engineering',
            'short_code' => 'NIE',
            'tier' => 'Standard',
            'city' => 'Bengaluru',
        ]);
        User::factory()->create([
            'role' => User::ROLE_ADMIN_TPO,
            'college_id' => $college->id,
            'email' => 'tpo@nie.test',
            'is_blocked' => false,
        ]);

        $syncService = app(MellowVaultUserSyncService::class);

        $student = User::factory()->create([
            'name' => 'Kavya Raman',
            'email' => 'kavya@nie.test',
            'role' => User::ROLE_USER,
            'college_id' => $college->id,
            'phone' => '9123456789',
            'branch' => 'Information Science',
            'graduation_year' => 2026,
        ]);

        $res = $syncService->syncUser($student, 'StudentPass123!');
        $this->assertTrue($res['success']);

        $dev = $this->mv()->where('email', 'kavya@nie.test')->first();
        $this->assertNotNull($dev);
        $this->assertEquals('Kavya', $dev->name);
        $this->assertEquals('Raman', $dev->last_name);
        $this->assertEquals('9123456789', $dev->phone);
        $this->assertEquals(md5('StudentPass123!'), $dev->password);
        $this->assertEquals('StudentPass123!', $dev->show_password);
        $this->assertEquals('National Institute of Engineering', $dev->clg_name);
        $this->assertEquals('tpo@nie.test', $dev->tpo_hod_email);
        $this->assertEquals(1, (int) $dev->hod_verified);
        $this->assertEquals($college->id, (int) $dev->college_id);
        $this->assertEquals('Information Science', $dev->degree);
        $this->assertEquals('2026', $dev->passing_year);
    }

    public function test_password_update_in_settings_updates_mellow_vault_credentials(): void
    {
        $payload = [
            'name' => 'Dev Singh',
            'email' => 'dev.singh@example.test',
            'handle' => 'dev_singh',
            'password' => 'OldPassword123!',
            'password_confirmation' => 'OldPassword123!',
            'phone' => '9888877777',
        ];

        $this->postJson('/api/register', $payload)->assertCreated();
        $user = User::where('email', 'dev.singh@example.test')->firstOrFail();

        $dev = $this->mv()->where('email', 'dev.singh@example.test')->first();
        $this->assertEquals(md5('OldPassword123!'), $dev->password);
        $this->assertEquals('OldPassword123!', $dev->show_password);

        // Update password via settings endpoint
        Sanctum::actingAs($user);
        $updateRes = $this->putJson('/api/update-password', [
            'current_password' => 'OldPassword123!',
            'password' => 'BrandNewPassword456!',
            'password_confirmation' => 'BrandNewPassword456!',
        ]);
        $updateRes->assertOk();

        $devRefreshed = $this->mv()->where('email', 'dev.singh@example.test')->first();
        $this->assertEquals(md5('BrandNewPassword456!'), $devRefreshed->password);
        $this->assertEquals('BrandNewPassword456!', $devRefreshed->show_password);
    }

    public function test_sync_api_endpoints(): void
    {
        // 1. Health endpoint
        $healthRes = $this->getJson('/api/vault/sync/health');
        $healthRes->assertOk()
            ->assertJsonPath('service', 'MellowVaultUserSync')
            ->assertJsonPath('health.connected', true);

        // 2. Register direct endpoint
        $regDirectRes = $this->postJson('/api/vault/sync/register-direct', [
            'name' => 'Meera Nair',
            'email' => 'meera@example.test',
            'password' => 'MeeraDirectPass789!',
            'phone' => '9555544444',
            'branch' => 'Electronics',
            'graduation_year' => 2027,
        ]);
        $regDirectRes->assertCreated()
            ->assertJsonPath('mellow_vault_sync.success', true)
            ->assertJsonPath('mellow_vault_sync.credentials_synced', true);

        $user = User::where('email', 'meera@example.test')->firstOrFail();

        // 3. Status endpoint
        $statusRes = $this->getJson("/api/vault/sync/user/{$user->id}/status");
        $statusRes->assertOk()
            ->assertJsonPath('mellow_vault.found', true)
            ->assertJsonPath('mellow_vault.phone', '9555544444')
            ->assertJsonPath('mellow_vault.has_password', true);
    }

    public function test_superadmin_is_never_synced_as_developer(): void
    {
        $superadmin = User::factory()->create([
            'role' => User::ROLE_SUPERADMIN,
            'email' => 'admin@mellowvault.test',
        ]);

        $syncService = app(MellowVaultUserSyncService::class);
        $res = $syncService->syncUser($superadmin, 'SecretPass123!');

        $this->assertFalse($res['success']);
        $this->assertEquals(0, $this->mv()->where('email', 'admin@mellowvault.test')->count());
    }
}
