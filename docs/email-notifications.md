# E-mail notifications

Every e-mail AptRun sends, what triggers it, and how to check that it really leaves the server.

## 1. Making sure e-mail leaves the server

```
php artisan mail:check                          # config + a real SMTP connect and login. Sends nothing.
php artisan mail:check --send-to=you@gmail.com  # ...and sends one small test message
php artisan mail:preview --out=storage/mail-preview            # every lifecycle e-mail as .html files (sample data)
php artisan mail:preview --to=you@gmail.com                    # ...or all of them into a real inbox, marked [PREVIEW]
php artisan lifecycle:send --dry-run            # what the daily run WOULD send right now
```

`.env` for production (Gmail / Google Workspace needs an **App Password**, not the account password):

```
MAIL_MAILER=smtp
MAIL_HOST=smtp.gmail.com
MAIL_PORT=465
MAIL_SCHEME=smtps
MAIL_USERNAME=support@mellowvault.com
MAIL_PASSWORD=<16-character app password>
MAIL_FROM_ADDRESS=support@mellowvault.com
MAIL_FROM_NAME=AptRun
APP_URL=https://<public API address>        # the unsubscribe link is built from this
FRONTEND_URL=https://<public site address>  # every button and the logo are built from this
```

`MAIL_MAILER=log` and `array` "succeed" without delivering anything — `mail:check` says so loudly.

**Background work needs exactly one thing: the scheduler cron** — `* * * * * php artisan schedule:run`.
Single e-mails (a receipt, a password code, a plan change) are sent inside the request that caused them and need no
worker. Everything else is driven by the scheduler: the daily `lifecycle:send`, and — new — a one-minute
`queue:work --stop-when-empty` that delivers the queued e-mails (bulk notifications, interview shortlists, drive
proposals, proctoring reports, and any single e-mail whose first attempt failed and was handed over for a retry).
Without it those sat in the `jobs` table for ever on a server with no `queue:work`. Turn it off with
`QUEUE_DRAIN_FROM_SCHEDULER=false` if you run a real worker.

**Deliverability (outside the code):** the sending domain needs SPF, DKIM and DMARC records or Gmail will file the
mail under spam regardless of how good it is. Gmail also caps a mailbox at ~500 mails/day (Workspace ~2,000);
`LIFECYCLE_MAX_PER_RUN` (default 300) keeps nudges from using up the room receipts and password codes need.

## 2. What is sent

### Account
| E-mail | When | Where |
|---|---|---|
| Welcome | a student self-registers | `SendWelcomeEmail` |
| **Welcome — account activated** (new) | a student a college/admin ADDED sets their own password for the first time (the reset-code flow they are sent through on first login). Replaces the "password changed" notice that once; never repeated | `LifecycleMailService::welcomeActivated` |
| Account credentials | an admin/TPO/coordinator/company creates an account, a bulk import, a password reset by the superadmin | `SendAccountCredentialsEmail` |
| Password-reset code | "Forgot password" | `SendPasswordResetOtpEmail` |
| **Password changed** (new) | password changed in settings or by the reset flow — with "if this wasn't you" | `LifecycleMailService::passwordChanged` |

### Money and plans
| E-mail | When |
|---|---|
| Payment receipt | a purchase is fulfilled (`SendPaymentReceiptEmail`) |
| **Payment failed** (new) | the first failed attempt on an order (one per order, however often they retry) |
| **Refund processed** (new) | each refund (full: plan ended; partial: plan stays) — also refunds made from the Razorpay/PayU dashboard |
| **Plan activated** (new) | the superadmin gives a plan (complimentary or against an offline payment) |
| **Plan extended** (new) | the superadmin adds days |
| **Plan ended** (new) | the superadmin ends a paid plan (the internal reason is never shown) |
| **Plan ending soon** (new) | 7 days and 1 day before a paid personal plan ends; renewal stacks on the days left |
| **Plan expired** (new) | the day `subscriptions:expire` flips it (only plans that ended in the last 7 days) |

