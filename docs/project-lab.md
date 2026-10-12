# Project Lab

Students pick a real-world project (LMS, hospital system, e-commerce store…), read and
download its **Statement of Work**, build it in a **full-stack VS Code that runs in the
browser**, tick off milestones, and **submit their code** for review. It is sold as an
**add-on** to the student plans (or on its own). Staff write every SOW by hand in the admin
editor — nothing is generated.

- Student UI: sidebar → **Project Lab** (`/dashboard/projects`). Without the add-on the item
  shows a lock and the page is the unlock/upgrade screen.
- Staff UI: **Mellow Ops → Project Lab** (`/admin/projects`) — needs the `project_lab` permission.
- Code map and gotchas: see the memory note `project_project_lab.md`; this file is the
  operator's guide.

## 1. Architecture

```
 Student's browser                       Web server (Render)                 Workspace host(s)  ← separate machines
 ─────────────────                       ───────────────────                 ───────────────────────────────────────
 Next.js dashboard  ── API ──────────▶   Laravel  =  CONTROL PLANE           Caddy gateway (wildcard TLS)
   workspace page                          · who may open a workspace            ws-<id>.ws.example.com   ─▶ ws-<id>:13370   VS Code
   <iframe> editor ─────────────────────── · start / stop / hours / reaper       p<port>--ws-<id>.…       ─▶ ws-<id>:<port>  student's app
   <iframe> app preview ────────────────── · snapshot on submit                  one container per student (aptrun/workspace)
                                            · docker CLI over ssh:// ──────────▶   --cap-drop ALL · no-new-privileges · 2 GB · 1.5 CPU
                                                                                  volume wsvol-<n> = /home/workspace (their code)
```

Laravel never runs student code and no request for the editor ever passes through it. It
decides, meters and records; the host runs. There is **no Python** anywhere.

| Piece | Where | Notes |
|---|---|---|
| Entitlement | `User::projectLabCoverage()` | own add-on first, then a plan flag (`project_lab_access`) |
| Pricing | `PurchaseQuoteService`, `config/billing.php`, `PlanSeeder` | server-side only |
| Control plane | `app/Services/Workspaces/WorkspaceManager` | start/stop/heartbeat/reap |
| Runtime | `DockerCliRuntime` (prod), `FakeWorkspaceRuntime` (tests, `WORKSPACE_RUNTIME=fake`) | docker CLI over `ssh://` |
| Image | `infra/workspaces/Dockerfile` | OpenVSCode Server (MIT) |
| Gateway | `infra/workspaces/Caddyfile` | wildcard routing, no per-workspace config |
| Snapshot | `SnapshotScript`, `ProjectSubmissionService` | `find \| tar` inside the container |
| SOW PDF | `SowPdfService` (dompdf) | watermarked with the student's name + email |

## 2. Plans and pricing

Project Lab is a plan of `kind = addon` (`plans.code = project-lab`). A student has one active
**base** subscription (Coder / Expert / Grandmaster, unchanged) and, independently, an active
Project Lab subscription. The two never cancel each other.

| The student buys | Pays |
|---|---|
| a plan only | the plan's price (unchanged) |
| Project Lab only | **₹499 / month** |
| Expert + Project Lab | ₹399 + **₹349** = **₹748** (saves ₹150) |
| Grandmaster + Project Lab | ₹799 + **₹349** = **₹1,148** (saves ₹150) |
| Project Lab, while already holding a paid plan | **₹349** |

A free Coder plan never earns the discount (Coder + Lab = ₹499). Each purchase = **30 days**.
Lab includes **80 workspace hours** and **3 projects in progress** per period.

**To retune:** price / hours / projects → the `project-lab` row in `database/seeders/PlanSeeder.php`
(then `php artisan db:seed --class=PlanSeeder`); the bundle discount → `BILLING_ADDON_BUNDLE_DISCOUNT_PERCENT`
(default 30, 0 turns it off). The public `/pricing` marketing copy is static — update
`PROJECT_LAB_ADDON` in `frontend/src/data/pricing.ts` to match.

Rules worth knowing:
- The browser never sets a price. The pricing UI shows `GET /me/purchase-quote`; checkout recomputes and
  refuses (409 `price_changed`) if the total the student saw is stale.
- Renewing early **stacks** the remaining days onto the new period; the hours counter **resets** at renewal.
- **Lapse:** the workspace is stopped within a minute. The student keeps their files and their submissions + feedback
  (volumes are never deleted automatically yet — a retention/cleanup job, e.g. 90 days after a lapse, is a Phase 2 item, so disk on the host grows until
  you remove old `wsvol-*` volumes by hand), and loses the SOW body, PDF, workspace and
  submitting until they renew.
