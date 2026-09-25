<?php

namespace App\Services;

use App\Exceptions\FirebaseTokenVerificationException;
use Firebase\JWT\JWK;
use Firebase\JWT\JWT;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

/**
 * Verifies a Firebase Auth ID token server-side WITHOUT the Firebase Admin
 * SDK / a service account — deliberate, since this app only has the
 * browser-side Firebase config (see config('services.firebase'), all
 * public-by-design client identifiers), not admin credentials. This is
 * Firebase's own documented approach for exactly that situation ("Verify ID
 * tokens using a third-party JWT library"): fetch Google's current public
 * keys for the `securetoken` service account and verify the token's RS256
 * signature against them, then check the claims Firebase's own SDK would
 * otherwise check for you (issuer/audience/expiry/auth_time).
 *
 * Scale note (this app's actual concern — "50 people verifying at once"):
 * the OTP send/confirm round-trip never touches this backend at all — the
 * browser's Firebase SDK talks directly to Google (see
 * frontend/src/lib/firebase.ts). This service's only job is the ONE-TIME
 * signature check on the resulting ID token, and the public keys are cached
 * (see JWKS_CACHE_TTL) — so verifying 50 tokens concurrently is 50 cheap
 * local RSA signature checks against an already-warm in-memory/cache key
 * set, not 50 outbound calls to Google.
 */
class FirebasePhoneVerificationService
{
    private const JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

    private const JWKS_CACHE_KEY = 'firebase.auth.jwks';

    /** Conservative relative to Google's own Cache-Control (~6h on this endpoint) — keeps key rotation windows short without meaningfully increasing request volume, since this is a cache, not a per-request call. */
    private const JWKS_CACHE_TTL_SECONDS = 3600;

    /**
     * @return array{uid: string, phone_number: string, auth_time: int}
     *
     * @throws FirebaseTokenVerificationException
     */
    public function verifyIdToken(string $idToken): array
    {
        $projectId = config('services.firebase.project_id');

        if (! $projectId) {
            throw new FirebaseTokenVerificationException('Phone verification is not configured.');
        }

        $keySet = $this->fetchJwks();

        try {
            /** @var \stdClass $payload */
            $payload = JWT::decode($idToken, JWK::parseKeySet($keySet, 'RS256'));
        } catch (\Throwable $e) {
            throw new FirebaseTokenVerificationException('This verification could not be confirmed — it may have expired. Please try again.');
        }

        $expectedIssuer = "https://securetoken.google.com/{$projectId}";

        if (($payload->iss ?? null) !== $expectedIssuer || ($payload->aud ?? null) !== $projectId) {
            throw new FirebaseTokenVerificationException('This verification does not belong to this app.');
        }

        // auth_time is Firebase-specific (not part of the JWT lib's own
        // exp/iat/nbf checks) — reject anything claiming to be from the
        // future (clock skew tolerance matches JWT::$leeway default usage
        // elsewhere: a flat 60s is generous for real client clocks).
        $authTime = (int) ($payload->auth_time ?? 0);
        if ($authTime <= 0 || $authTime > time() + 60) {
            throw new FirebaseTokenVerificationException('This verification could not be confirmed. Please try again.');
        }

        $phoneNumber = $payload->phone_number ?? null;
        $uid = $payload->sub ?? null;

        if (! is_string($phoneNumber) || $phoneNumber === '' || ! is_string($uid) || $uid === '') {
            throw new FirebaseTokenVerificationException('This sign-in was not a verified phone number.');
        }

        return [
            'uid' => $uid,
            'phone_number' => $phoneNumber,
            'auth_time' => $authTime,
        ];
    }

    /** @return array{keys: array<int, array<string, mixed>>} */
    private function fetchJwks(): array
    {
        return Cache::remember(self::JWKS_CACHE_KEY, self::JWKS_CACHE_TTL_SECONDS, function () {
            $response = Http::timeout(5)->get(self::JWKS_URL);

            if (! $response->successful()) {
                throw new FirebaseTokenVerificationException('Phone verification is temporarily unavailable. Please try again shortly.');
            }

            return $response->json();
        });
    }
}
