<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Makes "Block account" take effect on the very next request.
 *
 * `is_blocked` used to be read only at login, so a session that was already open
 * (a token in someone's browser) kept working for as long as that token lived:
 * blocking a student mid-exam, or a departed staff member, did nothing until they
 * happened to sign out. The user row is already loaded for authentication, so this
 * costs no extra query.
 *
 * Sign-out stays allowed so a blocked browser can still discard its own token.
 * The `code` is what the frontend keys on to end the session cleanly instead of
 * showing a wall of "forbidden" errors.
 */
class EnsureAccountIsActive
{
    public const CODE = 'account_blocked';

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user !== null && $user->is_blocked && ! $request->is('api/logout')) {
            return response()->json([
                'message' => 'This account has been blocked. Contact an administrator.',
                'code' => self::CODE,
            ], 403);
        }

        return $next($request);
    }
}
