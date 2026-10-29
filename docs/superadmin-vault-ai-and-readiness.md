# Superadmin: Vault AI Interview & Readiness scores

Both live inside the **student Manage drawer** (Master Control → Students → click a student), not on tabs of their own:
the **Vault AI** tab of the drawer, and the **Set score** button on the Overview tab's readiness card. Both are live: the
student's next request sees the change, and every change is written to the Audit Log (who, what, why). Both are student-only.

## 1. Vault AI tab (in the drawer)

Shows the student's **gate** in front of the interview, every stack they have touched, failed attempts, and what was done by hand.
A stack the student hasn't started can be picked from "Work on another stack" (e.g. to mark them qualified). Per stack:

| Action | What it does |
|---|---|
| **Give access again** / **Give 3 fresh attempts** | Back to Series 1 with all three attempts, block ended, student can start at once. Failed attempts stay on record here but the student no longer sees them (`cycle_start`). Anything half-sat is orphaned (`attempt_offset`), so an old interview can never be mistaken for, or re-score into, the new cycle. |
| **Take qualification back** | Same reset on a qualified student, **and** the Vault follows: if they hold no other stack and readiness doesn't earn the place, they leave the Vault and Mellow Vault is told to withdraw them (`VaultService::revokeAiInterviewQualification`). Their "best Vault AI score" is recomputed from what still stands. |
| **Enter marks** | Marks for the series being sat. Fill any sets; once all three have a mark the **same rules as a real sitting** apply (`VaultInterviewQualificationService::evaluateSeries`): ≥ 60 qualifies, < 60 moves to the next series, a failed Series 3 starts the 45-day block. The dialog says what the marks will do before saving. |
| **Correct** (on a failed attempt) | Rewrites that attempt's three marks. Lifting it to ≥ 60 qualifies the student and ends any block. Still < 60 = record corrected, nothing else changes. |
| **Edit marks** (qualified) | May raise or adjust, never below 60 — use "Take qualification back" for that. |
| **Mark qualified** | Qualifies outright at a chosen average (60–100), no sitting needed. Recorded as set by the superadmin (`qualified_by_admin_id`), shown as "by hand". |
| **Open it now** (gate card) | For a student locked by the waiting period / readiness line: writes the same `users.vault_ai_unlocked_at` the system writes on a first unlock. Not offered for "year not set" / "year not offered" — those aren't about waiting. |

Every action needs a reason, notifies the student (in-app), and is logged on the qualification (`admin_log`, last 40) and in the Audit Log.

## 2. Readiness: "Set score" on the Overview tab

The readiness card shows the student's live score (and a "Set by hand" tag while one is pinned). **Set score** pins a student's readiness score (0–100) with a required reason and an optional end date (7/30/90/365 days or until removed).
**Use the calculated score** removes the pin. The editor also shows what the score is made of and the history of hand changes.

How it reaches "everywhere": the pin is applied inside `ReadinessScoreService` (the one place a score is computed), so the student's
dashboard / reports / Vault page, the TPO roster and reports, the weekly digest, the Vault entry/exit line and the history chart all read
the same number. `ReadinessOverrideService` then re-runs the Vault refresh for that one student so the stored score
(`users.readiness_score`), today's history point and the Vault profile move **immediately** (a score over 60 puts the student in the
Vault; a student already listed leaves only once the pinned score is under the exit line, 55).

While pinned: `score` = `base_score` = the pin, the missed-day penalty is 0 (a decision, not arithmetic), the tier and the Vault
"qualifies" flag follow the pin. The components still show what the student has done. The student sees "Your score of N was set by the
AptRun team. Your own activity adds up to M" (`readiness.override`); the **reason is never sent to the student**.

## Deploy

1. `php artisan migrate` — 2 migrations: `readiness_overrides`; `vault_interview_qualifications` gets `admin_log`, `attempt_offset`, `cycle_start`, `qualified_by_admin_id`.
2. `php artisan route:cache` (new routes: `GET|POST|PUT /superadmin/vault-ai/students/...`, `GET|PUT|DELETE /superadmin/readiness/{user}`).
3. Frontend build. No config/env changes.

Before `migrate` everything fails soft (no pin applies; the drawer section errors until the tables exist).

## Known edges

- A pin with no end date outlives the student's progress: if their real score rises above it, the pin still wins until removed. The row says "activity alone: N" so it is visible.
- An expired pin is not swept; the next refresh (`readiness:refresh`, student visits) simply stops applying it.
- Natural cooldown expiry now also hides the old failed attempts from the student (it used to show them as red markers on a fresh cycle).
- The gate unlock cannot be undone from the UI (nothing in the product ever re-locks an earned unlock either).
