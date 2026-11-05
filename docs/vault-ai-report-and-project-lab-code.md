# Vault AI Interview report · Vault AI in 2nd place · Project Lab: code only from the editor (2026-11-05)

Three changes, none of which touches `infra/workspaces/**` or `backend/app/Services/Workspaces/**` (the parts already deployed and running on AWS).

## 1. Vault AI Interview results and report

**What is stored.** One row per student and stack in `vault_ai_results` (migration `2026_11_18_100000`): the **final average of the three sets**
of the **best series**, its three set scores, how many attempts, whether they ever qualified, every completed series (`history`), and a pointer to the
stored PDF. The ledger is fed from `VaultInterviewQualificationService::evaluateSeries` (the one place a series is closed, by the live flow and by every
superadmin correction) through `refreshLedger()`.

**Best score survives a second go.** A qualification forgets (an admin's "fresh start" wipes the series that qualified the student; only *failed* series reach
`attempt_history`). The ledger keeps every completed series, so a student who sits again — after a cooldown or after a reset — keeps their best, and a worse later
attempt never lowers it. A qualifying series that a reset wiped stays on record, flagged `reset`. A qualification an admin granted outright is recorded as such, with no
invented set scores. (This is separate from `users.vault_ai_score`, the existing "best so far" number on the student.)

**The PDF** (`reports/vault-ai.blade.php`, `VaultAiReportService`): student and college, stack and role, the big final average with the pass mark, the three sets of
the best series (each with its score bar), every attempt (best marked), and — for the best series — each set with every question, the answer and the AI feedback,
plus proctoring strikes. It is generated automatically when a series completes (after the transaction commits; a PDF failure never touches the result), stored in the
existing report archive (`generated_reports`, kind `vault_ai_report`, private disk, SHA-256 verified on download) and **replaces** the previous file, so there is
one current report per student and stack.

**Who sees what**
| Who | Where | Endpoint |
| --- | --- | --- |
| Student | Vault AI Interview page → "Your results" (final average, set scores, attempts, Download / Refresh PDF) | `GET /me/vault-ai/results`, `POST …/{stack}/report`, `GET /me/reports/{id}/download` |
| TPO | new sidebar item **Vault AI Results** (`/admin/vault-ai`): own college, search / stack / qualified filters, CSV export, PDF per student | `GET /tpo/vault-ai/results`, `POST …/{result}/report`, `GET /tpo/reports/{id}/download` |
| Mellow staff / superadmin | Vault → **AI Interview results** tab (all colleges) and a "Results & reports" block in the student's Manage → Vault AI tab | `GET /admin/vault-ai/results`, `…/students/{id}/results`, `POST …/{result}/report` |

Access is `ReportAccess::report` (extended for this kind): the student, their TPO, their coordinator and platform staff — the same people who may read the student; a wrong guess is a 404.
Results that predate the ledger appear the first time someone opens a list (a bounded batch per call); `php artisan vault-ai:rebuild-results --reports` fills everything at once.
Deleting a student removes their rows and report files.

## 2. Vault AI Interview is the 2nd item of Placements

`studentNav.ts`: Upcoming Drives · **Vault AI Interview** · Company PYQs · Mock AI Interview · Mellow Vault (it was 4th). The lock / "Priority" behaviour is unchanged.

## 3. Project Lab: all coding in the AptRun editor, zipped by AptRun

What was already true: the editor is the AptRun workspace, the code is packed **by the server out of the running container** (there is no upload route), and the editor's
guard refuses outside pastes/drops/uploads and reports it to the reviewer. What this adds, in new files only:

* **A hand-in needs the snapshot.** A repository link on its own is no longer a submission (`409 workspace_not_running`); links are only a reference next to the snapshot.
  Kill switch: `PROJECT_LAB_REQUIRE_SNAPSHOT=false` brings the old behaviour back.
* **Save progress** (new): a checkpoint of the open editor, kept privately (`project_saves`, migration `2026_11_18_100100`, newest 10 per project, `lab-save` limiter). The
  dialog opened by the existing Submit button is now "Save & submit": **Save progress** and **Submit for review**, the saved list with a `.zip` per save, no repository field.
* **No file is accepted anywhere**: `POST …/submit` and `…/saves` refuse a request that carries a file (`422 uploads_not_accepted`); a test pins the full list of project-lab write routes so a
  new one cannot appear unnoticed.
* **Copied-in code is caught** (`SnapshotInspector`): the snapshot's file times are read; a file older than the workspace was copied in (unzipped, `cp -p`, `rsync -a`). Archives inside the project
  are listed. It is evidence on every submission, and it **refuses** a hand-in only when ≥ 10 files and ≥ 80% of them predate the workspace (`422 imported_files`; the snapshot is discarded and the
  student can fix and resubmit). `PROJECT_LAB_PROVENANCE_ENFORCE=false` makes it evidence-only. Failure to read the archive is never an error.
* **Zip**: the stored `.tgz` is never altered; a `.zip` is built on demand (student: own saves and hand-ins; staff: `?format=zip`, default stays `.tgz` so nothing deployed changes).
* **Reviewer**: the review screen gets "What was handed in": every file with size, one file as text, and the checkpoints the student saved (each a zip), plus the provenance warnings.
* Files: `config/project_lab.php` (not `config/workspaces.php`), `app/Services/ProjectLab/{TarReader,SnapshotInspector,SnapshotArchive,SnapshotTaker,ProjectSaveService}`,
  `ProjectSubmitController` (the `/submit` route now points here; `ProjectWorkspaceController` is untouched).

**Honest limits.** A zip dragged into the editor is blocked by the editor's guard (unchanged, deployed); if a student switched the guard off, the existing coverage signal flags it, and the
file-time check catches what was unzipped or copied with times preserved. A project typed out from someone else's code cannot be told from one's own — that stays a reviewer's call, now with evidence.

## Deploy
1. Back up, run **`aws-db-update-2026-11-06.sql`** (2 new tables, idempotent, verified on MariaDB twice) or `php artisan migrate --force`.
2. `php artisan route:cache && php artisan config:cache`.
3. Deploy the frontend build. Nothing on the workspace hosts changes.
4. Optional, once: `php artisan vault-ai:rebuild-results --reports`.

## Verified
Backend `VaultAiResultsTest` (13), `ProjectLabCodeFromEditorTest` (14) and the updated `ProjectSubmissionTest` / `AdminProjectLabTest`; frontend `vault-ai-results-and-lab-save.test.tsx` (13) and the nav test; a real-browser run on a scratch MariaDB
(sidebar order, the student card and PDF download, the TPO list, the staff tab, the Project Lab dialog and the reviewer panel).
