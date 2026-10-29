# The AI Interview room

*Added 2026-10-29, reworked the same day. The whole experience of every proctored AI interview — loading, setup ("lobby"), the live room, the locked screen and the result. The Mock AI Interview, the Vault AI Interview and practice interviews all share it (one engine, `InterviewSessionView`). It replaced a single card that showed the question and a mic button.*

## What a candidate goes through

One immersive world from the first frame to the result: the same backdrop (a slow drift of colour), the aptRun wordmark and the AptRun orb on every screen. **The dashboard (sidebar, header) is never drawn** around any of it.

| Step | What they see |
|---|---|
| **Briefing page** (before Start) | A full-width page, not a narrow column: the interview (title, questions / time / status, how it works in four beats, what to do before starting) on the left, and on the right **the interviewer** — the AptRun orb, *Hear your interviewer* (plays its hello in the real voice), a live **Your setup** check of this browser (voice, speech recognition, camera/mic permission, fullscreen, connection — each says what will happen, e.g. "you'll type your answers"), and the Start button, which stays in view while the page scrolls. |
| **Press Start** | The button says "Opening your interview…" at once. Then the **boot screen** — the orb breathing on the backdrop — for every moment with nothing to show yet (page load, session check, the engine starting). |
| **Lobby** (`InterviewLobby`) | The screen that used to be the shared consent page inside the dashboard. Left: the orb, "Let's get you set up, *Asha*.", their camera (mirrored, face guide) and a **live microphone meter — the orb and bars move as they speak and it says "Microphone is working"**, so a dead mic is found here, not after the first answer. Right: the system check (when the integrity layer is on), "What to expect" with the strike meter, and "what is recorded". A bottom bar with the one button that matters, honest about what is missing. "Leave" goes back. |
| **Ready** | Once proctoring is live the room opens — **and waits.** "You're all set, Asha." with the orb, a big **Begin interview** (or Enter), and four things worth knowing written where the transcript will be. *Nothing is asked until they press Begin*, however long that takes (it used to start the instant proctoring went live, while the candidate was still clicking through the consent screen). Resumed interviews say "Welcome back" and **Continue interview**. The clock starts at Begin. |
| **Begin** | A **3-2-1** drawn on the orb, then — with the real voice — the interviewer says hello ("Hi, I'm your AptRun interviewer…", written in the transcript as it is said), then question 1. |
| **Live room** | Below. |
| **Locked** | Same backdrop, same wordmark; says what happened and how to get reinstated. |
| **Result** (`InterviewComplete`) | The orb keeps thinking while the answers are scored, then the score ring draws itself in with the feedback for every question beneath it. All the old copy and re-attempt rules, unchanged. An **error** screen (`InterviewError`) has retry and a way out, since there is no sidebar any more. |

### The live room

| Where | What |
|---|---|
| **Top-left** | The aptRun wordmark, the product line ("AI Interview" / "Vault AI Interview · Series 2 · Set 1 of 3"). |
| **Top-centre** | One segment per question, filling in as they are answered, labelled with the question type. |
| **Top-right** | Time since the interview started, an **"Offline — reconnecting" chip when the connection drops**, and the proctoring strike counter. |
| **Left** | Their microphone (device name + live level meter) and their own camera, always visible. |
| **Centre** | **The AptRun orb** — it swells on every word the interviewer says, follows the candidate's own voice while they answer, spins up while an answer is being sent. A ring drains as the time for the step runs out. Under it: what is happening, the clock, and the one or two buttons that matter right now. |
| **Right** | **The live transcript, written straight onto the room — no card, no border.** It is lit as if thrown from the orb: each word arrives *out of depth* (small and out of focus, coming forward into place), the word being spoken glows, and what has been said slips back behind the live line — smaller, fainter and (from the third turn back) softly out of focus. A red **LIVE** marker sits on whichever turn is happening now (the interviewer's while they ask, the candidate's while they answer). Scroll back to re-read and everything comes forward; "Back to live" returns. |
| **Answering** | When the candidate stops, their answer becomes an editable box with the recording to replay — nothing is sent until they press Submit. Typing instead of speaking (no speech recognition, or the mic was refused) uses the same transcript; the mic strip says "Typing instead". |
| **Bottom-right** | "Having trouble?" — four plain answers. |

### Real-time, on purpose

* Live microphone check in the lobby (above).
* The transcript is live for both sides, with the LIVE marker on whoever is talking.
* **Silence hint**: after 10 s of an open mic with no sound the room says, softly, to check the mic isn't muted — long on purpose, because thinking before an answer is normal.
* **Connection chip**: the header notices the browser going offline the moment it does.
* The clock and the answer countdown.

## How it is built

