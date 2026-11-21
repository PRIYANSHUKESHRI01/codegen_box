import os
import sys

sys.path.append(os.path.dirname(__file__))
from vault_helper import write_php_file
from question_generator_core import make_q, build_set_rounds, generate_domain_parent_sets

OUT_DIR = os.path.join(os.path.dirname(__file__), 'mock_questions_parent_sets')
os.makedirs(OUT_DIR, exist_ok=True)

sys_data = {}

# 1. CYBER SECURITY
sys_data['cyber_security'] = generate_domain_parent_sets(
    'cyber_security', 'Cyber Security & Information Security',
    [
        ('CIA Triad (Confidentiality, Integrity, Availability) & Defense in Depth', 'Confidentiality (encryption, access controls), Integrity (hashing, digital signatures), Availability (redundancy, DDoS mitigation). Defense in depth applies multiple layered security controls across perimeter, network, endpoint, application, and data layers.'),
        ('Zero Trust Architecture & Principle of Least Privilege', 'Never trust, always verify. Continuously authenticate and authorize every user and device regardless of location (internal or external network). Strict least privilege access using RBAC/ABAC.'),
        ('Security Information & Event Management (SIEM) and SOC Operations', 'Centralized log aggregation (Splunk, Elastic SIEM), correlation rules, automated anomaly alerting, threat hunting, and incident response playbooks for Security Operations Centers (SOC).'),
        ('Identity & Access Management (IAM), MFA, and SSO (SAML/OIDC)', 'Multi-Factor Authentication (something you know, have, are). Single Sign-On using SAML 2.0 or OpenID Connect with JWT claims and identity federation.'),
        ('Vulnerability Assessment vs Penetration Testing (VAPT)', 'Vulnerability assessments use automated tools (Nessus, Qualys) to identify unpatched flaws. Penetration testing simulates real-world adversary attacks to exploit vulnerabilities and demonstrate business impact.'),
    ],
    [('Cloud Security Posture Management (CSPM) & AWS GuardDuty', 'Continuously monitor cloud accounts for misconfigurations (open S3 buckets, exposed ports) and anomalous behaviors using AI threat detection.') for _ in range(5)],
    [('Incident Response Lifecycle (NIST SP 800-61)', 'Preparation, Detection & Analysis, Containment, Eradication, Recovery, and Post-Incident Lessons Learned.') for _ in range(20)],
    [('Application Security (AppSec) & DevSecOps Pipeline Integration', 'Integrating SAST (Static Analysis), DAST (Dynamic Analysis), and SCA (Software Composition Analysis) directly into CI/CD build gates.') for _ in range(15)],
    [('Enterprise Security Governance (SOC 2, ISO 27001, GDPR)', 'Establishing security policies, audit trails, risk registries, and disaster recovery testing to pass external compliance audits.') for _ in range(15)]
)

# 2. ETHICAL HACKING
sys_data['ethical_hacking'] = generate_domain_parent_sets(
    'ethical_hacking', 'Ethical Hacking & Penetration Testing',
    [
        ('Penetration Testing Phases: Reconnaissance, Scanning, Exploitation, Post-Exploitation, Reporting', 'Recon (OSINT, whois, DNS). Scanning (Nmap port scanning, vulnerability scanners). Exploitation (Metasploit, manual exploits). Post-exploitation (privilege escalation, pivoting). Reporting with CVSS scores.'),
        ('OWASP Top 10 Web Application Vulnerabilities', 'Broken Access Control, Cryptographic Failures, Injection (SQLi, NoSQLi, Command), Insecure Design, Security Misconfiguration, Vulnerable Components, Auth Failures, Software/Data Integrity Failures, Security Logging Failures, SSRF.'),
        ('Network Reconnaissance with Nmap (TCP SYN vs Connect vs UDP Scans)', 'SYN scan (-sS) performs half-open scan without completing 3-way handshake (stealthier, faster). Connect scan (-sT) completes handshake. UDP scan (-sU) checks open UDP services by testing ICMP port unreachable responses.'),
        ('Privilege Escalation Techniques (Linux & Windows)', 'Linux: SUID binaries, misconfigured sudoers, kernel exploits, cron job hijacking. Windows: token impersonation (Potato exploits), unquoted service paths, DLL hijacking, AlwaysInstallElevated registry keys.'),
        ('Cross-Site Scripting (XSS): Stored vs Reflected vs DOM-based', 'Stored XSS permanently saves malicious script in database. Reflected XSS reflects script off immediate URL request parameters. DOM-based XSS executes entirely in client browser via sinks (eval, innerHTML) without server roundtrip.'),
    ],
    [('Web Exploitation: SQL Injection (Union, Error, Blind Time-based)', 'Union-based injects results into response. Error-based forces database error messages. Blind time-based uses SLEEP() or pg_sleep() to infer data byte-by-byte.') for _ in range(5)],
    [('Bypassing Web Application Firewalls (WAF) & Input Filters', 'Obfuscation techniques: URL encoding, Unicode normalization, hex encoding, chunked transfer encoding, and SQL comment splitting (UN/**/ION).') for _ in range(20)],
    [('Wireless Penetration Testing (WPA2/WPA3 Handshake Cracking)', 'Capturing 4-way EAPOL handshakes via deauthentication attacks. Offline dictionary cracking using Hashcat/Aircrack-ng; WPA3 Dragonfly handshake resilience.') for _ in range(15)],
    [('Red Team Operations & Active Directory Exploitation', 'Kerberoasting, AS-REP roasting, Pass-the-Hash, BloodHound path discovery, and Golden Ticket creation for domain persistence.') for _ in range(15)]
)

