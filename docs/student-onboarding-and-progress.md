# Student onboarding, language tracking and the Student Cohort

Three connected things:

1. **First-login onboarding** — a short, skippable wizard asks each student which language they code in,
   how far along they are, what they're aiming for and how much they want to practise.
2. **Language tracking** — what language each student *actually* solves problems in, how it's going in
   each, and where to improve. Shown to the student and to their TPO / coordinator.
3. **Student Cohort for TPOs** — the roster now shows practice progress and languages, with sorting,
   paging and filters, and is computed in a fixed handful of queries however big the college is.

## 1. Onboarding

- Shown by `StudentOnboardingGate` (mounted in `DashboardShell`, **never** on the proctored exam shell) to a
  student the **server** says still owes it: `user.onboarding_pending`. The rule lives in one place,
  `User::needsOnboarding()` — student, never completed, and not skipped in the last 7 days
  (`StudentPreferences::SKIP_COOLDOWN_DAYS`). Existing students are asked once on their next visit.
- Questions (all validated against `App\Support\StudentPreferences`, mirrored in
  `frontend/src/lib/studentPreferences.ts`):
  | Answer | Column on `users` | Required |
  |---|---|---|
  | Main language (judge id, e.g. `python`) | `primary_language` | yes |
  | Other languages (max 5) | `preferred_languages` (JSON, primary first) | no |
  | Coding level `beginner / intermediate / advanced` | `skill_level` | yes |
  | Goal `campus_placement / product_company / internship / higher_studies / competitive_programming / skill_building` | `career_goal` | yes |
  | Focus areas | `focus_areas` (JSON) | no |
  | Weekly pace `casual / steady / intense` | `weekly_pace` | no (default steady) |
- Endpoints (student-only, anyone else gets 403):
  `POST /api/me/onboarding` (finish) · `POST /api/me/onboarding/skip` · `PUT /api/me/preferences`
  (edit any subset later; filling the three required answers there also counts as finishing) ·
  `GET /api/me/language-insights`.
- **What the answers change**
  - The code editor (practice **and** contest problem pages) opens in: the language last used on this device →
    the stated main language → the other stated languages → the problem's first language
    (`pickInitialLanguage`).
  - The dashboard's weekly goals follow the pace: casual 10 / 2 hard, steady 20 / 5, intense 35 / 10
    (`StudentPreferences::weeklyTargets`, used by `StudentStatsService::weeklyGoalsProgress`).
  - Settings → Preferences → **Coding Preferences** edits the same answers. (It replaced a dropdown labelled
    "Default Language" that never saved anything.)
  - The TPO sees what the student *said* next to what they *do* (below).

## 2. Language tracking

`LanguageInsightsService` — one grouped query over **practice** (`submissions`) and **contest**
(`contest_submissions`) attempts, per student per language.

- **Attempt** = one submission with a final verdict. A practice Submit is one row per problem per day (the day's
  latest verdict — the table can't tell how many tries a day took); every contest try is its own row.
  **Acceptance %** = share of those that were Accepted: reliable for comparing *a student's own* languages, not
  an absolute pass rate.
- **Solved** = distinct problems Accepted in that language (practice and contests together).
- **Proficiency** (needs ≥ 5 attempts, otherwise `getting_started` — no verdict from a thin sample):
  `strong` ≥ 70 % · `needs_work` < 40 % · otherwise `steady`.
- **Where to improve** (structured, worded on the frontend with the editor's own language labels):
  low acceptance, ≥ 30 % compile errors, ≥ 30 % runtime errors, or a stated main language never practised.
- **Main language (actual)** = the language with the most problems solved. `mismatch` = they named a different
  one and have ≥ 5 submissions.
- Student: dashboard + Performance Report → **Language focus** card.
- TPO / coordinator / admin: **Coding languages** panel on the student report (+ language filter on the
  submission history), and a language column on the roster.

## 3. Student Cohort (TPO)

### What was wrong, and what changed

| Before | Now |
|---|---|
| ~8 queries **per student**, two of which loaded the whole problem catalogue → thousands of queries for a big college | `ReadinessScoreService::prime()` + `StudentCohortService::payloads()` score the whole roster in ~10 queries (measured: 200 students 1,200 → 9 queries, 1.6 s → 0.15 s on in-memory SQLite). The one-student path and the bulk path share the same component math (`assemble()`); a test proves they agree. |
| Branch filter was a hardcoded list (CSE, IT, ECE, EE, MECH, CIVIL) — "AIDS", "CSE (AI & ML)" couldn't be filtered | Built from the branches actually on file |
| Every row rendered twice (table + cards), no sorting, no paging | 25/50/100 per page, sort by name / readiness / CGPA / problems solved / inactivity, header click-sort |
| No sign of who never signed in or went quiet | **Practice engagement** per student: `active` (≤ 7 days) · `slipping` (8–21) · `dormant` (> 21) · `not_started` · `pending_activation` |
| Filters lost when opening a report | Filters, sort and page size are kept for the browser session |
| Stale numbers if the tab stayed open | Refresh button + "updated N min ago"; selection is cleared when the filters change |
| Drawer said readiness comes from "CGPA, backlogs, profile completeness" | Corrected at the time to interview 35 %, contest rating 20 %, practice 20 %, consistency 15 %, academics 10 % — **since replaced by Readiness v3** (one score for everything a student does on AptRun, no academics): see `docs/readiness-and-vault.md` |

### New on the roster

KPI "Practising this week"; **Practice engagement** card (click a row to filter); **Coding languages** card
(students per language, how many mainly use it, cohort acceptance %, how many are struggling — click to filter);
columns **Practice** (engagement, last practised, problems solved) and **Languages**; filters for language,
engagement and "Struggling in a language"; sort control; Excel export gains activation, practice, last-seen,
solved-by-difficulty and language columns plus a **Languages** roll-up sheet.

Placement Reports has a new **Coding Languages & Progress Report** (Excel, section-aware). The per-student PDF
gained a Coding Activity block. The Section Coordinator's roster shows the same Practice / Languages columns.

`last_seen_at` (new column) is stamped on login and, throttled to every 10 minutes, on session re-checks
(`AuthController::touchLastSeen`). It fails soft — it can never block a sign-in.

## 4. Deploying

Two additive migrations (nullable columns only): `2026_10_15_100000_add_onboarding_preferences_to_users_table`
and `2026_10_15_100100_add_last_seen_at_to_users_table`.

```
php artisan migrate
php artisan route:cache     # only if routes are cached — the new /me/onboarding* routes 404 until then
```

Run the migrations **with** the code. Until they run, the new endpoints 500 and every student sees the wizard
(it can't save); sign-in itself keeps working.

## 5. Tests

- Backend: `StudentOnboardingTest`, `LanguageInsightsTest`, `StudentCohortProgressTest`
  (engagement buckets, solved counts, college isolation, constant query count, bulk-vs-single readiness).
- Frontend (vitest): `cohort-insights`, `student-preferences`, `student-onboarding`.
