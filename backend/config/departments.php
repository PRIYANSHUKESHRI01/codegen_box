<?php

/*
|--------------------------------------------------------------------------
| Departments — the capability registry
|--------------------------------------------------------------------------
|
| A department (Engineering & Technology, Management, Commerce, Arts …) decides which modules its students
| see. Each capability below is a module switch with a DEFAULT; a department row stores only what differs from the
| default, a discipline may override its department, and a branch may override its discipline (so "B.Com (Computer
| Applications)" keeps coding on inside a Commerce department that does not have it). Resolution order, last wins:
|
|     registry default  →  department  →  discipline  →  branch  →  (student opt-in, see `student_opt_in`)
|
| Read by App\Support\DepartmentCapabilities. The labels are what Superadmin → Departments shows.
|
| A student whose department is not known yet is treated as engineering (every default), so nobody loses a module because
| we have not classified them — and the server, not the browser, decides: the resolved map is sent to the client as
| `capabilities` and the same map gates the API (the `capability:` route middleware).
|
*/

return [

    'capabilities' => [
        'coding_practice' => [
            'label' => 'Coding practice',
            'hint' => 'Practice Arena problems, submissions, leaderboard and language insights.',
            'default' => true,
        ],
        'contests' => [
            'label' => 'Coding contests',
            'hint' => 'Mellow, TPO and daily coding contests and contest ratings.',
            'default' => true,
        ],
        'company_prep' => [
            'label' => 'Company PYQs',
            'hint' => 'Company-wise previous-year coding and technical questions.',
            'default' => true,
        ],
        'project_lab' => [
            'label' => 'Project Lab',
            'hint' => 'SOW-guided software projects built in a browser IDE.',
            'default' => true,
        ],
        'hackathons' => [
            'label' => 'Hack Arena',
            'hint' => 'Hackathons hosted by Mellow and hiring partners.',
            'default' => true,
        ],
        'skill_drills' => [
            'label' => 'Skill Drills',
            'hint' => 'Generated fundamentals practice (logic, circuits, quick calculations).',
            'default' => false,
        ],
        'domain_prep' => [
            'label' => 'Domain Prep',
            'hint' => 'Subject practice and timed tests for the student\'s own field (Core Prep, Management Prep, Commerce Prep, Subject Prep).',
            'default' => false,
        ],
        'ai_interviews' => [
            'label' => 'AI interviews',
            'hint' => 'AI mock interviews and the practice-interview studio.',
            'default' => true,
        ],
        'soft_skills' => [
            'label' => 'Soft skills & aptitude',
            'hint' => 'Aptitude, reasoning, English and situational assessments.',
            'default' => true,
        ],
        'learning_centre' => [
            'label' => 'Learning Centre',
            'hint' => 'Speaking, Listening, Vocabulary and the Reading Hub.',
            'default' => true,
        ],
    ],

    /*
    | What a student of a department that does NOT have coding may still switch on for themselves in Settings
    | ("Show coding practice"). Everything in the list turns on together; nothing outside it can be opted into.
    */
    'student_opt_in' => ['coding_practice', 'contests', 'company_prep'],

    /* The department a student with no recorded department is treated as. */
    'fallback' => 'engineering',

    /*
    | Wording used when a department row carries none (settings.domain_prep_label …).
    */
    'defaults' => [
        'domain_prep_label' => 'Domain Prep',
        'domain_prep_blurb' => 'Practice and timed tests for your own subject',
    ],
];
