# Departments: Engineering · Management · Commerce · Arts

AptRun began as an engineering product (CSE, then ECE/EEE/Mech/Civil — see [multi-branch-core-prep.md](multi-branch-core-prep.md)).
This is how it now serves a whole university: a college runs **one or more departments**, every department has its own
programmes (branches), its own modules, its own prep questions and its own interviews, and every screen — student, TPO,
Mellow staff, superadmin — only shows what relates to whoever is looking.

## The idea in one paragraph

`Department → Discipline (family) → Branch`. Four departments ship: **Engineering & Technology** (everything that existed, unchanged),
**Management & Business Administration**, **Commerce & Accounting**, **Arts, Humanities & Social Sciences**. A student's
`users.department`, `discipline` and `branch_code` come from their college's roster label (a TPO's own mappings win), or from what they
say at first login. The department decides **which modules they see** (server-side — the API refuses the rest), what their
Domain Prep is called, which interview roles they are offered, how their readiness is scored and what the college's TPO sees when
that department is selected. A college that never touches any of this is an engineering-only college and sees exactly what it always saw.

## What ships

**For now each department offers five main branches** — the picker a student sees, the roster template a TPO downloads, the audience pickers and
the department switcher list these and nothing else:

| Department | Branches on offer |
|---|---|
| Engineering & Technology | CSE · Electrical (EEE) · Electronics (ECE) · Mechanical · Civil |
| Management & Business Administration | BBA · MBA (General) · MBA Marketing · MBA Finance · MBA HR |
| Commerce & Accounting | B.Com · M.Com · Chartered Accountancy · Company Secretary · Cost & Management Accountancy |
| Arts, Humanities & Social Sciences | English · History · Political Science · Economics · Psychology |

The catalogue holds many more (97 in all: IT, AI & ML, E&TC, Production, Chemical, MBA Operations, B.Com Hons, Sociology, Journalism, B.Ed …). They are
switched **off, not deleted** (migration `2026_11_02_100700`): a student already in one keeps their branch, questions and results; a college's older
spelling ("IT", "E&TC") still resolves to the branch it always did; drives that name one still match; a family left with no branch on offer is not
offered either. **Superadmin → Departments → Branches** switches any of them back on, and its family returns with it — the starter questions for all of
them are already in the database.

**Every branch that has Domain Prep has at least one real question**, including the ones switched off (85 for Management, Commerce and Arts; 14 for the Other engineering branches, each of which studies a shared core of four subjects plus its own specialisation — 6 questions apiece; 647 for ECE / EEE / Mech / Civil). CSE and IT-type branches (8 of the 97) have no Domain Prep by design: they practise on the 2,000-problem coding bank, as before. Branches with their own specialisation (e.g. *MBA Finance* → "Security
Analysis, Portfolio & Financial Markets") get a question in that specialisation; general branches use their discipline's shared core.
The questions are original, modelled on what those students actually sit (CAT/CMAT, CA Foundation, CUET/UGC-NET patterns), and every
answer key and topic was machine-validated — but see *What this does not do*.

The taxonomy lives in data, not code: `backend/database/data/department_taxonomy.php` (departments, families, branches, aliases),
`domain_taxonomy.php` (149 subjects, 797 topics), `domain_questions/*.json`, `department_interview_content.php`. A new department,
family or branch is added from **Superadmin → Departments** without a release.

## Which modules each department gets

Resolved in layers, last wins: **registry default → department → family → branch → student opt-in** (`config/departments.php`,
`App\Support\DepartmentCapabilities`). Sent to the browser as `capabilities` on a student, and enforced on the API by the
`capability:` route middleware (403 `capability_unavailable` — hiding a link is never the only line of defence).

| Module | Engineering | Management | Commerce | Arts |
|---|:-:|:-:|:-:|:-:|
| Coding practice, contests, company PYQs, Project Lab, Hack Arena | yes | no | no | no |
| Skill Drills | ECE · EEE · Mech · Civil | no | no | no |
| **Domain Prep** (Core / Management / Commerce / Subject Prep) | every branch except CSE / IT | yes | yes | yes |
| AI interviews & practice-interview studio | yes | yes | yes | yes |
| Soft skills & aptitude, Learning Centre, Vault, placement drives | yes | yes | yes | yes |

Exceptions are data, not code: **B.Com (Computer Applications)**, **B.Com / MBA / BBA (Analytics)** and **MBA (IT)** switch coding,
contests and company PYQs back on. A student of a no-coding department may switch coding on for themselves (Settings → Preferences); the
server folds that into their map. A student with no department recorded is engineering — nobody loses a module because we have not
classified them. A student who opens a module their programme lacks (a bookmark, a shared link) sees a calm "not part of your
programme" page, never a blank one.

## Colleges: running one or several departments

* `college_departments` (college ↔ department). **No rows = engineering only** (so nothing existing changes). A college's TPO
  manages it in **Settings → Departments**; Mellow staff in **Colleges → Departments**. A department that still has students cannot be
  switched off by the college; superadmin can force it knowingly.
* **Department switcher.** A TPO of a multi-department college gets *All departments · Engineering · Management · Commerce · Arts*
  on the screens that follow it (command center, Student Cohort, reports, analytics, mock interviews, soft skills). It remembers the
  choice per college, and renders nothing for a college with one department. Counts, charts, filters, reports and exports follow it.
* **Importing students department-wise.** The Student Cohort import (CSV/XLSX) and "Add student" ask which department the roster is
  for (not asked when the college runs one). The Excel template is the department's own — its branch drop-down, its example row.
  An ambiguous label is read in that department's terms ("Finance" is *Accounting & Finance* in Commerce, *MBA Finance* in Management;
  bare "CA" is Chartered Accountancy only in Commerce). A row naming **another department's programme** is refused with a reason
  ("B.Com is a Commerce programme, but this is a Management import"); someone already in another department is not silently moved.
