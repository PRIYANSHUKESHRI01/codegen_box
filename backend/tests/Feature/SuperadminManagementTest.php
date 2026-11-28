<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\SuperadminLoginLog;
use App\Models\SuperadminTrustedDevice;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SuperadminManagementTest extends TestCase
{
    use RefreshDatabase;

    private const PASSWORD = 'correct-horse-battery';

    private function superadmin(array $attributes = []): User
    {
        return User::factory()->create([
            'role' => User::ROLE_SUPERADMIN,
            'password' => Hash::make(self::PASSWORD),
            'must_change_password' => false,
        ] + $attributes);
    }

    public function test_superadmin_can_list_create_and_delete_another_superadmin(): void
    {
        Mail::fake();
        $primary = $this->superadmin(['name' => 'Primary Root', 'email' => 'primary@mellow.test']);
        Sanctum::actingAs($primary);

        // Create a second superadmin (requires creator's own password)
        $this->postJson('/api/superadmin/superadmins', [
            'name' => 'Second Root',
            'email' => 'second@mellow.test',
            'password' => 'wrong-password',
        ])->assertStatus(422)->assertJsonValidationErrors('password');

        $created = $this->postJson('/api/superadmin/superadmins', [
            'name' => 'Second Root',
            'email' => 'second@mellow.test',
            'initial_password' => 'SecondRoot#2026',
            'password' => self::PASSWORD,
        ])->assertCreated()
            ->assertJsonPath('superadmin.email', 'second@mellow.test')
            ->assertJsonPath('initial_password', 'SecondRoot#2026');

        $secondId = $created->json('superadmin.id');

        // List all superadmins
        $list = $this->getJson('/api/superadmin/superadmins')->assertOk();
        $this->assertSame(2, $list->json('summary.total'));
        $this->assertCount(2, $list->json('superadmins'));

        // Cannot delete self
        $this->deleteJson("/api/superadmin/superadmins/{$primary->id}", [
            'password' => self::PASSWORD,
            'confirm_email' => $primary->email,
        ])->assertStatus(422)->assertJsonValidationErrors('user');

        // Can delete the other superadmin with password + exact email
        $this->deleteJson("/api/superadmin/superadmins/{$secondId}", [
            'password' => self::PASSWORD,
            'confirm_email' => 'second@mellow.test',
        ])->assertOk()->assertJsonPath('deleted', true);

        $this->assertNull(User::find($secondId));
        $this->assertNotNull(ActivityLog::where('action', 'Created a superadmin account')->first());
        $this->assertNotNull(ActivityLog::where('action', 'Permanently deleted a superadmin account')->first());
    }

    public function test_cannot_delete_last_active_superadmin(): void
    {
        $only = $this->superadmin(['email' => 'only@mellow.test']);
        $blocked = $this->superadmin(['email' => 'blocked@mellow.test', 'is_blocked' => true]);
        Sanctum::actingAs($blocked);

        $this->deleteJson("/api/superadmin/superadmins/{$only->id}", [
            'password' => self::PASSWORD,
            'confirm_email' => 'only@mellow.test',
        ])->assertStatus(422)->assertJsonValidationErrors('user');

        $this->assertNotNull(User::find($only->id));
    }

    public function test_superadmin_login_captures_full_ip_network_browser_and_laptop_telemetry(): void
    {
        $sa = $this->superadmin(['email' => 'sec@mellow.test']);

        $telemetry = [
            'device_id' => 'dev_test_laptop_01',
            'device_fingerprint' => str_repeat('a1', 32),
            'device_type' => 'laptop',
            'os' => 'Windows',
            'os_version' => '11',
            'browser' => 'Chrome',
            'browser_version' => '131.0.0.0',
            'platform' => 'Win32',
            'architecture' => 'x86 (64-bit)',
            'cpu_cores' => 16,
            'device_memory_gb' => 32,
            'gpu_vendor' => 'Google Inc. (NVIDIA)',
            'gpu_renderer' => 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4060 Laptop GPU)',
            'screen_resolution' => '2560x1600 @ 1.5x',
            'timezone' => 'Asia/Kolkata',
            'language' => 'en-IN',
            'network_type' => 'wifi',
            'effective_type' => '4g',
            'downlink_mbps' => 85.4,
            'rtt_ms' => 18,
        ];

        // Failed login attempt is captured
        $this->withServerVariables(['REMOTE_ADDR' => '203.0.113.55'])
            ->postJson('/api/login', [
                'email' => 'sec@mellow.test',
                'password' => 'wrong-pass',
                'portal' => 'staff',
                'device_telemetry' => $telemetry,
            ])->assertStatus(422);

        // Successful login is captured and linked to token
        $loginRes = $this->withServerVariables(['REMOTE_ADDR' => '203.0.113.55'])
            ->postJson('/api/login', [
                'email' => 'sec@mellow.test',
                'password' => self::PASSWORD,
                'portal' => 'staff',
                'device_telemetry' => $telemetry,
            ])->assertOk();

        $this->assertSame(2, SuperadminLoginLog::count());

        $successLog = SuperadminLoginLog::where('event', SuperadminLoginLog::EVENT_LOGIN)->firstOrFail();
        $this->assertSame('203.0.113.55', $successLog->ip_address);
        $this->assertSame(str_repeat('a1', 32), $successLog->device_fingerprint);
        $this->assertSame('dev_test_laptop_01', $successLog->device_id);
        $this->assertSame('Windows', $successLog->os);
        $this->assertSame('11', $successLog->os_version);
        $this->assertSame('Chrome', $successLog->browser);
        $this->assertSame(16, $successLog->cpu_cores);
        $this->assertSame(32.0, $successLog->device_memory_gb);
        $this->assertSame('wifi', $successLog->network_type);
        $this->assertNotNull($successLog->token_id);

        // Global logs endpoint + detail endpoint surface all telemetry
        $this->withToken($loginRes->json('token'))
            ->getJson('/api/superadmin/superadmin-logins')
            ->assertOk()
            ->assertJsonPath('total', 2);

        $this->withToken($loginRes->json('token'))
            ->getJson("/api/superadmin/superadmins/{$sa->id}")
            ->assertOk()
            ->assertJsonPath('login_logs.0.ip_address', '203.0.113.55')
            ->assertJsonPath('sessions.0.login_context.device_fingerprint', str_repeat('a1', 32));
    }

    public function test_strict_trusted_laptop_and_ip_lock_enforces_allowlist_when_enabled(): void
    {
        $sa = $this->superadmin(['email' => 'locked@mellow.test']);
        Sanctum::actingAs($sa);

        $trustedFp = str_repeat('b2', 32);

        // Cannot enable strict lock with 0 trusted rules
        $this->postJson("/api/superadmin/superadmins/{$sa->id}/security-policy", [
            'password' => self::PASSWORD,
            'enforce_trusted_login' => true,
        ])->assertStatus(422)->assertJsonValidationErrors('enforce_trusted_login');

        // Register trusted laptop + IP CIDR
        $this->postJson("/api/superadmin/superadmins/{$sa->id}/trusted-devices", [
            'password' => self::PASSWORD,
            'label' => 'Primary Office Laptop',
            'ip_address' => '203.0.113.0/24',
            'device_fingerprint' => $trustedFp,
        ])->assertCreated();

        // Enable strict lock
        $this->postJson("/api/superadmin/superadmins/{$sa->id}/security-policy", [
            'password' => self::PASSWORD,
            'enforce_trusted_login' => true,
        ])->assertOk()->assertJsonPath('enforce_trusted_login', true);

        app('auth')->forgetGuards();

        // Wrong IP -> rejected and logged
        $this->withServerVariables(['REMOTE_ADDR' => '198.51.100.10'])
            ->postJson('/api/login', [
                'email' => 'locked@mellow.test',
                'password' => self::PASSWORD,
                'portal' => 'staff',
                'device_telemetry' => ['device_fingerprint' => $trustedFp],
            ])->assertStatus(422);

        // Wrong Laptop -> rejected and logged
        $this->withServerVariables(['REMOTE_ADDR' => '203.0.113.42'])
            ->postJson('/api/login', [
                'email' => 'locked@mellow.test',
                'password' => self::PASSWORD,
                'portal' => 'staff',
                'device_telemetry' => ['device_fingerprint' => str_repeat('ff', 32)],
            ])->assertStatus(422);

        $this->assertSame(
            2,
            SuperadminLoginLog::where('event', SuperadminLoginLog::EVENT_LOGIN_REJECTED_DEVICE_IP)->count()
        );

        // Matching IP + Laptop -> succeeds
        $this->withServerVariables(['REMOTE_ADDR' => '203.0.113.42'])
            ->postJson('/api/login', [
                'email' => 'locked@mellow.test',
                'password' => self::PASSWORD,
                'portal' => 'staff',
                'device_telemetry' => ['device_fingerprint' => $trustedFp],
            ])->assertOk()->assertJsonStructure(['token']);

        $this->assertNotNull(SuperadminTrustedDevice::firstOrFail()->last_matched_at);
    }
}
