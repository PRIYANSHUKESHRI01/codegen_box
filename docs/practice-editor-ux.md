# The practice editor: opening a problem, running code, the verdict

What a student sees and why, for the Practice Arena → solve screen (and the contest solve screen, which shares the
same console). Written after the "Solve feels dead / Submit doesn't feel like anything is being checked" feedback.

## 1. Pressing Solve (`/dashboard/practice`)

| Moment | What happens | Where |
|---|---|---|
| Pointer over / focus / touch on **Solve** | The problem is fetched, the editor (Monaco) starts downloading and the solve route's code is prefetched — so by the time the click lands most of it is already here. | `SolveButton`, `lib/problemPrefetch.ts`, `lib/editorWarmup.ts` |
| The press | The button presses in, becomes **Opening…** with a spinner; its row highlights with a thin moving bar; the other Solve buttons dim and lock (no double navigation). A 12 s safety (and the Back button) un-sticks it if the navigation never lands. | `SolveButton`, `practice/page.tsx` |
| Arrival | The solve screen opens with the problem already on it (prefetch). The editor area shows a dark "Starting the editor…" placeholder (gutter + faint code lines) instead of a blank box, so skeleton → editor loading → editor is one continuous surface; the workspace settles in with a short fade/rise. | `EditorBootPlaceholder`, `workspace-in` (globals.css) |

Prefetched problems are good for 30 s and are dropped after an accepted Submit (so a stale "solved" flag never shows).
A failed prefetch is forgotten — the screen asks again and shows the real error.

## 2. Run and Submit

The sequence the student sees, driven by the judge's **real** state (`lib/useJudgedRun.ts`, shared by the practice and
contest screens):

1. **The press** — the clicked button shows a spinner and says **Running…** / **Judging…**; the other waits (disabled).
   The console jumps to the *Result* tab and, if it was squeezed small, grows to ~46 % of the editor column.
