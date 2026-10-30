<?php

namespace Tests\Feature;

use App\Mail\PasswordResetOtpMail;
use App\Models\PasswordResetOtp;
use App\Models\User;
use App\Services\PasswordResetService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * A reset code is good for a week and stays good until the person sets a password of their own — however many
 * times they ask for the code again. Setting the password ends it (and any token it earned) on the spot.
 */
class PasswordResetLifetimeTest extends TestCase
{
    use RefreshDatabase;

    private PasswordResetService $service;

    protected function setUp(): void
    {
        parent::setUp();

        Mail::fake();
        $this->service = app(PasswordResetService::class);
    }

    private function tpo(array $attributes = []): User
    {
        return User::factory()->create(array_merge([
            'role' => User::ROLE_ADMIN_TPO,
            'must_change_password' => true,
            'password' => Hash::make('the-temporary-one'),
        ], $attributes));
    }

    /** Asks for a code the way the form does and returns the one that was emailed. */
    private function requestCode(User $user): string
    {
        $before = Mail::sent(PasswordResetOtpMail::class)->count();
        $this->service->requestOtp($user);
        $sent = Mail::sent(PasswordResetOtpMail::class);

        $this->assertCount($before + 1, $sent, 'every request must send an email');

        return $sent->last()->code;
    }

    private function assertCodeRejected(User $user, string $code): void
    {
        try {
            $this->service->verifyOtp($user, $code);
            $this->fail('the code should have been rejected');
        } catch (ValidationException $e) {
            $this->assertSame([PasswordResetService::INVALID_CODE_MESSAGE], $e->errors()['code']);
        }
    }

    private function assertTokenRejected(User $user, string $token): void
    {
        try {
            $this->service->resetPassword($user, $token, 'a-brand-new-password');
            $this->fail('the token should have been rejected');
        } catch (ValidationException $e) {
            $this->assertSame([PasswordResetService::INVALID_TOKEN_MESSAGE], $e->errors()['reset_token']);
        }
    }

    public function test_the_code_is_issued_for_a_week(): void
    {
        $user = $this->tpo();
        $this->requestCode($user);

        $otp = PasswordResetOtp::where('user_id', $user->id)->sole();
        $this->assertEqualsWithDelta(7 * 24 * 3600, now()->diffInSeconds($otp->expires_at), 5);
    }

    public function test_the_whole_flow_still_works_after_six_days_and_a_bit(): void
    {
        $user = $this->tpo();
        $code = $this->requestCode($user);

        $this->travelTo(now()->addDays(6)->addHours(23));

        $token = $this->service->verifyOtp($user, $code);
        $this->service->resetPassword($user, $token, 'a-brand-new-password');

        $this->assertTrue(Hash::check('a-brand-new-password', $user->fresh()->password));
        $this->assertFalse($user->fresh()->must_change_password);
    }

    public function test_the_code_is_dead_after_a_week(): void
    {
        $user = $this->tpo();
        $code = $this->requestCode($user);

        $this->travelTo(now()->addDays(7)->addMinute());

        $this->assertCodeRejected($user, $code);
    }

    public function test_the_verified_token_is_also_dead_after_a_week(): void
    {
        $user = $this->tpo();
        $token = $this->service->verifyOtp($user, $this->requestCode($user));

        $this->travelTo(now()->addDays(7)->addMinute());

        $this->assertTokenRejected($user, $token);
    }

    public function test_asking_again_re_sends_the_same_code_and_never_invalidates_the_first_email(): void
    {
        $user = $this->tpo();

        $first = $this->requestCode($user);
        $second = $this->requestCode($user);
        $third = $this->requestCode($user);

        $this->assertSame($first, $second);
        $this->assertSame($first, $third);
        $this->assertSame(1, PasswordResetOtp::where('user_id', $user->id)->count(), 'one live code per person');

        // The very first email still works after two more were sent.
        $this->assertNotEmpty($this->service->verifyOtp($user, $first));
    }

    public function test_asking_again_does_not_shorten_or_extend_the_week(): void
    {
        $user = $this->tpo();
        $this->requestCode($user);
        $expires = PasswordResetOtp::where('user_id', $user->id)->sole()->expires_at;

        $this->travel(3)->days();
        $this->requestCode($user);

        $this->assertTrue($expires->equalTo(PasswordResetOtp::where('user_id', $user->id)->sole()->expires_at));
    }