- A college can later include Lab for its students by setting `project_lab_access = true` on its
  institution plan; no plan does today.
- **Payment is still the instant stand-in** used everywhere else — there is no gateway yet. Each line
  records `price_paid` / `purchase_ref` in `subscriptions.meta`, so reconciliation works the day Razorpay
  is wired in (it needs one SKU per combination; Razorpay subscriptions take a single plan).

## 3. Writing SOWs (staff)

`/admin/projects` → **New project**. Students only see a project once it is **published**; publishing
needs a written SOW and at least one milestone.

**Fields.** Title, category (free text — new categories need no deploy), summary (the card text), level,
estimated hours, tech stack, outcomes, display order, optional card icon (a Lucide name from
`ProjectCard.tsx`: `ShoppingCart`, `Stethoscope`, `GraduationCap`, `Bot`, `Briefcase`…), and **Free sample**
(anyone can read and download this SOW; the workspace stays paid — a taste that sells the rest).

**The SOW** is Markdown with a live preview. Press **Insert template** for the standard structure:
background · objectives · scope (**in scope / out of scope**) · users and roles · functional
requirements · non-functional requirements · data model · interfaces · technology and constraints ·
deliverables · evaluation · assumptions · resources. "Out of scope" is its own heading on purpose —
it prevents more misunderstandings than any other section.

**Milestones** are separate, structured rows (not prose): title, description, hours, and
**acceptance criteria — one per line, each one checkable** ("A receptionist can register a patient",
not "Registration works well"). Students tick milestones; reviewers grade each criterion. The PDF
appends the milestones automatically, so don't repeat them in the SOW body.

**Versions.** Fixing a typo changes nothing. For a material change tick **"This is a material change"**
when saving: the SOW goes to v2 and students already on v1 see "The SOW was updated". Ticks survive
renames and reordering of milestones (the editor keeps their ids).

**Never delete a project students have worked on** — archive it (the API refuses the delete).

### Adding projects as files (the way to add 50)

Projects can also live in the repository as two files in `backend/database/seeders/data/project-lab/`:

- `<slug>.json` — title, category, summary, level, `estimated_hours`, `tech_stack`, `outcomes`, `icon`, `status`,
  `is_free_sample`, `display_order`, and the `milestones` (each with `title`, `description`, `estimated_hours`,
  `acceptance_criteria`).
- `<slug>.md` — the SOW.

Then `php artisan db:seed --class=ProjectLabContentSeeder` (also part of `db:seed`). It **only adds** a slug
that does not exist yet, so a SOW edited later in the admin editor is never overwritten by a deploy; to change
a seeded project, edit it in the editor (and tick "material change" if students should be told).

`ProjectLabContentTest` holds every file to the same bar, so a mistake fails the build instead of reaching a
student: the project must pass the admin editor's own validation, milestone hours must add up to
`estimated_hours`, bracketed requirement ids in a criterion (`(AUTH-1)`) must exist in the SOW's tables, the SOW
must have the standard headings, every code fence must name a language (so the reader shows a dark block with a
Copy button), no task-list checkboxes (they print badly), and it must render to a PDF.

**House style the first project set:** a fictional client and a concrete business problem; requirements in
tables per module with an id in backticks (`` `APT-1` ``), the words Must / Should / Could; business rules with
**worked examples** (slot maths, billing maths) that the reviewer repeats; a "who can see what" table;
a rubric that matches the review form (40 criteria / 25 quality / 20 security / 15 documentation); and the
reviewer's walkthrough written out, so a student knows exactly how they will be judged. Mention what is
specific to this environment (bind to `0.0.0.0`, Preview port, trusted proxies) — see the Hospital Management
System SOW for the wording. About 20 A4 pages as a PDF is normal for a 45-hour project.

**Which code blocks students may paste.** Only fenced blocks tagged `bash` / `sh` / `shell` / `zsh` / `console` / `terminal` are pasteable (they are *commands*; see §12). Code a student is meant to write must be in a `php` / `blade` / `js` / ... fence, or in a table or prose, because those are not pasteable. A test fails if a bash block holds application code, and if a project that refuses pasting does not tell students so in its own SOW.