# 3. CRYPTOGRAPHY
sys_data['cryptography'] = generate_domain_parent_sets(
    'cryptography', 'Applied Cryptography & Data Protection',
    [
        ('Symmetric vs Asymmetric Encryption (AES vs RSA/ECC)', 'Symmetric uses identical secret key for encryption and decryption (AES-256). Asymmetric uses keypairs: public key encrypts, private key decrypts (RSA, Elliptic Curve Cryptography). Symmetric is 1000x faster and used for bulk payload data.'),
        ('Block Cipher Modes: CBC vs GCM (Authenticated Encryption)', 'CBC requires initialization vectors and separate MAC (Encrypt-then-MAC). AES-GCM (Galois/Counter Mode) provides Authenticated Encryption with Associated Data (AEAD), guaranteeing both confidentiality and tamper-proof integrity.'),
        ('Cryptographic Hash Functions: SHA-256, SHA-3, and Collision Resistance', 'One-way mathematical functions mapping arbitrary data to fixed-length output. Pre-image resistance (hard to find input from hash), second pre-image resistance, and collision resistance (hard to find two distinct inputs with same hash).'),
        ('Diffie-Hellman Key Exchange & Elliptic Curve Diffie-Hellman (ECDH)', 'Enables two parties to establish a shared secret over an insecure channel without transmitting the secret itself. ECDH uses elliptic curve discrete logarithm problem for smaller keys with equivalent security (256-bit ECC ~= 3072-bit RSA).'),
        ('Public Key Infrastructure (PKI), X.509 Certificates, and Certificate Authorities (CAs)', 'CAs issue and sign digital certificates binding a public key to an identity (domain name). Browsers verify the signature chain back to built-in trusted Root CAs. Certificate Revocation Lists (CRL) and OCSP stapling verify revocation.'),
    ],
    [('TLS 1.3 Handshake Protocol & Forward Secrecy', 'TLS 1.3 reduces handshake to 1-RTT. Mandates ephemeral Diffie-Hellman (DHE/ECDHE), guaranteeing Perfect Forward Secrecy (PFS): compromising server private key does not decrypt past recorded sessions.') for _ in range(5)],
    [('Digital Signatures: RSA-PSS vs Ed25519', 'Digital signatures provide authentication and non-repudiation. Ed25519 (EdDSA on Curve25519) provides ultra-fast signature generation and verification with high immunity to side-channel attacks.') for _ in range(20)],
    [('Hardware Security Modules (HSM) & Key Management Services (AWS KMS)', 'HSMs are tamper-resistant physical appliances that generate, store, and execute cryptographic operations inside dedicated silicon, ensuring private keys never leave the hardware.') for _ in range(15)],
    [('Post-Quantum Cryptography (PQC) & Lattice-Based Encryption', 'NIST-standardized quantum-resistant algorithms (ML-KEM / Kyber for key encapsulation, ML-DSA / Dilithium for digital signatures) resistant to Shor\'s quantum algorithm.') for _ in range(15)]
)

# 4. SOFTWARE TESTING (QA)
sys_data['software_testing'] = generate_domain_parent_sets(
    'software_testing', 'Software Testing & Quality Assurance',
    [
        ('The Testing Pyramid: Unit, Integration, Component, and End-to-End (E2E) Tests', 'Unit tests form the broad, fast, inexpensive base. Integration tests verify interactions between components and databases. E2E tests are few, testing full user journeys across browsers, balancing execution speed and coverage.'),
        ('Test-Driven Development (TDD) Cycle: Red, Green, Refactor', 'Write a failing test first (Red). Write minimal production code to make the test pass (Green). Refactor code for cleanliness and design while keeping tests green.'),
        ('Mocking, Stubbing, Spying, and Fakes (Test Doubles)', 'Dummy (passed around but never used). Stub (returns canned responses). Spy (records how it was called). Mock (pre-programmed with expectations, fails test if breached). Fake (working lightweight implementation like in-memory SQLite).'),
        ('E2E Browser Automation with Playwright vs Cypress', 'Playwright supports multi-tab, multi-origin, iframe, and WebWorker automation across Chromium, Firefox, WebKit over Chrome DevTools Protocol with auto-waiting. Cypress executes directly inside browser context with time-travel debugging.'),
        ('Code Coverage Metrics: Statement, Branch, Function, and Mutation Testing', 'Branch coverage verifies both true and false paths of conditionals. Mutation testing injects deliberate bugs (mutants) into source code to verify that test suites actively detect and fail them.'),
    ],
    [('API Automation Testing with Postman/Newman and REST Assured', 'Automating HTTP requests, asserting JSON response schemas against JSON Schema drafts, verifying status codes, and executing collections in CI/CD pipelines.') for _ in range(5)],
    [('Performance, Load & Stress Testing with k6, JMeter, or Gatling', 'Simulating virtual users to measure throughput, latency percentiles, error rates, and identifying system breaking points and memory leaks.') for _ in range(20)],
    [('Contract Testing with Pact for Microservices', 'Consumer-driven contract testing: consumer verifies provider API contracts without maintaining expensive, fragile live end-to-end testing environments.') for _ in range(15)],
    [('Continuous Testing & Test Impact Analysis in CI/CD Pipelines', 'Running only the tests affected by code changes in a pull request to reduce pipeline execution time while preserving high test confidence.') for _ in range(15)]
)

