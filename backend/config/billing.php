<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Add-on bundle pricing
    |--------------------------------------------------------------------------
    |
    | Prices themselves live on the `plans` rows (PlanSeeder), because that is
    | what a payment gateway SKU maps to. The only pricing RULE that is not a
    | plan row is the bundle discount: percent taken off an add-on's list
    | price when the buyer is (or in the same checkout becomes) a paying
    | subscriber of a PAID base plan. Project Lab at 499 therefore costs 349
    | next to a base plan, so Expert + Lab = 748 instead of 898.
    |
    | Rounded to whole rupees. Set to 0 to switch bundle pricing off.
    */
    'addon_bundle_discount_percent' => (int) env('BILLING_ADDON_BUNDLE_DISCOUNT_PERCENT', 30),

    'currency' => 'INR',

    /*
    |--------------------------------------------------------------------------
    | Free offer (a plan discounted by 100%)
    |--------------------------------------------------------------------------
    |
    | A student who already holds a plan that is currently free may redeem it
    | again only when it has this many days or fewer left — the new term stacks
    | on the days remaining, exactly like paying to renew. Outside that window
    | redeeming is refused (409 already_on_plan), so free time cannot pile up
    | by clicking Redeem repeatedly. Keep it equal to the pricing page's Renew
    | window (RENEW_WINDOW_DAYS in PricingPlans.tsx).
    */
    'redeem_renewal_window_days' => 30,

    /*
    |--------------------------------------------------------------------------
    | Which payment gateway takes the money
    |--------------------------------------------------------------------------
    |
    | Exactly one gateway is "active": it opens every NEW checkout. Both are fully
    | implemented, so switching is a one-line change in .env and nothing else:
    |
    |   PAYMENT_GATEWAY=payu        PayU hosted checkout   — docs/payments-payu.md   (the default)
    |   PAYMENT_GATEWAY=razorpay    Razorpay Standard Checkout — docs/payments-razorpay.md
    |
    | An order always remembers the gateway it was opened on (payment_orders.gateway),
    | so after a switch the old gateway's late payments, webhooks, re-checks and refunds
    | keep working as long as its own credentials stay in .env. An unknown value here
    | switches payments OFF (nobody can pay) rather than guessing; an EMPTY one
    | (`PAYMENT_GATEWAY=` left blank) means the default, same as the line being absent.
    */
    'gateway' => env('PAYMENT_GATEWAY', 'payu'),

    /*
    |--------------------------------------------------------------------------
    | PayU (payment gateway) — PayU Hosted Checkout
    |--------------------------------------------------------------------------
    |
    | The student is sent to PayU's own page (card / UPI / netbanking details never
    | touch AptRun) and PayU posts the result back — see docs/payments-payu.md.
    | Leave key / salt blank and the app reports "payments are not set up yet"
    | (HTTP 503 `payments_unavailable`); there is deliberately no bypass flag.
    |
    | key          PayU Dashboard → Payment Gateway → API keys (Merchant Key). Not secret on its
    |              own, but it identifies the account.
    | salt         The Merchant Salt (v2 recommended). SECRET: every hash — the checkout request,
    |              PayU's response, every server-to-server call — is a SHA-512 over it. Server-only.
    | mode         `test` (PayU's sandbox, test key + salt) or `live`. PayU keys do not say which
    |              they are, so this is explicit; it also picks the endpoint URLs. Defaults to
    |              `test` so a forgotten setting can never take real money by accident.
    | webhook_token  Optional shared secret appended to the webhook URL you give PayU
    |              (…/api/webhooks/payu?token=XXXX). PayU signs payment events with the salt but
    |              sends refund/dispute events UNSIGNED; the token is what keeps strangers from
    |              posting those. Everything is re-verified against PayU's API anyway.
    | webhook_allowed_ips  Optional comma-separated allow-list of PayU's webhook source IPs.
    |              Leave empty unless the app sees real client IPs (behind a proxy it may not).
    | return_url   The public URL PayU sends the student's browser back to (POST). Defaults to
    |              <this API's own address>/api/payu/return. PayU caps it at 50 characters.
    */
    'payu' => [
        'key' => env('PAYU_KEY'),
        'salt' => env('PAYU_SALT'),
        'mode' => env('PAYU_MODE', 'test'),
        'webhook_token' => env('PAYU_WEBHOOK_TOKEN'),
        'webhook_allowed_ips' => env('PAYU_WEBHOOK_ALLOWED_IPS'),
        'return_url' => env('PAYU_RETURN_URL'),
        // Endpoint overrides — only ever set by the end-to-end tests (a local fake PayU). Blank = PayU's real URLs.
        'checkout_url' => env('PAYU_CHECKOUT_URL'),
        'api_url' => env('PAYU_API_URL'),
        'timeout_seconds' => 15,
        // PayU has no "order" to leave open: a checkout PayU has never heard of (the student never reached
        // its page) or has not paid after this long is closed as expired. Every attempt gets its own
        // transaction id, so abandoned ones must not be asked about for a whole day.
        'order_ttl_minutes' => 60,
    ],

    /*
    |--------------------------------------------------------------------------
    | Razorpay (payment gateway)
    |--------------------------------------------------------------------------
    |
    | Standard Checkout on the Orders API — see docs/payments-razorpay.md.
    | Only used while PAYMENT_GATEWAY=razorpay (or to finish orders that were
    | opened on it). Leave key_id / key_secret blank and the app reports
    | "payments are not set up yet" (HTTP 503 `payments_unavailable`) instead of
    | ever activating a paid plan without money moving; there is deliberately no
    | bypass flag.
    |
    | key_id        Dashboard → Account & Settings → API Keys. rzp_test_… in test
    |               mode, rzp_live_… in live mode; the prefix decides which one the
    |               UI labels as "Test mode".
    | key_secret    Shown once when the key is generated. Server-side only.
    | webhook_secret  Chosen by you when you add the webhook (Dashboard → Webhooks);
    |               NOT the API key secret. Signs every event Razorpay posts to
    |               POST /api/webhooks/razorpay.
    */
    'razorpay' => [
        'key_id' => env('RAZORPAY_KEY_ID'),
        'key_secret' => env('RAZORPAY_KEY_SECRET'),
        'webhook_secret' => env('RAZORPAY_WEBHOOK_SECRET'),
        'api_base' => env('RAZORPAY_API_BASE', 'https://api.razorpay.com/v1'),
        'timeout_seconds' => 15,
        // Shown at the top of the Razorpay Checkout window.
        'merchant_name' => env('RAZORPAY_MERCHANT_NAME', 'AptRun'),
        'theme_color' => env('RAZORPAY_THEME_COLOR', '#4F46E5'),
    ],

    /*
    |--------------------------------------------------------------------------
    | Order lifecycle
    |--------------------------------------------------------------------------
    |
    | A student who opens Checkout and closes it again leaves an unpaid Razorpay
    | order behind. Opening it again within `order_reuse_minutes` reuses that
    | order (same cart, same price) instead of piling up new ones.
    | `payments:reconcile` (every few minutes) asks Razorpay about orders still
    | unpaid after `reconcile_after_minutes` — that is how a payment whose
    | webhook never arrived, or whose browser tab was closed mid-payment, still
    | activates the plan — and marks orders nobody paid within `expire_after_hours`
    | as expired. An expired order that is paid late is still honoured.
    */
    'order_reuse_minutes' => 30,
    'reconcile_after_minutes' => 5,
    'expire_after_hours' => 24,

    // Raw webhook bodies are kept for audit/dispute handling this long, then pruned.
    'webhook_retention_days' => 90,

];