**Reviewing** (`/admin/projects?tab=review`): open a submission, download the code (audited), check the
milestones' criteria, optionally fill the rubric, then **Approve and score**, or **Request changes**
(feedback required; the project goes back to the student, who can resubmit — attempt 2, 3…).

## 4. The workspace

Each student gets one container from `aptrun/workspace`, running upstream VS Code in the browser
(OpenVSCode Server): terminal, git, search, extensions from Open VSX. Installed: Node 20 (+ pnpm/yarn via
corepack), PHP 8.3 + Composer, Python 3.12 + venv + pip, and — **full flavour** — OpenJDK 21 + Maven and
MariaDB, PostgreSQL, Redis; SQLite everywhere. MongoDB is not installed (use a free Atlas cluster).

- **Files persist, the container doesn't.** `/home/workspace` is a per-student Docker volume. Everything
  else is thrown away on stop and rebuilt from the current image on start.
- `.aptrun/SOW.md` and `.aptrun/MILESTONES.md` are refreshed on every start; `START-HERE.md` is written once.
- **Editor settings come from three places.** (1) `.vscode/settings.json` is seeded once (tidy Explorer, auto-save, git defaults) and is the student's afterwards. (2) `machine-settings.json` is the platform's own and is rewritten on **every** start, so an image upgrade reaches existing workspaces (AI chat off, tips off). (3) Two first-launch defaults are **patched into the image** (see below). The editor also starts with workspace trust disabled (`--disable-workspace-trust`), so there is no "do you trust the authors" dialog.
- **Why the image patches VS Code's defaults.** The browser client lays itself out *before* the server's settings reach it, so on a brand-new workspace it opened an AI chat panel that cannot sign in (about 4 first launches in 5) plus a generic "Get Started with VS Code for the Web" tab, even with both turned off in settings. `infra/workspaces/Dockerfile` therefore edits three defaults in the shipped client (`workbench.secondarySideBar.defaultVisibility` → `hidden`, `workbench.startupEditor` → `none`, `chat.disableAIFeatures` → `true`). The build **fails** if a VS Code upgrade changes the text it matches, so a version bump cannot silently bring the panel back. After bumping `OPENVSCODE_VERSION`, rebuild and open a brand-new workspace: the first load must show an empty editor with the Explorer and no chat or Copilot icons.
- **The extension set is fixed** (`infra/workspaces/extensions.txt`): baked into a read-only folder, no Marketplace, so students cannot install an AI-autocomplete extension (§12). Add a line to that file, **and** to `config/authorship.php` `curated_extensions` (a test checks they match), to make something available to everyone.
- The browser console shows two harmless 404s for `vsda.js` / `vsda_bg.wasm` — Microsoft's proprietary handshake module, which open-source builds do not ship.
- **Databases:** `lab-db start mysql|postgres|redis` (data in `~/.lab/db`).
- **Running the app:** bind to `0.0.0.0` (not `localhost`), then use **Preview** and enter the port
  (1024–65535). The editor is on 13370 so students' own 3000/5173/8000 stay free.
- **Limits per workspace:** 2 GB RAM (no swap), 1.5 CPU, 512 processes, 1 GB `/tmp`, ~3 GB disk (soft; the
  reaper stops a workspace above it), 8 hours per session, 15 minutes idle (page closed).
- **Hours** are metered by the open workspace page: it heartbeats once a minute; each beat counts for
  at most 2 minutes, so a sleeping laptop can neither spend nor bank hours.
- **One live workspace per student**; opening another stops the first.

**The workspace page** (`WorkspaceView.tsx`) follows rules that exist because each was a real bug:

