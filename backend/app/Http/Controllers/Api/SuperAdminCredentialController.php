<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\ConfirmsSuperadminPassword;
use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\User;
use App\Services\IssuedCredentialVault;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

/**
 * Superadmin → look up the login an account was ISSUED.
 *
 * What can and cannot be shown: passwords are one-way hashes, so a password an owner chose is not recoverable and is
 * never shown. What a superadmin CAN see is the temporary password the platform (or a superadmin) issued, for as long as
 * the owner has not replaced it — see IssuedCredentialVault for how it is held (encrypted, wiped when the owner sets their
 * own, re-verified against the account's hash on every lookup). Superadmin accounts are never revealed.
 *
 * Layers between a stolen session and a leaked password:
 *   1. the superadmin role (route group) — and view-as tokens, which belong to the viewed user, never reach it;
 *   2. an UNLOCK that re-checks the superadmin's own password and lasts a few minutes, tied to the exact session token;
 *   3. a tight rate limit on both calls;
 *   4. every reveal is audited (who, whom, when) — the audit trail never contains the password;
 *   5. responses are marked no-store, so no browser or proxy keeps a copy.
 */
class SuperAdminCredentialController extends Controller
{
    use ConfirmsSuperadminPassword;

    /** How long one password confirmation keeps the credentials view open. */
    public const UNLOCK_MINUTES = 10;

    public function __construct(private readonly IssuedCredentialVault $vault) {}

    /** Confirm the superadmin's own password once; credential lookups then work for UNLOCK_MINUTES on this session only. */
    public function unlock(Request $request): JsonResponse
    {
        $validated = $request->validate(['password' => ['required', 'string']]);

        $this->confirmSuperadminPassword($request, $validated['password']);

        $expiresAt = now()->addMinutes(self::UNLOCK_MINUTES);
        Cache::put($this->unlockKey($request), true, $expiresAt);

        return $this->noStore(['unlocked' => true, 'expires_at' => $expiresAt->toIso8601String()]);
    }

    /** Close the credentials view straight away (the "Lock" button). */
    public function lock(Request $request): JsonResponse
    {
        Cache::forget($this->unlockKey($request));

        return $this->noStore(['unlocked' => false]);
    }

    public function status(Request $request): JsonResponse
    {
        return $this->noStore(['unlocked' => Cache::has($this->unlockKey($request))]);
    }

    public function reveal(Request $request, User $user): JsonResponse
    {
        if ($user->role === User::ROLE_SUPERADMIN) {
            return $this->noStore(['message' => 'A superadmin\'s password is never shown. A superadmin changes their own from Settings.', 'state' => IssuedCredentialVault::STATE_PROTECTED], 422);
        }

        if (! Cache::has($this->unlockKey($request))) {
            return $this->noStore(['message' => 'Enter your password to view login details.', 'code' => 'credentials_locked'], 428);
        }

        $found = $this->vault->peek($user);

        ActivityLog::record(
            $request->user(),
            $found['password'] !== null ? 'Viewed an account\'s login credentials' : 'Looked up an account\'s login credentials (none available)',
            'User',
            $user->name,
            // Never the password itself — the audit trail is readable by other staff.
            ['role' => $user->role, 'state' => $found['state']]
        );

        return $this->noStore([
            'login_id' => $user->email,
            'password' => $found['password'],
            'state' => $found['state'],
            'source' => $found['source'],
            'issued_at' => $found['issued_at'],
            'expires_at' => $found['expires_at'],
        ]);
    }

    /** Tied to the exact token, so the same superadmin signed in elsewhere (or a stolen copy of another session) is not unlocked. */
    private function unlockKey(Request $request): string
    {
        $user = $request->user();
        $tokenId = $user->currentAccessToken()?->id ?? 'session';

        return "superadmin-credentials-unlock:{$user->id}:{$tokenId}";
    }

    private function noStore(array $body, int $status = 200): JsonResponse
    {
        return response()->json($body, $status)->withHeaders([
            'Cache-Control' => 'no-store, private',
            'Pragma' => 'no-cache',
        ]);
    }
}
