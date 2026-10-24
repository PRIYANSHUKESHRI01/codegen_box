# Readiness and the Vault

Two things changed together:

1. **One readiness score for every student.** The same 0–100 number, from the same rules, whether the student
   comes through a college TPO or signs up on their own. It is built only from what the student actually does on
   AptRun, and everything a hiring partner posts is excluded.
2. **The Talent Pool became the Vault** — the way a student gets **hired directly through Mellow Vault**, and a
   **Expert feature** for individual students (Grandmaster, the Mellow Academy plan, includes it too). A student whose readiness reaches **60** is eligible. If their
   plan includes the Vault and they say yes *once* (revocable any time), their profile is listed to AptRun's hiring
   partners **and handed to Mellow Vault**, where employers can find, interview and hire them.

Everything below is the operator's and developer's reference. Code: `ReadinessScoreService`,
`App\Services\Vault\*`, `config/readiness.php`, `config/vault.php`.

---

## 1. The readiness score (v5)

`ReadinessScoreService` is the only place a score is computed. College students and independent students are
scored by **exactly the same rules** — nothing depends on a college, a CGPA or a plan.

| Component | Points | What it measures |
|---|---:|---|
| **AI Interviews** | 20 | Average of the student's last 5 scored interviews (Mellow's and their TPO's) |
| **Coding Practice** | 15 | Breadth and depth across the problem catalogue — easy 20 / medium 40 / hard 40, plus topic coverage |
| **Learning Centre** | 15 | Speaking 40% · Listening 30% · Vocabulary 30% of the component, each from the last 5 attempts |
| **Soft Skills** | 10 | Average of the last 5 completed soft-skills tests |
| **Contests** | 15 | Share of a contest's points scored, over the last 5 finished contests (daily, TPO, Mellow). A contest *rating* is a floor under this |
| **Events & Projects** | 10 | Showing up: contests entered, hackathons joined (more if the team submitted), interviews and tests completed, Project Lab projects submitted — over 90 days |
| **Consistency** | 15 | Days active on the platform in the last 28 (12 days = full marks) |

Total 100. The weights, windows and targets are all in `config/readiness.php`; a bad edit (weights not summing to
100) throws on first use rather than scoring above 100.

**How a component turns into points**

* *Quality components* (interviews, Learning Centre modules, soft skills, contests) use **recent form**: only work
  in the last 180 days, at most the newest 5 attempts. Someone who stops practising drifts down.
* *One great attempt is a start, not a pattern.* A component built from attempts is scaled by how many there are:
  one attempt earns half the credit, full credit arrives at 3 (soft skills: 2). One lucky interview cannot max a
  component.
* Nothing is renormalised: a component with no data scores 0, and the next-steps list says what to do about it.
* **Breadth is required.** A perfect interview record alone is worth 20 points. Reaching 60 takes a real record
  across several areas — that is deliberate, it is what makes "ready" mean something to an employer.

**What counts, and what never does**

Everything Mellow, the platform or a TPO scheduled for the student counts. A hiring partner's own posts never do.
That rule lives **once**, as a `countsTowardReadiness` scope on each model, and the service reaches those tables
only through it:

