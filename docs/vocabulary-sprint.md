# Vocabulary Sprint — how it works and how to ship it

Learning Centre → Vocabulary Sprint. A curated library of **160 interview and workplace words** in 8 decks, learned
through short daily sprints and **spaced repetition**: each word comes back just before the student would forget it.
A separate "quick quiz on any topic" uses Gemini; everything else is deterministic and costs no AI call.

## What a student gets

* **Daily sprint** (about 12 questions, ~3 min): the words that are *due* for review, oldest first, plus 2–4 *new*
  words. A big review backlog means fewer new words, so a week off never buries anyone.
* **Meet the word**: each new word is introduced first (hear it, meaning, example sentence, synonyms, usage tip), then
  asked twice in the session from different angles.
* **Questions get harder as a word gets stronger**: meaning → pick the word for a meaning → fill the sentence blank →
  **type it from memory** (spelling counts; a one-letter slip is called a near miss).
* **Instant feedback** after every answer, with the word card and what the answer did to the word's memory.
* **Decks, word bank, weak words**: pick a deck, browse/search every word with its status, or drill the words they keep
  missing. Missed words can be re-practised straight from the summary.
* **Habit**: daily goal (10 answers), streak, 7-day accuracy, word of the day. Progress is saved per answer; a reload or
  "Save & exit" resumes exactly where they left off.

## Spaced repetition (`App\Services\VocabularySrsService`)

Six Leitner boxes, scheduled by calendar day.

| Box | 0 | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|---|
| Comes back after | today | 1 day | 3 days | 7 days | 16 days | 35 days |
| Status shown | learning | learning | familiar | familiar | **mastered** | **mastered** |

* A correct answer moves a word up one box **only if it was due** (or new). Practising early counts toward accuracy
  but can't rush a word up.
* A wrong answer drops it two boxes (never below 0) and makes it due **today**.
* The second question about a new word in the same session (an *echo*) never moves the box; a miss just brings the word
  back today.
* "Words mastered" = box 4+, computed from the real per-word boxes, never from a counter.
* Weak word = answered at least twice with under 60% right, or knocked back by a lapse and not yet recovered.

## Data

| Table | Holds |
|---|---|
| `vocabulary_words` | the library (`user_id` null, `source` library) **and** private words a student picked up from their own AI quizzes (`source` ai) |
| `vocabulary_word_progress` | one row per student per word: box, streak, counts, `due_on`, `mastered_at` |
| `vocabulary_answers` | append-only log of every answered question; unique per (attempt, question); feeds daily goal, streak, accuracy |
| `vocabulary_attempts` | one practice session. `kind` = daily / deck / weak / custom (AI quiz); `questions` holds the **full answer key** |

The answer key never reaches the browser early: `VocabularyAttempt::publicQuestion()` is a whitelist, and a question's
answer is only revealed after the student commits an answer (`POST …/answer`). The word is shown only for the meaning
question (where it *is* the question). The old AI quiz payload leaked the word before submit; that is closed.

## Endpoints (student, `auth:sanctum`)

| | |
|---|---|
| `GET  /learning-centre/vocabulary/overview` | totals, today's goal/streak, next-sprint preview, resume, word of the day, decks |
| `GET  /learning-centre/vocabulary/words?status=&deck=&q=&page=` | the word bank (`deck=mine` = saved quiz words) |
| `POST /learning-centre/vocabulary/sessions` `{kind: daily|deck|weak, deck?, from_attempt?}` | start (or resume) a session — **no AI call** |
| `GET  /learning-centre/vocabulary/attempts/{id}` | pick a session back up |
| `POST /learning-centre/vocabulary/attempts/{id}/answer` `{index, answer, response_ms?}` | commit one answer; idempotent |
| `POST /learning-centre/vocabulary/generate` `{topic, difficulty}` | AI quiz — **counts toward the daily AI limit** (only `kind=custom` does) |
| `POST /learning-centre/vocabulary/attempts/{id}/submit` | the original all-at-once grading, kept so an older deployed frontend keeps working |

## AI quiz

`App\Services\GeminiVocabularyQuizService`. The topic is cleaned and fenced as data in the prompt; the model's output
is never trusted: the correct answer is taken from the option **text** that equals the word (not the model's index),
items without exactly one blank, four distinct options, or a repeated word are dropped, and options are re-shuffled
server-side. Words from the student's recent quizzes are excluded from the prompt. A word the student **misses** is
saved as one of their private words (max 300) and enters their review schedule; a word that is also in the library
reuses that word's memory instead.

## Shipping it

```bash
php artisan migrate        # 2026_10_09_100000_upgrade_vocabulary_sprint_word_bank_and_spaced_repetition (additive)
php artisan db:seed --class=VocabularyWordSeeder     # safe to re-run: updates in place, never touches progress
```

Without the seeder the page shows "The word library is on its way" and nothing breaks. Gemini free-tier keys will
rate-limit the AI quiz; a paid tier is needed at any real volume.

## Adding or editing words

Words live in `database/seeders/VocabularyWordBank.php` (one method per deck, 20 words each) and
`App\Support\VocabularyDecks` defines the decks and their order. Re-run the seeder after editing; a word removed from the
bank is switched off, not deleted, so student progress stays valid.

`tests/Unit/VocabularyWordBankTest.php` enforces the rules a machine can check, so a bad entry fails the build and names
the word: the example must contain the headword exactly once; the meaning must not contain the word or its stem; three
distinct wrong answers that are not synonyms; no synonym that is itself a headword; the `a`/`an` before a blank must not
rule out any option; look-alike partners must be mutual; and no two meanings may be near-identical. What it can't check
is whether each wrong answer is *definitely* wrong in its sentence — read new cloze sentences with that in mind.

## Known limits

* "Today" (daily goal, streak, due dates) follows the app timezone, which is UTC, so for students in India it rolls
  over at 05:30 IST. Same as the rest of the Learning Centre.
* Pronunciation uses the browser's own voices; quality varies by device.
* Not yet wired into the readiness score or TPO reports.
