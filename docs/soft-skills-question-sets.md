# Soft Skills question sets

AptRun ships a library of numbered, ready-made Soft Skills papers — **"Soft Skill Assessment – Set 1 … Set 45"**, 25
questions each (8 quantitative, 7 logical, 6 verbal, 4 situational). This page is how they work for students and for
everyone who schedules a test.

## For students — `/dashboard/soft-skills`

* **Assigned to you** (top, only if there are any): tests a college or hiring partner scheduled for the student.
  Few and important, so never paged; folds to four with "Show all N".
* **AptRun Soft Skills question sets**: the library.
  * 20 sets per page (page numbers, Previous/Next) or **Show all**.
  * Search ("12", "set 12", or a word from the title), and filter by the student's own progress
    (All / Not attempted / In progress / Completed).
  * A progress bar ("2 of 45 completed"), and on every card: *Best 84%*, *In progress — resume*, or *Not attempted*.
  * The view lives in the address bar (`?q=&status=&page=&per=all`), so refresh, Back from a test and shared links
    land on the same page. A stale page number is clamped by the server.
* Attempting a set is the existing flow (`/dashboard/soft-skills/session?slug=…`): every attempt and score counts toward
  readiness exactly as before.

API: `GET /api/soft-skills` — with no query string it still returns everything in one list (old shape, now with
`is_question_set`, `set_number`, `in_progress`). With `?scope=sets|assigned&q=&status=&page=&per_page=20|all` it returns
`{assessments, meta, counts}`; `per_page=all` is capped at 500.

## For schedulers — Mellow Ops, college TPOs, hiring partners

`New Soft Skills Test` is now two steps:

1. **Details** — title, duration, pass %.
2. **Question set** — the library, 20 per page / Show all, search, and the filter *All · Not used yet · Used before*.
   Every set this organisation has built a test from is **marked** ("Already published — Published in “Campus Round 1”
   · added 16 Oct 2026", "In a draft", "Used · cancelled"). Choosing a used set shows a warning (never a block).
   Then **Add Set N & publish**, **Save as draft with Set N**, or **Create without a set** (the old route: attach bank
   questions afterwards). The test, its questions and its published state are created by one request: a refused set never
   leaves a half-built draft.

Existing tests: **Manage Questions → Add a ready-made question set** (more than one set can be combined; sets already
in the test are greyed out). Test cards show *Built from Set 7 · Set 9*.

Rules enforced by the server (not just the screens):

* A set is added by **copying** its questions into the test, so editing or retiring a library set never changes a live test.
  Questions the test already has are skipped, not duplicated.
* The same set can't be added to the same test twice; a test **with candidate attempts**, or a **cancelled** one, can't take
  more questions (attempts were scored against the old ones).
* A test with no questions can't be published (`status=published` is refused) — previously only the button was disabled.
* **Usage is private to the owner.** A TPO sees only their own college's tests, a hiring partner only its own, Mellow Ops
  only the general tests Mellow wrote by hand. One college's use of Set 7 is invisible to everyone else
  (`SoftSkillQuestionSetService` + each controller's `scopeOwnTests` — the whole tenancy rule; tests pin it).

Endpoints (per role: `/api/admin`, `/api/tpo`, `/api/company`):
`GET …/soft-skill-question-sets?q=&usage=all|used|unused&page=&per_page=` and
`POST …/soft-skills/{test}/question-sets {question_set_id}`; `POST …/soft-skills` also accepts `question_set_id` and `publish`.

### Mellow Ops: curating the library

`/admin/soft-skills` has two tabs: **Tests** and **Question sets**. On a Mellow-written test, *List as question set* adds it
to the library with the next free number (needs at least one question); *Remove from library* takes it out again — only while
no test has been built from it (cancel it instead to stop it being offered). A set that is not published is not shown to
students or offered to schedulers.

## Data

* `soft_skill_assessments.is_question_set`, `question_set_number` (unique) — a set is an ordinary Mellow-owned general
  assessment with this flag, so existing attempts, scores and readiness are untouched. The migration back-fills the 45 sets
  by slug (`soft-skill-assessment-set-<N>`); the seeder sets them for fresh installs.
* `soft_skill_assessment_sets` — provenance (which test was built from which set, when, by whom), with snapshot columns so
  the usage history survives a set being deleted.

## Deploy

1. `php artisan migrate` (`2026_10_20_100000_add_question_sets_to_soft_skills`) — back-fills the existing sets.
2. `php artisan route:cache` — the new routes 404 on a cached route list until you do.
3. Nothing to re-seed. `SoftSkillTwentySetsSeeder` is idempotent if you ever do.

## Things to know

* The sets are open to every student as practice, so a set used in a **real, proctored** test may already have been seen by
  some of its candidates. The "Used before" markers help a scheduler avoid reusing a set across their own tests; they cannot
  tell whether students practised it. If real tests need unseen papers, the follow-up is a "for schedulers only" flag on a
  set (hidden from the student library) — not built.
* Combining sets can exceed the duration you set — adjust the duration yourself.
