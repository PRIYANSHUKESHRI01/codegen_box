# AptRun → Mellow Vault: the database hand-off (temporary, local)

**What it does.** A student whose readiness reaches **60**, who has said **yes** to being found (one standing consent on their Vault page), and
whose plan includes the Vault (a college plan covers its students), is written into Mellow Vault's `developer_details_tb`. If they withdraw, drop
below 55, are blocked or lose the plan, they are taken out of view again. When Mellow Vault books them, AptRun marks them hired.

It is the *last hop only*. Everything before it is the existing outbox (`vault_sync_events`): ordering, debounce, retries with backoff, parked
("dead") events on the admin Vault page. Production keeps using the signed HTTP push (`VAULT_SYNC_DRIVER=http`, see `readiness-and-vault.md`);
this driver exists so the local XAMPP `mellow_vault` database can be filled and checked now.

## Turn it on / off

`backend/.env` (already set on this machine):

```
VAULT_SYNC_DRIVER=database
MELLOW_VAULT_DB_HOST=127.0.0.1
MELLOW_VAULT_DB_PORT=3306
MELLOW_VAULT_DB_DATABASE=mellow_vault
MELLOW_VAULT_DB_USERNAME=root
MELLOW_VAULT_DB_PASSWORD=
```

* Deliver what is waiting, now: `php artisan vault:sync`. The scheduler also runs it every minute (needs the usual `schedule:run` cron).
* Read Mellow Vault's bookings back: `php artisan vault:pull-outcomes` (every five minutes; a no-op on the `http` driver).
* Back to production: `VAULT_SYNC_DRIVER=http` + `VAULT_SYNC_URL` + `VAULT_SYNC_SECRET`. Nothing else changes; waiting events are delivered by whichever driver is active.
* Superadmin → Vault shows which hand-off is in use, the database it writes to, whether it can reach it, and any parked events (with the reason; "Retry" re-queues them).

## What lands in `developer_details_tb`

| Column | New developer | Developer already there (same email) |
|---|---|---|
| `name`, `last_name` | first word / the rest of the AptRun name (20 chars each) | **untouched** |
| `email` | AptRun email | match key (case-insensitive) |
| `phone` | `''` — AptRun never shares a phone | **untouched** |
| `password` | random bcrypt hash nobody knows — they set theirs with Mellow Vault's "forgot password" | **untouched** |
| `show_password` | `''` — AptRun never writes a readable password | **untouched** |
| `pro_id` (NOT NULL) | from `MELLOW_VAULT_PRO_ID_MAP` (AptRun stack/role key → id), else `MELLOW_VAULT_DEFAULT_PRO_ID` (0) | **untouched** |
| `clg_name`, `education` | college name | filled only if empty |
| `degree` | branch | filled only if empty |
| `passing_year` | graduation year | filled only if empty |
| `skills`, `description`, `language` | skills / bio / primary language | filled only if empty |
| `tpo_hod_email`, `hod_verified` | the college's TPO, `1` (the college onboarded them) — `MELLOW_VAULT_COLLEGE_VERIFIED=false` to leave verification to Mellow Vault | filled only if empty / only 0 → 1 |
| `developer_status` | `2` (available) | `0`/NULL → `2`; **`3` (interview pipeline) and `4` (booked) are never changed** |
| `professional_status`, `profile_complete`, `login_status`, `date`, `is_working_in_org` | 0 (fresher), AptRun profile completion, 0, today, 0 | untouched |
| `is_aptrun_synced`, `aptrun_user_id`, `aptrun_synced_at` | 1, AptRun user id, now | linked only if `aptrun_user_id` was NULL — **an existing id is never overwritten** (those rows came from Mellow Vault into AptRun, with AptRun's ids) |
| `college_id`, `resume`, `image`, bank/ID columns | NULL — AptRun cannot know Mellow Vault's ids and never sends files or ID/bank details | untouched |

* **Never duplicated.** An existing developer is found by the `dev_id` AptRun delivered before, else by email (several rows can share one email in the current data: AptRun prefers the one already linked to this student, then the oldest).
* **Withdraw** moves `2` → `0` (or `4` when AptRun's own hiring partner hired them). It never deletes a row and only touches a row AptRun knows is the student's.
* **Fails loudly, never mangled.** A value that cannot fit (today: an email over 50 characters) parks the event as dead with the reason on the admin Vault page; wording (bio, skills) is shortened on a word boundary with "…". Column widths are read from the database, so widening a column takes effect at once.
* A database that is down is retried with backoff; nothing is lost while it is.

## What Mellow Vault needs to include / decide

1. **`pro_id` map.** `pro_id` is NOT NULL and only Mellow Vault knows its professions (61 distinct ids today). Give us AptRun-stack → `pro_id` (e.g. `laravel_developer` → 24) and it goes in `MELLOW_VAULT_PRO_ID_MAP`. Until then everyone gets `0`.
2. **Columns for AptRun's scores** (optional but the point of "crossed 60%"): without them Mellow Vault sees a developer, not *why* — run `mellow-vault-developer-details-additions.sql`. AptRun fills them when present and skips them when not: `aptrun_profile_id`, `aptrun_readiness_score`, `aptrun_readiness_tier`, `aptrun_ai_interview_score`, `aptrun_ai_interview_stack`, `aptrun_listed`.
3. **Widen `email` (50) and relax `phone` (10, NOT NULL).** College emails are often longer than 50 characters (those students cannot be listed at all today); AptRun sends no phone.
4. **`show_password` stores passwords in clear text.** AptRun never reads or writes it, but it should not exist: a database leak exposes every developer's real password.
5. **Booked = `developer_status 4`.** That is the signal AptRun reads to mark a student hired. Keep using it (and keep the row).
6. **Resumes.** AptRun does not copy files. The resume is served at `/api/vault/v1/profiles/{aptrun_profile_id}/resume` with `VAULT_API_KEY`; Mellow Vault fetches it from there (or tell us another way).
7. **`college_id`.** AptRun leaves it NULL; map by `clg_name`/`tpo_hod_email` on your side, or send us your college ids.
8. **Make sure employer search accepts these rows**: they have no usable password yet and may have a low `profile_complete`; if your listing filters on either, these developers will exist but not show.
9. **A unique key on email** (or `aptrun_profile_id`) would make double-writes impossible from any source.

## Caveat while it runs against this snapshot

`aptrun_user_id` in the current `developer_details_tb` holds **production** AptRun ids (72–1166). A developer's row is matched by email, never by that id, and an existing id is left alone, so a local AptRun database whose ids differ cannot corrupt links.

## Tests

`MellowVaultDatabaseSyncTest` (16): new developer mapped, secrets absent, domain map / default, update vs duplicate, existing developer linked without overwrite, link never replaced, pipeline status protected, over-long email dead, withdraw / re-list, optional columns, database down → retry, health, booked → hired, no-op on `http`. Also run against a scratch MySQL copy of the real table (strict mode, real column limits).
