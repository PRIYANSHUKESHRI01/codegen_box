# Hack Arena

Hackathons for students. AptRun's Mellow Ops team and hiring partners host them; students
discover, register (solo or in a team), build, submit a project and see results. It is a
**separate full-screen world** (`/arena`), not a dashboard page: students enter from a banner on
their dashboard overview — never from the sidebar — and an **Exit Arena** button takes them back.

- Student UI: dashboard overview → **Enter the Arena** banner → `/arena`
  (lobby), `/arena/hackathon?slug=…` (one hackathon), `/arena/my` (their hackathons).
- Ops UI: **Mellow Ops → Hackathons** (`/admin/hackathons`) — needs the `hackathons` permission.
  Superadmin has everything.
- Hiring partner UI: **Hiring Hub → Hackathons** (`/admin/company/hackathons`) — their own only.
- **College TPOs cannot host or even enter the Arena** — every route answers 403.

## 1. Who can do what

| Role | Arena (read) | Register / submit | Host & judge |
|---|---|---|---|
| Student (`user`) | yes | yes | no |
| Mellow Ops (`admin_internal`) | read-only preview | no | with `hackathons` permission — **any** hackathon |
| Hiring partner (`admin_company`) | read-only preview | no | **their own company's** only |
| Superadmin | read-only preview | no | any hackathon |
| College TPO, coordinator, marketing | **403** | no | no |

The single rule for "may this person run this hackathon" is `Hackathon::isManagedBy()`. A
partner touching someone else's hackathon gets **404, not 403**, so other companies' hackathons
are not even confirmed to exist. A host can preview their own **draft** in the Arena (as a
student would see it); a student can never see a draft or a cancelled hackathon.

Only Ops can feature a hackathon (the big hero at the top of the lobby). A partner's edit never
un-features something Ops featured.

Existing Ops accounts that hold the *full* permission set receive `hackathons` automatically
(migration `2026_10_12_100100`); narrower accounts get it only when a superadmin grants it.

### Audience: everyone, or specific colleges

Whoever hosts a hackathon chooses who it is shown to:

| Audience | Who sees it |
|---|---|
| **All students** (`audience = all`) | every student on AptRun, including independent students who belong to no college |
| **Specific colleges** (`audience = colleges`) | only students of the colleges mapped in `hackathon_colleges` |

- **There is no approval step.** A host who maps a hackathon to a college puts it straight into that
  college's students' Arena the moment it is published (a draft is visible to nobody).
- Ops and hiring partners both choose from every active college; the picker shows an aggregate student
  count per college, never a roster. To reach "all colleges", use *Select all* in the picker — the
  difference from *All students* is that independent (college-less) students are not included.
- It is **enforced on the server, everywhere a student reads**, not just hidden in the UI: the catalogue,
  the lobby (featured event, live/upcoming, totals, theme filters), the hackathon page, its gallery and
  results, and registration itself. A student outside the audience gets a **404** — the hackathon's
  existence is not confirmed to them.
- Hosts previewing the Arena see their hackathon regardless of audience (`Hackathon::isManagedBy`).
- **A registered student is never stranded.** A host cannot narrow the audience so that it excludes anyone
  who has already registered (`audience_excludes_registered`); colleges with no registrations can be
  dropped freely, and switching to *All students* is always allowed. As a safety net, someone already
  registered keeps access to their own project even if the data is edited directly.
- Students see a **"Your college only"** badge on exclusive hackathons; which other colleges are mapped is
  host-only. Hosts see a pill in their list ("All students" / "3 colleges") and an *Audience* card on the
  manage screen.

## 2. A hackathon's life

`status` records the host's decision (`draft` → `published` → `cancelled`). **Where it is in its
life is derived from the clock** (`Hackathon::phase()`), never stored, so it cannot go stale and
nothing has to run on a schedule:

```
registration_opens_at ──► registration_closes_at     late sign-ups are allowed: this can be after kickoff
        starts_at ──────────────► ends_at            ends_at is the submission deadline
                                    ends_at ──► results_published_at     the judging window
```

