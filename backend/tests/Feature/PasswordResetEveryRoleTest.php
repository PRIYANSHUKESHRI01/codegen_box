<?php

namespace Tests\Feature;

use App\Mail\PasswordResetOtpMail;
use App\Models\Plan;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use PHPUnit\Framework\Attributes\DataProvider;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * The password reset has to work for everybody who can sign in to AptRun, whichever tab they use and whichever way
 * the account came to exist (self sign-up, or created by someone else with a one-time password). Drives the real
 * HTTP endpoints the two reset screens call, then signs in through the account's own tab with the new password.
 */
class PasswordResetEveryRoleTest extends TestCase
{
    use RefreshDatabase;

    private const NEW_PASSWORD = 'a-brand-new-password-1';

    protected function setUp(): void
    {
        parent::setUp();

        Mail::fake();
    }

    /** @return array<string, array{0: string, 1: string}> role => the tab it signs in through */
    public static function roles(): array
    {
        return [
            'student' => [User::ROLE_USER, 'user'],
            'college TPO' => [User::ROLE_ADMIN_TPO, 'admin_tpo'],
            'section coordinator' => [User::ROLE_SECTION_COORDINATOR, 'admin_tpo'],
            'hiring partner' => [User::ROLE_ADMIN_COMPANY, 'admin_company'],
            'Mellow internal staff' => [User::ROLE_ADMIN_INTERNAL, 'staff'],
            'Mellow marketing staff' => [User::ROLE_ADMIN_MARKETING, 'staff'],
        ];
    }

    private function resetThroughTheApi(string $email): void
    {
        $this->postJson('/api/password/forgot', ['email' => $email])->assertOk();
        $code = Mail::sent(PasswordResetOtpMail::class)->last()->code;

        $token = $this->postJson('/api/password/otp/verify', ['email' => $email, 'code' => $code])
            ->assertOk()->json('reset_token');

        $this->postJson('/api/password/reset', [
            'email' => $email,
            'reset_token' => $token,
            'password' => self::NEW_PASSWORD,
            'password_confirmation' => self::NEW_PASSWORD,
        ])->assertOk();
    }

    #[DataProvider('roles')]
    public function test_a_forgotten_password_can_be_reset_by_every_kind_of_account(string $role, string $portal): void
    {
        $user = User::factory()->create(['role' => $role, 'password' => Hash::make('forgotten'), 'must_change_password' => false]);
        $oldSession = $user->createToken('laptop');

        $this->resetThroughTheApi($user->email);

        $this->postJson('/api/login', ['email' => $user->email, 'password' => 'forgotten', 'portal' => $portal])->assertUnprocessable();
        $this->postJson('/api/login', ['email' => $user->email, 'password' => self::NEW_PASSWORD, 'portal' => $portal])
            ->assertOk()->assertJsonStructure(['token', 'user'])->assertJsonPath('user.id', $user->id);

        $this->assertDatabaseMissing('personal_access_tokens', ['id' => $oldSession->accessToken->id]);
    }

    #[DataProvider('roles')]
    public function test_an_account_someone_else_created_is_taken_over_by_its_owner_through_the_first_login_flow(string $role, string $portal): void
    {
        $user = User::factory()->create(['role' => $role, 'password' => Hash::make('one-time-pass'), 'must_change_password' => true]);

        // Step 1 — the sign-in with the emailed one-time password is held back, no session issued.
        $this->postJson('/api/login', ['email' => $user->email, 'password' => 'one-time-pass', 'portal' => $portal])
            ->assertOk()->assertJsonPath('must_change_password', true)->assertJsonMissingPath('token');

        // Steps 2-4 — the same endpoints the "Set Your Permanent Password" screen calls.
        $this->resetThroughTheApi($user->email);

        // Step 5 — the screen signs straight in with the new password.
        $this->postJson('/api/login', ['email' => $user->email, 'password' => self::NEW_PASSWORD, 'portal' => $portal])
            ->assertOk()->assertJsonStructure(['token', 'user']);

        $this->assertFalse($user->fresh()->must_change_password);
        $this->postJson('/api/login', ['email' => $user->email, 'password' => 'one-time-pass', 'portal' => $portal])->assertUnprocessable();
    }

