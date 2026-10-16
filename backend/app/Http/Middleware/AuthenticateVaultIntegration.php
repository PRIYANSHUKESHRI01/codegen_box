<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * The credential for the routes Mellow Vault itself calls (/api/vault/v1/*): a
 * bearer token that must equal VAULT_API_KEY. Those routes carry students' profile
 * data, so with no key configured they answer 503 rather than being open, and the
 * comparison is constant-time.
 *
 * Deliberately separate from Sanctum: Mellow Vault is a system, not a user, and
 * there is no account whose token could be borrowed to reach these routes.
 */
class AuthenticateVaultIntegration
{
    public function handle(Request $request, Closure $next): Response
    {
        $key = (string) config('vault.api_key');

        if ($key === '') {
            return response()->json([
                'message' => 'The Vault integration is not configured on this server.',
                'code' => 'vault_not_configured',
            ], 503);
        }

        $given = (string) $request->bearerToken();

        if ($given === '' || ! hash_equals($key, $given)) {
            return response()->json(['message' => 'Unauthenticated.', 'code' => 'vault_unauthenticated'], 401, ['WWW-Authenticate' => 'Bearer']);
        }

        return $next($request);
    }
}
