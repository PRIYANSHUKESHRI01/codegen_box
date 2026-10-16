# Payments — PayU

How a student pays for Expert on **PayU Hosted Checkout**, how that payment becomes a plan, what protects it,
and what to do when something is odd. PayU is AptRun's default gateway (`PAYMENT_GATEWAY=payu`); Razorpay is built in as the
alternative (`docs/payments-razorpay.md`) and both run through the same purchase code.

Built against PayU's own documentation (<https://docs.payu.in>): *Web Integration – PayU Hosted*, *Generate Hash*, *Working with
the Response*, *Webhook Events and Sample Payloads*, *Verify Payment API*, *Refund Transaction API*, *Check Action Status API*,
*Payment State Explanations*. Plan prices and limits are a separate subject: see `docs/pricing-and-plans.md`.

## 1. The flow

PayU's checkout is **a page on PayU's site**, not a window over ours. The student's browser is sent there with a form, and sent
back afterwards:

```
 Student clicks "Upgrade to Expert"
   │
   │ 1. POST /api/me/checkout {plan_code, expected_total, phone?}
   ▼
 Laravel prices the cart (PurchaseQuoteService — the server is the only source of a price), stores a
 payment_orders row (status: created, txnid = first 25 chars of its ULID) and returns a SIGNED FORM:
 key, txnid, amount "2999.00", productinfo, firstname, email, phone, surl/furl/curl, udf1 = our reference, hash
   │   hash = sha512(key|txnid|amount|productinfo|firstname|email|udf1…udf5|<5 empty>|SALT)
   │   — the SALT never leaves the server; only the hash made with it does.
   ▼
 The browser POSTs that form to PayU (https://secure.payu.in/_payment). The student pays on PayU's page.
 Card / UPI / netbanking details go to PayU only — never to AptRun.
   │ PayU POSTs the result to our return URL:   POST /api/payu/return   (surl = furl = curl)
   ▼
 Laravel (a) asks PayU's API directly — verify_payment — what happened to that txnid
         (b) only if PayU says paid, for the right amount: payment_orders → paid, subscription created, receipt email
         (c) also checks PayU's response hash  sha512(SALT|status|<5 empty>|udf5…udf1|email|firstname|productinfo|amount|txnid|key)
             — it decides how far the POST's WORDING ("cancelled", "failed") is believed, never whether money moved
       then redirects (303) the browser to  /dashboard/billing?payment=<reference>&result=<hint>
   ▼
 The billing page reads the order's real status from GET /api/me/payments/<reference> and tells the student.
```

Three reporters can tell us a payment happened; they all land on the **same order row**, so the plan is activated exactly once
however they race (`CheckoutService::fulfil()` takes a row lock and checks the status inside it):

| Reporter | When it matters | Where |
|---|---|---|
| **Browser return** (`surl`) | the normal case — the student finishes and PayU sends them back | `POST /api/payu/return` |
| **Webhook** (Successful / Failed / Refund / Dispute) | the student paid and closed the tab; a dashboard refund; a chargeback | `POST /api/webhooks/payu` |
| **Reconcile job** (every 5 min) and the student's own status check | a webhook was lost / never configured | `php artisan payments:reconcile`, `GET /api/me/payments/{id}` |

**What is believed from where.** Nothing the browser says is believed on its own. A payment counts only when PayU's own API
confirms it (`verify_payment`, authenticated with the Salt) — the posted `status` never settles an order, however well it is
signed. The return POST's response hash is still checked: a mismatch is logged as suspicious and the POST's wording is ignored, but
because PayU's API is the authority either way, a hash layout PayU changes without notice can never strand a student who really
paid. Webhooks are treated as a pointer: payment events are checked against the Salt, refund and dispute events (which PayU sends
**unsigned**) are checked by asking PayU's API (`check_action_status`) and by the optional URL token — a forged event can at worst
make us ask PayU a question.