| Model | Counts | Never counts |
|---|---|---|
| `Contest` | general, daily, company (Mellow-curated), tpo_mock, retired talent_pool | `company_hiring`; cancelled |
| `Interview` | general, company (Mellow-curated), tpo_mock, retired talent_pool | `company_hiring` |
| `SoftSkillAssessment` | general, tpo_mock | `company` (a hiring partner's test) |
| `Hackathon` | published, `host_type = platform` | `host_type = company`; unpublished or cancelled |

Academics (CGPA, backlogs) are **not** in the score. That is the main reason college students used to appear to be
scored differently: they had a component an independent student could never earn. CGPA and backlogs still decide
drive eligibility (`EligibilityService`) — only the readiness score ignores them.

### Staying ready — the daily habit (v5), and the record of it

The components above add up to the **earned** score. A student also has to *keep showing up*, so every day with no
activity takes points off it:

> **score = earned score − missed-day penalty** (never below 0)

- Of the last **21 complete days** (yesterday and back — today is still theirs), every day with **no activity** on the
  platform costs **1 point**. "Activity" is the same thing Consistency counts: practice, contests, interviews, soft
  skills, the three Learning Centre labs, articles, Project Lab (minus anything a hiring partner posted).
- A student who comes back stops losing points **that day**. The days already missed drop out of the count 21 days
  after they happened, so a clean three weeks brings the penalty to zero. The most it can ever take is 21 points.
- **Nobody is charged for days before they were tracked.** The penalty's clock starts the day *after* a student's
  first row in `readiness_snapshots` (written by the first `readiness:refresh` that scores them), so shipping this
  never punishes anyone for a gap nobody was watching. A brand-new student's first day is free.
- Days are UTC calendar days, like every other date the score reads.
- It goes through the same single code path, so the dashboard card, the Vault page, the TPO roster, the weekly report
  and the Vault's enter/exit decision all see the same number.
- The `decay` block on the breakdown carries `points`, `missed_days`, `window_days`, `practised_today`,
  `last_active`, `idle_days` and `max_points`; `base_score` is the score before the penalty.

Tuning lives in `config/readiness.php` → `decay`: `window_days` (21), `points_per_missed_day` (1), `free_days` (0 —
raise it to allow rest days), `enabled` (`READINESS_DECAY_ENABLED=false` switches the whole thing off and scores go back
to exactly the earned score).

**The record.** `readiness_snapshots` keeps one row per student per day: `score`, `base_score`, `penalty`,
`missed_days`, `active_today`, tier, profile, version and each component's score. `readiness:refresh` (every 10 min for
students seen recently, nightly `--all` for everyone seen in 120 days and the whole Vault) writes today's row and only
rewrites it when something changed. A student with no score at all has no rows; once they have one they keep getting
one, even at 0, so the chart shows a fall rather than stopping. Rows older than `history_retention_days` (400) are
removed daily (`readiness:prune-history`, 03:00).

**What the student sees.** `GET /api/me/readiness/history?days=30` (and `history` inside `GET /api/me/vault`): the
points to chart (today taken from the live score) and `summary` — `tracking_since`, `best`, `first_crossed_on` (the
day they first reached 60), `change_7d`, and `days_to_threshold` ("at this pace"; only when there is a week of data and
a real climb, otherwise `null`). The Vault page shows the chart, a missed-days notice and a "Missed days" row in the
breakdown; the dashboard card shows the row; the Reports page shows the notice.

**The nudge.** A student who *was* practising and then goes idle gets one in-app notification on their 1st, 3rd and 7th
idle day ("Your readiness slipped to 41"), only while they have not yet practised that day and only if points were
actually lost. Each milestone of each absence is raised once (`group_key` carries the day they were last active). It is
its own mutable category, **Readiness & daily practice**. Longer absences are the win-back e-mail's job
(`lifecycle:send`), not a daily bell.

**The Vault effect.** Nothing special: the penalty simply lowers the score the Vault already acts on. A student at 60 who
stops practising falls below the exit line (55) after about six missed days and is taken off (the existing "you left"
mail fires); coming back and climbing to 60 puts them in again, automatically, if they have said yes.

### Profiles (v4): ECE, EEE, Mechanical and Civil

The table above is the **software** profile, and it is what every CSE student, every student who chose "IT first" or no
track, and every student whose branch's Core Prep is not live is scored by — unchanged since v3 (a golden test pins that a
CSE breakdown is the same as before; the only new key is `profile: "software"`).

A student of a non-CS branch whose Core Prep is **live** (switched on by a superadmin and with published questions) and who chose
"Core first" or "Balanced" at onboarding is scored by a different weighting, because a non-coder can never earn coding or
contest points:

| Component | software | balanced | core |
|---|---:|---:|---:|
| AI Interviews | 20 | 20 | 20 |
| **Core Technical** | – | 20 | 30 |
| Coding Practice | 15 | 10 | – |
| Learning Centre | 15 | 10 | 15 |
| Soft Skills | 10 | 10 | 10 |
| Contests | 15 | 5 | – |
| Events & Projects | 10 | 10 | 10 |
| Consistency | 15 | 15 | 15 |

*Core Technical* = 60% the student's recent timed Core test scores (same recent-form and depth scaling as every quality
component; Mellow's and their college's tests count) + 40% the share of the branch's topics they have mastered (≥5 answers,
≥75% right, over 180 days — practice and tests together). A branch with no published platform test yet is scored on coverage
alone. Core practice and tests also count as activity for Consistency and Events & Projects, whatever the profile.

**Master switch (2026-10-23).** `readiness.core.counts_towards_score` (env `READINESS_CORE_COUNTS`, default **false**): while off, `ReadinessScoreService::liveCoreDisciplines()` returns nothing, so no student is moved onto a core profile, Core practice/tests do not count as active days or participation, and `VaultPayloadBuilder` sends no `core` strengths. Everything below describes what happens when it is ON. Core Prep and Skill Drills are proctored (see `practice-and-drills.md`) before that is ever switched on.