2. **Judging** (`JudgingView`) — stages *Sent to the judge → Waiting for a free judge (#n in line) → Running N test cases →
   Verdict*, a live timer, a thin moving bar, and **one chip per test case lighting up in turn** (N is the real count —
   a Run's samples, a Submit's samples + hidden). Stages follow `queued` / `running` from the server; where the judge
   answers in the same request (local dev with `QUEUE_CONNECTION=sync`) a request still out after 0.5 s reads as running.
3. **A beat** — a verdict that comes straight back (a cached Run, an empty queue) is held until 650 ms (Run) / 950 ms
   (Submit) after the click (450 / 650 ms in a contest) so it reads as *checked*, not as a flicker. Measured from the
   click: a slow judge adds nothing. Display only — contest penalties are timed from the click on the server.
4. **The reveal** (`VerdictView`) — the chips settle on their real results one after another (the whole row takes about
   1.1 s however many cases: 100 hidden cases are not 20 s), with a "Checking test cases… 4/10" line; **then** the verdict
   banner arrives: **Accepted** (the tick draws itself and rings once), **Wrong Answer** ("2 of 10 test cases passed —
   failed on case 2"), **Compilation Error**, **Runtime Error**, **Time Limit Exceeded** … with runtime and memory. The
   Result tab's coloured dot appears only after the banner (never ahead of it).
5. **Details** — click any chip: a visible case shows Input / Expected / Your output (the first failing case is open by
   default); a hidden case shows only passed / failed (it never leaks input or expected output); cases after the first
   hidden failure show as *not evaluated*. A program that crashed before running anything shows just the error text.
6. **After a Run that passes every sample** the verdict says **Sample cases passed** (never "Accepted" — only the full
   judge says that) with a **Submit solution** button. After an accepted Submit the header's **Solved** appears at once.

If the judge can't be reached (queue full, 429, offline) the console says why and offers **Try again**.

**Keyboard:** Ctrl/Cmd + Enter runs, Ctrl/Cmd + Shift + Enter submits — registered *inside* the editor (Monaco claims
Ctrl+Enter for "insert line below", so a window-level listener never heard it while typing; that was a real bug).
Everything animates with CSS only and the global `prefers-reduced-motion` rule flattens it (the verdict then appears at once).

## 3. Files

| What | Where |
|---|---|
| The run lifecycle (hook) | `frontend/src/lib/useJudgedRun.ts` (+ `lib/judge.ts`, the polling client) |
| Console: tabs, error + retry | `components/practice/ConsolePanel.tsx` |
| While it runs / the verdict | `components/practice/JudgingView.tsx`, `VerdictView.tsx` |
| Header buttons | `components/practice/ProblemHeaderBar.tsx` |
| Solve button, prefetch, warm-up | `components/practice/SolveButton.tsx`, `lib/problemPrefetch.ts`, `lib/editorWarmup.ts` |
| Editor + its loading state + shortcuts | `components/practice/CodeEditorPanel.tsx`, `EditorBootPlaceholder.tsx` |
| Screens | `app/dashboard/practice/view/page.tsx`, `app/dashboard/contests/problem/page.tsx` |
| Server: case counts | `JudgeQueue` (`total_cases` on every queued/running poll), `Problem::caseCounts()` → `problem.case_counts` |

## 4. How it was verified

- `frontend/src/tests/unit/practice-editor-ux.test.tsx` (47 tests): verdict wording, judging stages and chips, reveal
  timing, hidden-case privacy, no replay when flipping tabs, button states, Solve prefetch, the run hook, shortcuts' plumbing.
- `backend/tests/Feature/Judge/JudgePipelineTest.php`: `total_cases` on queued/polled jobs (Run 3, Submit 10) and
  `problem.case_counts`.
- By hand, in a real Chromium against the **real judge** (Docker Piston nodes `judge-piston-1/2`, a database queue and a
  worker, scratch SQLite): Solve press → Opening… (≈0.2–0.4 s) → problem on screen; Run wrong / Run passing / Submit
  Accepted / Submit Wrong Answer (case 2 fails, hidden case 4 fails, 5–10 not evaluated) / a Python syntax error /
  Ctrl+Enter from inside the editor / a phone-sized screen — light and dark. 14/14 checks, no page errors.

## 5. Back to the Practice Arena (and Solve) never leave the old screen standing

**Symptom:** after solving, press Back — the address bar says `/dashboard/practice` but the solve screen is still on show.

**Cause:** Next's client-side navigation needs the destination's data. Its client cache keeps a page for only ~30 s, so
a student who spent a few minutes on a problem has lost the Practice Arena's entry; Back then *fetches* it, and until
that request answers the old page stays on screen with nothing to say so. If the request is slow (a recompiling dev
server, a weak connection) or never returns, the URL has moved and the page has not — and a browser Back in that state
queues behind the stuck navigation. It does not reproduce when the network is healthy; it was reproduced by stalling
that one request.

**What changed (layered, so any one of them is enough):**

| Layer | What it does | Where |
|---|---|---|
| Longer router cache | A page the student has been on stays instantly available for 10 min instead of 30 s, so Back is normally a cache hit with nothing to wait for. | `next.config.mjs` → `experimental.staleTimes` (needs a `next dev` restart / a rebuild) |
| Resilient navigation | Back arrow and Solve start the normal soft navigation, show a spinner at once (Back arrow is locked + `aria-busy`), and if the screen has not been replaced after 3 s, load the page properly (`location.assign`). Cancelled the moment the page unmounts, i.e. a healthy navigation never sees it. | `lib/useResilientNavigation.ts` (used by `practice/page.tsx`, `practice/view/page.tsx`, `contests/problem/page.tsx`) |
| Route guard | After any browser Back/Forward, if 3 s later the router's path still differs from the address bar, reload the address. Covers the browser's own Back button, which the hook cannot. | `components/navigation/RouteSyncGuard.tsx`, mounted once in `app/layout.tsx` |

**Verified** (real Chromium, scratch API): healthy Back lands in ~60–330 ms as a soft navigation (document kept, nothing
reloads later); after 36 s on the solve screen with the Practice Arena's data request stalled for 60 s — the Back arrow
lands in <1 s (router cache hit), the browser's Back in ≈1.5 s, and a Solve whose data is stalled still opens the
problem after the 3 s patience + a page load (≈4–7 s); run twice, 7/7 each time. The same stuck state, before the
change, never recovered. Unit tests: `tests/unit/navigation-resilience.test.tsx` (11).

## 6. Not changed / worth knowing

- The editor (Monaco) still loads from its CDN on first use (`@monaco-editor/react`'s default). The warm-up starts that
  download early, but a blocked CDN would still leave the placeholder; self-hosting it under `public/` would remove the
  dependency (~15 MB of static files) — a deploy-size decision.
- The per-case chips are drawn from the real case count; the judge itself runs all cases in one program execution, so
  the sweep while it waits is a picture of that work, not a per-case progress report.
