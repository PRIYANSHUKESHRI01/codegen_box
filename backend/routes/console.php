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

// Every 10 minutes: re-score students who were just active and apply it to the Vault — list those who have
// reached the bar and said yes, take down those who have fallen clearly below it. Nightly, the same for every
// student seen in the last 120 days plus the whole Vault, because a score also falls as time passes.
Schedule::command('readiness:refresh')->everyTenMinutes()->withoutOverlapping(15);
Schedule::command('readiness:refresh --all')->dailyAt('02:30')->withoutOverlapping(180);

// Every minute: hand whatever is waiting in the Vault outbox to Mellow Vault (see VaultSyncService). It does
// nothing, and loses nothing, until VAULT_SYNC_URL and VAULT_SYNC_SECRET are set.
Schedule::command('vault:sync')->everyMinute()->withoutOverlapping(5);

// Daily: drop delivered Vault outbox events past their retention.
Schedule::command('vault:prune')->daily();

// Daily: flip any subscription past its current_period_end to expired.
Schedule::command('subscriptions:expire')->daily();

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

// Every 5 minutes: score/rate any contest whose end_at has passed. Kept
// frequent (not hourly) since a contest's rating results are the whole
// point of entering it — students should see them soon after it ends, not
// wait for the next hour boundary. A manual override also exists
// (POST /admin/contests/{contest}/finalize) given the same "nothing fires
// without a real server cron" caveat as report:weekly-readiness above.
Schedule::command('contests:finalize')->everyFiveMinutes();

// Daily, just after midnight IST (well before the 7-8 PM slot itself) so
// the contest is visible in every student's "Upcoming" list and registrable
// all day. onOneServer() is safe here (default CACHE_STORE is 'database',
// which supports atomic locks) but the real idempotency guard is
// Contest::daily_key's unique DB index — see GenerateDailyContest.
Schedule::command('contests:generate-daily')
    ->timezone(config('contests.daily.timezone'))
    ->dailyAt('00:05')
    ->onOneServer();

// Daily, mid-morning IST (a sensible hour to receive a nudge, and well clear of the 00:05 contest generation): the due
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
