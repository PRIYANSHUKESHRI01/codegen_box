<?php

namespace Tests\Feature;

use App\Mail\AccountCredentialsMail;
use App\Models\ActivityLog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * "Seeing" an account's login: passwords are one-way hashes, so the only honest
 * way is to issue a fresh temporary password and show it once. These tests pin
 * down that it really replaces the old one, signs the account out everywhere,
 * needs the superadmin's own password, and can never be pointed at a superadmin.
 */
class SuperadminPasswordResetTest extends TestCase
{
    use RefreshDatabase;

    private const PASSWORD = 'correct-horse-battery';

    private function superadmin(): User
    {
        return User::factory()->create(['role' => User::ROLE_SUPERADMIN, 'password' => Hash::make(self::PASSWORD)]);
    }

    private function tpo(): User
    {
        return User::factory()->create([
            'role' => User::ROLE_ADMIN_TPO,
            'email' => 'tpo@tulas.test',
            'password' => Hash::make('the-old-password'),
            'must_change_password' => false,
            // The credentials-email job refuses to send twice to an account; a reset has to be able to.
            'credentials_email_sent_at' => now()->subDay(),
        ]);
    }

    private function reset(User $target, array $body = [])
    {
        return $this->postJson("/api/superadmin/users/{$target->id}/reset-password", array_merge(['password' => self::PASSWORD], $body));
    }

    public function test_it_replaces_the_password_signs_the_account_out_and_shows_the_new_one_once(): void
    {
        Mail::fake();
        $tpo = $this->tpo();
        $tpo->createToken('laptop');
        $tpo->createToken('phone');

        Sanctum::actingAs($this->superadmin());
        $response = $this->reset($tpo)->assertOk();

        $new = $response->json('temporary_password');
        $this->assertGreaterThanOrEqual(16, strlen($new));

        $tpo->refresh();
        $this->assertTrue(Hash::check($new, $tpo->password), 'the shown password is the real one');
        $this->assertFalse(Hash::check('the-old-password', $tpo->password), 'the old password is dead');
        $this->assertTrue($tpo->must_change_password, 'they must choose their own at next login');
        $this->assertSame(0, $tpo->tokens()->count(), 'every open session is signed out');
        $this->assertNull($response->json('credentials_email_sent'), 'not emailed unless asked');
        Mail::assertNothingSent();
    }

    public function test_it_can_email_the_new_password_and_report_whether_that_worked(): void
    {
        Mail::fake();
        $tpo = $this->tpo();

        Sanctum::actingAs($this->superadmin());
        $response = $this->reset($tpo, ['send_email' => true])->assertOk()->assertJsonPath('credentials_email_sent', true);

        Mail::assertSent(AccountCredentialsMail::class, fn (AccountCredentialsMail $m) => $m->hasTo('tpo@tulas.test') && $m->plainPassword === $response->json('temporary_password'));
        $this->assertNotNull($tpo->refresh()->credentials_email_sent_at, 'stamped again for the new password');
    }

    public function test_the_superadmins_own_password_is_required_and_a_typo_does_not_log_them_out(): void
    {
        $tpo = $this->tpo();
        Sanctum::actingAs($this->superadmin());

        // 422, not 401 — the frontend treats 401 as "session expired" and signs the user out.
        $this->reset($tpo, ['password' => 'wrong'])->assertStatus(422)->assertJsonValidationErrors('password');
        $this->postJson("/api/superadmin/users/{$tpo->id}/reset-password", [])->assertStatus(422)->assertJsonValidationErrors('password');

        $this->assertTrue(Hash::check('the-old-password', $tpo->refresh()->password), 'nothing changed');
    }

    public function test_a_superadmin_account_can_never_be_reset_this_way_not_even_your_own(): void
    {
        $me = $this->superadmin();
        $other = $this->superadmin();
        $before = $other->password;
        Sanctum::actingAs($me);

        $this->reset($other)->assertStatus(422);
        $this->reset($me)->assertStatus(422);

        $this->assertSame($before, $other->refresh()->password);
    }

    public function test_only_a_superadmin_can_do_it(): void
    {
        $tpo = $this->tpo();
        $staff = User::factory()->create(['role' => User::ROLE_ADMIN_INTERNAL, 'permissions' => ['colleges'], 'password' => Hash::make(self::PASSWORD)]);

        foreach ([$staff, $tpo] as $caller) {
            Sanctum::actingAs($caller);
            $this->reset($tpo)->assertForbidden();
        }

        $this->assertTrue(Hash::check('the-old-password', $tpo->refresh()->password));
    }

    public function test_the_audit_trail_records_the_reset_but_never_the_password(): void
    {
        Mail::fake();
        $tpo = $this->tpo();
        $actor = $this->superadmin();
        Sanctum::actingAs($actor);

        $new = $this->reset($tpo, ['send_email' => true])->json('temporary_password');

        $log = ActivityLog::where('action', 'like', 'Reset an account password%')->firstOrFail();
        $this->assertSame($actor->id, $log->actor_id);
        $this->assertSame($tpo->name, $log->target_label);
        $this->assertStringNotContainsString($new, json_encode($log->toArray()));
    }
}
