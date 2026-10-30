<?php

namespace App\Services;

use App\Jobs\SendPasswordResetOtpEmail;
use App\Models\PasswordResetOtp;
use App\Models\User;
use App\Support\SingleMail;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * The one write path for the forgot-password-via-OTP flow. Deliberately not
 * built on Laravel's stock password-broker (Password::sendResetLink/reset):
 * that broker mints a 40-char random token with no attempts/lockout concept
 * because a token that long doesn't need one — a 6-digit code (900,000
 * possible values) genuinely does, and the broker's single-call design
 * (token + new password submitted together) has no room for this flow's
 * deliberate two-phase split (verify the code once, then let the user type
 * a new password separately, without burning the code if that second step
 * fails validation).
 */
class PasswordResetService
{
    /**
     * Used for every OTP-verification failure — wrong code, expired code,
     * too many attempts, or no code was ever issued (e.g. a superadmin
     * email, which requestOtp() silently skips) — so none of these are
     * distinguishable from the response text alone.
     */
    public const INVALID_CODE_MESSAGE = 'This code is invalid or has expired. Please request a new one.';

    public const INVALID_TOKEN_MESSAGE = 'This reset link has expired. Please start over.';

    /**
     * A code (and the reset token it earns) is good for a week from when it was first issued, and stays good until
     * the person sets a new password — however many times they ask for the code again.
     */
    public const OTP_LIFETIME_DAYS = 7;

    private const MAX_ATTEMPTS = 5;

    /**
     * Superadmin accounts are never created through a self-service API path
     * (see SuperAdminController::storeUser's own docblock) and never get a
     * self-service reset either — this silently does nothing for one, so
     * the controller's identical generic response for every outcome never
     * leaks which emails belong to a superadmin.
     *
     * While the person still has a live code this RE-SENDS it (a new request never invalidates what they already
     * hold — an older email, or a code they already verified, keeps working) and gives them a fresh set of
     * attempts. Otherwise a new code is issued, valid for OTP_LIFETIME_DAYS.
     */
    public function requestOtp(User $user): void
    {
        if ($user->role === User::ROLE_SUPERADMIN) {
            return;
        }

        $live = PasswordResetOtp::active()
            ->where('user_id', $user->id)
            ->whereNotNull('code_encrypted')
            ->latest('id')
            ->first();

        if ($live) {
            $live->forceFill(['attempts' => 0])->save();
            $code = $live->code_encrypted;
        } else {
            // Anything still here is expired, or predates re-sendable codes and can never be re-sent.
            PasswordResetOtp::where('user_id', $user->id)->whereNull('consumed_at')->delete();

            $code = (string) random_int(100000, 999999);

            PasswordResetOtp::create([
                'user_id' => $user->id,
                'code_hash' => Hash::make($code),
                'code_encrypted' => $code,
                'expires_at' => now()->addDays(self::OTP_LIFETIME_DAYS),
            ]);
        }

        SingleMail::afterResponse(new SendPasswordResetOtpEmail($user->id, $code));
    }

    /** @return string the raw reset token to hand back to the caller — never stored in plaintext */
    public function verifyOtp(User $user, string $code): string
    {
        // Normally one row; two only if two "send me a code" requests raced each other — both are real, so accept either.
        $candidates = PasswordResetOtp::active()
            ->where('user_id', $user->id)
            ->where('attempts', '<', self::MAX_ATTEMPTS)
            ->get();

        $otp = $candidates->first(fn (PasswordResetOtp $row) => Hash::check($code, $row->code_hash));

        if (! $otp) {
            $candidates->each(fn (PasswordResetOtp $row) => $row->increment('attempts'));

            throw ValidationException::withMessages(['code' => [self::INVALID_CODE_MESSAGE]]);
        }

        $rawToken = Str::random(64);
        $otp->forceFill(['reset_token_hash' => Hash::make($rawToken)])->save();

        return $rawToken;
    }

    public function resetPassword(User $user, string $rawToken, string $newPassword): void
    {
        $otp = PasswordResetOtp::active()
            ->where('user_id', $user->id)
            ->whereNotNull('reset_token_hash')
            ->get()
            ->first(fn (PasswordResetOtp $row) => Hash::check($rawToken, $row->reset_token_hash));

        if (! $otp) {
            throw ValidationException::withMessages(['reset_token' => [self::INVALID_TOKEN_MESSAGE]]);
        }

        // Also clears the one-time-password lock (see AuthController::login)
        // — setting a real password via this OTP-verified flow satisfies the
        // exact same "prove it's you, then pick your own password"
        // requirement as the dedicated first-login flow, so a temp-password
        // account that goes through Forgot Password instead is equally unlocked.
        // Somebody ELSE added this account (college roster, bulk import, TPO, Mellow staff) and its owner is setting their
        // own password for the first time: this is the moment it becomes theirs, so it gets a welcome instead of a
        // "password changed" notice. (A superadmin never reaches here — requestOtp() refuses them — and is not created this way.)
        $firstActivation = $user->must_change_password && $user->role !== User::ROLE_SUPERADMIN;

        $user->forceFill(['password' => Hash::make($newPassword), 'must_change_password' => false])->save();

        app(IssuedCredentialVault::class)->forget($user);

        $this->expirePendingResets($user);

        // A password reset should invalidate any session an attacker might
        // already hold — same tokens() relation AuthController::sessions()/
        // revokeSession() already use for the equivalent manual action.
        $user->tokens()->delete();

        $mail = app(LifecycleMailService::class);

        if (! ($firstActivation && $mail->welcomeActivated($user))) {
            $mail->passwordChanged($user, 'reset');
        }
    }

    /**
     * Ends every outstanding reset code and token for this user at once. Called the moment they set a password of
     * their own — here, or from Settings — so nothing they were sent earlier can be used afterwards.
     */
    public function expirePendingResets(User $user): void
    {
        PasswordResetOtp::where('user_id', $user->id)->whereNull('consumed_at')->update(['consumed_at' => now()]);
    }
}
