<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Every 7 days: email each college's TPO(s) an Excel list of students
// below the readiness threshold. For this to actually fire, the standard
// Laravel scheduler cron entry must be running on the server:
//   * * * * * cd /path-to-app && php artisan schedule:run >> /dev/null 2>&1
// (nothing fires from this file alone — `schedule:run` is what checks
// "is it time yet" every minute and dispatches due tasks).
Schedule::command('report:weekly-readiness')->weekly();

// Monday morning: each Section Coordinator's digest — their section's numbers and who needs a follow-up this week.
Schedule::command('report:coordinator-digest')->weeklyOn(1, '07:30')->withoutOverlapping(30);

// Every 10 minutes: re-score students who were just active and apply it to the Vault — list those who have
// reached the bar and said yes, take down those who have fallen clearly below it. Nightly, the same for every
// student seen in the last 120 days plus the whole Vault, because a score also falls as time passes.
Schedule::command('readiness:refresh')->everyTenMinutes()->withoutOverlapping(15);
Schedule::command('readiness:refresh --all')->dailyAt('02:30')->withoutOverlapping(180);

// Daily, after that refresh: drop daily readiness scores past their retention (config readiness.history_retention_days).
Schedule::call(fn () => app(\App\Services\ReadinessHistoryService::class)->prune())->name('readiness:prune-history')->dailyAt('03:00');

// Every minute: hand whatever is waiting in the Vault outbox to Mellow Vault (see VaultSyncService). It does
// nothing, and loses nothing, until VAULT_SYNC_URL and VAULT_SYNC_SECRET are set.
Schedule::command('vault:sync')->everyMinute()->withoutOverlapping(5);

// Every five minutes: when Mellow Vault books a student AptRun delivered (VAULT_SYNC_DRIVER=database only; a no-op otherwise), mark them hired here.
Schedule::command('vault:pull-outcomes')->everyFiveMinutes()->withoutOverlapping(5);

// Every five minutes: sync developer profile completion % & pro_id stack from mellow_vault.developer_details_tb and invite >=90% users to Vault AI Interview.
Schedule::command('mellow-vault:sync-profile-completion')->everyFiveMinutes()->withoutOverlapping(10);

// Daily: drop delivered Vault outbox events past their retention.
Schedule::command('vault:prune')->daily();

// The safety net under live AI scoring: a finished interview is scored right after the request that finished it; this catches the rare
// one that was left unscored (a restart mid-scoring) so no student is stuck on "scoring...".
Schedule::command('interview:score-pending')->everyMinute()->withoutOverlapping(5);

// Every ten minutes: the "starting soon" / "closing soon" reminders for college mock AI interviews that have a window (sent once each).
Schedule::command('interviews:remind')->everyTenMinutes()->withoutOverlapping(10);

// Hourly: deadline & 60% readiness reminders for active Launchpad 2026 campaigns (Tech 21d / Non-Tech 5d).
Schedule::command('launchpad:remind')->hourly()->withoutOverlapping(10);

// Daily: remove practice interviews a student built but never took (kept once they have a session).
Schedule::command('interview:prune-practice')->dailyAt('03:50');

// Daily: drop old in-app notifications (read after 60 days, unread after 180).
Schedule::command('notifications:prune')->dailyAt('03:40');

// Daily: flip any subscription past its current_period_end to expired.
Schedule::command('subscriptions:expire')->daily();

// Every minute: grade Core test attempts whose clock ran out without a submit (see FinalizeExpiredCoreTests). Without it an
// abandoned attempt would sit open forever and never count. Needs the every-minute `schedule:run` cron above.
Schedule::command('core:finalize-expired')->everyMinute()->withoutOverlapping(5);

// Nightly: item analysis — which Core questions are too easy/hard, discriminate poorly, or look like they have the wrong key
// (see AnalyseCoreItems). Flags only; a human decides. A quiet hour, after the readiness refresh above.
Schedule::command('core:analyse-items')->dailyAt('03:10')->withoutOverlapping(60);

// Every 5 minutes: ask the payment gateways (PayU, Razorpay) about orders still unpaid — the net under a lost webhook
// and a student who paid and closed the tab (see ReconcilePayments). withoutOverlapping: a slow gateway must not stack runs.
Schedule::command('payments:reconcile')->everyFiveMinutes()->withoutOverlapping(10);

// Every minute: stop Project Lab workspaces that are idle, lapsed or out of
// hours (see ReapWorkspaces). Needs the every-minute `schedule:run` cron above —
// the daily-only schedule this file had until now would not be enough.
Schedule::command('workspaces:reap')->everyMinute()->withoutOverlapping(5);

// Daily: delete authorship reports (refused pastes, typing flags) past their retention. The summary a reviewer
// read is frozen on the submission itself, so this only trims raw event rows.
Schedule::call(function () {
    \App\Models\ProjectWorkspaceIntegrityEvent::where('occurred_at', '<', now()->subDays((int) config('authorship.retention_days', 180)))->delete();
})->name('authorship:prune')->daily();

