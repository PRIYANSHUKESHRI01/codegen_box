<?php

/*
|--------------------------------------------------------------------------
| Department taxonomy — the level ABOVE branches.
|--------------------------------------------------------------------------
|
| A college runs one or more DEPARTMENTS (Engineering & Technology, Management &
| Business Administration, Commerce & Accounting, Arts/Humanities & Social Sciences). A department
| holds DISCIPLINES (the family a student's dashboard, Domain Prep and readiness are keyed by: ECE,
| BBA, B.Com, Psychology …) and a discipline holds BRANCHES (the specific programme: B.Com (Taxation),
| MBA (Finance), BA English …).
|
| Read by the 2026_11_02_100000 migration (deploy runs `migrate`, never `db:seed`, so the catalogue has
| to arrive with the schema). Superadmin → Departments can add/rename/re-order everything afterwards;
| this file is only the starting set. The ORIGINAL engineering rows live in branch_taxonomy.php and are
| not repeated here — only their department assignment is.
|
| Aliases are free text and go through App\Support\BranchNormalizer before they are stored, so case,
| dots and brackets do not matter ("B.Com (Hons.)" and "bcom hons" are one spelling). Because the
| normaliser deliberately keeps degree words such as BA / MBA / B.Com, a college's "B.A. (Hons) English"
| and "BA English" are DIFFERENT keys — the degree() helper below generates the usual forms so nobody
| has to type forty variants by hand. First branch to claim a spelling keeps it.
|
| `scoped_aliases` are spellings that mean different things in different departments ("Finance" is MBA
| (Finance) in a Management import and B.Com (Accounting & Finance) in a Commerce one). They are only
| consulted when the import / screen knows which department it is looking at.
|
*/

/**
 * Every usual way a roster spells "<degree> <subject>".
 *
 * @param  list<string>  $degrees
 * @param  list<string>  $subjects
 * @return list<string>
 */
$degree = static function (array $degrees, array $subjects): array {
    $out = [];

    foreach ($subjects as $subject) {
        $out[] = $subject;

        foreach ($degrees as $d) {
            $out[] = "{$d} {$subject}";
            $out[] = "{$d} ({$subject})";
            $out[] = "{$d} in {$subject}";
        }
    }

    return $out;
};

$ba = ['BA', 'B.A.', 'B.A. (Hons)', 'BA (Hons)', 'B.A. Honours', 'BA Honours', 'MA', 'M.A.', 'M.A. (Hons)', 'Bachelor of Arts', 'Master of Arts'];
$bba = ['BBA', 'B.B.A.', 'BBA (Hons)', 'BBM', 'BMS', 'Bachelor of Business Administration'];

