<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\PasswordResetService;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/**
 * Fully unauthenticated — this is how a locked-out user gets back in, so it
 * can't require a session. Every method looks up the user itself rather
 * than trusting a caller-supplied id, and never reveals whether a given
 * email exists (see PasswordResetService::requestOtp's superadmin no-op and
 * the identical error text used for "wrong code" vs "no code was ever
 * issued").
 */
class PasswordResetController extends Controller
{
    public function forgot(Request $request, PasswordResetService $service)
    {
        $validated = $request->validate([
            'email' => ['required', 'string', 'email'],
        ]);

        $user = User::where('email', $validated['email'])->first();

        if ($user) {
            $service->requestOtp($user);
        }

        return response()->json([
            'message' => 'If an account exists for that email, a verification code has been sent.',
        ]);
    }

    public function verifyOtp(Request $request, PasswordResetService $service)
    {
        $validated = $request->validate([
            'email' => ['required', 'string', 'email'],
            'code' => ['required', 'string', 'digits:6'],
        ]);

        $user = User::where('email', $validated['email'])->first();

        if (! $user) {
            throw ValidationException::withMessages(['code' => [PasswordResetService::INVALID_CODE_MESSAGE]]);
        }

        $resetToken = $service->verifyOtp($user, $validated['code']);

        return response()->json(['reset_token' => $resetToken]);
    }

    public function reset(Request $request, PasswordResetService $service)
    {
        $validated = $request->validate([
            'email' => ['required', 'string', 'email'],
            'reset_token' => ['required', 'string'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $user = User::where('email', $validated['email'])->first();

        if (! $user) {
            throw ValidationException::withMessages(['reset_token' => [PasswordResetService::INVALID_TOKEN_MESSAGE]]);
        }

        $service->resetPassword($user, $validated['reset_token'], $validated['password']);

        return response()->json(['message' => 'Your password has been reset. You can now sign in.']);
    }
}
