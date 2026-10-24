# Practice interviews, Skill Drills and "Today's practice"

*Added 2026-10-22. This is the guide for the three features that make the modules every branch shares — AI interviews, soft skills, communication — and branch-specific practice show up for a student who leads with their branch, plus the back-arrow system that came with them.*

## What a student sees

| Where | What |
|---|---|
| **Home** (core-first and balanced students) | **Today's practice** — four cards the server orders for them: AI mock interview, Skill drills, Soft skills, Communication. What they ticked in "what do you want to practise" comes first and is flagged *You asked for this*; an interview they left half-done always leads. CSE homes are unchanged. |
| **AI Interviews → Practice interview** (`/dashboard/interviews/practice`) | A studio: pick a **role** from their branch (ECE: Embedded, VLSI, Comms & RF, Analog, Fundamentals; EEE, Mechanical, Civil likewise; IT roles for everyone), a **kind of round** (technical / full mock / HR & behavioural), **5, 8 or 10 questions**, and a **difficulty**. It builds a private interview and opens it; taking it is the ordinary voice flow with the same AI scoring. |
| **Skill Drills** (`/dashboard/drills`, rail item for core-branch students) | Unlimited generated questions with instant feedback and a worked solution, in three packs: **Digital logic & number systems** (1's/2's complement, gates, circuits, truth tables, Gray code, Hamming, flip-flops, counters…), **Circuits & electronics** (Ohm, dividers, RC, resonance, AC, KCL, dB…), **Quick calculations** (units, stress, beams, sections, gases, efficiency, flow, hydrostatics, gears, soil). Mastery per skill (Not started → Attempted → Familiar → Proficient → Mastered), difficulty that follows the student, a day streak. |
| **Every signed-in page** | A back arrow in the header that goes *up* the page tree (not "browser back"). |

## Decisions worth knowing

* **Drills are practice, not scores.** They never touch the readiness score, Vault payload or a TPO's numbers. The hub says so. **Neither does Core Prep any more** — see "Readiness switch" below.
* **Questions are generated in the browser**, from a seed. There is no question bank to maintain, no AI cost and no limit. The server stores only *what the student did* (`drill_attempts`) — pack, skill, level, right/wrong, seconds.
* **The student's pack follows their branch** (ECE/EEE → circuits, Mechanical/Civil → quick calcs, everyone → digital). Every pack is open to everyone; only order and the *For your branch* label differ.
* **CSE rail/home are intentionally unchanged.** `/dashboard/drills` works for a CSE student (digital pack first) but is not in their sidebar.
* **Practice interviews are private** (`interview_type = practice`, `created_by` = the student). Admin/TPO/company lists never show them. They obey the same plan limits as any mock interview (`PlanGate::assertMockInterviewAllowed`), checked **at creation** so a student with no practice left finds out before an AI call is spent. A student may *build* 8 a day; unused ones are pruned after 14 days (`interview:prune-practice`, 03:50).
* **A locked practice round** (3 proctoring strikes) says "build a new one", not "ask whoever invited you" — nobody invited them.

## How the pieces fit

```
frontend/src/lib/drills/        the engine (pure TypeScript, no React)
  rng.ts  bits.ts  logic.ts     seeded RNG · number-system helpers · boolean expressions
  digital.ts circuits.ts quickcalcs.ts   the 36 skill generators, 3 levels each
  catalog.ts                    PACKS, buildQuestion(skill, level, seed), packsForBranch
  mastery.ts                    rolling-window mastery + adaptive level
  session.ts  api.ts            sitting helpers · attempt queue (localStorage-backed, batched)
  circuitLayout.ts              geometry for the logic-circuit diagram
frontend/src/components/drills/ DrillsHub, DrillSession, QuestionView, TruthTable, LogicCircuit, MasteryMeter
frontend/src/components/dashboard/home/PracticeShelf.tsx
frontend/src/app/dashboard/drills/…   hub + session (?skill=…&level=…)
frontend/src/app/dashboard/interviews/practice/page.tsx

backend/config/drills.php               CANONICAL list of skill ids (the API accepts only these)
backend/config/practice_interviews.php  role cards, kinds, counts, limits
backend/app/Services/DrillService.php  PracticeShelfService.php  PracticeInterviewService.php
backend/app/Http/Controllers/Api/DrillController.php  PracticeInterviewController.php
GET  /api/me/drills            summary: per-skill history (newest first), streak, week
POST /api/me/drills/attempts   record ≤ 25 answers (throttle 60/min; 1,500/day, the rest are dropped quietly)
GET  /api/me/practice-shelf    "Today's practice" cards + streak
GET  /api/me/practice-interviews/options   POST /api/me/practice-interviews
```

