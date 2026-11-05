<?php

/*
|--------------------------------------------------------------------------
| Weekly leaderboard rewards
|--------------------------------------------------------------------------
|
| The weekly leaderboard (contest scores earned Monday to Sunday, resetting every Monday 00:00) can carry prizes: gift
| vouchers for the students at the top. This is the shelf of voucher cards the superadmin picks from. Nothing here is
| "on" by itself — the superadmin presses Go live on a card for the current week (Superadmin → Weekly Rewards) and it
| shows on every student's dashboard until that week ends.
|
| The live cards are handed out in order of value: the most valuable live voucher goes to rank 1, the next to rank 2,
| and so on (equal values keep the order below). So switching on three cards means a top-3 prize list.
|
| `logo` is a file in frontend/public/rewards. `color` is the brand colour the card is drawn in.
| Vouchers are bought and sent by hand — AptRun does not issue them; the superadmin sees each week's winners to send to.
|
*/

return [

    'timezone' => env('WEEKLY_LEADERBOARD_TIMEZONE', 'Asia/Kolkata'),

    // How many places of the weekly board are shown to the superadmin as "this week's winners" at most.
    'winners_shown' => 10,

    'cards' => [
        'burger_king' => ['brand' => 'Burger King', 'amount' => 499, 'logo' => '/rewards/burger-king.svg', 'color' => '#D62300', 'tagline' => 'A Whopper meal on us'],
        'amazon' => ['brand' => 'Amazon', 'amount' => 499, 'logo' => '/rewards/amazon.svg', 'color' => '#FF9900', 'tagline' => 'Shop for anything you like'],
        'zomato' => ['brand' => 'Zomato', 'amount' => 399, 'logo' => '/rewards/zomato.svg', 'color' => '#E23744', 'tagline' => 'Order in, on us'],
        'kfc' => ['brand' => 'KFC', 'amount' => 399, 'logo' => '/rewards/kfc.svg', 'color' => '#F40027', 'tagline' => 'A bucket of finger-lickin\' good'],
        'dominos' => ['brand' => "Domino's", 'amount' => 299, 'logo' => '/rewards/dominos.svg', 'color' => '#006491', 'tagline' => 'Pizza night, sorted'],
        'swiggy' => ['brand' => 'Swiggy', 'amount' => 299, 'logo' => '/rewards/swiggy.svg', 'color' => '#FC8019', 'tagline' => 'Dinner delivered'],
        'starbucks' => ['brand' => 'Starbucks', 'amount' => 299, 'logo' => '/rewards/starbucks.svg', 'color' => '#006241', 'tagline' => 'Coffee for the all-nighter'],
        'mcdonalds' => ['brand' => "McDonald's", 'amount' => 199, 'logo' => '/rewards/mcdonalds.svg', 'color' => '#DA291C', 'tagline' => 'A Maharaja Mac or two'],
    ],

];