# 5. EMBEDDED SYSTEMS
sys_data['embedded_systems'] = generate_domain_parent_sets(
    'embedded_systems', 'Embedded Systems & Firmware Engineering',
    [
        ('Microcontroller Architecture: CPU Core, Flash, SRAM, and Peripherals', 'Harvard architecture with separate instruction and data buses (ARM Cortex-M). Flash stores non-volatile firmware. SRAM stores runtime stack and heap. Memory-mapped I/O peripherals controlled via hardware registers.'),
        ('Interrupt Service Routines (ISRs) & Nested Vectored Interrupt Controller (NVIC)', 'Hardware events trigger ISR execution. Keep ISRs minimal: acknowledge interrupt, read hardware buffer, set flags, and defer heavy processing to main loop or RTOS tasks. Never use blocking delays or heap allocation inside an ISR.'),
        ('Embedded Communication Protocols: I2C vs SPI vs UART vs CAN', 'UART is asynchronous point-to-point (TX/RX). SPI is synchronous full-duplex with master-slave select lines (fast, up to 50MHz). I2C is 2-wire half-duplex with addressing. CAN bus is differential multi-master with collision avoidance for automotive/industrial reliability.'),
        ('Real-Time Operating Systems (RTOS): FreeRTOS Task Scheduling & Mutexes', 'Preemptive priority-based scheduling. Tasks, Queues for thread-safe inter-task communication, Semaphores for synchronization. Priority Inversion mitigation using Priority Inheritance in mutexes.'),
        ('Direct Memory Access (DMA) for High-Speed Peripheral Transfers', 'DMA controller transfers data directly between peripherals (ADC, SPI, UART) and SRAM without involving CPU core, freeing CPU for application processing during high-speed sensor ingestion.'),
    ],
    [('Low-Power Modes: Sleep, Stop, Standby, and Wake-up Sources', 'Configuring microcontroller power domains, clock gating, and wake-up timers to achieve microamp current consumption in battery-powered IoT devices.') for _ in range(5)],
    [('Firmware Bootloaders & Over-the-Air (OTA) Updates', 'Dual-bank flash memory architecture (Active slot vs Candidate slot). Bootloader verifies cryptographic image signature, applies updates, and rolls back on boot failure.') for _ in range(20)],
    [('Watchdog Timers (WDT): Independent vs Windowed Watchdogs', 'Hardware timer that resets the system if firmware freezes or enters infinite loop. Firmware must periodically refresh the watchdog counter before expiration.') for _ in range(15)],
    [('Hardware Debugging with JTAG/SWD, Logic Analyzers, and Oscilloscopes', 'Setting hardware breakpoints via SWD (Serial Wire Debug). Using logic analyzers to decode protocol timings and oscilloscopes to inspect signal integrity.') for _ in range(15)]
)

# 6. C++
sys_data['cpp'] = generate_domain_parent_sets(
    'cpp', 'Modern C++ (C++17 / C++20)',
    [
        ('Resource Acquisition Is Initialization (RAII) & Rule of 5 / Rule of Zero', 'Resource lifetimes tied to object lifetimes. RAII guarantees cleanup in destructors even when exceptions throw. Rule of 5: if you define destructor, define copy/move constructor and copy/move assignment operators.'),
        ('Smart Pointers: std::unique_ptr, std::shared_ptr, and std::weak_ptr', 'std::unique_ptr provides zero-overhead exclusive ownership. std::shared_ptr provides reference-counted shared ownership via control block. std::weak_ptr provides non-owning observer reference to break circular dependencies.'),
        ('Move Semantics, Rvalue References (&&), and std::move vs std::forward', 'Rvalue references bind to temporaries. std::move casts an lvalue to rvalue to invoke move constructors (stealing pointer resources without deep copy). std::forward enables perfect forwarding in generic templates.'),
        ('C++20 Concepts and Constraints', 'Concepts enforce compile-time constraints on template parameters (template<std::integral T>), replacing cumbersome SFINAE (enable_if) with readable syntax and precise compiler diagnostics.'),
        ('C++ Memory Model, std::atomic, and Memory Ordering (acquire/release/relaxed)', 'std::atomic enables lock-free operations. Memory orderings control CPU reordering: memory_order_relaxed (atomic without order), memory_order_acquire/release (synchronizes writes across threads), memory_order_seq_cst (sequential consistency).'),
    ],
    [('Template Metaprogramming & constexpr / consteval', 'Executing complex computations at compile time using constexpr functions and consteval immediate functions, eliminating runtime computation overhead.') for _ in range(5)],
    [('STL Container Internals: std::vector vs std::deque vs std::unordered_map', 'std::vector uses contiguous memory with amortized O(1) growth. std::unordered_map uses hash table with bucket chaining, requiring custom std::hash specializations.') for _ in range(20)],
    [('Memory Profiling with Valgrind, AddressSanitizer (ASan), and LeakSanitizer', 'Compile with -fsanitize=address,undefined to detect buffer overflows, use-after-free, double-free, and memory leaks with zero false positives.') for _ in range(15)],
    [('High-Frequency Low-Latency C++ Architecture & Cache Line Alignment', 'Aligning structs to 64-byte cache lines (alignas(64)) to eliminate False Sharing across CPU cores. Avoiding dynamic memory allocation in hot paths.') for _ in range(15)]
)

