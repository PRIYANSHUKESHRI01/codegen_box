# Vault AI Interview — every Mellow Vault domain

The Vault AI Interview is the last step to a Mellow Vault listing: a student picks a **role → stack**, sits **3 sets**
(one series), and needs a **60 % average**; fail and the next series (up to 3) opens; three fails = 45-day cooldown.
Until 2026-11-07 only 5 roles / 12 stacks existed. **Every domain on Mellow Vault's "Development & IT" list now has a
place** — 13 roles, 41 stacks, 369 sets — but only the original 12 stacks have questions. The rest are *coming soon*
until staff add questions, and then they open **by themselves**.

## What a student sees

- **Step 1 – Domain.** 13 role cards, each with how many of its stacks are open; an *All roles / Open now* switch.
- **Step 2 – Track.** Open stacks as before; a stack with no questions shows **Coming soon**.
- **Step 3 – Coming-soon track.** A plain "being prepared" panel, the **syllabus** (what each of the 3 rounds
  assesses, so they can already prepare), the Mellow Vault domain names it covers, and **Notify me when it opens**
  (tap again to undo). Nothing can be started; nothing is created by looking.
- **Search** is by stack: name, role, the Mellow Vault domain it covers ("SQL Developer", "AI/ML", "NLTK"), tags, what the
  sets cover. Open tracks are listed first.

When the last missing set gets its questions, the stack opens and every student still waiting gets an in-app
notification (once). A student asking about a stack that is already open is told to just start it.

## The catalog

| Source | Holds |
|---|---|
| `config/curated_interview_sets.php` | the 5 roles / 12 stacks with every question written out (untouched) |
| `config/curated_interview_domains.php` | every other domain as an **empty shell**: role, stack, and the three rounds it is assessed on; plus the Mellow Vault domain labels each stack covers |
| table `curated_set_questions` | questions staff add (Admin → Vault → *Vault AI questions*) |

`App\Services\Vault\CuratedCatalog` merges the three into one tree (role → stack → 3 series → 3 sets → questions);
everything reads it from there. A set is **ready** at `min_questions_per_set` (5, the number the written sets have);
a stack is **live** only when **all 9** sets are ready — a student who fails Series 1 is moved to Series 2, so a
half-written stack would strand them. Set ids follow the existing scheme (`data_analyst-sql-s1-set2`).

### Mellow Vault domain → stack

| Mellow Vault domain | Stack | Role |
|---|---|---|
| Laravel Developer | `laravel` | Backend |
| PHP Developer · CMS Developer · API | `php` · `cms` · `api_design` | Backend |
| Python Developer | `python` | Backend |
| Web Developer · Angular Developer · UI/UX Design | `web_fundamentals` · `angular` · `ui_ux` | Frontend |
| MERN Developer · E-Commerce | `mern` · `ecommerce` | Full Stack |
| AI/ML · ML/DL | `machine_learning` | AI & ML |
| Deep Learning | `deeplearning_pytorch` | AI & ML |
| NLT (Natural Language Toolkit) · Natural Language Processing (NLP) | `nlp` | AI & ML |
| AI and Robotics | `robotics` | AI & ML |
| Docker · Cloud Computing · Cloud Infrastructure | `docker_k8s` · `cloud_computing` · `cloud_infrastructure` | DevOps & Cloud |
| Data Analytics · SQL Developer · Power BI | `data_analytics` · `sql` · `power_bi` | **Data Analyst** (new) |
| Data Science · Data Mining · Data Engineering | `data_science` · `data_mining` · `data_engineering` | **Data Science & Engineering** (new) |
| Cyber Security · Ethical Hacking · Cryptography | `cyber_security` · `ethical_hacking` · `cryptography` | **Cyber Security** (new) |
| Software Testing | `software_testing` | **Software Testing** (new) |
| Embedded System · C++ Developer | `embedded_systems` · `cpp` | **Embedded & Systems** (new) |
| Games Developer | `game_development` | **Game Development** (new) |
| BlockChain · Quantum Computing | `blockchain` · `quantum_computing` | **Blockchain & Quantum** (new) |
| Digital Marketing · SEO Specialist | `digital_marketing` · `seo` | **Digital Marketing & SEO** (new) |

A test (`VaultAiDomainCatalogTest`) holds the exact 36 labels from the Mellow Vault list and fails if one has no stack.

The three rounds of each new stack follow how that role is really screened (researched 2026-11-07): analysts —
Excel/SQL → statistics & visualisation → case study; QA — test design → automation & API → strategy; security —
fundamentals & networks → web security & detection → incident response; embedded — C & microcontrollers →
interrupts, protocols & RTOS → reliability & debugging; marketing — channels & funnel → campaigns & analytics →
attribution & budget; and so on. Every stack has its own wording in `curated_interview_domains.php`.

## Adding questions (staff)

**Admin → Vault → Vault AI questions** (needs the Vault permission).

- **Overview:** every stack with a 3 × 3 map of its sets (green = enough, amber = some, grey = none), how many
  students are waiting for it, open / coming-soon filter, search. Start with the stack that has the most waiting.
- **One stack:** all 9 sets with their themes and questions; add / edit / remove a question (text, category, time to
  answer, and **"what a strong answer covers"** — the rubric the AI scorer is given). Hand-written questions are shown
  read-only. The same question can't be in a set twice.
- **Spreadsheet import:** *Excel template* → one row per question (`stack, series, set, question, category, seconds,
  note`; a *Stacks* sheet lists the exact keys, a *Guide* sheet the rules) → *Import*. Valid rows are added; a bad row
  is reported by line number and skipped; a question already in its set is skipped, so **uploading a corrected file
  again is safe**. ≤ 2 MB / 3000 rows per upload; `.xlsx` or `.csv`.
- **A stack that is open can't be taken below 5 per set** by a deletion (a student may be mid-attempt) — add a
  replacement first.
- Everything is in the Audit Log (added / edited / removed / imported).

Roughly **45 questions** (9 sets × 5) open a stack; more are fine (a series of 5-6 questions is ~15 min).

## Rules the server enforces

- A coming-soon stack: `status` returns `stack_live: false` (no qualification row is created), `start-set` is 409
  *"not open yet"*, the generic `POST /curated-interview-sets/{id}/start` is 409 for a set without questions, and an
  interview with no questions can never be created.
- `POST/DELETE /vault-qualification/interest` — students only; refused (422) for a stack that is already open.
- A server that has not run the migration yet still serves the catalog (the staff-question and interest lookups
  degrade to "none") — only the new admin/interest endpoints need it.

## Deploy

`php artisan migrate` (creates `curated_set_questions`, `vault_stack_interests`) → `php artisan route:cache`
(+ `config:cache` for the new config file). Nothing changes for the 12 existing stacks or for students already
qualified. No questions are shipped: until staff add them, every new domain is *Coming soon*.

## Not done

- Questions themselves (by design — "we will add them later"); no AI-drafted starter questions.
- A student's *Vault* profile still labels a stack from its key (`data_analytics` → "data analytics"); the admin
  qualifier list and filter use the real names.
- **Mellow Vault is not told which domain a student qualified in.** The listing that leaves AptRun
  (`VaultPayloadBuilder`) has never carried the AI-interview stack / role / score — only readiness, skills, etc. —
  so a Data Analyst who qualifies reaches Mellow Vault the same as a Laravel developer, and nothing breaks. Sending the
  domain would be useful to the hiring side, but it changes what the student consents to share (the consent screen
  lists the fields, `StudentVaultController::SHARED_FIELDS`) and Mellow Vault's contract, so I did not do it unasked.
- No reordering of questions inside a set (they run in the order added).
