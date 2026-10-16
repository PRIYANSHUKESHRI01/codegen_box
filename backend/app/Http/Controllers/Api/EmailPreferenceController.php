<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * The page behind the "Unsubscribe" link in every nudge e-mail (and the target of
 * the List-Unsubscribe header, which is what the mail client's own Unsubscribe
 * button POSTs to).
 *
 * No login: the person is looking at an e-mail, not at the app. The URL is signed
 * (the `signed` middleware) with the user's id, so only the e-mail we sent can
 * change that user's setting, and the signature never expires — an unsubscribe
 * link in an old e-mail must keep working.
 *
 * GET only shows the current state and asks for a click. It deliberately changes
 * nothing: corporate mail scanners and link previewers fetch every link in an
 * e-mail, and a GET that unsubscribed would silence people who never asked to be.
 * POST does the work — both from this page's button and from a mail client's
 * one-click unsubscribe (RFC 8058), which posts `List-Unsubscribe=One-Click` and
 * nothing else.
 *
 * What it switches is ENGAGEMENT mail only (nudges, "you're close to the Vault",
 * win-backs). Receipts, refunds, plan changes and security notices keep coming.
 */
class EmailPreferenceController extends Controller
{
    public function show(Request $request, User $user)
    {
        return $this->page($request, $user);
    }

    public function update(Request $request, User $user)
    {
        $resubscribe = $request->input('action') === 'subscribe';

        User::whereKey($user->id)->update([
            'email_nudges_opt_out_at' => $resubscribe ? null : ($user->email_nudges_opt_out_at ?? now()),
        ]);

        return $this->page($request, $user->fresh(), changed: true);
    }

    private function page(Request $request, User $user, bool $changed = false)
    {
        return response()->view('email-preferences', [
            'subscribed' => $user->email_nudges_opt_out_at === null,
            'changed' => $changed,
            'maskedEmail' => $this->mask($user->email),
            'action' => $request->fullUrl(),
            'appUrl' => rtrim((string) config('app.frontend_url'), '/'),
        ]);
    }

    /** a***@gmail.com — enough to recognise, not enough to harvest from a forwarded link. */
    private function mask(string $email): string
    {
        [$local, $domain] = array_pad(explode('@', $email, 2), 2, '');

        return Str::substr($local, 0, 1).'***@'.$domain;
    }
}
