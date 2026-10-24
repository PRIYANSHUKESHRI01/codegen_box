<?php

/*
|--------------------------------------------------------------------------
| Domain Prep taxonomy for the non-engineering departments.
|--------------------------------------------------------------------------
|
| Structure only — the subjects and topics a question is filed under. Aligned with the public syllabi
| students of these programmes are actually examined on: UGC-NET (Management 17, Commerce 08, Economics 01,
| Education 09, Political Science, Sociology, Psychology, Mass Communication & Journalism, History, Philosophy,
| Geography, Library Science, Physical Education …), the CUET-UG domain subjects, CMAT / CAT / XAT for MBA,
| the ICAI / ICSI / ICMAI foundation and intermediate syllabi for the professional courses, and the
| university BBA / B.Com / M.Com / BA / MA curricula that placements draw on.
|
| Read by the 2026_11_02_100200 migration (deploy runs `migrate`, not `db:seed`) and safe to re-run: rows are
| keyed by (discipline, code). Staff can add, rename and re-order from Mellow Ops → Domain Prep → Taxonomy afterwards.
|
| Shape: discipline => [ subject_code => [ name, [ topic name, … ], ?[ branch codes ] ] ]
|   • a topic's code is derived from its name (slugified with underscores) by the migration;
|   • the optional third element lists the branches the subject is FOR. Absent = every branch of the discipline
|     sees it (the shared core); present = only those branches do (their specialisation).
|
*/

