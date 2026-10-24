# Multi-branch platform: ECE · EEE · Mechanical · Civil

> **Update:** branches now sit under **departments** (Engineering, Management, Commerce, Arts) and Core Prep has become Domain Prep for all of them — see [departments.md](departments.md). Everything below still describes the engineering side exactly.

AptRun began as a CSE product. This is how it now serves the other engineering branches, what each part does, how to switch it on,
and what has deliberately **not** been done. (Content for the question banks is covered separately in
[core-prep-content-format.md](core-prep-content-format.md); scoring in [readiness-and-vault.md](readiness-and-vault.md).)

## The idea in one paragraph

Every student has a **branch** (from the college's roster, or declared at first login) that resolves to one of five **families** —
CSE, ECE, EEE, Mech, Civil (+ "other"). A non-CS student also chooses a **track**: *Core first*, *Balanced* or *IT first*.
CSE students, and anyone whose branch is unknown, see exactly the product they always have. For a core-branch student, once Mellow has
filled the question bank and switched their branch **live**, the dashboard, navigation, practice, tests, readiness score,
interviews and the college's reports all gain a Core Prep dimension. Until a branch is live nothing about Core Prep is visible to
students — the rest of the work (correct branch handling, drive eligibility, TPO tools) is useful on its own.

## What exists, by area

| Area | What it does |
|---|---|
| **Branch taxonomy** | `disciplines`, `branches`, `branch_aliases` (global + per-college). "Mechanical", "MECH", "ME" are one branch. A college's own mapping never crosses colleges. Superadmin → Branches. |
| **Onboarding** | First login asks/confirms branch (college-supplied is authoritative; students can say "not mine"), then track and core interests. "I don't code yet" makes a language optional. Settings → Branch & Track. |
| **Drive eligibility & Vault** | Branch checks use canonical branches and families, so a drive for "MECH" matches "Mechanical". An unrecognised branch is *unknown*, not *ineligible*. Vault search filters by family. |
| **Audience targeting** | Contests, interviews, tracks, soft-skill tests and Core tests can be aimed at branch families/branches. No audience = everyone. A student with no recognised branch is let through. |
| **Core Prep (student)** | Topic practice (instant feedback, worked explanations, daily limit by plan), timed **proctored tests** with a server-enforced clock, negative marking, on-screen calculator, KaTeX maths, question palette, results with review. |
| **Core Prep (Mellow Ops)** | Question bank with review workflow, bulk importer (CSV/XLSX/JSON + images, dry-run first), tests (blueprint or hand-picked), coverage & go-live switch, student reports inbox, **item analysis** (flags likely wrong keys), optional AI drafts. |
| **Readiness v4** | **Switched OFF (2026-10-23)** — `readiness.core.counts_towards_score` (env `READINESS_CORE_COUNTS`) defaults to false, so Core Prep changes no score and adds no Vault data; everyone is scored by the software weights. The machinery below is intact for when it is turned on: profiles software / balanced / core, Core Technical = recent tests + syllabus coverage, 30-day go-live grace. See [readiness-and-vault.md](readiness-and-vault.md). |
| **Dashboards** | `resolveHomeLayout`: CSE → today's dashboard verbatim; *Core first* → Core Prep up front; *Balanced* → today's dashboard with a Core summary on top. Sidebar gains **Core Prep** only when it exists for the student. |
| **TPO** | Branch mapping screen, branch switcher & filters, **Core Tests** (their own proctored mock tests, or a copy of Mellow's paper), **Core subject strength** heatmap (branch × subject, with "run a remedial class" lines), **Core Subject Proficiency** Excel report, a Core block in the student PDF, Core columns on the cohort. |
| **AI interviews** | Role templates, tracks, rounds and bank questions carry a branch family. 13 core role templates ship (no questions). Gemini writes and scores ECE/EEE/Mech/Civil interviews as engineering interviews. "For your branch" sorts first. |
| **Staged rollout** | A branch is *hidden*, *pilot* (chosen colleges only) or *live* (everyone). Superadmin manages it in Coverage & go-live. `discipline_pilots` table; the student check is `BranchCatalog::coreEnabledFor()` (query-free). |
| **Plans** | Core Prep sits inside existing plans: `max_core_practice_per_day` and `core_tests_access`, editable in Superadmin → Plans → Edit limits. Free plan: 10 practice questions/day and its one free test try. |

## Going live — the order that works

1. **Deploy** (below). Nothing changes for students.
2. **Load question banks** per branch (Ops → Core Prep → Import). Aim for 150+ per branch to open.
3. Build at least one **test** per branch (Ops → Core Prep → Tests → blueprint) and publish it.
4. **Pilot first (optional, recommended)** — superadmin → Core Prep → Coverage & go-live → *Pilot colleges*: add one or two colleges
   (the box shows how many ECE/EEE/… students each has). Their students of that branch get Core Prep immediately, as soon as **one**
   question is published — the 150-question bar applies to the public go-live, not to a pilot. A pilot student sees an "Early access"
   note, is asked the Core/IT track question, and gets the sidebar item, practice and tests. What a pilot deliberately does **not** do:
   change readiness scores, send Core data to the Vault, or switch on the TPO Core analytics/Core Tests — those start at go-live, so a
   pilot can never move a number anyone has been shown. Removing a college (or emptying the list) takes effect on the student's next request.
5. **Coverage & go-live** (superadmin): the switch refuses until the bank is big enough. Switching a branch on stamps `live_at`, which
   starts the 30-day readiness grace. Once live, the pilot list no longer matters.
6. Tell TPOs: a **one-time branch-mapping pass** (Student Cohort → Branches). (Readiness re-weighting is OFF for now — see the Readiness row above; if it is switched on, core students' readiness is re-weighted after
   the grace.) Don't announce "ECE/EEE/Mech/Civil" on the marketing pages until the banks exist.

## Deploy checklist (this release)

Backend deploys before frontend.

1. Back up the database.
2. `php artisan migrate --force` — branch taxonomy (+ backfill), Core Prep tables, plan limits, `vault_profiles.readiness_profile`,
   `discipline` on interview tables (+ 13 core role templates), `core_question_stats`, `discipline_pilots` (staged rollout; until it
   exists the catalogue simply reports "no pilots", so deploying code before migrating is safe).
3. `php artisan route:cache` — routes are cached, so new endpoints 404 until this runs.
4. `npm ci` in `frontend/` (KaTeX and friends are new dependencies), then build.
5. Scheduler (`* * * * * php artisan schedule:run`) — new entries: `core:finalize-expired` (every minute: grades abandoned tests) and
   `core:analyse-items` (nightly 03:10).
6. `php artisan readiness:refresh --all` once, so scores carry the v4 `profile` key and every Vault profile re-syncs once.
7. **Mellow Vault must accept** the new optional payload fields (`branch_code`, `discipline`, `readiness.profile`, `core`) and a
   variable `components` list — see [readiness-and-vault.md](readiness-and-vault.md).
8. Optional: `CORE_AI_DRAFTS=true` to enable "Draft with AI" for question writers.

## What this does not do (on purpose)

* **Question content is a starter set, not a finished bank.** `content/core-prep/` holds 647 original questions (ECE 177, EEE 157, Mechanical 156,
  Civil 157) that clear the go-live bar. They were AI-written and are **not yet expert-reviewed** — see [content/core-prep/README.md](../content/core-prep/README.md)
  before showing them to students. You still need a much larger, expert-reviewed bank to be convincing (500+ per branch).
* A pilot opens the **student** module only. A pilot college's TPO does not get Core Tests or the Core heatmap until the branch is live.
* No simulation labs (SPICE, MATLAB/Simulink, CAD, Verilog judge), no Core project-lab topics.
* Branches beyond the five families work by adding taxonomy rows and content, not code.
* TPO-authored questions: the columns are reserved; there is no UI.
* Marketing copy and pricing bullets are untouched.
* Section coordinators: the branch qualifier **is** built — see [section-coordinators.md](section-coordinators.md).

## Where to look in the code

`backend/database/data/branch_taxonomy.php`, `core_taxonomy.php` · `app/Support/{BranchNormalizer,BranchCatalog,BranchAudience}.php` ·
`app/Services/Core/*` · `app/Services/ReadinessScoreService.php` · `config/{core_prep,readiness}.php` ·
`frontend/src/lib/{branches,core,homeLayout}.ts`, `components/core/*`, `components/admin/core/*`, `app/dashboard/core/*`.

## Beyond Core Prep: interviews, drills and the home shelf (2026-10-22)

A student who leads with their branch still meets the shared modules: **Today's practice** on their home (AI interview, Skill drills, Soft skills, Communication, ordered by what they said they want), a **Practice interview** studio with branch roles and a 144-question branch interview bank, and **Skill Drills** (36 generated skills: 1's/2's complement, logic gates and circuits, Ohm's law, beams, soil…). Core Prep stays the only thing that feeds the readiness score. See [practice-and-drills.md](practice-and-drills.md).
