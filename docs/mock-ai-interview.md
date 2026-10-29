# Mock AI Interview — practise by domain and tech stack

Student dashboard → **Mock AI Interview** (`/dashboard/interviews`). Built to follow the Vault AI Interview's path,
**Step 1 domain → Step 2 tech stack → Step 3 practise a mock interview**, without the qualification: no attempts to lose, no pass mark,
no cooldown, and it never lists the student in the Vault by itself. Practise as often as the plan allows.

## What a student sees

1. The page opens on the domain/stack explorer (`MockInterviewExplorer`). Domains and stacks are **the Vault AI Interview's own**
   (13 domains, 41 stacks — read from `CuratedCatalog`), so the two sections always list the same things and a new Vault stack
   appears here by itself. Search finds a stack by name or by its Mellow Vault domain label ("Laravel Developer").
2. A stack has **3 practice rounds** (the three themes of its Vault interview, titled "Round N: …"). Each round shows its length, how
   many sittings the student has done and their best score; the button reads *Start practice / Practise again / Start / Resume*.
3. A stack with no questions yet is **Coming soon**, showing what its rounds will cover. Nothing in it can be started.
4. **Open a domain and the page shows only that domain.** Where the student is lives in the address (`?domain=backend&stack=laravel`), so the header back arrow ("Back to All domains" / "Back to Tech stacks"), the in-page "Back to …" link, the browser Back button, a refresh and a shared link all agree. The college/Mellow sections and the "waiting from your college" chip are hidden while a domain is open and come back on "All domains". An unknown domain/stack in the address falls back to the nearest step that exists. Opening a card scrolls the explorer back into view.
5. Everything the college sets is unchanged and sits **below** the explorer (on the top-level view): *Final Interviews* (tracks), *Resume*, *Available*,
   *Completed*, *Your practice interviews*. When something is waiting for the student a chip at the top jumps to it.

Starting a round makes an ordinary private practice interview (`CuratedInterviewSetService::createInterviewFromTarget`), so it is
taken, proctored and AI-scored exactly like every other mock, and counts against the plan's mock-interview allowance **when it is sat**.
Opening a round that already has an unfinished interview resumes it (no new interview, no allowance spent). A round with more than
`questions_per_interview` (10) questions is sampled each time, preferring ones that student has not been asked in that round.

## Staff: filling the bank

Admin → **AI Interviews** → **Mock Interview Questions (by stack)** (`/admin/interviews/mock-questions`, permission `interviews`,
superadmin too). Every stack with its question count per round (R1/R2/R3), filter Open / Coming soon, search by stack or domain.
Per stack: add / edit / remove questions per round (text 15–800 chars, category, seconds 30–600, and the *note* — the rubric the AI
scorer is given). Or **load a spreadsheet** (.xlsx/.csv; columns `stack, round, question, category, seconds, note`; the downloadable
template lists every valid stack key). Bad rows are reported by line number and skipped; a question already in its round is skipped, so
re-uploading a corrected file is safe.

**Opening rule:** a round opens at `min_questions_per_round` (5) questions; a stack opens as soon as **one** round is ready (a mock has no
series to fail, so a half-filled stack strands nobody). Removing a question is always allowed — interviews already built keep their own copy.

## Merchant Navy — Second Mate (FG) orals

A domain that exists **only in the Mock AI Interview** (never in the Vault AI Interview: no qualification, no Mellow Vault hand-off). Defined in
`config/mock_interviews.php` → `extra_roles`, merged into the catalogue after the Vault's domains (`MockInterviewCatalog::extraRoles`).

- **Domain `merchant_navy`** → exams **Second Mate (FG) Orals** (live, 626 questions), **Chief Mate (FG)** and **Master (FG)** (Coming soon; they open by
  themselves once staff load 5 questions in a round). The UI says "exam", not "tech stack", for this domain (`terms`).