**Go-live grace.** For `readiness.core.grace_days` (30) after a branch goes live, a core-profile student is scored both ways from
the same inputs and keeps the **better** score — nobody leaves the Vault, or is told they have, on go-live day. After that, the
profile alone decides. The breakdown says which weighting stands (`profile`) and, during the grace, `grace_until`.

Profiles live in `config/readiness.php` (`profiles`, `core`); each must add up to 100 and include `core_technical`, otherwise it is
logged and ignored (those students fall back to the software weights) rather than failing every roster.

**Tiers** (for the TPO roster and reports, unchanged): *Placement Ready* ≥ 75 · *In Progress* ≥ 45 · *Needs
Training*. The weekly at-risk email still flags students under 60.

> **Expect scores to move on deploy.** The old formula leaned on CGPA and a practice streak and ignored most of the
> platform. Students with a rich record will rise; students whose old score was mostly CGPA will fall. Colleges
> comparing a TPO roster before and after will see this — worth a line to them.

**Cost.** One code path: scoring one student is scoring a roster of one. A chunk of up to 250 students is a fixed
~15 queries however many students are in it (asserted by `ReadinessScoreServiceTest` and
`StudentCohortProgressTest`). Add any new input to `ReadinessScoreService::compute()` in bulk — never per student.

---

## 2. The Vault

### States

`vault_profiles` stores a few *facts* and one *derived* column, `visibility_status`. The derivation is a single
function, `VaultProfile::resolveStatus()`, in this order:

| Status | Meaning |
|---|---|
| `hired` | Hired — through an AptRun partner, or reported by Mellow Vault. Permanent; never re-listed |
| `hidden_by_mellow` | Staff hid it (with a recorded reason), or the account is blocked |
| `not_ready` | Score below the bar (never reached it, or fell clearly under it). Consent, if given, is remembered |
| `upgrade_required` | Score is high enough, but the student's plan does not include the Vault. Consent, if given earlier, is remembered |
| `pending_consent` | Eligible and on a plan with the Vault; the student has not said yes |
| `hidden_by_candidate` | Eligible, but the student withdrew their consent |
| `visible` | Eligible **and** consented — hiring partners see it, Mellow Vault is told |

Only `VaultService` writes any of it, and every change goes through one locked `mutate()` step, so the screen a
hiring partner sees, the screen the student sees and what Mellow Vault holds cannot disagree.

### The line, and why there are two numbers

`VAULT_ENTER_SCORE=60` makes a student eligible. They stay eligible until the score drops **below**
`VAULT_EXIT_SCORE=55`. Without the gap a student hovering around 60 would be listed and withdrawn from employers'
screens every time a score moved a point. (The exit line can never sit above the entry line — it is clamped.)

### Consent — one standing yes

* Nothing is shared without it. The privacy policy and terms (updated for this) say so.
* It is **one** yes, covering AptRun's hiring partners and Mellow Vault. After it, listing and delisting follow
  the score automatically.
* It may be given **before** the student is ready ("list me as soon as I am"). A yes given early is remembered and
  does nothing until the score gets there.
* `DELETE /me/vault/consent` takes it back, effective at once; a withdrawal queues a take-down to Mellow Vault.
* The consent screen lists exactly what is shared, taken from `StudentVaultController::SHARED_FIELDS`. **If you
  add a field to `VaultPayloadBuilder`, change that list too** — the screen must never promise less than is shared.