# 7. GAME DEVELOPMENT
sys_data['game_development'] = generate_domain_parent_sets(
    'game_development', 'Game Development & Graphics Engineering',
    [
        ('The Game Loop Architecture: Input, Update, Render, and Fixed Timestep', 'Decoupling physics simulation (fixed timestep, e.g. 50Hz) from rendering (variable frame rate with interpolation) to ensure deterministic physics across hardware.'),
        ('Entity-Component-System (ECS) vs Traditional OOP Hierarchy', 'Entities are lightweight IDs. Components are pure data structs stored contiguously in memory arrays (cache-friendly Data-Oriented Design). Systems iterate components to execute logic at 60fps.'),
        ('Spatial Partitioning: Quadtrees, Octrees, and Bounding Volume Hierarchies (BVH)', 'Partitioning 2D/3D game worlds into hierarchical volumes to reduce collision detection complexity from O(N^2) to O(N log N) or O(log N).'),
        ('Graphics Rendering Pipeline: Shaders (Vertex, Fragment), Draw Calls, and Framebuffers', 'Vertex shaders transform 3D vertices to screen space. Fragment shaders compute pixel colors. Minimizing draw calls via texture atlasing and GPU instancing.'),
        ('Game Physics & Collision Detection: Separating Axis Theorem (SAT) and GJK', 'Broad-phase (AABB bounding boxes) prunes distant pairs. Narrow-phase (SAT for convex polygons, Gilbert-Johnson-Keerthi for 3D) calculates exact collision manifolds.'),
    ],
    [('State Machines & Behavior Trees for Game AI', 'Hierarchical State Machines (HSMs) for character states (Idle, Run, Jump). Behavior Trees with Composites (Selector, Sequence) and Decorators for complex enemy AI.') for _ in range(5)],
    [('Multiplayer Game Networking: Client Prediction, Server Reconciliation, and Entity Interpolation', 'Client executes movement immediately for zero input lag. Server validates state; if mismatch occurs, client snaps back and replays input buffer. Interpolation smooths remote players.') for _ in range(20)],
    [('Memory Management in Game Engines & Custom Linear/Pool Allocators', 'Bypassing OS malloc/free in game loops using pre-allocated Stack Allocators (per-frame allocations) and Pool Allocators (fixed-size bullets/particles) with zero fragmentation.') for _ in range(15)],
    [('Shader Optimization & GPU Profiling with RenderDoc', 'Inspecting frame capture in RenderDoc to locate vertex bottlenecks, overdraw regions, bandwidth saturation, and shader execution stalls.') for _ in range(15)]
)

# 8. BLOCKCHAIN
sys_data['blockchain'] = generate_domain_parent_sets(
    'blockchain', 'Blockchain & Web3 Engineering',
    [
        ('Blockchain Architecture: Merkle Trees, Cryptographic Hashing, and P2P Gossip', 'Blocks contain headers with Merkle root of transactions and previous block hash. P2P network broadcasts transactions via gossip protocol with consensus validation.'),
        ('Consensus Mechanisms: Proof-of-Work (PoW) vs Proof-of-Stake (PoS)', 'PoW uses hash puzzles (Nakamoto consensus, high energy). PoS selects validators proportionally to staked economic capital (Ethereum Casper), slashing malicious validators.'),
        ('Ethereum Virtual Machine (EVM) Architecture & Gas Mechanics', 'Stack-based virtual machine executing bytecode. Every opcode consumes Gas to meter computational cost, prevent infinite loops, and compensate validators.'),
        ('Smart Contract Security: Reentrancy Attacks & Checks-Effects-Interactions Pattern', 'Reentrancy occurs when external call transfers control before updating balance, allowing re-calling withdraw(). Defend by updating internal state before making external calls or using nonReentrant modifiers.'),
        ('ERC Standards: ERC-20 (Fungible), ERC-721 (NFT), and ERC-1155 (Multi-Token)', 'ERC-20 defines transfer, balanceOf, approve, transferFrom. ERC-721 adds token ownership by unique tokenId. ERC-1155 unifies fungible and non-fungible tokens in a single contract with batch operations.'),
    ],
    [('Gas Optimization in Solidity: Storage Slot Packing & Calldata', 'Storage operations (SSTORE, SLOAD) cost thousands of gas. Pack variables into 32-byte slots. Use calldata instead of memory for read-only array parameters.') for _ in range(5)],
    [('Layer 2 Scaling: Optimistic Rollups vs Zero-Knowledge (ZK) Rollups', 'Optimistic rollups assume valid transactions with 7-day fraud proof windows (Arbitrum/Optimism). ZK rollups generate cryptographic validity proofs (SNARKs/STARKs) for instant mathematical finality.') for _ in range(20)],
    [('DeFi Protocols: Automated Market Makers (AMM) & Flash Loans', 'x * y = k constant product formula (Uniswap). Flash loans allow borrowing millions uncollateralized within a single transaction if repaid with fee in the same block.') for _ in range(15)],
    [('Smart Contract Auditing & Formal Verification with Slither and Certora', 'Static analysis detecting reentrancy, uninitialized storage pointers, and front-running vulnerabilities. Mathematical specification proving contract invariants.') for _ in range(15)]
)

