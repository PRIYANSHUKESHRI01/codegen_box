# Payments — Razorpay

> **Razorpay is the alternative gateway.** AptRun's default is **PayU** (`docs/payments-payu.md`). Everything below is still
> fully implemented and tested; to use it, set `PAYMENT_GATEWAY=razorpay` in `backend/.env` (with the `RAZORPAY_*` keys) and
> run `php artisan config:cache`. The two gateways share one purchase lifecycle (`CheckoutService`), one `payment_orders`
> table and one superadmin screen; an order always stays with the gateway it was opened on, so switching loses nothing in flight.

How a student pays for Expert, how that payment becomes a plan, what protects it, and what to do
when something is odd. Built on Razorpay **Standard Checkout** + the **Orders API** + **webhooks**
(docs: <https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/>).

Plan prices and limits are a separate subject: see `docs/pricing-and-plans.md`.

## 1. The flow

```
 Student clicks "Upgrade to Expert"
   │
   │ 1. POST /api/me/checkout {plan_code, expected_total}
   ▼
 Laravel prices the cart (PurchaseQuoteService — the server is the only source of a price),
 creates a Razorpay ORDER for exactly that amount, stores a payment_orders row (status: created)
   │ returns {key, order_id, amount, prefill…}   (the key SECRET never leaves the server)
   ▼
 Razorpay Checkout opens in the browser (checkout.js, loaded from Razorpay on demand).
 Card / UPI / netbanking details go to Razorpay only — never to AptRun.
   │ on success the window hands the browser three fields:
   │ razorpay_order_id, razorpay_payment_id, razorpay_signature
   │
   │ 2. POST /api/me/checkout/verify {the three fields}
   ▼
 Laravel checks HMAC-SHA256(order_id|payment_id, key_secret) == signature, using the order id IT stored,
 then asks Razorpay's API for the payment (right order? right amount? captured?) — only then:
 payment_orders → paid, subscription created, receipt email, new plan state returned to the browser.
```

Two safety nets reach the **same** order row, so the plan is activated exactly once however they race:

| Reporter | When it matters | Where |
|---|---|---|
| **Webhook** (`payment.captured`, `order.paid`, `payment.failed`, `refund.processed`) | the student paid and closed the tab; a dashboard refund | `POST /api/webhooks/razorpay` |
| **Reconcile job** (every 5 min) | a webhook was lost / never configured | `php artisan payments:reconcile` |

`CheckoutService::fulfil()` takes a row lock on the order and checks its status inside the lock — a callback, a webhook
and the reconcile job arriving together buy one plan, not three.

Nothing about a price, a plan or "did it succeed" is believed from the browser.

## 2. One-time setup

### On Razorpay (Dashboard)

1. **API keys** — *Account & Settings → API Keys → Generate Key*. You get a **Key ID** (`rzp_test_…` / `rzp_live_…`) and a
   **Key Secret** (shown once; save it). Test mode and Live mode have separate keys.
2. **Capture** — *Account & Settings → Payments Capture*: leave **Automatic Capture** on (the default). The app also captures
   an `authorized` payment itself, so manual capture works too, but automatic is simpler. An authorized payment nobody
   captures is refunded by Razorpay after 3 days.
3. **Webhook** — *Account & Settings → Webhooks → Add New Webhook* (do it in **Test** mode first, again in **Live**):
   - URL: `https://<your-api-host>/api/webhooks/razorpay`
   - Secret: any long random string **you choose** — this is `RAZORPAY_WEBHOOK_SECRET`. It is *not* the API key secret.
   - Active events: `payment.authorized`, `payment.captured`, `payment.failed`, `order.paid`, `refund.processed`.
4. (Optional) *Account & Settings → Customer Receipts*: Razorpay can email its own receipt too. AptRun sends one regardless.

### On the server (`backend/.env`)

```
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx
RAZORPAY_WEBHOOK_SECRET=the-random-string-you-chose
```

Nothing goes in `frontend/.env.local` — the browser is handed the public key id by the API. The key *secret* must never
be in the frontend, in git, or in an email.

Then, once per deploy:

```
php artisan migrate --force          # creates payment_orders, payment_webhook_events
php artisan config:cache             # picks up the new env values (php artisan optimize does this too)
php artisan route:cache              # new routes 404 on a server with cached routes until this is re-run
```

…and the scheduler cron must be running (`* * * * * php artisan schedule:run`) — it drives `payments:reconcile`
(and the nightly `subscriptions:expire`).

