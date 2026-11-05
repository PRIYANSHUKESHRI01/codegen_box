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

        // The subjects every CSE / IT campus-placement interview asks, as spoken questions: DBMS, operating systems, networks, OOP, data
        // structures and software engineering. Software discipline (scored like every other IT interview), practised in the Mock AI
        // Interview AND drawable into a college TPO's own mock interview (CollegeInterviewBuilder::library). Questions live in
        // database/seeders/data/mock_questions/cs_core_mock.php.
        'cs_core' => [
            'title' => 'Computer Science Core',
            'blurb' => 'The core subjects every CSE and IT placement interview asks: DBMS, operating systems, computer networks, OOP, data structures and software engineering.',
            'icon' => 'Cpu',
            'badge' => 'New',
            'color' => 'indigo',
            'stacks' => [
                'cs_dbms' => [
                    'name' => 'DBMS & SQL',
                    'blurb' => 'Keys, SQL, normalization, transactions, concurrency and indexing: the database questions every placement round asks.',
                    'icon' => 'Database',
                    'aliases' => ['DBMS', 'Database', 'SQL', 'RDBMS', 'Normalization', 'Transactions', 'Indexing'],
                    'tags' => ['cs-core', 'dbms', 'sql', 'database'],
                    'discipline' => 'software',
                    'rounds' => [
                        ['Round 1: Fundamentals and SQL', 'Keys, ACID, SQL joins and clauses, and the differences interviewers love to ask.'],
                        ['Round 2: Normalization and Transactions', 'Normal forms up to BCNF, transactions, isolation levels and locking.'],
                        ['Round 3: Indexing, Tuning and Design', 'Indexes, slow queries, deadlocks, SQL vs NoSQL and designing a schema.'],
                    ],
                    'duration_minutes' => 15,
                ],
                'cs_os' => [
                    'name' => 'Operating Systems',
                    'blurb' => 'Processes and threads, scheduling, memory management, synchronisation and deadlocks.',
                    'icon' => 'Cpu',
                    'aliases' => ['OS', 'Operating System', 'Processes', 'Scheduling', 'Deadlock', 'Virtual Memory'],
                    'tags' => ['cs-core', 'os', 'operating-systems'],
                    'discipline' => 'software',
                    'rounds' => [
                        ['Round 1: Processes, Threads and Scheduling', 'Process states, context switches, scheduling algorithms and IPC.'],
                        ['Round 2: Memory Management', 'Paging, virtual memory, page faults, page replacement and thrashing.'],
                        ['Round 3: Synchronisation, Deadlocks and Files', 'Critical sections, semaphores, deadlock, classic problems and file systems.'],
                    ],
                    'duration_minutes' => 15,
                ],
                'cs_cn' => [
                    'name' => 'Computer Networks',
                    'blurb' => 'OSI and TCP/IP, IP addressing and subnetting, TCP and UDP, routing, DNS, HTTP and TLS.',
                    'icon' => 'Globe',
                    'aliases' => ['CN', 'Networking', 'Computer Networks', 'TCP/IP', 'OSI', 'DNS', 'HTTP'],
                    'tags' => ['cs-core', 'cn', 'networks', 'tcp-ip'],
                    'discipline' => 'software',
                    'rounds' => [
                        ['Round 1: Layers and Devices', 'OSI and TCP/IP models, switches and routers, ARP and error control.'],
                        ['Round 2: IP, Routing and Transport', 'Subnetting, TCP vs UDP, the handshake, congestion control, routing and NAT.'],
                        ['Round 3: Application Layer and Security', 'What happens when you type a URL, DNS, HTTP, TLS, firewalls and troubleshooting.'],
                    ],
                    'duration_minutes' => 15,
                ],
                'cs_oop' => [
                    'name' => 'OOP Concepts',
                    'blurb' => 'The four pillars, polymorphism, abstract classes vs interfaces, SOLID and common design patterns.',
                    'icon' => 'Boxes',
                    'aliases' => ['OOP', 'Object Oriented Programming', 'OOPS', 'SOLID', 'Design Patterns', 'Polymorphism'],
                    'tags' => ['cs-core', 'oop', 'design-patterns'],
                    'discipline' => 'software',
                    'rounds' => [
                        ['Round 1: Core Principles', 'Classes and objects, constructors, encapsulation, abstraction and access control.'],
                        ['Round 2: Inheritance and Polymorphism', 'Overloading vs overriding, abstract class vs interface, composition and dynamic dispatch.'],
                        ['Round 3: Design Principles and Patterns', 'SOLID, Singleton, Factory, Observer, exceptions and memory management.'],
                    ],
                    'duration_minutes' => 15,
                ],
                'cs_dsa' => [
                    'name' => 'Data Structures & Algorithms (Theory)',
                    'blurb' => 'Explain-it-aloud DSA: complexity, linked lists, trees, graphs, hashing, sorting and dynamic programming.',
                    'icon' => 'Workflow',
                    'aliases' => ['DSA', 'Data Structures', 'Algorithms', 'Complexity', 'Sorting', 'Graphs', 'Trees'],
                    'tags' => ['cs-core', 'dsa', 'algorithms', 'data-structures'],
                    'discipline' => 'software',
                    'rounds' => [
                        ['Round 1: Lists, Stacks, Queues and Complexity', 'Arrays vs linked lists, cycle detection, stacks and queues, and Big-O.'],
                        ['Round 2: Trees, Graphs and Hashing', 'BSTs, traversals, BFS vs DFS, hash tables, heaps and Dijkstra.'],
                        ['Round 3: Sorting, Searching and DP', 'Sorting trade-offs, binary search, dynamic programming, two pointers and tries.'],
                    ],
                    'duration_minutes' => 15,
                ],
                'cs_se' => [
                    'name' => 'Software Engineering',
                    'blurb' => 'SDLC, Agile and Scrum, testing, Git, CI/CD, architecture and how you work in a team.',
                    'icon' => 'Layers',
                    'aliases' => ['SE', 'SDLC', 'Agile', 'Scrum', 'Testing', 'Git', 'CI/CD', 'Software Engineering'],
                    'tags' => ['cs-core', 'se', 'sdlc', 'agile'],
                    'discipline' => 'software',
                    'rounds' => [
                        ['Round 1: SDLC and Requirements', 'Process models, Agile and Scrum, requirements and user stories.'],
                        ['Round 2: Testing, Git and Delivery', 'Testing levels, TDD, version control, CI/CD and handling a production bug.'],
                        ['Round 3: Design and Teamwork', 'Monolith vs microservices, coupling and cohesion, REST, technical debt and code review.'],
                    ],
                    'duration_minutes' => 15,
                ],
            ],
        ],

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