- **The page is pinned to the window** (`DashboardShell fitViewport`, with the sidebar showing; focus mode has always been pinned). Never let the content decide the page height: a long milestone list used to stretch the editor iframe to 1377 px inside a 770 px window, pushing its status bar and terminal off-screen, and a mouse wheel over an iframe never reaches the page, so that part could not be scrolled to with the pointer over the editor. Now the guide panel scrolls on its own and the editor gets exactly the remaining height (checked at seven window sizes, both modes: page height = window height, editor ends at the bottom edge). The iframe is absolutely positioned inside a box sized by the layout for the same reason.
- **Guide panel:** a drawer below 1024 px (starts closed, closes on backdrop/X), a resizable column from 1024 px up. The divider drags (a transparent layer covers the page while dragging, because an iframe swallows mouse events), works from the keyboard (arrows ±24 px, Shift ±96, Home/End), double-click resets. Panel width, preview width, panel open, focus mode and the dismissed quick-start tip are remembered in `localStorage` (`lib/projectLabLayout.ts`, tolerant of corrupt values, unit-tested).
- **Editor loading veil:** VS Code takes several seconds to paint after its HTML loads, so a "Loading VS Code…" veil covers the frame (lifted ~3.5 s after the frame's load event; after 25 s it offers "Reload the editor"). The top-bar reload button remounts the frame without touching files or running programs.
- **Stop is two-step** (the first click arms it for 4 s) because it ends any dev server the student has running. **Esc leaves focus mode** only when pressed on the page itself; inside the editor Esc belongs to VS Code.
- The Preview pane sits beside the editor from 1024 px (draggable divider) and stacks under it below that.

**Submitting** captures the workspace *at that moment* from the running container — there is nothing to
upload — and then **stops the workspace** (the project is out of the student's hands, so hours stop counting). Files are untouched; if the reviewer requests changes the student reopens the same workspace. Left out: `node_modules`, `vendor`, build output (`dist`/`build`/`target` at the project root or one
level down), tool caches, `.env` and `.env.*` (but **not** `.env.example`), `*.pem`, `*.key`, SSH keys,
`*.log`, symlinks. Cap 200 MB. A repository link can be submitted instead if the workspace is closed.

## 5. Production setup

### 5.1 What you need
- **One or more Linux VMs for workspaces** (Ubuntu 22.04/24.04). Sizing rule of thumb: **8 vCPU / 32 GB RAM ≈ 25–30
  concurrent workspaces** (CPU and RAM are over-committed because most are idle-ish). Start with one.
  They must **not** be the web server and must hold no secrets.
- **A domain for the gateway that shares a registrable domain with the web app** — e.g. app
  `app.example.com`, workspaces `*.ws.example.com`. The editor runs in an iframe and relies on first-party
  cookies; a different registrable domain will break it in Safari and Firefox.
- DNS: `A *.ws.example.com → <host public IP>`, and an API token for your DNS provider (Cloudflare shown) so
  Caddy can get one **wildcard** certificate via DNS-01 (per-hostname certificates would hit Let's Encrypt's
  weekly limits).
- An SSH key pair for the control plane → host (`ssh://deploy@host`), or Docker over mutual TLS.

### 5.2 Steps
1. **Host:** `sudo infra/workspaces/host-bootstrap.sh --gvisor --deploy-key "<public key>"`
   (installs Docker, optionally gVisor, creates the `aptrun-workspaces` network on a fixed subnet,
   applies the firewall and a systemd unit that re-applies it). *This script has not been executed on a
   Linux host by its author — read it, run it on a fresh VM, then do step 4.*
2. **Image:** on the host (or any machine with a registry) `infra/workspaces/build-image.sh full`
   → `aptrun/workspace:latest` (~3.5 GB, a few minutes).
3. **Gateway:** `cd infra/workspaces && cp .env.example .env` (fill it) `&& docker compose up -d --build`.
4. **Prove the isolation:** `infra/workspaces/verify-isolation.sh`. It starts two throwaway workspaces and
   checks: non-root, no capabilities, no privilege escalation, **cannot reach another workspace / the host /
   the cloud metadata service / private networks / SMTP**, **can** reach the internet. Do not admit students
   until it passes.
5. **Backend env** (on Render):
   ```
   WORKSPACE_RUNTIME=docker
   WORKSPACE_HOSTS=[{"name":"ws-1","docker_host":"ssh://deploy@HOST","capacity":24,"domain":"ws.example.com","scheme":"https"}]
   WORKSPACE_IMAGE=aptrun/workspace:latest
   WORKSPACE_OCI_RUNTIME=runsc            # if you installed gVisor — recommended
   ```
   The backend image needs the `docker` CLI and an `ssh` client, and the private key for the `deploy` user.
6. **Scheduler:** `workspaces:reap` runs **every minute** — the host cron must run `php artisan schedule:run`
   every minute (until now only daily jobs existed).
7. **Database:** `php artisan migrate`, then `php artisan db:seed --class=PlanSeeder` (adds the `project-lab`
   plan row; safe to re-run).
8. **Snapshots** go to the private `local` disk by default. Render's disk is ephemeral — point
   `WORKSPACE_SNAPSHOT_DISK` at an S3-compatible disk (`FILESYSTEM`/`AWS_*`) before launch.
9. Staff: grant the **Project Lab** permission (Mellow Staff → Manage Access), write SOWs, publish.

### 5.3 Environment reference
| Variable | Default | Meaning |
|---|---|---|
| `WORKSPACES_ENABLED` | `true` | kill switch: `false` → "Open workspace" answers 503; everything else keeps working |
| `WORKSPACE_RUNTIME` | `docker` | `fake` simulates hosts in memory (UI development) |
| `WORKSPACE_HOSTS` | local Docker | JSON list: `name`, `docker_host`, `capacity`, `domain`, `scheme`, `tls_verify`, `cert_path` |
| `WORKSPACE_IMAGE` | `aptrun/workspace:latest` | |
| `WORKSPACE_NETWORK` | `aptrun-workspaces` | must match the host network |
| `WORKSPACE_OCI_RUNTIME` | none | e.g. `runsc` (gVisor) |
| `WORKSPACE_MEMORY` / `_CPUS` / `_PIDS` / `_DISK_MB` | `2g` / `1.5` / `512` / `3072` | per-workspace limits |
| `WORKSPACE_IDLE_MINUTES` / `_MAX_SESSION_MINUTES` | `15` / `480` | |
| `WORKSPACE_SNAPSHOT_DISK` / `_MAX_BYTES` | `local` / 200 MB | |
| `BILLING_ADDON_BUNDLE_DISCOUNT_PERCENT` | `30` | |

## 6. Security model

**Enforced, and tested** (`DockerCliRuntimeTest`, `SnapshotScriptTest`, `WorkspaceManagerTest`,
`ProjectLabAccessTest`, `verify-isolation.sh`):
- every container: uid 1000, `--cap-drop ALL`, `no-new-privileges`, memory + swap cap, CPU cap, pid cap, no
  `--privileged`/host namespaces/Docker socket, only the student's own volume mounted;
- the connection token travels in the CLI environment (never argv/`ps`), is encrypted at rest, hidden from
  serialisation, rotated on every start, and removed from the container's environment;
- docker object names are validated (no option/shell injection); no shell strings are ever built from input;
- the host firewall blocks workspace↔workspace, workspace→host, private ranges, cloud metadata, SMTP;
- the editor may only be framed by the dashboard (`frame-ancestors 'self' <app origins>` — `'self'` is required because VS Code frames its own pages for webviews and the extension host); both iframes are sandboxed so framed
  code cannot navigate the dashboard away;
- every Project Lab route family has its **own named rate limiter** (`lab-*` in `AppServiceProvider`). Do not switch them to `throttle:N,1`: Laravel keys an unnamed numeric throttle by user only, so differently-limited routes would share one counter and polling the boot status would use up the Start button's allowance (found by the real-Docker end-to-end run);
- the SOW and its PDF are withheld server-side without the add-on (the paywall is the API, not the UI); PDFs
  are watermarked with the student's name + email and every download is logged;
- snapshots are private, never publicly served; staff downloads are authorised and audited; student-facing
  JSON never contains a storage path or operator error text.

**Residual risks — read before launch**
- Student code runs on your hardware. Plain Docker shares the host kernel; a container escape is the worst
  case. **Use gVisor (`--gvisor`) or Kata in production**, keep the host patched, and keep nothing else on it.
- Access to the editor is the unguessable hostname **plus** the token. A student who shares their editor
  URL shares their workspace. Preview URLs (`p<port>--…`) are protected by the hostname alone, like most
  dev-preview tools; treat a running app as public to anyone with the link.
- `deploy` is in the `docker` group — root-equivalent **on the workspace host**. The host must be
  expendable. Rotate its key like any production credential.
- Abuse (crypto-mining, scanning) is bounded by CPU caps, the idle reaper, the hours cap and egress blocking,
  not prevented. Watch host load.
- Volumes live on the host: losing the host loses un-submitted work. Periodic snapshots to object storage are
  a Phase 2 item.
- Payment is a stand-in, so anyone can currently "buy" without paying.

## 7. Operating it

- **Capacity:** a start is refused with 503 `workspace_capacity` when the host is at `capacity`; add a host
  to `WORKSPACE_HOSTS` — new workspaces go to the least-loaded host (existing ones stay where their volume is).
- **Stuck or orphaned containers:** the reaper (every minute) stops containers the database doesn't know
  about (hosts that have never held a workspace are skipped). Manually: `docker ps --filter label=aptrun.managed=1`.
- **Image upgrades:** build a new `aptrun/workspace:latest`; containers pick it up on their next start (they are
  disposable). Extensions added to `extensions.txt` are copied into existing profiles without overwriting theirs.
- **Free a student's disk:** the volume is `wsvol-<enrollment id>-…`; `docker volume ls --filter label=aptrun.managed=1`.
- **Where do I see why a workspace failed?** `project_workspaces.error` holds the Docker error; students only
  ever see a fixed, friendly sentence.
- **Revenue:** the superadmin overview reports `individual_recurring.addon_count` / `addon_monthly_total`
  separately, so Project Lab is visible without being double-counted as a subscriber.

## 8. Local development

- **UI only, no Docker:** `WORKSPACE_RUNTIME=fake` — starting a workspace "succeeds" but nothing serves the
  editor URL. Enough to build and review every screen.
- **Idle stop, hour limits and dead-container clean-up are run by the scheduler** (`workspaces:reap`, every minute). On a laptop nothing runs it unless you start it: keep `php artisan schedule:work` going in a second terminal in `backend/`, or run `php artisan workspaces:reap` by hand. Without it a workspace never idle-stops. The open page's heartbeat also checks that the container still exists (every ~100 s), so a container removed behind the app's back (Docker restart, host reboot, someone running `docker rm`) is noticed within about three minutes either way: the page flips to "Your workspace stopped unexpectedly — Start workspace again", no hours are credited for the dead time, and starting again reuses the same volume, so the student's files are kept. If a row is ever stuck on "Running" with no container, `php artisan workspaces:reap` repairs it.
- **Never clean up Docker test leftovers by name pattern** (`ws-*`, `wsvol-*`): on a developer machine those are real students' (or the developer's own) workspaces. Remove exact names you created.
- **The real thing on a laptop:** start Docker Desktop, then
  ```
  infra/workspaces/build-image.ps1 lite                                 # ~1.3 GB; full is ~3.5 GB
  docker compose -f infra/workspaces/docker-compose.local.yml up -d     # gateway on :8081
  ```
  and in `backend/.env`: `WORKSPACE_RUNTIME=docker`, `WORKSPACE_DOMAIN=localhost:8081`, `WORKSPACE_SCHEME=http`.
  Browsers resolve `*.localhost` by themselves, so `http://ws-<id>.localhost:8081` just works. The firewall
  and gVisor do not apply on Docker Desktop (`verify-isolation.sh` will correctly report the workspace↔workspace
  and SMTP checks as failing there).
  **Why `Caddyfile.local` rewrites a cookie:** VS Code keeps its token in a `SameSite=Lax` cookie, and locally
  `localhost:3000` and `ws-<id>.localhost:8081` are different *sites*, so the cookie would never come back from
  inside the iframe and the editor would 403. The local gateway re-issues it as `SameSite=None; Secure; Partitioned`.
  Production does not need (or have) that rewrite because the app and the workspaces share a registrable domain.
  Chrome/Edge work; a browser that blocks third-party cookies will not work locally for the same reason.
  **The same applies to Preview:** a student's own app (Laravel/Django send `SameSite=Lax`; Express/Flask send no
  `SameSite`) would lose its session cookie inside the iframe, so every login would silently fail locally. The local
  gateway strips whatever `SameSite` the app set and re-issues the cookie partitioned. Verified with a Laravel app:
  session counter 1 → 2 → 3 across reloads and a CSRF-protected form post inside the iframe. Production is same-site
  and has no such rewrite.
  **Behind the production gateway (https) a Laravel app must trust the forwarded headers**
  (`$middleware->trustProxies(at: '*')` in `bootstrap/app.php`), otherwise it builds `http://` links inside an
  `https://` preview and the browser blocks them. The Hospital Management System SOW tells students this.
