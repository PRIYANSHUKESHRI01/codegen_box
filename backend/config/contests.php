<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Daily Auto-Generated Contest
    |--------------------------------------------------------------------------
    |
    | GenerateDailyContest (scheduled in routes/console.php) creates one
    | platform-wide "AptRun Daily Challenge" contest per calendar day: 1 easy,
    | 1 medium, 1 hard problem, open for `duration_minutes` starting at
    | `start_time` in `timezone` (8:00 PM IST by default). The name, slot and
    | everything derived from them live in App\Services\DailyChallengeService. All of this is environment-configurable so
    | the slot can move (or the platform's audience/timezone can change)
    | without a code deploy.
    |
    */

    'daily' => [
        'name' => env('DAILY_CONTEST_NAME', 'AptRun Daily Challenge'),
        'timezone' => env('DAILY_CONTEST_TIMEZONE', 'Asia/Kolkata'),
        'start_time' => env('DAILY_CONTEST_START_TIME', '20:00'),
        'duration_minutes' => (int) env('DAILY_CONTEST_DURATION_MINUTES', 60),

        // Registration for a daily edition opens this many hours before it starts and closes this many minutes before it
        // starts (it is a scheduled event: you sign up in advance, you cannot wander in once it is under way).
        'registration_opens_hours_before' => (int) env('DAILY_CONTEST_REGISTRATION_OPENS_HOURS', 15),
        'registration_closes_minutes_before' => (int) env('DAILY_CONTEST_REGISTRATION_CLOSES_MINUTES', 1),

        // Points awarded per difficulty — a fixed, simple 100/200/300 split
        // (not admin-configurable per contest, since nobody curates this one).
        'points' => [
            'easy' => 100,
            'medium' => 200,
            'hard' => 300,
        ],

        // Among the N least-recently-used problems of a difficulty, one is
        // picked at random rather than always the single stalest one — keeps
        // the "which problem is today's easy one" outcome from becoming
        // perfectly predictable while still cycling the whole bank evenly.
        'candidate_pool_size' => (int) env('DAILY_CONTEST_CANDIDATE_POOL_SIZE', 10),
    ],

];
