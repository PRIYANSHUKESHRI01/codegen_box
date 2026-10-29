<?php

/**
 * The rest of the Vault AI Interview catalog: every Mellow Vault domain that has no hand-written question bank yet.
 *
 * config/curated_interview_sets.php holds the 5 roles / 12 stacks whose questions are written out in full. This file adds
 * the other domains Mellow Vault hires for (Data Analytics, Cyber Security, QA, Embedded, Digital Marketing, ...) as
 * EMPTY shells: a role, its stacks, and for each stack the three rounds ("sets") a candidate is assessed on. App\Services\Vault\CuratedCatalog
 * expands every stack into the standard 3 series x 3 sets and merges in the questions staff add later (Admin -> Vault AI
 * questions, stored in curated_set_questions).
 *
 * A stack is OPEN to students only when every one of its 9 sets has at least `min_questions_per_set` questions. Until then
 * it is listed as "Coming soon" with its syllabus visible and a "Notify me" button, and nothing can be started.
 *
 * Adding a domain later = add a stack here (and, if needed, a role). Nothing else needs to change.
 *
 * Round structure follows how these roles are actually screened: fundamentals -> hands-on problem solving -> a realistic
 * scenario that tests judgement (SQL/Excel/case study for analysts; fundamentals/automation/API/scenario for QA;
 * fundamentals/incident response/web security for security; C/interrupts/RTOS/protocols for embedded; and so on).
 */