    public function test_a_token_already_earned_survives_asking_for_another_code(): void
    {
        $user = $this->tpo();
        $token = $this->service->verifyOtp($user, $this->requestCode($user));

        $this->travel(2)->days();
        $this->requestCode($user);
        $this->requestCode($user);

        $this->service->resetPassword($user, $token, 'a-brand-new-password');

        $this->assertTrue(Hash::check('a-brand-new-password', $user->fresh()->password));
    }

    public function test_once_the_password_is_set_the_code_and_the_token_are_dead_immediately(): void
    {
        $user = $this->tpo();
        $code = $this->requestCode($user);
        $token = $this->service->verifyOtp($user, $code);

        $this->service->resetPassword($user, $token, 'a-brand-new-password');

        $this->assertNotNull(PasswordResetOtp::where('user_id', $user->id)->sole()->consumed_at);
        $this->assertTokenRejected($user, $token);
        $this->assertCodeRejected($user, $code);
    }

    public function test_after_a_successful_reset_asking_again_issues_a_brand_new_code(): void
    {
        $user = $this->tpo();
        $old = $this->requestCode($user);
        $this->service->resetPassword($user, $this->service->verifyOtp($user, $old), 'a-brand-new-password');

        $new = $this->requestCode($user);

        $this->assertNotSame($old, $new);
        $this->assertCodeRejected($user, $old);
        $this->assertNotEmpty($this->service->verifyOtp($user, $new));
    }

    public function test_asking_after_the_week_is_up_issues_a_brand_new_code(): void
    {
        $user = $this->tpo();
        $old = $this->requestCode($user);

        $this->travel(8)->days();
        $new = $this->requestCode($user);

        $this->assertNotSame($old, $new);
        $this->assertSame(1, PasswordResetOtp::where('user_id', $user->id)->count());
        $this->assertNotEmpty($this->service->verifyOtp($user, $new));
    }

    public function test_changing_the_password_in_settings_ends_an_outstanding_reset(): void
    {
        $user = $this->tpo(['must_change_password' => false, 'password' => Hash::make('current-password')]);
        $code = $this->requestCode($user);
        $token = $this->service->verifyOtp($user, $code);

        Sanctum::actingAs($user);
        $this->putJson('/api/me/password', [
            'current_password' => 'current-password',
            'password' => 'my-own-new-password',
            'password_confirmation' => 'my-own-new-password',
        ])->assertOk();

        $this->assertTokenRejected($user, $token);
        $this->assertCodeRejected($user, $code);
    }

    public function test_five_wrong_guesses_lock_the_code_until_it_is_asked_for_again_then_the_same_code_works(): void
    {
        $user = $this->tpo();
        $code = $this->requestCode($user);
        $wrong = $code === '111111' ? '222222' : '111111';

        foreach (range(1, 5) as $_) {
            $this->assertCodeRejected($user, $wrong);
        }

        $this->assertCodeRejected($user, $code); // locked — even the right one

        $this->assertSame($code, $this->requestCode($user));
        $this->assertNotEmpty($this->service->verifyOtp($user, $code));
    }

    public function test_a_superadmin_never_gets_a_code(): void
    {
        $admin = User::factory()->create(['role' => User::ROLE_SUPERADMIN]);

        $this->service->requestOtp($admin);

        Mail::assertNothingSent();
        $this->assertSame(0, PasswordResetOtp::count());
    }

    public function test_the_http_flow_end_to_end_for_a_freshly_added_college_tpo(): void
    {
        $tpo = $this->tpo(['email' => 'new.tpo@college.test']);

        $this->postJson('/api/password/forgot', ['email' => $tpo->email])->assertOk();
        $code = Mail::sent(PasswordResetOtpMail::class)->last()->code;

        $token = $this->postJson('/api/password/otp/verify', ['email' => $tpo->email, 'code' => $code])
            ->assertOk()->json('reset_token');

        $this->travel(10)->minutes(); // the old 10-minute limit would have killed it here

        $this->postJson('/api/password/reset', [
            'email' => $tpo->email,
            'reset_token' => $token,
            'password' => 'a-brand-new-password',
            'password_confirmation' => 'a-brand-new-password',
        ])->assertOk();

        $this->postJson('/api/password/reset', [
            'email' => $tpo->email,
            'reset_token' => $token,
            'password' => 'another-password-123',
            'password_confirmation' => 'another-password-123',
        ])->assertUnprocessable()->assertJsonPath('errors.reset_token.0', PasswordResetService::INVALID_TOKEN_MESSAGE);
    }
}