    public function test_the_college_a_superadmin_adds_gets_a_tpo_who_can_set_their_password(): void
    {
        Plan::create([
            'code' => 'standard', 'name' => 'Standard', 'audience' => Plan::AUDIENCE_INSTITUTION, 'list_price' => null,
            'annual_price' => 149000, 'duration_days' => 365, 'is_active' => true, 'sort_order' => 1,
            'drive_access' => true, 'max_students' => 500,
        ]);

        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_SUPERADMIN]));
        $created = $this->postJson('/api/admin/colleges', [
            'name' => 'Tulas Institute', 'tier' => 'Standard', 'tpo_name' => 'Asha Rao', 'tpo_email' => 'asha.rao@tulas.test',
        ])->assertCreated();
        $temporary = $created->json('temporary_password');

        $this->app['auth']->forgetGuards(); // the superadmin's session must not leak into the TPO's requests

        $this->postJson('/api/login', ['email' => 'asha.rao@tulas.test', 'password' => $temporary, 'portal' => 'admin_tpo'])
            ->assertOk()->assertJsonPath('must_change_password', true);

        // Even typed in capitals, as a TPO often does from a business card (MySQL/MariaDB compare emails case-insensitively; SQLite doesn't).
        $this->resetThroughTheApi(in_array(DB::getDriverName(), ['mysql', 'mariadb'], true) ? 'Asha.Rao@Tulas.test' : 'asha.rao@tulas.test');

        $this->postJson('/api/login', ['email' => 'asha.rao@tulas.test', 'password' => self::NEW_PASSWORD, 'portal' => 'admin_tpo'])
            ->assertOk()->assertJsonPath('user.role', User::ROLE_ADMIN_TPO);
        $this->postJson('/api/login', ['email' => 'asha.rao@tulas.test', 'password' => $temporary, 'portal' => 'admin_tpo'])->assertUnprocessable();
    }

    public function test_a_superadmin_cannot_self_reset_and_the_answer_does_not_give_that_away(): void
    {
        $admin = User::factory()->create(['role' => User::ROLE_SUPERADMIN]);
        $student = User::factory()->create();

        $a = $this->postJson('/api/password/forgot', ['email' => $admin->email])->assertOk()->json();
        $b = $this->postJson('/api/password/forgot', ['email' => $student->email])->assertOk()->json();
        $c = $this->postJson('/api/password/forgot', ['email' => 'nobody@nowhere.test'])->assertOk()->json();

        $this->assertSame($a, $b);
        $this->assertSame($b, $c);
        Mail::assertSent(PasswordResetOtpMail::class, 1);
        Mail::assertSent(PasswordResetOtpMail::class, fn ($mail) => $mail->hasTo($student->email));
    }

    public function test_a_wrong_code_is_refused_and_a_code_for_one_account_never_unlocks_another(): void
    {
        $alice = User::factory()->create();
        $bob = User::factory()->create();

        $this->postJson('/api/password/forgot', ['email' => $alice->email])->assertOk();
        $aliceCode = Mail::sent(PasswordResetOtpMail::class)->last()->code;
        $wrong = $aliceCode === '000000' ? '111111' : '000000';

        $this->postJson('/api/password/otp/verify', ['email' => $alice->email, 'code' => $wrong])->assertUnprocessable();
        $this->postJson('/api/password/otp/verify', ['email' => $bob->email, 'code' => $aliceCode])->assertUnprocessable();
        $this->postJson('/api/password/otp/verify', ['email' => $alice->email, 'code' => $aliceCode])->assertOk();
    }

    public function test_a_token_for_one_account_cannot_reset_another_accounts_password(): void
    {
        $alice = User::factory()->create(['password' => Hash::make('alice-old-pass')]);
        $bob = User::factory()->create(['password' => Hash::make('bob-old-pass')]);

        $this->postJson('/api/password/forgot', ['email' => $alice->email])->assertOk();
        $code = Mail::sent(PasswordResetOtpMail::class)->last()->code;
        $token = $this->postJson('/api/password/otp/verify', ['email' => $alice->email, 'code' => $code])->json('reset_token');

        $this->postJson('/api/password/reset', [
            'email' => $bob->email, 'reset_token' => $token,
            'password' => self::NEW_PASSWORD, 'password_confirmation' => self::NEW_PASSWORD,
        ])->assertUnprocessable();

        $this->assertTrue(Hash::check('bob-old-pass', $bob->fresh()->password));
    }

    public function test_the_new_password_rules_are_enforced_and_a_failed_attempt_does_not_burn_the_token(): void
    {
        $user = User::factory()->create();
        $this->postJson('/api/password/forgot', ['email' => $user->email])->assertOk();
        $code = Mail::sent(PasswordResetOtpMail::class)->last()->code;
        $token = $this->postJson('/api/password/otp/verify', ['email' => $user->email, 'code' => $code])->json('reset_token');

        $this->postJson('/api/password/reset', ['email' => $user->email, 'reset_token' => $token, 'password' => 'short', 'password_confirmation' => 'short'])
            ->assertUnprocessable()->assertJsonValidationErrors('password');
        $this->postJson('/api/password/reset', ['email' => $user->email, 'reset_token' => $token, 'password' => self::NEW_PASSWORD, 'password_confirmation' => 'different-one-1'])
            ->assertUnprocessable()->assertJsonValidationErrors('password');

        $this->postJson('/api/password/reset', ['email' => $user->email, 'reset_token' => $token, 'password' => self::NEW_PASSWORD, 'password_confirmation' => self::NEW_PASSWORD])
            ->assertOk();
    }

    public function test_a_blocked_account_can_reset_but_still_cannot_sign_in(): void
    {
        $user = User::factory()->create(['is_blocked' => true]);

        $this->resetThroughTheApi($user->email);

        $this->postJson('/api/login', ['email' => $user->email, 'password' => self::NEW_PASSWORD])
            ->assertUnprocessable()->assertJsonValidationErrors('email');
    }

    public function test_a_whole_class_behind_one_college_address_can_activate_together(): void
    {
        $students = User::factory()->count(40)->create(['must_change_password' => true, 'password' => Hash::make('one-time-pass')]);

        // Every request here comes from the same IP (127.0.0.1), all inside one minute.
        foreach ($students as $student) {
            $this->postJson('/api/login', ['email' => $student->email, 'password' => 'one-time-pass', 'portal' => 'user'])
                ->assertOk()->assertJsonPath('must_change_password', true);

            $this->resetThroughTheApi($student->email);

            $this->postJson('/api/login', ['email' => $student->email, 'password' => self::NEW_PASSWORD, 'portal' => 'user'])
                ->assertOk()->assertJsonStructure(['token']);
        }
    }

    public function test_one_email_is_still_limited_so_a_code_cannot_be_hammered(): void
    {
        $user = User::factory()->create();

        foreach (range(1, 3) as $_) {
            $this->postJson('/api/password/forgot', ['email' => $user->email])->assertOk();
        }
        $this->postJson('/api/password/forgot', ['email' => $user->email])->assertStatus(429);

        foreach (range(1, 10) as $_) {
            $this->postJson('/api/password/otp/verify', ['email' => $user->email, 'code' => '000000'])->assertUnprocessable();
        }
        $this->postJson('/api/password/otp/verify', ['email' => $user->email, 'code' => '000000'])->assertStatus(429);
    }
}