### A question is a pure function of `(skill, level, seed)`
`buildQuestion("twos_complement", 2, 123)` always returns the same prompt, picture, answer and worked steps; the question id is `skill:level:seed`, so `rebuildQuestion(id)` can recreate it (the e2e script uses this to answer correctly). Numeric answers are computed in code next to the prompt. Every generator returns `{prompt, figure?, answer, hint?, solution, solutionText, explanation[], check}`; `check(solution)` must be true.

### Mastery and difficulty (rolling, so it can go back down)
* From a skill's last **12** answers: *Attempted* (any), *Familiar* (≥ 4 answers, ≥ 60 %), *Proficient* (≥ 6, ≥ 75 %, ≥ 3 right at level ≥ 2), *Mastered* (≥ 8, ≥ 87.5 %, ≥ 3 right at level 3).
* Difficulty (auto): three right in a row → up a level, two wrong in a row → down. A sitting starts where the stored history leaves off. The student can pin 1 / 2 / 3.
* The day streak survives until the end of the day *after* the last active one, so it is not lost at midnight before they could practise.

### Answers are never lost
Each answer is queued in memory and `localStorage` (`aptrun.drills.pending.v1`), sent in batches of 3, on finishing, on `pagehide`/`visibilitychange` (with `keepalive`), and at the next visit to any drill page. A failed request leaves them queued.

## Adding or changing a skill

1. Write the generator in `digital.ts` / `circuits.ts` / `quickcalcs.ts` and add it to that pack's `skills` (title, blurb, what each level means).
2. Add its id to the pack in `backend/config/drills.php` — `drills-generators.test.ts` fails if the two lists differ.
3. `npx vitest run src/tests/unit/drills-generators.test.ts` brute-forces **every skill × level × 80 seeds**: no throw, own solution passes, wrong answers fail, ≥ 2 distinct choices, deterministic rebuild, ≥ 6 different questions, and every formula parses as strict KaTeX. Add a "worked example" there for a formula you want checked against a hand calculation.
4. Nothing else: no migration and no `route:cache` (skills are just strings).

Gotchas: LaTeX inside TypeScript strings needs `\\` (two backslashes); the middle dot is not valid inside KaTeX `\text{}` (use `\text{kN}\cdot\text{m}`); the tsconfig target is old, so spread strings/Sets with `split("")`/`Array.from`.

## The branch interview bank

`content/interview-bank/{ece,eee,mech,civil}.json` — **144 spoken-interview questions** (ECE 40, EEE 36, Mechanical 34, Civil 34; ~70 % technical, then scenario, behavioural, HR), each with a reviewer note describing what a strong answer covers (the AI scorer uses it). Tags carry the onboarding interest ids (`embedded`, `thermal`, …) so a role pulls its own questions first, plus `editorial-v1`.

```
php artisan interview:import-bank content/interview-bank --dry-run   # checks every row, writes nothing
php artisan interview:import-bank content/interview-bank             # idempotent (matches by text + branch)
```
Regenerate with `python content/interview-bank/src/build.py`. **These are AI-written and not yet reviewed by a subject expert** — have one qualified person per branch read their file before a public launch (filter by tag `editorial-v1`). Where the bank is short for a role, `PracticeInterviewService` asks Gemini to top it up (needs `GEMINI_API_KEY`, capped at 3 a day per student, kept in the bank); without a key it builds a smaller round (minimum 3 questions, otherwise the student is told the bank is still being built).

## Back arrow

`frontend/src/lib/backNav.ts` holds `ROUTE_TREE` (every route → title + parent) and `OWN_CHROME_ROUTES` (public pages that draw their own header). `DashboardHeader` renders a `BackButton` to `resolveBack(pathname, portal)`; a page may override with `back={{href,label}}` or turn it off with `back={false}`. `tests/unit/back-nav.test.tsx` walks `src/app` and **fails if a page.tsx is in neither list**, so a new page cannot ship without an up-target.

## Deploying

```
php artisan migrate --force        # 2026_10_29_100000 (practice config on interviews) + 2026_10_29_100100 (drill_attempts) — additive
php artisan route:cache            # new routes 404 otherwise
php artisan interview:import-bank content/interview-bank
```
The scheduler already carries `interview:prune-practice`. Frontend: ordinary build. Nothing else to configure.

## Verified / not verified

