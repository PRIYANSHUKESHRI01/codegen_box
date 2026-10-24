<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\College;
use App\Models\IssuedCredential;
use App\Models\User;
use App\Services\IssuedCredentialVault;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * "See an account's login": a password an owner chose is a one-way hash and can never be shown, but the temporary
 * password the platform ISSUED can be looked up until the owner replaces it. These tests pin down both halves — that the
 * issued one is retrievable (behind an unlock, rate limit and audit), and that nothing the owner chose ever is.
 */
class SuperadminCredentialVaultTest extends TestCase
{
    use RefreshDatabase;

    private const PASSWORD = 'correct-horse-battery';

    private function superadmin(): User
    {
        return User::factory()->create(['role' => User::ROLE_SUPERADMIN, 'password' => Hash::make(self::PASSWORD)]);
    }

    private function unlock(): void
    {
        $this->postJson('/api/superadmin/credentials/unlock', ['password' => self::PASSWORD])->assertOk()->assertJsonPath('unlocked', true);
    }

    private function create(array $body = []): array
    {
        $response = $this->postJson('/api/superadmin/users', array_merge([
            'name' => 'Asha Verma',
            'email' => 'asha@example.com',
            'role' => User::ROLE_USER,
        ], $body))->assertCreated();

        return [User::findOrFail($response->json('user.id')), $response->json('temporary_password')];
    }

    public function test_an_issued_password_can_be_looked_up_again_after_unlocking(): void
    {
        Mail::fake();
        Sanctum::actingAs($this->superadmin());
        [$user, $issued] = $this->create();

        $this->unlock();

        $this->postJson("/api/superadmin/users/{$user->id}/credentials")
            ->assertOk()
            ->assertJsonPath('login_id', 'asha@example.com')
            ->assertJsonPath('password', $issued)
            ->assertJsonPath('state', 'viewable')
            ->assertHeader('Cache-Control', 'no-store, private');
    }

    public function test_it_is_locked_until_the_superadmin_re_enters_their_own_password(): void
    {
        Mail::fake();
        Sanctum::actingAs($this->superadmin());
        [$user] = $this->create();

        $this->postJson("/api/superadmin/users/{$user->id}/credentials")
            ->assertStatus(428)
            ->assertJsonPath('code', 'credentials_locked')
            ->assertJsonMissingPath('password');

        $this->postJson('/api/superadmin/credentials/unlock', ['password' => 'not-my-password'])->assertStatus(422);

        $this->postJson("/api/superadmin/users/{$user->id}/credentials")->assertStatus(428);
    }

    public function test_locking_again_closes_the_view_immediately(): void
    {
        Mail::fake();
        Sanctum::actingAs($this->superadmin());
        [$user] = $this->create();

        $this->unlock();
        $this->postJson('/api/superadmin/credentials/lock')->assertOk()->assertJsonPath('unlocked', false);

        $this->postJson("/api/superadmin/users/{$user->id}/credentials")->assertStatus(428);
    }

    public function test_the_lookup_is_audited_and_the_audit_trail_never_holds_the_password(): void
    {
        Mail::fake();
        Sanctum::actingAs($this->superadmin());
        [$user, $issued] = $this->create();

        $this->unlock();
        $this->postJson("/api/superadmin/users/{$user->id}/credentials")->assertOk();

        $entry = ActivityLog::where('action', 'like', 'Viewed an account%')->first();
        $this->assertNotNull($entry, 'a reveal leaves a trace');
        $this->assertSame('Asha Verma', $entry->target_label);
        $this->assertStringNotContainsString($issued, json_encode(ActivityLog::all()->toArray()), 'no password in the audit trail');
    }

    public function test_the_stored_copy_is_encrypted_at_rest(): void
    {
        Mail::fake();
        Sanctum::actingAs($this->superadmin());
        [$user, $issued] = $this->create();

        $raw = DB::table('issued_credentials')->where('user_id', $user->id)->value('secret');

        $this->assertNotNull($raw);
        $this->assertStringNotContainsString($issued, $raw);
    }

