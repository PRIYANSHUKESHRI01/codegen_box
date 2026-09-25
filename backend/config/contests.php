<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Daily Auto-Generated Contest
    |--------------------------------------------------------------------------
    |
    | GenerateDailyContest (scheduled in routes/console.php) creates one
    | platform-wide "Daily Challenge" contest per calendar day: 1 easy, 1
    | medium, 1 hard problem, open for `duration_minutes` starting at
    | `start_time` in `timezone`. All of this is environment-configurable so
    | the slot can move (or the platform's audience/timezone can change)
    | without a code deploy.
    |
    */

    'daily' => [
        'timezone' => env('DAILY_CONTEST_TIMEZONE', 'Asia/Kolkata'),
        'start_time' => env('DAILY_CONTEST_START_TIME', '19:00'),
        'duration_minutes' => (int) env('DAILY_CONTEST_DURATION_MINUTES', 60),

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
