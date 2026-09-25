<?php

namespace App\Services;

use App\Jobs\SendPasswordResetOtpEmail;
use App\Models\PasswordResetOtp;
use App\Models\User;
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

    private const OTP_LIFETIME_MINUTES = 10;

    private const MAX_ATTEMPTS = 5;

    /**
     * Superadmin accounts are never created through a self-service API path
     * (see SuperAdminController::storeUser's own docblock) and never get a
     * self-service reset either — this silently does nothing for one, so
     * the controller's identical generic response for every outcome never
     * leaks which emails belong to a superadmin.
     */
    public function requestOtp(User $user): void
    {
        if ($user->role === User::ROLE_SUPERADMIN) {
            return;
        }

        PasswordResetOtp::where('user_id', $user->id)->whereNull('consumed_at')->delete();

        $code = (string) random_int(100000, 999999);

        PasswordResetOtp::create([
            'user_id' => $user->id,
            'code_hash' => Hash::make($code),
            'expires_at' => now()->addMinutes(self::OTP_LIFETIME_MINUTES),
        ]);

        SendPasswordResetOtpEmail::dispatch($user->id, $code);
    }

    /** @return string the raw reset token to hand back to the caller — never stored in plaintext */
    public function verifyOtp(User $user, string $code): string
    {
        $otp = PasswordResetOtp::where('user_id', $user->id)->whereNull('consumed_at')->latest()->first();

        if (! $otp || $otp->isExpired() || $otp->attempts >= self::MAX_ATTEMPTS) {
            throw ValidationException::withMessages(['code' => [self::INVALID_CODE_MESSAGE]]);
        }

        if (! Hash::check($code, $otp->code_hash)) {
            $otp->increment('attempts');

            throw ValidationException::withMessages(['code' => [self::INVALID_CODE_MESSAGE]]);
        }

        $rawToken = Str::random(64);
        $otp->forceFill(['reset_token_hash' => Hash::make($rawToken)])->save();

        return $rawToken;
    }

    public function resetPassword(User $user, string $rawToken, string $newPassword): void
    {
        $otp = PasswordResetOtp::where('user_id', $user->id)
            ->whereNull('consumed_at')
            ->whereNotNull('reset_token_hash')
            ->latest()
            ->first();

        if (! $otp || $otp->isExpired() || ! Hash::check($rawToken, $otp->reset_token_hash)) {
            throw ValidationException::withMessages(['reset_token' => [self::INVALID_TOKEN_MESSAGE]]);
        }

        // Also clears the one-time-password lock (see AuthController::login)
        // — setting a real password via this OTP-verified flow satisfies the
        // exact same "prove it's you, then pick your own password"
        // requirement as the dedicated first-login flow, so a temp-password
        // account that goes through Forgot Password instead is equally unlocked.
        $user->forceFill(['password' => Hash::make($newPassword), 'must_change_password' => false])->save();

        $otp->forceFill(['consumed_at' => now()])->save();

        // A password reset should invalidate any session an attacker might
        // already hold — same tokens() relation AuthController::sessions()/
        // revokeSession() already use for the equivalent manual action.
        $user->tokens()->delete();
    }
}
