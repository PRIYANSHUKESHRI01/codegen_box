<?php

namespace App\Http\Middleware;

use App\Support\DepartmentCapabilities;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Restrict a student route to students whose programme has the module, e.g. ->middleware('capability:coding_practice').
 *
 * The browser hides what a student's department does not have (the sidebar, the home page), but hiding is not security:
 * this is the same decision made where it counts. It only ever narrows STUDENTS — staff (a TPO previewing the problem catalogue
 * to build a mock contest, Mellow Ops authoring) and hiring partners pass untouched, because capabilities describe what a
 * student's own programme offers, not what a role may administer. A student passes if they have ANY of the listed capabilities.
 *
 * The answer is 403 with a `capability_unavailable` code and the department's name, so the client can say "not part of your
 * programme" instead of a generic failure. Students can opt in to coding from Settings, which is already folded into the map.
 */
class EnsureStudentHasCapability
{
    public function handle(Request $request, Closure $next, string ...$capabilities): Response
    {
        $user = $request->user();

        if ($user === null || ! $user->isStudent()) {
            return $next($request);
        }

        $caps = DepartmentCapabilities::forUser($user);

        foreach ($capabilities as $capability) {
            if ($caps[$capability] ?? true) {
                return $next($request);
            }
        }

        return response()->json([
            'message' => 'This is not part of your programme. If you want it anyway, you can switch it on in Settings.',
            'code' => 'capability_unavailable',
            'capability' => $capabilities[0] ?? null,
            'can_opt_in' => collect($capabilities)->contains(fn (string $c) => in_array($c, (array) config('departments.student_opt_in', []), true)),
        ], 403);
    }
}