    public function test_a_superadmins_password_is_never_shown_or_kept(): void
    {
        $admin = $this->superadmin();
        $other = $this->superadmin();
        Sanctum::actingAs($admin);
        $this->unlock();

        app(IssuedCredentialVault::class)->keep($other, 'whatever-it-was', 'created');
        $this->assertSame(0, IssuedCredential::count(), 'superadmins are never stored');

        $this->postJson("/api/superadmin/users/{$other->id}/credentials")
            ->assertStatus(422)
            ->assertJsonMissingPath('password');
    }

    public function test_a_password_the_owner_chose_is_never_shown(): void
    {
        Mail::fake();
        $superadmin = $this->superadmin();
        Sanctum::actingAs($superadmin);
        [$user, $issued] = $this->create();

        // The owner replaces the temporary password with their own.
        Sanctum::actingAs($user);
        $this->putJson('/api/me/password', [
            'current_password' => $issued,
            'password' => 'my-own-secret-123',
            'password_confirmation' => 'my-own-secret-123',
        ])->assertOk();

        $this->assertSame(0, IssuedCredential::where('user_id', $user->id)->count(), 'the kept copy is wiped as soon as the owner sets theirs');

        Cache::flush();
        Sanctum::actingAs($superadmin);
        $this->unlock();
        $this->postJson("/api/superadmin/users/{$user->id}/credentials")
            ->assertOk()
            ->assertJsonPath('state', 'owner_set')
            ->assertJsonPath('password', null);
    }

    public function test_a_stale_copy_is_never_shown_even_if_a_code_path_forgot_to_clear_it(): void
    {
        Mail::fake();
        Sanctum::actingAs($this->superadmin());
        [$user] = $this->create();

        // Some path changes the password without telling the vault.
        $user->forceFill(['password' => Hash::make('changed-behind-its-back')])->save();

        $this->unlock();
        $this->postJson("/api/superadmin/users/{$user->id}/credentials")
            ->assertOk()
            ->assertJsonPath('password', null);

        $this->assertSame(0, IssuedCredential::count(), 'and the stale copy is deleted on sight');
    }

    public function test_an_old_temporary_password_with_no_copy_says_to_reset_it(): void
    {
        Sanctum::actingAs($this->superadmin());
        $user = User::factory()->create(['role' => User::ROLE_USER, 'must_change_password' => true]);

        $this->unlock();
        $this->postJson("/api/superadmin/users/{$user->id}/credentials")
            ->assertOk()
            ->assertJsonPath('state', 'not_recorded')
            ->assertJsonPath('password', null);
    }

    public function test_an_expired_copy_is_not_shown(): void
    {
        Mail::fake();
        Sanctum::actingAs($this->superadmin());
        [$user] = $this->create();
        IssuedCredential::where('user_id', $user->id)->update(['expires_at' => now()->subMinute()]);

        $this->unlock();
        $this->postJson("/api/superadmin/users/{$user->id}/credentials")
            ->assertOk()
            ->assertJsonPath('password', null)
            ->assertJsonPath('state', 'not_recorded');
    }

    public function test_only_a_superadmin_can_reach_any_of_it(): void
    {
        $user = User::factory()->create(['role' => User::ROLE_USER]);

        foreach ([User::ROLE_ADMIN_INTERNAL, User::ROLE_ADMIN_TPO, User::ROLE_ADMIN_MARKETING, User::ROLE_USER] as $role) {
            Sanctum::actingAs(User::factory()->create(['role' => $role, 'password' => Hash::make(self::PASSWORD)]));

            $this->postJson('/api/superadmin/credentials/unlock', ['password' => self::PASSWORD])->assertForbidden();
            $this->postJson("/api/superadmin/users/{$user->id}/credentials")->assertForbidden();
            $this->getJson('/api/superadmin/users/facets')->assertForbidden();
        }
    }

