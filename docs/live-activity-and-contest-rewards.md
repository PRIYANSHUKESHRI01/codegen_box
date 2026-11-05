# Live Activity, Needs-attention list and Contest Rewards (2026-11-05)

Superadmin gets three new things: **who is on AptRun and what colleges do with the logins they were given** (Live Activity),
**what needs attention today** (Overview), and **weekly voucher prizes you can set ahead of time and pay out from a ledger**
(Contest Rewards). Everything below was run end to end in a real browser against a scratch MariaDB.

## 1. Live Activity (Superadmin → Live Activity)

| View | Answers |
| --- | --- |
| **Live now** | Online now (by role), last 15 minutes, today, this week, last 7 / 30 days, sign-ins today, demo logins opened today, accounts that chose a password today, average visit length; people per hour for 24 h; daily active (30 days); weekly active (8 weeks); the screens people are on this minute; busiest colleges; everyone online with what they are looking at. Refreshes every 10 s while the tab is open. |
| **Colleges & logins** | Every college with where its TPO login stands: *Login not opened* · *Tried, no password yet* · *Password set, not in yet* · *Active* · *Gone quiet*. Plan / demo days left, students on file / chose a password / active this week, last seen, online now. "Needs a call first" sort. |
| **One college** | Per TPO / coordinator account the road: login issued → opened the login → chose a password → first signed in → last seen (a date, or "not yet"), failed attempts; the students' funnel; daily curve; **screens used with opens, people, average time and average scroll depth**; what just happened; people (click one for their visits). |
| **One person** | The same road, sections used, every visit with each screen in order (time on it, how far scrolled), sign-in history with device and IP. |
| **Sign-in log** | Every login, failed login, one-time-password use, code request, first password and password change — including addresses that matched nobody. |
| **Usage patterns** | Visits by weekday × hour (India time), most used screens platform-wide. |

### Where the data comes from

* **The browser reports** (`frontend/src/lib/activityTracker.ts`, mounted in the root layout by `ActivityRuntime`): which screen, seconds the person
  was really doing something (a key / click / scroll / touch in the last 90 s), the deepest scroll of the page's own scroll area (the sidebar is ignored).
  About once a minute while the tab is visible, once ~3 s after a screen opens, and once as a tab is hidden. Only the path and the page's own
  `?tab=` / `?section=` are sent — never the query string, form contents or anything typed. A superadmin and a "view as" session are never recorded.
  `POST /api/me/activity` (limiter `activity-report`, 30/min/user) is quiet by design: it answers 200 even when off or not migrated.
* **The server** (`App\Services\Activity\*`): `ActivityRecorder` keeps the visit, its page views (a page's row is *raised* to the latest totals, so a
  report that arrives twice changes nothing), the person's day, and `users.last_seen_at` (so the TPO's cohort "last seen" is now real activity).
  `AuthEventRecorder` writes the sign-in log from `AuthController::login`, `updatePassword` and `PasswordResetService` (first password vs later change).
* **Online now** = a visit heard from within `activity.online_window_seconds` (150 s). Days are India days.

### Tables (migration `2026_11_17_100000`; no seeder needed — they fill as people use the product)

`activity_visits`, `activity_page_views`, `user_activity_days` (the roll-up the daily/weekly/monthly counts are read from), `auth_events`.
No foreign key to colleges (a purged college's rows are removed by `CollegePurgeService`); user deletion cascades (and removes the person's `auth_events`).
Retention (`config/activity.php`): page views 90 d, visits 180 d, day roll-ups and sign-in log 400 d — `activity:prune` daily 03:55.

### Config / env

`ACTIVITY_TRACKING` (default true), `ACTIVITY_REPORT_EVERY` (60), `ACTIVITY_ONLINE_WINDOW` (150), `ACTIVITY_DORMANT_DAYS` (7), `ACTIVITY_WAITING_DAYS` (3), retention keys.

## 2. Needs attention (Superadmin → Overview)

A live strip (online now / today / 7 days / sign-ins today) and a short list, each item saying what is wrong and where to go: colleges whose login was
issued > 3 days ago and has not got going (click a college to open it), colleges gone quiet, plans ending this week, payments needing review,
winners waiting for a voucher, **the next Daily Challenge not existing**, failed jobs, and **the scheduler not running** (a heartbeat the scheduler
stamps every minute; no tick for 5 minutes → critical). An empty list says so.

## 3. Contest Rewards (Superadmin → Contest Rewards)

* **Daily Challenge status card** — the edition on the calendar (start/end in IST, its three problems with points, registered, registration window) and the last one.
  Red "Nothing scheduled" when no edition exists.
* **Prizes by week** — this week and the next four. Pick a week, put voucher cards on it (`Schedule`; `Go live` for the current week), or *Same as the week before*.
  Up to 8 weeks ahead; a week that has ended cannot be changed. A week's cards start showing to every student **by themselves when its Monday arrives**
  (the students' banner also previews next week once it is chosen). Stored as `platform_modules` rows `wr:<monday>:<card>` — no migration for this.
* **Winners & vouchers** (ledger; migration `2026_11_17_100100` → `weekly_reward_winners`): `rewards:finalize-weekly` runs daily at 00:15 IST (Monday's run does the work; the
  button "Close out last week" does it now) and records everyone who held a prize rank + sends a bell notification. You buy/send the voucher, paste the code (stored
  **encrypted**), **Mark sent** → the student is told and sees the code on their Contests page ("Your rewards"). Cancel / reopen supported; every write is audited.
* Ties: tied students all get that rank's prize (unchanged). The ledger copies the person and the prize onto the row, so history survives an edited shelf or a deleted account.

## 4. Deploy (production runs on AWS; the user edits production)

1. Backup, then run **`aws-db-update-2026-11-05.sql`** (5 new tables, idempotent; verified on MariaDB twice) — or `php artisan migrate --force`.
2. `php artisan route:cache && php artisan config:cache` (new routes, `config/activity.php`, new limiters).
3. The server cron `* * * * * php artisan schedule:run` must exist (it now also runs `rewards:finalize-weekly`, `activity:prune`, `scheduler:heartbeat`).
4. Deploy the new frontend build (the tracker is part of it; until then Live Activity is simply empty).
5. After deploy, once: `php artisan contests:generate-daily` (creates/aligns the next 8 PM edition).

## 5. Verified / not

Backend: `ActivityTrackingTest` (18), `WeeklyRewardScheduleTest` (10) + the existing `DailyChallengeTest`, `WeeklyLeaderboardTest`. Frontend: `activity-live.test.tsx` (20), `weekly-rewards.test.tsx` (18). Real browser on scratch MariaDB:
TPO + students browsing (reports fired by the real tracker), superadmin viewing every screen, scheduling next week's voucher, going live, closing out last week, marking a voucher sent, the winner seeing their code.
The `daily-check.php` run created the 8 PM IST edition with 3 problems (easy/medium/hard, 100/200/300), twice-safe, told every student.

**Not done:** e-mail to winners (bell only); pushing "you are inactive" to colleges; IP geolocation; per-element (not per-screen) scroll heat; a per-college "send reminder" button; the activity of public (not signed-in) visitors.