- **Rounds = the three STCW functions:** R1 Navigation, R2 Cargo handling and stowage, R3 Controlling the operation of the ship and care for persons on board
  (200 / 200 / 226 questions, from the Merchant Navy team's document, kept in `content/merchant-navy/`).
- **A sitting is 20 questions** (`questions_per_interview` on the stack), drawn **across the syllabus topics** (`topic` column: 10–12 per function) one topic
  at a time, unseen questions first, so a sitting covers the function the way an examiner does. A stack with no topics (every IT stack) behaves as before.
- **How it is scored:** the same Gemini batch scorer, with the answer key as the rubric and a Merchant Navy *examiner profile*
  (`InterviewDiscipline::MARITIME`): marks key points, treats a wrong figure / signal pattern / port-for-starboard as a real error, scores an unsafe action
  low however fluent, doesn't reward length, forgives speech-recognition slips. The interview carries `discipline = maritime` (set from the stack), which is
  what selects that profile. Measured on real bank questions (see below).
- **`needs_review`:** 12 Function 3 answers were marked `[Verify]` in the source (SOLAS/MARPOL figures). They are imported with the tag removed and flagged; the
  scorer is told to judge the concept and accept any commonly accepted current figure, and staff see a **Needs review** badge until someone unticks it in
  the edit dialog. **Nobody has checked the technical content of the bank** — it needs a master mariner before it is relied on.
- **Readiness:** Merchant Navy sittings do **not** count toward the placement-readiness score (`Interview::scopeCountsTowardReadiness` excludes
  `discipline = maritime`), and the page says so. Otherwise exam practice would move a student's route into the Vault (an IT recruiter's pool).
- **A corrected answer takes effect on the next sitting:** `CuratedInterviewSetService::createInterviewFromTarget` now refreshes a shared bank row's
  reference answer when staff change it (previously a row kept the answer it was first created with — this also applies to the Vault interview).

**Loading / reloading the bank**

    python backend/database/seeders/data/build_merchant_navy.py content/merchant-navy/Second_Mate_Orals_Functions_1_2_3.docx backend/database/seeders/data/mock_questions/merchant_navy_mock.php
    php artisan db:seed --class=MerchantNavyMockQuestionsSeeder

Idempotent (matched by stack + round + position); it touches only the Merchant Navy stack. Staff can also add / edit / import (`topic` and `review` are optional
spreadsheet columns). Chief Mate / Master questions: fill them in the staff screen or the spreadsheet; no code.

## The "build your own practice interview" studio is paused

The student-facing studio (`/dashboard/interviews/practice`: role + kind + difficulty, with the Gemini top-up) is **switched off by one flag**:
`PRACTICE_BUILDER_ENABLED` (config `practice_interviews.student_builder_enabled`, default **false**).

- The server refuses (`403`, code `practice_builder_paused`) on both `GET /me/practice-interviews/options` and `POST /me/practice-interviews`,
  so a stale tab or a direct call cannot build one either; the page shows a short "practise by domain instead" panel.
- Links to it were repointed to the Mock AI Interview: the banner on the mock page (removed), the home practice shelf's interview card,
  the software home's "AI mock interview" button and the Vault page's "Practice first".
- To bring it back: set `PRACTICE_BUILDER_ENABLED=true` (+ `php artisan config:cache` in production). The page and the API come back at
  once; **the links above stay pointed at the mock page** — re-add an entry if you want one.
- **Side effect to know:** the branch-specific practice interviews (ECE/EEE/Mech/Civil and the department roles, from the 144-question
  `content/interview-bank`) were reachable only through the studio, so they are paused with it. Put those questions into the Mock bank
  (spreadsheet import) to practise them by stack again.
- TPO / Mellow / company scheduling of interviews is untouched, and so is the TPO's "generate questions with AI" panel.

## Deploy

1. `php artisan migrate` — `mock_interview_questions`, then `…_add_topic_and_review_to_mock_interview_questions` (Merchant Navy).
2. `php artisan route:cache` (new routes: `GET /mock-interviews/catalog`, `POST /mock-interviews/rounds/{id}/start`, `/admin/mock-interview-bank/*`).
3. `php artisan db:seed --class=MerchantNavyMockQuestionsSeeder` — loads the Second Mate orals (626 questions). If config is cached: `php artisan config:cache`.
4. Frontend build. No env changes needed (the studio is off by default; `GEMINI_API_KEY` is the existing scorer's).

Before `migrate` the catalog fails soft: every stack shows Coming soon and the staff screen reports an error until the table exists.

## Not done / decisions worth knowing

- No "Notify me when it opens" for mock stacks (the Vault has one). Add it if students ask.
- Round ids are `mock-{stack}-r{1..3}`; the rounds' titles/descriptions come from the Vault stack's Series 1 sets, so editing a Vault stack's
  set themes also renames its mock rounds.
- A mock is a normal practice interview, so its score feeds the **AI interviews** part of the readiness score exactly as every practice interview did before (`Interview::scopeCountsTowardReadiness` excludes only hiring-partner interviews). It does not count toward the Vault AI Interview qualification (no `qualification_id`).
