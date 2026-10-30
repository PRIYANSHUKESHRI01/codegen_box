<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\College;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Superadmin edits a partner college's name / code and its TPO's name / login email — and the TPO's open screen learns of it
 * through the plan-signal's `profile_signature`, with no sign-out.
 */
class SuperadminCollegeEditTest extends TestCase
{
    use RefreshDatabase;

    private const PASSWORD = 'correct-horse-battery';

    private function superadmin(): User
    {
        return User::factory()->create(['role' => User::ROLE_SUPERADMIN, 'password' => Hash::make(self::PASSWORD)]);
    }

    /** @return array{0: College, 1: User} */
    private function collegeWithTpo(string $code = 'TUL', string $email = 'arun@tulas.test'): array
    {
        $college = College::create(['name' => 'Tulas Institute', 'short_code' => $code, 'tier' => 'Standard']);
        $tpo = User::factory()->create(['role' => User::ROLE_ADMIN_TPO, 'college_id' => $college->id, 'name' => 'Dr Arun', 'email' => $email]);

        return [$college, $tpo];
    }

    public function test_renaming_a_college_and_its_code_is_saved_audited_and_reaches_the_tpos_open_screen(): void
    {
        [$college, $tpo] = $this->collegeWithTpo();

        Sanctum::actingAs($tpo);
        $before = $this->getJson('/api/me/plan-signal')->assertOk()->json('profile_signature');
        $this->assertNotEmpty($before);

        Sanctum::actingAs($this->superadmin());
        $this->putJson("/api/superadmin/colleges/{$college->id}", ['name' => '  Tulas   University ', 'short_code' => 'tu'])
            ->assertOk()
            ->assertJsonPath('changed', true)
            ->assertJsonPath('college.name', 'Tulas University')
            ->assertJsonPath('college.short_code', 'TU');

        $this->assertDatabaseHas('colleges', ['id' => $college->id, 'name' => 'Tulas University', 'short_code' => 'TU']);
        $this->assertTrue(ActivityLog::where('action', "Edited a partner college's details")->exists());

        // The TPO's very next check sees the new details, and /me already carries them.
        Sanctum::actingAs($tpo->fresh());
        $this->assertNotSame($before, $this->getJson('/api/me/plan-signal')->json('profile_signature'));
        $this->getJson('/api/me')->assertJsonPath('user.college.name', 'Tulas University')->assertJsonPath('user.college.short_code', 'TU');

        // …and they are told in the bell.
        $this->assertDatabaseHas('user_notifications', ['user_id' => $tpo->id, 'type' => 'college.profile_changed']);
    }

    public function test_a_save_that_changes_nothing_says_so_and_writes_no_audit_row(): void
    {
        [$college, $tpo] = $this->collegeWithTpo();
        Sanctum::actingAs($this->superadmin());

        $this->putJson("/api/superadmin/colleges/{$college->id}", ['name' => 'Tulas Institute', 'short_code' => 'TUL', 'tpo_user_id' => $tpo->id, 'tpo_name' => 'Dr Arun', 'tpo_email' => 'ARUN@tulas.test'])
            ->assertOk()
            ->assertJsonPath('changed', false);

        $this->assertFalse(ActivityLog::where('action', "Edited a partner college's details")->exists());
    }

    public function test_a_short_code_another_college_uses_is_refused(): void
    {
        [$college] = $this->collegeWithTpo('TUL');
        College::create(['name' => 'Sharda', 'short_code' => 'SHA', 'tier' => 'Standard']);
        Sanctum::actingAs($this->superadmin());

        $this->putJson("/api/superadmin/colleges/{$college->id}", ['short_code' => 'sha'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('short_code');

        $this->putJson("/api/superadmin/colleges/{$college->id}", ['short_code' => 'bad code!'])->assertStatus(422)->assertJsonValidationErrors('short_code');
    }

    public function test_changing_the_tpos_login_email_needs_the_superadmins_password(): void
    {
        [$college, $tpo] = $this->collegeWithTpo();
        Sanctum::actingAs($this->superadmin());
        $body = ['tpo_user_id' => $tpo->id, 'tpo_email' => 'new.tpo@tulas.test'];

        $this->putJson("/api/superadmin/colleges/{$college->id}", $body)->assertStatus(422)->assertJsonValidationErrors('password');
        $this->putJson("/api/superadmin/colleges/{$college->id}", $body + ['password' => 'wrong'])->assertStatus(422)->assertJsonValidationErrors('password');
        $this->assertSame('arun@tulas.test', $tpo->fresh()->email);

        $this->putJson("/api/superadmin/colleges/{$college->id}", $body + ['password' => self::PASSWORD, 'tpo_name' => 'Dr Arun Kumar'])
            ->assertOk()
            ->assertJsonPath('tpo.email', 'new.tpo@tulas.test')
            ->assertJsonPath('tpo.name', 'Dr Arun Kumar');

        $this->assertNull($tpo->fresh()->email_verified_at);
        $this->assertDatabaseHas('user_notifications', ['user_id' => $tpo->id, 'type' => 'college.profile_changed']);
    }

    public function test_a_tpo_email_that_belongs_to_another_account_is_refused_in_plain_words(): void
    {
        [$college, $tpo] = $this->collegeWithTpo();
        User::factory()->create(['email' => 'taken@tulas.test']);
        Sanctum::actingAs($this->superadmin());

        $this->putJson("/api/superadmin/colleges/{$college->id}", ['tpo_user_id' => $tpo->id, 'tpo_email' => 'taken@tulas.test', 'password' => self::PASSWORD])
            ->assertStatus(422)
            ->assertJsonPath('errors.tpo_email.0', fn ($m) => str_contains($m, 'already belongs'));
    }

    public function test_another_colleges_tpo_cannot_be_edited_through_this_college(): void
    {
        [$college] = $this->collegeWithTpo('TUL');
        [, $stranger] = $this->collegeWithTpo('OTH', 'other@oth.test');
        Sanctum::actingAs($this->superadmin());

        $this->putJson("/api/superadmin/colleges/{$college->id}", ['tpo_user_id' => $stranger->id, 'tpo_name' => 'Hijacked'])->assertNotFound();
        $this->assertSame('Dr Arun', $stranger->fresh()->name);
    }

    public function test_only_a_superadmin_may_edit(): void
    {
        [$college, $tpo] = $this->collegeWithTpo();

        Sanctum::actingAs($tpo);
        $this->putJson("/api/superadmin/colleges/{$college->id}", ['name' => 'Mine now'])->assertForbidden();

        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_ADMIN_INTERNAL]));
        $this->putJson("/api/superadmin/colleges/{$college->id}", ['name' => 'Mine now'])->assertForbidden();

        $this->assertSame('Tulas Institute', $college->fresh()->name);
    }
}