```
components/dashboard/interviews/
  InterviewSessionView.tsx     the interview itself: phases, timers, network, proctoring. Builds the props below.
  room/
    InterviewBoot.tsx          the one loader for every "nothing to show yet" moment
    InterviewLobby.tsx         the pre-interview screen (replaces the shared consent page for AI interviews only)
    InterviewComplete.tsx      the result screen + the error screen
    RoomBackdrop.tsx           the shared backdrop
    ReadyBrief.tsx  CountdownDigit.tsx  timing.ts   the "ready" screen's brief, the 3-2-1 on the orb, the built-in pauses (tests shorten them)
    useMicLevel.ts             lobby mic meter ("heard you")      useRoomHealth.ts   silence watch + online status
    InterviewRoom.tsx          layout only — header, three columns, help button. Fills the viewport; only the transcript scrolls.
    AptRunOrb.tsx              Canvas 2D orb (three feathered conic-gradient blobs) + the monogram disc. Reads RoomSignal each frame.
    LiveTranscript.tsx         the borderless transcript: depth effect, LIVE marker, eased auto-scroll, "Back to live", screen-reader log
    AnimatedWords.tsx          words that fade/rise/un-blur in once; unspoken words keep their space so nothing jumps
    AnswerEditor.tsx           the editable answer (typing, and review before submit); Ctrl/⌘+Enter submits
    MicStrip.tsx  CameraTile.tsx  HelpPopover.tsx  format.ts
    roomSignal.ts              { level, pulse } shared by reference, never React state
lib/voice/
  VoiceEngine.ts               the swap seam: speak() now reports onStart/onBoundary; interim captions report {final, interim}
  browserVoiceEngine.ts        Web Speech + MediaRecorder; picks the best English voice; survives a voice that never ends
  spokenReveal.ts              keeps the transcript in step with speech (see below)
components/dashboard/interviews/briefing/
  BriefingParts.tsx            the briefing page's hero / how-it-works / before-you-start / two-column grid (used by the Mock AND Vault view pages)
  InterviewerCard.tsx          orb + "Hear your interviewer" + live "Your setup" checks + the page's Start button
  useSetupChecks.ts            what this browser can do, read off the page (nothing guessed)
lib/voice/speechAudio.ts       fetches the interviewer's clips (SpeechAudioCache) and plays them, reporting words as playback passes them
backend: config/interview_speech.php · app/Services/Speech/* (providers, manager, cache) · InterviewSpeechController · interview:warm-speech · interview:speech-sample
components/proctoring/InterviewSessionHud.tsx   `embedded` mode: only the watermark, warnings, fullscreen lock and hold layer; the room draws its own camera and strikes
components/proctoring/InterviewProctoringConsentGate.tsx, InterviewProctoringLockedScreen.tsx   now render the lobby / the on-backdrop locked screen
lib/voice/level.ts             mic level maths shared by the engine and the room
```

### The interviewer's voice

The browser's built-in voice (the robotic one) is now only the fallback. The real voice is a **neural text-to-speech model, called from the server** (the key never reaches the browser) and **cached on disk by the exact words, voice and settings**, so a question is synthesised once however many candidates hear it.

**What I found (2026-10-29).** ElevenLabs is the consistent pick for naturalness, and the one an Indian interview platform (Apna: 1.5 million AI mock interviews) runs on; micro1's Zara has been run on OpenAI TTS and on Cartesia; Cartesia wins on latency; OpenAI `gpt-4o-mini-tts` is steerable and cheap; Google's Gemini TTS has 30 prebuilt voices. Nobody publishes which single voice they use, so the decision rests on what can run today.

**What is wired** (`config/interview_speech.php`, `app/Services/Speech/*`): `INTERVIEW_SPEECH_DRIVER=auto` picks the best provider that has a key — **ElevenLabs** (`ELEVENLABS_API_KEY`) > **OpenAI** (`OPENAI_API_KEY`) > **Gemini** (`GEMINI_API_KEY`, which AI interview scoring already uses, so it is the voice out of the box: model `gemini-3.8-flash-tts`, voice `Sulafat` — "warm"). No key = the browser voice, exactly as before.

