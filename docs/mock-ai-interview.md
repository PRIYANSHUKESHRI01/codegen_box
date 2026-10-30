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
`config/mock_interviews.php` → `extra_roles`, merged into the catalogue after the Vault's domains (`MockInterviewCatalog::extraRoles`). It is shown in **two
places**: the Mock AI Interview page (its domain card, as ever) and its own sidebar group **Merchant Navy → Mock Orals** (`/dashboard/merchant-navy`, the same
explorer limited to this domain: card → exam → sets). A set opened from the Merchant Navy page carries `?from=merchant-navy`, so the briefing, the room and the way
out stay in that section.

- **Exams:** **Second Mate (FG) Orals** and **Chief Mate (FG) Orals** (both live), **Master (FG)** (Coming soon, 10 placeholder sets; it opens by itself once
  staff load 5 questions in a set). The UI says "exam" and "set" for this domain (`terms`).
- **Chief Mate (FG) Orals:** **20 sets × 30 = 600 questions**, the same shape (10 + 10 + 10 of Functions 1–3) and the same study mode. Built by
  `database/seeders/data/build_chief_mate.py` from `content/merchant-navy/Chief_Mate_Oral_Exams.docx` (200 + 200 + 200; a different layout from the Second
  Mate document: Function 1 has the answer in the paragraphs after a bold "N. question", Functions 2–3 have "Qn. question answer" in one paragraph; Word
  equations are read as real maths). **Nothing was written by AptRun** to fill sets, so none is flagged AI-written. 14 one-word questions ("What is SOPEP?")
  are reworded to a full question (the `SPOKEN` table) because staff tools need 15+ characters and a bare acronym is hard to hear; a few typing leftovers in the
  document (LaTeX in one answer, "Heightofeye") are tidied in `tidy()`. Edit the document and re-run the script, never the generated file.
- **Same words, different answer:** 24 questions are worded identically in both banks with different model answers. A study question's bank row is therefore
  keyed on its text **and** its answer (`CuratedInterviewSetService::createInterviewFromTarget`), so neither exam shows the other's answer. Side effect: when staff
  correct an answer, the next sitting gets a new bank row; the row earlier sittings were marked against is left as it was.
