<?php

namespace App\Http\Controllers\Api\Concerns;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

/**
 * Re-checks the signed-in superadmin's own password before an action that can
 * take over accounts or destroy data (reset a password, delete a university or
 * an account, "view as" someone, cancel a college's plan).
 *
 * Answers 422, never 401: the frontend treats a 401 as "session expired" and
 * would log them out for a typo. Pair it with the `throttle:superadmin-sensitive`
 * limiter — a wrong password here is a guess at the superadmin's password, and a
 * stolen session token must not get to try thousands of them.
 */
trait ConfirmsSuperadminPassword
{
    private function confirmSuperadminPassword(Request $request, string $password): void
    {
        if (! Hash::check($password, $request->user()->password)) {
            throw ValidationException::withMessages([
                'password' => ['That is not your password. Enter the password you sign in with.'],
            ]);
        }
    }
}
