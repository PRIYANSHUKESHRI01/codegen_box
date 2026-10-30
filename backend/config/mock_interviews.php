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
    | Vault: no qualification, no series, no Notify-me. Each stack names its own rounds directly, or a number of SETS.
    |
    |   discipline               InterviewDiscipline key the AI scorer judges the answers by (see App\Support\InterviewDiscipline)
    |   questions_per_interview  how many questions one sitting asks (overrides the global number above); at or above a set's size, a
    |                            sitting is the whole set
    |   sets / set_description   "Set 1" .. "Set N" instead of themed rounds - for a bank too big for three rounds (see
    |                            MockInterviewCatalog::extraRounds). The questions are dealt into the sets when the bank is built
    |                            (database/seeders/data/build_merchant_navy.py), so every set is a complete, similar-sized sitting
    |   study_mode               true = a STUDY interview: the student's answers are NOT scored by AI (no LLM call at all) but compared, by
    |                            plain text matching, with the model answer, which is shown to them right after each answer so they can
    |                            learn from it (App\Services\Interviews\StudyFeedbackService). Such sittings never feed readiness.
    |   terms                    what the UI calls a stack / a round in this domain ("exam" and "set" instead of "tech stack" and "round")
    */
    'extra_roles' => [

        'merchant_navy' => [
            'title' => 'Merchant Navy',
            'blurb' => 'Deck officer certificate orals for the DG Shipping (MMD) examinations - navigation, cargo work, ship operation and safety, asked the way an examiner asks them.',
            'icon' => 'Anchor',
            'badge' => 'New',
            'color' => 'cyan',
            'terms' => ['stack' => 'exam', 'stacks' => 'exams', 'round' => 'set', 'rounds' => 'sets'],
            'stacks' => [

                'second_mate_fg' => [
                    'name' => 'Second Mate (FG) Orals',
                    'blurb' => 'The oral examination for Second Mate (Foreign Going): navigation, cargo handling and stowage, and controlling the operation of the ship and care for persons on board.',
                    'icon' => 'Ship',
                    'aliases' => ['Second Mate', '2nd Mate', 'Class IV', 'Deck Officer', 'OOW', 'Officer of the Watch', 'MMD Orals', 'STCW'],
                    'tags' => ['merchant-navy', 'deck', 'second-mate', 'mmd', 'stcw', 'orals'],
                    'discipline' => 'maritime',
                    // 690 questions in 23 sets of 30: 10 of Function 1 (navigation), 10 of Function 2 (cargo handling and stowage) and 10 of
                    // Function 3 (ship operation and safety), in that order; a sitting asks the whole set. Built by build_merchant_navy.py.
                    'sets' => 23,
                    'set_description' => 'A set of 30 oral questions: 10 on navigation, 10 on cargo handling and stowage, and 10 on ship operation and safety. After each answer you see the model answer and how much of it you covered.',
                    'study_mode' => true,
                    'questions_per_interview' => 30,
                    'duration_minutes' => 30,
                ],

                // The management-level certificates (STCW Table A-II/2) are shown so students can see the road ahead; they open on their own
                // once staff load questions for them (a set opens at 5). Chief Mate is loaded; Master's ten sets is a placeholder for the staff
                // screen, not a promise.
                'chief_mate_fg' => [
                    'name' => 'Chief Mate (FG) Orals',
                    'blurb' => 'The management-level oral for Chief Mate (Foreign Going): voyage planning, cargo and stability decisions, and running the deck department.',
                    'icon' => 'Ship',
                    'aliases' => ['Chief Mate', 'First Mate', 'Chief Officer', 'Class II', 'MMD Orals'],
                    'tags' => ['merchant-navy', 'deck', 'chief-mate', 'mmd', 'stcw', 'orals'],
                    'discipline' => 'maritime',
                    'study_mode' => true,
                    // 600 questions in 20 sets of 30 (10 + 10 + 10 of Functions 1-3, in that order). Built by build_chief_mate.py.
                    'sets' => 20,
                    'set_description' => 'A set of 30 management-level oral questions: 10 on navigation, 10 on cargo handling and stowage, and 10 on ship operation and safety. After each answer you see the model answer and how much of it you covered.',
                    'questions_per_interview' => 30,
                    'duration_minutes' => 30,
                ],

                // The Rule of the Road picture cards, which the oral examiner hands over: a drawing of a situation (and, at night, the lights
                // seen) with two or three questions on it. Candidates report about ten cards in a sitting, so a set is ~10 cards: 10 sets,
                // 102 cards, 231 questions, built by build_ror_cards.py. A card's questions stay together; the picture shows with each.
                'ror_cards' => [
                    'name' => 'Rule of the Road (ROR) Cards',
                    'blurb' => 'The picture cards of the oral: the lights and signals of another vessel at night, or a crossing situation. Say what you see, which Rule applies and what you do.',
                    'icon' => 'Lightbulb',
                    'aliases' => ['ROR', 'Rule of the Road', 'ROR Cards', 'COLREGs', 'Collision Regulations', 'Navigation Lights', 'Lights and Shapes', 'Pictorial', 'Cards'],
                    'tags' => ['merchant-navy', 'deck', 'ror', 'colregs', 'lights', 'orals'],
                    'discipline' => 'maritime',
                    'sets' => 10,
                    'set_description' => 'A pack of about ten Rule of the Road cards. Each card is a picture, with two or three questions on it. After each answer you see the model answer and how much of it you covered.',
                    'study_mode' => true,
                    // Never fewer than the biggest set (27 questions today), or a set would be sampled and a card's questions split up.
                    'questions_per_interview' => 40,
                    'duration_minutes' => 35,
                ],

                'master_fg' => [
                    'name' => 'Master (FG) Orals',
                    'blurb' => 'The command-level oral for Master (Foreign Going): command decisions, emergencies, legal responsibilities and managing the ship as a business.',
                    'icon' => 'Ship',
                    'aliases' => ['Master', 'Captain', 'Class I', 'Master Mariner', 'MMD Orals'],
                    'tags' => ['merchant-navy', 'deck', 'master', 'mmd', 'stcw', 'orals'],
                    'discipline' => 'maritime',
                    'study_mode' => true,
                    'sets' => 10,
                    'set_description' => 'A mixed command-level oral set: command decisions, emergencies, maritime law, port and flag state control, and leadership.',
                    'questions_per_interview' => 30,
                    'duration_minutes' => 30,
                ],

            ],
        ],

    ],
];