return [

    // ═════════════════════════════ MANAGEMENT · BBA ═════════════════════════════
    'bba' => [
        'principles_management' => ['Principles of Management', [
            'Management thought: Taylor, Fayol, Mayo', 'Planning, MBO and decision-making', 'Organising: structure, authority, delegation',
            'Staffing and directing', 'Leadership styles and theories', 'Controlling and coordination',
        ]],
        'organisational_behaviour' => ['Organisational Behaviour', [
            'Perception, attitudes and personality', 'Motivation theories', 'Group dynamics and teams', 'Conflict and negotiation',
            'Organisational culture and change', 'Learning and stress',
        ]],
        'business_economics' => ['Business Economics', [
            'Demand, supply and elasticity', 'Production and cost', 'Market structures', 'National income and growth',
            'Money, banking and inflation', 'Business cycles and policy',
        ]],
        'financial_accounting' => ['Financial Accounting', [
            'Accounting principles and standards', 'Journal, ledger and trial balance', 'Final accounts and adjustments',
            'Depreciation and inventory valuation', 'Rectification and reconciliation', 'Partnership and company accounts basics',
        ]],
        'business_maths_stats' => ['Business Mathematics & Statistics', [
            'Percentages, ratios and interest', 'Averages and dispersion', 'Correlation and regression', 'Probability',
            'Index numbers and time series', 'Sets, matrices and linear programming basics',
        ]],
        'marketing_management' => ['Marketing Management', [
            'Marketing concepts and the 4Ps', 'Segmentation, targeting and positioning', 'Consumer behaviour', 'Product life cycle and pricing',
            'Channels and promotion', 'Marketing research',
        ]],
        'financial_management' => ['Financial Management', [
            'Time value of money', 'Capital budgeting', 'Cost of capital and capital structure', 'Working capital management',
            'Dividend policy', 'Leverage',
        ]],
        'human_resource_management' => ['Human Resource Management', [
            'HR planning, recruitment and selection', 'Training and development', 'Performance appraisal', 'Compensation and benefits',
            'Industrial relations basics', 'Employee engagement and HR analytics',
        ]],
        'operations_management' => ['Production & Operations Management', [
            'Plant location and layout', 'Inventory control and EOQ', 'Quality: TQM, Six Sigma, ISO', 'Scheduling and PERT/CPM',
            'Productivity and lean', 'Supply chain basics',
        ]],
        'business_law_ethics' => ['Business Law & Ethics', [
            'Indian Contract Act, 1872', 'Sale of Goods Act, 1930', 'Companies Act, 2013 basics', 'Consumer Protection Act, 2019',
            'Negotiable Instruments Act, 1881', 'Business ethics and CSR',
        ]],
        'business_communication' => ['Business Communication', [
            'Communication process and barriers', 'Business letters and e-mail', 'Reports, minutes and memos', 'Presentations and meetings',
            'Listening and non-verbal communication',
        ]],
        'business_environment' => ['Business Environment & Entrepreneurship', [
            'PESTLE and the Indian business environment', 'Entrepreneurship and the start-up ecosystem', 'Business plans',
            'MSMEs and government schemes', 'Globalisation, WTO and FDI',
        ]],
        // Specialisations
        'digital_retail_marketing' => ['Digital & Retail Marketing', [
            'SEO, SEM and content marketing', 'Social media and influencer marketing', 'E-commerce and marketplaces', 'Retail formats and merchandising',
            'Marketing analytics and funnels',
        ], ['bba_marketing']],
        'banking_insurance_basics' => ['Banking, Insurance & Financial Services', [
            'Structure of the Indian banking system', 'RBI and monetary policy tools', 'Insurance principles and products',
            'Capital market instruments', 'Digital payments and UPI', 'Financial inclusion',
        ], ['bba_finance']],
        'hr_labour_laws' => ['Labour Laws & Employee Relations', [
            'The four Labour Codes', 'Industrial Disputes and trade unions', 'Wages, bonus and social security', 'Workplace safety and POSH',
            'Grievance handling and discipline',
        ], ['bba_hr']],
        'business_analytics_basics' => ['Business Analytics & Data Interpretation', [
            'Descriptive statistics and charts', 'Data interpretation: tables and graphs', 'Spreadsheet modelling',
            'SQL and data basics', 'Forecasting and KPIs', 'Data ethics and privacy',
        ], ['bba_analytics']],
        'logistics_scm_basics' => ['Logistics & Supply Chain Management', [
            'Supply chain structure and flows', 'Transportation and warehousing', 'Inventory models', 'Procurement and vendor management',
            'Incoterms and documentation', 'Reverse logistics and sustainability',
        ], ['bba_logistics']],
        'intl_business_basics' => ['International Business & Trade', [
            'Theories of international trade', 'Balance of payments and exchange rates', 'WTO, trade blocs and agreements',
            'Export-import procedure', 'Foreign market entry strategies', 'Cross-cultural management',
        ], ['bba_intl']],
        'startups_msme' => ['Start-ups, MSMEs & New Venture Creation', [
            'Idea validation and business models', 'Lean start-up and MVP', 'Funding: angel, VC and bootstrapping',
            'Startup India and MSME schemes', 'Family business succession', 'Pitching and valuation basics',
        ], ['bba_entrepreneurship']],
        'service_sector_management' => ['Aviation, Hospitality & Healthcare Services', [
            'Service marketing and the 7Ps', 'Service quality: SERVQUAL', 'Airline and airport operations', 'Hotel and event operations',
            'Hospital administration basics', 'Yield and revenue management',
        ], ['bba_sector']],
    ],

    // ═════════════════════════════ MANAGEMENT · MBA / PGDM ═════════════════════════════
    'mba' => [
        'managerial_economics' => ['Managerial Economics', [
            'Demand analysis and forecasting', 'Production, cost and break-even', 'Pricing and market structures', 'Game theory and oligopoly',
            'Macroeconomic environment for managers',
        ]],
        'accounting_for_managers' => ['Accounting for Managers', [
            'Financial statements and analysis', 'Ratio analysis', 'Cash flow and fund flow', 'Cost-volume-profit', 'Budgeting and variance analysis',
            'Ind AS fundamentals',
        ]],
        'quantitative_methods' => ['Business Statistics & Quantitative Methods', [
            'Probability and distributions', 'Sampling and hypothesis testing', 'Regression and correlation', 'Linear programming and decision theory',
            'Quantitative aptitude (CAT/CMAT style)', 'Data interpretation and logical reasoning',
        ]],
        'organisational_behaviour_hr' => ['Organisational Behaviour & HRM', [
            'Motivation and leadership', 'Group behaviour and conflict', 'Organisation design and change', 'Recruitment, appraisal and compensation',
            'Training and talent development',
        ]],
        'marketing_management' => ['Marketing Management', [
            'STP and positioning', 'Product, brand and pricing strategy', 'Distribution and integrated marketing communication',
            'Services and relationship marketing', 'Marketing metrics',
        ]],
        'financial_management' => ['Financial Management', [
            'Capital budgeting under risk', 'Cost of capital and valuation', 'Capital structure theories (MM, trade-off)', 'Working capital and dividend policy',
            'Mergers, acquisitions and restructuring',
        ]],
        'operations_management' => ['Operations Management', [
            'Process analysis and capacity', 'Inventory and aggregate planning', 'Quality management and Six Sigma', 'Project management: PERT/CPM',
            'Lean and theory of constraints',
        ]],
        'strategic_management' => ['Strategic Management', [
            'Vision, mission and environmental scanning', "Porter's Five Forces and value chain", 'Corporate strategy: BCG, GE, Ansoff',
            'Competitive advantage and resource-based view', 'Strategy implementation and balanced scorecard',
        ]],
        'business_law_ethics' => ['Business Law, Ethics & Governance', [
            'Contract and Sale of Goods Acts', 'Companies Act, 2013 and SEBI LODR', 'IBC, FEMA and competition law', 'Corporate governance and CSR',
            'Business ethics and whistle-blowing',
        ]],
        'research_methodology' => ['Research Methodology', [
            'Research design and hypotheses', 'Sampling and data collection', 'Scaling and questionnaire design', 'Multivariate techniques',
            'Report writing and ethics',
        ]],
        // Specialisations
        'consumer_brand' => ['Consumer Behaviour & Brand Management', [
            'Consumer decision process', 'Motivation, perception and learning', 'Brand equity and architecture', 'Pricing psychology',
            'Digital marketing and analytics', 'Sales and distribution management',
        ], ['mba_marketing']],
        'investment_markets' => ['Security Analysis, Portfolio & Financial Markets', [
            'Equity and bond valuation', 'CAPM, beta and portfolio theory', 'Derivatives: futures and options', 'Mutual funds and market microstructure',
            'Financial markets and SEBI', 'Risk management and VaR',
        ], ['mba_finance']],
        'talent_industrial_relations' => ['Talent Management, Compensation & Industrial Relations', [
            'Talent acquisition and succession', 'Compensation design and benchmarking', 'Performance management systems',
            'Labour Codes and industrial relations', 'Organisation development and HR analytics', 'Employer branding',
        ], ['mba_hr']],
        'supply_chain_quality' => ['Supply Chain, Logistics & Quality', [
            'Supply chain strategy and the bullwhip effect', 'Sourcing and vendor evaluation', 'Warehousing and transportation',
            'Demand forecasting', 'TQM, ISO 9001 and Six Sigma', 'Project and service operations',
        ], ['mba_operations']],
        'analytics_data_mining' => ['Business Analytics & Data Mining', [
            'Descriptive, predictive and prescriptive analytics', 'Regression and classification', 'Clustering and association rules',
            'Time-series forecasting', 'Data visualisation and dashboards', 'SQL, Python and Excel for analytics',
        ], ['mba_analytics']],
        'global_trade_forex' => ['International Business, Trade & Forex', [
            'International trade theories', 'Exchange rate determination and forex markets', 'Balance of payments',
            'Foreign trade policy and export finance', 'Incoterms and letters of credit', 'WTO and regional trade agreements',
        ], ['mba_intl']],
        'it_systems_management' => ['IT Management & Information Systems', [
            'MIS, ERP and CRM', 'Database design and SQL', 'Systems analysis and design', 'IT governance and cybersecurity',
            'Digital transformation and cloud', 'IT project management',
        ], ['mba_it']],
        'healthcare_management' => ['Healthcare & Hospital Management', [
            'Health systems and policy in India', 'Hospital planning and operations', 'Healthcare quality: NABH and JCI',
            'Health insurance and PM-JAY', 'Medical ethics and law', 'Epidemiology basics for managers',
        ], ['mba_healthcare']],
        'entrepreneurship_innovation' => ['Entrepreneurship, Innovation & Venture Finance', [
            'Opportunity recognition and business models', 'Lean start-up and design thinking', 'Venture funding and valuation',
            'Intellectual property rights', 'Scaling and exit strategies', 'Social entrepreneurship',
        ], ['mba_entrepreneurship']],
        'agribusiness_rural' => ['Agribusiness & Rural Management', [
            'Indian agriculture and agri-value chains', 'Agricultural marketing, MSP and APMC', 'Rural marketing and cooperatives',
            'Food processing and agri-exports', 'Rural development schemes', 'Agri-finance and NABARD',
        ], ['mba_agri']],
    ],

    // ═════════════════════════════ COMMERCE · B.COM ═════════════════════════════
    'bcom' => [
        'financial_accounting' => ['Financial Accounting', [
            'Accounting concepts and standards', 'Journal, ledger and subsidiary books', 'Trial balance and final accounts',
            'Depreciation and bills of exchange', 'Bank reconciliation and rectification', 'Accounts of non-profit organisations',
        ]],
        'corporate_accounting' => ['Corporate Accounting', [
            'Issue and forfeiture of shares', 'Redemption of preference shares and debentures', 'Final accounts of companies',
            'Amalgamation and absorption', 'Valuation of shares and goodwill', 'Holding company accounts',
        ]],
        'cost_management_accounting' => ['Cost & Management Accounting', [
            'Cost concepts and classification', 'Material, labour and overheads', 'Job, batch and process costing',
            'Marginal costing and CVP', 'Budgetary control', 'Standard costing and variances',
        ]],
        'business_corporate_law' => ['Business & Corporate Law', [
            'Indian Contract Act, 1872', 'Sale of Goods Act, 1930', 'Companies Act, 2013', 'Negotiable Instruments Act, 1881',
            'LLP Act, 2008', 'Consumer Protection Act, 2019',
        ]],
        'income_tax_law' => ['Income Tax Law & Practice', [
            'Residential status and incidence of tax', 'Salary income', 'House property and capital gains', 'Business income and deductions (Chapter VI-A)',
            'Computation of total income', 'TDS and advance tax',
        ]],
        'auditing_assurance' => ['Auditing & Assurance', [
            'Audit planning and evidence', 'Internal control and internal check', 'Vouching and verification', "Company audit and auditor's report",
            'Audit standards (SA) and ethics',
        ]],
        'business_economics' => ['Business Economics', [
            'Demand and supply analysis', 'Cost and revenue', 'Market forms and pricing', 'National income accounting', 'Money, banking and fiscal policy',
        ]],
        'business_maths_stats' => ['Business Mathematics & Statistics', [
            'Ratio, proportion and percentage', 'Simple and compound interest, annuities', 'Measures of central tendency and dispersion',
            'Correlation and regression', 'Index numbers and time series', 'Probability',
        ]],
        'financial_management' => ['Financial Management', [
            'Time value of money', 'Capital budgeting techniques', 'Cost of capital', 'Working capital', 'Leverages and capital structure',
        ]],
        'management_marketing' => ['Principles of Management & Marketing', [
            'Functions of management', 'Motivation and leadership', 'Marketing mix and segmentation', 'Consumer behaviour and market research',
            'Entrepreneurship and business environment',
        ]],
        // Specialisations
        'advanced_accounting_ind_as' => ['Advanced Accounting & Ind AS', [
            'Ind AS framework and first-time adoption', 'Revenue recognition (Ind AS 115)', 'Leases (Ind AS 116)', 'Consolidated financial statements',
            'Financial instruments basics', 'Cash flow statements (Ind AS 7)',
        ], ['bcom_hons']],
        'financial_statement_analysis' => ['Financial Statement Analysis & Reporting', [
            'Ratio and trend analysis', 'Common-size and comparative statements', 'Cash flow analysis', 'Earnings quality and red flags',
            'Integrated reporting and ESG disclosures', 'Equity research basics',
        ], ['bcom_accounting']],
        'advanced_taxation_gst' => ['GST, Tax Planning & International Taxation', [
            'GST: supply, place of supply and time of supply', 'Input tax credit and reverse charge', 'GST returns and e-invoicing',
            'Customs duty basics', 'Tax planning, avoidance and evasion', 'Transfer pricing and DTAA basics',
        ], ['bcom_taxation']],
        'banking_law_insurance' => ['Banking Law, Operations & Insurance', [
            'Banker-customer relationship', 'Negotiable instruments and cheques', 'RBI, CRR, SLR and monetary tools', 'Loans, NPAs and the SARFAESI Act',
            'Insurance principles and IRDAI', 'Digital banking and UPI',
        ], ['bcom_banking']],
        'commerce_it_systems' => ['Accounting Information Systems & E-Commerce', [
            'Computerised accounting and Tally', 'Spreadsheets for accounting', 'Databases and SQL basics', 'E-commerce models and payments',
            'Cyber law and IT Act, 2000', 'Data security and audit trails',
        ], ['bcom_ca']],
        'professional_foundation' => ['Professional Foundation: Accounting, Law, Maths & Economics', [
            'Principles and practice of accounting', 'Business laws (Contract, SOGA, Partnership)', 'Business mathematics and logical reasoning',
            'Statistics', 'Business economics and commercial knowledge',
        ], ['bcom_professional']],
        'international_trade_marketing' => ['International Trade, Export-Import & Marketing', [
            'Foreign trade policy and DGFT', 'Export documentation and Incoterms', 'Foreign exchange and letters of credit',
            'Logistics and customs clearance', 'Marketing mix and retail management', 'WTO and trade agreements',
        ], ['bcom_international']],
        'business_analytics_fintech' => ['Business Analytics & FinTech', [
            'Descriptive analytics and visualisation', 'Spreadsheet and BI tools', 'Payments, UPI and digital lending', 'Blockchain, crypto and regulation',
            'RegTech and data privacy', 'AI in accounting and audit',
        ], ['bcom_analytics']],
    ],

    // ═════════════════════════════ COMMERCE · M.COM ═════════════════════════════
    'mcom' => [
        'advanced_financial_accounting' => ['Advanced Financial Accounting', [
            'Group accounts and consolidation', 'Accounting standards and Ind AS', 'Liquidation and reconstruction', 'Human resource and social accounting',
            'Accounting for derivatives and leases',
        ]],
        'managerial_economics_mcom' => ['Managerial Economics', [
            'Demand estimation and forecasting', 'Cost theory and pricing decisions', 'Market structures and strategic behaviour',
            'Capital budgeting under uncertainty', 'Macroeconomic policy and business',
        ]],
        'corporate_finance' => ['Corporate Finance & Financial Markets', [
            'Capital structure theories', 'Dividend theories', 'Valuation of firms', 'Derivatives and risk management', 'Mergers and takeovers',
            'Indian financial system and SEBI',
        ]],
        'business_research_methods' => ['Business Research Methods', [
            'Research design', 'Sampling', 'Hypothesis testing: t, chi-square, ANOVA', 'Factor and regression analysis', 'Report writing',
        ]],
        'advanced_cost_management' => ['Advanced Cost & Management Accounting', [
            'Activity-based costing', 'Standard costing and variance analysis', 'Transfer pricing', 'Target costing and life-cycle costing',
            'Balanced scorecard and performance measurement',
        ]],
        'organisational_behaviour_strategy' => ['Organisational Behaviour & Strategic Management', [
            'Motivation and leadership', 'Organisational change and culture', 'Strategy formulation tools', 'Corporate governance',
        ]],
        // Specialisations
        'corporate_reporting_ind_as' => ['Corporate Reporting & Ind AS', [
            'Ind AS 1, 2, 7, 8, 16', 'Ind AS 103 Business Combinations', 'Ind AS 109 Financial Instruments', 'Ind AS 110 Consolidation',
            'Sustainability and BRSR reporting', 'IFRS convergence',
        ], ['mcom_accounting']],
        'tax_planning_gst' => ['Tax Planning, GST & International Taxation', [
            'Tax planning for individuals and companies', 'Corporate tax: MAT and set-off of losses', 'GST law and compliance',
            'International taxation, DTAA and BEPS', 'Transfer pricing', 'Tax assessments, appeals and ITAT',
        ], ['mcom_taxation']],
        'bank_management_risk' => ['Bank Management, Risk & Insurance', [
            'Bank asset-liability management', 'Basel norms', 'Credit appraisal and NPA resolution', 'Insurance underwriting and IRDAI',
            'Financial inclusion and payment systems', 'Foreign exchange operations',
        ], ['mcom_banking']],
    ],

    // ═════════════════════════════ COMMERCE · PROFESSIONAL COURSES ═════════════════════════════
    'comm_prof' => [
        'ca_accounting' => ['CA Foundation — Principles & Practice of Accounting', [
            'Theoretical framework and accounting process', 'Bank reconciliation and inventory valuation', 'Depreciation and bills of exchange',
            'Final accounts of sole proprietors', 'Partnership and company accounts',
        ], ['chartered_accountancy']],
        'ca_business_laws' => ['CA Foundation — Business Laws', [
            'Indian Contract Act, 1872', 'Sale of Goods Act, 1930', 'Indian Partnership Act, 1932', 'LLP Act, 2008', 'Companies Act, 2013 basics',
        ], ['chartered_accountancy']],
        'ca_maths_stats_reasoning' => ['CA Foundation — Business Mathematics, Logical Reasoning & Statistics', [
            'Ratio, proportion, indices and logarithms', 'Equations, sets and matrices', 'Time value of money and annuities', 'Logical reasoning: series, directions, coding',
            'Statistics: measures, correlation and probability',
        ], ['chartered_accountancy']],
        'ca_economics_commercial' => ['CA Foundation — Business Economics & Business and Commercial Knowledge', [
            'Demand, supply and elasticity', 'Theory of production and cost', 'Market forms and price determination', 'Business cycles and national income',
            'Business and commercial knowledge',
        ], ['chartered_accountancy']],
        'cs_company_law' => ['CS — Company Law & Governance', [
            'Companies Act, 2013: incorporation and capital', 'Directors, meetings and resolutions', 'Secretarial standards SS-1 and SS-2', 'Corporate governance and SEBI LODR',
            'Winding up and compliance management',
        ], ['company_secretary']],
        'cs_jurisprudence_law' => ['CS — Jurisprudence, Interpretation & General Laws', [
            'Sources of law and legal concepts', 'Interpretation of statutes', 'Constitution of India basics', 'Contract Act and SOGA',
            'Intellectual property and information technology law',
        ], ['company_secretary']],
        'cma_cost_accounting' => ['CMA — Cost & Management Accounting', [
            'Cost accounting standards (CAS)', 'Material, labour and overhead accounting', 'Process and joint-product costing', 'Marginal and standard costing',
            'Budgeting and performance measurement',
        ], ['cma']],
        'cma_law_ethics' => ['CMA — Fundamentals of Business Laws & Ethics', [
            'Contract and Sale of Goods Acts', 'Companies Act, 2013 basics', 'Professional ethics of ICMAI', 'Indirect taxes in brief',
        ], ['cma']],
        'global_certification_core' => ['ACCA · CPA · CFA — Financial Reporting, Ethics & Quantitative Methods', [
            'IFRS framework and financial statements', 'Ethics and professional standards', 'Time value of money and quantitative methods',
            'Audit and assurance basics', 'Portfolio management and derivatives', 'Corporate governance',
        ], ['global_finance']],
    ],

    // ═════════════════════════════ ARTS · LANGUAGES & LITERATURE ═════════════════════════════
    'lang_lit' => [
        'english_literature_british' => ['British Literature (Chaucer to Modern)', [
            'Chaucer to Milton', 'Restoration and Augustan literature', 'Romantic poetry', 'Victorian poetry and novel', 'Modernism and twentieth-century writing',
            'Shakespeare',
        ], ['english']],
        'english_literature_world' => ['American, Indian English & World Literature', [
            'American literature', 'Indian writing in English', 'Postcolonial and commonwealth literature', 'Literature in translation', 'Drama and the novel',
        ], ['english']],
        'literary_theory_criticism' => ['Literary Theory & Criticism', [
            'Classical criticism: Plato, Aristotle, Longinus', 'Neoclassical and romantic criticism', 'New Criticism and formalism',
            'Structuralism, post-structuralism and deconstruction', 'Marxist, feminist and postcolonial theory', 'Literary terms and devices',
        ], ['english']],
        'english_language_elt' => ['English Language, Grammar & ELT', [
            'Grammar and usage', 'Phonetics and the history of English', 'Vocabulary, idioms and figures of speech', 'Language teaching methods',
            'Comprehension and composition',
        ], ['english']],
        'hindi_sahitya' => ['Hindi Literature (हिन्दी साहित्य)', [
            'आदिकाल और भक्तिकाल', 'रीतिकाल', 'आधुनिक काल: भारतेन्दु और द्विवेदी युग', 'छायावाद और प्रगतिवाद', 'प्रयोगवाद, नई कविता और समकालीन साहित्य',
            'हिन्दी गद्य: उपन्यास, कहानी और निबंध',
        ], ['hindi']],
        'hindi_language_grammar' => ['Hindi Language, Grammar & Poetics (हिन्दी भाषा एवं व्याकरण)', [
            'हिन्दी भाषा का विकास', 'व्याकरण: संधि, समास, कारक', 'काव्यशास्त्र: रस, अलंकार, छंद', 'अनुवाद और पत्रकारिता', 'राजभाषा हिन्दी',
        ], ['hindi']],
        'sanskrit_literature' => ['Sanskrit Literature & Poetics', [
            'Vedic literature', 'Epics and Puranas', 'Classical poetry and drama: Kalidasa, Bhasa', 'Prose: Bana, Dandin', 'Poetics: rasa, alankara, dhvani', 'Niti and subhashita literature',
        ], ['sanskrit']],
        'sanskrit_grammar' => ['Sanskrit Grammar (Vyakarana)', [
            'Sandhi', 'Samasa and karaka', 'Dhatu and lakara', "Panini's Ashtadhyayi basics", 'Translation and composition',
        ], ['sanskrit']],
        'urdu_adab' => ['Urdu Literature (Adab)', [
            'Classical poetry: Mir, Ghalib, Zauq', 'Iqbal and progressive poetry', 'Urdu fiction: Premchand, Manto, Qurratulain Hyder', 'Prose, inshaiya and tanqeed', 'Prosody and rhetoric',
        ], ['urdu_persian']],
        'arabic_persian_studies' => ['Arabic & Persian Language and Literature', [
            'Arabic grammar and literature', 'Pre-Islamic and classical Arabic poetry', 'Persian poetry: Rumi, Hafez, Saadi', 'Persian in India: Amir Khusrau and Mughal literature', 'Islamic studies',
        ], ['urdu_persian']],
        'regional_literature' => ['Regional Literature (Bengali · Tamil · Marathi · Telugu · Kannada · Malayalam …)', [
            'Classical and Sangam-era literature', 'Bhakti and medieval literature', 'Modern novel and short story', 'Poetry and drama', 'Literary movements and awards',
        ], ['regional_lang']],
        'foreign_language_grammar' => ['Foreign Language Grammar & Culture (French · German · Spanish · Japanese)', [
            'Grammar and verb conjugation', 'Vocabulary and comprehension', 'Culture and civilisation', 'Listening and speaking', 'Proficiency frameworks: CEFR, DELF, Goethe, JLPT',
        ], ['foreign_lang']],
        'translation_interpretation' => ['Translation & Interpretation Studies', [
            'Translation theories', 'Equivalence and untranslatability', 'Literary and technical translation', 'Interpretation modes', 'Machine translation and localisation',
        ], ['foreign_lang']],
        'linguistics_core' => ['General & Applied Linguistics', [
            'Phonetics and phonology (IPA)', 'Morphology', 'Syntax', 'Semantics and pragmatics', 'Sociolinguistics and psycholinguistics', 'Historical and applied linguistics',
        ], ['linguistics']],
    ],

    // ═════════════════════════════ ARTS · HISTORY, HERITAGE & PHILOSOPHY ═════════════════════════════
    'history_phil' => [
        'ancient_india' => ['Ancient India', [
            'Prehistoric cultures and the Indus Valley civilisation', 'Vedic age and the Mahajanapadas', 'Mauryan and post-Mauryan period', 'Gupta period and early medieval kingdoms',
            'Sources: literature, inscriptions and archaeology',
        ], ['history']],
        'medieval_india' => ['Medieval India', [
            'Delhi Sultanate', 'Mughal empire and administration', 'Vijayanagara and the Marathas', 'Bhakti and Sufi movements', 'Economy, society and art',
        ], ['history']],
        'modern_india' => ['Modern India & the Freedom Struggle', [
            'Advent of Europeans and the British conquest', 'Revolt of 1857', 'Social and religious reform movements', 'Indian National Congress and the national movement', 'Partition and independence',
        ], ['history']],
        'world_history' => ['World History', [
            'Renaissance and Reformation', 'American and French revolutions', 'Industrial Revolution', 'World wars and the interwar years', 'Cold War and decolonisation',
        ], ['history']],
        'archaeology_ancient_culture' => ['Archaeology, Epigraphy & Ancient Culture', [
            'Archaeological methods and dating', 'Epigraphy and palaeography', 'Numismatics', 'Ancient Indian religions and philosophy', 'Protohistoric cultures',
        ], ['ahc']],
        'indian_art_architecture' => ['Indian Art, Architecture & Heritage', [
            'Indus, Mauryan and Gandhara art', 'Temple architecture: Nagara, Dravida, Vesara', 'Cave art and Buddhist sculpture', 'Indo-Islamic architecture', 'Museology and heritage conservation',
        ], ['ahc']],
        'indian_philosophy' => ['Indian Philosophy', [
            'Charvaka, Jainism and Buddhism', 'Nyaya and Vaisheshika', 'Samkhya and Yoga', 'Mimamsa', 'Vedanta: Advaita, Vishishtadvaita, Dvaita',
        ], ['philosophy']],
        'western_philosophy' => ['Western Philosophy', [
            'Pre-Socratics, Socrates, Plato and Aristotle', 'Rationalism: Descartes, Spinoza, Leibniz', 'Empiricism: Locke, Berkeley, Hume', 'Kant and German idealism',
            'Existentialism, phenomenology and analytic philosophy',
        ], ['philosophy']],
        'logic_ethics' => ['Logic, Ethics & Philosophy of Religion', [
            'Deductive logic and syllogism', 'Fallacies', 'Normative ethics: deontology, utilitarianism, virtue', 'Metaethics and applied ethics', 'Philosophy of religion',
        ], ['philosophy']],
    ],

    // ═════════════════════════════ ARTS · POLITICAL SCIENCE & PUBLIC ADMINISTRATION ═════════════════════════════
    'polsci_pa' => [
        'constitution_polity' => ['Indian Constitution & Polity', [
            'Preamble, fundamental rights and DPSPs', 'Union executive, Parliament and judiciary', 'Federalism and Centre-State relations', 'Amendments and emergency provisions',
            'Local self-government: 73rd and 74th Amendments', 'Constitutional bodies',
        ]],
        'political_theory' => ['Political Theory & Thought', [
            'State, sovereignty and liberty', 'Justice, equality and rights', 'Democracy and its critics', 'Ancient Greek and modern Western thinkers', 'Indian political thought: Kautilya to Ambedkar',
            'Marxism, liberalism and feminism',
        ], ['political_science']],
        'comparative_politics' => ['Comparative Politics & Electoral Systems', [
            'Comparative method and approaches', 'Constitutions of the UK, USA, France, Switzerland', 'Electoral systems and party systems', 'Political development and regime types',
        ], ['political_science']],
        'public_admin_theory' => ['Administrative Theory & Public Policy', [
            'Classical theories: Taylor, Fayol, Weber', 'Human relations and behavioural approach', 'New Public Management and good governance', 'Public policy cycle', 'Budget and financial administration',
        ], ['public_admin']],
        'indian_administration' => ['Indian Administration & Governance', [
            'Civil services and UPSC', 'Union and state administration', 'District and local administration', 'Accountability: CAG, Lokpal, RTI, CVC', 'E-governance',
        ], ['public_admin']],
        'international_relations_theory' => ['International Relations Theory & Organisations', [
            'Realism, liberalism and constructivism', 'Cold War and the post-Cold War order', 'UN and its organs', 'Regional organisations: EU, ASEAN, BRICS, SCO', 'Global issues: terrorism, climate, nuclear order',
        ], ['intl_relations']],
        'strategic_studies_foreign_policy' => ["Strategic Studies & India's Foreign Policy", [
            "Determinants of India's foreign policy", "India's neighbourhood and Act East", 'Non-alignment and strategic autonomy', 'Defence and national security', 'Diplomacy and international law',
        ], ['intl_relations']],
    ],

    // ═════════════════════════════ ARTS · ECONOMICS ═════════════════════════════
    'economics' => [
        'microeconomics' => ['Microeconomic Theory', [
            'Consumer theory and utility', 'Theory of the firm and cost', 'Market structures', 'Factor markets and welfare', 'General equilibrium and market failure',
        ]],
        'macroeconomics' => ['Macroeconomics', [
            'National income and growth', 'IS-LM and aggregate demand', 'Money, banking and inflation', 'Open-economy macroeconomics', 'Fiscal and monetary policy',
        ]],
        'indian_economy' => ['Indian Economy', [
            'Planning and economic reforms since 1991', 'Agriculture and industry', 'Poverty, inequality and employment', 'Public finance and GST', 'External sector and RBI',
        ]],
        'mathematical_statistical_methods' => ['Mathematical & Statistical Methods', [
            'Calculus and optimisation', 'Linear algebra', 'Probability and distributions', 'Sampling and inference', 'Index numbers and time series',
        ]],
        'econometrics_applied' => ['Econometrics & Applied Economics', [
            'Classical linear regression assumptions', 'Heteroscedasticity, autocorrelation and multicollinearity', 'Time series and stationarity', 'Panel data and instrumental variables',
            'Applied microeconomics and policy evaluation',
        ], ['applied_economics']],
        'development_public_economics' => ['Development, International & Public Economics', [
            'Theories of growth and development', 'Human development indicators', 'International trade theory and trade policy', 'Public goods and taxation', 'Environmental and agricultural economics',
        ], ['applied_economics']],
    ],

    // ═════════════════════════════ ARTS · PSYCHOLOGY ═════════════════════════════
    'psychology' => [
        'general_psychology' => ['General Psychology', [
            'Methods of psychology', 'Learning and conditioning', 'Memory and forgetting', 'Motivation and emotion', 'Intelligence and thinking', 'Sensation and perception',
        ]],
        'developmental_psychology' => ['Developmental Psychology', [
            "Piaget's cognitive development", "Erikson's psychosocial stages", "Vygotsky and Kohlberg", 'Attachment', 'Adolescence and adulthood', 'Ageing',
        ]],
        'social_psychology' => ['Social Psychology', [
            'Attitudes and persuasion', 'Social cognition and attribution', 'Conformity, obedience and groups', 'Prejudice and aggression', 'Prosocial behaviour',
        ]],
        'personality_psychology' => ['Personality Psychology', [
            'Psychoanalytic theories', 'Trait theories: Allport, Cattell, Big Five', 'Humanistic theories', 'Learning and social-cognitive theories', 'Assessment of personality',
        ]],
        'research_statistics_psychology' => ['Research Methods & Statistics in Psychology', [
            'Experimental and quasi-experimental design', 'Sampling, reliability and validity', 'Descriptive statistics', 'Inferential tests: t, ANOVA, chi-square', 'Psychometrics',
        ]],
        'abnormal_clinical_psychology' => ['Abnormal & Clinical Psychology', [
            'Classification: DSM-5 and ICD-11', 'Anxiety, mood and psychotic disorders', 'Neurodevelopmental and personality disorders', 'Clinical assessment', 'Mental Healthcare Act, 2017',
        ], ['clinical_psychology']],
        'counselling_psychotherapy' => ['Counselling & Psychotherapy', [
            'Psychodynamic and Rogerian approaches', 'CBT and REBT', 'Counselling skills and process', 'Ethics: RCI and confidentiality', 'Crisis, trauma and child counselling',
        ], ['clinical_psychology']],
        'io_psychology' => ['Industrial & Organisational Psychology', [
            'Selection, job analysis and testing', 'Training and performance appraisal', 'Motivation, job satisfaction and leadership', 'Organisational culture, stress and change', 'Engineering psychology and ergonomics',
        ], ['org_psychology']],
    ],

    // ═════════════════════════════ ARTS · SOCIOLOGY, ANTHROPOLOGY & SOCIAL WORK ═════════════════════════════
    'sociology_sw' => [
        'sociological_theory' => ['Sociological Theory & Thinkers', [
            'Founders: Comte, Spencer, Durkheim', 'Marx and Weber', 'Parsons and Merton: functionalism', 'Symbolic interactionism and ethnomethodology', 'Contemporary theory: Giddens, Bourdieu, Foucault',
        ]],
        'indian_society' => ['Indian Society & Social Institutions', [
            'Caste, class and tribe', 'Family, marriage and kinship', 'Social change: Sanskritisation, modernisation', 'Social movements', 'Indian sociologists: Srinivas, Ghurye, Dube',
        ]],
        'social_research_methods' => ['Social Research Methods', [
            'Research design and hypotheses', 'Survey, interview and participant observation', 'Sampling techniques', 'Qualitative and quantitative analysis', 'Research ethics',
        ]],
        'anthropology_core' => ['Anthropology: Biological & Socio-Cultural', [
            'Human evolution and primates', 'Prehistoric archaeology', 'Kinship, marriage and religion', 'Anthropological theories: Malinowski, Radcliffe-Brown, Boas', 'Tribes of India',
        ], ['anthropology']],
        'social_work_practice' => ['Social Work Practice & Methods', [
            'Casework, group work and community organisation', 'Social work values and ethics', 'Social welfare administration and action', 'Social legislation', 'Fields of practice: health, family, child',
        ], ['social_work']],
        'development_rural_studies' => ['Development & Rural Studies', [
            'Theories of development', 'Rural development programmes in India (MGNREGA, NRLM)', 'Panchayati Raj', 'NGOs, CSR and civil society', 'Human rights and disaster management',
        ], ['development_studies']],
    ],

    // ═════════════════════════════ ARTS · JOURNALISM, MASS COMMUNICATION & MEDIA ═════════════════════════════
    'media_comm' => [
        'communication_theory' => ['Communication Theory & Media Models', [
            'Models of communication', 'Media effects theories', 'Mass society and agenda setting', 'Development and participatory communication', 'Media history in India',
        ]],
        'media_laws_ethics' => ['Media Laws & Ethics', [
            'Article 19 and reasonable restrictions', 'Defamation, contempt and the IT Act', 'Press Council of India and codes of ethics', 'Copyright and the right to information', 'Broadcasting regulation',
        ]],
        'reporting_editing' => ['Reporting, Editing & Journalism Practice', [
            'News values and news sources', 'Inverted pyramid and news writing', 'Editing, headlines and layout', 'Beat reporting and investigative journalism', 'Digital journalism and fact-checking',
        ], ['journalism']],
        'film_tv_digital_production' => ['Film, Television & Digital Media Production', [
            'Camera shots, angles and movement', 'Editing: continuity and montage', 'Scriptwriting and storyboarding', 'Sound and lighting', 'Film history and OTT',
        ], ['film_media']],
        'advertising_pr_practice' => ['Advertising, PR & Brand Communication', [
            'Advertising appeals and AIDA', 'Media planning and research', 'Public relations tools and crisis communication', 'Branding and IMC', 'Digital advertising metrics',
        ], ['advertising_pr']],
    ],

    // ═════════════════════════════ ARTS · EDUCATION ═════════════════════════════
    'education' => [
        'educational_psychology_pedagogy' => ['Educational Psychology & Pedagogy', [
            'Theories of learning', 'Development and individual differences', 'Intelligence, creativity and motivation', 'Inclusive education and special needs', 'Guidance and counselling',
        ], ['bed_med']],
        'teaching_aptitude_curriculum' => ['Teaching Aptitude, Curriculum & Assessment', [
            'Teaching methods and learning resources', 'Curriculum development', 'Evaluation: CCE, rubrics and measurement', 'Research in education', 'ICT in education',
        ], ['bed_med']],
        'education_policy_india' => ['Education in India: Policies, NEP 2020 & Acts', [
            'Constitutional provisions and RTE Act, 2009', 'Commissions and committees', 'NEP 2020 structure and goals', 'Teacher education and NCTE', 'Higher education regulators',
        ], ['bed_med']],
        'elementary_ece_pedagogy' => ['Elementary & Early Childhood Pedagogy', [
            'Child development 0–8', 'Play-based and activity learning', 'Foundational literacy and numeracy', 'Environmental studies and language pedagogy', 'Assessment in the early years',
        ], ['elementary_ece']],
    ],

    // ═════════════════════════════ ARTS · GEOGRAPHY & ENVIRONMENTAL STUDIES ═════════════════════════════
    'geography_env' => [
        'physical_geography' => ['Physical Geography (Geomorphology & Climatology)', [
            'Earth structure, plate tectonics and rocks', 'Landforms and denudation', 'Atmosphere, winds and pressure belts', 'Climate classification (Köppen)', 'Oceanography',
        ], ['geography']],
        'human_economic_geography' => ['Human & Economic Geography', [
            'Population distribution and migration', 'Settlements and urbanisation', 'Agriculture and industrial location', 'Transport and trade', 'Regional development',
        ], ['geography']],
        'geography_of_india' => ['Geography of India & the World', [
            'Physiographic divisions of India', 'Drainage, climate and monsoon', 'Soils, natural vegetation and agriculture', 'Resources and industries of India', 'World regions',
        ], ['geography']],
        'geoinformatics_cartography' => ['Cartography, Remote Sensing & GIS', [
            'Map scales and projections', 'Survey and toposheets', 'Remote sensing principles', 'GIS data models and analysis', 'GPS and applications',
        ], ['geography']],
        'ecology_sustainability' => ['Ecology, Environment & Sustainability', [
            'Ecosystems and biodiversity', 'Pollution and waste management', 'Climate change and policy', 'Environmental laws in India', 'Sustainable development goals',
        ], ['environmental_studies']],
    ],

    // ═════════════════════════════ ARTS · FINE & PERFORMING ARTS ═════════════════════════════
    'fine_arts' => [
        'art_history' => ['Indian & Western Art History', [
            'Prehistoric to Mauryan art', 'Mughal, Rajput and Pahari painting', 'Company school and the Bengal School', 'Renaissance to Impressionism', 'Modern and contemporary art',
        ], ['fine_arts']],
        'art_theory_practice' => ['Elements of Art, Techniques & Media', [
            'Line, colour, form and composition', 'Drawing and painting media', 'Sculpture and printmaking techniques', 'Aesthetics and the six limbs (Shadanga)', 'Art criticism',
        ], ['fine_arts']],
        'music_theory' => ['Music Theory (Hindustani & Carnatic)', [
            'Swara, raga and tala', 'Hindustani and Carnatic systems', 'Musical instruments', 'Gharanas and composers', 'Western notation basics',
        ], ['performing_arts']],
        'dance_theatre' => ['Dance, Theatre & Performance Traditions', [
            'Classical dance forms of India', 'Natyashastra and abhinaya', 'Folk and tribal performance traditions', 'Modern theatre and street theatre', 'Stagecraft',
        ], ['performing_arts']],
    ],

    // ═════════════════════════════ ARTS · OTHER ═════════════════════════════
    'other_arts' => [
        'general_studies_arts' => ['General Studies for Arts Graduates', [
            'Indian history and culture', 'Polity and governance', 'Geography and environment', 'Economy and current affairs', 'Reasoning and comprehension',
        ], ['ba_general']],
        'library_information_science' => ['Library & Information Science', [
            'Five laws of library science', 'Classification: DDC and Colon', 'Cataloguing: AACR2 and RDA', 'Information sources and services', 'Library automation, digital libraries',
        ], ['library_science']],
        'physical_education_sports_science' => ['Physical Education & Sports Sciences', [
            'History and principles of physical education', 'Anatomy, physiology and kinesiology', 'Sports training and conditioning', 'Sports management and rules of major games', 'Yoga, health and nutrition',
        ], ['physical_education']],
        'nutrition_food_science' => ['Nutrition, Food Science & Human Development', [
            'Macronutrients and micronutrients', 'Dietetics and therapeutic nutrition', 'Food preservation and safety', 'Human development across the life span', 'Textiles and resource management',
        ], ['home_science']],
        'tourism_heritage_management' => ['Tourism, Travel & Heritage Management', [
            'Tourism concepts and types', 'Tourism products of India', 'Travel agency and tour operations', 'World heritage sites of India', 'Tourism policy, ecotourism and sustainability',
        ], ['tourism_travel']],
    ],

    // ═════════════════════════════ ENGINEERING · OTHER BRANCHES ═════════════════
    // The engineering branches outside CSE and the four core families: Chemical, Biotechnology, Aerospace, Agricultural, Mining / Metallurgy.
    // A shared core of fundamentals that every one of them studies, plus one specialisation each (only that branch is offered it).
    'other' => [
        'engineering_mathematics' => ['Engineering Mathematics', [
            'Calculus and limits', 'Linear algebra', 'Ordinary differential equations', 'Probability and statistics', 'Numerical methods',
        ]],
        'engineering_mechanics_materials' => ['Engineering Mechanics & Strength of Materials', [
            'Statics and equilibrium', 'Stress and strain', 'Bending and torsion', 'Properties of engineering materials', 'Theories of failure',
        ]],
        'thermo_fluids_basics' => ['Thermodynamics & Fluid Mechanics (fundamentals)', [
            'Laws of thermodynamics', 'Properties of fluids', 'Fluid statics and Bernoulli equation', 'Flow in pipes', 'Heat transfer basics',
        ]],
        'engineering_economics_safety' => ['Engineering Economics, Safety & Ethics', [
            'Engineering economics and depreciation', 'Safety, hazards and risk', 'Professional ethics', 'Quality and standards', 'Sustainability and environment',
        ]],
        'chemical_process_engineering' => ['Chemical Process Calculations & Reaction Engineering', [
            'Stoichiometry and process calculations', 'Material and energy balances', 'Chemical reaction engineering', 'Mass transfer operations', 'Heat exchangers and process control',
        ], ['chem']],
        'bioprocess_biochemistry' => ['Biochemistry, Molecular Biology & Bioprocess', [
            'Biomolecules and enzymes', 'Microbiology and cell biology', 'Genetic engineering and PCR', 'Bioprocess and fermentation', 'Immunology and bioinformatics',
        ], ['biotech']],
        'aerospace_flight' => ['Aerodynamics, Propulsion & Flight Mechanics', [
            'Aerodynamics and lift', 'Aircraft propulsion', 'Flight mechanics and stability', 'Aerospace structures', 'Orbital mechanics basics',
        ], ['aero']],
        'agricultural_soil_water' => ['Soil & Water Engineering, Farm Machinery', [
            'Soil physics and conservation', 'Irrigation and drainage', 'Farm power and machinery', 'Post-harvest technology', 'Renewable energy in agriculture',
        ], ['agri']],
        'mineral_metallurgy' => ['Mineral Processing & Physical Metallurgy', [
            'Mining methods and rock mechanics', 'Mineral processing and flotation', 'Extractive metallurgy', 'Physical metallurgy and phase diagrams', 'Heat treatment and characterisation',
        ], ['mining']],
    ],
];
