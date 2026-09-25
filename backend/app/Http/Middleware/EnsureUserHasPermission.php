<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserHasPermission
{
    /**
     * Restrict a route to one or more granular permissions, e.g.
     * ->middleware('permission:colleges'). Stacks on top of (never
     * replaces) the existing `role:` middleware on the same route — this
     * only narrows an admin_internal/admin_marketing account down further,
     * it never widens access for a role that shouldn't be on the route at
     * all. A caller passes if they hold ANY of the listed permissions.
     * Superadmin always passes (see User::hasPermission()).
     */
    public function handle(Request $request, Closure $next, string ...$permissions): Response
    {
        $user = $request->user();

        if (! $user || ! collect($permissions)->contains(fn (string $permission) => $user->hasPermission($permission))) {
            return response()->json([
                'message' => 'You do not have access to this section. Ask your superadmin to grant it.',
            ], 403);
        }

        return $next($request);
    }
}
