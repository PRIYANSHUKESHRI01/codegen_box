# Reports, scheduled mock interviews, TPO account tools, the CS core and the coordinator dashboard

Built 2026-11-04. This is the owner document for that round of work; read it before changing any of it.

## 1. PDF reports, and the archive that keeps them

Every report is rendered **on the server** (Dompdf, Blade views in `resources/views/reports/`), stored once on the private `local` disk
(`storage/app/private/reports/<college>/<kind>/<id>.pdf`) and indexed in the **`generated_reports`** table. A download streams the
*stored* bytes after checking the SHA-256 (410 if the file is missing or altered), so the file a TPO opens in December is the one made
in October, not a regeneration. Layout is tables and plain boxes (Dompdf is CSS 2.1); the logo is `resources/brand/aptrun-logo.png`.

| Report | Who can make it | Where it is |
|---|---|---|
| **Student report** (`student_report`): readiness + trend, coding (difficulty, verdicts, languages, topics, latest submissions), contests, AI interviews incl. score by question type, Vault AI qualification, soft skills, Core/Domain Prep, drives, exam conduct, mentor follow-ups, and a rule-based "going well / needs attention / next steps" summary | TPO (own college), coordinator (own section), platform staff (`platform_users`), the student for **themselves** | Student drawer → *Download full report*; the *View Report* page; the student's *Performance Report* page |
| **Mock AI interview report** (`interview_report`): audience, completed / part-way / not started, scores, pass rate, distribution, by question type, per-question averages, every student, who has not started, integrity | TPO (own college's interviews) | Mock Interviews → *Results* → *Download report* |
| **One interview sitting** (`interview_session_report`): every question, the student's answer, score and feedback, conduct | TPO (their college's); the student for their own finished and marked sitting | Results page row *PDF*; the student's interview result page |
| **Section report** (`section_report`) | Coordinator (own section and branch scope); TPO (any section of their college, or "no section") | Coordinator → *Reports*; Report Archive |

* **Audience:** a staff report includes the college's internal follow-up notes; the student's own copy never does (`audience = student`).
* **Access rule** lives in one place, `App\Support\ReportAccess`; a wrong guess is always a **404**, never a 403. A TPO's *Report Archive*
  (`/admin/reports/archive`) lists everything the college has made, filters it, deletes old ones and zips a selection (`POST /tpo/reports/bundle`,
  max 60). "Make a whole section's reports" there generates one PDF per student, waiting out the rate limit.
* **Purge:** deleting a student or a college deletes their report files too (`UserPurgeService::collectFiles`, `CollegePurgeService`).
* **Rate limit:** `report-generate`, 45/min and 600/h per user. Every generation by someone other than the subject is written to the audit log.

## 2. College mock AI interviews: schedule, audience, library, results

* **Schedule** (`interviews.opens_at / closes_at`): students may *start* only inside the window (423 `interview_not_open_yet` before, 410
  `interview_closed` after); a sitting already begun may be finished. No window = open while published, exactly as before.
* **Audience** (`interviews.audience_filter`: years, sections, hand-picked students) ANDs with the branch audience; hand-picked students are *added*;
  a named list with nothing else is **invite-only**. One definition, `App\Services\Interviews\InterviewAudience` (SQL form + in-memory twin), read by the
  student's list, the start gate, the announcement, the reminders, the results and the coordinator view. Foreign student ids are dropped silently.
* **Tell students:** publishing notifies the audience in-app (`AssessmentNotifier`, now audience-aware) and by e-mail (`SendMockInterviewMail`, batched,
  rate-limited). `interviews:remind` (scheduler, every 10 min) sends "opens in about an hour" once and "closes soon" once to those who have not finished;
  a new schedule resets both.
* **Fill it:** AI generation and the shared bank as before, plus the **AptRun library** (`GET /tpo/interviews/library`, `POST …/library-questions`): random,
  non-repeating questions by domain and stack, up to 30 per interview. *Duplicate* copies an interview as a draft.
* **Publishing needs at least one question.** Results/PDF as in §1. Screens: Mock Interviews (cards with window, audience, progress), *Schedule & publish*
  modal (live head-count from `POST /tpo/interviews/audience-preview`), *Results* page.
* **Student side:** cards show the window, upcoming / closed sections, a disabled start with the reason, and *Download report (PDF)* on the result.

## 3. The Computer Science core (CSE / IT)

CSE and IT branches used to have no Domain Prep "by design". Now:

