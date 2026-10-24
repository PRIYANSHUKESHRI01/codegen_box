# Core Prep — how to prepare question banks

For the people writing or commissioning the ECE, EEE, Mechanical and Civil question banks. You do not need a developer:
download the template, fill it in, upload it in **Mellow Ops → Core Prep → Import**.

AptRun ships with the engine, the subject/topic structure for each branch (aligned to the GATE syllabi) and the importer.
It also ships a **starter bank** per branch in `content/core-prep/*.json` (see its README for what it is and is not). Nothing reaches a student until
questions are published and a superadmin switches that branch live (or pilots it at chosen colleges).

## 1. The file

Download the template from **Core Prep → Import → Template** (an `.xlsx`, or a plain `.csv`; one branch or all four).
It has three sheets:

| Sheet | What it is |
|---|---|
| **Questions** | One row per question. Two worked examples are pre-filled — delete them. |
| **Subjects & topics** | The exact subject and topic codes you may use. Copy from here; do not invent. |
| **Guide** | One line on every column. |

Accepted: `.xlsx`, `.csv`, or `.json` (an array of objects with the same column names). Up to 20,000 rows and 10 MB per file.
Figures go in a `.zip` uploaded with the file (PNG, JPG or WebP, ≤ 2 MB each); the `image` column names the file inside it.

## 2. The columns

| Column | Required | Notes |
|---|:-:|---|
| `external_id` | recommended | **Your** unique id, e.g. `ECE-ANA-0001`. Uploading the same id again **updates** the question instead of duplicating it — so you can fix a file and re-upload safely. |
| `discipline` | yes | `ece`, `eee`, `mech` or `civil`. |
| `subject` | yes | Subject code or name from the *Subjects & topics* sheet. |
| `topic` | no | Topic code or name inside that subject. Fill it in — practice, mastery and the readiness score are all measured per topic. |
| `type` | yes | `mcq_single` (one correct option) · `mcq_multi` (one or more correct) · `numeric` (answer is a number). |
| `difficulty` | yes | `easy` · `medium` · `hard`. |
| `usage` | no | `practice` (shown with the answer after each try) · `test` (only inside timed tests) · `both`. Keep tough or reused test questions as `test` so practice never reveals them. Default `both`. |
| `marks` | no | 0.25 – 10. Default 1. |
| `negative_marks` | no | Marks lost for a wrong answer, e.g. `0.33` for a 1-mark question (GATE style). Default 0. Numeric questions are never penalised for a blank. |
| `question` | yes | Markdown. Mathematics in LaTeX: inline `$V = IR$`, display `$$\int_0^1 x^2\,dx$$`. |
| `option_a` … `option_f` | MCQ | Two to six options. Leave unused ones empty. |
| `correct` | MCQ | `B`, or `A,C` for multi-select. Empty for numeric. |
| `numeric_min` / `numeric_max` | numeric | The accepted range, e.g. `3.14` and `3.15`. For one exact value fill only `numeric_min`. |
| `unit` | no | Shown beside a numeric answer: `V`, `kW`, `MPa`. |
| `explanation` | **yes** for `practice`/`both` | The worked solution, shown after answering. Maths supported. |
| `tags`, `companies` | no | Separated by `;` — `GATE;PSU`, `L&T;Tata Motors`. |
| `source` | no | `Original`, `GATE 2019`… |
| `image` | no | File name inside the ZIP. |
| `status` | no | `draft` (default) · `in_review` · `published`. |

### How answers are judged

* **Single:** the one option must match.
* **Multi-select:** the student must pick **all and only** the correct options. No partial credit; a wrong set is wrong.
* **Numeric:** correct if the value lies within `numeric_min`…`numeric_max` (inclusive). Choose the range to allow honest rounding —
  an answer of `3.14159` with range `3.14`–`3.15` accepts 3.14, 3.142, 3.15.
* **Negative marking** applies to a wrong answer, not to a skipped one.

## 3. The dry run

Every upload is **checked first and nothing is saved** (the *dry run*). You get a row-by-row report:

* unknown subject or topic · a `correct` letter that is not one of the options · a numeric range with min > max
* a missing explanation on a practice question · fewer than two options · a duplicate `external_id` inside the file
* an image named in the sheet but absent from the ZIP

Fix the file and re-run until it is clean, then **Import**. A row that fails is never imported, whatever its `status`.
Big files are processed in the background; you can leave the page.

**Re-uploading a corrected file.** Rows are matched by `external_id`, so a corrected row updates its question. If students have
already answered that question, its **answer key is locked** and a row that would change the key is refused with a message pointing you to
*Fix answer key* — an upload can never silently re-key a question that has been scored. An upload also never un-publishes anything.
(If a second reviewer is required in `config/core_prep.php`, a row asking for `published` is imported as *in review* instead.)

## 4. Review, publish, go live

1. Imported rows land as **draft** (or whatever `status` you set — but a person should read them first).
2. **Questions** tab: open any question to see exactly what a student sees (the live preview renders the maths), edit it, then
   *Send to review* → *Publish*. Several can be moved at once.
3. **Coverage & go-live** tab shows published questions per branch × subject × difficulty. Red cells are where there are too few
   to build tests from. A superadmin can switch a branch **live** once it has at least **150** published test-usable questions
   across **4** subjects with **15+** each (the numbers are in `config/core_prep.php`; the superadmin can override knowingly).
4. Until then students of that branch simply do not see Core Prep — never an empty screen.

### After students answer

* A question that any student has answered is **key-locked**: its options and answer cannot be changed silently, so nobody is
  scored against two different keys. Typos in wording can still be fixed.
* To correct a wrong key use **Fix answer key**: you give a reason, it is audited, and every affected practice answer and finished
  test is **regraded** automatically.
* Students can *Report an issue* on any question; reports arrive in **Core Prep → Student reports**.
* Each night **item analysis** flags questions that are too easy/hard, barely tell strong from weak students apart, or look mis-keyed
  (the stronger students keep choosing a different option). Use **Questions → Flagged by analysis**. A flag is a prompt, never a verdict.

## 5. What makes a good bank

* **Aim for 150+ per branch to open, 500+ to be convincing**, spread across subjects roughly as the GATE paper weights them.
* A mix of `easy` : `medium` : `hard` around 3 : 4 : 3; hard ones are what separate students.
* Every practice question needs a *worked* explanation — that is most of the learning.
* Original questions, or ones you hold the rights to. Do not paste from copyrighted books or question banks.
* Put figures in the ZIP, not in the text; describe them in the question as well for screen readers.

## 6. Optional: AI first drafts

If a developer sets `CORE_AI_DRAFTS=true` (and `GEMINI_API_KEY` is configured), **Questions → Draft with AI** writes first drafts for a
subject/topic you choose. They are saved as **drafts labelled “AI draft”** and must be read and corrected by a person before publishing —
an AI-written answer key can be confidently wrong. It is off by default for that reason.
