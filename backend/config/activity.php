<?php

/*
|--------------------------------------------------------------------------
| Live activity tracking
|--------------------------------------------------------------------------
|
| What the browser reports while someone is signed in (which screen, for how long, how far it was scrolled) and what Superadmin →
| Live Activity reads back. Superadmin accounts and a superadmin's "view as" session are never recorded.
|
*/

return [

    'enabled' => (bool) env('ACTIVITY_TRACKING', true),

    // The day (for "today", "this week") is cut in this timezone; the weekly leaderboard uses the same one.
    'timezone' => env('ACTIVITY_TIMEZONE', env('WEEKLY_LEADERBOARD_TIMEZONE', 'Asia/Kolkata')),

    // A visit heard from within this many seconds is "online now". The browser reports about every `report_every` seconds while
    // the person is actually there, so this is a little over two of them.
    'online_window_seconds' => (int) env('ACTIVITY_ONLINE_WINDOW', 150),
    'report_every' => (int) env('ACTIVITY_REPORT_EVERY', 60),

    // A visit with nothing for this long is over: the next report starts a new one.
    'visit_idle_minutes' => (int) env('ACTIVITY_VISIT_IDLE_MINUTES', 30),

    // Safety limits on one report.
    'max_events_per_report' => 25,
    'max_seconds_per_page' => 4 * 3600,

    // Retention. Page views are the bulk of the data; the day roll-up and sign-in log are small and kept longer.
    'retention_days' => [
        'page_views' => (int) env('ACTIVITY_KEEP_PAGE_VIEWS_DAYS', 90),
        'visits' => (int) env('ACTIVITY_KEEP_VISITS_DAYS', 180),
        'days' => (int) env('ACTIVITY_KEEP_DAYS_DAYS', 400),
        'auth_events' => (int) env('ACTIVITY_KEEP_AUTH_DAYS', 400),
    ],

    // Colleges with no activity for this many days are "dormant" on the superadmin's attention list.
    'dormant_after_days' => (int) env('ACTIVITY_DORMANT_DAYS', 7),
    // An account that was handed a login and has not set a password after this many days is "waiting" and worth a call.
    'waiting_after_days' => (int) env('ACTIVITY_WAITING_DAYS', 3),

];