// Every 5 minutes: close the integrity session of every proctored attempt that is finished or abandoned (see
// IntegritySweep — it never strikes anybody for silence). Daily: delete evidence stills and old attempt logs past their
// retention (config/integrity.php → evidence.*), keeping the stills of flagged attempts longer.
Schedule::command('integrity:sweep')->everyFiveMinutes()->withoutOverlapping(10);
Schedule::command('integrity:prune')->dailyAt('03:20')->withoutOverlapping(120);

// Every 5 minutes: score/rate any contest whose end_at has passed. Kept
// frequent (not hourly) since a contest's rating results are the whole
// point of entering it — students should see them soon after it ends, not
// wait for the next hour boundary. A manual override also exists
// (POST /admin/contests/{contest}/finalize) given the same "nothing fires
// without a real server cron" caveat as report:weekly-readiness above.
Schedule::command('contests:finalize')->everyFiveMinutes();

// The AptRun Daily Challenge: the NEXT edition is created the moment each day's slot closes (the 9 PM IST minute after an
// 8 PM start + 60 minutes — DailyChallengeService::closeTime()), so tomorrow's is on every student's calendar, with a bell
// notification, as soon as tonight's is over. The hourly run is only a net under a missed one (a server that was down at
// 9 PM): by then the edition exists and it does nothing — or, if one was made for the old slot and has not opened, moves
// it to the current name and time. onOneServer() is safe here (default CACHE_STORE is 'database', which supports atomic
// locks) but the real idempotency guard is Contest::daily_key's unique DB index — see GenerateDailyContest.
Schedule::command('contests:generate-daily')
    ->timezone(config('contests.daily.timezone'))
    ->dailyAt(app(\App\Services\DailyChallengeService::class)->closeTime())
    ->onOneServer();
Schedule::command('contests:generate-daily')
    ->timezone(config('contests.daily.timezone'))
    ->hourlyAt(7)
    ->onOneServer();

// Every day just after midnight IST: close out the weekly contest leaderboard that has just finished — one ledger row and one bell
// notification per prize winner (only Monday's run has anything to do; the rest find it already written). The superadmin then sends
// the vouchers from Superadmin → Contest Rewards.
Schedule::command('rewards:finalize-weekly')
    ->timezone(config('weekly_rewards.timezone'))
    ->dailyAt('00:15')
    ->withoutOverlapping(30)
    ->onOneServer();

// Every minute: the scheduler's own heartbeat. Superadmin → Overview raises "the scheduler is not running" when it goes quiet, because
// everything on this page (contests, e-mails, scoring, reports) stops without the server cron and nothing else would say so.
Schedule::call(fn () => \Illuminate\Support\Facades\Cache::put(\App\Services\Activity\AttentionService::HEARTBEAT_KEY, now()->toIso8601String(), 3600))
    ->name('scheduler:heartbeat')
    ->everyMinute();

// Daily, a quiet hour: drop live-activity data (page views, visits, daily roll-ups, the sign-in log) past its retention.
Schedule::command('activity:prune')->dailyAt('03:55')->withoutOverlapping(120);

// Daily, mid-morning IST (a sensible hour to receive a nudge, and well clear of the contest generation): the due
// lifecycle e-mails — plans about to end, students a few points short of the Vault, Vault-ready students whose plan
// has no Vault, free-plan students who have not bought, and win-backs for students who stopped coming. Every message
// carries its own once-only key, so a double run (or two servers) cannot double-send; `php artisan lifecycle:send
// --dry-run` shows what a run would do. onOneServer() is safe: the default CACHE_STORE supports atomic locks.
Schedule::command('lifecycle:send')
    ->timezone(config('lifecycle_mail.timezone'))
    ->dailyAt(config('lifecycle_mail.run_at', '11:00'))
    ->withoutOverlapping(120)
    ->onOneServer();

// Every minute: work off the DEFAULT queue, then exit. On a server whose only background process is the `schedule:run`
// cron, this is what delivers the queued e-mails — bulk notifications to a whole cohort, interview shortlists, drive
// proposals, proctoring reports, and any single e-mail whose first send failed and was handed over for a retry
// (App\Support\SingleMail). Without it those sit in the `jobs` table for ever. If a real `queue:work` is also running,
// the two simply share the jobs (each job is claimed atomically). The judge never runs here: it uses its own named
// queues (judge-*), and a `--queue=default` worker does not read those.
if (config('lifecycle_mail.drain_queue_from_scheduler') && config('queue.default') !== 'sync') {
    Schedule::command('queue:work --queue=default --stop-when-empty --max-time=55 --tries=3 --sleep=1')
        ->everyMinute()
        ->withoutOverlapping(30)
        ->runInBackground();
}

Artisan::command('launchpad:refresh-interviews', function () {
    $count = app(\App\Services\LaunchpadProgramService::class)->refreshUnstartedSlotInterviews();
    $this->info("Refreshed {$count} unstarted Launchpad AI Interview slots with Vault-grade questions.");
})->purpose('Upgrade existing unstarted Launchpad AI Interview slots to tough Vault-calibrated questions');