### Readiness and the Vault
| E-mail | When |
|---|---|
| Vault-ready | score ≥ 60 and the plan includes the Vault (`SendVaultReadyEmail`; now sent inline, not queued) |
| **Vault-ready but your plan has no Vault** (new) | score ≥ 60 on a plan without Vault access — the moment they qualify; reminders at +14 and +30 days, then stop |
| **You're N points from the Vault** (new) | active in the last 30 days, score 45–59; ≥ 10 days apart, at most 4, lists the three quickest wins from the score breakdown |
| **Vault listing paused** (new) | a student who was live drops below 55 |
| Vault hiring-partner mails | interest, outreach, interview invite/response, hire offer (`SendVault*Email`) |

### Nudges
| E-mail | When |
|---|---|
| **Get a paid plan** (new) | free-plan "Mellow Direct" students who have never held a paid plan, account age 3 / 10 / 24 days, ≥ 5 days apart — three messages, then silence. Never sent while payments are not configured. Prices and perks come from the plan row. |
| **We haven't seen you** (new) | away 14 days, again at 45 (per absence); stops after 90 days away |

### Others (unchanged)
Newsletter welcome, contact-request confirmation and notification, candidate invite, interview shortlist, drive
mapping proposal, placement-drive termination, proctoring violation report, weekly TPO readiness report, bulk
student notifications.

## 3. Rules that keep it from being spam

* **Transactional vs engagement.** Anything about the student's own account, money or security is always sent.
  Nudges (upgrade, close-to-Vault, Vault-upgrade reminders, win-back) carry an Unsubscribe link, the
  `List-Unsubscribe` / one-click headers (Gmail shows its own Unsubscribe button) and stop for anyone who used it
  (`users.email_nudges_opt_out_at`). The unsubscribe page asks for a click before doing anything (link scanners fetch
  every link in a mail), needs no login, and the link never expires. It lives on the API host: `/api/email/preferences/{user}` (signed).
* **At most one nudge every 3 days per student**, whatever kind. Priority: Vault upgrade → close to the Vault →
  buy a plan → win-back; the rest wait their turn.
* **Never twice:** every message has a unique key in `lifecycle_emails` (claimed before sending, released if the send
  fails), so a retried job, a second scheduler run or two servers cannot double-send.
* **Never breaks the action:** if mail is down, the password still changes, the refund is still recorded; the failure
  is logged and the mail is handed to the queue for a retry.
* **Daily cap** per run (`LIFECYCLE_MAX_PER_RUN`), master switch `LIFECYCLE_ENGAGEMENT_ENABLED=false`.
* All numbers (days, gaps, bands) are in `config/lifecycle_mail.php`; all wording in `app/Support/LifecycleCopy.php`;
  the layout in `resources/views/emails/lifecycle.blade.php`.

## 4. Deploying this release

1. `php artisan migrate` — adds `lifecycle_emails` and `users.email_nudges_opt_out_at`.
2. `php artisan route:cache` — the unsubscribe route 404s on a cached route list until you do.
3. Make sure the scheduler cron runs (`* * * * * php artisan schedule:run`).
4. `php artisan mail:check --send-to=<your address>` and `php artisan mail:preview --to=<your address>`.
5. **Before the first daily run**, `php artisan lifecycle:send --dry-run`: the first run after launch sees every
   existing student, so expect a large number. `LIFECYCLE_MAX_PER_RUN` spreads it over days; set
   `LIFECYCLE_ENGAGEMENT_ENABLED=false` to hold the nudges back until you are ready.

## 5. Not built (and why)

* No e-mail address verification at sign-up (accounts are usable immediately; nothing checks the inbox is real).
* No e-mail to a college's TPO when the college plan is about to expire; no contest reminders / results mails.
* No in-app toggle for nudges — the unsubscribe link is the only switch.
* No bounce/complaint handling: Gmail SMTP does not report them back. A transactional provider (SES, Postmark,
  Resend — already in `config/mail.php`) would.
* The payment gateway may send its own receipt as well as ours.
