<?php

/*
|--------------------------------------------------------------------------
| The public landing page's live numbers
|--------------------------------------------------------------------------
|
| GET /api/public/landing (App\Services\Landing\LandingDataService) hands the marketing page everything it quotes that is a fact about
| the platform: how much is on it, what tonight's contest is, which vouchers are on this week, which companies have prep packs, which
| departments it serves. Nothing on that page is typed into the frontend as a number.
|
| Two kinds of number:
|
|   * DEPTH (problems, questions, languages, prep packs): the size of what a student gets. Always shown, and always true.
|   * ADOPTION (students, colleges, contests held, solutions judged, vouchers sent): shown only once it is past the floor below. A page that says
|     "6 colleges" does the product no favours, and a page that rounds 6 up to "50+" lies; so until a number is worth printing the
|     page simply does not print it. Set a floor to 0 to always show that figure.
|
*/

return [

    // Adoption figures appear on the page only at or above these counts.
    'floors' => [
        'students' => (int) env('LANDING_MIN_STUDENTS', 1000),
        'colleges' => (int) env('LANDING_MIN_COLLEGES', 10),
        'contests_held' => (int) env('LANDING_MIN_CONTESTS', 50),
        'solutions_judged' => (int) env('LANDING_MIN_SOLUTIONS', 25000),
        'vouchers_sent' => (int) env('LANDING_MIN_VOUCHERS', 10),
        // "N students registered for tonight" — a half-empty room is not a reason to join it.
        'registered_tonight' => (int) env('LANDING_MIN_REGISTERED', 25),
        // "N students on this week's board".
        'weekly_participants' => (int) env('LANDING_MIN_BOARD', 25),
    ],

    // How many companies the "prep packs" strip shows at most.
    'companies_shown' => 12,

    // Seconds the answer is kept. The live part (tonight's contest, this week's vouchers) is short so a Monday reset shows up promptly;
    // the catalogue counts barely move.
    'cache' => [
        'live' => 60,
        'catalogue' => 600,
    ],

];
