# AptRun Guardian

The Windows agent behind `INTEGRITY_*_GUARDIAN`. It watches the operating system, which a web page cannot, and reports to the
server over **its own signed channel** — so patching the exam page changes nothing it says.

One static executable, written in Go, with **no third-party packages** (read it; rebuild it). It needs no administrator
rights and installs nothing except an optional per-user `aptrun-guardian://` link handler.

## What it looks at

| Check | How | Reported as |
| --- | --- | --- |
| Which program is in front | `GetForegroundWindow`, 10×/s; the exam window is found by the marker the page puts in its title | `os_foreground_away`, `os_exam_window_missing` |
| Forbidden programs | process list matched **exactly** by name, then the file's own metadata (survives a rename), then window titles | `forbidden_process` (+ category) |
| Windows hidden from screen sharing | `GetWindowDisplayAffinity` on every window of every other program — what "invisible AI assistants" use | `capture_excluded_window` |
| Click-through overlays | topmost + layered/transparent windows covering ≥ ¼ of the screen | `overlay_window` |
| Extra / virtual screens | `SM_CMONITORS`, display adapters named virtual / indirect / spacedesk / … | `multi_monitor_os`, `virtual_display` |
| Virtual machine | BIOS strings + drivers/programs that exist only **inside** a guest. *Not* the hypervisor CPU bit — a normal Windows 11 PC with core isolation or WSL2 reports it | `vm_detected` |
| Remote desktop | `SM_REMOTESESSION`, `rdpclip`, remote-control programs | `remote_session` |
| Proxy / VPN | system proxy settings, a local proxy a browser is connected through (TCP table), tunnel adapters (adapter *description*, not just name) | `proxy_detected`, `vpn_detected` |
| Interception | a new trusted root certificate, an edited hosts file, changed DNS servers | `root_ca_added`, `hosts_modified`, `dns_changed` |
| Typing done by software | low-level hooks read the **injected** flag Windows sets on `SendInput` events. Counts only — never which keys | `injected_input` |
| Browser started to be controlled | the browser's command line (PEB read, same user): remote-debugging port/pipe, `--load-extension`, `--proxy-server`, `--ignore-certificate-errors`, `--host-resolver-rules`, automation | `browser_flag` |
| HTTPS being read | certificate chain presented by *our* server vs the published public-key pins (`GUARDIAN_TLS_PINS`) | `proxy_detected` (via `tls_pin`) |
| Hardware typing devices | Raw Input keyboard / mouse count, compared with itself | `input_device_added` |
| Tampering with itself | debugger attached, its own executable's SHA-256 (checked against the released builds) | `debugger_attached`, `guardian_integrity` |

Anything present when the student presses **Start** is a *pre-flight blocker*: the page lists it and what to close, and nothing is
held against them. Only things that appear **after** the attempt began cost strikes — and the server decides what each costs.

## Trust model — what it is and is not

* It holds an **Ed25519 private key** (protected with DPAPI, so the file is useless on another account or machine) that the web
  page never sees. Every report is signed over `link id | sequence | SHA-256(body)`; the server verifies it, refuses replays, and
  ties it to a revocable link belonging to that student.
* The server **cross-checks it against the page**. If the OS says Discord took the foreground and the page never noticed, the
  page is lying or patched (`guardian_page_mismatch`). If the screen size, time zone and address the Guardian reports do not match
  the page's, the Guardian is on a different machine (`guardian_host_mismatch`).
* It is **not a kernel driver**. A determined person with administrator rights can attack a user-mode program (patch its memory,
  hook its API calls, run it in a sandbox). What this buys is a high price and a loud failure: tampering shows up as a hash
  mismatch, a debugger, or a disagreement with the page. See `docs/exam-integrity.md` → *What this cannot do* for the honest list,
  and *Roadmap* for the kernel-level step (needs an EV code-signing certificate and Microsoft attestation signing).

## Build, test, ship

```powershell
powershell -ExecutionPolicy Bypass -File build.ps1 -Version 1.0.0 -Api https://api.yourdomain.com/api   # tests, builds, prints the SHA-256
powershell -ExecutionPolicy Bypass -File package.ps1 -Publish local                                      # puts the installer where the local server offers it (and makes dist\AptRun-Guardian.zip)
powershell -ExecutionPolicy Bypass -File scripts\verify-windows.ps1 -Exe dist\aptrun-guardian.exe        # proves the detectors fire on THIS PC
```

**How students get it.** The exam page's Guardian card has a *Download for Windows* button. The server serves
`aptrun-guardian.exe` itself from `backend/storage/app/guardian/` (`GET /api/guardian/download`, public, rate-limited), together with
its size, version and SHA-256, so there is nothing else to host. On a VPS copy `dist\aptrun-guardian.exe` and `dist\aptrun-guardian.json`
into that folder. Build each environment with its own `-Api` (a double-clicked copy has no link to read the server from).

Then on the server: `GUARDIAN_ALLOWED_BUILDS=<the SHA-256>`. To host the file somewhere else, set `GUARDIAN_DOWNLOAD_URL` instead.

Sign the executable (an Authenticode certificate) before wide release, or students will see a SmartScreen warning.

## Running it

```
aptrun-guardian                      start (asks for the code on the exam page the first time)
aptrun-guardian aptrun-guardian://…  opened from the exam page's "Open Guardian" link
aptrun-guardian --code ABCD-EFGH     pair with a code, then start
aptrun-guardian --check              scan once and say what would block an exam
aptrun-guardian --dump               print everything it would report (for support)
aptrun-guardian --forget             disconnect and delete the saved identity (keeps the program)
aptrun-guardian --install            keep a copy in the folder below and register the "Open Guardian" link (also done on first run)
aptrun-guardian --uninstall          remove the link and that copy
```

A lab that deploys the program itself (software push, a fixed folder) can set `APTRUN_NO_SELF_INSTALL=1` so the first run does not copy it or touch the registry.

State, and the program's own copy, live in `%LOCALAPPDATA%\AptRunGuardian`. The server needs PHP's **sodium** extension to verify reports.
