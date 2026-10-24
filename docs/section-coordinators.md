# Section Coordinators

A Section Coordinator is a faculty member a TPO delegates **one section's roster** to. They see who needs a call this week, keep
a follow-up log, notify students and block accounts. They never edit a student's record or add/import students.

## Who a coordinator can see — one rule, everywhere

A coordinator sees a student if and only if **all** of these hold:

1. the student has `role = user` (never TPOs, staff, companies, other coordinators);
2. same **college** as the coordinator;
3. same **section** (case- and whitespace-insensitive: `A`, `a `, ` A` are one section);
4. inside the coordinator's **branch scope**, if they have one.

The rule lives in one place: `User::scopeCoordinatedBy($coordinator)` (SQL) with its in-memory twin `User::coordinates($student)`.
Everything else goes through it — `SectionCoordinatorService::studentsOf / covers`, the roster, reports, notes, block, bulk-notify,
the proctoring list and its violation e-mails. A parity test asserts the SQL and PHP versions agree row for row.

* A coordinator with no college or no section sees **nobody** (`1 = 0`), never "everybody".
* A student outside the scope is a **404**, never a 403 — the API does not confirm they exist.
* A coordinator whose scope is narrowed to branches never sees a student whose branch is unrecognised (the TPO maps those).

## Branch scope (new)

`users.coordinator_scope` is `null` (whole section — how every existing coordinator behaves) or `{ "disciplines": [], "branches": [] }`.

* "Section A in CSE" and "Section A in ECE" can now have **different coordinators**.
* Two coordinators of one section may not cover the same students. The server refuses with a sentence that says who:
  *"Eva ECE Coordinator already covers ECE in Section A. Pick branches they don't."* A whole-section coordinator cannot be added
  beside branch coordinators, and vice versa.
* Blocked coordinators cover nobody, so a blocked coordinator frees their branches.
* Students in a section that **no** coordinator covers (e.g. Mechanical in a CSE/ECE-only setup, or unmapped branches) are counted
  as **"N not covered"** on the TPO's Section Coordinators page and shown as "Partly open".
* TPO and Mellow Ops set the scope with the same branch picker (All branches / Specific branches), when adding or editing a coordinator.

## The dashboard (`/coordinator`)

* **KPIs** — students, average readiness, practising now, need attention, open follow-ups (overdue flagged).
* **Needs your attention** — a ranked queue (max 12) with the *reason* on each student, from one weighted score:
  locked out of a contest 50, follow-up overdue 45, follow-up due 35, never signed in 30, dormant 25, not started 20,
  needs training 15, slipping 12, at risk 8; a follow-up already scheduled subtracts 15. Below 20 doesn't make the list;
  blocked students are excluded.
* **Readiness mix** and **Practice engagement** — click a group to focus the roster on it.
* **Roster** — search, branch / status / practice filters, sort, "needs attention / follow-ups due / at risk / eligible only" chips,
  pagination, multi-select. A table from ~1340px, cards below (so it never scrolls sideways on a 1366px laptop or a phone).
* **Follow-up log** — Call / Message / Meeting / Note, optional due date (today → +1 year), mark done, author can delete.
  The TPO sees the log read-only in the cohort drawer.
* **Block / unblock** — a block needs a **reason** (presets + free text) that the TPO can read. A coordinator can lift only blocks
  placed by a coordinator of their college; a block placed by the TPO or Mellow is theirs to lift (the button is disabled with an
  explanation).
* **Notify** (rate-limited to 12 sends/hour) and **Call list** (CSV, scoped to the filtered students; cells are guarded against
  spreadsheet formula injection).
* Every block / unblock / bulk-notify is written to the activity log.

## Weekly digest

`php artisan report:coordinator-digest` — Mondays 07:30, one e-mail per active, signed-in coordinator of an active college with
at least one student: *"Section A: N students to follow up this week"* (or "nobody needs chasing"). Scheduled in `routes/console.php`.

## Deploy

1. Back up the DB, then `php artisan migrate` — adds `users.coordinator_scope` and the `coordinator_notes` table (additive only).
2. `php artisan route:cache` — new endpoints 404 until this runs (routes are cached).
3. Scheduler (`* * * * * php artisan schedule:run`) already runs the new weekly entry; nothing to add if it is set up.
4. No new npm or composer dependencies. Backend deploys before frontend.

Existing coordinators are unaffected: `coordinator_scope` is `null` for them, i.e. their whole section, exactly as before.

## Not built (on purpose)

* A TPO cannot block/unblock a student from the cohort page itself; they ask Mellow, or use the existing admin tools.
* Coordinators' Reports page is scoped to their students but is otherwise unchanged.
* Coordinators can use the termination notice template; there is no per-template permission.

## Where to look in the code

`backend/app/Models/User.php` (`scopeCoordinatedBy`, `coordinates`) · `app/Services/{SectionCoordinatorService,CoordinatorOverviewService,CoordinatorDigestService}.php` ·
`app/Http/Controllers/Api/{CoordinatorStudentController,CoordinatorNoteController,TpoCoordinatorController}.php` ·
`app/Support/BranchAudience.php` · `tests/Feature/Coordinator*Test.php` ·
`frontend/src/app/coordinator/page.tsx`, `components/coordinator/*`, `lib/{coordinatorView,coordinatorSections}.ts`.