return [

    'departments' => [
        'engineering' => [
            'name' => 'Engineering & Technology',
            'short' => 'Engineering',
            'description' => 'B.E. / B.Tech / M.Tech programmes — computer science and the core branches.',
            'icon' => 'cpu',
            'accent' => 'indigo',
            'sort' => 10,
            // Everything on (the registry default): this is the product as it has always been.
            'capabilities' => [],
            'settings' => ['domain_prep_label' => 'Core Prep', 'domain_prep_blurb' => 'Branch technical practice and timed tests'],
        ],
        'management' => [
            'name' => 'Management & Business Administration',
            'short' => 'Management',
            'description' => 'BBA / BBM / BMS and MBA / PGDM programmes, with their specialisations.',
            'icon' => 'briefcase',
            'accent' => 'violet',
            'sort' => 20,
            'capabilities' => ['coding_practice' => false, 'contests' => false, 'company_prep' => false, 'project_lab' => false, 'hackathons' => false, 'skill_drills' => false, 'domain_prep' => true],
            'settings' => ['domain_prep_label' => 'Management Prep', 'domain_prep_blurb' => 'Management concepts, case thinking and timed tests'],
        ],
        'commerce' => [
            'name' => 'Commerce & Accounting',
            'short' => 'Commerce',
            'description' => 'B.Com / M.Com programmes and professional courses (CA, CS, CMA).',
            'icon' => 'calculator',
            'accent' => 'emerald',
            'sort' => 30,
            'capabilities' => ['coding_practice' => false, 'contests' => false, 'company_prep' => false, 'project_lab' => false, 'hackathons' => false, 'skill_drills' => false, 'domain_prep' => true],
            'settings' => ['domain_prep_label' => 'Commerce Prep', 'domain_prep_blurb' => 'Accounting, finance, tax and law practice with timed tests'],
        ],
        'arts' => [
            'name' => 'Arts, Humanities & Social Sciences',
            'short' => 'Arts & Humanities',
            'description' => 'BA / MA programmes across languages, social sciences, media and the humanities.',
            'icon' => 'landmark',
            'accent' => 'rose',
            'sort' => 40,
            'capabilities' => ['coding_practice' => false, 'contests' => false, 'company_prep' => false, 'project_lab' => false, 'hackathons' => false, 'skill_drills' => false, 'domain_prep' => true],
            'settings' => ['domain_prep_label' => 'Subject Prep', 'domain_prep_blurb' => 'Your subject, practised the way the exams ask it'],
        ],
    ],

    /*
    | The original engineering disciplines (rows already exist; only the department and the per-family
    | capabilities are written). Domain Prep and Skill Drills were hard-wired to ECE / EEE / Mech / Civil
    | before; that is now this data. CSE and "other" have neither, exactly as before.
    */
    'engineering_disciplines' => [
        'cse' => ['capabilities' => []],
        'ece' => ['capabilities' => ['domain_prep' => true, 'skill_drills' => true]],
        'eee' => ['capabilities' => ['domain_prep' => true, 'skill_drills' => true]],
        'mech' => ['capabilities' => ['domain_prep' => true, 'skill_drills' => true]],
        'civil' => ['capabilities' => ['domain_prep' => true, 'skill_drills' => true]],
        'other' => ['capabilities' => ['domain_prep' => true]],
    ],

    'disciplines' => [
        // code => [name, short, sort, department]
        // ── Management ───────────────────────────────────────────────
        'bba' => ['Business Administration (BBA · BBM · BMS)', 'BBA', 110, 'management'],
        'mba' => ['MBA · PGDM', 'MBA', 120, 'management'],
        // ── Commerce ─────────────────────────────────────────────────
        'bcom' => ['Bachelor of Commerce', 'B.Com', 210, 'commerce'],
        'mcom' => ['Master of Commerce', 'M.Com', 220, 'commerce'],
        'comm_prof' => ['Professional Courses (CA · CS · CMA)', 'CA / CS / CMA', 230, 'commerce'],
        // ── Arts, Humanities & Social Sciences ───────────────────────
        'lang_lit' => ['Languages & Literature', 'Lang & Lit', 310, 'arts'],
        'history_phil' => ['History, Heritage & Philosophy', 'History', 320, 'arts'],
        'polsci_pa' => ['Political Science & Public Administration', 'Pol Sci', 330, 'arts'],
        'economics' => ['Economics', 'Economics', 340, 'arts'],
        'psychology' => ['Psychology', 'Psychology', 350, 'arts'],
        'sociology_sw' => ['Sociology, Anthropology & Social Work', 'Sociology', 360, 'arts'],
        'media_comm' => ['Journalism, Mass Communication & Media', 'Media', 370, 'arts'],
        'education' => ['Education & Teaching', 'Education', 380, 'arts'],
        'geography_env' => ['Geography & Environmental Studies', 'Geography', 390, 'arts'],
        'fine_arts' => ['Fine & Performing Arts', 'Fine Arts', 400, 'arts'],
        'other_arts' => ['Other Arts & Humanities', 'Other Arts', 490, 'arts'],
    ],

    /*
    | Branches that keep coding on although their department does not (IT-adjacent programmes). The same
    | switch exists per discipline and per department in Superadmin → Departments.
    */
    'branch_capabilities' => [
        'bcom_ca' => ['coding_practice' => true, 'contests' => true, 'company_prep' => true],
        'bba_analytics' => ['coding_practice' => true, 'contests' => true, 'company_prep' => true],
        'bcom_analytics' => ['coding_practice' => true, 'contests' => true, 'company_prep' => true],
        'mba_analytics' => ['coding_practice' => true, 'contests' => true, 'company_prep' => true],
        'mba_it' => ['coding_practice' => true, 'contests' => true, 'company_prep' => true],
    ],

    'branches' => [
        // code => [discipline, name, short, [aliases…]]

        // ═════════════════════════ MANAGEMENT · BBA ═════════════════════════
        'bba' => ['bba', 'BBA / BBM / BMS (General)', 'BBA', [
            ...$degree($bba, ['General']),
            'BBA', 'B.B.A', 'BBM', 'B.B.M', 'BMS', 'B.M.S', 'Bachelor of Business Administration', 'Bachelor of Business Management',
            'Bachelor of Management Studies', 'Business Management', 'BBA Hons', 'BBA (Hons.)',
        ]],
        'bba_marketing' => ['bba', 'BBA (Marketing & Digital Marketing)', 'BBA-Mktg', [
            'BBA Marketing', 'BBA (Marketing)', 'BBA Digital Marketing', 'BBA (Digital Marketing)', 'BBA Sales and Marketing',
            'BBA Retail Management', 'BBA (Retail & E-Commerce)', 'BBA Marketing Management',
        ]],
        'bba_finance' => ['bba', 'BBA (Finance & Banking)', 'BBA-Fin', [
            'BBA Finance', 'BBA (Finance)', 'BBA Banking and Insurance', 'BBA (Banking, Finance & Insurance)', 'BBA BFSI',
            'BBA Finance and Accounting', 'BBA (Financial Services)',
        ]],
        'bba_hr' => ['bba', 'BBA (Human Resource Management)', 'BBA-HR', [
            'BBA HR', 'BBA (HR)', 'BBA Human Resource', 'BBA Human Resource Management', 'BBA (Human Resources)',
        ]],
        'bba_analytics' => ['bba', 'BBA (Business Analytics & Data Science)', 'BBA-BA', [
            'BBA Business Analytics', 'BBA (Business Analytics)', 'BBA Analytics', 'BBA Data Science', 'BBA (Data Analytics)',
            'BBA Big Data Analytics',
        ]],
        'bba_logistics' => ['bba', 'BBA (Logistics & Supply Chain)', 'BBA-SCM', [
            'BBA Logistics', 'BBA (Logistics)', 'BBA Supply Chain', 'BBA Logistics and Supply Chain Management', 'BBA (Logistics & Supply Chain Management)',
            'BBA Operations',
        ]],
        'bba_intl' => ['bba', 'BBA (International Business)', 'BBA-IB', [
            'BBA International Business', 'BBA (International Business)', 'BBA Global Business', 'BBA (Foreign Trade)',
        ]],
        'bba_entrepreneurship' => ['bba', 'BBA (Entrepreneurship & Family Business)', 'BBA-Ent', [
            'BBA Entrepreneurship', 'BBA (Entrepreneurship)', 'BBA Family Business', 'BBA Innovation and Entrepreneurship',
        ]],
        'bba_sector' => ['bba', 'BBA (Aviation, Hospitality & Healthcare)', 'BBA-Sector', [
            'BBA Aviation', 'BBA (Aviation Management)', 'BBA Hospitality', 'BBA (Hospitality & Tourism)', 'BBA Healthcare',
            'BBA (Hospital Management)', 'BBA Event Management', 'BBA Tourism',
        ]],

        // ═════════════════════════ MANAGEMENT · MBA / PGDM ═════════════════════════
        'mba' => ['mba', 'MBA / PGDM (General Management)', 'MBA', [
            'MBA', 'M.B.A', 'PGDM', 'PGP', 'PGDBM', 'MMS', 'Master of Business Administration', 'Master of Management Studies',
            'Post Graduate Diploma in Management', 'MBA General', 'MBA (General)', 'MBA Dual Specialisation', 'MBA (Dual Specialization)',
            'MBA Executive', 'Executive MBA', 'PGDM General', 'Management',
        ]],
        'mba_marketing' => ['mba', 'MBA (Marketing)', 'MBA-Mktg', [
            'MBA Marketing', 'MBA (Marketing)', 'MBA Marketing Management', 'PGDM Marketing', 'PGDM (Marketing)', 'MBA Sales and Marketing',
            'MBA Digital Marketing', 'MBA (Marketing & Sales)', 'MBA Brand Management', 'MBA Retail Management', 'MMS Marketing',
        ]],
        'mba_finance' => ['mba', 'MBA (Finance)', 'MBA-Fin', [
            'MBA Finance', 'MBA (Finance)', 'MBA Financial Management', 'PGDM Finance', 'PGDM (Finance)', 'MBA Banking and Finance',
            'MBA (Banking, Financial Services & Insurance)', 'MBA BFSI', 'MBA Investment Banking', 'MMS Finance', 'MBA (Corporate Finance)',
            'MBA Banking Finance and Insurance',
        ]],
        'mba_hr' => ['mba', 'MBA (Human Resource Management)', 'MBA-HR', [
            'MBA HR', 'MBA (HR)', 'MBA Human Resource', 'MBA Human Resources', 'MBA Human Resource Management', 'MBA (Human Resource Management)',
            'PGDM HR', 'PGDM (HR)', 'PGDM Human Resource Management', 'MMS HR', 'MBA HRM', 'MBA People Management',
            'MBA Organisational Behaviour and HR',
        ]],
        'mba_operations' => ['mba', 'MBA (Operations & Supply Chain Management)', 'MBA-Ops', [
            'MBA Operations', 'MBA (Operations)', 'MBA Operations Management', 'MBA Supply Chain', 'MBA Supply Chain Management',
            'MBA Logistics', 'MBA (Operations & Supply Chain Management)', 'PGDM Operations', 'PGDM (Operations)', 'MBA Logistics and Supply Chain',
            'MBA Production and Operations', 'MMS Operations', 'MBA Materials Management',
        ]],
        'mba_analytics' => ['mba', 'MBA (Business Analytics)', 'MBA-BA', [
            'MBA Business Analytics', 'MBA (Business Analytics)', 'MBA Analytics', 'MBA Data Analytics', 'MBA Data Science', 'PGDM Business Analytics',
            'PGDM (Business Analytics)', 'MBA Big Data Analytics', 'MBA (Data Science & Analytics)', 'MBA Business Intelligence',
        ]],
        'mba_intl' => ['mba', 'MBA (International Business)', 'MBA-IB', [
            'MBA International Business', 'MBA (International Business)', 'MBA Global Business', 'PGDM International Business',
            'PGDM (International Business)', 'MBA Foreign Trade', 'MBA Export Import', 'MBA (Global Management)',
        ]],
        'mba_it' => ['mba', 'MBA (IT & Systems Management)', 'MBA-IT', [
            'MBA IT', 'MBA (IT)', 'MBA Information Technology', 'MBA Systems', 'MBA Information Systems', 'MBA (IT & Systems)',
            'MBA IT Management', 'PGDM IT', 'PGDM (IT)', 'MBA MIS', 'MBA Systems Management', 'MBA Technology Management',
        ]],
        'mba_healthcare' => ['mba', 'MBA (Healthcare & Hospital Management)', 'MBA-Health', [
            'MBA Healthcare', 'MBA (Healthcare)', 'MBA Hospital Management', 'MBA Hospital Administration', 'MBA Healthcare Management',
            'MBA Healthcare and Hospital Management', 'MHA', 'Master of Hospital Administration', 'PGDM Healthcare', 'MBA Pharma Management',
            'MBA Pharmaceutical Management',
        ]],
        'mba_entrepreneurship' => ['mba', 'MBA (Entrepreneurship & Innovation)', 'MBA-Ent', [
            'MBA Entrepreneurship', 'MBA (Entrepreneurship)', 'MBA Innovation and Entrepreneurship', 'MBA Family Business',
            'MBA Startup Management', 'PGDM Entrepreneurship', 'MBA (Innovation & Entrepreneurship)', 'MBA Venture Management',
        ]],
        'mba_agri' => ['mba', 'MBA (Agri-Business & Rural Management)', 'MBA-Agri', [
            'MBA Agribusiness', 'MBA Agri Business', 'MBA (Agri-Business)', 'MBA Agribusiness Management', 'MBA Rural Management',
            'MBA (Rural Management)', 'PGDM Rural Management', 'PGDM Agri Business Management', 'PGDM ABM', 'MBA Food and Agribusiness',
            'MBA Dairy Management', 'MBA Cooperative Management',
        ]],

        // ═════════════════════════ COMMERCE · B.COM ═════════════════════════
        'bcom' => ['bcom', 'B.Com (General)', 'B.Com', [
            'B.Com', 'BCom', 'B Com', 'B.Com.', 'Bachelor of Commerce', 'B.Com Pass', 'B.Com General', 'B.Com (General)', 'B.Com (Pass)',
            'B.Com Programme', 'B.Com (Programme)', 'Commerce', 'B.Com Regular', 'B.Com (Hons.) General',
        ]],
        'bcom_hons' => ['bcom', 'B.Com (Honours)', 'B.Com Hons', [
            'B.Com Hons', 'B.Com (Hons)', 'B.Com (Hons.)', 'B.Com. (Hons.)', 'B.Com Honours', 'B.Com (Honours)', 'BCom Hons', 'BCom (Hons)',
            'Bachelor of Commerce (Honours)', 'Bachelor of Commerce Honours', 'B.Com Honors',
        ]],
        'bcom_accounting' => ['bcom', 'B.Com (Accounting & Finance)', 'B.Com A&F', [
            'B.Com Accounting and Finance', 'B.Com (Accounting & Finance)', 'B.Com A&F', 'B.Com Finance', 'B.Com (Finance)',
            'B.Com Accounting', 'B.Com (Accounting)', 'B.Com Financial Accounting', 'B.Com Corporate Accounting', 'B.Com Finance and Accounting',
            'B.Com (Accounting and Taxation)', 'B.Com Accountancy', 'BAF', 'Bachelor of Accounting and Finance', 'B.Com (Financial Markets)',
            'B.Com Financial Markets', 'BFM', 'B.Com Investment Management',
        ]],
        'bcom_taxation' => ['bcom', 'B.Com (Taxation)', 'B.Com Tax', [
            'B.Com Taxation', 'B.Com (Taxation)', 'B.Com Tax', 'B.Com Tax Procedure and Practice', 'B.Com (Tax Procedures & Practice)',
            'B.Com Taxation and Law', 'B.Com Direct and Indirect Taxation',
        ]],
        'bcom_banking' => ['bcom', 'B.Com (Banking & Insurance)', 'B.Com B&I', [
            'B.Com Banking and Insurance', 'B.Com (Banking & Insurance)', 'B.Com Banking', 'B.Com Insurance', 'B.Com (Banking Management)',
            'B.Com Bank Management', 'B.Com Banking and Finance', 'B.Com (Banking and Finance)', 'B.Com BFSI', 'B.Com Financial Services',
        ]],
        'bcom_ca' => ['bcom', 'B.Com (Computer Applications)', 'B.Com CA', [
            'B.Com Computer Applications', 'B.Com (Computer Applications)', 'B.Com CA', 'B.Com (CA)', 'B.Com Computers', 'B.Com (Computers)',
            'B.Com Information Technology', 'B.Com (IT)', 'B.Com E-Commerce', 'B.Com (E-Commerce)', 'B.Com Computer Science',
            'B.Com Information Systems', 'B.Com Business Computing',
        ]],
        'bcom_professional' => ['bcom', 'B.Com (Professional: CA · CS · CMA integrated)', 'B.Com Prof', [
            'B.Com Professional', 'B.Com (Professional)', 'B.Com with CS', 'B.Com with CMA', 'B.Com + CS',
            'B.Com CA Integrated', 'B.Com (CA Integrated)', 'B.Com Professional Accounting', 'B.Com (ACCA)', 'B.Com with ACCA',
            'B.Com International Finance and Accounting', 'B.Com (IFA)', 'B.Com Professional Studies',
        ]],
        'bcom_international' => ['bcom', 'B.Com (International Business & Foreign Trade)', 'B.Com IB', [
            'B.Com International Business', 'B.Com (International Business)', 'B.Com Foreign Trade', 'B.Com (Foreign Trade)',
            'B.Com International Trade', 'B.Com Export Import', 'B.Com (Global Business)', 'B.Com Logistics', 'B.Com (Logistics & Supply Chain)',
            'B.Com Marketing', 'B.Com (Marketing)', 'B.Com Retail Management', 'B.Com Business Management',
        ]],
        'bcom_analytics' => ['bcom', 'B.Com (Business Analytics & FinTech)', 'B.Com BA', [
            'B.Com Business Analytics', 'B.Com (Business Analytics)', 'B.Com Analytics', 'B.Com FinTech', 'B.Com (FinTech)',
            'B.Com Data Analytics', 'B.Com Banking and FinTech', 'B.Com Accounting with AI', 'B.Com (Digital Finance)',
        ]],

        // ═════════════════════════ COMMERCE · M.COM ═════════════════════════
        'mcom' => ['mcom', 'M.Com (General)', 'M.Com', [
            'M.Com', 'MCom', 'M Com', 'M.Com.', 'Master of Commerce', 'M.Com General', 'M.Com (General)', 'M.Com Regular', 'M.Com Previous',
            'M.Com Final',
        ]],
        'mcom_accounting' => ['mcom', 'M.Com (Accounting & Finance)', 'M.Com A&F', [
            'M.Com Accounting and Finance', 'M.Com (Accounting & Finance)', 'M.Com Accounting', 'M.Com Finance', 'M.Com (Finance)',
            'M.Com Advanced Accounting', 'M.Com Financial Management', 'M.Com Corporate Accounting', 'M.Com Accountancy', 'M.Com Cost and Management Accounting',
        ]],
        'mcom_taxation' => ['mcom', 'M.Com (Taxation)', 'M.Com Tax', [
            'M.Com Taxation', 'M.Com (Taxation)', 'M.Com Tax', 'M.Com Direct Taxation', 'M.Com Indirect Taxation', 'M.Com Taxation and Law',
        ]],
        'mcom_banking' => ['mcom', 'M.Com (Banking & Insurance)', 'M.Com B&I', [
            'M.Com Banking and Insurance', 'M.Com (Banking & Insurance)', 'M.Com Banking', 'M.Com Insurance', 'M.Com Bank Management',
            'M.Com Banking and Finance', 'M.Com International Business', 'M.Com Business Management', 'M.Com Marketing',
        ]],

        // ═════════════════════════ COMMERCE · PROFESSIONAL ═════════════════════════
        'chartered_accountancy' => ['comm_prof', 'Chartered Accountancy (CA)', 'CA (ICAI)', [
            'Chartered Accountancy', 'Chartered Accountant', 'CA Foundation', 'CA Intermediate', 'CA Inter', 'CA Final', 'ICAI', 'CA Aspirant', 'CA (Foundation)', 'CA (Intermediate)', 'CA (Final)',
        ]],
        'company_secretary' => ['comm_prof', 'Company Secretary (CS)', 'CS (ICSI)', [
            'Company Secretary', 'Company Secretaryship', 'CS Foundation', 'CS Executive', 'CS Professional', 'ICSI', 'CS (Executive)', 'CS (Professional)', 'Company Secretaries',
        ]],
        'cma' => ['comm_prof', 'Cost & Management Accountancy (CMA)', 'CMA', [
            'CMA', 'Cost and Management Accountancy', 'Cost Accountancy', 'ICWA', 'CMA Foundation', 'CMA Intermediate', 'CMA Final', 'ICMAI',
            'Cost and Works Accountancy', 'Cost Accountant', 'Management Accountancy', 'CMA India',
        ]],
        'global_finance' => ['comm_prof', 'Global Finance Certifications (ACCA · CPA · CFA)', 'ACCA/CPA/CFA', [
            'ACCA', 'CPA', 'US CPA', 'CFA', 'CFA Level 1', 'CFA Level 2', 'CMA US', 'US CMA', 'FRM', 'Financial Risk Manager', 'ACCA UK',
            'Association of Chartered Certified Accountants', 'Certified Public Accountant', 'Chartered Financial Analyst', 'CIMA',
            'Global Accounting Certifications',
        ]],

        // ═════════════════════════ ARTS · LANGUAGES & LITERATURE ═════════════════════════
        'english' => ['lang_lit', 'English (Literature & Language)', 'English', [
            ...$degree($ba, ['English', 'English Literature', 'English Language and Literature', 'English Honours', 'English (Hons)']),
            'English Literature', 'English Language', 'English Studies', 'Literature in English', 'ELT', 'English Language Teaching',
            'Functional English', 'BA Functional English', 'Communicative English', 'English and Communication',
        ]],
        'hindi' => ['lang_lit', 'Hindi', 'Hindi', [
            ...$degree($ba, ['Hindi', 'Hindi Literature', 'Hindi Honours', 'Hindi (Hons)']),
            'Hindi Sahitya', 'Hindi Bhasha', 'Hindi Journalism', 'Hindi Language and Literature',
        ]],
        'sanskrit' => ['lang_lit', 'Sanskrit', 'Sanskrit', [
            ...$degree($ba, ['Sanskrit', 'Sanskrit Honours', 'Sanskrit Literature', 'Sanskrit (Hons)']),
            'Shastri', 'Acharya', 'Sanskrit Vyakarana', 'Vedic Studies', 'Classical Sanskrit', 'Indology',
        ]],
        'urdu_persian' => ['lang_lit', 'Urdu · Arabic · Persian', 'Urdu/Arabic', [
            ...$degree($ba, ['Urdu', 'Urdu Literature', 'Urdu Honours', 'Arabic', 'Arabic Literature', 'Persian', 'Persian Literature']),
            'Islamic Studies', 'Arabic and Islamic Studies', 'Urdu Language and Literature',
        ]],
        'regional_lang' => ['lang_lit', 'Regional Languages (Bengali, Tamil, Marathi, Telugu…)', 'Regional', [
            ...$degree($ba, ['Bengali', 'Tamil', 'Telugu', 'Kannada', 'Malayalam', 'Marathi', 'Gujarati', 'Odia', 'Punjabi', 'Assamese']),
            'Bengali Literature', 'Tamil Literature', 'Telugu Literature', 'Kannada Literature', 'Malayalam Literature', 'Marathi Literature',
            'Gujarati Literature', 'Odia Literature', 'Punjabi Literature', 'Regional Language', 'Regional Languages', 'Indian Languages',
        ]],
        'foreign_lang' => ['lang_lit', 'Foreign Languages (French, German, Spanish, Japanese…)', 'Foreign Lang', [
            ...$degree($ba, ['French', 'German', 'Spanish', 'Japanese', 'Chinese', 'Russian', 'Korean', 'Italian']),
            'Foreign Languages', 'Foreign Language', 'Modern European Languages', 'Applied Foreign Languages', 'Translation Studies',
            'Interpretation and Translation',
        ]],
        'linguistics' => ['lang_lit', 'Linguistics', 'Linguistics', [
            ...$degree($ba, ['Linguistics', 'Applied Linguistics', 'Computational Linguistics']),
            'Phonetics', 'Linguistics and Phonetics', 'General Linguistics',
        ]],

        // ═════════════════════════ ARTS · HISTORY, HERITAGE & PHILOSOPHY ═════════════════════════
        'history' => ['history_phil', 'History', 'History', [
            ...$degree($ba, ['History', 'History Honours', 'History (Hons)', 'Medieval History', 'Modern History', 'Indian History']),
            'Medieval and Modern History', 'World History', 'Modern Indian History',
        ]],
        'ahc' => ['history_phil', 'Ancient History, Culture & Archaeology', 'AIHC', [
            ...$degree($ba, ['Ancient Indian History', 'Ancient Indian History Culture and Archaeology', 'Archaeology', 'Ancient History', 'Museology']),
            'AIHC', 'AIHC&A', 'AIHCA', 'Ancient History Culture and Archaeology', 'Archaeology and Museology', 'Epigraphy', 'Numismatics',
            'Indian Art and Culture', 'Heritage Studies', 'Heritage Management',
        ]],
        'philosophy' => ['history_phil', 'Philosophy', 'Philosophy', [
            ...$degree($ba, ['Philosophy', 'Philosophy Honours', 'Philosophy (Hons)', 'Logic', 'Ethics']),
            'Indian Philosophy', 'Western Philosophy', 'Philosophy and Religion', 'Comparative Religion', 'Religious Studies',
            'Philosophy and Ethics',
        ]],

        // ═════════════════════════ ARTS · POLITICAL SCIENCE & PUBLIC ADMINISTRATION ═════════════════════════
        'political_science' => ['polsci_pa', 'Political Science', 'Pol Sci', [
            ...$degree($ba, ['Political Science', 'Political Science Honours', 'Political Science (Hons)', 'Politics', 'Civics']),
            'Pol Sci', 'Polity', 'Political Studies', 'Government and Politics', 'Politics and Governance',
        ]],
        'public_admin' => ['polsci_pa', 'Public Administration', 'Public Admin', [
            ...$degree($ba, ['Public Administration', 'Public Policy', 'Public Administration (Hons)', 'Governance']),
            'MPA', 'Master of Public Administration', 'Public Policy and Governance', 'Public Administration and Governance', 'Urban Governance',
            'Local Self Government',
        ]],
        'intl_relations' => ['polsci_pa', 'International Relations & Strategic Studies', 'IR', [
            ...$degree($ba, ['International Relations', 'Strategic Studies', 'Defence and Strategic Studies', 'Defence Studies', 'Diplomacy', 'Peace and Conflict Studies']),
            'IR', 'International Studies', 'International Relations and Politics', 'Defence Studies and Management', 'Area Studies',
            'Global Studies', 'Security Studies',
        ]],

        // ═════════════════════════ ARTS · ECONOMICS ═════════════════════════
        'economics' => ['economics', 'Economics', 'Economics', [
            ...$degree($ba, ['Economics', 'Economics Honours', 'Economics (Hons)']),
            'B.Sc Economics', 'BSc Economics', 'M.Sc Economics', 'MSc Economics', 'Economics (Honours)', 'Eco', 'Eco Hons', 'Economic Studies',
            'Economics and Finance', 'Business Economics', 'BA Business Economics', 'B.Sc. (Hons) Economics',
        ]],
        'applied_economics' => ['economics', 'Applied Economics & Econometrics', 'Applied Eco', [
            ...$degree($ba, ['Applied Economics', 'Econometrics', 'Development Economics', 'Financial Economics', 'Quantitative Economics']),
            'Economics (Econometrics)', 'MSc Econometrics', 'M.Sc. Applied Economics', 'Applied Economics and Statistics',
            'Mathematical Economics', 'Economics and Statistics', 'Agricultural Economics', 'Rural Economics', 'Environmental Economics',
        ]],

        // ═════════════════════════ ARTS · PSYCHOLOGY ═════════════════════════
        'psychology' => ['psychology', 'Psychology', 'Psychology', [
            ...$degree($ba, ['Psychology', 'Psychology Honours', 'Psychology (Hons)', 'Applied Psychology']),
            'B.Sc Psychology', 'BSc Psychology', 'M.Sc Psychology', 'MSc Psychology', 'B.Sc. (Hons) Psychology', 'Psychology (Honours)',
            'General Psychology', 'Applied Psychology', 'Psychology and Counselling',
        ]],
        'clinical_psychology' => ['psychology', 'Clinical & Counselling Psychology', 'Clinical Psy', [
            ...$degree($ba, ['Clinical Psychology', 'Counselling Psychology', 'Counseling Psychology', 'Child Psychology']),
            'M.Sc Clinical Psychology', 'MSc Clinical Psychology', 'M.Phil Clinical Psychology', 'Clinical and Counselling Psychology',
            'Counselling', 'Counseling', 'Counselling and Psychotherapy', 'Mental Health', 'Health Psychology', 'Neuropsychology',
        ]],
        'org_psychology' => ['psychology', 'Industrial & Organisational Psychology', 'I/O Psy', [
            ...$degree($ba, ['Industrial Psychology', 'Organisational Psychology', 'Organizational Psychology', 'Industrial and Organisational Psychology']),
            'I/O Psychology', 'IO Psychology', 'Industrial Organisational Psychology', 'Human Resource Psychology', 'Applied Organisational Psychology',
            'Forensic Psychology', 'Social Psychology',
        ]],

        // ═════════════════════════ ARTS · SOCIOLOGY, ANTHROPOLOGY & SOCIAL WORK ═════════════════════════
        'sociology' => ['sociology_sw', 'Sociology', 'Sociology', [
            ...$degree($ba, ['Sociology', 'Sociology Honours', 'Sociology (Hons)', 'Social Sciences']),
            'Applied Sociology', 'Sociology and Social Anthropology', 'Social Studies', 'Social Sciences', 'Gender Studies', 'Womens Studies',
            'Women Studies', 'Gender and Development',
        ]],
        'anthropology' => ['sociology_sw', 'Anthropology', 'Anthropology', [
            ...$degree($ba, ['Anthropology', 'Anthropology Honours', 'Social Anthropology', 'Cultural Anthropology', 'Physical Anthropology']),
            'Anthropology (Hons)', 'Tribal Studies', 'Forensic Anthropology',
        ]],
        'social_work' => ['sociology_sw', 'Social Work (BSW · MSW)', 'Social Work', [
            'BSW', 'MSW', 'B.S.W', 'M.S.W', 'Bachelor of Social Work', 'Master of Social Work', 'Social Work', 'MSW Medical and Psychiatric Social Work',
            'MSW Community Development', 'MSW Human Resource Management', 'Social Work (Rural Development)', 'MSW Criminology and Correctional Administration',
            'Medical and Psychiatric Social Work', 'Community Development', 'Family and Child Welfare',
            ...$degree($ba, ['Social Work']),
        ]],
        'development_studies' => ['sociology_sw', 'Development & Rural Studies', 'Dev Studies', [
            ...$degree($ba, ['Development Studies', 'Rural Development', 'Rural Studies', 'Development Practice', 'Livelihoods']),
            'MA Rural Development', 'Rural Management', 'NGO Management', 'Development Communication', 'Development Administration',
            'Human Rights', 'MA Human Rights', 'Disaster Management', 'Peace Studies',
        ]],

        // ═════════════════════════ ARTS · JOURNALISM, MASS COMMUNICATION & MEDIA ═════════════════════════
        'journalism' => ['media_comm', 'Journalism & Mass Communication', 'Journalism', [
            'BJMC', 'MJMC', 'BMC', 'MMC', 'BAJMC', 'MAJMC', 'B.J.M.C', 'M.J.M.C', 'BJ', 'MJ', 'BAJ', 'MAJ', 'Journalism', 'Mass Communication',
            'Journalism and Mass Communication', 'Mass Communication and Journalism', 'Mass Media', 'Media Studies', 'Communication Studies',
            'Bachelor of Journalism and Mass Communication', 'Master of Journalism and Mass Communication', 'Electronic Media', 'Print Journalism',
            'Broadcast Journalism', 'Digital Journalism', 'Multimedia Journalism',
            ...$degree($ba, ['Journalism', 'Mass Communication', 'Journalism and Mass Communication', 'Communication', 'Media Studies']),
        ]],
        'film_media' => ['media_comm', 'Film, Television & Digital Media', 'Film & Media', [
            ...$degree($ba, ['Film Studies', 'Film Making', 'Filmmaking', 'Film and Television Production', 'Television Production', 'Digital Media', 'New Media', 'Multimedia', 'Animation']),
            'Film and TV', 'Film Production', 'Cinema Studies', 'Radio and Television', 'Audio Visual Production', 'Media Production',
            'Video Production', 'Screenwriting', 'Digital Film Making', 'Animation and Multimedia', 'Visual Communication', 'BVC', 'MVC',
        ]],
        'advertising_pr' => ['media_comm', 'Advertising & Public Relations', 'Ad & PR', [
            ...$degree($ba, ['Advertising', 'Public Relations', 'Advertising and Public Relations', 'Advertising and Marketing Communication', 'Corporate Communication', 'Strategic Communication']),
            'Advertising and PR', 'Ad and PR', 'PR', 'Advertising and Mass Communication', 'Public Relations and Advertising',
            'Corporate Communication', 'Marketing Communication', 'Integrated Marketing Communication', 'IMC', 'Event Management and PR',
        ]],

        // ═════════════════════════ ARTS · EDUCATION ═════════════════════════
        'bed_med' => ['education', 'Education (B.Ed · M.Ed)', 'B.Ed / M.Ed', [
            'B.Ed', 'BEd', 'M.Ed', 'MEd', 'B.Ed.', 'M.Ed.', 'Bachelor of Education', 'Master of Education', 'B.Ed Special Education',
            'B.Ed (Special Education)', 'Integrated B.Ed', 'B.A. B.Ed', 'BA BEd', 'B.Sc. B.Ed', 'BSc BEd', 'ITEP', 'Integrated Teacher Education Programme',
            'Teacher Education', 'Education', 'Secondary Education', 'B.Ed M.Ed', 'M.Ed Special Education', 'Physical Education B.Ed',
            ...$degree($ba, ['Education']),
        ]],
        'elementary_ece' => ['education', 'Elementary & Early Childhood Education', 'Elem Edu', [
            'D.El.Ed', 'DElEd', 'B.El.Ed', 'BElEd', 'Diploma in Elementary Education', 'Bachelor of Elementary Education', 'Elementary Education',
            'Early Childhood Education', 'ECCE', 'Early Childhood Care and Education', 'Nursery Teacher Training', 'NTT', 'Montessori Teacher Training',
            'Pre-Primary Teacher Training', 'Primary Teacher Training', 'PTT', 'B.A. Elementary Education', 'BA Early Childhood Education',
            'Child Development', 'Human Development and Family Studies',
        ]],

        // ═════════════════════════ ARTS · GEOGRAPHY & ENVIRONMENTAL STUDIES ═════════════════════════
        'geography' => ['geography_env', 'Geography', 'Geography', [
            ...$degree($ba, ['Geography', 'Geography Honours', 'Geography (Hons)', 'Human Geography', 'Physical Geography']),
            'B.Sc Geography', 'BSc Geography', 'M.Sc Geography', 'MSc Geography', 'Geography and Geoinformatics', 'Applied Geography',
            'Remote Sensing and GIS', 'Geoinformatics', 'GIS', 'Geospatial Technology', 'Regional Planning', 'Geography (Honours)',
        ]],
        'environmental_studies' => ['geography_env', 'Environmental Studies & Sustainability', 'Env Studies', [
            ...$degree($ba, ['Environmental Studies', 'Environmental Science', 'Environmental Management', 'Sustainability Studies', 'Climate Studies']),
            'B.Sc Environmental Science', 'BSc Environmental Science', 'M.Sc Environmental Science', 'MSc Environmental Science', 'Environmental Studies',
            'Ecology and Environment', 'Sustainable Development', 'Climate Change and Sustainability', 'Environment Management', 'Wildlife Studies',
            'Forestry', 'Natural Resource Management',
        ]],

        // ═════════════════════════ ARTS · FINE & PERFORMING ARTS ═════════════════════════
        'fine_arts' => ['fine_arts', 'Fine Arts (BFA · MFA)', 'Fine Arts', [
            'BFA', 'MFA', 'B.F.A', 'M.F.A', 'Bachelor of Fine Arts', 'Master of Fine Arts', 'Fine Arts', 'Visual Arts', 'Painting', 'Sculpture',
            'Applied Art', 'Applied Arts', 'Commercial Art', 'Graphic Arts', 'Printmaking', 'Art History', 'History of Art', 'Art Education',
            'BFA Painting', 'BFA Sculpture', 'BFA Applied Art', 'BFA Graphic Design', 'MFA Painting', 'Drawing and Painting',
            ...$degree($ba, ['Fine Arts', 'Visual Arts', 'Drawing and Painting', 'Art History']),
        ]],
        'performing_arts' => ['fine_arts', 'Performing Arts (Music · Dance · Theatre)', 'Perf Arts', [
            'BPA', 'MPA Performing Arts', 'Bachelor of Performing Arts', 'Master of Performing Arts', 'Performing Arts', 'Music', 'Vocal Music',
            'Instrumental Music', 'Hindustani Music', 'Carnatic Music', 'Dance', 'Kathak', 'Bharatanatyam', 'Odissi', 'Theatre', 'Drama',
            'Theatre Arts', 'Dramatics', 'Theatre and Drama', 'Sangeet', 'Sangeet Visharad', 'Music Performance',
            ...$degree($ba, ['Music', 'Dance', 'Drama', 'Theatre Arts', 'Performing Arts']),
        ]],

        // ═════════════════════════ ARTS · OTHER ═════════════════════════
        'ba_general' => ['other_arts', 'B.A. (General / Programme / Multi-subject)', 'BA General', [
            'BA', 'B.A.', 'B.A', 'Bachelor of Arts', 'BA General', 'B.A. General', 'BA Pass', 'B.A. (Pass)', 'BA Programme', 'B.A. Programme',
            'BA (Programme)', 'B.A. (Prog.)', 'BA Prog', 'BA (General)', 'B.A. (Generic)', 'BA Multidisciplinary', 'BA Liberal Arts',
            'Liberal Arts', 'Liberal Studies', 'Humanities', 'Arts', 'Arts and Humanities', 'Humanities and Social Sciences', 'BA LLB Arts',
            'MA', 'M.A.', 'Master of Arts', 'MA General', 'Interdisciplinary Studies',
        ]],
        'library_science' => ['other_arts', 'Library & Information Science', 'Library Sci', [
            'BLIS', 'MLIS', 'B.Lib', 'M.Lib', 'BLISc', 'MLISc', 'B.Lib.I.Sc', 'M.Lib.I.Sc', 'Library Science', 'Library and Information Science',
            'Information Science Library', 'Bachelor of Library and Information Science', 'Master of Library and Information Science',
            'Library Management', 'Archival Studies', 'Archives and Records Management', 'Information Management',
        ]],
        'physical_education' => ['other_arts', 'Physical Education & Sports Science', 'Phys Edu', [
            'BPEd', 'MPEd', 'B.P.Ed', 'M.P.Ed', 'BPES', 'MPES', 'Bachelor of Physical Education', 'Master of Physical Education',
            'Physical Education', 'Physical Education and Sports', 'Sports Science', 'Sports Management', 'Yoga', 'Yoga and Naturopathy',
            'Sports Coaching', 'Exercise Science', 'Health and Physical Education', 'Sports and Exercise Science', 'Sports Psychology',
            ...$degree($ba, ['Physical Education', 'Yoga', 'Sports Science']),
        ]],
        'home_science' => ['other_arts', 'Home Science & Nutrition', 'Home Sci', [
            'Home Science', 'BSc Home Science', 'B.Sc Home Science', 'MSc Home Science', 'M.Sc Home Science', 'Food and Nutrition',
            'Food Science and Nutrition', 'Nutrition and Dietetics', 'Dietetics', 'Human Development', 'Textiles and Clothing',
            'Fashion and Textile', 'Interior Design Home Science', 'Community Science', 'Family Resource Management', 'Clinical Nutrition',
            ...$degree($ba, ['Home Science']),
        ]],
        'tourism_travel' => ['other_arts', 'Tourism & Travel Studies', 'Tourism', [
            'BTTM', 'MTTM', 'BTM', 'MTM', 'BTS', 'Tourism', 'Tourism Management', 'Travel and Tourism', 'Tourism and Travel Management',
            'Travel and Tourism Management', 'Tourism Studies', 'Tourism and Hospitality', 'Bachelor of Tourism and Travel Management',
            'Master of Tourism Administration', 'MTA', 'Tourism Administration', 'Heritage Tourism', 'Ecotourism', 'Travel Management',
            ...$degree($ba, ['Tourism', 'Tourism and Travel']),
        ]],
    ],

    /*
    | Spellings that only make sense inside one department. department => branch => labels.
    */
    'scoped_aliases' => [
        'management' => [
            'mba' => ['General Management', 'Management', 'General', 'Business Management', 'MBA General'],
            'mba_marketing' => ['Marketing', 'Marketing Management', 'Sales and Marketing', 'Digital Marketing', 'Brand Management'],
            'mba_finance' => ['Finance', 'Financial Management', 'Banking and Finance', 'BFSI', 'Banking Finance and Insurance'],
            'mba_hr' => ['HR', 'Human Resource', 'Human Resources', 'HRM', 'Human Resource Management', 'HR Management', 'People Management'],
            'mba_operations' => ['Operations', 'Operations Management', 'Supply Chain', 'SCM', 'Logistics', 'Operations and Supply Chain Management'],
            'mba_analytics' => ['Business Analytics', 'Analytics', 'Data Analytics', 'Business Intelligence'],
            'mba_intl' => ['International Business', 'IB', 'Global Business', 'Foreign Trade'],
            'mba_it' => ['IT', 'IT Management', 'Information Systems', 'Systems', 'MIS', 'Information Technology'],
            'mba_healthcare' => ['Healthcare', 'Hospital Administration', 'Hospital Management', 'Healthcare Management'],
            'mba_entrepreneurship' => ['Entrepreneurship', 'Innovation and Entrepreneurship', 'Startup Management'],
            'mba_agri' => ['Agri Business', 'Agribusiness', 'Rural Management', 'ABM'],
            'bba' => ['Business Administration', 'BBA General', 'Bachelor of Business Administration'],
            'bba_marketing' => ['BBA Marketing'],
        ],
        'commerce' => [
            'bcom' => ['Commerce', 'General', 'Pass', 'Regular', 'Programme'],
            'bcom_hons' => ['Honours', 'Hons'],
            'bcom_accounting' => ['Accounting', 'Accounting and Finance', 'Finance', 'Accountancy', 'Financial Accounting', 'Accounts'],
            'bcom_taxation' => ['Taxation', 'Tax'],
            'bcom_banking' => ['Banking', 'Banking and Insurance', 'Insurance', 'Banking and Finance'],
            'bcom_ca' => ['Computer Applications', 'Computers', 'Computer Science', 'IT', 'E-Commerce', 'Information Technology'],
            'bcom_professional' => ['Professional', 'Integrated'],
            'bcom_international' => ['International Business', 'Foreign Trade', 'Marketing', 'Logistics'],
            'bcom_analytics' => ['Business Analytics', 'Analytics', 'FinTech'],
            'mcom' => ['MCom', 'Master of Commerce', 'Post Graduate Commerce', 'PG Commerce'],
            'mcom_accounting' => ['M.Com Accounting', 'Advanced Accounting', 'Accounting and Finance'],
            'mcom_taxation' => ['M.Com Taxation'],
            'mcom_banking' => ['M.Com Banking'],
            'chartered_accountancy' => ['CA', 'C.A.', 'Chartered Accountancy', 'Foundation', 'Intermediate', 'Inter', 'Final'],
            'company_secretary' => ['CS', 'C.S.', 'Company Secretary', 'Executive', 'Professional'],
            'cma' => ['CMA', 'ICWA', 'Cost Accountancy', 'Cost and Management Accountancy'],
            'global_finance' => ['ACCA', 'CPA', 'CFA', 'FRM', 'CIMA'],
        ],
        'arts' => [
            'english' => ['English', 'English Hons', 'English Honours', 'Literature'],
            'ba_general' => ['General', 'Pass', 'Programme', 'Arts'],
        ],
    ],
];
