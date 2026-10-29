<?php

/*
|--------------------------------------------------------------------------
| Practice interviews — a student builds their own AI mock interview
|--------------------------------------------------------------------------
|
| Read by App\Services\PracticeInterviewService. Every number is a policy knob; the role cards below are what a student
| sees in the "Practice interview" studio. `interests` are the ids a student picks at onboarding (Settings -> Branch & Track),
| and `tags` are matched against the tags on bank questions, so choosing "Embedded Systems Engineer" pulls embedded questions first.
|
*/

/*
| The Management, Commerce and Arts / Humanities disciplines: their role cards live with their starter questions in
| database/data/department_interview_content.php, and join the engineering groups below under the discipline code.
*/
$departmentGroups = array_map(
    fn (array $d) => ['label' => $d['label'], 'roles' => $d['roles']],
    (array) require base_path('database/data/department_interview_content.php'),
);

return [

    /*
    | The student-facing "Build your own practice interview" studio (role + kind + difficulty, with AI-written top-up questions) is
    | PAUSED: students practise through the Mock AI Interview by domain and stack instead (config/mock_interviews.php). Set
    | PRACTICE_BUILDER_ENABLED=true to bring the studio back; its page, its API and every link to it follow this one switch.
    */
    'student_builder_enabled' => (bool) env('PRACTICE_BUILDER_ENABLED', false),

    /* Hard stops, so one student cannot turn the question bank (or the AI top-up behind it) into a vending machine. */
    'limits' => [
        // Practice interviews a student may CREATE per day (taking one is limited separately, by their plan).
        'created_per_day' => 8,
        // AI-written questions a student may trigger per day when the bank runs short for their pick.
        'ai_top_up_per_day' => 3,
        // An interview that still has nobody in it after this many days is removed by interview:prune-practice.
        'unused_days' => 14,
    ],

    'counts' => [5, 8, 10],

    // Below this many questions an interview is not worth running; the student is told the bank is still being built.
    'min_questions' => 3,

    /*
    | What kind of round. `mix` is the share of each question category (largest-remainder rounded to the count).
    */
    'kinds' => [
        'technical' => ['label' => 'Technical round', 'blurb' => 'Fundamentals and applied questions for the role, with a couple of practical scenarios.',
            'mix' => ['technical' => 80, 'situational' => 20]],
        'full' => ['label' => 'Full mock', 'blurb' => 'Technical, a scenario, your project and an HR question — like a real campus interview.',
            'mix' => ['technical' => 55, 'situational' => 15, 'behavioral' => 20, 'hr' => 10]],
        'hr' => ['label' => 'HR & behavioural round', 'blurb' => 'Projects, teamwork, learning and career questions.',
            'mix' => ['behavioral' => 50, 'hr' => 25, 'situational' => 25]],
    ],

    /*
    | Role cards per branch family (and, below the engineering ones, per discipline of the other departments). `label` heads the section. `software` is used for CSE, an unknown branch, and as the
    | "IT roles" group shown to a core student who also wants software interviews.
    */
    'groups' => [
        'ece' => [
            'label' => 'Electronics & Communication',
            'roles' => [
                ['key' => 'ece_embedded', 'title' => 'Embedded Systems Engineer', 'blurb' => 'Microcontrollers, interrupts, protocols, RTOS, debugging.', 'interests' => ['embedded', 'iot'], 'tags' => ['embedded', 'iot', 'microcontrollers', 'interrupts', 'rtos', 'protocols', 'embedded_c']],
                ['key' => 'ece_vlsi', 'title' => 'VLSI / Chip Design Engineer', 'blurb' => 'CMOS, timing, Verilog, low power, FPGA vs ASIC.', 'interests' => ['vlsi'], 'tags' => ['vlsi', 'cmos', 'verilog', 'timing', 'low_power', 'digital']],
                ['key' => 'ece_comm', 'title' => 'Communication & RF Engineer', 'blurb' => 'Modulation, noise, antennas, signal processing.', 'interests' => ['communication_rf', 'signal_processing'], 'tags' => ['communication_rf', 'signal_processing']],
                ['key' => 'ece_analog', 'title' => 'Analog / Electronics Design Engineer', 'blurb' => 'Op-amps, transistors, power, PCB debugging.', 'interests' => ['analog_design'], 'tags' => ['analog_design', 'opamp', 'transistors', 'power', 'debugging']],
                ['key' => 'ece_fundamentals', 'title' => 'Electronics fundamentals — any role', 'blurb' => 'A broad check across the whole ECE syllabus.', 'interests' => [], 'tags' => []],
            ],
        ],
        'eee' => [
            'label' => 'Electrical & Electronics',
            'roles' => [
                ['key' => 'eee_power', 'title' => 'Power Systems Graduate Engineer Trainee', 'blurb' => 'Transmission, protection, faults, per-unit, the grid.', 'interests' => ['power_systems', 'renewable_energy'], 'tags' => ['power_systems', 'protection', 'renewable_energy']],
                ['key' => 'eee_pe', 'title' => 'Power Electronics & EV Engineer', 'blurb' => 'Converters, devices, motor drives, EV batteries.', 'interests' => ['power_electronics_ev'], 'tags' => ['power_electronics_ev']],
                ['key' => 'eee_design', 'title' => 'Electrical Design Engineer', 'blurb' => 'Earthing, cable and device selection, safety.', 'interests' => ['electrical_design'], 'tags' => ['electrical_design', 'safety']],
                ['key' => 'eee_machines', 'title' => 'Machines & Control Engineer', 'blurb' => 'Transformers, motors, PID and stability.', 'interests' => ['electrical_machines', 'control_systems'], 'tags' => ['electrical_machines', 'control_systems']],
                ['key' => 'eee_fundamentals', 'title' => 'Electrical fundamentals — any role', 'blurb' => 'A broad check across the whole EEE syllabus.', 'interests' => [], 'tags' => []],
            ],
        ],
        'mech' => [
            'label' => 'Mechanical',
            'roles' => [
                ['key' => 'mech_design', 'title' => 'Design Engineer (GET)', 'blurb' => 'Stress, fatigue, joints, CAD and failure analysis.', 'interests' => ['design_cad'], 'tags' => ['design_cad']],
                ['key' => 'mech_thermal', 'title' => 'Thermal & HVAC Engineer', 'blurb' => 'Thermodynamics, refrigeration, heat transfer.', 'interests' => ['thermal'], 'tags' => ['thermal']],
                ['key' => 'mech_mfg', 'title' => 'Manufacturing & Production Engineer', 'blurb' => 'Casting, machining, quality, lean.', 'interests' => ['manufacturing', 'quality_production'], 'tags' => ['manufacturing', 'quality_production']],
                ['key' => 'mech_auto', 'title' => 'Automotive & EV Engineer', 'blurb' => 'Engines, EV drivetrains, battery thermal management, robotics.', 'interests' => ['automotive_ev', 'robotics'], 'tags' => ['automotive_ev', 'robotics']],
                ['key' => 'mech_fundamentals', 'title' => 'Mechanical fundamentals — any role', 'blurb' => 'A broad check across the whole Mechanical syllabus.', 'interests' => [], 'tags' => []],
            ],
        ],
        'civil' => [
            'label' => 'Civil',
            'roles' => [
                ['key' => 'civil_structural', 'title' => 'Structural Engineer', 'blurb' => 'Loads, reinforced concrete, shear, lateral systems.', 'interests' => ['structural'], 'tags' => ['structural']],
                ['key' => 'civil_site', 'title' => 'Site & Construction Engineer (GET)', 'blurb' => 'Concrete practice, scheduling, site safety.', 'interests' => ['construction_management'], 'tags' => ['construction_management', 'safety', 'quality']],
                ['key' => 'civil_highway', 'title' => 'Highway & Transportation Engineer', 'blurb' => 'Pavements, geometric design, traffic.', 'interests' => ['transportation', 'planning_surveying'], 'tags' => ['transportation', 'planning_surveying']],
                ['key' => 'civil_geo', 'title' => 'Geotechnical & Environmental Engineer', 'blurb' => 'Foundations, soil behaviour, water and waste.', 'interests' => ['geotechnical', 'environmental'], 'tags' => ['geotechnical', 'environmental']],
                ['key' => 'civil_fundamentals', 'title' => 'Civil fundamentals — any role', 'blurb' => 'A broad check across the whole Civil syllabus.', 'interests' => [], 'tags' => []],
            ],
        ],
        'software' => [
            'label' => 'IT & software roles',
            'roles' => [
                ['key' => 'sw_fresher', 'title' => 'Software Engineer — Fresher', 'blurb' => 'Fundamentals, problem solving and a typical campus interview.', 'interests' => [], 'tags' => []],
                ['key' => 'sw_projects', 'title' => 'Projects & fundamentals check', 'blurb' => 'Walk through your projects and core concepts.', 'interests' => [], 'tags' => []],
            ],
        ],
    ] + $departmentGroups,
];
