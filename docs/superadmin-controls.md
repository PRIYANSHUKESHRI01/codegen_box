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
| Get into an account | Accounts & Logins → **Unlock** → **Show password** (issued logins), **Change password**, or **View as this user** | See §4 — a password the owner chose cannot be read |

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

**A password an owner chose cannot be shown.** Passwords are stored as one-way (bcrypt) hashes, so once a user sets their
own there is nothing to read, and keeping recoverable copies of everyone's real password would turn one database leak into
a leak of every account (and of whatever else they reuse it on). What a superadmin **can** see is the **temporary password
an account was issued**, for as long as its owner has not replaced it — and they can set a new password for anyone.

**Looking up an issued login** (Superadmin → Accounts & Logins, and Manage → Sign-in & access):

1. Press **Unlock** and re-enter *your own* password. The unlock lasts 10 minutes, on that browser session only, and
   **Lock now** closes it at once. (`POST /api/superadmin/credentials/unlock`, `…/lock`, `GET …/status`.)
2. **Show password** on a row fetches that one account's login (`POST /api/superadmin/users/{id}/credentials`) and shows
   it for 30 seconds, with Copy. The list itself never carries a password — only a state: *viewable*, *private — user chose
   it*, *not on file — reset to issue one*, or *protected* (superadmins: never shown).
3. The table re-reads itself every 20 s (and on focus), so a row flips to *Private* soon after its owner changes their
   password — and the lookup re-checks the stored value against the account's current hash anyway, so a stale copy is
   never shown even if you click first.

How the issued password is kept (`IssuedCredentialVault`, table `issued_credentials`): encrypted with `APP_KEY` (a leaked
DB dump alone reveals nothing); one row per account; written wherever the platform issues a password (account creation by
superadmin / Mellow staff / TPO / coordinator, bulk student import, candidate import, reset, set-by-superadmin); deleted the
moment the owner sets their own (change-password and forgot-password flows) and on sight if it no longer matches the hash;
expires after 30 days; superadmins are never stored; if `APP_KEY` is ever rotated those rows simply become unreadable
(treated as "not on file"). Accounts issued **before this feature** have no copy — reset them once to get a viewable one.