* **Domain Prep for CSE**: capability `domain_prep` on the `cse` discipline, 10 subjects / 51 topics (DBMS, OS, networks, OOP, data structures, algorithms,
  computer organization, theory of computation & compilers, software engineering, discrete maths & probability) and **160 original questions**
  (`backend/database/data/domain_questions/cse.json`, built by `content/core-prep/cse/build_cse.py`; edit the Python, not the JSON). It stays **hidden until
  staff switch it live** (Superadmin → Core Prep → Coverage → CSE; the go-live guard passes as shipped). A CSE student is never asked the "core or IT first?"
  question, and their readiness is unchanged (no track = software weights). The practice-interview and shelf services were hardened so a family with no
  role group of its own (CSE) does not 500.
* **Mock AI Interview → "Computer Science Core"**: 6 stacks (DBMS & SQL, OS, Computer Networks, OOP, DSA theory, Software Engineering) × 3 rounds × 6
  spoken questions with a rubric note each (`database/seeders/data/mock_questions/cs_core_mock.php`, config `mock_interviews.extra_roles.cs_core`). Students
  practise them in the Mock AI Interview and TPOs draw them into their own interviews. Not in the Vault AI Interview.
* **Honest limits:** all of it is AI-written and **not yet read by a faculty member** (every spoken question is flagged `needs_review`; every MCQ is tagged
  `editorial-v1`). Have one person read both files before switching Domain Prep live for everyone.

## 4. A TPO runs their own students' accounts

Student drawer → **Manage account** (`TpoStudentManageController`): the account at a glance (signed in, sessions, plan read-only, Vault AI read-only,
what was done to it), **edit details** (name, roll, branch, CGPA, backlogs, phones; the login e-mail only while the account is still on its one-time
password), **block** (reason required, signs them out) and **unblock** (any block, including a coordinator's), **send a new login** (new one-time password,
e-mailed to the student, never shown), **sign out everywhere**, **remove** an account that was never used (no sign-in, activity or purchases).
Scoped to the caller's college (404 otherwise), rate limited (`tpo-student-actions`), audited with the student it was done to.
**Deliberately not given** (platform decisions): seeing or choosing a password, plans / payments, hand-setting readiness, changing Vault AI results or
attempts, "view as", deleting a used account, any role change.

## 5. Mail

One footer for every e-mail (`emails/partials/footer.blade.php`, data in `config/brand.php`) that mirrors the landing page: *AptRun is a product of Mellow
Vault*, support e-mail and phone, location, links, the four social links and the registered legal line. "Mellow has created your account" is now **"AptRun
has set up your account"** for every role, and no template speaks as "Mellow" (a test enforces it). New: the scheduled-interview e-mail. `EmailBrandingTest`
also checks the brand lines against `Footer.tsx`.

## 6. Section coordinator dashboard

Tabs: **Overview** (KPIs, readiness trend with the Vault line and the college comparison, practising per day, attention queue, mix, leaders / most improved /
slipping), **Students** (the roster, unchanged), **Follow-ups** (open notes by urgency, mark done), **Interviews** (scheduled mock interviews for the section,
who has not started, remind them in-app), **Reports** (the section PDF + history). Numbers come from `CoordinatorInsightsService` (`GET /coordinator/insights`),
on the same scope rule as the roster (`User::scopeCoordinatedBy`); the trend reads the daily readiness history.

## 7. Section naming

Filter the roster to a branch (or select only that branch's students) and *Set section* starts with the prefix: **`CSE_`** → type the letter → `CSE_A`.
A one-click "Use CSE_C" suggests the next free letter; a box holding only the prefix is never saved. One branch → its own short name (`IT_`, `CSE-AIML_`).
Rules in `frontend/src/lib/sectionNaming.ts`.

## Deploy

1. `php artisan migrate --force` (3 migrations: `generated_reports`, interview schedule columns, CSE Domain Prep) — **or** run `aws-db-update-2026-11-04.sql`
   (it also records the migrations; idempotent; verified on MariaDB against the artisan path), then `php artisan db:seed --class=MockInterviewQuestionsSeeder`
   only if you used `migrate` (the SQL already loads the 108 spoken questions).
2. `php artisan route:cache && php artisan config:cache`.
3. The scheduler cron already runs `schedule:run`; it now also runs `interviews:remind`.
4. `storage/app/private` writable by the web user. Frontend build + deploy.
5. When ready: Superadmin → Core Prep → Coverage → switch CSE live.

## Not done / next

* Faculty review of the CS-core content (above). Hindi/regional copy of the PDFs.
* No bulk "remind everyone" for the TPO beyond the automatic reminders and the coordinator's per-interview reminder.
* The Mellow Vault hand-off payload still does not carry the interview domain; the report archive has no retention window (reports live until the student,
  interview or college is deleted).
* Not browser-tested end to end on the user's dev server (their :3000 is theirs); covered by 60+ backend tests and component tests.
