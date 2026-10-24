<?php

/*
|--------------------------------------------------------------------------
| AI interviews for the Management, Commerce and Arts / Humanities departments
|--------------------------------------------------------------------------
|
| Per discipline: the role cards a student sees in the Practice-interview studio (config/practice_interviews.php reads
| this file), and a starter set of technical ("domain") interview questions for the question bank. Read by
| the 2026_11_02_100500 migration, which also creates Mellow's role templates from `roles` (three rounds each, like every other template).
| This file only gives every department something on day one. Further questions go in the usual way (content/interview-bank/*.json
| with `interview:import-bank`, or the Ops screen); further role cards are added here.
|
| The questions are original and meant to be ANSWERED ALOUD: each asks for reasoning, an example or a decision, never a recited
| definition. `notes` is the reviewer's guide to a good answer. People-and-scenario questions (HR, behavioural, situational) are not here —
| every discipline shares the general ones already in the bank.
|
| Role shape: key, title, blurb, interests (ids a student picked at onboarding), tags (matched against question tags).
|
*/

return [

    'bba' => [
        'label' => 'Business Administration (BBA)',
        'roles' => [
            ['key' => 'bba_sales', 'title' => 'Sales & Marketing Executive Trainee', 'blurb' => 'Customers, pricing, channels and a campaign you would run.', 'interests' => [], 'tags' => ['marketing', 'sales', 'pricing']],
            ['key' => 'bba_ops', 'title' => 'Management Trainee — Operations & Administration', 'blurb' => 'Planning, coordination and keeping a business running.', 'interests' => [], 'tags' => ['management', 'operations']],
            ['key' => 'bba_accounts', 'title' => 'Business Fundamentals — any role', 'blurb' => 'A broad check across management, marketing and accounting basics.', 'interests' => [], 'tags' => []],
        ],
        'questions' => [
            ['q' => 'Explain the difference between marketing and selling, using a business you know as an example.', 'difficulty' => 'easy', 'secs' => 120, 'tags' => ['marketing', 'sales'], 'notes' => 'Selling focuses on pushing an existing product to convert it into cash; marketing starts from customer needs, covers research, product, price, place and promotion, and aims at lasting relationships. A good answer gives a concrete example of each.'],
            ['q' => 'What is the difference between a profit and loss account and a balance sheet?', 'difficulty' => 'easy', 'secs' => 120, 'tags' => ['accounting'], 'notes' => 'The P&L shows income and expenses over a period and ends in profit or loss; the balance sheet is a snapshot at a date of assets, liabilities and owners\' funds. Profit flows from the first into the equity side of the second.'],
            ['q' => 'Name the four classic functions of management and give one example of each from a business or college club you have seen.', 'difficulty' => 'easy', 'secs' => 150, 'tags' => ['management'], 'notes' => 'Planning, organising, directing/leading and controlling. Look for a real example and for the idea that control feeds back into planning.'],
            ['q' => 'A new product is launching in a market with strong competitors. How would you decide its price?', 'difficulty' => 'medium', 'secs' => 150, 'tags' => ['pricing', 'marketing'], 'notes' => 'Cost-plus as a floor, competitors\' prices, perceived value and target segment; skimming versus penetration pricing and why. Strong answers link price to positioning rather than quoting a formula.'],
        ],
    ],

    'mba' => [
        'label' => 'MBA / PGDM',
        'roles' => [
            ['key' => 'mba_mgmt', 'title' => 'Management Trainee — General Management', 'blurb' => 'Structured thinking on strategy, operations and people.', 'interests' => [], 'tags' => ['strategy', 'operations']],
            ['key' => 'mba_marketing', 'title' => 'Marketing / Brand Manager Trainee', 'blurb' => 'Segmentation, positioning, pricing and channels.', 'interests' => [], 'tags' => ['marketing', 'brand']],
            ['key' => 'mba_finance', 'title' => 'Finance / Investment Analyst', 'blurb' => 'Valuation, capital budgeting and reading the numbers.', 'interests' => [], 'tags' => ['finance', 'valuation']],
            ['key' => 'mba_hr', 'title' => 'HR Business Partner Trainee', 'blurb' => 'Hiring, development and performance.', 'interests' => [], 'tags' => ['hr', 'training']],
            ['key' => 'mba_fundamentals', 'title' => 'Management fundamentals — any role', 'blurb' => 'A broad check across the whole MBA core.', 'interests' => [], 'tags' => []],
        ],
        'questions' => [
            ['q' => 'Walk me through how you would decide whether a company should enter a new city market.', 'difficulty' => 'medium', 'secs' => 180, 'tags' => ['strategy'], 'notes' => 'A structure beats a list: market size and growth, customers and needs, competition, the company\'s capabilities and cost to serve, risks, and a decision rule (payback or NPV). Reward clarifying questions and stated assumptions.'],
            ['q' => 'What is the difference between NPV and IRR, and when can the two give conflicting rankings of projects?', 'difficulty' => 'hard', 'secs' => 180, 'tags' => ['finance', 'valuation'], 'notes' => 'NPV is an absolute value at the cost of capital; IRR is the rate that makes NPV zero. They can conflict for mutually exclusive projects of different scale or timing, and IRR can be multiple or misleading for non-conventional cash flows; NPV is preferred.'],
            ['q' => 'How would you segment, target and position a new premium product? Use an example.', 'difficulty' => 'medium', 'secs' => 150, 'tags' => ['marketing', 'brand'], 'notes' => 'Segment on needs and behaviour, not just demographics; choose a segment that is large, reachable and profitable; position with a clear point of difference. Check the example is consistent from segment to message.'],
            ['q' => 'A plant\'s output has fallen 15% over two months. What would you investigate first, and why?', 'difficulty' => 'medium', 'secs' => 150, 'tags' => ['operations'], 'notes' => 'Break output into inputs and process: demand, materials, machine availability and downtime, labour and absenteeism, quality rework, scheduling. Look for hypothesis-driven investigation and data requests.'],
            ['q' => 'How would you measure whether a training programme was effective?', 'difficulty' => 'medium', 'secs' => 150, 'tags' => ['hr', 'training'], 'notes' => 'Kirkpatrick\'s four levels - reaction, learning, behaviour and results - with a baseline and a comparison group where possible; tie to a business metric such as error rates or sales.'],
        ],
    ],

    'bcom' => [
        'label' => 'Commerce (B.Com)',
        'roles' => [
            ['key' => 'bcom_accounts', 'title' => 'Accounts Executive / Assistant', 'blurb' => 'Books of account, reconciliations and month-end close.', 'interests' => [], 'tags' => ['accounting', 'banking']],
            ['key' => 'bcom_tax', 'title' => 'Tax & Compliance Executive', 'blurb' => 'GST, returns and keeping a business compliant.', 'interests' => [], 'tags' => ['gst', 'tax']],
            ['key' => 'bcom_fundamentals', 'title' => 'Commerce fundamentals — any role', 'blurb' => 'A broad check across accounting, tax, law and banking basics.', 'interests' => [], 'tags' => []],
        ],
        'questions' => [
            ['q' => 'What is the difference between a journal and a ledger, and why do we prepare a trial balance?', 'difficulty' => 'easy', 'secs' => 120, 'tags' => ['accounting'], 'notes' => 'The journal records transactions in date order; the ledger classifies them by account. A trial balance checks arithmetical accuracy of the double entry (equal debits and credits) but does not catch every error, such as errors of principle.'],
            ['q' => 'Explain how input tax credit under GST prevents the cascading of taxes in a simple supply chain.', 'difficulty' => 'medium', 'secs' => 150, 'tags' => ['gst', 'tax'], 'notes' => 'Each seller charges GST on its sale and claims credit for GST paid on purchases, so tax is paid only on the value added at each stage. A numeric manufacturer-wholesaler-retailer example is ideal.'],
            ['q' => 'What is a bank reconciliation statement, and why might a company\'s cash book and its bank passbook show different balances?', 'difficulty' => 'easy', 'secs' => 120, 'tags' => ['banking', 'accounting'], 'notes' => 'Timing differences: cheques issued but not yet presented, cheques deposited but not yet cleared, direct credits or debits, bank charges and interest, plus errors. The statement reconciles the two to find the true balance.'],
            ['q' => 'How do straight-line and written-down-value depreciation differ, and when would a business prefer each?', 'difficulty' => 'medium', 'secs' => 150, 'tags' => ['accounting'], 'notes' => 'Straight-line charges equal amounts; WDV charges a fixed percentage of the reducing balance, so higher early charges. WDV suits assets that lose value or productivity early (and gives tax timing effects); straight-line suits steady use.'],
        ],
    ],

    'mcom' => [
        'label' => 'Commerce (M.Com)',
        'roles' => [
            ['key' => 'mcom_reporting', 'title' => 'Financial Reporting Analyst', 'blurb' => 'Ind AS, consolidation and disclosures.', 'interests' => [], 'tags' => ['reporting', 'indas']],
            ['key' => 'mcom_corpfin', 'title' => 'Corporate Finance / Tax Associate', 'blurb' => 'Valuation, tax planning and transfer pricing.', 'interests' => [], 'tags' => ['valuation', 'tax']],
            ['key' => 'mcom_fundamentals', 'title' => 'Advanced commerce fundamentals — any role', 'blurb' => 'A broad check across reporting, finance and tax.', 'interests' => [], 'tags' => []],
        ],
        'questions' => [
            ['q' => 'What are the main differences between Ind AS and the old Indian GAAP? Name two areas where the accounting treatment changes.', 'difficulty' => 'medium', 'secs' => 180, 'tags' => ['reporting', 'indas'], 'notes' => 'Ind AS converges with IFRS: fair-value measurement of financial instruments (Ind AS 109), a five-step revenue model (Ind AS 115), on-balance-sheet lease accounting (Ind AS 116) and mandatory consolidation. Any two, explained with an effect on the financial statements.'],
            ['q' => 'Explain how you would value a company using discounted cash flows. What are the main inputs and where do the biggest errors creep in?', 'difficulty' => 'hard', 'secs' => 200, 'tags' => ['valuation'], 'notes' => 'Forecast free cash flows, discount at WACC, add a terminal value, subtract net debt. Errors: aggressive growth and terminal assumptions, an inconsistent discount rate, double counting. A sensitivity table is a good sign.'],
            ['q' => 'What is transfer pricing, and why do tax authorities scrutinise it?', 'difficulty' => 'medium', 'secs' => 150, 'tags' => ['tax'], 'notes' => 'Pricing of transactions between related entities. Because it can be used to shift profits to low-tax jurisdictions, the arm\'s-length principle requires related-party prices to match what independent parties would agree; documentation is mandatory above thresholds.'],
        ],
    ],

    'comm_prof' => [
        'label' => 'Professional Commerce (CA · CS · CMA)',
        'roles' => [
            ['key' => 'prof_audit', 'title' => 'Article Assistant — Audit & Assurance', 'blurb' => 'Audit evidence, controls and reporting.', 'interests' => [], 'tags' => ['audit']],
            ['key' => 'prof_secretarial', 'title' => 'Company Secretarial Trainee', 'blurb' => 'Board processes, filings and compliance.', 'interests' => [], 'tags' => ['companylaw', 'compliance']],
            ['key' => 'prof_cost', 'title' => 'Cost Accounts Trainee', 'blurb' => 'Costing, budgets and variance analysis.', 'interests' => [], 'tags' => ['costing']],
            ['key' => 'prof_fundamentals', 'title' => 'Finance & compliance fundamentals — any role', 'blurb' => 'A broad check across audit, law and costing.', 'interests' => [], 'tags' => []],
        ],
        'questions' => [
            ['q' => 'What is the difference between a statutory audit and an internal audit?', 'difficulty' => 'easy', 'secs' => 120, 'tags' => ['audit'], 'notes' => 'A statutory audit is required by law, performed by an independent auditor appointed by shareholders, and gives an opinion on the financial statements for the members. An internal audit is commissioned by management to assess controls and risk, can cover any area, and reports to management or the audit committee.'],
            ['q' => 'What are the main duties of a company secretary under the Companies Act, 2013?', 'difficulty' => 'medium', 'secs' => 150, 'tags' => ['companylaw', 'compliance'], 'notes' => 'As a key managerial personnel: ensuring compliance with the Act, secretarial standards and other laws, convening and recording board and general meetings, filing returns and forms with the registrar, and advising the board on governance.'],
            ['q' => 'How does cost accounting differ from financial accounting, and where does standard costing help management?', 'difficulty' => 'medium', 'secs' => 150, 'tags' => ['costing'], 'notes' => 'Financial accounting reports to outsiders by statute, cost accounting serves internal decisions. Standard costing sets targets and highlights variances (price, usage, efficiency) so managers act by exception.'],
        ],
    ],

    'lang_lit' => [
        'label' => 'Languages & Literature',
        'roles' => [
            ['key' => 'lit_content', 'title' => 'Content Writer / Editor', 'blurb' => 'Clear, accurate writing and editing for a deadline.', 'interests' => [], 'tags' => ['writing', 'editing']],
            ['key' => 'lit_teacher', 'title' => 'Language Teacher (Trainee)', 'blurb' => 'Teaching grammar, reading and speaking.', 'interests' => [], 'tags' => ['teaching', 'language']],
            ['key' => 'lit_translation', 'title' => 'Translator / Localisation Associate', 'blurb' => 'Meaning, tone and culture across languages.', 'interests' => [], 'tags' => ['translation']],
            ['key' => 'lit_fundamentals', 'title' => 'Language & literature fundamentals — any role', 'blurb' => 'A broad check across texts, critical thinking and usage.', 'interests' => [], 'tags' => []],
        ],
        'questions' => [
            ['q' => 'Choose a literary work you love and explain how its form, and not only its story, creates meaning.', 'difficulty' => 'medium', 'secs' => 180, 'tags' => ['literature'], 'notes' => 'Look for specific features - narration, structure, imagery, rhythm or point of view - tied to effect, rather than a plot summary. Honest personal response backed by textual detail is the goal.'],
            ['q' => 'How would you edit a 1,000-word article full of passive voice and long sentences without losing the author\'s voice?', 'difficulty' => 'easy', 'secs' => 150, 'tags' => ['editing', 'writing'], 'notes' => 'Read for meaning first, then fix clarity: prefer active verbs where the doer matters, split sentences at natural breaks, cut redundancy, keep distinctive phrasing and agree changes with the author.'],
            ['q' => 'What is the difference between translation and transcreation, and when would you use each?', 'difficulty' => 'medium', 'secs' => 150, 'tags' => ['translation'], 'notes' => 'Translation stays close to the source meaning; transcreation re-creates the intent, tone and emotional effect for a new culture (slogans, marketing, humour). Legal and technical texts need translation; advertising often needs transcreation.'],
            ['q' => 'How would you teach the present perfect tense to learners whose first language has no such tense?', 'difficulty' => 'medium', 'secs' => 150, 'tags' => ['teaching', 'language'], 'notes' => 'Start from meaning and contrast (experience versus a finished time), use timelines and many contextual examples, then controlled and free practice, and anticipate typical errors such as using the simple past with "already".'],
        ],
    ],

    'history_phil' => [
        'label' => 'History, Heritage & Philosophy',
        'roles' => [
            ['key' => 'hist_heritage', 'title' => 'Heritage / Museum Associate', 'blurb' => 'Interpreting objects, sites and sources for the public.', 'interests' => [], 'tags' => ['heritage', 'archaeology']],
            ['key' => 'hist_research', 'title' => 'Research & Civil Services Aspirant', 'blurb' => 'Sources, argument and analysis.', 'interests' => [], 'tags' => ['historiography', 'ethics']],
            ['key' => 'hist_fundamentals', 'title' => 'History & philosophy fundamentals — any role', 'blurb' => 'A broad check across sources, periods and ideas.', 'interests' => [], 'tags' => []],
        ],
        'questions' => [
            ['q' => 'How do historians decide whether a source is reliable? Give an example of a source with a bias.', 'difficulty' => 'medium', 'secs' => 150, 'tags' => ['historiography'], 'notes' => 'Authorship, purpose, audience, date relative to events and corroboration with other sources. A royal chronicle or colonial report is useful but partisan; a good answer shows how it can still be used with care.'],
            ['q' => 'Why is the Indus Valley civilisation also called the Harappan civilisation, and what remains unknown about it?', 'difficulty' => 'easy', 'secs' => 120, 'tags' => ['archaeology', 'heritage'], 'notes' => 'Named after Harappa, the first site identified (1920s); it is also called Harappan by site-naming convention. The script is still undeciphered, and the causes of the decline remain debated.'],
            ['q' => 'Explain either utilitarianism or deontology using an everyday dilemma.', 'difficulty' => 'medium', 'secs' => 150, 'tags' => ['ethics'], 'notes' => 'Utilitarianism judges acts by their consequences for overall welfare; deontology by duties and rules regardless of outcome (Kant\'s categorical imperative). Reward a clear example and one honest limitation of the theory.'],
        ],
    ],

    'polsci_pa' => [
        'label' => 'Political Science & Public Administration',
        'roles' => [
            ['key' => 'pol_policy', 'title' => 'Public Policy / Research Analyst', 'blurb' => 'Evidence, evaluation and recommendations.', 'interests' => [], 'tags' => ['policy', 'evaluation']],
            ['key' => 'pol_civil', 'title' => 'Civil Services Aspirant', 'blurb' => 'Constitution, governance and current affairs.', 'interests' => [], 'tags' => ['constitution', 'governance']],
            ['key' => 'pol_fundamentals', 'title' => 'Political science fundamentals — any role', 'blurb' => 'A broad check across theory, institutions and policy.', 'interests' => [], 'tags' => []],
        ],
        'questions' => [
            ['q' => 'What is federalism, and how does the Indian version differ from the American one?', 'difficulty' => 'medium', 'secs' => 150, 'tags' => ['constitution', 'governance'], 'notes' => 'India is often called quasi-federal or a "Union of States": a strong Centre, residual powers with the Union, single citizenship, an integrated judiciary, emergency provisions and a Governor appointed by the Centre, versus the US dual constitutions and citizenship.'],
            ['q' => 'Explain the separation of powers among the legislature, executive and judiciary, with a recent example of how one checks another.', 'difficulty' => 'medium', 'secs' => 180, 'tags' => ['constitution'], 'notes' => 'Parliament makes laws and controls the executive through questions and money bills; the executive implements; courts review legality and constitutionality. India has a fusion of legislature and executive in the parliamentary system.'],
            ['q' => 'How would you evaluate whether a government welfare scheme is working?', 'difficulty' => 'medium', 'secs' => 180, 'tags' => ['policy', 'evaluation'], 'notes' => 'Clear objectives and indicators, baseline and comparison, coverage and leakage, cost per outcome, beneficiary feedback and unintended effects. Mixed methods; be wary of confusing outputs with outcomes.'],
        ],
    ],

    'economics' => [
        'label' => 'Economics',
        'roles' => [
            ['key' => 'eco_analyst', 'title' => 'Research / Policy Analyst', 'blurb' => 'Reading data and explaining what it means.', 'interests' => [], 'tags' => ['macro', 'policy']],
            ['key' => 'eco_bank', 'title' => 'Banking & Financial Services Associate', 'blurb' => 'Rates, inflation and how money moves.', 'interests' => [], 'tags' => ['macro', 'money']],
            ['key' => 'eco_fundamentals', 'title' => 'Economics fundamentals — any role', 'blurb' => 'A broad check across micro, macro and the Indian economy.', 'interests' => [], 'tags' => []],
        ],
        'questions' => [
            ['q' => 'What is inflation, what causes it, and how does the RBI try to control it?', 'difficulty' => 'easy', 'secs' => 150, 'tags' => ['macro', 'money'], 'notes' => 'A sustained rise in the general price level; demand-pull, cost-push and imported inflation. The RBI uses the policy repo rate under a flexible inflation-targeting framework (4% with a +/-2% band), plus liquidity tools such as CRR and open market operations.'],
            ['q' => 'Explain opportunity cost with an example from your own decisions.', 'difficulty' => 'easy', 'secs' => 90, 'tags' => ['micro'], 'notes' => 'The value of the next best alternative given up. A good answer names a real trade-off and notes that the cost is not only monetary.'],
            ['q' => 'What is the difference between GDP and GNP, and why might the two differ for India?', 'difficulty' => 'medium', 'secs' => 150, 'tags' => ['macro'], 'notes' => 'GNP = GDP + net factor income from abroad. India usually has net outflows of factor income (profits, interest) so GNP is slightly below GDP.'],
        ],
    ],

    'psychology' => [
        'label' => 'Psychology',
        'roles' => [
            ['key' => 'psy_hr', 'title' => 'HR / Talent Associate', 'blurb' => 'Assessment, motivation and workplace behaviour.', 'interests' => [], 'tags' => ['assessment', 'organisational']],
            ['key' => 'psy_counsel', 'title' => 'Counselling Trainee / Wellbeing Associate', 'blurb' => 'Listening, rapport and ethical practice.', 'interests' => [], 'tags' => ['counselling', 'ethics']],
            ['key' => 'psy_fundamentals', 'title' => 'Psychology fundamentals — any role', 'blurb' => 'A broad check across theory, methods and applications.', 'interests' => [], 'tags' => []],
        ],
        'questions' => [
            ['q' => 'What is the difference between reliability and validity in a psychological test?', 'difficulty' => 'medium', 'secs' => 150, 'tags' => ['assessment'], 'notes' => 'Reliability is consistency (test-retest, internal consistency); validity is whether it measures what it claims (content, criterion, construct). A test can be reliable without being valid, but not valid without being reliable.'],
            ['q' => 'How would you build rapport with a client in a first counselling session?', 'difficulty' => 'medium', 'secs' => 150, 'tags' => ['counselling'], 'notes' => 'Explain confidentiality and its limits, listen without judging, reflect feelings, ask open questions, respect pace and culture. Genuine warmth and clear boundaries matter more than technique names.'],
            ['q' => 'What is cognitive dissonance? Give an example from everyday life.', 'difficulty' => 'easy', 'secs' => 120, 'tags' => ['social'], 'notes' => 'Festinger: discomfort from holding conflicting beliefs or from behaviour that conflicts with beliefs, relieved by changing the belief, the behaviour or adding justification. Example: a smoker who rationalises the habit.'],
        ],
    ],

    'sociology_sw' => [
        'label' => 'Sociology, Anthropology & Social Work',
        'roles' => [
            ['key' => 'soc_ngo', 'title' => 'Programme Officer / Social Worker (NGO)', 'blurb' => 'Working with communities and individuals.', 'interests' => [], 'tags' => ['community', 'casework']],
            ['key' => 'soc_csr', 'title' => 'CSR & Community Development Associate', 'blurb' => 'Designing and monitoring social programmes.', 'interests' => [], 'tags' => ['community', 'csr']],
            ['key' => 'soc_research', 'title' => 'Social Research Associate', 'blurb' => 'Surveys, interviews and fieldwork.', 'interests' => [], 'tags' => ['research']],
            ['key' => 'soc_fundamentals', 'title' => 'Sociology & social work fundamentals — any role', 'blurb' => 'A broad check across theory, society and practice.', 'interests' => [], 'tags' => []],
        ],
        'questions' => [
            ['q' => 'How would you find out what a community needs before starting a programme there?', 'difficulty' => 'medium', 'secs' => 150, 'tags' => ['community'], 'notes' => 'Participatory methods - focus groups, community mapping, transect walks, key-informant interviews - combined with secondary data, so that priorities come from the people and not from assumptions; validate findings with the community.'],
            ['q' => 'What is the difference between a survey and an ethnographic study, and when would you use each?', 'difficulty' => 'medium', 'secs' => 150, 'tags' => ['research'], 'notes' => 'Surveys give breadth and numbers across many respondents; ethnography gives depth and meaning through prolonged observation. Choose by the question: how many versus how and why.'],
            ['q' => 'What does confidentiality mean in social work practice, and in what situations might it have to be broken?', 'difficulty' => 'medium', 'secs' => 150, 'tags' => ['casework', 'ethics'], 'notes' => 'Information is shared only with consent. Exceptions: serious risk of harm to the client or others, abuse of a child or vulnerable person, or a legal obligation; the worker should explain limits at the start and disclose the minimum necessary.'],
        ],
    ],

    'media_comm' => [
        'label' => 'Journalism, Mass Communication & Media',
        'roles' => [
            ['key' => 'media_reporter', 'title' => 'Reporter / Digital Journalist', 'blurb' => 'Verifying, writing and filing a story.', 'interests' => [], 'tags' => ['journalism', 'verification']],
            ['key' => 'media_social', 'title' => 'Content & Social Media Executive', 'blurb' => 'Audience, platform and message.', 'interests' => [], 'tags' => ['content', 'advertising']],
            ['key' => 'media_pr', 'title' => 'PR & Corporate Communication Associate', 'blurb' => 'Reputation, crises and stakeholders.', 'interests' => [], 'tags' => ['pr']],
            ['key' => 'media_fundamentals', 'title' => 'Media fundamentals — any role', 'blurb' => 'A broad check across news, ethics and production.', 'interests' => [], 'tags' => []],
        ],
        'questions' => [
            ['q' => 'You receive an unverified viral video claiming a disaster in a city. What do you do before publishing anything?', 'difficulty' => 'medium', 'secs' => 150, 'tags' => ['verification', 'journalism'], 'notes' => 'Trace the original source, check location and date (reverse image search, landmarks, metadata), contact local sources and authorities, seek a second independent confirmation, and label uncertainty clearly. Speed never outranks accuracy.'],
            ['q' => 'What is the difference between advertising and public relations?', 'difficulty' => 'easy', 'secs' => 120, 'tags' => ['pr', 'advertising'], 'notes' => 'Advertising is paid, controlled messaging in space or time bought by the sponsor; PR earns coverage and goodwill by building relationships and credibility with media and stakeholders, with less control over the message.'],
            ['q' => 'How do you decide whether something is news? Explain using news values.', 'difficulty' => 'easy', 'secs' => 120, 'tags' => ['journalism'], 'notes' => 'Timeliness, proximity, impact, prominence, conflict, human interest and novelty; combinations raise newsworthiness, and the audience of the outlet shapes the judgement.'],
        ],
    ],

    'education' => [
        'label' => 'Education & Teaching',
        'roles' => [
            ['key' => 'edu_teacher', 'title' => 'Primary / Secondary Teacher (Trainee)', 'blurb' => 'Planning a lesson and managing a classroom.', 'interests' => [], 'tags' => ['pedagogy', 'classroom']],
            ['key' => 'edu_early', 'title' => 'Early-Years Educator', 'blurb' => 'Play-based learning for young children.', 'interests' => [], 'tags' => ['earlyyears']],
            ['key' => 'edu_designer', 'title' => 'Instructional Designer / Ed-tech Associate', 'blurb' => 'Designing learning that works online.', 'interests' => [], 'tags' => ['assessment', 'design']],
            ['key' => 'edu_fundamentals', 'title' => 'Education fundamentals — any role', 'blurb' => 'A broad check across pedagogy, assessment and policy.', 'interests' => [], 'tags' => []],
        ],
        'questions' => [
            ['q' => 'How would you handle a classroom where students learn at very different speeds?', 'difficulty' => 'medium', 'secs' => 150, 'tags' => ['pedagogy', 'classroom'], 'notes' => 'Differentiation: tiered tasks, flexible grouping, peer tutoring, formative checks to find gaps early, and clear routines. Shows respect for both the struggling and the advanced learner.'],
            ['q' => 'Which ideas of the National Education Policy 2020 would you apply in your own classroom?', 'difficulty' => 'medium', 'secs' => 150, 'tags' => ['pedagogy'], 'notes' => 'Any grounded choices: foundational literacy and numeracy, mother-tongue instruction in early years, competency-based and experiential learning, the 5+3+3+4 stages, holistic assessment and multilingualism. Prefer concrete classroom practice to quoting the policy.'],
            ['q' => 'How would you plan a play-based activity to teach counting to a group of four-year-olds?', 'difficulty' => 'easy', 'secs' => 120, 'tags' => ['earlyyears', 'pedagogy'], 'notes' => 'Concrete objects and songs before symbols, one-to-one correspondence, small groups, movement and games, short attention spans, and observation of each child rather than a test. Safety and inclusion of children who are not yet speaking much.'],
            ['q' => 'What is the difference between formative and summative assessment? Give one example of each.', 'difficulty' => 'easy', 'secs' => 120, 'tags' => ['assessment'], 'notes' => 'Formative assessment monitors learning during teaching and guides next steps (exit tickets, questioning, drafts); summative assesses what has been learnt at the end (term exam, final project).'],
        ],
    ],

    'geography_env' => [
        'label' => 'Geography & Environmental Studies',
        'roles' => [
            ['key' => 'geo_gis', 'title' => 'GIS / Remote Sensing Analyst', 'blurb' => 'Maps, satellite data and spatial analysis.', 'interests' => [], 'tags' => ['gis']],
            ['key' => 'geo_env', 'title' => 'Environment & Sustainability Associate', 'blurb' => 'Impact assessment, compliance and sustainability.', 'interests' => [], 'tags' => ['environment']],
            ['key' => 'geo_fundamentals', 'title' => 'Geography fundamentals — any role', 'blurb' => 'A broad check across physical and human geography.', 'interests' => [], 'tags' => []],
        ],
        'questions' => [
            ['q' => 'What is GIS, and how could a municipality use it to plan waste-collection routes?', 'difficulty' => 'medium', 'secs' => 150, 'tags' => ['gis'], 'notes' => 'A system to capture, store, analyse and map spatial data. Layers such as roads, ward boundaries, bin locations and population density support network analysis for shortest routes, coverage gaps and bin placement.'],
            ['q' => 'What is an Environmental Impact Assessment, and who is responsible for preparing it in India?', 'difficulty' => 'medium', 'secs' => 150, 'tags' => ['environment'], 'notes' => 'A study of a proposed project\'s likely environmental effects and mitigation, required for listed projects under the EIA Notification, 2006. The project proponent commissions it through accredited consultants, followed by public consultation and appraisal.'],
            ['q' => 'Explain the main causes of the Indian monsoon in simple terms.', 'difficulty' => 'medium', 'secs' => 150, 'tags' => ['climate'], 'notes' => 'Differential heating of land and sea, northward shift of the ITCZ, the low-pressure over the north-west, cross-equatorial south-west winds, with El Nino, the Indian Ocean Dipole and the Himalayas influencing strength.'],
        ],
    ],

    'fine_arts' => [
        'label' => 'Fine & Performing Arts',
        'roles' => [
            ['key' => 'art_visual', 'title' => 'Visual Artist / Illustrator', 'blurb' => 'Process, style and professional practice.', 'interests' => [], 'tags' => ['visual']],
            ['key' => 'art_educator', 'title' => 'Arts Educator / Facilitator', 'blurb' => 'Introducing art and performance to learners.', 'interests' => [], 'tags' => ['education', 'performance']],
            ['key' => 'art_fundamentals', 'title' => 'Arts fundamentals — any role', 'blurb' => 'A broad check across practice and appreciation.', 'interests' => [], 'tags' => []],
        ],
        'questions' => [
            ['q' => 'How do you develop your own style without simply copying the artists you admire?', 'difficulty' => 'easy', 'secs' => 120, 'tags' => ['visual'], 'notes' => 'Study influences deliberately, combine several, keep a sketchbook, repeat themes and materials that feel natural, and seek critique. Authentic reflection beats a rehearsed answer.'],
            ['q' => 'Describe the process you follow from a client brief to a finished piece.', 'difficulty' => 'medium', 'secs' => 150, 'tags' => ['visual'], 'notes' => 'Clarify the brief, research and references, thumbnails or drafts, feedback at agreed checkpoints, revision, delivery in the right formats, and a clear note on timelines and rights.'],
            ['q' => 'How would you introduce a school group to a classical dance or music form in 45 minutes?', 'difficulty' => 'medium', 'secs' => 150, 'tags' => ['education', 'performance'], 'notes' => 'A short story or context, a live demonstration, one simple participatory element (a rhythm cycle or a mudra), and a brief reflection; pitched to age with respect for the tradition.'],
        ],
    ],

    'other_arts' => [
        'label' => 'Arts & Humanities',
        'roles' => [
            ['key' => 'oth_library', 'title' => 'Library & Information Associate', 'blurb' => 'Organising and serving information.', 'interests' => [], 'tags' => ['library']],
            ['key' => 'oth_sports', 'title' => 'Sports & Fitness Coach (Trainee)', 'blurb' => 'Training plans and safe practice.', 'interests' => [], 'tags' => ['fitness']],
            ['key' => 'oth_hospitality', 'title' => 'Tourism & Hospitality Executive', 'blurb' => 'Itineraries, guests and service recovery.', 'interests' => [], 'tags' => ['tourism']],
            ['key' => 'oth_nutrition', 'title' => 'Nutrition / Dietetics Associate', 'blurb' => 'Meal plans and healthy-eating guidance.', 'interests' => [], 'tags' => ['nutrition']],
            ['key' => 'oth_fundamentals', 'title' => 'Arts & humanities fundamentals — any role', 'blurb' => 'A broad check across general knowledge and communication.', 'interests' => [], 'tags' => []],
        ],
        'questions' => [
            ['q' => 'How would you organise a library so readers can find books without asking for help?', 'difficulty' => 'easy', 'secs' => 120, 'tags' => ['library'], 'notes' => 'A recognised classification scheme (Dewey or Colon) with clear shelf guides and signage, an OPAC/catalogue, sensible zoning of sections and regular shelf-reading. Ranganathan\'s "save the time of the reader".'],
            ['q' => 'How would you design a four-week fitness plan for a beginner who sits at a desk all day?', 'difficulty' => 'medium', 'secs' => 150, 'tags' => ['fitness'], 'notes' => 'Screen readiness and goals, progressive overload from low volume, mix of walking, mobility, basic strength and posture work, rest days, and a way to measure progress; safety first and referral if there are medical concerns.'],
            ['q' => 'A tour group\'s flight is cancelled on the day of arrival. What do you do in the first two hours?', 'difficulty' => 'medium', 'secs' => 150, 'tags' => ['tourism'], 'notes' => 'Communicate early and honestly, secure the airline\'s rebooking and compensation obligations, re-arrange transfers and hotel check-in with suppliers, offer an alternative first-day plan, and document everything for insurance.'],
            ['q' => 'Plan a balanced one-day vegetarian meal chart for a 35-year-old with high cholesterol.', 'difficulty' => 'medium', 'secs' => 150, 'tags' => ['nutrition'], 'notes' => 'Emphasise soluble fibre (oats, legumes, fruit), whole grains, nuts in moderation, unsaturated fats, less saturated fat and fried food, and portion control; mention seeing a clinician for medical management.'],
        ],
    ],

    'other' => [
        'label' => 'Other Engineering (Chemical · Biotech · Aerospace · Agri · Mining)',
        'roles' => [
            ['key' => 'oth_eng_process', 'title' => 'Process / Plant Engineer Trainee', 'blurb' => 'Reactors, balances and keeping a plant safe and steady.', 'interests' => [], 'tags' => ['process', 'chemical']],
            ['key' => 'oth_eng_bio', 'title' => 'Bioprocess / QC Associate', 'blurb' => 'Fermentation, enzymes and lab-to-plant scale-up.', 'interests' => [], 'tags' => ['biotech', 'bioprocess']],
            ['key' => 'oth_eng_aero', 'title' => 'Aerospace Design / Maintenance Trainee', 'blurb' => 'Aerodynamics, propulsion and airworthiness.', 'interests' => [], 'tags' => ['aerospace', 'aerodynamics']],
            ['key' => 'oth_eng_agri', 'title' => 'Agri-engineering / Farm Machinery Trainee', 'blurb' => 'Soil, water and machinery for the field.', 'interests' => [], 'tags' => ['agri', 'irrigation']],
            ['key' => 'oth_eng_mining', 'title' => 'Metallurgical / Mining Engineer Trainee', 'blurb' => 'Mineral processing, heat treatment and materials.', 'interests' => [], 'tags' => ['metallurgy', 'mining']],
            ['key' => 'oth_eng_fundamentals', 'title' => 'Engineering fundamentals — any role', 'blurb' => 'A broad check across mathematics, mechanics, fluids and safety.', 'interests' => [], 'tags' => []],
        ],
        'questions' => [
            ['q' => 'Explain the difference between a batch reactor, a CSTR and a plug-flow reactor, and say when you would choose each one.', 'difficulty' => 'medium', 'secs' => 180, 'tags' => ['process', 'chemical'], 'notes' => 'Batch: no flow, flexible, small-scale or slow reactions. CSTR: perfectly mixed, uniform composition equal to the exit, good temperature control. PFR: composition changes along the length, higher conversion per volume for positive-order reactions. Look for a link to the reaction order and heat effects.'],
            ['q' => 'How would you scale a fermentation process from a 1-litre shake flask to a 1,000-litre fermenter? What changes and what must you keep constant?', 'difficulty' => 'hard', 'secs' => 200, 'tags' => ['biotech', 'bioprocess'], 'notes' => 'Oxygen transfer (kLa) or constant power per volume, mixing time, heat removal, sterility and foaming, inoculum build-up. Strong answers name the scale-up criterion they hold constant and admit that no single one is perfect.'],
            ['q' => 'Why does an aircraft wing stall, and what should a pilot do to recover?', 'difficulty' => 'medium', 'secs' => 150, 'tags' => ['aerospace', 'aerodynamics'], 'notes' => 'Stall is flow separation when the angle of attack passes the critical value, not a lack of speed as such. Recovery: reduce the angle of attack (lower the nose), add power, level the wings, then climb out gently.'],
            ['q' => 'How would you decide the irrigation schedule for a wheat field?', 'difficulty' => 'medium', 'secs' => 150, 'tags' => ['agri', 'irrigation'], 'notes' => 'Crop stage and root depth, soil water-holding capacity (field capacity and wilting point), allowable depletion, evapotranspiration and rainfall, and the system efficiency. Mention critical stages (crown-root initiation, tillering, flowering).'],
            ['q' => 'Compare annealing, quenching and tempering of steel: what does each do to its structure and properties?', 'difficulty' => 'medium', 'secs' => 170, 'tags' => ['metallurgy', 'mining'], 'notes' => 'Annealing: slow cooling, soft and ductile, relieves stress. Quenching: fast cooling to martensite, very hard but brittle. Tempering: reheating quenched steel to trade some hardness for toughness. A good answer links each to cooling rate and the phase diagram.'],
        ],
    ],
];