Protection layers: superadmin role only (a "view as" token belongs to the viewed user and can't reach it) → password
re-entry unlock → `superadmin-credentials` limiter (40/min; unlock itself uses `superadmin-sensitive`, 10/min) → every
lookup written to the audit log (who, whom, state — never the password) → `Cache-Control: no-store` on every response.

**Changing a password** — *Change password* on a row or in the drawer: let the server generate a strong one, or type one
(8–72 characters; **Suggest** fills a random one). It replaces the old password at once, signs the account out everywhere,
and (optionally) e-mails it. By default the new password is temporary — the owner must choose their own at next sign-in and
you can look it up again until they do. Untick *Ask them to choose their own* to set a permanent password; **no copy is
kept** for that. Needs your own password; superadmins can't be targeted (they change their own from Settings).

The rest of what you can do without touching a password:

- see the **login ID** (email), whether the password is still the temporary one, when the login email was sent, last
  seen, and how many sessions are open;
- **View as this user** — see exactly what they see, without knowing or changing their password and without signing them
  out. This is the right tool for "I want to see their dashboard/plan/locks".

**Directory filters** (Accounts & Logins, Students): account-type chips with live counts (scoped to the chosen university
and search), a type-to-search **university picker** with per-university counts for the chosen type and a *No university*
choice (staff, hiring companies, individual coders — `college_id=none`), plan filter (students only), and *Clear*.
Choosing a type that never belongs to a university (hiring companies, Mellow staff, superadmins) drops the university
filter. Counts come from `GET /api/superadmin/users/facets` (two grouped counts, no row data).

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

Throttles: password-confirming actions (view as, sign-out, delete, reset, unlock, ending a college's plan) share
`superadmin-sensitive` — 10/min per superadmin.

## 6. Deploying this

- **One migration** (`2026_10_26_100000_create_issued_credentials_table`, additive — a new table only): run
  `php artisan migrate`. Until it runs, creating an account still works (keeping the lookup copy never throws) but
  *Show password* has nothing to show.
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

## 9. Partner Universities: edit a college, set the TPO's password (2026-10-30)

**Superadmin → Colleges & TPOs** (`PartnerCollegesPanel`, cards in `CollegeCard`):

- **Edit details** → `PUT /api/superadmin/colleges/{college}` (`SuperAdminCollegeController`): college name, short code (upper-cased,
  unique, `A-Z 0-9 . _ & -`), city, state, and the TPO's name and **login email**. A new TPO email re-asks for the superadmin's own
  password (it is where "forgot password" codes go), must not belong to any other account, and clears `email_verified_at`. Only a TPO
  of *that* college can be targeted (`tpo_user_id`; anything else is a 404). Audited (`college_changes` / `tpo_changes`, before → after).
- **TPO password** → the existing `POST /superadmin/users/{id}/reset-password` (`ResetPasswordModal`): generate or type one, ask the TPO to
  change it at next sign-in or not, optionally email it; signs the TPO out everywhere. Nothing new on the server.
- Both are hidden for Mellow Ops staff (the panel is shared with `/admin`): the page passes `canManageDetails`, like `canDeleteColleges`.
- **How the TPO's open screen follows:** `GET /me/plan-signal` now carries `profile_signature` (college name/code/city/state + the
  account's name/email) for every account with a college. `lib/planSync.ts` fires `aptrun:profile-changed` when it moves;
  `PlanSyncWatcher` reloads `/me` (sidebar, header chip, hero and every college label re-render) and toasts "Details updated". Same
  cadence as plans: ≤30 s, instantly on focus/visibility/online. The TPO also gets a bell notification (`college.profile_changed`).
- Not a plan change: the signature is separate from the plan signature, so nothing reads "your plan changed".
- **Deploy:** no migration. `php artisan route:cache` (new route). Frontend rebuild.
- **Verified:** `SuperadminCollegeEditTest` (7), `partner-colleges-edit.test.tsx` (8), plan-sync tests, and a browser run on a scratch
  API (rename + code + TPO email in the dialog → the TPO's already-open page switched itself in 22 s; no horizontal overflow from 390 px to
  1902 px). Section coordinators have no `PlanSyncWatcher`, so their open page picks the new name up on next load.

### 9b. The list is built for ~100 colleges (same day)

- **List view (default)** = a sortable table, 24 rows per page; **Cards** = compact 3-4-across cards. The choice and page size are remembered
  per browser (`aptrun:partner-colleges-view`); a phone with no saved choice starts on Cards.
- **Find things:** search (name, code, city, TPO name/email), plan-tier and department dropdowns, status chips (All / Active / Renewing soon /
  No plan / Suspended) whose counts follow the other filters, sort (click a header, or the Sort dropdown), "Clear filters", pagination
  (12 / 24 / 48 / 96). Sorting by plan expiry puts a college with no running plan first. All of it is client-side over `GET /admin/colleges`
  (one request, no server paging) — fine for hundreds; if it ever reaches thousands, move filtering and paging into that endpoint.
- **Every action** is in one "Manage" menu (`ActionMenu`, a reusable keyboard-operable popover drawn on `<body>`, flips up near the bottom):
  Edit details · TPO password · Renew / Change Plan · Adjust Seats · Import Students · Departments · Coordinators · Block TPO · Delete.
  Same menu in the row and on the card.
- Tests: `partner-colleges-scale.test.tsx` (100 colleges: paging, sort, filters, view memory, menu keyboard). Browser run with 100 seeded
  colleges at 390 → 1902 px, no page overflow in either view.

## 10. Merchant Navy on/off (2026-10-31)

**Superadmin -> Merchant Navy** (new tab + sidebar item, `MerchantNavyPanel`): ONE switch that shows or hides the whole Merchant Navy section for
**every student**: the sidebar group ("Merchant Navy -> Mock Orals", `/dashboard/merchant-navy`) **and** the "Merchant Navy" domain card in the
Mock AI Interview. The panel also shows where students see it, each exam's sets/questions/Open-or-Coming-soon, who changed it last, and the
last 10 changes. Deactivating asks first; activating when no exam is open yet warns first.

- **Storage:** table `platform_modules` (`key`, `enabled`, `updated_by`), module definitions in `config/platform_modules.php`, read through
  `App\Services\PlatformModules` (scoped, one query per request, no cache -> the next request anyone makes sees it). **Ships ON** (the migration
  inserts the row enabled), so deploying changes nothing. No row / no table yet = module default (on): a deploy that has not migrated never 500s.
- **API:** `GET /superadmin/platform-modules`, `PUT /superadmin/platform-modules/{key}` `{enabled: true|false}` - explicit, never a blind flip, so a
  double click or a second tab cannot undo the other; audited once per real change (`ActivityLog`, target "Platform module"); superadmin-only.
- **Enforced on the server, not just hidden:** `MockInterviewService::catalog()` leaves the domain out; `start()` answers 403
  `{code: "module_unavailable"}`; `InterviewController::reattempt` refuses a Merchant Navy (discipline `maritime`) sitting. Staff keep full access to the
  Mock question bank while it is off (prepare content, then activate).
- **Student capability:** `DepartmentCapabilities::forUser()` adds `merchant_navy` (platform switch, not a department matter; deliberately NOT in
  `config/departments.php`). `/me` carries it, `studentNav` hides the group on `caps.merchant_navy === false`, and `ModuleGate` (in
  `app/dashboard/merchant-navy/layout.tsx`) shows "isn't available right now" if a student is on / bookmarks the page.
- **Real time:** `GET /me/plan-signal` now carries `modules` + `modules_signature` (a marker separate from the plan signature, so nobody is told their plan
  changed). `planSync` fires `aptrun:modules-changed`; `PlanSyncWatcher` reloads `/me` (sidebar) and toasts once; `MockInterviewExplorer` re-fetches its
  catalogue. <= 30 s on an open screen, instant on focus/tab-return.
- **Decisions I made unasked:** a student already inside a sitting may finish it; past results/history are kept (not hidden); the TPO / Mellow
  Vault / readiness are untouched; one switch for both places (not two) as asked.
- **Deploy:** `php artisan migrate` (new table), `php artisan route:cache` (new routes), `config:cache` if cached (new `config/platform_modules.php`), frontend rebuild.
- **Verified:** backend `PlatformModuleSwitchTest` (10), frontend `merchant-navy-switch.test.tsx` (13), plus a browser run (below).

## 11. Marketing Team (2026-10-31)

**Superadmin -> Marketing Team** (new tab + sidebar item, `marketingTeam/MarketingTeamPanel`): add, manage and remove the people who answer
"Talk to Our Team" enquiries and chase leads (role `admin_marketing`). The older "Mellow Staff" tab still lists them too; this is the team view.

- **See:** each person's access, what they carry (open leads / open enquiries / converted), status (Active / Blocked / Not signed in yet), search +
  status filter, and a banner + "Waiting for an owner" tile when leads or enquiries have nobody holding them.
- **Add:** name + work email + which sections (View & Manage Leads, Send Bulk Lead Emails) -> `POST /superadmin/users` (existing); the one-time password is
  emailed and shown once. Hiring (and **unblocking**) deals out anything that was waiting, evenly.
- **Account & password / sign-out / activity:** the existing Manage drawer. **Edit access:** existing `POST /users/{id}/permissions`. **Block:** existing
  toggle-block, then offers to hand over what they still hold.
- **Reassign work** (`POST /superadmin/marketing-team/{user}/reassign`): move OPEN leads/enquiries (new/contacted/engaged) to one colleague, share evenly (least-loaded
  first, leads and enquiries balanced separately), or leave unassigned; optional "also closed" (won/lost). Receivers get a bell notification. Never to a blocked person.
- **Delete** (`DELETE /superadmin/marketing-team/{user}`): must say where the work goes (to / distribute / leave), type the email, re-enter your password; ALL their
  leads and enquiries move (closed too - otherwise they fall back into the unassigned pile and the next hire's sweep would take them), tokens and any issued
  credential are removed, avatar deleted, audited. If the work cannot be placed (e.g. "share" with nobody to share with) NOTHING is deleted. Marketing only (404 otherwise).
- **New safety net:** an enquiry that arrives when no active marketing employee exists now alerts every superadmin once (bell, links here) - before, the
  submitter was told "we'll be in touch" and nobody heard of it (`LeadAssignmentService::warnSuperadminsNobodyCanTake`).
- **Deploy:** no migration; `php artisan route:cache` (new routes); frontend rebuild.
- **Verified:** `SuperadminMarketingTeamTest` (11), `marketing-team.test.tsx` (17), backend lead/marketing/contact/superadmin regression (283), full frontend 2540; browser run on a
  scratch API (add -> waiting enquiries dealt out -> reassign -> block + hand-over offer -> delete with share-out -> edit access -> account drawer); phone has no overflow.
- **Not done:** a shared `sales@` copy-to address (enquiry mail still goes only to the assigned employee's own email); no per-employee "last active" column.
