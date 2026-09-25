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

// Daily: flip any subscription past its current_period_end to expired.
Schedule::command('subscriptions:expire')->daily();

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
