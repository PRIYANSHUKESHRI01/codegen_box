# Superadmin controls — plans, accounts, sign-in and "view as"

What the superadmin can do to any account or plan, how a change reaches the person it affects **while their page is
open**, and what keeps each tool safe. For prices and what each plan includes, see `docs/pricing-and-plans.md`; for how
students pay, `docs/payments-payu.md`.

All of it lives under **Superadmin Master Control** (`/superadmin`). Every route is `role:superadmin` only (a Mellow
staff account gets 403); every change is written to **Audit Log** with who did it, to what, and why.

## 1. What is where

| I want to… | Go to | Notes |
|---|---|---|
| See every plan anyone holds (students, colleges, companies) | **Subscriptions** | Free Coder rows hidden by default ("Show free plans" brings them back) |
| Give a student a plan | Subscriptions → **Give a plan**, or an account's **Manage → Plan & billing** | Free of charge, or against a payment taken outside the gateway |
| Add days to a plan | Subscriptions row → **Extend** | Only a plan that is running and has an end date |
| End a plan now | Subscriptions row → **End** | Student → back on the free plan at once. A college's or company's asks for **your password** |
| Change what a plan costs | **Plans & Pricing** | Live the moment it is saved |
| Change what a plan includes | Plans & Pricing → **Edit limits** | Daily limits, free tries, Arena / Pool / Lab switches |
| Look at / fix / control one account | Students, Leads, Mellow Staff, **Accounts & Logins** (or a Subscriptions row) → **Manage** | The same drawer everywhere |
| Get into an account | Manage → **Sign-in & access** → **Reset password & show it**, or **View as this user** | See §4 — passwords cannot be read |