**Until the key pair is set, nobody can buy a paid plan**: the API answers `503 payments_unavailable`, the pricing page
shows "Payments launching soon", and there is no bypass. Without the *webhook secret*, buying still works from the
student's browser and the reconcile job, but a student who pays and closes the tab waits up to ~5 minutes for the job, and
refunds made in the Razorpay Dashboard do not take the plan back. Superadmin → Payments shows a warning for either gap.

### Going live

1. Finish Razorpay's KYC/activation so Live keys can be generated.
2. Generate **Live** keys; add a **Live** webhook (same URL, a new secret).
3. Replace the three env values with the live ones, `php artisan config:cache`.
4. Make one real small payment and confirm: plan activates, receipt email arrives, row appears in Superadmin → Payments
   with the "live mode" badge. Refund it from the Dashboard and watch the plan go away.

Test-mode and live-mode orders are kept apart (`payment_orders.gateway_mode`); Superadmin → Payments only totals the mode the
current keys belong to, so test money never appears in live revenue.

## 3. What can go wrong, and what happens

| Situation | Result |
|---|---|
| Student opens Checkout and closes it | Nothing is charged. Opening it again within 30 min reuses the same order. After 24 h unpaid the order is marked `expired` (and still honoured if it is paid late). |
| Card declined / UPI timed out | Razorpay shows the reason and lets them retry inside its window. The reason is stored and shown in their payment history. |
| Bank approves, browser/tab dies before the callback | Webhook (or the 5-min reconcile job, or the student's own status check) activates the plan. They are not asked to pay again. |
| Callback arrives but our server can't reach Razorpay | `503 activation_delayed`: the UI says the payment is processing and polls; the plan appears on its own. |
| Forged / altered callback | `422 signature_invalid`. Nothing activates. |
| Callback for someone else's order, or a cheaper order's payment pointed at a dearer order | Refused: the order is looked up by *our* stored id, scoped to the logged-in student, and the signature covers that id. |
| Payment amount / order id doesn't match what we created | Not honoured. Order is flagged **Needs review** (never auto-activated). |
| Same event delivered twice, or events out of order | Event ids are stored (`payment_webhook_events`); the payment's *current* state is re-read from Razorpay, so order doesn't matter. |
| Webhook handler fails (our DB hiccup) | HTTP 500 → Razorpay retries → it works the next time. A transient failure is **never** refunded. |
| Money taken but the plan can't be handed over for good (account deleted, buyer already on a higher plan) | Automatic full refund, order closed as `refunded` with the reason recorded. |
| Buying a lower plan while holding a higher one with time left | Refused at checkout (`409 downgrade_blocked`) — and refunded if such an order is paid late. |
| Student's college already covers them | Refused (`409 covered_by_institution`) — never charge for what they have. |
| Superadmin changes the price while a student has the page open | `409 price_changed`; they see the new price and confirm again. They are never charged an amount they didn't see. |
| Plan refunded from the Razorpay Dashboard | `refund.processed` webhook → order `refunded`, the plan it bought is cancelled, student drops to free (Coder). A partial refund is recorded and changes nothing else. |
| Paid plan reaches its end date | Entitlements fall back to the free plan **at that moment** (not when the nightly job runs). |
| Student renews the plan they hold | The new year is added after the days they have left. Moving to a different (higher) plan starts a fresh year from today. |

Failed payment attempts are also recorded when the browser reports them (it nudges the status endpoint), so history is
complete even where no webhook can reach the server (local development).

## 4. Operating it

**Superadmin → Payments** shows revenue (net of refunds), the last 30 days, every order with who/what/status and the
Razorpay ids, and a **Re-check** button that asks Razorpay again about one order and activates the plan if it was paid.

**"Needs review"** means money moved (or may have) but a person should look. Open the row: the failure reason says why
(amount mismatch, etc.). Use **Re-check**; if the payment is real and the plan is right, it activates. If not, refund it
from the Razorpay Dashboard — the refund webhook closes the order.

**Refunds** are issued in the Razorpay Dashboard (*Transactions → Payments → Refund*). Full refund ⇒ plan revoked.

**Commands**

```
php artisan payments:reconcile          # open orders older than 5 min (what the scheduler runs)
php artisan payments:reconcile --all    # every unpaid order of the last 7 days, expired ones included
```

**Where to look**

- `storage/logs/laravel.log`: `Razorpay request failed` (the API said no — wrong keys, etc.), `Razorpay webhook rejected: bad
  signature` (wrong webhook secret, or a stranger), `A payment was captured but the plan could not be activated`,
  `Automatic refund failed — refund this payment manually` (the one that needs a human: do it in the Dashboard).
- Razorpay Dashboard → Webhooks → the endpoint shows each delivery and the HTTP status we answered with.
- Webhook status codes: `200` handled (or deliberately ignored), `400` bad signature / malformed, `503` webhook secret not
  set on the server, `500` we failed — Razorpay will retry.

## 5. Testing it

Test mode, no real money. Razorpay's test instruments (<https://razorpay.com/docs/payments/payments/test-card-details/>):

| | |
|---|---|
| Success card | `4100 2800 0000 1007` (Visa) or `5555 5100 0008 1006` (Mastercard); any future expiry, any CVV; any 4–10 digit OTP |
| Declined | `4100 2800 0006 0003` (declined) · `…0008 0001` (insufficient funds) · `…0009 0000` (timeout) — then choose **Failure** on the bank page |

Local development: the webhook cannot reach `localhost`. The flow still works end to end (the browser callback and the
status poll cover it); to test webhooks, expose the API with a tunnel (Razorpay blocks webhook.site/ngrok.io/requestbin; `zrok`
works) and add that URL as a Test-mode webhook. In Test mode the OTP for editing webhooks is `754081`.

Automated tests (no network, no Razorpay): `tests/Feature/RazorpayCheckoutTest.php` (checkout, callback, webhook, refund,
reconcile, superadmin) and `tests/Feature/PaidAccessEndToEndTest.php` (every plan × every gated feature, reached by really
buying the plan) run against `tests/Support/FakeRazorpayGateway.php`, an in-memory Razorpay. Frontend:
`razorpay-checkout.test.ts`, `payments-ui.test.tsx`, `pricing-ui.test.tsx`.

## 6. What is stored

- `payment_orders` — one row per checkout: our `public_id` (ULID, also sent to Razorpay as the receipt), the student (nullable,
  so the financial record survives deleting an account — name/email are snapshotted), Razorpay order/payment ids, status,
  amount in paise, the frozen `quote` (what was priced = what was bought), method, failure reason, refund details.
  Subscriptions created from it carry `purchase_ref` = its `public_id` and `gateway_payment_id` in `meta`.
- `payment_webhook_events` — every event Razorpay delivered, unique on its event id (idempotency), with the raw payload;
  pruned after 90 days (`billing.webhook_retention_days`).
- No card, UPI or bank details are ever stored or logged.

## 7. API

| Endpoint | |
|---|---|
| `POST /api/me/checkout` | student; `plan_code`, `expected_total?` → `{checkout:{key,order_id,amount,…}, quote}` · 409 `price_changed` / `downgrade_blocked` / `covered_by_institution` · 422 `nothing_to_pay` · 503 `payments_unavailable` · 502 `gateway_error` |
| `POST /api/me/checkout/verify` | the three Razorpay fields → the new `GET /me/subscription` body + `payment` · 422 `signature_invalid` · 409 `payment_mismatch` / `payment_not_complete` / `payment_refunded` · 503 `activation_delayed` |
| `GET /api/me/payments` · `GET /api/me/payments/{id}` | history · one payment's status (asks Razorpay if still unpaid) |
| `POST /api/webhooks/razorpay` | Razorpay only; signature `X-Razorpay-Signature` over the raw body |
| `GET /api/superadmin/payments` · `POST /api/superadmin/payments/{id}/reconcile` | superadmin |
| `GET /api/me/subscription` | now includes `checkout: {available, test_mode}` |

`POST /api/me/subscription` (the old instant activation) **no longer exists**.

## 8. Decisions left to the business

These are deliberately not guessed in code:

1. **GST / tax invoices.** Prices are charged as shown, assumed GST-inclusive; no invoice PDF is generated (the emailed receipt
   and Razorpay's own receipt are not tax invoices). Tell your CA whether ₹2,999 is inclusive, then an invoice
   generator can be added on top of `payment_orders`.
2. **Moving between plans mid-term.** Expert is the only plan bought online (Grandmaster / Mellow Academy is granted by the
   superadmin), so this only arises if a second self-serve plan is ever added: a fresh year would start at the full new price
   and the unused time is not credited. Proration or a credit is a pricing decision — say the word and it is a change in
   `PurchaseQuoteService`.
3. **Auto-renewal.** Plans are one-time yearly purchases; nothing is auto-debited. (Razorpay Subscriptions/UPI AutoPay is a
   different integration.) The pricing page offers "Renew" in the last 30 days and after a plan ends.
4. **Refund policy and disputes/chargebacks.** Refunds are manual (Dashboard) and sync automatically; chargeback events
   (`payment.dispute.*`) are not handled yet.
5. **International cards / currencies** — INR only.
