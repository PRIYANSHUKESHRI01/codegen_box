<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * "View as user" is for looking, not acting.
 *
 * A superadmin who opens someone's account (SuperAdminAccountController::impersonate)
 * gets a token that may only READ. Anything that would change that person's data —
 * submitting code, buying a plan, changing their password or email, accepting a
 * drive — is refused here, in one place, rather than hoping every present and future
 * controller remembers to check. Sign-out is the one write allowed: it is how the
 * superadmin leaves.
 *
 * Real changes to an account are made from the superadmin tools, which are audited
 * under the superadmin's own name and not disguised as the user.
 */
class RejectWritesWhileImpersonating
{
    public const CODE = 'impersonation_read_only';

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user !== null
            && $user->isBeingImpersonated()
            && ! $request->isMethodSafe()
            && ! $request->is('api/logout')) {
            return response()->json([
                'message' => 'You are viewing this account as a superadmin, which is read-only. Exit "view as" to make changes from the superadmin tools.',
                'code' => self::CODE,
            ], 403);
        }

        return $next($request);
    }
}