- **Tests:** `php artisan test` needs dev dependencies (the repo's `vendor` is installed without them; see
  `reference_local_dev_run`). Relevant suites: `ProjectLab*`, `WorkspaceManager`, `ProjectSubmission`,
  `AdminProjectLab`, `Unit/DockerCliRuntime`, `Unit/SnapshotScript`.

## 9. API summary

Student (`role:user`, per-user throttles):

| | |
|---|---|
| `GET /project-lab/topics` · `GET /project-lab/topics/{slug}` | catalog (preview) · topic (SOW only if entitled or free sample) |
| `POST /project-lab/topics/{slug}/start` · `GET …/sow.pdf` | begin a project · watermarked PDF |
| `GET /project-lab/projects` · `GET /project-lab/enrollments/{id}` | my projects · one with milestones, workspace, submissions |
| `POST …/enrollments/{id}/milestones/{m}/toggle` · `…/abandon` | |
| `POST …/enrollments/{id}/workspace/start` · `GET …/workspace` · `POST …/heartbeat` · `POST …/stop` | |
| `POST …/enrollments/{id}/submit` | `repo_url?` `live_url?` `notes?` |
| `GET /me/purchase-quote` · `POST /me/subscription` | `plan_code?` `addons[]?` `expected_total?` |

Staff (`permission:project_lab`): `GET|POST /admin/project-lab/topics`, `GET|PUT|DELETE …/topics/{id}`,
`GET /admin/project-lab/submissions`, `GET …/submissions/{id}`, `GET …/submissions/{id}/snapshot`,
`POST …/submissions/{id}/review`.

