<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\SendWelcomeEmail;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /**
     * Public self-registration — always a personal, college-less ("Mellow
     * Direct") student account. Staff, TPO, and superadmin accounts are
     * provisioned by administrators (see AdminController) so a caller can
     * never grant themselves elevated access through this endpoint, and a
     * campus-affiliated college_id is only ever set by a TPO's roster
     * import or admin action — never by the registrant themselves, which
     * is why there's no college input accepted here at all.
     */
    public function register(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'handle' => ['required', 'string', 'max:64', 'alpha_dash', 'unique:users,handle'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'handle' => $validated['handle'],
            'password' => Hash::make($validated['password']),
            'role' => User::ROLE_USER,
        ]);

        SendWelcomeEmail::dispatch($user->id);

        $token = $user->createToken('auth')->plainTextToken;

        return response()->json([
            'user' => $user->load(['college', 'company']),
            'token' => $token,
        ], 201);
    }

    public function login(Request $request)
    {
        $validated = $request->validate([
            'email' => ['required', 'string', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::where('email', $validated['email'])->first();

        if (! $user || ! Hash::check($validated['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['These credentials do not match our records.'],
            ]);
        }

        if ($user->is_blocked) {
            throw ValidationException::withMessages([
                'email' => ['This account has been blocked. Contact an administrator.'],
            ]);
        }

        // A password an admin generated on this account's behalf (manual
        // add, bulk import, TPO/staff/superadmin onboarding) is a one-time
        // credential proving "you received the welcome email," never a real
        // session key — no token is issued here. The frontend routes this
        // response into the same OTP-verified flow as Forgot Password (see
        // PasswordResetController/PasswordResetService, reused as-is) so the
        // account stays locked out of the dashboard until its owner proves
        // control of the inbox and sets their own permanent password.
        if ($user->must_change_password) {
            return response()->json([
                'must_change_password' => true,
                'email' => $user->email,
                'message' => 'This is a one-time password. Verify your email and set a new password to continue.',
            ]);
        }

        $token = $user->createToken('auth')->plainTextToken;

        return response()->json([
            'user' => $user->load(['college', 'company']),
            'token' => $token,
        ]);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Logged out.']);
    }

    public function me(Request $request)
    {
        return response()->json([
            'user' => $request->user()->load(['college', 'company']),
        ]);
    }

    /**
     * Self-service identity update, shared by every role's Settings page.
     * Deliberately excludes college_id/roll_number/branch/cgpa/backlogs —
     * those are the placement cell's source of truth (set via TPO/staff
     * bulk import), so a student can't quietly edit their own CGPA here.
     */
    public function updateProfile(Request $request)
    {
        $user = $request->user();

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'handle' => ['nullable', 'string', 'max:64', 'alpha_dash', Rule::unique('users', 'handle')->ignore($user->id)],
            'phone' => ['nullable', 'string', 'max:20'],
        ]);

        // A verified phone (see PhoneVerificationController) can never be
        // changed through this generic endpoint — the frontend already
        // locks the field once verified, but this is the real enforcement.
        // A no-op resubmit of the same value (the normal case, since the
        // locked input still round-trips through this same form) is
        // silently dropped rather than rejected; only a genuine attempt to
        // change it is an error.
        if ($user->isPhoneVerified()) {
            if (array_key_exists('phone', $validated) && $validated['phone'] !== $user->phone) {
                return response()->json(['message' => 'Your phone number is verified and cannot be changed here. Contact support to update it.'], 422);
            }
            unset($validated['phone']);
        }

        $user->forceFill($validated)->save();

        return response()->json(['user' => $user->fresh()->load(['college', 'company'])]);
    }

    /**
     * Real profile-photo upload, shared by every role's Settings page — the
     * first file-serving feature in this app (every other avatar in the UI
     * is an initials+color placeholder, see frontend/src/lib/avatarColor.ts).
     * Stored on the `public` disk (requires `php artisan storage:link`) and
     * overwrites any previous photo rather than accumulating orphaned files.
     */
    public function updateAvatar(Request $request)
    {
        $user = $request->user();

        $validated = $request->validate([
            'avatar' => ['required', 'image', 'mimes:jpeg,png,webp', 'max:2048'],
        ]);

        if ($user->avatar_path) {
            Storage::disk('public')->delete($user->avatar_path);
        }

        $path = $validated['avatar']->storeAs('avatars', $user->id.'.'.$validated['avatar']->extension(), 'public');

        $user->forceFill(['avatar_path' => $path])->save();

        return response()->json(['user' => $user->fresh()->load(['college', 'company'])]);
    }

    public function deleteAvatar(Request $request)
    {
        $user = $request->user();

        if ($user->avatar_path) {
            Storage::disk('public')->delete($user->avatar_path);
            $user->forceFill(['avatar_path' => null])->save();
        }

        return response()->json(['user' => $user->fresh()->load(['college', 'company'])]);
    }

    public function updatePassword(Request $request)
    {
        $user = $request->user();

        $validated = $request->validate([
            'current_password' => ['required', 'string'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        if (! Hash::check($validated['current_password'], $user->password)) {
            throw ValidationException::withMessages([
                'current_password' => ['Your current password is incorrect.'],
            ]);
        }

        $user->forceFill([
            'password' => Hash::make($validated['password']),
            'must_change_password' => false,
        ])->save();

        return response()->json(['message' => 'Password updated.']);
    }

    /**
     * Real active-session list, sourced from the caller's own Sanctum
     * tokens — replaces a device list that used to be hardcoded UI mock.
     * No IP/geo/device-name capture exists yet, so we surface what's
     * actually real (issued/last-used times) rather than fabricate the rest.
     */
    public function sessions(Request $request)
    {
        $currentTokenId = $request->user()->currentAccessToken()?->id;

        $tokens = $request->user()->tokens()
            ->orderByDesc('last_used_at')
            ->get(['id', 'name', 'created_at', 'last_used_at']);

        return response()->json([
            'sessions' => $tokens->map(fn ($token) => [
                'id' => $token->id,
                'name' => $token->name,
                'created_at' => $token->created_at,
                'last_used_at' => $token->last_used_at,
                'is_current' => $token->id === $currentTokenId,
            ]),
        ]);
    }

    public function revokeSession(Request $request, int $tokenId)
    {
        $currentTokenId = $request->user()->currentAccessToken()?->id;

        if ($tokenId === $currentTokenId) {
            return response()->json(['message' => 'You cannot revoke your current session. Sign out instead.'], 422);
        }

        $deleted = $request->user()->tokens()->where('id', $tokenId)->delete();

        if (! $deleted) {
            return response()->json(['message' => 'Session not found.'], 404);
        }

        return response()->json(['message' => 'Session revoked.']);
    }
}