The **Manage** drawer has four sections: *Overview* (details, correct them, a student's progress), *Plan & billing*
(what they hold, history, give/extend/end, their payments), *Sign-in & access* (login, reset password, sign out of all
devices, view as, block, delete) and *Activity* (what they did and what was done to them).

## 2. Plans by hand

Backend: `SuperAdminSubscriptionController` → `SubscriptionService::grantIndividualPlan / extend / cancel`.

| Action | Route | Rules |
|---|---|---|
| Give a plan | `POST /api/superadmin/users/{user}/subscription` | Students only; a paid individual plan; term 1–1825 days (default the plan's year); a **reason is required**. Replaces the plan they hold now, starting today. Refuses to *shorten* the same plan they already have more time on ("use Extend"). |
| Extend | `POST /api/superadmin/subscriptions/{id}/extend` | Adds days to `current_period_end`; never touches plan, price or start. A plan that has already ended is not revived by this — give it again. |
| End | `POST /api/superadmin/subscriptions/{id}/cancel` | Marks it cancelled (kept in history with who/why). Student: a fresh free Coder row is created so "every student has a plan" stays true. College/company: needs the superadmin's own password. |
| List | `GET /api/superadmin/subscriptions` | Filters: state, audience, source, ending within N days, free plans, search by student/college/company. |

**Money is never invented.** A given plan is recorded with `meta.source = admin_grant`:

- *Free of charge* → `price_paid = 0`: not counted in the Overview's recurring revenue, and a sales lead is **not** marked a customer.
- *Paid outside the gateway* → the amount actually received (and an optional reference) is recorded and counted
  (spread over the term actually given), and a lead **is** converted.
- Ending a plan **does not refund** anything. Money taken through PayU/Razorpay is refunded from that gateway's
  dashboard; the refund webhook then takes the plan back by itself.
- A student covered by a **college** plan is governed by it. A personal plan given to them is kept on file and applies
  only when the college's plan ends — the dialog and the response say so.

## 3. How a change reaches an open page ("real time")

The server is always right on the very next request: every limit and lock reads the plan row (nothing is cached), so a
plan given, extended, ended, or a limit edited is enforced from the next API call the person makes.

The **screen** is kept in step by `GET /api/me/plan-signal` — a few-byte answer (a signature over the governing plan, its
end date, add-ons and the plan row's last edit) that every open student/TPO dashboard asks every **30 s**, and also when
the tab becomes visible, the window is focused or the network returns (`frontend/src/lib/planSync.ts`, one shared poller).
When the signature moves it fires the app's existing `SUBSCRIPTION_CHANGED_EVENT` (sidebar locks, plan chip, usage
meters, the Plans & Billing page all refetch) and shows a notice: *"Your plan is now Grandmaster"*, *"Your Grandmaster
plan has ended"*, *"…was extended"*. Edits to a plan's limits refresh the page silently.

Why polling and not a socket: the API runs on PHP-FPM/Apache where a held-open connection pins a worker per visitor; a
30 s poll of a tiny endpoint is cheap, survives proxies and sleeping laptops, and a returning student sees the change at
once. Rate limits: `plan-signal` 90/min/user; `superadmin-subscriptions` 60/min/user.

**Blocking is real-time too.** `is_blocked` used to be read only at login, so a blocked student's open session kept
working. `EnsureAccountIsActive` now refuses every authenticated request from a blocked account (403 `account_blocked`);
the browser (`lib/api.ts` → `lib/sessionEvents.ts` → `AuthProvider`) signs it out and the login page says why. The same
path handles "signed out of all devices" and an expired token (401).

## 4. Passwords, credentials and "view as"

**A password cannot be shown.** Passwords are stored as one-way (bcrypt) hashes and a user replaces their temporary one
at first login, so no copy exists to read; storing recoverable passwords would make one database leak a leak of every
account on the platform. Instead, in **Manage → Sign-in & access** the superadmin can:

- see the **login ID** (email), whether the password is still the temporary one, when the login email was sent, last
  seen, and how many sessions are open;
- **Reset password & show it** — issues a fresh temporary password, shown once (optionally emailed); the old password
  stops working and every session is signed out. Needs your own password; superadmin accounts are excluded.
- **View as this user** — see exactly what they see, without knowing or changing their password and without signing them
  out. This is the right tool for "I want to see their dashboard/plan/locks".

**View as** (`SuperAdminAccountController::impersonate`): needs your password; a Sanctum token with the single ability
`impersonated` and a 60-minute expiry; **read-only** — `RejectWritesWhileImpersonating` refuses every non-GET request except
sign-out, so nothing can be submitted, bought or changed as them (`403 impersonation_read_only`); does not move the user's
"last seen"; refuses superadmins, yourself and blocked accounts; an unmissable banner on every page
(`ImpersonationBanner`) with the countdown and **Exit view**; entering and leaving are both audited. Your own session is
parked in the browser and restored on exit or when the viewing token runs out; signing out while viewing is a full sign-out
and also revokes the parked token.

## 5. Other account controls

| Action | Route | Rules |
|---|---|---|
| Full picture of one account | `GET /api/superadmin/users/{id}/manage` | identity, login, plan + history, payments, activity, and what *you* may do to it (`capabilities`) |
| Correct details | `PUT /api/superadmin/users/{id}` | name, email, handle, phone, roll no., branch, section, CGPA, backlogs; a student may be **moved to another college** only if it has room (the same seat rule as adding a student). Changed phone ⇒ must be re-verified. Only changed fields are written; each change is audited before→after. Never role, password, block or permissions. |
| Sign out of all devices | `POST /api/superadmin/users/{id}/revoke-sessions` | not superadmins, not yourself |
| Delete one account | `GET …/deletion-preview`, `DELETE /api/superadmin/users/{id}` | Students and section coordinators only (`UserPurgeService`). Needs your password **and** the account's exact email. Removes the account, tokens, plans, files and everything that cascades; **payment records are kept** (user nulled, payer name/email snapshotted). Staff/TPO/company accounts are refused — block them, or delete the college. |
| Block / unblock | existing `POST …/toggle-block` | now effective on the very next request |

Throttles: password-confirming actions (view as, sign-out, delete, reset, ending a college's plan) share
`superadmin-sensitive` — 10/min per superadmin.

## 6. Deploying this

- **No database migration** — every column it uses already exists (it deliberately avoids a schema change so it can't
  break a deploy that hasn't migrated yet).
- Run `php artisan route:cache` (and `config:cache`) on the server: cached routes hide new endpoints and the new
  rate-limit names are registered in `AppServiceProvider`.
- Behaviour change to know about: **blocked students are now cut off immediately**, not at their next login.
- Seeded demo accounts have fixed passwords (see `DatabaseSeeder`); rotate or delete them on a production database.

## 7. Verified how

`SuperadminSubscriptionManagementTest` and `SuperadminAccountManagementTest` (backend, 54 tests: every rule above, plus
that no non-superadmin can reach any route); frontend `superadmin-subscriptions`, `superadmin-user-drawer`,
`impersonation-and-session`, `api-session-end`, `plan-sync`, `billing-page-and-plan-limits`. Also driven end to end in a
real browser (grant → the student's open page switches within one poll → end → block → view as → limits → delete).

## 8. Not done / worth knowing

- A student is told about a plan change on screen, not by **email** (no mail template was added).
- "View as" is read-only by design; there is no "act as". Editing on someone's behalf is done from these tools, audited
  under your name.
- Plan **hand-written feature bullets** on the pricing cards are still edited in `frontend/src/data/pricing.ts`.
- TPO-only screens (drive mapping, mock contests, cohort reports) are not duplicated for the superadmin; **View as** a TPO
  shows them (read-only), and Mellow Ops routes the superadmin already had cover college-level management.
