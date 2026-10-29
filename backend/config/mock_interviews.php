<?php

/*
|--------------------------------------------------------------------------
| Mock AI Interview - practice by domain and tech stack
|--------------------------------------------------------------------------
|
| Read by App\Services\Mock\MockInterviewCatalog / MockInterviewService. The domains and stacks are the Vault AI Interview's own
| (config/curated_interview_sets.php + config/curated_interview_domains.php), so the two sections always list the same things;
| only the QUESTIONS are separate (table mock_interview_questions, filled from Admin -> Mock interview questions).
|
| Each stack has 3 practice rounds (the three themes of its Vault interview). A round opens to students once it has enough questions,
| independently of the others - a mock has no series to fail, so a half-filled stack is fine.
|
*/

return [

    // A round needs this many questions before a student can practise it.
    'min_questions_per_round' => 5,

    // A round longer than this is sampled: each sitting asks this many, preferring questions the student has not met.
    // A stack below may set its own (an oral covers more ground than a coding round).
    'questions_per_interview' => 10,

    /*
    | Domains that exist ONLY in the Mock AI Interview.
    |
    | The Vault AI Interview qualifies students for Mellow Vault and feeds the readiness score, so its catalogue (config/curated_interview_*)
    | is IT roles only and stays that way. A domain listed here is merged into the Mock catalogue after the Vault's and is invisible to the
    | Vault: no qualification, no series, no Notify-me. Each stack names its three rounds directly.
    |
    |   discipline            InterviewDiscipline key the AI scorer judges the answers by (see App\Support\InterviewDiscipline)
    |   questions_per_interview  how many questions one sitting asks (overrides the global number above)
    |   terms                 what the UI calls a stack / stacks in this domain ("exam" instead of "tech stack")
    */
    'extra_roles' => [

        'merchant_navy' => [
            'title' => 'Merchant Navy',
            'blurb' => 'Deck officer certificate orals for the DG Shipping (MMD) examinations - navigation, cargo work, ship operation and safety, asked the way an examiner asks them.',
            'icon' => 'Anchor',
            'badge' => 'New',
            'color' => 'cyan',
            'terms' => ['stack' => 'exam', 'stacks' => 'exams'],
            'stacks' => [

                'second_mate_fg' => [
                    'name' => 'Second Mate (FG) Orals',
                    'blurb' => 'The oral examination for Second Mate (Foreign Going): Function 1 Navigation, Function 2 Cargo handling and stowage, Function 3 Controlling the operation of the ship and care for persons on board.',
                    'icon' => 'Ship',
                    'aliases' => ['Second Mate', '2nd Mate', 'Class IV', 'Deck Officer', 'OOW', 'Officer of the Watch', 'MMD Orals', 'STCW'],
                    'tags' => ['merchant-navy', 'deck', 'second-mate', 'mmd', 'stcw', 'orals'],
                    'discipline' => 'maritime',
                    'questions_per_interview' => 20,
                    'duration_minutes' => 30,
                    'rounds' => [
                        ['Function 1: Navigation at the Operational Level', 'Watchkeeping, passage planning and ECDIS, compasses and steering, radar and ARPA, the collision regulations, lights and signals, buoyage and pilotage, celestial and coastal navigation, meteorology, and emergencies at sea.'],
                        ['Function 2: Cargo Handling and Stowage at the Operational Level', 'General and bulk cargoes, the IMSBC Code, grain, containers, dangerous goods, lifting gear, oil tanker and inert gas operations, chemical and gas carriers, hatch covers and ballast.'],
                        ['Function 3: Controlling the Operation of the Ship and Care for Persons on Board', 'Stability and trim, ship construction, load lines, fire-fighting, life-saving appliances, MARPOL, ISM, ISPS, MLC and maritime law, and medical care.'],
                    ],
                ],

                // The management-level certificates (STCW Table A-II/2) are shown so students can see the road ahead; they open on their own
                // once staff load questions for them (a round opens at 5).
                'chief_mate_fg' => [
                    'name' => 'Chief Mate (FG) Orals',
                    'blurb' => 'The management-level oral for Chief Mate (Foreign Going): voyage planning, cargo and stability decisions, and running the deck department.',
                    'icon' => 'Ship',
                    'aliases' => ['Chief Mate', 'First Mate', 'Chief Officer', 'Class II', 'MMD Orals'],
                    'tags' => ['merchant-navy', 'deck', 'chief-mate', 'mmd', 'stcw', 'orals'],
                    'discipline' => 'maritime',
                    'questions_per_interview' => 20,
                    'duration_minutes' => 30,
                    'rounds' => [
                        ['Function 1: Navigation at the Management Level', 'Voyage planning and navigation, weather routeing, watchkeeping management and the master-pilot relationship.'],
                        ['Function 2: Cargo Handling and Stowage at the Management Level', 'Planning and supervising loading, stowage, securing, carriage and discharge, and cargo documentation.'],
                        ['Function 3: Controlling the Operation of the Ship and Care for Persons on Board at the Management Level', 'Stability and stress, structural damage control, legislation and safety management, crew management and emergencies.'],
                    ],
                ],

                'master_fg' => [
                    'name' => 'Master (FG) Orals',
                    'blurb' => 'The command-level oral for Master (Foreign Going): command decisions, emergencies, legal responsibilities and managing the ship as a business.',
                    'icon' => 'Ship',
                    'aliases' => ['Master', 'Captain', 'Class I', 'Master Mariner', 'MMD Orals'],
                    'tags' => ['merchant-navy', 'deck', 'master', 'mmd', 'stcw', 'orals'],
                    'discipline' => 'maritime',
                    'questions_per_interview' => 20,
                    'duration_minutes' => 30,
                    'rounds' => [
                        ['Function 1: Navigation at the Management Level', 'Command of navigation: voyage and passage decisions, heavy weather, ice, and the Master\'s standing orders.'],
                        ['Function 2: Cargo Handling and Stowage at the Management Level', 'Master\'s responsibility for cargo: safe loading and carriage, claims, protests and documents.'],
                        ['Function 3: Controlling the Operation of the Ship and Care for Persons on Board at the Management Level', 'Command in emergencies, flag and port state control, maritime law, the ISM Code and leadership.'],
                    ],
                ],

            ],
        ],

    ],
];