# 9. QUANTUM COMPUTING
sys_data['quantum_computing'] = generate_domain_parent_sets(
    'quantum_computing', 'Quantum Computing & Algorithms',
    [
        ('Qubits, Superposition, and the Bloch Sphere Representation', 'Classical bits are 0 or 1. Qubit state |psi> = alpha|0> + beta|1>, where |alpha|^2 + |beta|^2 = 1. The Bloch sphere geometrically represents the complex probability amplitudes of a single qubit.'),
        ('Quantum Entanglement & Bell States', 'Two or more qubits whose states cannot be described independently, even across vast spatial distances. Measuring one instantaneously determines the other (Bell state (|00> + |11>)/sqrt(2)).'),
        ('Quantum Logic Gates: Pauli-X/Y/Z, Hadamard (H), Phase (S, T), and CNOT', 'Quantum gates are unitary matrices preserving vector norm. Hadamard creates equal superposition from |0>. CNOT (Controlled-NOT) creates two-qubit entanglement.'),
        ('No-Cloning Theorem in Quantum Mechanics', 'Fundamental theorem stating it is mathematically impossible to create an identical copy of an arbitrary unknown quantum state, underpinning quantum cryptography.'),
        ('Quantum Decoherence & Noise in NISQ Era Devices', 'Environmental noise causes loss of quantum coherence (T1 relaxation time, T2 dephasing time). Noisy Intermediate-Scale Quantum (NISQ) devices lack fault tolerance.'),
    ],
    [('Quantum Circuit Programming with Qiskit or Cirq', 'Creating QuantumCircuit with classical and quantum registers, applying gates, and measuring results into classical registers executed on simulators or real quantum processors.') for _ in range(5)],
    [('Shor\'s Algorithm for Integer Factorization', 'Uses Quantum Phase Estimation to find the period of a modular exponential function in polynomial time (O((log N)^3)), breaking RSA cryptography.') for _ in range(20)],
    [('Grover\'s Algorithm for Unstructured Database Search', 'Provides quadratic speedup (O(sqrt(N))) for searching unstructured databases using Oracle inversion and Amplitude Amplification (diffusion operator).') for _ in range(15)],
    [('Quantum Error Correction (Surface Codes) & Fault-Tolerant Quantum Computing', 'Encoding one logical qubit across hundreds of physical qubits to detect and correct bit-flip and phase-flip errors continuously.') for _ in range(15)]
)

# 10. DIGITAL MARKETING
sys_data['digital_marketing'] = generate_domain_parent_sets(
    'digital_marketing', 'Digital Marketing & Growth Engineering',
    [
        ('Customer Acquisition Cost (CAC), Lifetime Value (LTV), and LTV:CAC Ratio', 'CAC = Total sales & marketing spend / new customers acquired. Healthy SaaS businesses maintain LTV:CAC >= 3:1 with payback period < 12 months.'),
        ('Attribution Modeling: First-Touch, Last-Touch, Linear, and Multi-Touch (Data-Driven)', 'First-touch credits initial brand awareness. Last-touch credits final conversion channel. Multi-touch attribution distributes fractional credit across touchpoints.'),
        ('Conversion Rate Optimization (CRO) & A/B Testing Methodologies', 'Formulating hypotheses, calculating statistical significance (95%+ confidence), identifying conversion leaks in analytics funnels, and running split tests on landing pages.'),
        ('Search Engine Marketing (SEM / Google Ads) & Quality Score Architecture', 'Quality Score (Expected CTR, Ad Relevance, Landing Page Experience) determines Ad Rank and Cost-Per-Click (CPC). Bidding strategies: Maximize Conversions vs Target CPA.'),
        ('Email Marketing Automation, Drip Campaigns, and Deliverability Metrics', 'Segmenting subscriber lists by behavior, automated trigger workflows, SPF/DKIM/DMARC records preventing spam folder delivery, and tracking open/click rates.'),
    ],
    [('Programmatic Advertising & Real-Time Bidding (RTB / DSP / SSP)', 'Demand-Side Platforms bid on publisher ad inventory via Supply-Side Platforms in sub-100ms auctions based on audience cookies and contextual data.') for _ in range(5)],
    [('Social Media Performance Marketing (Meta Ads / TikTok Ads)', 'Creative testing frameworks, lookalike audiences, Meta Conversions API (CAPI) for server-side event tracking, and ROAS optimization.') for _ in range(20)],
    [('Marketing Analytics & Event Tracking with Google Analytics 4 (GA4)', 'Event-driven data model in GA4, custom dimensions/metrics, Google Tag Manager dataLayer integrations, and BigQuery export for raw event SQL queries.') for _ in range(15)],
    [('Privacy Regulations (GDPR/CCPA) & Cookieless Marketing Future', 'Third-party cookie deprecation, Consent Management Platforms (CMPs), First-party data strategies, and Privacy Sandbox APIs.') for _ in range(15)]
)

