<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Payments\PayuReturnHandler;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

/**
 * POST /api/payu/return — where PayU's hosted page sends the student's browser when they have paid,
 * failed or cancelled (it is the `surl`, `furl` and `curl` of every checkout).
 *
 * The browser arrives with a form POST, so this is not a JSON API call and there is no login token on
 * it: the request is identified by PayU's signed transaction id, never by a session. It always answers
 * with a redirect back into the app — a person who has just paid must never be shown a blank page or a
 * JSON error — and the page they land on asks the authenticated API what really happened. The only
 * things put in that URL are our own order reference and a one-word hint for wording; nothing in it can
 * make a payment look successful (see PayuReturnHandler).
 *
 * `303 See Other`: the browser follows it with a GET, so reloading the landing page never re-submits the payment.
 */
class PayuReturnController extends Controller
{
    public function __invoke(Request $request, PayuReturnHandler $handler): RedirectResponse
    {
        $base = rtrim((string) config('app.frontend_url'), '/').'/dashboard/billing';

        // A GET (the address typed in, a back-button replay) carries no payment result to act on.
        if (! $request->isMethod('post')) {
            return redirect()->away($base, 303);
        }

        $outcome = $handler->handle($request->post());

        $query = array_filter(['payment' => $outcome['reference'], 'result' => $outcome['result']], fn ($v) => $v !== null);

        return redirect()->away($base.'?'.http_build_query($query), 303);
    }
}