* A TPO's own label mappings (Branch mapping) are scoped per department too, so one college's "Finance" can mean two things.

## Domain Prep (was Core Prep)

Core Prep is now **Domain Prep**, named by the department: *Core Prep*, *Management Prep*, *Commerce Prep*, *Subject Prep*.
Same machinery (topic practice with worked explanations, timed proctored tests, mastery, TPO insights, item analysis, coverage), same
**staged rollout**: a family is hidden → **pilot** (chosen colleges, needs one published question) → **live** (public go-live bar is
150 questions). The 85 starter questions arrive *published* but invisible: nothing reaches a student until you pilot or go live
(Superadmin → Core Prep → Coverage & go-live). A subject may belong to specific branches (`core_subjects.branch_codes`), so an MBA Finance
student is never served consumer-brand questions and vice-versa; null = shared by the whole family.

A student whose programme has no coding is **not asked** "lead with your branch or with IT?" — there is no IT track to weigh it against.

## Interviews

Each of the 16 new families has role cards in the Practice-interview studio (e.g. *Accounts Executive*, *Tax & Compliance Executive*,
*Brand Manager Trainee*, *Content Writer / Editor*, *Heritage / Museum Associate*), Mellow role templates (three rounds each), and 3–5
starter spoken technical questions tagged to the family so only that field's students are asked them. The AI generator and scorer
judge reasoning, not recited definitions (`App\Support\InterviewDiscipline`). A Commerce student is offered Commerce roles only — no
IT-company roles unless they opt in to coding.

## Readiness, cohorts, eligibility, scoping

* **Readiness `general` profile** — a programme with no coding and no contests is scored on AI interviews 25 · Learning Centre 20 ·
  Soft skills 20 · Events 15 · Consistency 20, instead of being capped at 70 for code it can never write. The Vault payload carries
  `department` and `readiness.profile = "general"` (**Mellow Vault must accept both**).
* **Cohort engagement** for a non-coder counts any platform activity (interview, soft-skills test, Learning Centre, Domain Prep) —
  otherwise a whole department reads "never started".
* **Audiences** (contests, interviews, tracks, soft-skill and Domain Prep tests, coordinator scope) can name a whole department; stored
  only when used, so every older audience is byte-identical. A student with no recognised branch is let through unless their *department*
  is known and the audience cannot reach it (an ECE test never lands on an unplaced Commerce student).
* **Drive eligibility** accepts `department:<code>` tokens next to branch codes and `family:` tokens; an unplaced student is ruled out
  only by a drive that cannot be theirs.
* **Section coordinators** can be scoped to a department as well as a family or branch (still a 404, never a 403, outside scope).
* **Superadmin** sees and changes everything: **Departments** (modules per department, per family, per branch; icons, colours, the
  Domain Prep name; coverage and question counts), **Colleges → Departments**, the student directory filtered by department.

## Who sees what — and how that is guaranteed