| Phase | Meaning |
|---|---|
| `upcoming` | published, registration not open yet |
| `registration_open` | students can sign up |
| `starting_soon` | registration closed, kickoff not yet |
| `live` | building (registration may still be open) |
| `judging` | deadline passed, host is scoring |
| `completed` | results published |

Rules the server enforces:

- Dates must be coherent (opens ≤ closes ≤ deadline, kickoff < deadline).
- Publishing needs a deadline in the future, and a location unless the hackathon is fully online.
- A published hackathon **with registrations cannot be unpublished or deleted** — only cancelled
  (with a reason). A cancelled hackathon is final.
- Once students have registered, **team size is locked**; capacity cannot drop below the number
  registered. Once the hackathon has started its kickoff cannot move; once the deadline passes it
  cannot change. Once judging begins the **criteria are locked**; once results are out the
  **prizes** are too.

## 3. Registration and teams

Everything that can be raced lives in `HackathonRegistrationService`, inside one transaction
that first **locks the hackathon row** — two students taking the last seat, or two friends
joining a team with one slot left, are serialised, so capacity and team-size limits hold.

- A student who enters alone gets **a team of one** — there is one code path for participation,
  submissions and results.
- Join a team with its **8-character invite code** (no `0/O/1/I/L`). The code is only ever sent to
  members of that team.
- A leader who leaves hands the team to the member who joined first; the last member out
  removes the team (and any draft). A leader can remove teammates.
- **Teams lock** when the team submits its project and when the deadline passes.
- `min_team_size` is enforced at **submit**, not at registration, so a team has time to form.

## 4. Projects

One project per team, editable by **any member**, from kickoff to the deadline.

- *Save draft* needs only a title. *Submit* needs a title, description, repository link, a
  track (if the hackathon defines tracks) and a team of at least `min_team_size`.
- A submitted project stays editable until the deadline. Submitting locks team membership.
- Links must be `http(s)` — `javascript:` and friends are rejected.
- Scores, rank, award and feedback can never be set through the student endpoint, however the
  request is shaped.

## 5. Judging and results

After the deadline the host scores each **submitted** project (0–10 per criterion; the weights
turn that into a score out of 100, normalised if they do not sum to exactly 100).
`HackathonResultsService` does the maths; the host's UI previews it live.

- Judging criteria default to *Innovation 30 / Technical depth 30 / Impact 25 / Presentation 15*.
- **Publishing results** (`POST …/publish-results`) needs every in-contention project scored (or
  disqualified), ranks them **strictly** (a tie goes to the team that submitted first, so every
  place is exactly one team) and attaches the prize for each place. It can be run again after a
  correction — ranks are recomputed from scratch.
- Disqualified and unsubmitted projects are never ranked.
- **Privacy:** students see no score, rank, feedback or disqualification until results are
  published; the public gallery opens only after the deadline (nobody can copy a rival mid-event)
  and never lists drafts or disqualified entries. A student's email address is never sent to
  another student — teammates appear by name, handle and avatar only. All of this is decided in
  one place, `HackathonPresenter`.

## 6. Code map

| Piece | Where |
|---|---|
| Schema | `database/migrations/2026_10_12_100000_create_hackathon_tables.php` |
| Models | `Hackathon`, `HackathonTeam`, `HackathonParticipant`, `HackathonSubmission`, `HackathonAnnouncement` |
| Rules | `app/Services/Hackathons/` — `Registration`, `Submission`, `Results` services; `HackathonRuleException` (renders `{message, code}` JSON the UI branches on) |
| What each audience may see | `HackathonPresenter` |
| Audience | `hackathons.audience` + `hackathon_colleges` (migration `2026_10_13_100000`); `Hackathon::scopeAvailableTo()` / `isAvailableTo()`; picker `AudiencePicker.tsx`; colleges list `GET …/hackathons/colleges` |
| Students' API | `HackathonArenaController` → `/api/arena/*` |
| Hosts' API | `ManagesHackathons` trait, used by `AdminHackathonController` (`/api/admin/hackathons`) and `CompanyHackathonController` (`/api/company/hackathons`) |
| Rate limits | `arena-action`, `arena-submit`, `arena-host` in `AppServiceProvider` (per user) |
| Student UI | `frontend/src/components/arena/` (+ `detail/`), styled by `app/arena/arena.css` |
| Host UI | `frontend/src/components/hackathons/host/` |
| Front-end helpers | `lib/hackathon.ts` (formatting, phases, API), `lib/hackathonHost.ts` (form ⇄ payload, validation) |
| Cover art | `frontend/public/hackathons/*.svg` (the five demo covers) |

