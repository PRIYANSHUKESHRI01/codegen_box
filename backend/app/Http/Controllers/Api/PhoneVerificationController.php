<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\FirebaseTokenVerificationException;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\FirebasePhoneVerificationService;
use Illuminate\Http\Request;

/**
 * Self-scoped, shared by every role's Settings page (same "no role
 * middleware needed" shape as AuthController's other /me/* methods) — the
 * server-side half of the phone-OTP flow. The client-side half (reCAPTCHA +
 * send/confirm OTP) happens entirely in the browser against Firebase
 * directly (frontend/src/lib/firebase.ts); this endpoint's only input is the
 * resulting ID token, never a phone number typed by the client — the
 * verified phone number always comes from inside the token itself
 * (FirebasePhoneVerificationService), so there's no way to claim you
 * verified a different number than the one Firebase actually sent an OTP to.
 */
class PhoneVerificationController extends Controller
{
    public function __construct(private readonly FirebasePhoneVerificationService $service) {}

    public function verify(Request $request)
    {
        $user = $request->user();

        if ($user->isPhoneVerified()) {
            return response()->json(['message' => 'Your phone number is already verified.'], 422);
        }

        $validated = $request->validate([
            'id_token' => ['required', 'string'],
        ]);

        try {
            $claims = $this->service->verifyIdToken($validated['id_token']);
        } catch (FirebaseTokenVerificationException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        $phoneNumber = $claims['phone_number'];

        // A verified phone number is a much stronger identity claim than
        // the plain `phone` column (which staff can set freely, e.g. roster
        // import) — it must be unique platform-wide once backed by a real
        // OTP, same reasoning `email` is already implicitly unique via
        // login-by-email. Race-safe: the unique constraint isn't on this
        // column, so this is a best-effort pre-check; a true simultaneous
        // double-claim is vanishingly unlikely (same phone, same OTP
        // window, two different accounts) and would just leave two rows
        // both correctly reflecting "verified," not a security issue.
        $alreadyClaimedByAnother = User::where('phone_verified_at', '!=', null)
            ->where('phone', $phoneNumber)
            ->where('id', '!=', $user->id)
            ->exists();

        if ($alreadyClaimedByAnother) {
            return response()->json(['message' => 'This phone number is already verified on another account.'], 422);
        }

        $user->forceFill([
            'phone' => $phoneNumber,
            'phone_verified_at' => now(),
        ])->save();

        return response()->json(['user' => $user->fresh()->load(['college', 'company'])]);
    }
}