| Thing | Rule | Direct link |
|---|---|---|
| Interviews, interview tracks, soft-skill tests, contests, Domain Prep tests | shown only when the student's **department, family or branch** is in the item's audience (no audience = everyone) | 404, never 403 |
| Coding practice, contests, company PYQs, Project Lab, Hack Arena, Skill Drills | the department's capability (see above), enforced by the API | 403 `capability_unavailable` |
| Domain Prep practice | only subjects of the student's own family, and of their own branch when a subject is a specialisation | question of another programme is refused |
| Domain Prep **tests** | a test may hold only subjects *every student it reaches studies*: shared core always; a specialisation only when the test is aimed at branches that all study it. Enforced when a test is built, when its audience is changed, when a college copies a paper, and again when it is listed or started | 404 |
| Practice interviews | role cards and questions of the student's own family; IT roles only if they code | a role of another family is refused |
| Placement drives | the college's drives with the student's eligibility (`department:` / family / branch tokens); coding "recommended problems" are left out for a programme that does not code | — |

Guard tests, so this stays true as the product grows: `DepartmentVisibilityMatrixTest` (seven students from four departments against
content aimed at every kind of audience, through the real endpoints, list **and** direct link; plus a crawl of every student `GET`
page for every department), `DepartmentAudienceTest`, and the frontend `capability-gates.test.ts` (a new student section cannot be
added without a gate or an explicit "for everyone" entry).

## Deploy checklist

Backend deploys before frontend. Nothing here changes what an engineering-only college sees.

1. Back up the database.
2. `php artisan migrate --force` — six migrations, all additive and idempotent:
   `2026_11_02_100000` department tables · `…100100` departments, families, branches, aliases · `…100200` Domain Prep subjects and
   topics · `…100300` backfill (every college → engineering, every student → their department) · `…100400` the 85 starter questions ·
   `…100500` interview roles, templates and bank. Deploying code before migrating is safe (the catalogue reports engineering only).
3. `php artisan route:cache` — new routes (`/tpo/departments`, `/superadmin/departments`, `/admin/colleges/{id}/departments`) 404 until this runs.
4. Build the frontend. No new dependencies.
5. Superadmin → Departments: look the four over. Superadmin → Core Prep → Coverage: **pilot** one college per new family you want to
   start with (it needs only one published question), grow the banks, then go live at 150.
6. `php artisan readiness:refresh --all` (optional): moves non-coding students to the `general` profile at once instead of on their next visit.
7. Tell **Mellow Vault** the payload gained `department` and `readiness.profile = general`.
8. Tell TPOs: Settings → Departments to switch departments on; import each department's roster from its own template.

## What this does not do (on purpose)

* **Content is a starter, not a finished bank.** 85 questions is enough to prove every branch end to end, nowhere near enough to
  open a family publicly (150 minimum; 500+ to be convincing). They are original and were checked by machine, not yet by subject
  experts — have a CA / MBA / subject teacher review them before students see them. CSE and IT-type engineering branches have no Domain Prep.
* New families' role cards have no "interests" yet (the *recommended for you* ribbon is engineering-only), and a student cannot yet
  tick areas they are drawn to outside engineering.
* The Company (hiring) portal's candidate filters are not yet department-aware beyond branch family.
* TPO proctoring list, mock-contest and mock-core-test lists are not scoped by the department switcher (they have their own audience pickers).
* Students never see rating / solved numbers that do not exist: Settings hides them for non-coders — but note that Settings still
  shows the **placeholder** coding stats (rating 1945, 684 solved) to *every* coding student; they come from `data/mockDashboardData.ts`
  and were never wired to real numbers.
* Pricing and plan limits are not department-specific; a Commerce student on the free plan gets the free plan's AI-interview and
  Domain Prep limits.

## Where to look in the code

`backend/config/departments.php` (capability registry) · `database/data/department_taxonomy.php`, `domain_taxonomy.php`,
`domain_questions/`, `department_interview_content.php` · `app/Support/{BranchCatalog,DepartmentCapabilities,BranchAudience,InterviewDiscipline}.php` ·
`app/Services/{CollegeDepartmentService,Core/CoreAccess,PracticeInterviewService,PracticeShelfService,ReadinessScoreService,StudentCohortService}.php` ·
`app/Http/Middleware/EnsureStudentHasCapability.php` · `app/Http/Controllers/Api/{CollegeDepartmentController,SuperAdminDepartmentController,StudentImportController,TpoStudentController}.php` ·
`frontend/src/lib/{branches,departments}.ts` · `components/branches/*` · `components/dashboard/{studentNav.ts,CapabilityGate.tsx,DashboardShell.tsx}` ·
`components/settings/CollegeDepartmentsSection.tsx` · `components/admin/superadmin/DepartmentsPanel.tsx`.
Tests: `DepartmentsTest`, `DepartmentImportTest`, `DepartmentAudienceTest`, `DomainPrepDepartmentsTest` (backend) and
`departments.test.ts`, `department-ui.test.tsx` (frontend).