return [

    // A set needs this many questions before it counts as ready (the hand-written sets all have at least this many).
    'min_questions_per_set' => 5,

    'series' => [
        1 => ['title' => 'Series 1: Standard Placement & Core Foundations', 'blurb' => 'Initial assessment series on the fundamentals, hands-on skills and judgement expected of a fresher in {stack}.'],
        2 => ['title' => 'Series 2: Applied Depth & Scalable Solutions', 'blurb' => 'Second qualification series with distinct, deeper {stack} challenges than Series 1.'],
        3 => ['title' => 'Series 3: High-Bar Scenarios & Production Judgement', 'blurb' => 'Final qualification series: the hardest {stack} scenarios, trade-offs and failure cases.'],
    ],

    /*
     * The Mellow Vault domain labels each stack covers, for search and for the coverage check in the tests. Every label in
     * Mellow Vault's "Development & IT" list must appear exactly here, so a candidate from any of those domains finds a home.
     */
    'domains' => [
        'laravel' => ['Laravel Developer'],
        'php' => ['PHP Developer'],
        'cms' => ['CMS Developer', 'WordPress'],
        'api_design' => ['API', 'REST API'],
        'python' => ['Python Developer'],
        'web_fundamentals' => ['Web Developer', 'HTML CSS JavaScript'],
        'angular' => ['Angular Developer'],
        'ui_ux' => ['UI/UX Design', 'UI UX'],
        'mern' => ['MERN Developer'],
        'ecommerce' => ['E-Commerce', 'Ecommerce'],
        'machine_learning' => ['AI/ML', 'ML/DL', 'Machine Learning', 'AI ML'],
        'deeplearning_pytorch' => ['Deep Learning'],
        'nlp' => ['NLT(Natural Language Toolkit)', 'NLTK', 'Natural Language Processing (NLP)', 'NLP'],
        'robotics' => ['AI and Robotics', 'Robotics'],
        'docker_k8s' => ['Docker'],
        'cloud_computing' => ['Cloud Computing'],
        'cloud_infrastructure' => ['Cloud Infrastructure'],
        'data_analytics' => ['Data Analytics', 'Data Analyst'],
        'sql' => ['SQL Developer', 'SQL'],
        'power_bi' => ['Power BI'],
        'data_science' => ['Data Science', 'Data Scientist'],
        'data_mining' => ['Data Mining'],
        'data_engineering' => ['Data Engineering', 'Data Engineer'],
        'cyber_security' => ['Cyber Security', 'Cybersecurity'],
        'ethical_hacking' => ['Ethical Hacking', 'Penetration Testing'],
        'cryptography' => ['Cryptography'],
        'software_testing' => ['Software Testing', 'QA', 'Test Engineer'],
        'embedded_systems' => ['Embedded System', 'Embedded Systems'],
        'cpp' => ['C++ Developer', 'C++'],
        'game_development' => ['Games Developer', 'Game Development'],
        'blockchain' => ['BlockChain', 'Blockchain'],
        'quantum_computing' => ['Quantum Computing'],
        'digital_marketing' => ['Digital Marketing'],
        'seo' => ['SEO Specialist', 'SEO'],
    ],

    /*
     * Roles. A role that already exists in curated_interview_sets.php (backend, frontend, fullstack, ai_ml, devops) only lists
     * the NEW stacks to add to it; a new role carries its own title/blurb/icon/badge/colour.
     *
     * icon must be a name the student UI knows (CuratedSetsExplorer ICONS); colour is one of indigo, emerald, cyan, violet, amber, rose.
     */
    'roles' => [

        'backend' => [
            'stacks' => [
                'php' => [
                    'name' => 'PHP',
                    'blurb' => 'Core PHP 8 — types, OOP, sessions, PDO, Composer, security and framework-free web development.',
                    'icon' => 'Code2',
                    'tags' => ['php', 'composer', 'pdo', 'oop'],
                    'sets' => [
                        ['Language Core & OOP', 'Types and juggling, references, OOP, namespaces, autoloading and how a PHP request lives and dies.'],
                        ['Data, Sessions & Real Features', 'PDO and prepared statements, sessions and cookies, file handling, forms, Composer and error handling.'],
                        ['Security, Performance & Production', 'Injection and XSS defence, password hashing, OPcache, caching and debugging a failing production script.'],
                    ],
                ],
                'cms' => [
                    'name' => 'CMS Development (WordPress)',
                    'blurb' => 'WordPress themes and plugins, hooks, custom post types, the REST API, performance and site hardening.',
                    'icon' => 'Globe',
                    'tags' => ['wordpress', 'cms', 'themes', 'plugins', 'hooks'],
                    'sets' => [
                        ['CMS Fundamentals & Theming', 'How a CMS request is built, the template hierarchy, the loop, child themes and the block editor.'],
                        ['Plugins, Hooks & Custom Content', 'Actions and filters, custom post types and fields, shortcodes, WP_Query and the REST API.'],
                        ['Security, Speed & Maintenance', 'Hardening, sanitising and escaping, caching, database tuning, updates and fixing a hacked or slow site.'],
                    ],
                ],
                'api_design' => [
                    'name' => 'API Development',
                    'blurb' => 'REST design, status codes, authentication, versioning, pagination, rate limiting and API documentation.',
                    'icon' => 'Webhook',
                    'tags' => ['api', 'rest', 'http', 'openapi', 'authentication'],
                    'sets' => [
                        ['HTTP & REST Fundamentals', 'Methods, status codes, idempotency, resource modelling, headers, content negotiation and statelessness.'],
                        ['Designing & Securing an API', 'Authentication and authorisation, pagination, filtering, validation, versioning and error contracts.'],
                        ['Scale, Reliability & Contracts', 'Rate limiting, caching, retries and idempotency keys, webhooks, OpenAPI contracts and backwards compatibility.'],
                    ],
                ],
            ],
        ],

        'frontend' => [
            'stacks' => [
                'web_fundamentals' => [
                    'name' => 'Web Development (HTML, CSS, JavaScript)',
                    'blurb' => 'Semantic HTML, modern CSS layout, JavaScript fundamentals, the DOM, accessibility and browser basics.',
                    'icon' => 'Globe',
                    'tags' => ['html', 'css', 'javascript', 'dom', 'accessibility'],
                    'sets' => [
                        ['HTML, CSS & Layout', 'Semantics, the box model, flexbox and grid, responsive design, specificity and the cascade.'],
                        ['JavaScript & the DOM', 'Scope and closures, this, promises and async/await, events, fetch and DOM manipulation.'],
                        ['Performance, Accessibility & Browser Behaviour', 'Rendering path, Core Web Vitals, accessibility, security basics (XSS, CORS) and debugging in dev tools.'],
                    ],
                ],
                'angular' => [
                    'name' => 'Angular',
                    'blurb' => 'Components, dependency injection, RxJS, routing, forms, change detection and state management in Angular.',
                    'icon' => 'Layout',
                    'tags' => ['angular', 'rxjs', 'typescript', 'ngrx', 'components'],
                    'sets' => [
                        ['Components, Templates & DI', 'Component lifecycle, data binding, directives and pipes, modules/standalone, services and dependency injection.'],
                        ['RxJS, Forms & Routing', 'Observables and operators, reactive vs template forms, routing and guards, HttpClient and interceptors.'],
                        ['Performance & Architecture', 'Change detection and OnPush, lazy loading, signals and state management, testing and large-app structure.'],
                    ],
                ],
                'ui_ux' => [
                    'name' => 'UI/UX Design',
                    'blurb' => 'User research, information architecture, interaction and visual design, design systems and usability testing.',
                    'icon' => 'Palette',
                    'tags' => ['ui', 'ux', 'figma', 'design-systems', 'usability'],
                    'sets' => [
                        ['Design Fundamentals & Process', 'The UX process, research methods, personas and journeys, hierarchy, typography, colour and layout.'],
                        ['Interaction, Prototyping & Accessibility', 'Flows and wireframes, interaction patterns, prototyping in Figma, accessibility and responsive behaviour.'],
                        ['Critique, Systems & Impact', 'Design critique of a real screen, design systems and handoff, usability testing and measuring design impact.'],
                    ],
                ],
            ],
        ],

        'fullstack' => [
            'stacks' => [
                'ecommerce' => [
                    'name' => 'E-Commerce Development',
                    'blurb' => 'Catalogue and cart design, checkout and payments, inventory, orders, search, and e-commerce platforms.',
                    'icon' => 'ShoppingCart',
                    'tags' => ['ecommerce', 'checkout', 'payments', 'inventory', 'shopify'],
                    'sets' => [
                        ['Commerce Fundamentals & Data Model', 'Products and variants, cart and pricing rules, taxes and discounts, orders and the commerce data model.'],
                        ['Checkout, Payments & Fulfilment', 'Checkout flow, payment gateways and webhooks, inventory and stock races, shipping and returns.'],
                        ['Scale, Fraud & Conversion', 'Peak-traffic design, search and recommendations, fraud and chargebacks, analytics and conversion optimisation.'],
                    ],
                ],
            ],
        ],

        'ai_ml' => [
            'stacks' => [
                'machine_learning' => [
                    'name' => 'Machine Learning (AI/ML, ML/DL)',
                    'blurb' => 'Supervised and unsupervised learning, feature engineering, model evaluation, and shipping ML to production.',
                    'icon' => 'Brain',
                    'tags' => ['machine-learning', 'scikit-learn', 'feature-engineering', 'evaluation', 'mlops'],
                    'sets' => [
                        ['ML Foundations & Evaluation', 'Bias-variance, regression and classification, regularisation, metrics, cross-validation and data leakage.'],
                        ['Modelling & Feature Engineering', 'Tree ensembles, SVMs, clustering and PCA, feature engineering, imbalance and hyper-parameter tuning.'],
                        ['Production ML & Judgement', 'Deployment, drift and monitoring, interpretability, fairness, and choosing a model for a business problem.'],
                    ],
                ],
                'nlp' => [
                    'name' => 'Natural Language Processing (NLP / NLTK)',
                    'blurb' => 'Text preprocessing, NLTK and spaCy, embeddings, transformers, and evaluating language systems.',
                    'icon' => 'Languages',
                    'tags' => ['nlp', 'nltk', 'spacy', 'transformers', 'embeddings'],
                    'sets' => [
                        ['Text Processing & Classical NLP', 'Tokenisation, stemming and lemmatisation, TF-IDF, n-grams, POS tagging and classical classifiers (NLTK / spaCy).'],
                        ['Embeddings, Sequence Models & Transformers', 'Word and sentence embeddings, RNN/LSTM limits, attention and transformers, fine-tuning for a task.'],
                        ['Evaluation & Real-World NLP', 'Metrics (BLEU, ROUGE, F1), bias and multilingual text, noisy data, and designing a text-classification system.'],
                    ],
                ],
                'robotics' => [
                    'name' => 'AI & Robotics',
                    'blurb' => 'Kinematics, sensors and perception, ROS, path planning and control, and learning for robots.',
                    'icon' => 'Bot',
                    'tags' => ['robotics', 'ros', 'sensors', 'path-planning', 'control'],
                    'sets' => [
                        ['Robotics Fundamentals', 'Coordinate frames and kinematics, actuators and sensors, PID control and basic perception.'],
                        ['ROS, Planning & Perception', 'ROS nodes and topics, SLAM and localisation, path planning (A*, RRT), computer vision for robots.'],
                        ['Autonomy, Safety & Systems', 'Sensor fusion, reinforcement learning for control, real-time constraints, safety and a full autonomy design.'],
                    ],
                ],
            ],
        ],

        'devops' => [
            'stacks' => [
                'cloud_computing' => [
                    'name' => 'Cloud Computing (AWS / Azure / GCP)',
                    'blurb' => 'Core cloud services, compute, storage and networking, IAM, serverless, cost and the shared-responsibility model.',
                    'icon' => 'Cloud',
                    'tags' => ['cloud', 'aws', 'azure', 'gcp', 'serverless', 'iam'],
                    'sets' => [
                        ['Cloud Fundamentals', 'IaaS/PaaS/SaaS, regions and zones, compute, storage and database services, and the shared-responsibility model.'],
                        ['Networking, Security & Serverless', 'VPCs and subnets, load balancers, IAM and least privilege, serverless and managed services.'],
                        ['Architecture, Cost & Reliability', 'Highly-available and cost-aware design, scaling, disaster recovery, monitoring and migration trade-offs.'],
                    ],
                ],
                'cloud_infrastructure' => [
                    'name' => 'Cloud Infrastructure & IaC',
                    'blurb' => 'Infrastructure as code, Terraform, networking, Linux, CI/CD pipelines, observability and platform reliability.',
                    'icon' => 'Server',
                    'tags' => ['infrastructure', 'terraform', 'iac', 'linux', 'ci-cd', 'sre'],
                    'sets' => [
                        ['Linux, Networking & IaC Basics', 'Linux administration, DNS/TCP/TLS, IaC principles, Terraform state, modules and plans.'],
                        ['Pipelines, Config & Observability', 'CI/CD design, configuration management, secrets, logging, metrics and tracing.'],
                        ['Reliability & Incident Handling', 'SLOs and error budgets, zero-downtime deploys, capacity, chaos and post-incident reviews.'],
                    ],
                ],
            ],
        ],

        'data_analyst' => [
            'key' => 'data_analyst',
            'title' => 'Data Analyst',
            'blurb' => 'SQL, spreadsheets, statistics, dashboards and turning messy data into decisions.',
            'icon' => 'BarChart3',
            'badge' => 'In Demand',
            'color' => 'cyan',
            'stacks' => [
                'data_analytics' => [
                    'name' => 'Data Analytics',
                    'blurb' => 'Data cleaning, Excel, statistics, visualisation, metrics and case-study thinking.',
                    'icon' => 'BarChart3',
                    'tags' => ['data-analytics', 'excel', 'statistics', 'visualisation', 'case-study'],
                    'sets' => [
                        ['Analytics Foundations & Excel', 'Types of analysis, data cleaning, Excel lookups, pivots and formulas, descriptive statistics.'],
                        ['Statistics, SQL & Visualisation', 'Hypothesis testing and regression, correlation vs causation, SQL for analysis, choosing the right chart.'],
                        ['Case Study & Business Judgement', 'Define the metric, diagnose a drop, design an A/B test, handle outliers and missing data, tell the story.'],
                    ],
                ],
                'sql' => [
                    'name' => 'SQL',
                    'blurb' => 'Joins, aggregation, window functions, CTEs, indexing, query tuning and database design.',
                    'icon' => 'Database',
                    'tags' => ['sql', 'joins', 'window-functions', 'indexing', 'normalisation'],
                    'sets' => [
                        ['Querying Fundamentals', 'SELECT, joins, GROUP BY and HAVING, NULL semantics, subqueries, set operations and keys.'],
                        ['Advanced Querying & Modelling', 'Window functions, CTEs and recursion, normalisation, transactions and isolation, constraints.'],
                        ['Performance & Real Data Problems', 'Indexes and execution plans, slow-query diagnosis, deduplication and gaps-and-islands, schema design trade-offs.'],
                    ],
                ],
                'power_bi' => [
                    'name' => 'Power BI',
                    'blurb' => 'Power Query, data modelling, DAX measures, report design, refresh and governance.',
                    'icon' => 'LineChart',
                    'tags' => ['power-bi', 'dax', 'power-query', 'data-modelling', 'dashboards'],
                    'sets' => [
                        ['Power BI Fundamentals & Power Query', 'Desktop vs Service, connecting and shaping data in Power Query, relationships and the star schema.'],
                        ['DAX & Report Design', 'Measures vs calculated columns, filter context, CALCULATE and time intelligence, visuals and interactivity.'],
                        ['Performance, Security & Delivery', 'Import vs DirectQuery, row-level security, refresh and gateways, optimisation and sharing a governed dashboard.'],
                    ],
                ],
            ],
        ],

        'data_science' => [
            'key' => 'data_science',
            'title' => 'Data Science & Engineering',
            'blurb' => 'Statistical modelling, mining insight from data, and building the pipelines that feed it.',
            'icon' => 'FlaskConical',
            'badge' => 'High Growth',
            'color' => 'violet',
            'stacks' => [
                'data_science' => [
                    'name' => 'Data Science',
                    'blurb' => 'Python for data, statistics and probability, modelling, experimentation and communicating results.',
                    'icon' => 'FlaskConical',
                    'tags' => ['data-science', 'python', 'pandas', 'statistics', 'experimentation'],
                    'sets' => [
                        ['Python, Statistics & Probability', 'pandas and NumPy, distributions, sampling, confidence intervals, hypothesis tests and Bayes.'],
                        ['Modelling & Experimentation', 'EDA, feature work, regression and classification, A/B testing, model selection and validation.'],
                        ['End-to-End Projects & Communication', 'Framing a problem, choosing metrics, pitfalls (leakage, Simpson), productionising and presenting to stakeholders.'],
                    ],
                ],
                'data_mining' => [
                    'name' => 'Data Mining',
                    'blurb' => 'Pattern discovery: association rules, clustering, classification, anomaly detection and big-data techniques.',
                    'icon' => 'Pickaxe',
                    'tags' => ['data-mining', 'clustering', 'association-rules', 'anomaly-detection', 'kdd'],
                    'sets' => [
                        ['Mining Process & Preprocessing', 'The KDD process, data quality, sampling, discretisation, dimensionality reduction and similarity measures.'],
                        ['Patterns, Clusters & Classifiers', 'Apriori and FP-growth, k-means and DBSCAN, decision trees, naive Bayes and evaluating mined patterns.'],
                        ['Scale, Anomalies & Applications', 'Anomaly and fraud detection, streaming and big-data mining, privacy and ethics, and applying mining to a business case.'],
                    ],
                ],
                'data_engineering' => [
                    'name' => 'Data Engineering',
                    'blurb' => 'Pipelines, ETL/ELT, warehousing, Spark and streaming, orchestration and data quality.',
                    'icon' => 'Workflow',
                    'tags' => ['data-engineering', 'etl', 'spark', 'airflow', 'warehouse', 'kafka'],
                    'sets' => [
                        ['Pipelines & Warehousing Basics', 'ETL vs ELT, batch vs stream, dimensional modelling, partitioning and file formats.'],
                        ['Spark, Orchestration & Streaming', 'Spark execution and shuffles, Airflow DAGs, Kafka and stream processing, incremental loads.'],
                        ['Quality, Reliability & Scale', 'Data quality and lineage, idempotent and backfillable pipelines, cost and performance, handling a broken pipeline.'],
                    ],
                ],
            ],
        ],

        'cyber_security' => [
            'key' => 'cyber_security',
            'title' => 'Cyber Security',
            'blurb' => 'Defending systems and finding their weaknesses: security fundamentals, offensive testing and cryptography.',
            'icon' => 'ShieldCheck',
            'badge' => 'Critical Skill',
            'color' => 'rose',
            'stacks' => [
                'cyber_security' => [
                    'name' => 'Cyber Security',
                    'blurb' => 'Security fundamentals, networks, web security (OWASP), SIEM, incident response and risk.',
                    'icon' => 'ShieldCheck',
                    'tags' => ['cyber-security', 'owasp', 'siem', 'incident-response', 'networking'],
                    'sets' => [
                        ['Security Fundamentals & Networks', 'CIA triad, threats vs vulnerabilities vs risks, TCP/IP, DNS and TLS, firewalls, IAM and the attack lifecycle.'],
                        ['Web Security, Detection & Tooling', 'OWASP Top 10, authentication attacks, logging and SIEM, vulnerability management and endpoint security.'],
                        ['Incident Response & Risk', 'Triage and contain a phishing or ransomware scenario, forensics basics, risk assessment, compliance and lessons learned.'],
                    ],
                ],
                'ethical_hacking' => [
                    'name' => 'Ethical Hacking',
                    'blurb' => 'Reconnaissance, scanning, exploitation, web and network attacks, post-exploitation and reporting.',
                    'icon' => 'Bug',
                    'tags' => ['ethical-hacking', 'penetration-testing', 'kali', 'metasploit', 'recon'],
                    'sets' => [
                        ['Hacking Methodology & Recon', 'Phases of a pentest, legal scope and rules of engagement, OSINT, scanning and enumeration.'],
                        ['Exploitation: Web & Network', 'SQLi, XSS and auth bypass, network and service exploits, password attacks and privilege escalation.'],
                        ['Post-Exploitation & Reporting', 'Pivoting and persistence, evading detection, writing a findings report with risk ratings and remediation.'],
                    ],
                ],
                'cryptography' => [
                    'name' => 'Cryptography',
                    'blurb' => 'Symmetric and asymmetric crypto, hashing, signatures, TLS/PKI and the mistakes that break real systems.',
                    'icon' => 'KeyRound',
                    'tags' => ['cryptography', 'encryption', 'hashing', 'pki', 'tls'],
                    'sets' => [
                        ['Crypto Primitives', 'Symmetric vs asymmetric, block and stream ciphers, modes of operation, hashes, MACs and randomness.'],
                        ['Protocols, Signatures & PKI', 'RSA, ECC and Diffie-Hellman, digital signatures, certificates and TLS handshakes, key management.'],
                        ['Attacks & Applied Crypto', 'Padding-oracle and timing attacks, password storage, common implementation mistakes, post-quantum readiness.'],
                    ],
                ],
            ],
        ],

        'qa_testing' => [
            'key' => 'qa_testing',
            'title' => 'Software Testing',
            'blurb' => 'Test design, automation, API testing and quality strategy.',
            'icon' => 'Bug',
            'badge' => 'Entry Friendly',
            'color' => 'emerald',
            'stacks' => [
                'software_testing' => [
                    'name' => 'Software Testing (QA)',
                    'blurb' => 'Manual testing, test design techniques, Selenium automation, API testing and test strategy.',
                    'icon' => 'Bug',
                    'tags' => ['testing', 'qa', 'selenium', 'api-testing', 'test-design'],
                    'sets' => [
                        ['Testing Fundamentals & Test Design', 'SDLC/STLC, test types, equivalence and boundary analysis, test cases, the bug lifecycle and severity vs priority.'],
                        ['Automation & API Testing', 'Selenium and waits, Page Object Model, framework design, Postman and REST assertions, SQL for testers, CI integration.'],
                        ['Strategy, Scenarios & Quality Judgement', 'Risk-based test strategy, testing a real feature end to end, flaky tests, release go/no-go and defect triage.'],
                    ],
                ],
            ],
        ],

        'embedded_systems' => [
            'key' => 'embedded_systems',
            'title' => 'Embedded & Systems',
            'blurb' => 'Firmware and systems programming close to the hardware: C/C++, interrupts, RTOS and communication protocols.',
            'icon' => 'CircuitBoard',
            'badge' => 'Hardware + Code',
            'color' => 'amber',
            'stacks' => [
                'embedded_systems' => [
                    'name' => 'Embedded Systems',
                    'blurb' => 'Embedded C, microcontrollers, interrupts and timers, RTOS, UART/SPI/I2C and debugging firmware.',
                    'icon' => 'CircuitBoard',
                    'tags' => ['embedded', 'firmware', 'rtos', 'interrupts', 'uart', 'spi', 'i2c'],
                    'sets' => [
                        ['Embedded C & Microcontroller Basics', 'volatile/static/const, bit manipulation, memory map, GPIO, timers, ADC/DAC and the boot sequence.'],
                        ['Interrupts, Protocols & RTOS', 'ISRs and latency, UART vs SPI vs I2C, tasks, semaphores and mutexes, priority inversion and scheduling.'],
                        ['Reliability & Debugging', 'Watchdogs, low-power design, memory corruption and stack overflow, bootloaders, debugging with a scope and JTAG.'],
                    ],
                ],
                'cpp' => [
                    'name' => 'C++',
                    'blurb' => 'Modern C++: RAII, the STL, templates, memory and concurrency, and writing safe, fast code.',
                    'icon' => 'Terminal',
                    'tags' => ['cpp', 'stl', 'raii', 'templates', 'memory', 'concurrency'],
                    'sets' => [
                        ['Language Core & Memory', 'Pointers vs references, RAII and smart pointers, the rule of five, copy vs move and undefined behaviour.'],
                        ['STL, Templates & OOP', 'Containers and iterators, algorithms and lambdas, templates and concepts, virtual dispatch and object layout.'],
                        ['Concurrency, Performance & Design', 'Threads, mutexes and atomics, memory model, cache effects, exception safety and designing a safe API.'],
                    ],
                ],
            ],
        ],

        'game_dev' => [
            'key' => 'game_dev',
            'title' => 'Game Development',
            'blurb' => 'Game loops, engines, physics, graphics and performance.',
            'icon' => 'Gamepad2',
            'badge' => 'Creative Tech',
            'color' => 'violet',
            'stacks' => [
                'game_development' => [
                    'name' => 'Game Development',
                    'blurb' => 'The game loop, Unity/Unreal workflows, physics and maths, rendering basics, AI and optimisation.',
                    'icon' => 'Gamepad2',
                    'tags' => ['game-development', 'unity', 'unreal', 'physics', 'rendering'],
                    'sets' => [
                        ['Game Loop, Engines & Maths', 'The update/render loop, delta time, scenes and entities, vectors and matrices, input and collision basics.'],
                        ['Gameplay, Physics & Graphics', 'Character control, physics and colliders, animation state machines, shaders and the rendering pipeline, game AI.'],
                        ['Performance, Netcode & Production', 'Profiling and pooling, memory and draw calls, multiplayer sync and lag, build pipelines and shipping a game.'],
                    ],
                ],
            ],
        ],

        'emerging_tech' => [
            'key' => 'emerging_tech',
            'title' => 'Blockchain & Quantum',
            'blurb' => 'Emerging technology: distributed ledgers, smart contracts and quantum computing.',
            'icon' => 'Boxes',
            'badge' => 'Emerging Tech',
            'color' => 'amber',
            'stacks' => [
                'blockchain' => [
                    'name' => 'Blockchain',
                    'blurb' => 'Ledgers and consensus, Ethereum and smart contracts, Solidity, wallets, DeFi and contract security.',
                    'icon' => 'Boxes',
                    'tags' => ['blockchain', 'ethereum', 'solidity', 'smart-contracts', 'consensus', 'defi'],
                    'sets' => [
                        ['Blockchain Fundamentals', 'Hashing and blocks, consensus (PoW/PoS), transactions and wallets, public vs private chains, the EVM.'],
                        ['Smart Contracts & dApps', 'Solidity data and functions, gas, events, ERC-20/721, testing with Hardhat/Foundry and wiring a dApp frontend.'],
                        ['Security & Design Trade-offs', 'Reentrancy and overflow, oracle and front-running risks, upgradeability, scaling layers and when not to use a blockchain.'],
                    ],
                ],
                'quantum_computing' => [
                    'name' => 'Quantum Computing',
                    'blurb' => 'Qubits, gates and circuits, entanglement, core algorithms, noise and quantum programming.',
                    'icon' => 'Atom',
                    'tags' => ['quantum', 'qubits', 'qiskit', 'quantum-gates', 'algorithms'],
                    'sets' => [
                        ['Qubits, Gates & Circuits', 'Superposition, measurement, single- and two-qubit gates, the Bloch sphere and entanglement.'],
                        ['Algorithms & Programming', 'Deutsch-Jozsa, Grover and Shor, the quantum Fourier transform, building circuits in Qiskit.'],
                        ['Noise, Limits & Applications', 'Decoherence and error correction, NISQ devices, complexity classes and realistic use cases.'],
                    ],
                ],
            ],
        ],

        'digital_marketing' => [
            'key' => 'digital_marketing',
            'title' => 'Digital Marketing & SEO',
            'blurb' => 'Reaching and measuring audiences: channels, funnels, analytics and search.',
            'icon' => 'Megaphone',
            'badge' => 'Growth',
            'color' => 'rose',
            'stacks' => [
                'digital_marketing' => [
                    'name' => 'Digital Marketing',
                    'blurb' => 'Channels and funnels, paid and social media, email, analytics, attribution and campaign optimisation.',
                    'icon' => 'Megaphone',
                    'tags' => ['digital-marketing', 'funnel', 'ads', 'analytics', 'attribution', 'email'],
                    'sets' => [
                        ['Marketing Fundamentals & Channels', 'The funnel, channels and their roles, audience and positioning, content and email, core KPIs (CAC, ROAS, LTV).'],
                        ['Campaigns, Paid Media & Analytics', 'Setting up and optimising search and social campaigns, A/B testing, GA4 events, UTM tracking and reporting.'],
                        ['Strategy, Attribution & Budget', 'Allocating budget across channels, attribution limits, diagnosing a falling funnel and presenting a growth plan.'],
                    ],
                ],
                'seo' => [
                    'name' => 'SEO',
                    'blurb' => 'Technical SEO, on-page and content, link building, Core Web Vitals, analytics and audits.',
                    'icon' => 'Search',
                    'tags' => ['seo', 'technical-seo', 'keywords', 'core-web-vitals', 'link-building'],
                    'sets' => [
                        ['SEO Fundamentals & On-Page', 'How search works, search intent and keyword research, on-page elements, content quality and E-E-A-T.'],
                        ['Technical SEO & Tools', 'Crawlability and indexation, sitemaps and robots, redirects and canonicals, Core Web Vitals, structured data, Search Console.'],
                        ['Audits, Authority & Reporting', 'Running a site audit, link building and authority, diagnosing a traffic drop, measuring SEO impact and reporting.'],
                    ],
                ],
            ],
        ],
    ],
];
