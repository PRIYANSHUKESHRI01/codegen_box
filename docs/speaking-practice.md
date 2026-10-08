# Speaking Practice — how it works and how to ship it

Learning Centre → Speaking Practice. A student reads a passage aloud and is coached on **clarity, fluency and
accuracy**, the way an interviewer will hear them. They can read from the shared library or have AI write a
passage about **their own topic** (a project, an interview question, a client call) at their level.

## Scoring (audio-first)

The recording is the only input that counts. The browser's live speech-to-text is a caption only — it is never sent
to the model and never trusted (it is client-supplied, it silently "auto-corrects" mispronounced words, and
Firefox/Safari don't have it at all).

| Part | Who computes it | Why |
|---|---|---|
| Transcript of what was *actually said*, clarity, fluency, fillers, pauses, coaching text | Gemini, from the audio | needs ears |
| **Accuracy** — word-level alignment of what was heard vs the passage | server (`App\Support\SpeechAlignment`) | arithmetic: same recording ⇒ same number, and it powers the word-by-word view |
| **Pace** (words/min) and its fluency penalty | server | arithmetic |
| **Overall** = `0.35·accuracy + 0.35·clarity + 0.30·fluency`, scaled down when accuracy < 85 | server | explainable; reading the wrong/half passage can't pass on clarity alone |
| "Worth a second listen" pronunciation hints | second, passage-aware Gemini call | catches words the transcriber auto-corrects; **never changes a score** |

Pass mark: overall ≥ 60 (`SpeakingAttempt::PASS_THRESHOLD`).

Design rules that came out of live testing against real audio:

* **The scoring prompt must not contain the passage.** With the passage in the prompt, Gemini "transcribed" the
  passage out of a silent recording and scored it 96%. Passage-free, silence and white noise were rejected
  12 / 12 times and the wrong passage scored 5%.
* A muted mic is also caught in the browser (`voicedMs`) so it never costs a request.
* Recordings are processed in memory and **never stored**. Old rows from before this change can be cleaned with
  `php artisan speaking:purge-audio` (`--dry-run` first).

## Passage generation

`POST /api/learning-centre/speaking/prompts/generate` `{topic, difficulty, purpose}` →
`App\Services\GeminiSpeakingPassageService`. The topic is untrusted (stripped of markup/control characters, ≤ 80
chars, fenced as subject-matter-only in the prompt); the output is validated (no links/markup/digits, 40–160
words, ends like a sentence) before it is stored. Generated passages are **private** to the student
(`speaking_prompts.user_id`), counted toward the daily Learning Centre AI limit, and archived (not deleted) beyond
30 per student.

## Before this goes to real students — launch checklist

1. **Use a paid Gemini API tier.** The key used in development is on the *free tier*: 15 requests/minute for the
   whole project (every module shares it — AI interviews, question generation, vocabulary, speaking) and Google
   may use free-tier content to improve its products. A single speaking attempt is 2 requests. Student voice
   recordings must not go through the free tier. If quota is tight, set `GEMINI_SPEAKING_PRONUNCIATION_NOTES=false`.
2. `php artisan migrate` (adds `speaking_prompts.user_id/source/interest`, `speaking_attempts.heard_transcript/word_feedback/filler_count/scored_with_audio`).
3. `php artisan db:seed --class=SpeakingPromptSeeder` — adds 14 interview / workplace passages and folds the old
   categories onto four (Interview Ready, Workplace English, Tech & Career, Everyday English). Idempotent.
4. `php artisan speaking:purge-audio` — removes recordings stored by the previous implementation.
5. Rebuild the route cache (`php artisan route:clear && php artisan route:cache`) — a stale `routes-v7.php` hides
   the new `generate` route (this happened locally).
6. Update the privacy policy: voice recordings are sent to Google's Gemini API for scoring and are not retained.
7. Set a daily limit on the free plan (`plans.max_learning_centre_ai_attempts_per_day`) if cost matters — it is
   unlimited when null.

## Known limits

* Pronunciation is judged by an AI listener, not a phoneme-level engine. It reliably catches clear mistakes
  (`shower` → `shore`) and will miss subtle accent-level ones; hints are labelled as hints. If phoneme-level
  accuracy becomes a requirement, the next step is a dedicated pronunciation-assessment service (e.g. Azure
  Speech Pronunciation Assessment) behind the same `GeminiSpeakingScoringService` result shape.
* Gemini latency is 3–15 s per take (occasionally more); the request timeout is 45 s.
* Verified in Chromium with a real MediaRecorder recording. Safari records `audio/mp4` — not yet verified against
  Gemini; test on a real iPhone/Mac before promising Safari support.
* Reading aloud is pronunciation practice, not interview practice — the result screen links to AI Interviews for
  free-form answers.
