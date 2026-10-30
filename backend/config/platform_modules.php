<?php

/*
|--------------------------------------------------------------------------
| Platform modules — whole sections the superadmin can switch on or off for EVERY student at once
|--------------------------------------------------------------------------
|
| Not to be confused with departments' capabilities (config/departments.php), which say what a student's own programme
| has. A platform module is a product decision: "is this section live on AptRun right now?". The answer lives in the
| `platform_modules` table (Superadmin → Merchant Navy), is read by App\Services\PlatformModules, and is enforced on the server
| (the Mock AI Interview catalogue and start, re-attempts) as well as hidden in the browser (sidebar, card, page).
|
| A module with no row in the table is in its `default` state, so a fresh install or a deploy that has not migrated yet
| changes nothing for anyone.
|
*/

return [

    'modules' => [

        'merchant_navy' => [
            'label' => 'Merchant Navy',
            'description' => 'Oral-exam practice for deck officers (Second Mate, Chief Mate, Master) and the Rule of the Road picture cards.',
            'default' => true,
            // The Mock AI Interview domains (config/mock_interviews.php) that belong to it: hidden from the catalogue and refused at start when it is off.
            'mock_domains' => ['merchant_navy'],
            // Interview.discipline values of its sittings (a finished sitting may not be re-sat while it is off).
            'disciplines' => ['maritime'],
            // Where a student meets it — shown to the superadmin so "off" is never a mystery.
            'surfaces' => [
                ['key' => 'sidebar', 'label' => 'Student sidebar', 'detail' => '"Merchant Navy" group with the Mock Orals page'],
                ['key' => 'mock_card', 'label' => 'Mock AI Interview', 'detail' => 'The "Merchant Navy" domain card and everything under it'],
            ],
        ],

    ],

];