# 11. SEO
sys_data['seo'] = generate_domain_parent_sets(
    'seo', 'Search Engine Optimization (Technical SEO)',
    [
        ('Google Search Architecture: Crawling, Indexing, and Ranking', 'Googlebot discovers URLs via links and sitemaps (crawling), parses HTML and renders JavaScript (indexing), and algorithms evaluate 200+ signals to rank pages (ranking).'),
        ('Core Web Vitals & Page Experience Ranking Signals', 'Largest Contentful Paint (LCP < 2.5s), Interaction to Next Paint (INP < 200ms), and Cumulative Layout Shift (CLS < 0.1). Mobile usability and HTTPS security.'),
        ('Crawl Budget Optimization & robots.txt / X-Robots-Tag Architecture', 'Managing crawl budget for large sites: Disallowing faceted filter parameter explosions in robots.txt, eliminating redirect chains, and resolving 404/500 server errors.'),
        ('Canonicalization (`rel=\"canonical\"`) & Duplicate Content Mitigation', 'Specifying canonical URL tags to consolidate ranking signals for identical content accessible across multiple URLs (parameters, tracking tags, HTTP/HTTPS).'),
        ('Structured Data (Schema.org / JSON-LD) for Rich Results', 'Injecting JSON-LD schema (Article, Organization, BreadcrumbList, FAQPage, Product) to earn rich snippets, star ratings, and knowledge graph panels in search results.'),
    ],
    [('International SEO: hreflang Tags & Multi-Regional Routing', 'Implementing hreflang annotations (e.g. hreflang=\"en-us\", hreflang=\"fr-ca\") with x-default fallbacks to route users to localized regional content.') for _ in range(5)],
    [('JavaScript SEO & Client-Side vs Server-Side Rendering Indexing', 'Googlebot renders JavaScript using Chromium, but execution is deferred. Server-Side Rendering (SSR) or Static Site Generation (SSG) ensures immediate HTML indexing.') for _ in range(20)],
    [('Internal Linking Architecture & PageRank Distribution', 'Structuring topical clusters with pillar pages and supporting cluster articles. Distributing internal link equity to high-value conversion pages.') for _ in range(15)],
    [('Technical SEO Audit Methodology & Log File Analysis', 'Analyzing web server access logs to track exact Googlebot crawl behavior, frequency, and status code responses across site sections.') for _ in range(15)]
)

# 12. CS CORE: DBMS & SQL
sys_data['cs_dbms'] = generate_domain_parent_sets(
    'cs_dbms', 'Computer Science Core: DBMS & SQL',
    [
        ('Relational Database Normalization (1NF, 2NF, 3NF, BCNF)', 'Eliminating data redundancy and update anomalies. 1NF: atomic values. 2NF: no partial dependency on composite key. 3NF: no transitive dependency. BCNF: every determinant is a candidate key.'),
        ('ACID Properties and Write-Ahead Logging (WAL)', 'Atomicity, Consistency, Isolation, Durability. WAL ensures all data modifications are written to durable append-only log before being written to disk data pages, enabling crash recovery.'),
        ('Concurrency Control & Two-Phase Locking (2PL)', 'Growing phase (locks acquired, none released) and Shrinking phase (locks released, none acquired). Strict 2PL holds exclusive locks until transaction commit to prevent cascading aborts.'),
        ('B+ Tree Index Internals in Database Storage Engines', 'Balanced search tree where internal nodes store keys and leaf nodes store data pointers connected via doubly linked list, enabling O(log N) equality and ultra-fast range queries.'),
        ('Database Recovery: Checkpoints and ARIES Algorithm', 'Analysis phase (determines dirty pages and active transactions at crash), Redo phase (replays all history from log), Undo phase (rolls back active uncommitted transactions in reverse).'),
    ],
    [('Query Optimization: Cost-Based Optimizer & Cardinality Estimation', 'Optimizer evaluates equivalent query execution trees, estimating disk I/O and CPU cost using histogram statistics to select optimal join order.') for _ in range(5)],
    [('SQL vs NoSQL Architectural Trade-offs (CAP Theorem)', 'Relational SQL provides strong ACID consistency and complex joins. NoSQL (Document, Key-Value, Columnar) prioritizes horizontal scalability and eventual consistency.') for _ in range(20)],
    [('Database Sharding, Partitioning, and Consistent Hashing', 'Horizontal partitioning splits tables across rows. Sharding distributes partitions across independent database servers using shard keys.') for _ in range(15)],
    [('Distributed Database Transactions: Two-Phase Commit (2PC) vs Saga', '2PC uses coordinator with prepare and commit phases (blocking, prone to coordinator failure). Saga uses local transactions with compensating actions.') for _ in range(15)]
)

# 13. CS CORE: OPERATING SYSTEMS
sys_data['cs_os'] = generate_domain_parent_sets(
    'cs_os', 'Computer Science Core: Operating Systems',
    [
        ('Process vs Thread, PCB, and Context Switching Overhead', 'Process has isolated memory space (Text, Data, Heap, Stack). Threads share process address space. Context switch saves CPU registers and updates MMU page tables, causing cache misses.'),
        ('CPU Scheduling Algorithms: FCFS, SJF, Round Robin, Multi-Level Feedback Queue (MLFQ)', 'Preemptive vs non-preemptive. Round Robin uses time slices (quanta). MLFQ dynamically adjusts priority based on past CPU burst and I/O behavior.'),
        ('Virtual Memory, Paging, Page Fault Handling, and Thrashing', 'Translates virtual addresses to physical addresses via MMU and Page Tables. TLB caches translations. Page fault loads missing page from swap. Thrashing occurs when system spends more time paging than executing.'),
        ('Process Synchronization: Critical Section, Semaphores, Mutexes, and Monitors', 'Mutual exclusion, progress, and bounded waiting. Counting vs binary semaphores (wait/signal). Monitors encapsulate shared variables and procedures with condition variables.'),
        ('Deadlock Conditions (Coffman Conditions) & Banker\'s Algorithm', 'Mutual Exclusion, Hold and Wait, No Preemption, Circular Wait. Banker\'s algorithm simulates resource allocation for safe state before granting requests.'),
    ],
    [('Page Replacement Algorithms: FIFO, Optimal, LRU, Clock Algorithm', 'LRU (Least Recently Used) replaces page unused for longest time. Clock algorithm approximates LRU using reference bits with minimal hardware overhead.') for _ in range(5)],
    [('Inter-Process Communication (IPC): Pipes, Shared Memory, Message Queues, Sockets', 'Pipes provide unidirectional byte streams. Shared memory is fastest (zero copy) but requires manual synchronization with semaphores.') for _ in range(20)],
    [('File System Architecture: Inodes, Superblocks, and Directory Structures', 'Inode stores file metadata, permissions, and direct/indirect block pointers. Superblock stores overall filesystem geometry and free block bitmaps.') for _ in range(15)],
    [('Kernel Architecture: Monolithic vs Microkernel vs Hybrid', 'Monolithic runs all services (drivers, FS, networking) in kernel space (fast, but driver crash takes down OS). Microkernel runs minimal core in kernel space, moving drivers to user space.') for _ in range(15)]
)