    public function test_the_user_list_says_whether_a_login_is_viewable_but_never_carries_a_password(): void
    {
        Mail::fake();
        Sanctum::actingAs($this->superadmin());
        [$fresh, $issued] = $this->create(['email' => 'fresh@example.com']);
        $chosen = User::factory()->create(['role' => User::ROLE_USER, 'must_change_password' => false]);
        $legacy = User::factory()->create(['role' => User::ROLE_USER, 'must_change_password' => true]);

        $response = $this->getJson('/api/superadmin/users')->assertOk();
        $states = collect($response->json('data'))->pluck('credential_state', 'id');

        $this->assertSame('viewable', $states[$fresh->id]);
        $this->assertSame('owner_set', $states[$chosen->id]);
        $this->assertSame('not_recorded', $states[$legacy->id]);
        $this->assertStringNotContainsString($issued, $response->getContent());
        $this->assertStringNotContainsString('"secret"', $response->getContent());
    }

    public function test_setting_a_specific_password_replaces_the_old_one_and_stays_viewable_until_changed(): void
    {
        Mail::fake();
        Sanctum::actingAs($this->superadmin());
        $user = User::factory()->create(['role' => User::ROLE_ADMIN_TPO, 'password' => Hash::make('the-old-password'), 'must_change_password' => false]);
        $user->createToken('laptop');

        $this->postJson("/api/superadmin/users/{$user->id}/reset-password", [
            'password' => self::PASSWORD,
            'new_password' => 'Chosen-By-Boss-77',
        ])->assertOk()->assertJsonPath('temporary_password', 'Chosen-By-Boss-77')->assertJsonPath('must_change_password', true);

        $user->refresh();
        $this->assertTrue(Hash::check('Chosen-By-Boss-77', $user->password));
        $this->assertTrue($user->must_change_password);
        $this->assertSame(0, $user->tokens()->count());

        $this->unlock();
        $this->postJson("/api/superadmin/users/{$user->id}/credentials")->assertOk()->assertJsonPath('password', 'Chosen-By-Boss-77');
    }

    public function test_setting_a_permanent_password_keeps_no_copy(): void
    {
        Mail::fake();
        Sanctum::actingAs($this->superadmin());
        $user = User::factory()->create(['role' => User::ROLE_USER]);

        $this->postJson("/api/superadmin/users/{$user->id}/reset-password", [
            'password' => self::PASSWORD,
            'new_password' => 'Permanent-Pass-99',
            'require_change' => false,
        ])->assertOk();

        $user->refresh();
        $this->assertTrue(Hash::check('Permanent-Pass-99', $user->password));
        $this->assertFalse($user->must_change_password);
        $this->assertSame(0, IssuedCredential::count());

        $this->unlock();
        $this->postJson("/api/superadmin/users/{$user->id}/credentials")->assertOk()->assertJsonPath('password', null)->assertJsonPath('state', 'owner_set');
    }

    public function test_a_weak_or_login_equal_password_is_refused(): void
    {
        Sanctum::actingAs($this->superadmin());
        $user = User::factory()->create(['role' => User::ROLE_USER, 'email' => 'same@example.com', 'password' => Hash::make('keep-this-one')]);

        $this->postJson("/api/superadmin/users/{$user->id}/reset-password", ['password' => self::PASSWORD, 'new_password' => 'short'])
            ->assertStatus(422)->assertJsonValidationErrors('new_password');
        $this->postJson("/api/superadmin/users/{$user->id}/reset-password", ['password' => self::PASSWORD, 'new_password' => 'same@example.com'])
            ->assertStatus(422)->assertJsonValidationErrors('new_password');

        $this->assertTrue(Hash::check('keep-this-one', $user->refresh()->password), 'a refused change leaves the password alone');
    }

    public function test_the_audit_log_for_a_chosen_password_never_contains_it(): void
    {
        Mail::fake();
        Sanctum::actingAs($this->superadmin());
        $user = User::factory()->create(['role' => User::ROLE_USER]);

        $this->postJson("/api/superadmin/users/{$user->id}/reset-password", ['password' => self::PASSWORD, 'new_password' => 'Needle-In-Haystack-1'])->assertOk();

        $this->assertStringNotContainsString('Needle-In-Haystack-1', json_encode(ActivityLog::all()->toArray()));
        $this->assertTrue(ActivityLog::where('action', 'Set an account password')->exists());
    }