* **Never shared:** phone numbers (the student's or a parent's), roll number, plan/payment details, code,
  recordings, proctoring history. The **email address is** shared with Mellow Vault (and only with Mellow Vault —
  AptRun's own hiring partners never see it), so Mellow Vault can create or link the student's account there.

### Who triggers a re-score

* `readiness:refresh` every 10 minutes for students seen in the last 45 minutes; nightly (02:30) for everyone seen
  in the last 120 days **plus everyone with a Vault profile** (a score also falls as time passes).
* Immediately when a score-changing event lands: a contest is finalised, an interview is scored, a soft-skills test
  is submitted, the student opens their Vault page.
* A profile edit (bio, skills, links, resume, name) re-syncs a listed student; blocking an account delists at once.

### Plans — the Vault is an Expert feature

* **Individual students:** **Expert** includes it, and so does **Grandmaster** (Mellow Academy). Coder does not.
  (Until 2026-10-18 only Grandmaster did; its price, limits and features moved onto Expert that day — see `docs/pricing-and-plans.md` §6.)
* **College students:** a college's plan includes it for the students it covers (the same shape as Hack Arena), so a
  college student does not buy anything. Switch it off on a college plan from the plan editor and those students
  see the upgrade prompt.
* The switch is `plans.vault_access`, edited per plan by the superadmin (**Plans & Pricing → Edit limits → The
  Vault**), enforced by `PlanGate::requireVaultAccess()` (HTTP 402 `plan_required`, feature `vault`). It started as
  a copy of the old `talent_pool_access` column, which is now unread.
* **What is and is not gated.** Earning the readiness score is open to everyone, on every plan. A student below the
  plan sees their score, what it is made of and an upgrade prompt; a student who reaches 60 without the plan is
  recorded as `upgrade_required` (so nothing is lost) and cannot say yes — `POST /me/vault/consent` answers 402.
  Hiding/withdrawing is never blocked.
* **Upgrading** moves the profile on the instant the subscription is saved (no retake, no wait for a job); the
  student then says yes. **A plan ending** — expiry, cancellation, a refund — takes a live student off at once: the
  profile becomes `upgrade_required`, Mellow Vault is sent a withdrawal with reason `plan_ended`, and the student's
  earlier yes is **remembered**, so renewing relists them automatically. College plans reach their students through
  the nightly `readiness:refresh --all`.

---

## 3. Mellow Vault integration

AptRun cannot assume anything about the Mellow Vault site beyond what is below, so the contract is deliberately
plain HTTP + JSON. Both directions are optional until configured; **nothing is ever lost while it is not.**

```
VAULT_SYNC_URL=      # where AptRun POSTs events          (Mellow Vault's endpoint)
VAULT_SYNC_SECRET=   # signs every delivery (HMAC-SHA256) (shared secret)
VAULT_API_KEY=       # bearer token Mellow Vault presents to call AptRun
```

### 3.1 AptRun → Mellow Vault (push)

Every state change writes a row to `vault_sync_events` (the outbox) in the same step as the change. `php artisan
vault:sync` — every minute from the scheduler, **no queue worker needed** — POSTs what is due.

```
POST {VAULT_SYNC_URL}
Content-Type: application/json
X-AptRun-Event-Id:    <uuid>            the event id; also sent as Idempotency-Key
X-AptRun-Event-Type:  profile.upsert | profile.withdraw
X-AptRun-Timestamp:   <unix seconds>
X-AptRun-Signature:   v1=<hex hmac-sha256>
Idempotency-Key:      <uuid>
```

Signature = `HMAC_SHA256(VAULT_SYNC_SECRET, "{timestamp}.{raw request body}")`, hex. Verify it over the **raw**
body, reject if the timestamp is more than ~5 minutes off, and compare in constant time:

```php
$ts  = $request->header('X-AptRun-Timestamp');
$raw = $request->getContent();
$ok  = hash_equals('v1='.hash_hmac('sha256', $ts.'.'.$raw, $secret), $request->header('X-AptRun-Signature'))
       && abs(time() - (int) $ts) < 300;
```

```js
const expected = 'v1=' + crypto.createHmac('sha256', secret).update(`${ts}.${rawBody}`).digest('hex');
const ok = crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature)) && Math.abs(Date.now()/1000 - ts) < 300;
```

**Body — `profile.upsert`** (list a student, or update a listed one):

```json
{
  "id": "0b1c…-uuid", "type": "profile.upsert", "sequence": 3,
  "occurred_at": "2026-10-17T09:30:00+05:30", "source": "aptrun",
  "profile": {
    "id": "01J9ZQ…26-char ULID",
    "name": "Asha Rao", "email": "asha@example.com",
    "college": { "name": "Apex Institute", "short_code": "APEX", "city": "Pune", "state": "MH" },
    "branch": "CSE", "branch_code": "cse", "discipline": "cse", "cgpa": 8.4, "backlogs": 0,
    "skills": ["Laravel", "React"], "bio": "…",
    "linkedin_url": "…", "github_url": "…", "primary_language": "python",
    "contest_rating": 1540, "profile_completion_percent": 90,
    "resume": { "available": true, "url": "https://<aptrun>/api/vault/v1/profiles/<id>/resume" },
    "readiness": {
      "score": 72, "tier": "In Progress", "peak": 75, "version": 4, "profile": "software", "computed_at": "…",
      "components": [ { "key": "interview_performance", "label": "AI Interviews", "score": 80, "weight_percent": 20 }, … ]
    },
    "core": null,
    "qualified_at": "…"
  }
}
```

**v4 additions (all optional for a consumer that ignores them):** `branch_code` (the canonical branch) and `discipline`
(`cse|ece|eee|mech|civil|other`); `readiness.profile` (`software|core|balanced` — the `components` list differs by profile, so
treat it as variable, keyed by `key`); and `core`, which is `null` except for a student of a core branch with Core Prep live, where it is
`{"subjects":[{"code","name","accuracy_percent"}]}` — subjects with ≥10 answers, accuracy rounded to the nearest 5, best first.
The consent screen says this is shared. Every profile is re-sent **once** after deploy (the payload gained fields).

**Body — `profile.withdraw`** (take a student down): `{"id","type":"profile.withdraw","sequence":4,"reason":"…","profile":{"id":"…"}}`
where `reason` is `consent_withdrawn` · `below_threshold` · `hidden_by_staff` · `hired` · `plan_ended` · `account_closed`.
On `account_closed` the student's data must be **deleted**, not merely hidden.

**What Mellow Vault must do**

* Answer **2xx** once the event is safely applied. Optionally return `{"id": "<your id for this student>"}`; AptRun
  stores it (`vault_profiles.external_id`).
* Be **idempotent** on `X-AptRun-Event-Id`: a retry carries the same id and must be a no-op if already applied.
* Use `profile.id` (the ULID) as the stable key. It is not the AptRun user id and never changes.
* Use `sequence` (rising per profile) to ignore a stale event if two ever arrive out of order. AptRun already
  delivers a profile's events strictly in order — a later event waits behind an earlier unfinished one.
* A **4xx of 400/404/410/413/422** means "this payload is wrong": AptRun parks the event as `dead` immediately.
  Anything else (5xx, 401/403, timeout) is retried with backoff — 1, 5, 15, 60, 180, 720 min, then every 12 h — up
  to `VAULT_SYNC_MAX_ATTEMPTS` (8), then `dead`. Dead events show on **Admin → Vault → Mellow Vault sync**, with a
  retry button, and in the log.

AptRun **coalesces**: a burst of edits to one listed profile becomes one update (held 30 minutes), a listing that
was never delivered and is then withdrawn sends nothing at all, and an unchanged profile is never re-sent.

### 3.2 Mellow Vault → AptRun (pull and callback)

All under `/api/vault/v1`, `Authorization: Bearer <VAULT_API_KEY>`, 300 requests/min/IP. With no key configured every
route answers **503**; a wrong or missing key is **401**. (A user's own login token is not accepted.)

| Call | Purpose |
|---|---|
| `GET /ping` | Check the key and connectivity |
| `GET /profiles?limit=100&after=<id>&updated_since=<iso>` | Every **live** profile, full listing, paged (`has_more`, `next_after`). For a first load or a reconcile |
| `GET /profiles?status=withdrawn` | `{id, status, updated_at}` for everything Mellow Vault was once told about that is no longer live — "take these down" |
| `GET /profiles/{id}` | One live profile. **410** `vault_profile_not_live` (never the data) if it is not live |
| `GET /profiles/{id}/resume` | The résumé PDF of a live profile |
| `POST /profiles/{id}/status` `{"status":"hired","employer":"Initech"}` | Mellow Vault telling AptRun an employer hired the student. Idempotent. Delists them for AptRun's partners and records the hire |

---

## 4. Operating it

### Deploy (this release)

1. Deploy backend **and** frontend together (the old `/me/talent-pool` and `/company/talent-pool` routes are gone;
   the old pages redirect to the new ones).
2. `php artisan migrate --force` — creates the `vault_*` tables, copies the old Talent Pool rows into them (ids
   preserved, old tables left untouched), renames the staff permission `talent_pool` → `vault`, and adds
   `plans.vault_access` (copied from `talent_pool_access`: Coder/Expert off, Grandmaster and college plans on — Expert was switched on later by the 2026-10-18 plan restructure).
3. `php artisan route:cache` if routes are cached (new routes 404 until then).
4. Make sure the scheduler cron runs: `* * * * * php artisan schedule:run`.
5. `php artisan readiness:refresh --all` once, so every student has a profile state right away instead of within
   the next scheduled runs. **Scores will have moved** (see §1).
6. When Mellow Vault is ready: set `VAULT_SYNC_URL`, `VAULT_SYNC_SECRET`, `VAULT_API_KEY`, then
   `php artisan config:cache`. Queued events go out within a minute. Check **Admin → Vault → Overview**.

**Migrated students.** Consent is *not* carried over: the old yes meant "AptRun's hiring partners may find me",
the Vault also hands the profile to Mellow Vault, which is a different thing to agree to. A student who was visible
lands on *awaiting consent* and is emailed once to confirm. A student who had opted **out** stays out. Hired and
staff-hidden students keep their status; existing engagements with hiring partners stay reachable.

### Deploy (readiness tracking and the daily penalty)

1. `php artisan migrate --force` — creates `readiness_snapshots`. Until it has run, scores and the Vault page keep
   working (the history is read fail-soft); the penalty just stays at 0 and no history is written.
2. `php artisan route:cache` if routes are cached (`/api/me/readiness/history` 404s until then).
3. The scheduler cron must be running (it drives the refresh, the nudge and the prune).
4. Run `php artisan readiness:refresh --all` once so every student gets their first row **today** — that is the day
   tracking starts for them, and the first penalty can only appear two days later. Nobody is charged retroactively.
5. To turn the penalty off without a deploy: `READINESS_DECAY_ENABLED=false` then `php artisan config:cache`.

### Commands

| Command | |
|---|---|
| `readiness:refresh` | Re-score students seen in the last 45 min. `--all` (last 120 days + whole Vault), `--user=ID` (repeatable) |
| `vault:sync` | Deliver what is due. `--retry-dead` first re-queues parked events |
| `vault:prune` | Drop delivered outbox rows past 30 days (also daily from the scheduler) |
| *(scheduled)* `readiness:prune-history` | Daily 03:00 — drop daily readiness rows past `history_retention_days` |

### Troubleshooting

| Symptom | Look at |
|---|---|
| A student says they are ready but not listed | Do they have a *yes*? (Vault page → status.) Is the score ≥ 60 — and if they were below 55 once, they need 60 again. Is the account blocked, or hidden by staff? |
| Nothing reaches Mellow Vault | Admin → Vault → Overview: is it "Connected"? Is the cron running (`oldest waiting` grows)? Sync tab for HTTP codes and errors |
| Events "gave up" | Fix the receiving end, then **Retry** on the sync tab (or `vault:sync --retry-dead`) |
| A score looks wrong | The student's Vault page shows each component's `detail` line (what it was built from); `php artisan tinker` → `app(ReadinessScoreService::class)->breakdown(User::find(ID))` |
| Roster slow | `ReadinessScoreServiceTest::test_a_whole_cohort_costs_a_fixed_number_of_queries` — a new per-student query was added somewhere |

### Rollback

The old `talent_pool_*` tables are untouched, so rolling the code back restores the old feature as it was at deploy
time. Anything done in the Vault since (new consents, hires) will not be in the old tables.

---

## 5. Decisions made, and what to confirm

These were made without being asked — please confirm or redirect.

1. **Consent stays opt-in, once.** "Directly transferred" is delivered as *one click, then fully automatic*. Sharing a
   student's profile (and email) with a separate website with no yes would contradict the published privacy policy
   and terms, and, in India, the DPDP Act's consent requirement. The seam is `VaultProfile::resolveStatus()` and
   `VaultService::giveConsent()` if the policy is ever changed — **along with the legal pages**.
2. **Plan gate (changed on request).** First built open to every plan; then, on your instruction, made a
   **paid-plan feature for individual students** (Grandmaster-only when built; Expert since 2026-10-18) — the headline reason to buy it. Decisions inside that: a
   **college plan covers its students** (like the Hack Arena); the score is **visible to everyone** (only listing is
   gated); a ready student on another plan is **remembered** (`upgrade_required`) so upgrading needs no retake; a
   plan that ends **delists** the student but **keeps their yes**.
3. **The Mellow Vault wire contract (§3) is mine**, because nothing existed. The Mellow Vault side has to implement it.
4. **Email is shared with Mellow Vault** (so it can invite the student); AptRun's own hiring partners never get it.
5. **Hiring-partner exclusion** means `company_hiring` contests/interviews, `company` soft-skills tests and
   company-hosted hackathons. Mellow-curated "company" contests/interviews for a drive **do** count — Mellow posted them.
6. **Legal copy** (`/privacy`, `/terms`) was edited to describe the Vault and the hand-off. Have it reviewed.
7. Not built: a Vault view for TPOs/colleges, and Vault events on the TPO weekly report.