# 14. CS CORE: COMPUTER NETWORKS
sys_data['cs_cn'] = generate_domain_parent_sets(
    'cs_cn', 'Computer Science Core: Computer Networks',
    [
        ('OSI 7-Layer Model vs TCP/IP 4-Layer Model', 'Physical, Data Link (frames/MAC), Network (packets/IP), Transport (segments/TCP), Session, Presentation, Application. Encapsulation adds headers at each downward layer; decapsulation strips headers.'),
        ('TCP 3-Way Handshake & 4-Way Connection Teardown', 'Handshake: SYN (client ISN) -> SYN-ACK (server ISN) -> ACK. Teardown: FIN -> ACK -> FIN -> ACK with TIME_WAIT state to ensure final ACK delivery.'),
        ('TCP Flow Control (Sliding Window) vs Congestion Control (AIMD)', 'Flow control protects receiver buffer via Advertised Window. Congestion control protects network: Slow Start (exponential growth), Congestion Avoidance (linear), Fast Retransmit, Fast Recovery.'),
        ('IP Addressing, Subnetting (CIDR), and NAT (Network Address Translation)', 'IPv4 32-bit addresses in dotted decimal. CIDR (/24 = 256 IPs). NAT maps private internal IPs (192.168.x.x) to a single public IP using port multiplexing (PAT).'),
        ('DNS Resolution Architecture & The Life of a URL Request', 'Browser checks cache -> OS resolver -> Recursive DNS resolver queries Root Server (.) -> TLD Server (.com) -> Authoritative Nameserver (example.com), returning IP address.'),
    ],
    [('Routing Algorithms: Link-State (OSPF) vs Distance-Vector (BGP/RIP)', 'OSPF (Dijkstra algorithm) floods link states to build complete topology map. BGP (Border Gateway Protocol) is path-vector protocol governing global internet routing.') for _ in range(5)],
    [('Application Layer Protocols: HTTP/1.1 vs HTTP/2 vs HTTP/3 (QUIC)', 'HTTP/1.1 (head-of-line blocking). HTTP/2 (binary framing, multiplexing over single TCP connection). HTTP/3 (runs over UDP with QUIC, eliminating TCP HOL blocking).') for _ in range(20)],
    [('Network Security: Firewalls, IDS/IPS, and VPNs (IPsec / WireGuard)', 'Stateful inspection firewalls track connection states. WireGuard provides modern high-speed kernel VPN encryption using ChaCha20 and Curve25519.') for _ in range(15)],
    [('Content Delivery Networks (CDN) & Anycast Routing', 'Anycast announces same IP address across global data centers via BGP. User requests automatically route to topologically closest CDN edge POP.') for _ in range(15)]
)

# 15. CS CORE: OOP CONCEPTS
sys_data['cs_oop'] = generate_domain_parent_sets(
    'cs_oop', 'Computer Science Core: Object-Oriented Programming',
    [
        ('The Four Pillars of OOP: Encapsulation, Abstraction, Inheritance, Polymorphism', 'Encapsulation bundles data and methods, hiding state via access modifiers. Abstraction exposes essential features without implementation details. Inheritance enables code reuse. Polymorphism allows treating different classes through a common interface.'),
        ('SOLID Principles of Object-Oriented Design', 'Single Responsibility, Open/Closed (open for extension, closed for modification), Liskov Substitution (subtypes must be substitutable for base types), Interface Segregation, Dependency Inversion.'),
        ('Composition over Inheritance & The Fragile Base Class Problem', 'Inheritance creates tight coupling (changes to base class break subclasses). Composition constructs objects containing instances of other classes with interfaces, providing flexible runtime behavior.'),
        ('Design Patterns: Creational (Singleton, Factory, Builder)', 'Singleton restricts instantiation to single instance. Factory encapsulates object creation logic. Builder separates complex object construction from its representation.'),
        ('Design Patterns: Structural (Adapter, Decorator, Facade)', 'Adapter converts interface of class into another interface. Decorator attaches additional responsibilities dynamically. Facade provides unified high-level interface to subsystem.'),
    ],
    [('Design Patterns: Behavioral (Observer, Strategy, Command)', 'Observer notifies multiple subscribers on state change. Strategy encapsulates interchangeable algorithms. Command encapsulates request as standalone object with undo support.') for _ in range(5)],
    [('Static vs Dynamic Binding & Virtual Method Tables (vtable)', 'Static binding resolves method calls at compile time. Dynamic binding uses vtables (pointers to virtual functions) at runtime to achieve runtime polymorphism.') for _ in range(20)],
    [('Coupling vs Cohesion in Software Architecture', 'High cohesion: elements in a module belong together and perform a single well-defined task. Low coupling: minimal dependencies between separate modules.') for _ in range(15)],
    [('Refactoring Code Smells: God Classes, Long Methods, Feature Envy', 'Identifying antipatterns and refactoring using Extract Method, Extract Class, Move Method, and Replace Conditional with Polymorphism.') for _ in range(15)]
)