* Backend: 1,797 tests (incl. `SkillDrillsTest`, `PracticeShelfTest`, `PracticeInterviewTest`, `StudySittingTest`); the one failure in the last full run was an unrelated random-name flake (`SuperadminSubscriptionManagementTest` student search) that passes on rerun. Frontend: 58 files / 1,636 tests green; `tsc --noEmit` clean.
* **Proctored end to end** (Chromium, fake camera, real fullscreen; `D:\Dev\_claude_academyerify-proctored-study.mjs`, 29 checks): script calls without a sitting get 428; consent screen first; fullscreen + hidden chrome; a drill sitting answered with the real solutions (10/10, all stored against the sitting); fullscreen exit → resume prompt, tab switch, third strike → locked → 423 and the cool-down; Core practice answered with the real keys from the DB (5/5); a Core test answered with every real key, submitted, scored 100 % and not terminated; the readiness score and profile unchanged (software weights, no `core_technical`).
* Browser (Chromium, scratch API + dev server): home shelf order and flags, hub ordering per branch, a full 10-question sitting with adaptive level and server-side recording, circuit/truth-table/choice/number questions right and wrong, studio build → opened practice interview listed as `practice`, mechanical and CSE students, back arrow on 16 student pages, dark mode, phone width, sticky studio bar.
* **Not verified**: the voice flow of a *practice* interview end to end (mic + proctoring + AI scoring were not run — they are the existing flow, unchanged); Gemini top-up (no key here); real MySQL under load (the dev DB got the two migrations and the 144 questions, nothing more).
* Known limits: drills use KaTeX/SVG only (no free-form diagrams); AI-written content unreviewed (above); CSE students reach drills only by URL.

## Proctoring (2026-10-23)

**Core Prep practice, Core Prep tests and Skill Drills are all proctored: camera + microphone, fullscreen, tab-switch / dev-tools detection, 3 strikes.** The detection is the shared browser hook (`useInterviewProctoring`); the server is the authority.

* **Core tests** already had a proctoring session. New: a test saves **no answer before the student has consented** (`proctoring_required`, 428) — skipping the consent screen used to leave an unproctored test possible.
* **Practice and drills run in "sittings"** (`study_sittings`, `study_sitting_violations`; `StudySittingService`, `StudySittingController`). `POST /me/sittings {kind: core_practice|drill, subject}` opens one; the page shows the consent screen (`StudyProctorGate`) and starts proctoring against `/me/sittings/{id}/proctoring/start|violations`. **Every answer endpoint requires an active, consented sitting**: `POST /core/practice/next`, `/core/practice/{q}/answer`, `POST /me/drills/attempts` carry a `sitting_id` and get **428** (`sitting_required` / `sitting_not_started`), **409** (`sitting_ended`) or **423** (`sitting_locked`) without one. A drill's background upload is still accepted for a few seconds after the sitting ended normally.
* **Strikes**: fullscreen exit, tab switch, dev-tools = strikes; blocked paste / right-click are logged, never counted. At `proctoring.max_violations_before_lock` (3) the sitting is **locked**: answers refused and the page replaced by "This sitting was closed" with a **"Start a new sitting"** button — the student can reopen practice straight away, with a clean strike count (practice is not graded, so a lock ends that sitting only). Answers already given are kept. Ops can add a waiting period with `PROCTORING_STUDY_COOLDOWN` (minutes, default 0). A locked Core **test** stays final.
* **While live** the dashboard chrome is hidden (full screen, watermark with the student's name, "Recording · n/3 strikes" pill). Ways out that are not strikes: *End this sitting* / finishing a drill sitting, *End practice* in Core practice, submitting a Core test.
* **Kill switch**: `PROCTORING_STUDY=false` (practice + drills) and `PROCTORING_CORE_TESTS=false` (tests) run them un-proctored for a campus without webcams. Study sittings then return `proctored: false` and nothing is required. `phpunit.xml` turns study proctoring off so the rest of the suite is unchanged; `StudySittingTest` turns it on.
* **Phones**: the camera + Fullscreen API need a desktop browser (iPhone Safari has no Fullscreen API), so on most phones the consent screen says the browser is not supported and the student cannot practise there. That is the price of "fully proctored".
* No media is ever uploaded — only small JSON events. Nothing here is graded.

## Readiness switch

`readiness.core.counts_towards_score` (env `READINESS_CORE_COUNTS`) ships **false**: Core Prep practice, tests and mastery change **no readiness score**, add nothing to participation / active days, and the Vault payload carries no `core` strengths. Every student, including ECE / EEE / Mechanical / Civil, is scored by the software weights. **Consequence to know about:** a non-coder's score cannot reach the Vault bar (60) through Core Prep while this is off. To turn it on later: set the env to true (the core / balanced profiles and the 30-day grace then apply to live branches). `ReadinessProfilesTest` covers both states.
