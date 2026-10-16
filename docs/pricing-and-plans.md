# Pricing and plans (individual students)

Operator's guide to what students pay, what each plan includes, and how the superadmin changes a price.
Colleges and hiring companies are sold by Mellow Ops; the only part of that covered here is the college side of the
pricing page (§8) — see `AdminController` / `SubscriptionService::assignInstitutionPlan` for how a college is put on a plan.

## 1. The three plans

| | **Coder** (free) | **Expert** | **Grandmaster** — Mellow Academy |
|---|---|---|---|
| How it is sold | free, on signup | **online**, at checkout | **by our team** — "Contact our team", no online price |
| Price | ₹0 | ~~₹4,999~~ **₹2,999** per **year** | arranged with the team |
| Length | never expires | 1 year | **3 years** (1,095 days) |
| Coding problems | 1 a day | unlimited | unlimited |
| AI mock interviews | **one free try, ever** | 10 a day | 10 a day |
| Learning Centre (Speaking, Listening, Vocabulary AI) | **one free try of each, ever** | unlimited | unlimited |
| Placement drives | no | yes | yes |
| **Hack Arena** (hackathons — prizes, placement) | no | **yes** | **yes** |
| **Project Lab** (80 workspace-hours a month, 3 projects) | no | **yes** | **yes** |
| **The Vault** (get hired directly through Mellow Vault) | no | **yes** | **yes** |
| The Mellow Academy programme — MERN stack, Laravel, Full Stack and Mobile App development | no | no | **yes** |
| Assured placement | no | no | **yes** |

The struck-through figure is the **list price**, the other is the **sale price** (list minus the discount, 40%
at launch). Those two numbers are set by the superadmin in **Plans & Pricing**, **for Expert only** — Grandmaster
has no price. Everything in the access rows is enforced in code from columns on the `plans` row and shown on the
pricing page from that same row (so the page cannot promise something the plan does not do) — and the superadmin can
change those too, from each plan card's **Edit limits** (see §2b). What the plan cards' hand-written feature
*bullets* (and the Mellow Academy programme list) say is still words in `frontend/src/data/pricing.ts`, changed by a
release.

Students covered by a **college** plan are governed by the college's plan, as before: unlimited practice and
interviews, and — because the `hackathon_access` / `vault_access` columns default to `true` — Hack Arena and the
Vault stay available to them. Only the individual plans opt out. (`plans.talent_pool_access`, the switch the
Vault replaced, is still in the table — a column is never dropped in the same release as the code that stops
reading it — but nothing reads it any more; `vault_access` started as a copy of it.)

## 1b. Mellow Academy (the Grandmaster card)

**What it is.** A programme run by Mellow Academy — MERN stack, Laravel, Full Stack Development, Mobile App
Development, with assured placement — bundled with **three years** of the Vault and every AptRun feature. In the
product it is the **Grandmaster** plan, the third card on the pricing page. It has **no price on the page and no Buy
button**: the card is styled like the other two and ends in a **Contact our team** button (and the support email).

**How it is sold (the flow the code supports):**