Errors carry a stable `code`: `project_lab_required` (402), `workspace_hours_exhausted` (402),
`active_projects_full` (409), `workspace_capacity` (503), `workspace_host_error` (503),
`workspace_not_running` (409), `workspaces_disabled` (503), `price_changed` (409), `snapshot_too_large` (422).

## 10. What has and has not been verified

**Verified end to end** on a Windows machine with Docker Desktop and the lite image, against a real MariaDB 10.4: the full API
flow (buying, SOW + PDF, start, workspace boot in ~17 s, every hardening flag as Docker applied it, token handling, the
gateway including wrong/missing tokens and unknown hosts, live preview, stop/restart persistence, snapshots with the
exclusion rules and a real symlink, review loop, idle/lapse/orphan reaping) — 111 checks — and the whole student and staff
UI in real Chromium with real VS Code in the iframe — 35 checks — plus 581 backend tests, 118 frontend unit tests, and a
production static export.

**Added with the first project (Hospital Management System):** the SOW's own setup steps were run in a hardened
workspace container exactly as a student would (`composer create-project` on today's Laravel 13 in ~30 s, `npm run
build`, the Laravel Breeze path, trusted proxies, Preview with sessions and CSRF); the whole student journey was
driven in Chromium against an isolated copy of the app (locked page leaks no SOW text, purchase, SOW with 17 tables and
a Copy-able code block at desktop and phone width with no horizontal overflow, PDF download, workspace boots in ~30 s,
`.aptrun/SOW.md` opens in VS Code); the PDF was rendered and read page by page (21 A4 pages); the full backend suite
(585 passed, 3 environment skips) and 118 frontend tests pass.

**Not verified — do these before admitting students:** `host-bootstrap.sh`, `host-firewall.sh`, gVisor and the
production `Caddyfile` (wildcard TLS via DNS-01) have never run on a Linux host; the `full` image flavour (Java, MariaDB,
PostgreSQL, Redis, `lab-db`) was built only as `lite`; a ssh:// or TLS Docker host was not exercised (only the local engine);
behaviour under load (many concurrent workspaces) was not measured.

## 11. Not built yet (Phase 2)

AI review of submissions against the acceptance criteria · periodic snapshots to object storage and
host-to-host migration · a payment gateway · giving a college's students Lab through the TPO dashboard ·
certificates · automatic cleanup of the volumes of students who never came back · export to GitHub · a workspace-hours report for staff · notifications when a review lands.

## 12. Authorship: students write the code themselves

**The rule.** In the editor and terminal a student can paste only text that was copied from **inside the workspace** (editor or terminal), or a command from a `bash` block of the SOW. Text from other tabs, windows or apps is refused with a notice. Searching the web, switching windows and reading docs are not touched (this is not proctoring). Copy-and-paste inside the workspace (a whole file into another folder, a line between files, terminal output) always works. Students are told in the SOW, in the top-bar chip and in the quick-start tip.

**The layers** (the browser is the student's, so: prevent the normal ways, record the abnormal ones).

| Layer | What it does | Where |
|---|---|---|
| Guard | Refuses outside text through every door the client has: the `paste` event (editor, terminal), `navigator.clipboard.read*` (terminal Paste, menu/palette Paste), `drop`/`dragover` (text; OS files unless every file is an image/font/audio/video/pdf), file pickers, script-made (untrusted) paste/drop/input events, `document.execCommand('insertText')` (text-expander extensions), large non-IME insertions, and `window.open('')` (an extra editor window would have no guard). It keeps only fingerprints of what was copied inside, never the text. | `infra/workspaces/guard/aptrun-guard.js`, loaded first by `workbench.html` |
| Fixed extensions | Marketplace removed, extension folder read-only: no AI assistant, no VSIX, no `code --install-extension`. | `Dockerfile`, `extensions.txt`, `entrypoint.sh` |
| Evidence | Metadata only (kind, size, where, when): refused pastes, typing faster than a person or at metronome regularity, and a pulse proving the guard runs (coverage). At submit: git history read from the container and any extra extension, frozen on the submission. | `WorkspaceIntegrity`, `AuthorshipReport`, `GitHistoryScript` |
| Reviewer | An "Authorship" card per submission (label, reasons in words, numbers, git history, timeline) and a badge in the queue. A pointer, **never a verdict**: it changes no score and blocks nothing. | admin review page |

**How it fits together.** The guard says `hello` to the dashboard page that embeds the editor; the page (`useAuthorshipGuard`, `lib/projectLabGuard.ts`) replies with the policy **the server chose** (`guard_mode` in the workspace payload) plus the SOW's bash blocks. Messages are accepted only from the editor frame's own window **and** origin. The page relays reports every 30 s and when the tab is hidden or closed, and flushes just before a submission so the frozen evidence is complete. Until a policy arrives, or when the editor is opened outside the dashboard, the guard **enforces** (fail closed).

**Switches.**
- `WORKSPACE_PASTE_GUARD=enforce|report|off` (`config/authorship.php`). `report` refuses nothing but records what would have been refused, for piloting; `off` turns it off everywhere.
- Per project, in the project editor: *Pasting from outside the workspace*: Refused (default) or Allowed. Allowed projects get no guard, no chip and no check.

**The label rules** are in `config/authorship.php` (`rules`) and unit-tested: coverage of the session by the guard, volume/size of refused pastes (a few refused pastes are normal), scripted input, typing no person produces, git history (the repository's first commit, the framework skeleton, is excluded from the numbers: many commits over time vs one enormous commit or a few minutes of history) and extra extensions. Each signal that fires is shown with its reason. Tune thresholds there.

**Privacy.** Only counts, sizes, targets and times are sent and stored. There is no column that could hold text, and tests assert that no clipboard or typed text reaches an event or the review payload. Raw events are pruned after 180 days (`retention_days`); the summary a reviewer read stays frozen on the submission. Students see exactly what the reviewer will see (chip popover, submit dialog).

**Verified** (real VS Code in real Chromium, the real image, the real dashboard): outside paste refused in the editor, the terminal (Ctrl+V and Ctrl+Shift+V), the context-menu/palette Paste, and after an editor reload; the same when the editor is opened directly (no dashboard); copy-a-file-into-another-file, editor to terminal, and a SOW command from the real Copy button all work; outside text and a `.php` file dragged in are refused, an image is accepted; script-made paste events and a console `execCommand('insertText')` are refused; extra editor windows are refused (VS Code shows its own "Unable to open a new window" dialog beside the guard's notice); nothing can be installed; a typing bot is flagged and human-paced typing is not; a guard blocked in the browser turns the chip amber and is noticed in the evidence; an "allowed" project is left completely alone; evidence is frozen at hand-in and no text appears in it. Also 630 backend tests (the new ones also on real MariaDB 10.4) and 192 frontend tests.

**What it cannot stop** (say so to anyone who asks): `curl` / `git clone` in the terminal (the git-history evidence is for that); a student building a "paste page" inside their own app and opening it in Preview; a typing bot that mimics human rhythm; a scripted browser extension that rewrites the editor's input box; someone who blocks or patches the guard in their own browser (then **coverage drops and the report says so**). Retyping code read in an AI chat is allowed by definition. A strong deterrent plus evidence, not proctoring.

**Operating notes.**
- **After bumping `OPENVSCODE_VERSION`**: rebuild. The build fails if any of the patched texts changed (the three first-launch defaults, `workbench.html`). Then open a brand-new workspace (no AI panel, no walkthrough) and re-run the checks above against the new client. The guard also removes `globalThis.EditContext` so VS Code uses its textarea input, where insertions are observable: re-check that VS Code still decides on `typeof globalThis.EditContext`.
- **Line endings.** Shell scripts must be LF. A Windows checkout (or a Python/PowerShell edit) can turn `#!/bin/bash` into `#!/bin/bash` plus a carriage return, and the container then dies with "exec ... No such file or directory". `.gitattributes` asks for LF and the Dockerfile strips carriage returns from the scripts it copies, but do not rely on either when editing.
- A workspace started before this image was built keeps the old editor until it is stopped and started again.
- A student who hits a false refusal can always type the text. If a legitimate source keeps being refused, make it a `bash` block in the SOW or set the project to Allowed.