The audit log (`ActivityLog`) records create / update / publish / unpublish / cancel / delete,
scoring, disqualification and publishing results.

## 7. Deploying

```bash
cd backend
php artisan migrate                 # 2026_10_12_* tables + permission backfill, 2026_10_13_* audiences
```

- **Cover uploads** go to the `public` disk (`hackathons/covers/…`). `php artisan storage:link`
  must exist on the server, as it already does for avatars.
- The frontend is a static export: `npm run build` in `frontend/` and upload `out/`. The Arena's
  routes are `arena.html`, `arena/hackathon.html` (reads `?slug=`), `arena/my.html`, and the host
  pages `admin/hackathons{,/edit,/manage}.html` and `admin/company/hackathons{,/edit,/manage}.html`.
  A host that rewrites unknown paths to `index.html` needs the same rule it already has for the
  other `?id=` pages.
- Superadmin can grant the new **Hackathons** permission from *Mellow Staff → Manage Access*.

## 8. Demo data

`HackathonSeeder` (called by `DatabaseSeeder`) creates five hackathons in five different moments,
dated relative to when it runs, so every state of the Arena can be seen:

| Hackathon | State | Host |
|---|---|---|
| AI for Bharat Build Sprint | **live** (featured) — the demo student's team has a draft | AptRun |
| Nimbus Cloud-Native Challenge | **registration open** (teams of 2–4) | Nimbus Labs |
| GreenCode Climate Hack | announced, **registration not open yet** | AptRun |
| HealthTech Hack Day | **judging** — half the projects scored; **exclusive to Apex** (other colleges never see it) | AptRun |
| Campus Connect Hack 2.0 | **completed** — podium, a disqualification, the demo student 2nd | AptRun |

Run just this seeder: `php artisan db:seed --class=HackathonSeeder`. It is idempotent, creates a
24-student demo cohort at the Apex college, and — like the rest of `DatabaseSeeder` — is for
local/demo databases only, never production.

## 9. Tests

- Backend: `php artisan test --filter=Hackathon` — `HackathonHostingTest`, `HackathonArenaTest`,
  `HackathonJudgingTest`, `HackathonAudienceTest`, `HackathonSeederTest` (who may do what, every
  registration/team/submission rule, who can see a hackathon by college, scoring maths, ranking and
  tie-breaks, and what stays private until results).
- Frontend unit: `npx vitest run src/tests/unit/hackathon.test.ts` (+ `auth-session.test.tsx`).
- End to end (needs the demo data; it creates and publishes test hackathons, so run it against a dev
  database and delete the "E2E …" rows afterwards): `npx playwright test src/tests/e2e/qa/qa-11-hack-arena.spec.ts`.

## 10. Not built (deliberately)

Email notifications (registration confirmation, results announced), multiple judges per project,
participation certificates, a find-a-teammate board, per-hackathon discussion threads, and letting a
TPO see which hackathons are mapped to their college. The data model leaves room for each; none was
needed to run a hackathon end to end.

## 11. Running it locally (Windows / XAMPP)

- `php artisan serve` recompiles the whole framework on every request because **OPcache is off for the
  CLI** in XAMPP's default `php.ini`; on a busy machine that shows up as multi-second pauses. Enabling it
  makes requests about 4× faster (≈0.07 s vs ≈0.25 s): in `php.ini` uncomment `zend_extension=opcache`
  and set `opcache.enable_cli=1`, or start the API directly from `backend/public` with
  `php -d zend_extension=opcache -d opcache.enable_cli=1 -S 127.0.0.1:8000 ../vendor/laravel/framework/src/Illuminate/Foundation/resources/server.php`.
- The login endpoint allows 5 attempts a minute per account. End-to-end tests that need the same user many
  times should sign in through the API once and reuse the session (see `signIn()` in the spec).