    // ───────────────────────── university filter ─────────────────────────

    private function universityFixture(): array
    {
        $a = College::create(['name' => 'Alpha University', 'short_code' => 'ALP', 'tier' => 'Standard']);
        $b = College::create(['name' => 'Beta Institute', 'short_code' => 'BET', 'tier' => 'Standard']);

        $tpoA = User::factory()->create(['role' => User::ROLE_ADMIN_TPO, 'college_id' => $a->id]);
        $coordA = User::factory()->create(['role' => User::ROLE_SECTION_COORDINATOR, 'college_id' => $a->id]);
        $studentsA = User::factory()->count(3)->create(['role' => User::ROLE_USER, 'college_id' => $a->id]);
        $studentB = User::factory()->create(['role' => User::ROLE_USER, 'college_id' => $b->id]);
        $lead = User::factory()->create(['role' => User::ROLE_USER, 'college_id' => null]);
        $staff = User::factory()->create(['role' => User::ROLE_ADMIN_MARKETING, 'college_id' => null]);

        return compact('a', 'b', 'tpoA', 'coordA', 'studentsA', 'studentB', 'lead', 'staff');
    }

    public function test_the_directory_filters_every_role_by_university(): void
    {
        $f = $this->universityFixture();
        Sanctum::actingAs($this->superadmin());

        $ids = fn (string $query) => collect($this->getJson("/api/superadmin/users?{$query}")->assertOk()->json('data'))->pluck('id')->sort()->values()->all();

        $everyoneAtAlpha = $ids("college_id={$f['a']->id}");
        $this->assertEqualsCanonicalizing(
            [$f['tpoA']->id, $f['coordA']->id, ...$f['studentsA']->pluck('id')->all()],
            $everyoneAtAlpha
        );

        $this->assertSame([$f['tpoA']->id], $ids("college_id={$f['a']->id}&role=admin_tpo"));
        $this->assertSame([$f['coordA']->id], $ids("college_id={$f['a']->id}&role=section_coordinator"));
        $this->assertCount(3, $ids("college_id={$f['a']->id}&role=user"));
        $this->assertSame([$f['studentB']->id], $ids("college_id={$f['b']->id}&role=user"));
    }

    public function test_none_selects_the_accounts_that_belong_to_no_university(): void
    {
        $f = $this->universityFixture();
        Sanctum::actingAs($this->superadmin());

        $ids = collect($this->getJson('/api/superadmin/users?college_id=none')->assertOk()->json('data'))->pluck('id');

        $this->assertTrue($ids->contains($f['lead']->id));
        $this->assertTrue($ids->contains($f['staff']->id));
        $this->assertFalse($ids->contains($f['tpoA']->id));
        $this->assertFalse($ids->contains($f['studentB']->id));
    }

    public function test_a_junk_college_id_is_ignored_rather_than_breaking_the_query(): void
    {
        $this->universityFixture();
        Sanctum::actingAs($this->superadmin());

        $this->getJson('/api/superadmin/users?college_id=1%27%20OR%201=1')->assertOk();
    }

    public function test_facets_count_roles_for_the_chosen_university_and_universities_for_the_chosen_role(): void
    {
        $f = $this->universityFixture();
        Sanctum::actingAs($this->superadmin());

        $byUniversity = $this->getJson("/api/superadmin/users/facets?college_id={$f['a']->id}")->assertOk();
        $this->assertSame(1, $byUniversity->json('roles.admin_tpo'));
        $this->assertSame(1, $byUniversity->json('roles.section_coordinator'));
        $this->assertSame(3, $byUniversity->json('roles.user'));
        $this->assertNull($byUniversity->json('roles.admin_marketing'), 'staff do not belong to Alpha');

        $byRole = $this->getJson('/api/superadmin/users/facets?role=user')->assertOk();
        $colleges = collect($byRole->json('colleges'))->keyBy('id');
        $this->assertSame(3, $colleges[$f['a']->id]['accounts']);
        $this->assertSame(1, $colleges[$f['b']->id]['accounts']);
        $this->assertSame(1, $byRole->json('without_college'), 'the one self-registered coder');
    }
}
