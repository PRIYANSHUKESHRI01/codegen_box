# Exam integrity (proctoring that does not trust the browser)

Everything proctored in AptRun — contests, AI interviews, Soft Skills tests, Core tests and practice sittings — runs on one
integrity layer. This page is the operating manual: what it defends against, how it works, how to switch it on safely, how to
read what it recorded, and **what it cannot do**.

## 1. Why it exists

The original proctoring was good at catching an honest student who tabbed away. It had one structural weakness that a strong
student can use: **every detector ran in the student's browser, and the server only counted what the browser reported.**
That meant:

* blocking the `/violations` request (an extension, a proxy rule, DevTools request blocking) silenced it completely;
* a userscript that fakes `document.hasFocus()` / `document.hidden` / fullscreen made the page believe nothing happened;
* contest `run`/`submit`, Soft Skills `answer`/`submit` and AI-interview `answer` never even **required** a proctoring session —
  a script could call them directly, with no camera and no page at all;
* a second monitor was free (window blur was informational only), and nothing the camera saw ever left the browser, so there was
  nothing to review afterwards.

The rule the new layer is built on: **nothing the browser says is trusted, and silence is never "all clear".**

## 2. How it works

```
 student's machine                                        AptRun server
 ┌──────────────────────────────┐                         ┌────────────────────────────────────────────┐
 │ exam page  (integrity engine)│── batches every ~10 s ─▶│ IntegrityService                           │
 │  focus · fullscreen · devtools│  (nonce-chained,       │  ├ gate: no live signal → 423, no answers  │
 │  tamper checks · screen share │   one in flight)       │  ├ hash-chained, append-only event log      │
 │  camera health · face/phone AI│                        │  ├ device / address binding, 1 live device  │
 │  stills (jittered cadence)    │── encrypted stills ───▶│  ├ gaps, replays, clock jumps, WebRTC       │
 └──────────────────────────────┘                         │  ├ strikes → the surface's OWN service     │
 ┌──────────────────────────────┐                         │  └ cross-check page ⇄ Guardian              │
 │ AptRun Guardian (Windows)    │── signed reports (2 s) ▶│ GuardianService (Ed25519, replay-proof)    │
 │  foreground · processes ·    │   own key the page      └────────────────────────────────────────────┘
 │  hidden/overlay windows · VM  │   never sees
 │  remote · screens · proxy/VPN │
 │  CA store · hosts · injected  │                         reviewers (TPO / coordinator / company / admin)
 │  input (counts only)          │                         └ scoped timeline · stills · network · chain check
 └──────────────────────────────┘
```

### The server enforces — the page only reports

| Mechanism | What it stops |
| --- | --- |
| **Gate** on every answer / run / submit (`IntegrityService::gate`) | A script that never opened the page (428); a student who blocks the telemetry endpoint (423 once the signal is stale — blocking it buys *nothing*) |
| **Heartbeat + gap accounting** | Silence is measured when the page comes back; ≥ 150 s in one gap, or > 300 s in total, costs a strike |
| **Nonce chain + batch ids** | Replaying an old "all clear" batch; out-of-order or forged batches (logged as `replay_suspected`) |
| **Source separation** (`EventCatalog`) | The page claiming to be the Guardian or the server (logged as tampering, costs a strike) |
| **One live device** | A helper logging in as the student on another machine while the first is reporting (409); a different device is accepted only once the first has gone quiet, and is recorded as `device_changed` |
| **Hash-chained log** (`integrity:verify`) | Editing, deleting or trimming log rows afterwards — an insider, a careless script, SQL injection |
| **Exam network** (per college / deployment) | Starting an attempt from home, a hostel or a café — refused before the clock starts |
| **Incident merging** | One walk-away (fullscreen exit + tab switch + OS focus change) costs **one** strike, not three |
| **Pre-flight blockers** | Anything wrong *before* Start (a VM, a remote tool, a hidden window…) is shown with how to fix it and costs nothing |

### The Guardian — the second, independent witness

The Guardian (`/guardian`) watches the **operating system**, which a web page cannot, and talks to the server on its own signed
channel. Two things make it strong even though it is not a kernel driver:

1. **The page cannot speak for it.** Patching the exam page changes nothing the Guardian reports.
2. **The server compares the witnesses.** If the OS says the foreground window left the exam and the page never noticed, the page
   is lying or patched → `guardian_page_mismatch` (attempt ends). If the Guardian's screen size, time zone and address do not match
   the page's, the Guardian is on a different machine (a clean helper PC standing in for the real one) → `guardian_host_mismatch`.

Beyond the checks in `guardian/README.md`, three of its checks are aimed squarely at *network* and *control* attacks:

* **Browser start-up options.** The browser's own command line is read (a same-user, read-only look): a remote-debugging port
  (anything on the machine can drive the page), an unpacked extension, a proxy, relaxed certificate checks or host-name overrides
  (which bypass the hosts file) block the start with the instruction to open the browser normally.
* **HTTPS interception.** Set `GUARDIAN_TLS_PINS` to the public-key hash of your CA (intermediate or root, not the rotating leaf);
  the Guardian then looks at the certificate chain your server really presents and reports one that contains none of your keys —
  which is what an intercepting proxy or an "SSL inspection" box must do to read HTTPS. Leave it empty on a campus whose network
  legitimately inspects TLS (or exempt the API host). Get a pin with:
  `openssl s_client -connect api.yourdomain.com:443 -showcerts </dev/null | openssl x509 -pubkey -noout | openssl pkey -pubin -outform der | openssl dgst -sha256 -binary | openssl enc -base64`
  (run it on each certificate in the chain and pin the intermediate).
* **New keyboards and mice.** A hardware typing device shows up as a second keyboard; an increase after the Guardian started
  is recorded for the reviewer.

See `guardian/README.md` for the full list of what it checks and how to ship it.

## 3. Profiles — how strict each surface is

`config/integrity.php`. Every key can be overridden from `.env` (`INTEGRITY_<PROFILE>_<KEY>`).

| | strict (contests, Core tests) | standard (Soft Skills, AI interviews) | practice (study sittings) |
| --- | --- | --- | --- |
| Camera | required | required | required |
| Screen share (entire screen) | **required** | optional | off |
| Guardian | optional | optional | off |
| Beat / stale-after | 10 s / 40 s | 12 s / 50 s | 15 s / 75 s |
| Webcam still every | 30 s | 45 s | – |
| Screen still every | 60 s | – | – |
| Focus lost → strike after | 3 s | 4 s | 5 s |
| Second monitor | blocks start, strike mid-attempt | same | allowed |
| Chrome/Edge only | yes | no | no |
| Face/phone analysis strikes | `multiple_faces` only | none | – |

To require the Guardian everywhere strict: `INTEGRITY_STRICT_GUARDIAN=required`. To run without cameras on a campus that has
none: `PROCTORING_SOFT_SKILLS=false` / `PROCTORING_CORE_TESTS=false` / `PROCTORING_STUDY=false` (existing switches).

**What costs what.** Browser findings cost one strike at most. Camera-AI findings (no face, looking away, a phone, speech) are
*flags with a picture attached*, not strikes — a model can be wrong, a person looking at the still cannot. Things only the
Guardian can *prove* (remote-control software, a virtual machine, a window hidden from screen sharing, a new trusted root
certificate, the page contradicting the OS) end the attempt. The table is `EventCatalog` — one place, with a reviewer-readable label.

## 4. Turning it on

```
php artisan migrate                       # integrity tables + colleges.exam_networks
php artisan route:cache                   # new routes 404 until this is re-run (cached routes)
```