# 16. CS CORE: DATA STRUCTURES & ALGORITHMS
sys_data['cs_dsa'] = generate_domain_parent_sets(
    'cs_dsa', 'Computer Science Core: Data Structures & Algorithms',
    [
        ('Asymptotic Analysis: Big-O, Big-Omega, Big-Theta, and Master Theorem', 'Big-O denotes upper bound. Big-Omega denotes lower bound. Big-Theta denotes tight bound. Master Theorem solves divide-and-conquer recurrences: T(n) = aT(n/b) + f(n).'),
        ('Arrays, Dynamic Arrays, and Amortized O(1) Time Complexity', 'Contiguous memory, O(1) random access by index. Dynamic arrays double capacity when full (geometric resizing), yielding amortized O(1) insertion at end.'),
        ('Linked Lists: Singly, Doubly, Circular, and Floyd\'s Cycle Detection', 'Node contains data and pointer(s). Floyd\'s Cycle Detection uses slow and fast pointers (tortoise and hare) meeting inside cycle in O(N) time and O(1) space.'),
        ('Stack and Queue Architectures & Monotonic Stack Applications', 'Stack is LIFO (push/pop); Queue is FIFO. Monotonic stack maintains elements in strictly increasing/decreasing order, solving Next Greater Element in O(N).'),
        ('Hash Table Collision Resolution: Chaining vs Open Addressing', 'Separate chaining stores collided elements in linked lists or red-black trees. Open addressing probes alternative slots: Linear Probing, Quadratic Probing, Double Hashing.'),
    ],
    [('Binary Search Trees, AVL Trees, and Red-Black Trees', 'BST has left < root < right. AVL enforces balance factor in {-1, 0, 1} with rotations. Red-Black trees enforce color rules to maintain O(log N) worst-case search, insert, delete.') for _ in range(5)],
    [('Graph Algorithms: BFS, DFS, Dijkstra, Bellman-Ford, and TopoSort', 'BFS finds shortest path on unweighted graphs. Dijkstra finds shortest path on non-negative weighted graphs (O(E log V)). Bellman-Ford detects negative cycles. Topological sort orders DAGs.') for _ in range(20)],
    [('Dynamic Programming: Memoization (Top-Down) vs Tabulation (Bottom-Up)', 'Optimal substructure and overlapping subproblems. Memoization caches recursive results. Tabulation fills DP table iteratively, often optimizing space to O(1) or O(N).') for _ in range(15)],
    [('Trie (Prefix Tree) Data Structure & Autocomplete Search', 'Tree structure where nodes represent characters. Fast prefix lookup in O(L) time where L is word length, independent of total dictionary size.') for _ in range(15)]
)

# 17. CS CORE: SOFTWARE ENGINEERING
sys_data['cs_se'] = generate_domain_parent_sets(
    'cs_se', 'Computer Science Core: Software Engineering',
    [
        ('Software Development Life Cycle (SDLC): Agile, Scrum, and Kanban', 'Agile values individuals and working software. Scrum organizes work into time-boxed Sprints (planning, daily standups, reviews, retrospectives). Kanban visualizes continuous workflow with WIP limits.'),
        ('Continuous Integration and Continuous Deployment (CI/CD) Pipelines', 'CI automatically builds and tests code on every commit. CD automatically deploys passing builds to staging/production environments, reducing release cycle friction.'),
        ('Version Control Best Practices: Git Flow, Trunk-Based Development, and Rebasing', 'Git Flow uses feature branches, develop, release, and main branches. Trunk-based development merges small frequent changes directly into main with feature flags.'),
        ('Software Design Principles: DRY, KISS, YAGNI, and Separation of Concerns', 'Don\'t Repeat Yourself (DRY). Keep It Simple, Stupid (KISS). You Aren\'t Gonna Need It (YAGNI avoids speculative over-engineering). Separation of Concerns divides software into distinct sections.'),
        ('Code Review Best Practices & Technical Debt Management', 'Constructive code reviews focused on architecture, edge cases, test coverage, and readability. Managing technical debt by dedicating engineering capacity to refactoring.'),
    ],
    [('Software Architecture Patterns: Monolithic, Microservices, Event-Driven, Serverless', 'Comparing maintenance, scalability, failure domains, deployment complexity, and team autonomy across architectural patterns.') for _ in range(5)],
    [('Automated Testing Strategies & Test Coverage Thresholds', 'Establishing testing pyramids, enforcing minimum coverage in CI pipelines, and writing regression test suites for critical business transactions.') for _ in range(20)],
    [('Software Documentation: ADRs (Architectural Decision Records) & C4 Model', 'ADRs capture architectural decisions with context and consequences. C4 model visualizes software architecture at Context, Container, Component, and Code levels.') for _ in range(15)],
    [('Site Reliability Engineering (SRE): SLI, SLO, SLA, and Error Budgets', 'Service Level Indicators (metrics). Service Level Objectives (targets). Service Level Agreements (customer contracts). Error budgets govern release velocity vs stability.') for _ in range(15)]
)

print(f"Total Systems, Security & CS Core Stacks Generated: {len(sys_data)}")
write_php_file(os.path.join(OUT_DIR, 'systems_cs_mock_parent_sets.php'), sys_data)
