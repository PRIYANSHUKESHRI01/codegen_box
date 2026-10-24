<?php

/*
|--------------------------------------------------------------------------
| Branch taxonomy — the seed for `disciplines`, `branches` and global
| `branch_aliases`.
|--------------------------------------------------------------------------
|
| Read by the 2026_10_21_100000 migration (deploy runs `migrate` only, never
| `db:seed`, so the catalogue has to arrive with the schema). Superadmin can
| add/rename rows later from Superadmin → Branches; this file is only the
| starting set.
|
| Aliases are free text — each one goes through App\Support\BranchNormalizer
| before it is stored, so case, dots, brackets, "&" vs "and" and a leading
| "B.Tech" are all irrelevant here. A branch's own code and name are aliases
| automatically.
|
| `ee` (Electrical) and `eee` (Electrical & Electronics) are DIFFERENT branches
| that share the `eee` discipline: colleges use both, and drives are written
| against either.
|
*/

return [

    'disciplines' => [
        // code => [name, short, sort]
        'cse' => ['Computer Science & IT', 'CSE / IT', 10],
        'ece' => ['Electronics & Communication', 'ECE', 20],
        'eee' => ['Electrical & Electronics', 'EEE', 30],
        'mech' => ['Mechanical', 'Mech', 40],
        'civil' => ['Civil', 'Civil', 50],
        'other' => ['Other branches', 'Other', 90],
    ],

    'branches' => [
        // code => [discipline, name, short, [aliases…]]
        'cse' => ['cse', 'Computer Science & Engineering', 'CSE', [
            'CS', 'CSE', 'Computer Science', 'Computer Science and Engineering', 'Computer Science Engineering',
            'Comp Sci', 'Computer Engineering', 'Computers', 'COMP', 'CE (Computer)', 'Computer Technology',
        ]],
        'it' => ['cse', 'Information Technology', 'IT', [
            'IT', 'Information Technology', 'Info Tech', 'Information Science', 'Information Science and Engineering', 'ISE',
        ]],
        'cse_aiml' => ['cse', 'CSE (AI & ML)', 'CSE-AIML', [
            'AIML', 'AI & ML', 'AI and ML', 'CSE AIML', 'CSE (AI & ML)', 'CSE (AIML)', 'CSE-AIML',
            'Artificial Intelligence and Machine Learning', 'Artificial Intelligence & Machine Learning',
            'Computer Science (AI & ML)', 'CSE Artificial Intelligence and Machine Learning', 'AI/ML', 'ML',
        ]],
        'cse_ds' => ['cse', 'CSE (Data Science)', 'CSE-DS', [
            'CSE DS', 'CSE (Data Science)', 'CSE-DS', 'CSD', 'Data Science', 'Computer Science (Data Science)',
            'Computer Science and Data Science',
        ]],
        'aids' => ['cse', 'AI & Data Science', 'AI&DS', [
            'AIDS', 'AI & DS', 'AI and DS', 'AI&DS', 'AI and Data Science', 'Artificial Intelligence and Data Science',
            'Artificial Intelligence & Data Science', 'Artificial Intelligence', 'AI',
        ]],
        'csbs' => ['cse', 'Computer Science & Business Systems', 'CSBS', [
            'CSBS', 'Computer Science and Business Systems', 'CS & BS',
        ]],
        'cse_cyber' => ['cse', 'CSE (Cyber Security)', 'CSE-CS', [
            'Cyber Security', 'Cybersecurity', 'CSE Cyber Security', 'CSE (Cyber Security)', 'CSE (CS)',
        ]],
        'cse_iot' => ['cse', 'CSE (IoT)', 'CSE-IoT', [
            'CSE IoT', 'CSE (IoT)', 'CSE (IoT & Cyber Security)', 'Internet of Things', 'IoT',
        ]],

        'ece' => ['ece', 'Electronics & Communication Engineering', 'ECE', [
            'ECE', 'EC', 'E&C', 'Electronics and Communication', 'Electronics & Communication',
            'Electronics and Communication Engineering', 'Electronics & Communications', 'E and C', 'ECom',
        ]],
        'etc' => ['ece', 'Electronics & Telecommunication Engineering', 'E&TC', [
            'E&TC', 'ETC', 'ENTC', 'EnTC', 'E & TC', 'Electronics and Telecommunication', 'Electronics & Telecommunication',
            'Electronics and Telecommunication Engineering', 'Electronics & Tele-Communication', 'Telecommunication',
            'Telecommunication Engineering', 'ET', 'ETE',
        ]],
        'eie' => ['ece', 'Electronics & Instrumentation Engineering', 'EIE', [
            'EIE', 'E&I', 'EI', 'Electronics and Instrumentation', 'Electronics & Instrumentation',
            'Instrumentation', 'Instrumentation Engineering', 'Instrumentation and Control', 'Instrumentation & Control', 'ICE',
        ]],
        'electronics' => ['ece', 'Electronics Engineering', 'Electronics', [
            'Electronics', 'Electronics Engineering', 'Electronic Engineering', 'ELX', 'ELN', 'VLSI', 'VLSI Design',
            'Embedded Systems',
        ]],

        'eee' => ['eee', 'Electrical & Electronics Engineering', 'EEE', [
            'EEE', 'E&E', 'EE&E', 'Electrical and Electronics', 'Electrical & Electronics',
            'Electrical and Electronics Engineering', 'Electrical & Electronics Engineering', 'E and E',
        ]],
        'ee' => ['eee', 'Electrical Engineering', 'EE', [
            'EE', 'EL', 'ELE', 'ELEC', 'Electrical', 'Electrical Engineering', 'Electrical Engg', 'Electrical Power',
            'Power Engineering', 'Electrical Power Engineering',
        ]],

        'mech' => ['mech', 'Mechanical Engineering', 'Mech', [
            'ME', 'MECH', 'MEC', 'Mechanical', 'Mechanical Engineering', 'Mechanical Engg', 'Mech Engg',
            'Mechanical and Automation', 'Mechanical & Automation',
        ]],
        'prod' => ['mech', 'Production Engineering', 'Production', [
            'PROD', 'Production', 'Production Engineering', 'Industrial and Production Engineering',
            'Industrial & Production Engineering', 'Manufacturing Engineering', 'Manufacturing',
            'Industrial Engineering', 'IPE', 'IE',
        ]],
        'auto' => ['mech', 'Automobile Engineering', 'Automobile', [
            'AUTO', 'Automobile', 'Automobile Engineering', 'Automotive', 'Automotive Engineering',
        ]],
        'mechatronics' => ['mech', 'Mechatronics', 'Mechatronics', [
            'Mechatronics', 'Mechatronics Engineering', 'Robotics', 'Robotics and Automation', 'Robotics & Automation',
        ]],

        'civil' => ['civil', 'Civil Engineering', 'Civil', [
            'CE', 'CIVIL', 'CV', 'Civil Engineering', 'Civil Engg', 'Civil Engineer', 'Civil and Environmental',
            'Civil & Environmental Engineering', 'Construction', 'Construction Engineering', 'Structural Engineering',
        ]],

        'chem' => ['other', 'Chemical Engineering', 'Chemical', [
            'CHEM', 'Chemical', 'Chemical Engineering', 'CHE',
        ]],
        'biotech' => ['other', 'Biotechnology', 'Biotech', [
            'Biotech', 'Biotechnology', 'Bio Technology', 'Biomedical', 'Biomedical Engineering', 'BME',
        ]],
        'aero' => ['other', 'Aeronautical / Aerospace Engineering', 'Aero', [
            'Aero', 'Aeronautical', 'Aeronautical Engineering', 'Aerospace', 'Aerospace Engineering',
        ]],
        'agri' => ['other', 'Agricultural Engineering', 'Agri', [
            'Agri', 'Agriculture', 'Agricultural Engineering', 'Food Technology', 'Food Engineering',
        ]],
        'mining' => ['other', 'Mining / Metallurgy / Materials', 'Mining', [
            'Mining', 'Mining Engineering', 'Metallurgy', 'Metallurgical Engineering', 'Materials Science',
            'Textile', 'Textile Engineering', 'Marine', 'Marine Engineering', 'Petroleum', 'Petroleum Engineering',
        ]],
    ],
];
