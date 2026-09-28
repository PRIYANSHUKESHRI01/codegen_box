<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\SendNewsletterWelcomeEmail;
use App\Models\NewsletterSubscriber;
use Illuminate\Http\Request;

/** The public footer's newsletter signup — its own tiny surface, see the create_newsletter_subscribers_table migration's docblock for why. */
class NewsletterController extends Controller
{
    public function subscribe(Request $request)
    {
        $validated = $request->validate([
            'email' => ['required', 'string', 'email', 'max:255'],
        ]);

        $email = strtolower($validated['email']);

        // Idempotent: re-submitting an already-subscribed email is just a
        // success, not an error — and an email that had previously
        // unsubscribed is welcomed back in rather than silently ignored.
        $subscriber = NewsletterSubscriber::where('email', $email)->first();

        if ($subscriber === null) {
            $subscriber = NewsletterSubscriber::create([
                'email' => $email,
                'subscribed_at' => now(),
            ]);
            SendNewsletterWelcomeEmail::dispatch($subscriber->id);
        } elseif ($subscriber->unsubscribed_at !== null) {
            $subscriber->forceFill(['subscribed_at' => now(), 'unsubscribed_at' => null])->save();
            SendNewsletterWelcomeEmail::dispatch($subscriber->id);
        }

        return response()->json([
            'message' => "You're subscribed — we'll keep you posted.",
        ], 201);
    }
}