* `GET /interviews/{slug}/questions/{id}/speech` serves a question's audio — **only the one the candidate is on or has answered** (a later one would let anyone hear the whole interview first), never free text; `GET /interviews-speech/lines/{greeting|welcome_back}` the two fixed lines. `503 speech_unavailable` is a normal answer: the page reads the question in the browser voice and the candidate never sees a failure.
* **Ready before it is needed.** Synthesis takes ~4 s, so it never happens while someone waits: the page fetches question 1 and the greeting while the candidate is on the Ready screen; the server makes the *next* question's audio in the background (after the response) each time one is served; and `php artisan interview:warm-speech` pre-generates the whole bank.
* **Style is chosen by voice, never by prompt.** Measured against the live API: text put in front of a Gemini request ("Say warmly: …") is read aloud (a 7 s question came back at 12.6 s). OpenAI takes its delivery notes in a separate `instructions` field.
* **Rate limits.** The Gemini key in `.env` is on a low TTS tier: it answered `429 quota exceeded` after about a dozen clips in a few minutes. On a 429 the voice backs off for 60 s (cached clips still play; new ones go to the browser voice at once) and the warm-up command waits it out. For production use a **paid** Gemini tier, or set an ElevenLabs/OpenAI key.
* **Word sync.** A neural voice doesn't say which word it is on, but the clip has a real length: the words are spread along it (long words and pauses weigh more) and reported as playback passes them, so the transcript is within a word or two of the voice. The browser voice still uses its own word events when it has them.
* If the clip won't play (autoplay blocked, decode error) the same words are read in the browser voice. The hello is *skipped* rather than said in a different voice from the questions.

**Choosing the voice by ear:** `php artisan interview:speech-sample` writes the same question in a shortlist of voices (`--voices=Kore,Achird`, `--driver=elevenlabs`, `--out=<folder>`); put the winner in `.env` (`GEMINI_TTS_VOICE` / `OPENAI_TTS_VOICE` / `ELEVENLABS_VOICE_ID`) and run `interview:warm-speech`. Samples made for this project are in `D:\Dev\_scratch\voice-samples` (Sulafat, Achird, Kore, Vindemiatrix, Sadaltager, Schedar).

**Deploy:** set the env keys, `php artisan route:cache`, then `php artisan interview:warm-speech`. No migration. The audio sits on the private `local` disk under `interview-speech/`.

## Scoring: the score, live, after every set

*Measured 2026-10-29 with the real Gemini model (`gemini-3.1-flash-lite`), one batched call per interview.*

**How long Gemini takes:** about **2–3 s** for a 3-question interview, **~5 s** typically for a 5-question Vault set, up to ~12 s when the answers are long. One call scores every answer in the session.

**What the student used to wait** — the job was put on the `database` queue (your `.env`), and the only thing that drains it is the scheduler's once-a-minute `queue:work --stop-when-empty`:

| Setup | From "submit" to score |
|---|---|
| Database queue + the minute scheduler | **23 s** and **83 s** in two runs (it depends where in the minute you submit: 5–70 s, plus Gemini's 3 s). The completion screen used to give up polling after 60 s. |
| Database queue, **no scheduler/worker** (a dev PC) | **never** — the job sits in the `jobs` table |

**What it is now** — scoring runs **right after the request that finished the interview** (`->afterResponse()`), not on the queue: **2.1 s** for 3 questions and **4.9 s** for a 5-question Vault set, measured in the real UI, with nothing draining any queue. On production (nginx + php-fpm) the Submit request returns at once and the score follows within that time; the completion screen polls every 2 s. *On the single-threaded `php -S` dev server the Submit button stays on "Submitting…" for those few seconds, because that server cannot answer while it scores.*

Around it:
* A **retry**: one more try (after 1.5 s) for a dropped connection or a 429/500/502/503/504 from Google. A bad key or bad request is not retried. Still failing = the same behaviour as before (the student is told a person will review it; a Vault set can be sat again).
* **`php artisan interview:score-pending`** (scheduled every minute — the scheduler cron is already required): re-scores a finished session older than 2 minutes that has no score and was not marked as failed — the PHP process restarted mid-scoring, say. It leaves alone a failed scoring (a person's call), anything under 2 minutes old, and anything over a day old.
* The completion screen now waits up to **2 minutes** for a slow score (was 1); the Vault circuit **re-checks every 4 s while any set says "Scoring…"**, so the score appears without a reload.

**What a student sees after each set (checked end to end, three sets, real scoring):** the completion screen — "Set complete", their **score ring and %**, whether it counts toward the series, and a score + feedback line for **every answer**; the set's own page (same, with their transcript and recording); and the **qualification circuit** — that round's card turns to *Completed* with its score ring ("Above the 60% line" / "Below the 60% line — the series average is what counts") and a **View Critique** link, "N of 3 sets completed". The **series average appears only once all three sets are scored** (by design: it is what decides qualification). After the third set a passing average lists the student on Mellow Vault; otherwise the series goes into **Previous attempts** with its three scores and average, and the next attempt starts (3 attempts, then a 45-day wait).

### Why the old screen showed first

The session page used to sit inside `DashboardShell` and only hid the sidebar/header once the *live room* started. So the path was: plain spinner → the whole dashboard around a blank page → the shared consent page (inside the dashboard) → the room. Now `DashboardShell` is `fullBleed hideChrome` for the whole session, every loader is `InterviewBoot`, and the consent screen is the lobby. A browser test records whether the dashboard's sidebar is ever drawn while the URL is the interview session (it isn't).

### The watermark

The tiled proctoring watermark no longer prints the candidate's **name**. It carries `AptRun · #<attempt marker> · <time>` — the same short marker the window title carries (6 hex characters of the integrity session id), which the server maps back to the attempt, so a leaked screenshot can still be traced and dated without the screen ever naming the person. With the integrity layer off there is no marker and it shows `AptRun · <time>`. It is also sparser (16 tiles, 4% opacity). *Contests and tests still use `ProctoringOverlay`, which still prints the name — only the interview's HUD changed.* The camera tile's own name caption (like a video call) is unchanged.

### Staying in step with the voice

Chrome's network voices ("Google …") never report where they are in a sentence; local and Edge neural voices do. `useSpokenReveal` therefore starts on an **estimate** of the speaking pace (from the moment the voice really starts) and the instant a real `boundary` event arrives it **switches to those**. Either way the whole question is on screen when the voice stops, and the last word is never shown before the voice has said it. With no voice at all the question is simply written out in about two seconds.

`BrowserVoiceEngine.speak()` also gained a watchdog (a voice that goes quiet without ending no longer leaves the interview waiting forever), waits up to 400 ms for the browser's voice list, and chooses a voice: neural ("Natural") first, then one running on the machine over a network one, Indian English first.

### Performance — why it looks the way it does

The proctoring engine already analyses the camera on the candidate's own hardware, so the room is deliberately cheap:

* **Canvas 2D, not WebGL/three.js** (the ElevenLabs/React Bits orbs are WebGL). No dependency added; `framer-motion` was already in.
* **No blur filters.** The orb is drawn at 144 px and stretched by CSS (the smooth upscaling is the blur); the background glow is radial gradients. In a software-rendered browser the three `blur-3xl` blobs plus a CSS-blurred canvas cost ~100 ms a frame; now the room holds 60 fps with only the camera video left as the heavy item.
* The microphone level changes ~60×/s and is **never React state** — the orb and meter read `RoomSignal` inside their own animation frames.
* `prefers-reduced-motion`: words appear without animating, the orb barely moves, the background doesn't drift.

### Accessibility

The animated words are `aria-hidden`; a separate polite `role="log"` announces each turn **once**, when it is complete. The countdown is a `role="timer"` with `aria-live="off"` (a screen reader would otherwise read out every second); only the status wording is a live region.

## What is deliberately *not* here

* **No microphone picker.** The screen shows which mic is in use but doesn't let you change it: browser speech recognition always listens to the system default, so a different recorded device would give a transcript that doesn't match the audio.
* **The real voice has not been listened to by me** (no ears): the pipeline is verified (real Gemini clips cached, served, decoded and played in Chromium, words synced), the *choice* of voice is a default to be confirmed with `interview:speech-sample`. The ElevenLabs and OpenAI drivers are written to their documented APIs and unit-tested with faked HTTP, but not called live (no keys here).
* **No "replay question"** (the countdown keeps running, so the replay would be recorded as part of the answer).
* The old footer *"Nothing here is auto-scored — a real person reviews your recorded answer"* is gone: it hasn't been true since AI scoring was added.
* The consent page of **contests, soft-skills tests, core tests and study sittings** is unchanged (`ConsentScreen`); only AI interviews got the lobby.

## Testing

* `frontend/src/tests/unit/` — `spoken-reveal.test.ts`, `speech-synthesis-engine.test.ts`, `browser-voice-engine.test.ts` (captions), `interview-room-components.test.tsx`, `interview-lobby-and-hud.test.tsx` (lobby, boot, locked screen, watermark has no name, depth effect, silence/online hooks), `interview-complete.test.tsx`, `speech-audio.test.ts` (clip cache, playback + word sync, engine fallback), `interview-briefing.test.tsx` (the briefing pieces and the interviewer card), backend `InterviewSpeechTest` (provider choice, request shapes, caching, who may hear what, cooldown, warm-ahead, commands), `interview-session-room.test.tsx` (the whole flow through the real view with fake voice/proctoring/network, including "the dashboard never appears").
* Real-browser run (Chromium, fake camera/mic, faked speech with and without word-boundary events, light/dark, 1440/1280/820 wide, typed fallback, reduced motion): the Playwright scripts are throwaway, but the recipe is: scratch SQLite API on :8110 + `next dev -p 3100` from a copy of `frontend/`, seed one student and one published interview with three questions, add `webkitSpeechRecognition`/`SpeechRecognition` **and** `speechSynthesis` fakes with `Object.defineProperty` (Chromium has the unprefixed constructors and a read-only `speechSynthesis`).