* **PHP `sodium` extension** must be enabled (it verifies the Guardian's signatures). It ships with PHP ≥ 7.2; XAMPP on Windows
  has it commented out — uncomment `extension=sodium` in `php.ini`. The Guardian endpoints answer 503 `sodium_missing` without it.
* **Scheduler cron** (`* * * * * php artisan schedule:run`) already drives the rest: `integrity:sweep` every 5 minutes (closes
  finished/abandoned attempts — never strikes anyone for silence) and `integrity:prune` daily (retention).
* **Storage**: stills are stored encrypted under `storage/app/private/integrity-evidence` (or the disk you set in
  `INTEGRITY_EVIDENCE_DISK`; an S3-compatible disk works). Budget roughly **4–6 MB per student-hour** at strict settings
  (a 480 px webcam still ≈ 25 KB every 30 s, a 960 px screen still ≈ 45 KB every 60 s); a hard cap per attempt
  (`INTEGRITY_EVIDENCE_MAX_SESSION_BYTES`, 150 MB) and retention (45 days; 365 for flagged attempts) bound it.
* **CORS**: unchanged — the new endpoints are under `/api` like the rest.

### Roll-out without risk

1. Deploy backend **and** frontend together, **outside exam windows**, and tell students to hard-refresh. A page loaded before the
   deploy does not send heartbeats; once the layer is enforcing, its answers are refused after ~40 s.
2. For the first run, set `INTEGRITY_ENFORCE=false` ("observe mode"): everything is recorded and shown to reviewers, nothing is
   refused. Look at real attempts, then set it back to `true`.
3. Emergency stop: `INTEGRITY_ENABLED=false` → every surface behaves exactly as before this layer existed (the original
   violation endpoints keep working; the page falls back to the original proctoring automatically).

### Guardian roll-out

```
cd guardian
powershell -ExecutionPolicy Bypass -File build.ps1 -Version 1.0.0 -Api https://api.yourdomain.com/api
powershell -ExecutionPolicy Bypass -File package.ps1 -Publish local     # local server; on a VPS copy the two files below instead
```

**How students get it.** The Guardian card on the exam page has a *Download for Windows* button. The **server serves the installer
itself**: put `dist/aptrun-guardian.exe` and `dist/aptrun-guardian.json` (the version) in `backend/storage/app/guardian/` (that
folder is not in git or the deploy zip — copy it to the VPS by hand, e.g. `scp`) and `GET /api/guardian/download` serves it, public
and rate-limited, with its size, version and SHA-256 shown on the card. With no file there, the card tells students to ask their
college instead of showing a dead link. `GUARDIAN_DOWNLOAD_URL` overrides this if you would rather host it elsewhere. The student
double-clicks it once: it copies itself into `%LOCALAPPDATA%\AptRunGuardian`, registers the *Open Guardian* link to that copy, asks
for the code on the page and connects — later exams are one click. Build every environment with its own `-Api` (the production
build must not point at `127.0.0.1`).

Then set on the server `GUARDIAN_ALLOWED_BUILDS=<the SHA-256 build.ps1 printed>` (only builds you released can pair; a new release
needs its hash added *before* students download it). Start with `optional`, ask a pilot
class to use it, and only then set `INTEGRITY_STRICT_GUARDIAN=required` for the exams that need it. Sign the executable before a
wide release or Windows shows a SmartScreen warning.

## 5. Reading what it recorded

TPOs see it under **Proctoring** (`/admin/proctoring`), coordinators under `/coordinator/proctoring`, hiring companies under
`/admin/company/proctoring`: *Exam integrity* lists every proctored attempt in the caller's scope, riskiest first. Opening one shows:

* **Why it was flagged** and a **timeline** (page / Guardian / server), each entry labelled, with its strike if it cost one;
* **Pictures** — webcam and screen stills, flagged ones first (a reason such as "no face" or "phone"), decrypted only on the
  way out through an authorised request;
* **Network & device** — every address used, silence while the page was open, how long the Guardian covered the attempt;
* **Log verified** — whether the hash chain is intact.

A reviewer outside their scope gets a 404, never a 403. Reinstating a locked attempt stays on the existing per-surface screens.

The same from the command line: `php artisan integrity:verify <uuid>` (or `--since=30`) re-walks the chain and exits non-zero on
the first broken row.

### The TPO's exam network

TPO → Proctoring → *Exam network*: the address ranges students must be on to **start** a proctored attempt. Press *Add this
network* while sitting in the lab (the card shows the public address you are on). Empty = no restriction. Every change is in the
activity log. A typo cannot lock a class out: entries are validated and the previous list is in the log. Platform-wide ranges can
also be set with `INTEGRITY_ALLOWED_RANGES` / `INTEGRITY_BLOCKED_RANGES`.

## 6. Privacy

Stills of a person are personal data, so the design keeps as little as it can for as short a time as it can:

* video never leaves the browser; only small stills do, and the consent screen says so, with the real numbers from the server's
  own policy (`IntegrityDisclosure`) — it cannot promise one thing while the code does another;
* the microphone is used only to notice sustained speech; no audio is recorded or sent (except an AI interview's own answer
  recording, as before);
* the Guardian never reads files, messages or keystroke *contents* (it counts whether keystrokes were injected);
* stills are encrypted at rest (AES-256-GCM, key derived from `APP_KEY` — **do not lose or rotate APP_KEY without exporting what
  you need**), served only to authorised reviewers, deleted after 45 days (365 if the attempt was flagged), and the attempt's
  log after 2 years (`integrity:prune`).

## 7. What this cannot do (the honest list)

No software proctoring is unbreakable, and a determined, well-resourced person can still:

* use a **second device** the camera does not see (a phone on the lap, a laptop behind the screen) — mitigated by camera
  analysis, the stills, speech detection and a sensible room check, not eliminated;
* use an **HDMI splitter / capture card** to send the screen to a helper — invisible to every piece of software on the PC;
  the only answers are an invigilated room or an on-campus exam network with lab machines you control;
* **attack the Guardian** with administrator rights (patch its memory, hook its calls). It is a user-mode program, not a kernel
  driver; tampering shows up as a hash mismatch, a debugger, or a disagreement with the page, but a skilled attacker with a
  kernel-level toolkit can in principle blind it;
* run the exam on **macOS / Linux / a phone**: the Guardian is Windows-only today. Those students run at "web" assurance (the
  review screen says so), so require Chrome/Edge on a Windows lab machine for the highest-stakes exams;
* **impersonate** the student with a look-alike present on camera — stills help a human check, but no automatic face match is done.

### Roadmap to a kernel-level layer

A kernel driver (process-creation callbacks, handle protection of the Guardian, a view of every window and every input device
below the level user-mode software can lie about) is the next rung — and it is a **business** step before it is a coding one:
it needs an **EV code-signing certificate**, a Microsoft Hardware Dev Center account and **attestation signing** (otherwise
Windows will not load it with Secure Boot on), plus an installer with admin rights on each lab PC, and it must be tested on the
exact Windows builds you run, because a bug in a driver is a blue screen on a student's machine. The server side is already
built for it: the Guardian protocol (pairing, signed reports, build-hash allow-list, cross-checks) would carry a driver's
findings without a server change. For labs you control, **Windows Assigned Access / kiosk mode + the exam network** gets most of
the same protection with no driver at all.

## 8. Troubleshooting

| Symptom | Likely cause / fix |
| --- | --- |
| Whole lab reports "outside the exam network" | The TPO listed private addresses; add the college's **public** address (the card shows it) |
| Students stuck on "Reconnecting…" | The college network blocks the API host or is saturated; raise `INTEGRITY_*_STALE` temporarily, check `integrity:sweep` is not the cause (it never strikes) |
| "Browser needed: Chrome or Edge" | strict profile needs a browser that reports what is shared; set `INTEGRITY_STRICT_CHROMIUM_ONLY=false` only if you accept less assurance |
| Guardian card sits on "Waiting for the Guardian to connect…" | The page cannot start the Guardian — it is a separate Windows program that must be **running on the student's PC and given the code**. Check, in order: (1) is it running (`aptrun-guardian.exe`, or the *Open Guardian* link after `aptrun-guardian.exe --install`)? (2) did the code expire (10 min — the card shows a countdown and *Get a new code*)? (3) does the card show a red server message? `sodium_missing` = PHP `sodium` off (503); anything else = the API is unreachable or the integrity migration has not run |
| Guardian says it cannot connect | `sodium` extension off (503), wrong `api` base, or `GUARDIAN_ALLOWED_BUILDS` set without this build's hash |
| A student is told to close Teams / WhatsApp / a VPN | working as designed — the list is `config/integrity_denylist.php`; edit and the Guardian picks it up at its next report |
| Camera analysis "unavailable" on weak PCs | the engine times the CPU, then the GPU, and gives up gracefully; stills still go to the reviewer |
| Playwright / Selenium e2e runs are locked | the page rightly treats automation as tampering; build the e2e frontend with `NEXT_PUBLIC_INTEGRITY_ALLOW_AUTOMATION=1` and run the e2e API with `INTEGRITY_ENABLED=false` |