**One transaction id per attempt.** PayU will not take a `txnid` to a bank twice, so unlike Razorpay an abandoned checkout is not
handed back: every "Buy" click is a new order. (Abandoned ones are closed as `expired` after an hour and hidden from the student's
history.)

## 2. One-time setup

### On PayU (Dashboard)

1. **Test credentials first.** Dashboard → switch to **Test mode** → *Developer / Payment Gateway → API Keys*: the **Merchant Key**
   and **Salt** (use Salt **v2** — PayU recommends it). Test and Live have separate keys.
2. **Webhooks** — *Developers → Webhooks → Create Webhook*. PayU makes one webhook per event type, so create four, all with the same URL
   (do it in **Test** mode first, again in **Live**):
   - Type **Payments**; events **Successful**, **Failed**, **Refund**, **Dispute**
   - URL: `https://<your-api-host>/api/webhooks/payu?token=<PAYU_WEBHOOK_TOKEN>`
   - (PayU's webhook source IPs, if you want a firewall rule — test: `180.179.174.1`, `3.6.73.183`, `3.6.83.44`; live: `3.7.89.1`, `3.7.89.2`,
     `3.7.89.3`, DR `52.140.8.88`, `52.140.8.89`, `52.140.8.64`. Check PayU's *Webhook Events* page for the current list.)
3. **Capture** — leave PayU's default (automatic capture). The app treats `status=success` as paid, which PayU defines for both
   `captured` and `auth`; an account on manual pre-authorisation would have to capture from the PayU dashboard.
4. (Optional) the **Refund** webhook may need PayU to switch on "Refund status callback" for your account — ask your PayU account manager.

### On the server (`backend/.env`)

```
PAYMENT_GATEWAY=payu
PAYU_KEY=xxxxxx
PAYU_SALT=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
PAYU_MODE=test
PAYU_WEBHOOK_TOKEN=a-long-random-string-you-choose
```

Nothing goes in `frontend/.env.local` — the browser is handed a signed form, never the Salt. The Salt must never be in the frontend,
in git, in an email or in a URL.

Then, once per deploy:

```
php artisan migrate --force          # no new tables: payment_orders / payment_webhook_events already serve both gateways
php artisan config:cache             # picks up the new env values (php artisan optimize does this too)
php artisan route:cache              # NEW ROUTES (/api/payu/return, /api/webhooks/payu) 404 on a server with cached routes until this is re-run
```

…and the scheduler cron must be running (`* * * * * php artisan schedule:run`) — it drives `payments:reconcile`.

**Until `PAYU_KEY` and `PAYU_SALT` are set, nobody can buy a paid plan**: the API answers `503 payments_unavailable`, the pricing page
shows "Payments launching soon", and there is no bypass. Superadmin → Payments shows what is missing.

> **The return address is limited to 50 characters by PayU** (`surl`/`furl`/`curl`). The default is `<APP_URL>/api/payu/return`
> — e.g. `https://api.example.com/api/payu/return` is 39. If your API hostname is long enough to pass 50, checkout refuses to open
> (and logs `PayU return URL is longer than the 50 characters PayU allows`); set `PAYU_RETURN_URL` to a shorter alias that reaches
> the same route. Behind a proxy that hides `https` from PHP, set `PAYU_RETURN_URL` explicitly too — a POST that is redirected from
> `http` to `https` loses its body.

### Going live

1. Finish PayU's onboarding / KYC / website verification so **Live** keys exist.
2. In PayU **Live** mode copy the **Live Key and Salt**; add the four **Live** webhooks (same URL shape, a new token if you like).
3. Change `PAYU_KEY`, `PAYU_SALT` **and** `PAYU_MODE=live` together, then `php artisan config:cache`.
   (`PAYU_MODE` picks the endpoints — test: `test.payu.in`; live: `secure.payu.in` for checkout and `info.payu.in` for the API —
   and is what labels money as "live" in Superadmin. PayU keys do not say which mode they belong to, so it is explicit, and
   it defaults to `test`: a forgotten setting can never take real money.)
4. Make one real small payment and confirm: the plan activates, the receipt email arrives, the row appears in Superadmin → Payments
   with the "live mode" badge, **a webhook arrives** (Superadmin shows "PayU last called our webhook at …"; PayU's Dashboard →
   Developers → Webhook logs shows the HTTP status we answered). Refund it from the Dashboard and watch the plan go away.

Test-mode and live-mode orders are kept apart (`payment_orders.gateway_mode`); Superadmin → Payments only totals the mode the
current settings belong to, so test money never appears in live revenue.

## 3. What can go wrong, and what happens

| Situation | Result |
|---|---|
| Student opens PayU's page and walks away | Nothing is charged. The order is chased every 5 min for an hour, then closed as `expired` (still honoured if paid late). |
| Student presses **Cancel** on PayU's page | Back on the billing page: "You cancelled the payment, so you haven't been charged." Nothing is written to their history. |
| Card declined / UPI timed out | Back on the billing page with the bank's reason; recorded in their payment history. They try again — a **new** transaction. |
| Bank approves, student closes the tab before PayU redirects | Webhook (or the 5-min reconcile job, or the student's own status check) activates the plan. They are not asked to pay again. |
| Student returns but PayU's API is down for a moment | The return never errors: it redirects to billing, which polls and shows "confirming your payment". The plan appears once PayU answers. |
| Forged or edited return POST | Logged (`PayU return carries a response hash that does not match`) and its wording ignored. PayU is asked about the transaction anyway — if the student really paid, the plan activates (the truth is at PayU); if not, nothing does. |
| Return POST says "success" for a payment PayU says never happened | Nothing activates — PayU's API, not the posted status, decides. |
| Student edits the amount in the form before it reaches PayU | PayU refuses the request: the request hash covers the amount. |
| Payment amount / txnid doesn't match the order | Not honoured. Order is flagged **Needs review** (never auto-activated). |
| Same event delivered twice, or events out of order | Events are stored by what identifies them (`payment_webhook_events`); the transaction's *current* state is re-read from PayU. |
| Webhook handler fails (PayU's API unreachable, our DB) | HTTP 500 → the event is delivered again / the reconcile job picks the order up. A transient failure is **never** refunded. |
| Forged refund / dispute webhook | Refused without the URL token; and even with it, a refund PayU does not list changes nothing (`check_action_status` is asked). |
| Money taken but the plan can't be handed over for good (account deleted, buyer already on a higher plan) | Automatic full refund through PayU's Refund API, order closed as `refunded` with the reason recorded. |
| …and PayU later rejects that queued refund | The refund webhook reverses the record, the order goes to **Needs review**, a `critical` log line fires: refund it from the PayU Dashboard. |
| A chargeback is raised | Written onto the order (status, amount, reason, **due date**) and logged `critical`. Access is not changed — someone must respond to PayU before the due date. |
| Buying a lower plan while holding a higher one | Refused at checkout (`409 downgrade_blocked`) — and refunded if such an order is paid late. |
| Student's college already covers them | Refused (`409 covered_by_institution`). |
| Superadmin changes the price while a student has the page open | `409 price_changed`; they see the new price and confirm again. |
| Student has no mobile number on file | Checkout answers `422 phone_required` (only after the purchase itself is known to be valid); the page asks for one (PayU requires it). It goes to PayU for this payment only and is **not** saved to their profile. |
| Student's email is over PayU's 50-character limit | `422 email_unsupported` — never truncated and sent. |
| Plan refunded from the PayU Dashboard | Refund webhook → order `refunded`, the plan it bought is cancelled, student drops to Coder. A partial refund is recorded and changes nothing else. |
| Paid plan reaches its end date | Entitlements fall back to the free plan at that moment. |

## 4. Operating it

**Superadmin → Payments** shows revenue (net of refunds), the last 30 days, every order with who/what/status, the gateway and its
ids, any **chargeback** (status + due date), and a **Re-check** button that asks the order's own gateway again and activates the plan
if it was paid. It warns when PayU isn't configured, and when **PayU has never called our webhook** (the usual symptom of a webhook
that was never set up in the PayU Dashboard).

**"Needs review"** means money moved (or may have) but a person should look. Open the row: the failure reason says why (amount
mismatch, refund rejected…). Use **Re-check**; if the payment is real and the plan is right, it activates. If not, refund it from
the PayU Dashboard — the refund webhook closes the order.

**Refunds** are issued in the PayU Dashboard (*Transactions → the payment → Refund*). Full refund ⇒ plan revoked. PayU queues refunds
and settles them with the bank later; the order records the refund when PayU reports its final status.

**Commands**

```
php artisan payments:reconcile          # open orders older than 5 min, for every configured gateway (what the scheduler runs)
php artisan payments:reconcile --all    # every unpaid order of the last 7 days, expired ones included
```

**Where to look**

- `storage/logs/laravel.log`: `PayU request failed` / `PayU verify_payment gave no transaction_details` (wrong key or salt, or PayU down),
  `PayU return carries a response hash that does not match` (a stranger, or PayU changed its hash layout — payments still activate),
  `PayU webhook rejected: bad hash | bad token | source IP not allowed`,
  `A payment was captured but the plan could not be activated`, `Automatic refund failed — refund this payment manually`,
  `A refund failed at the payment gateway — the customer has NOT been repaid`, `PayU chargeback on a payment`.
- PayU Dashboard → Developers → **Webhook logs**: each delivery and the HTTP status we answered.
- Webhook status codes: `200` handled (or deliberately ignored), `400` bad hash / malformed, `403` wrong token or IP, `503` PayU not
  configured, `500` we failed — it is delivered again.

## 5. Testing it

PayU **Test mode**, no real money. PayU's test instruments (<https://docs.payu.in/docs/test-cards-upi-id-and-wallets>):

| | |
|---|---|
| Success card | Mastercard `5123 4567 8901 2346`, or VISA `4012 0010 3714 1112`; expiry any future date (e.g. `05/30`), CVV `123`, name anything, OTP `123456` on the bank page |
| Failing card | `5123 4567 8901 2340` (payment failed) |
| UPI | `anything@payu` or `9999999999@payu` (UPI intent/in-app does not work in Test mode) |
| Netbanking | user `payu`, password `payu`, OTP `123456` |

The return URL works on `localhost` (it is the *browser* that is sent back), so a complete purchase can be tried against PayU's
sandbox from a developer machine: put the test key/salt in `.env`, `PAYMENT_GATEWAY=payu`, `PAYU_MODE=test`, and pay. **Webhooks cannot
reach `localhost`** — that part needs a public URL (a tunnel) or a deployed test server; without it, the browser return and the
status poll still complete every purchase.

Automated tests (no network, no PayU): `tests/Feature/PayuCheckoutTest.php` (the hash formulas against PayU's documented strings,
checkout, return, webhooks, refunds, chargebacks, reconcile, superadmin, phone/email rules, live-mode hosts),
`tests/Feature/PaymentGatewaySwitchTest.php` (both gateways side by side, switching mid-flight), and the existing Razorpay suites, all
running against `tests/Support/FakePayuGateway.php` — an in-memory PayU whose hash code is written from the documentation and is
**deliberately separate from the app's**, so passing means the app agrees with PayU's published formulas. Frontend:
`payu-checkout.test.ts` (the form post and the return logic) and `payu-pricing-ui.test.tsx` (the buttons, the phone question, every
way the student lands back).

> The formulas and wire formats follow PayU's documentation exactly, but this integration was built without PayU credentials and has
> not been run against PayU's live servers. The first thing to do with real test credentials is one purchase end to end (§2 "Going
> live", step 4, in Test mode). If PayU shows "Hash mismatch" (or the Verify Payment answer is "Invalid Hash"), the cause is almost
> always the wrong key/salt pair or `PAYU_MODE` not matching them.

## 6. What is stored

- `payment_orders` — one row per checkout attempt: our `public_id` (ULID; its first 25 characters are the PayU `txnid`, in
  `gateway_order_id`), the student (nullable, so the financial record survives deleting an account — name/email are snapshotted), the
  PayU payment id (`mihpayid`, in `gateway_payment_id`), status, amount in paise, the frozen `quote`, method (`card`, `upi`,
  `netbanking`, `wallet`, `emi`…), failure reason, refund details, the phone given for this payment (`meta.payer_phone`), chargebacks
  (`meta.disputes`). Subscriptions created from it carry `purchase_ref` = its `public_id`, `gateway = payu` and `gateway_payment_id`.
- `payment_webhook_events` — every event PayU delivered, unique on what identifies it (payment id + verdict; refund id + status;
  chargeback id + stage), pruned after 90 days. Payment webhooks keep only the identifying and outcome fields — **not** the buyer's
  name, email, phone, address or masked card.
- No card, UPI or bank details are ever stored or logged, and the Salt is never logged or sent anywhere but used as a hash input.

## 7. API

| Endpoint | |
|---|---|
| `POST /api/me/checkout` | student; `plan_code`, `expected_total?`, `phone?` → `{checkout:{gateway:"payu", action, method, fields:{…}, amount, reference, test_mode}, quote}` · 409 `price_changed` / `downgrade_blocked` / `covered_by_institution` · 422 `nothing_to_pay` / `phone_required` / `email_unsupported` · 503 `payments_unavailable` · 502 `gateway_error` |
| `POST /api/payu/return` | PayU's hosted page via the student's browser (form POST, no login). Always answers `303` → `<FRONTEND_URL>/dashboard/billing?payment=<ref>&result=<paid\|processing\|failed\|cancelled\|pending\|unknown>` — the `result` is only a wording hint |
| `GET /api/me/payments` · `GET /api/me/payments/{id}` | history · one payment's status (asks PayU if still unpaid) |
| `POST /api/webhooks/payu[?token=…]` | PayU only: payment events (form-encoded — or JSON — response-hash checked), refund and dispute events (JSON, re-verified at PayU) |
| `GET /api/superadmin/payments[?gateway=&mode=&status=&q=]` · `POST /api/superadmin/payments/{id}/reconcile` | superadmin |
| `GET /api/me/subscription` | includes `checkout: {available, test_mode, gateway, gateway_name}` |

`POST /api/me/checkout/verify` is **Razorpay's** callback and answers `404 order_not_found` for any PayU order.

## 8. Decisions left to the business

These are deliberately not guessed in code:

1. **GST / tax invoices.** Prices are charged as shown, assumed GST-inclusive; no invoice PDF is generated (the emailed receipt and PayU's
   own are not tax invoices). Tell your CA whether ₹2,999 is inclusive, then an invoice generator can be added on top of
   `payment_orders`.
2. **Moving between plans mid-term.** Expert is the only plan bought online (Grandmaster / Mellow Academy is arranged with the team and granted by the superadmin, never paid for here), so this only arises if a second self-serve plan is ever added: a fresh year would start at the full new price and the unused time is not credited.
3. **Auto-renewal.** Plans are one-time yearly purchases; nothing is auto-debited (PayU's recurring/SI product is a different integration).
4. **Chargebacks.** They are recorded and loudly logged, but responding (accept / contest with evidence) is a person's job in the PayU
   Dashboard; nothing is automated and access is not revoked on a dispute.
5. **International cards / currencies** — INR only. (PayU's cross-border product needs more buyer fields and its own hash layout.)
6. **PayU convenience fee / offers.** The app expects to charge exactly the plan price. If PayU is configured to add a fee, the paid amount
   is still checked against the *original* amount PayU echoes back (`amount` / `transaction_amount`), not what was debited; the response
   hash layouts with `additionalCharges` are understood. A PayU-side discount offer is not modelled — don't switch one on.