- **Rule of the Road (ROR) Cards** (`ror_cards`, live, its own card beside the exams): the oral's *picture cards*. In the MMD oral the examiner hands over a card — a
  drawing of a situation at sea, usually the lights of another vessel at night — and asks what the vessel is, which Rule applies and what the candidate does.
  Candidates report **about ten cards in a sitting** (anecdotal: no official count was found; it varies by examiner and centre), so a set is ~10 cards:
  **10 sets, 102 cards, 231 questions** (2–3 per card; 21–27 questions and 10–11 cards per set). Built by `build_ror_cards.py` from
  `content/merchant-navy/ROR_Cards_Pictorial_QA.docx` (Part A power-driven v power-driven 28 cards, Part B special vessels and positions 68, Part C sailing 6).
  - **A card is a picture + its questions, in a row.** The first question carries the whole situation in words ("Night, open sea. A vessel (orange) is 30 degrees on
    your starboard bow, range 4 nautical miles… Identify the vessel from the lights shown…"); the next two are bare ("What are your Rule, role and action?") and rely on the
    picture. The set is always asked whole and in order (`questions_per_interview` 40 is above the biggest set, so nothing is sampled and a card is never split).
  - **The picture** is a 360×180 PNG per card in `frontend/public/ror-cards/card-NNN.png` (copied from the .docx by the script), named by a new nullable `image` column
    on `mock_interview_questions` and on `interview_question_banks`. The room shows it above the transcript (`CardFigure`, tap to enlarge; a 160 px thumbnail on phones)
    through the question and its feedback, and the summary shows it again. Its alt text never says what the vessel is.
  - **Dealing the cards into sets:** the document lists them family by family (four head-on, four trawler…), which would put four look-alike questions in one set. No set
    holds two cards of one family or one picture; each set gets a share of each Part; order inside a set is shuffled with a fixed seed. A card's heading ("Trawler making way
    (1/4)") is the answer to "what vessel?", so it is only the staff-only `topic`, never in a question.
  - **Marking pictures:** same text matcher, plus two things for questions with a picture (`AnswerMatcher::match(..., picture: true)`). (1) *Colours and sides*: naming a colour/side
    the model answer lacks while leaving out one it has ("green sidelight" for "red") is capped at 60 like a wrong figure and the key point shows as only partly covered
    (`answer_match.picture_terms`). (2) *Distinctive words weigh more* (`PictureVocabulary`): the answers share most of their words from card to card, so a word in nearly
    every answer is worth ~0.4× and a rare one ("trawling", "aground") up to 2.2×. Measured on the real bank: naming the *wrong vessel* but describing the aspect rightly
    went from avg 58% (14% green) to avg 51% (4.6% green). It still cannot see meaning: "white over green" for "green over white" matches.
  - **Staff:** a picture question shows a **Picture** badge; text and answer are editable (the picture is kept), the picture itself is loaded with the cards, not edited. The
    duplicate check is per text *and* picture. Spreadsheet import has no picture column.
  - **Not verified:** nobody has checked the cards' content (the document says they are "drawn practice cards… not copies of the official MMD cards"). The drawings are crude
    (e.g. the day-time sailing cards, a vessel aground shows one anchor light). A master mariner must check them, and a designer may want to redraw them as vectors.
- **Sets of 30:** Second Mate (FG) Orals is **23 sets, each 10 questions of Function 1, then 10 of Function 2, then 10 of Function 3**, in that order
  (`build_merchant_navy.py`; `sets` / `set_description` / `study_mode` on the stack). Nothing function-wise is shown to students. A sitting is the whole set.
  Every set spans 26–29 of the 32 syllabus topics (a function's questions are ordered so each topic is spread evenly over the sets).
- **Where the 690 questions come from:** 626 from the Merchant Navy team's document (`content/merchant-navy/…docx`: 200 / 200 / 226) + **64 written by AptRun**
  (`merchant_navy_generated.json`: 30 Function 1, 30 Function 2, 4 Function 3) because 23 sets of 10 need 230 of each. The 64 are `origin = generated`, always
  `needs_review`, spread evenly over the sets (0–6 per set; staggered per topic so they do not bunch), shown to staff as **AI-written**, and to students as "this
  model answer is still being checked". **Nobody outside AptRun has checked their content, or the document's.** A master mariner must.

### Study mode: no AI scores anything

`study_mode` on the stack makes every sitting a **study interview** (`practice_config.study`, `Interview::isStudyMode()`):

- After each answer is submitted the screen keeps the student's transcript and shows, beneath it, a **match line** (red 0–29, yellow 30–69, green 70–100;
  `config/answer_match.php`), the **model answer** with each key point marked covered / partly / left out, and **Next question** (also Enter). The last one says
  **Finish set**. Study sets are never marked by Gemini: `InterviewController::answer` records the match, `StudyFeedbackService::finalize` finishes the session with the
  average (the same finalizer every standalone interview uses), `ScoreInterviewSessionJob` and the sweeper route a study session there too, never to an AI.
  The end-of-set summary (`StudySummary`) shows the average, strong / partial / weak counts and every question to revise from (weakest first on request).
- **The matcher** (`App\Services\Answers\AnswerMatcher`, `AnswerText`): plain PHP, no network, deterministic. Both texts become meaningful stems (number words → digits,
  spellings and a few near-synonyms unified, little words dropped, endings stemmed); the model answer is cut into key points at its commas / semicolons / colons /
  sentence ends; each word is worth what it is worth (figure 2.5, technical term 0.9–1.4, a word every answer uses 0.3) and is found if said (or close: a prefix, or one
  letter off for 5+ letters), **each spoken word used once**; the match is the weighted share of the model answer found (recall). A confident **wrong figure** ("60
  seconds" for "28") caps the match at 60 and a key point holding a missing figure is never "covered". Measured on the real bank: all 690 model answers match
  themselves 100%; unrelated answers average 2% (p99 18%, never green); realistic spoken answers land in the expected band.
- **What it cannot do:** it sees words and figures, not meaning. Right words used the wrong way round ("alter to port, pass starboard to starboard") can still match
  fairly well. The screen says so; it is a study aid that shows the model answer, not a marker.
- **No limit on study sets.** A study set is not rationed: no free-plan try, no daily limit, any number of sets and re-attempts, for every plan. It does not use up
  the allowance for ordinary mock interviews either, and does not appear in the "used today" count. One definition, `Interview::scopeUsesMockAllowance` (read by
  `PlanGate`, the free-try count and `SubscriptionPresenter`); the checks are skipped for study interviews in `MockInterviewService::start`,
  `InterviewController::start` and `reattempt`. The Merchant Navy page carries no usage counter or trial banner. Ordinary mock interviews are limited exactly as before.
- **Proctoring is unchanged** (camera, fullscreen, strikes): a policy decision left alone.
  The interviewer's *voice* still calls the speech service to read the question aloud, as in every interview; no answer or scoring prompt ever leaves the server.
- **Readiness:** Merchant Navy sittings do not count toward the placement-readiness score (`Interview::scopeCountsTowardReadiness`), and the page says so.
- **Staff:** model answers are the `note`; `needs_review` / `topic` / `origin` per question; the import accepts `topic`, `review` and `set` columns.

**Loading / rebuilding the bank**

    python backend/database/seeders/data/build_merchant_navy.py content/merchant-navy/Second_Mate_Orals_Functions_1_2_3.docx backend/database/seeders/data/mock_questions/merchant_navy_mock.php
    php artisan db:seed --class=MerchantNavyMockQuestionsSeeder

Idempotent (stack + set + position); touches only the Merchant Navy stack. To change the number of sets change `sets` in the config **and** `SETS` in the builder.
Migrations `…_clear_function_wise_merchant_navy_bank` and `…_clear_25_set_merchant_navy_layout` remove the earlier layouts from a database that still has them
(they act only when they see the old shape). Run `migrate` **before** the seeder.

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

### Reports and score history (Merchant Navy study sets)

After every set the student can **download a PDF report**, and the score of **every sitting of every set is kept**.

- **Why a ledger:** "Practise this set again" resets the same interview and deletes its answers, and staff can edit the bank later, so neither can answer "what did I
  score on Set 4 last month?". Every FINISHED sitting is therefore written to `study_attempts` (`StudyAttemptRecorder`, called from `StudyFeedbackService::finalize`):
  score, counts by band, time taken, and a **snapshot** of each question (text, ROR picture, topic, the student's answer, the model answer, the match, what was left
  out). An old report is the same report however the set or the bank has changed. `interview_id` is deliberately not a foreign key, so purging an interview never
  deletes a student's history. A sitting is recorded once (unique on interview + completion time). A set left early is recorded as **partial** (answered < total; its
  score is the average of what was answered); one left with no answer at all is not recorded.
- **API (own data only; another student's attempt is a 404):** `GET /study-attempts` (every exam and set: attempts, best, last, previous, delta, per-sitting history;
  `average_latest` = mean of each set's latest score) and `GET /study-attempts/{id}` (the full report + `standing`: sitting number, previous score, delta, best,
  `is_personal_best`, history). `GET /interviews/{slug}/result` now carries `attempt` (the standing) for study sets, and records a sitting lazily if it predates the ledger.
  The catalogue's per-set `my` gained `last_score` / `previous_score`, and counts sittings from the ledger.
- **The report** is made in the browser (`lib/studyReportPdf.ts`, jsPDF, loaded only when the button is pressed) from `GET /study-attempts/{id}`: score and band, answered /
  strong-partial-weak counts, time, the move against the previous sitting, the student's sittings of that set, the three weakest topics, then every question with its ROR
  card (drawn once per card), "what you said", the model answer and "to revise", and a footer saying it is not AI-marked. Symbols the PDF font cannot print (≥ ≤ √ ∘
  raised digits) are put into plain characters (`pdfText`).
- **Where it shows:** the summary after a set (history card with the trend, "Download report", "All my reports"), the set card on the sets page ("Last 72% ▲8"), and a new
  page **Merchant Navy → My Reports** (`/dashboard/merchant-navy/reports`: totals, each exam and set with a score trend, every sitting with its own download).
- **Sittings from before this existed:** `php artisan study:backfill-attempts` records the finished ones (only a set's latest sitting can be recovered if it was reset since);
  the result page also records one lazily when a student opens it.
- **Not done:** no report e-mail; no comparison with other students; no TPO view of a student's sittings (it is the student's own record).

## Deploy

1. `php artisan migrate` — `mock_interview_questions`, then the Merchant Navy ones: `…_add_topic_and_review…`, `…_clear_function_wise…`, `…_add_study_mode_columns` (origin, reference_unverified, match_details) `…_clear_25_set…` `…_add_image_to_mock_and_bank_questions` (the ROR cards' pictures; nullable, nothing existing changes) and `…_create_study_attempts_table` (the score history and reports).
2. `php artisan route:cache` (new routes: `GET /mock-interviews/catalog`, `POST /mock-interviews/rounds/{id}/start`, `/admin/mock-interview-bank/*`, `GET /study-attempts`, `GET /study-attempts/{id}`).
3. `php artisan db:seed --class=MerchantNavyMockQuestionsSeeder` — loads the Second Mate orals (690 questions in 23 sets of 30) the Chief Mate orals (600 in 20 sets of 30) and the ROR picture cards (231 in 10 sets). **Migrate first** (the seeder writes the `image` column). If config is cached: `php artisan config:cache`.
4. Frontend build — it must include `frontend/public/ror-cards/` (102 PNGs; the static export copies `public/`). A deployed backend with the cards seeded and an old frontend shows broken pictures.
5. `php artisan study:backfill-attempts` once, after migrating, to bring sittings finished before the ledger into the score history.
6. No env changes needed (the studio is off by default; `GEMINI_API_KEY` is the existing scorer's).

Before `migrate` the catalog fails soft: every stack shows Coming soon and the staff screen reports an error until the table exists.

## Not done / decisions worth knowing

- No "Notify me when it opens" for mock stacks (the Vault has one). Add it if students ask.
- Round ids are `mock-{stack}-r{1..3}`; the rounds' titles/descriptions come from the Vault stack's Series 1 sets, so editing a Vault stack's
  set themes also renames its mock rounds.
- A mock is a normal practice interview, so its score feeds the **AI interviews** part of the readiness score exactly as every practice interview did before (`Interview::scopeCountsTowardReadiness` excludes only hiring-partner interviews). It does not count toward the Vault AI Interview qualification (no `qualification_id`).