1. A visitor or student clicks **Contact our team** → the *Talk to the Mellow Academy team* form
   (`TalkToTeamModal`, audience `academy`; a signed-in student's name, email and phone are pre-filled).
2. It posts to the existing public `POST /api/contact-requests` (same pipeline as colleges and employers: no
   account is created, the request is assigned to the least-loaded marketing employee, and that employee and the
   submitter are both emailed). In the marketing inbox it is labelled **Mellow Academy**.
3. The team talks to the student and agrees the fee outside the product.
4. When they enrol, the superadmin opens **Subscriptions → Give plan** (or the student's **Manage** drawer), picks
   **Grandmaster**, chooses *Paid outside the gateway*, enters the amount received and the reference, and saves.
   The term defaults to the plan's own three years. The student has everything on their next request.

**What the server guarantees:**

- `plans.contact_only = true` on the `grandmaster` row. `PurchaseQuoteService` refuses it (422 "not available for
  self-serve purchase") *before it reads any price*, so no request — whatever `expected_total` it carries — can buy
  it, and it stays unbuyable even if someone later types a price on the row.
- `Plan::isFree()` is false for it (a missing price is never "free"), `Plan::scopePaidTier()` counts it as a paid plan
  in every "paid" list/filter/summary (Subscriptions, the Students directory, the overview), and
  `Plan::isPriceEditable()` is false (Plans & Pricing shows a **Sold by our team** card with the limits editor and the
  subscriber count but no price fields).
- The public price block says `contact_only: true` with zeroed figures; the page never draws it as ₹0.
- Revenue: an offline payment records the fee; the overview spreads it over the plan's own term (`meta.term_days`
  1,095), so a ₹60,000 fee shows as roughly ₹1,644 a month, not ₹60,000.
- A student can't be sold Expert on top of an unfinished Grandmaster: the "downgrade blocked" rule compares
  `sort_order` (Grandmaster 3 > Expert 2).

**Not built (flag if you want it):** course delivery, attendance or a batch/cohort for Academy students — the plan
gives them platform access; the programme itself is run by the Academy outside AptRun. No email goes to the student
when the plan is granted (as with every superadmin grant).

## 2. Changing a price (superadmin)

**Superadmin → Plans & Pricing.** For Expert (the one plan with a price):

- **List price** — the "real" price, in whole rupees per year (1 – ₹5,00,000).
- **Discount** — whole percent taken off, 0 – 90. `0` removes the discount and the pricing page then shows a
  single price with no strike-through.

The card previews exactly what students will see while you type. **Review & save** shows before → after and
what happens to current subscribers; **Save & go live** applies it.

- It is **live immediately.** The public pricing page polls `GET /api/public/plans` every 20 s (and the moment
  a hidden tab comes back, the network returns, or you save in another tab of the same browser), so visitors see
  the change within seconds, no refresh, no deploy. Checkout re-prices from the same rows.
- **Running subscriptions are never repriced.** What a student paid is stored on their subscription
  (`meta.price_paid`). The new price applies to whoever buys or renews after the change.
- A student who had the old price on screen when you saved is **not charged it**: checkout sends the total they
  saw and the server answers 409 `price_changed` with the new quote instead.
- Two superadmins editing at once: the second save is refused ("changed by someone else — reload") rather than
  overwriting the first.
- Every change is written to the **Audit Log** (`Changed plan pricing`) with the old and new list price,
  discount and sale price, and the plan row records who changed it last.
- The free plan stays ₹0, and Grandmaster stays priceless (see §1b). Plans cannot be switched off from this screen
  (`plans.is_active`, if ever needed, is a database change; an inactive plan disappears from the pricing page —
  including the Mellow Academy card — and cannot be bought).

Not editable here on purpose: what each plan includes (that is §2b), the billing term (365 days; Grandmaster's is
1,095), college and company plans.

### How the numbers are derived

```
discount  = list − round(list × (100 − percent) / 100)        Plan::discountFor()
sale      = list − discount
4,999 @ 40%  → discount 2,000 → sale 2,999
```

One function (`Plan::discountFor`, mirrored by `previewSalePrice` in `frontend/src/lib/pricing.ts` for the live
preview) rounds the discount to a whole rupee; the server's answer is always the one charged.

## 2b. Changing what a plan includes (superadmin)

**Superadmin → Plans & Pricing → a plan card → Edit limits.** The numbers (coding problems a day, AI mock
interviews a day, Learning Centre AI uses a day, the free plan's one-time tries, Project Lab hours and projects)
and the switches (placement drives, Hack Arena, the Vault, Project Lab) are the very columns the server
enforces, so a saved change:

- applies to **everyone already on the plan on their next request** (nothing is cached);
- reaches the public pricing page's numbers and comparison table within one poll (they are generated from the same
  columns), and every student's open dashboard within ~30 s (their plan signature changes — see
  `docs/superadmin-controls.md` §3);
- is written to the audit log with every changed field's before and after.

This works for Grandmaster too (e.g. give Academy students a higher AI-interview cap than Expert).

Rules that keep it safe: the editor always sends the **complete** set (an omitted field is refused, never read as
"unlimited" — unlimited is an explicit `null`); each field is range-checked on the server; a stale editor is refused
("changed by someone else"); and the editor warns — without blocking — when a change would give the free plan
away (e.g. unlimited practice on Coder).

## 3. Where things live

| What | Where |
|---|---|
| Plan rows, prices, discount, switches, trial allowance | `plans` table — `list_price`, `discount_percent`, `contact_only`, `hackathon_access`, `vault_access`, `project_lab_access`, `feature_trial_uses`, `max_*` |
| Price maths and the price block every surface renders | `app/Models/Plan.php` (`listPrice`, `discountAmount`, `salePrice`, `pricing()`, `entitlementSummary()`, `isContactOnly()`, `scopePaidTier()`) |
| Public live price list | `GET /api/public/plans` — `PublicPlanController` (ETag, always revalidated — never served stale; limiter `public-plans`) |
| Superadmin editor API | `GET /api/superadmin/plans`, `PUT /api/superadmin/plans/{code}` (price), `PUT /api/superadmin/plans/{code}/entitlements` (limits) — `SuperAdminPlanController` |
| Giving / extending / ending a plan by hand | `docs/superadmin-controls.md` — `SuperAdminSubscriptionController`, `SubscriptionService::grantIndividualPlan / extend / cancel` |
| What a cart costs (and the refusal of a team-sold plan) | `PurchaseQuoteService` (the one place a price is decided) → `SubscriptionService::purchase` |
| Hack Arena / Project Lab / free-trial enforcement | `PlanGate` + `PlanRequiredException` (HTTP 402 `plan_required` / `trial_used`) |
| Daily limits | `SubmissionController` (problems), `InterviewController` (AI interviews), `EnforcesLearningCentreAiLimit` |
| Mellow Academy enquiries | `POST /api/contact-requests` (`audience: academy`) — `ContactRequestController`, `ContactRequestService`; inbox: Marketing → Inquiries |
| Frontend live prices | `lib/usePublicPlans.ts` (one shared poller), `components/pricing/*`, `components/billing/*` |
| Frontend marketing copy (cards, Academy programme list) | `frontend/src/data/pricing.ts` — words only; **no prices live here** |
| Frontend: the Mellow Academy card | `components/pricing/AcademyCard.tsx`; its enquiry form `components/marketing-site/TalkToTeamModal.tsx` |
| Superadmin screen | `components/admin/superadmin/PlansPricingPanel.tsx` (+ `PlanLimitsModal.tsx`, `GrantPlanModal.tsx`) |

`PlanSeeder` seeds the catalogue. It writes `list_price` / `discount_percent` **only when it creates a plan row**;
re-running it (a deploy that runs `db:seed`, a fresh test DB) refreshes everything else but never puts the shipped
price back over the superadmin's.

## 4. The free plan's "try everything once"

`plans.feature_trial_uses = 1` on Coder. A student on a plan with this set may use **each AI practice feature N
times in total, ever** (not per day): an AI mock interview, a Speaking Lab recording, an AI speaking passage, an
AI listening lesson, an AI vocabulary quiz. Counts come from the rows those features already write
(`PlanGate::used()`), so there is no separate counter to drift. A speaking take that failed to score does not
spend the try. Word-bank sprints and library lessons (which cost nothing) are not limited.

After the try the server answers 402 `trial_used`; the page shows a banner (`FreeTrialBanner`) before and after.
Upgrading removes the cap (Expert/Grandmaster have `feature_trial_uses = null`). Real placement interviews, track
rounds and college/company assessments are **never** throttled by any of this.

## 5. Hack Arena and the Vault

- **Hack Arena.** Browsing the lobby, a hackathon page, its gallery and results is open to every student (it is
  the shop window). **Registering** and **saving/submitting a project** need `hackathon_access` — otherwise 402
  `plan_required` ("Hack Arena is part of the Expert plan…"). Leaving a hackathon is never refused.
- **The Vault** replaced the Talent Pool and is the headline paid-plan feature: getting hired directly through Mellow
  Vault. It is enforced by `vault_access` (`PlanGate::requireVaultAccess()` → 402 `plan_required`, feature `vault`).
  Earning the readiness score is open to every plan; only **being listed** is gated. A student who reaches 60 on
  the free plan is recorded as `upgrade_required` and can join the day they upgrade — no retake. A student whose
  plan ends is taken off Mellow Vault at once (their earlier yes is remembered). Full story:
  `docs/readiness-and-vault.md`.

Every locked-feature prompt in the app (Hack Arena, Project Lab, the Vault, the sidebar locks, the free-trial banner)
now points at **Expert** — the plan that unlocks them; the frontend's single constant for it is `EXPERT_PLAN_CODE`
in `lib/pricing.ts`, the backend's is `Plan::CODE_EXPERT`.

## 6. Existing customers and the migrations

### 2026-10-18 — Expert takes over Grandmaster; Grandmaster becomes Mellow Academy

`2026_10_18_100000_make_expert_the_full_plan_and_grandmaster_the_academy_plan`:

- adds `plans.contact_only` (default `false`);
- **copies the live Grandmaster row onto Expert** — list price, discount, 365-day term and every limit and switch — so a
  price the superadmin changed since launch moves across exactly as it stands (it does not re-type ₹4,999 / 40%);
- **moves every subscription that was on Grandmaster to Expert** (any status), tagged `meta.moved_from_plan =
  'grandmaster'`: they bought what is now called Expert, at the price Expert now has. Dates, status and price paid are
  untouched. Left where they were, a ₹2,999 buyer would turn into an Academy student overnight;
- turns Grandmaster into the team-sold plan: `contact_only = true`, `list_price`/`annual_price` null, discount 0,
  `duration_days` 1,095, active — its limits and switches stay as they were (everything on);
- `down()` puts subscriptions the migration moved back on Grandmaster, gives Grandmaster the price and limits Expert
  carries and returns Expert to the launch mid tier (₹1,999 / 40%, 10 problems a day, 3 interviews, no Arena/Lab/Vault) —
  it cannot know any edit the superadmin made to Expert in between.
- On a fresh install there are no plan rows when it runs, so it only adds the column and `PlanSeeder` creates the rows.

**Who is affected on an existing database:**

- *Someone who bought Grandmaster (₹2,999)* is now on **Expert** with the same access, dates and price paid.
- *Someone who bought the old Expert (₹1,199)* **keeps their dates but now gets the complete Expert** — Hack Arena, the
  Vault, Project Lab, unlimited problems, 10 interviews a day — for the rest of their term, at no charge. A plan's limits
  live on the plan row, so this can't be avoided without keeping a second retired plan around. It renews at ₹2,999.
- *Nobody becomes a Mellow Academy student* by the migration; that only happens when the superadmin grants the plan.
- Receipts and the audit log keep the old plan names ("Grandmaster") as history.

### 2026-10-14 — three tiers, yearly prices

`2026_10_14_100000_restructure_individual_plans_pricing_and_access` renamed `monthly_price` → `list_price`, added the
discount, trial and access columns, set the first matrix (Coder / Expert ₹1,999 / Grandmaster ₹4,999, 40% off) and retired
the Project Lab add-on (`is_active = false`).

- Subscriptions already running keep their dates, are not repriced and are not extended. A 30-day Expert bought
  last week at ₹399 runs out in three weeks and then renews at the new yearly price.
- Someone holding a Project Lab add-on keeps it to the end of the period they paid.

### Deploying the 2026-10-18 change

1. `php artisan migrate` (take a DB backup first — the migration rewrites plan and subscription rows).
2. Nothing to `route:cache`: no route was added or changed. `config:cache` is not affected either.
3. Build and ship the frontend as usual.
4. Check **Superadmin → Plans & Pricing**: Expert ₹4,999 / 40%, Grandmaster *Sold by our team*; and `/pricing`.
5. Make sure someone reads the marketing inbox: Mellow Academy enquiries arrive there (Marketing → Inquiries).

## 7. Before taking real money

**Payments are PayU (Razorpay is built in as the alternative — `PAYMENT_GATEWAY`).** A plan is only ever activated after a verified payment — see `docs/payments-payu.md` (and `docs/payments-razorpay.md`) for the
flow, the setup (keys, webhook, cron) and the runbook. The old `POST /me/subscription` instant activation is gone; until the
gateway keys are in `backend/.env`, paid plans simply cannot be bought (the pricing page says "Payments launching soon").
Still open as business decisions (listed in that doc): GST/tax invoices, auto-renewal, and chargeback handling. (Expert → Grandmaster
upgrade credit no longer arises: Grandmaster is not bought online.) New with Mellow Academy: the **terms of the "assured
placement" promise** are not in the product — the card says they are explained by the team before enrolment, so make sure
they are written down and that the team does explain them.

## 8. The college / university side of `/pricing` ("For Colleges & Universities")

Two cards, **no prices**, one button each: **Academic Enterprise** (the whole-university placement platform) and
**Mellow Academy** (the programme for a college's students — MERN, Laravel, Full Stack and Mobile App development,
assured placement, 3 years of AptRun + the Vault for every enrolled student, every AptRun feature). The old
**Standard** (₹1,49,000) and **Pro Campus** (₹4,49,000) cards and their prices are gone from the page.

- **The button** is *Contact our team*: it opens the Talk to Our Team form (`TalkToTeamModal`, college audience, no
  college/employer switch) with the clicked offer already written into the message ("We'd like to know more about
  Mellow Academy for our college.") and, for a signed-in TPO, their name, email, phone and college filled in. It posts
  to `POST /api/contact-requests` like every other marketing enquiry — the team reads it in Marketing → Inquiries as a
  *College / TPO* request, and the submitter gets the usual confirmation email. Under the cards: three "how it works"
  steps and the support email.
- **A signed-in TPO** still sees where their own college stands ("Your college is on the Pro Campus plan · 210 days
  remaining", or "doesn't have an active plan yet").
- **Words** live in `frontend/src/data/pricing.ts` (`INSTITUTION_OFFERS`, `INSTITUTION_CONTACT`); the page is
  `components/pricing/InstitutionPlans.tsx`. `PricingPlans` is now individuals-only.
- **What did NOT change:** the `standard`, `pro-campus` and `academic-enterprise` rows in `plans`, the superadmin /
  Mellow Ops screens that assign them to colleges, and any college already on them. Only the page stopped advertising the
  two smaller tiers. There is **no Mellow Academy plan for colleges in the database** — a college's Academy engagement is
  arranged by the team (and, if it should switch on features, assigned like any custom college plan).
- **Claims to confirm with the team:** the Academy card says enrolled students get *assured placement* and 3 years of
  AptRun + the Vault, and that the college's placement cell tracks their readiness from the TPO dashboard (assumed from
  "every AptRun feature"); the card tells colleges the programme/batch plan and placement terms are agreed with them
  before anything starts. Academic Enterprise keeps its existing enterprise promises (proctoring, success manager, SLA,
  LMS/ERP integrations, custom contract, data residency).
