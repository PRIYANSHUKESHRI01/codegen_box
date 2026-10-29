<?php

// Auto-generated curated vault questions for Mellow Vault AI Interview

return [
    'cyber_security' => [
        1 => [
            [
                'text' => 'Explain the CIA Triad (Confidentiality, Integrity, Availability) and give an example of an attack against each component.',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Confidentiality (unauthorized data breach / eavesdropping). Integrity (unauthorized tampering or data alteration / MITM). Availability (denial-of-service / ransomware taking systems offline).',
            ],
            [
                'text' => 'What is the difference between a Vulnerability, a Threat, and a Risk in cybersecurity risk management?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Vulnerability is a weakness in software/system; Threat is an actor or event exploiting a vulnerability; Risk is the expected impact and probability of a threat exploiting a vulnerability (Risk = Threat x Vulnerability x Impact).',
            ],
            [
                'text' => 'How does a Stateful Firewall differ from a Stateless Firewall and a Next-Generation Firewall (NGFW)?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Stateless checks static rules per packet in isolation. Stateful tracks active connection state (TCP handshake). NGFW adds Layer 7 application inspection, intrusion prevention (IPS), and TLS decryption.',
            ],
            [
                'text' => 'What is Threat Modeling (e.g. STRIDE methodology), and how do you apply it during software design?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'STRIDE: Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege. Systematically maps data flows and trust boundaries to mitigate attack surfaces before coding.',
            ],
            [
                'text' => 'What is a Distributed Denial of Service (DDoS) attack? Explain common types (SYN flood, DNS amplification, HTTP flood) and mitigation strategies.',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'L4 volumetric/protocol floods (SYN floods exhaust half-open connection queues; UDP/DNS reflection amplifies bandwidth) vs L7 application floods. Mitigated by Anycast CDNs (Cloudflare), rate limiting, and scrubbing centers.',
            ],
        ],
        2 => [
            [
                'text' => 'What are the core phases of the Incident Response lifecycle according to the NIST SP 800-61 framework?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Preparation, Detection & Analysis, Containment/Eradication/Recovery, and Post-Incident Activity (Lessons Learned).',
            ],
            [
                'text' => 'How does a Security Information and Event Management (SIEM) system work, and how do correlation rules detect anomalous behavior?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Ingests, normalizes, and aggregates log events from endpoints, firewalls, and servers; correlation rules trigger alerts when patterns match (e.g. 5 failed logins followed by successful admin login from unknown geo-IP).',
            ],
            [
                'text' => 'What is the MITRE ATT&CK framework, and how do SOC analysts map adversary tactics, techniques, and procedures (TTPs)?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Comprehensive matrix of adversary behaviors organized into tactics (goals: Initial Access, Persistence, Privilege Escalation) and techniques (specific mechanisms: PowerShell, DLL Injection) to evaluate defense coverage.',
            ],
            [
                'text' => 'How do you analyze a suspicious executable in a SOC environment using static analysis and dynamic sandbox analysis?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Static: inspect file hashes (VirusTotal), strings, PE headers, exported/imported DLLs, and entropy (detect packing). Dynamic: execute in isolated VM sandbox (Cuckoo/Any.run) monitoring spawned processes, registry changes, and C2 network callbacks.',
            ],
            [
                'text' => 'How do Endpoint Detection and Response (EDR) agents detect living-off-the-land binaries (LOLBins) like powershell.exe or certutil.exe?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Monitors process lineage (parent-child relationships, e.g. Word spawning powershell.exe), command-line arguments (base64 encoded commands), memory injection, and network connections made by system utilities.',
            ],
        ],
        3 => [
            [
                'text' => 'What are the foundational principles of a Zero Trust Architecture ("Never Trust, Always Verify")?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Assume breach, verify explicitly based on all available data points (user identity, device health, location, workload), enforce least privileged access with micro-segmentation, eliminating perimeter-only trust.',
            ],
            [
                'text' => 'Explain Multi-Factor Authentication (MFA) factors: Something you know, Something you have, and Something you are. Why is SMS OTP vulnerable?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Knowledge (password), Possession (hardware token, authenticator app), Inherence (biometrics). SMS OTP is susceptible to SIM swapping, SS7 telecommunication attacks, and real-time reverse proxy phishing.',
            ],
            [
                'text' => 'What are SOC 2 Type II and ISO 27001 standards, and how do technical security controls demonstrate ongoing compliance?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'ISO 27001 certifies ISMS framework; SOC 2 Type II audits operational effectiveness of trust service principles (Security, Availability, Confidentiality) over a 6-12 month audit window with continuous evidence collection.',
            ],
            [
                'text' => 'How does Public Key Infrastructure (PKI) establish trust in corporate networks and HTTPS communications?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Root Certificate Authorities (CAs) issue signed intermediate and leaf X.509 certificates; clients verify signature chains up to trusted root store in OS/browser; CRLs and OCSP check revocation status.',
            ],
            [
                'text' => 'How do you design a secure data loss prevention (DLP) and role-based access control (RBAC) policy for enterprise cloud environments?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'RBAC grants permissions according to job responsibilities (avoiding individual user grants); DLP monitors data at rest, in transit, and in use, scanning for PII, PAN, or secret keys and preventing exfiltration.',
            ],
        ],
    ],
    'ethical_hacking' => [
        1 => [
            [
                'text' => 'What is the difference between White Hat, Black Hat, and Grey Hat hacking? Why is written authorization (Rules of Engagement) critical before penetration testing?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'White hat (authorized, defensive), Black hat (malicious, illegal), Grey hat (unauthorized but not malicious). Testing without written Scope of Work / Rules of Engagement violates anti-hacking laws (CFAA, Computer Misuse Act).',
            ],
            [
                'text' => 'How does Nmap perform network reconnaissance? Explain the difference between TCP Connect scan (-sT) and TCP SYN stealth scan (-sS).',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'TCP Connect completes full three-way handshake (SYN, SYN-ACK, ACK), leaving connection logs on target. TCP SYN stealth sends SYN; if SYN-ACK returned, port is open, and scanner sends RST to tear down without completing handshake.',
            ],
            [
                'text' => 'What is Passive Reconnaissance versus Active Reconnaissance? Give examples of tools used in each phase.',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Passive gathers intelligence without direct target contact (WHOIS, Shodan, OSINT, Google Dorking, Certificate Transparency logs). Active interacts directly with target systems (Nmap, Nikto, dirsearch).',
            ],
            [
                'text' => 'How do automated vulnerability scanners (e.g. Nessus, OpenVAS, Qualys) discover and prioritize security flaws?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Probes service banners, port responses, and configurations against CVE databases; assigns Common Vulnerability Scoring System (CVSS v3) base scores based on attack vector, complexity, privileges, and impact.',
            ],
            [
                'text' => 'What is DNS enumeration, and how do zone transfers (AXFR queries) reveal internal network topology if misconfigured?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Enumerates subdomains and host records (dig, dnsenum, sublist3r); an unauthenticated AXFR query asks primary DNS to replicate entire zone file, dumping internal hostnames, mail servers, and IP addresses.',
            ],
        ],
        2 => [
            [
                'text' => 'Explain SQL Injection (SQLi). How does an attacker exploit an unsanitized query, and how do prepared statements eliminate SQLi?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Injecting SQL fragments (e.g. " OR 1=1 --) alters AST grammar. Prepared statements separate SQL query code from user parameter data; database treats input strictly as literal values, never executable syntax.',
            ],
            [
                'text' => 'Compare Reflected XSS, Stored XSS, and DOM-based XSS. How does an attacker exploit XSS to hijack user sessions?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Reflected: script reflected in immediate HTTP response via query params. Stored: script saved in database (forum post). DOM: vulnerability in client JS parsing URL fragment. Exploit steals document.cookie or redirects to phishing.',
            ],
            [
                'text' => 'What is Cross-Site Request Forgery (CSRF), and how do anti-CSRF tokens and SameSite cookie attributes protect against it?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Tricks victim browser into submitting unauthorized requests to authenticated site using ambient credentials (cookies). Mitigated by unique cryptographically random synchronizer tokens and SameSite=Lax/Strict cookies.',
            ],
            [
                'text' => 'How do you use Burp Suite (Proxy, Repeater, Intruder) to intercept, inspect, and modify HTTP requests during a penetration test?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Proxy intercepts browser traffic via CA cert; Repeater allows manual request editing and re-issuance to test parameters; Intruder automates fuzzing and payload spraying across specified positions.',
            ],
            [
                'text' => 'What is Server-Side Request Forgery (SSRF), and how do attackers exploit SSRF to access cloud metadata endpoints (169.254.169.254)?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Vulnerability where server fetches remote URL provided by user without restriction; attacker supplies link-local IP (169.254.169.254) to read AWS/GCP instance IAM credentials and access internal admin panels.',
            ],
        ],
        3 => [
            [
                'text' => 'What is Privilege Escalation? Distinguish between Horizontal and Vertical privilege escalation with examples.',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Horizontal: user accesses resources of another user with same privilege level (e.g. IDOR viewing another customer profile). Vertical: standard user escalates privileges to administrator / root.',
            ],
            [
                'text' => 'Explain common Linux privilege escalation vectors (e.g. SUID binaries, misconfigured sudoers permissions, cron jobs).',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'SUID bit executes with owner permissions (GTFOBins exploitation); sudo -l revealing commands without password; writable cron scripts executed as root; kernel exploits (Dirty COW).',
            ],
            [
                'text' => 'How does the Metasploit Framework work? Explain the difference between an Exploit, a Payload (e.g. Meterpreter), and an Auxiliary module.',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Exploit delivers and triggers payload through known vulnerability; Payload is the code executed on victim (Meterpreter provides interactive in-memory command shell); Auxiliary performs scanning and fuzzing without payloads.',
            ],
            [
                'text' => 'What post-exploitation techniques do penetration testers use to establish persistence and avoid detection on a compromised host?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Scheduled tasks, registry run keys, SSH authorized_keys, creating backdoor service accounts, clearing event logs, and injecting into legitimate processes (process hollowing).',
            ],
            [
                'text' => 'How should an ethical hacker structure a professional Penetration Testing Report for both executive leadership and technical engineers?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Executive summary (non-technical risk posture, overall score, business impact), Scope & Methodology, Detailed Technical Findings (description, CVSS score, reproduction steps with screenshots, and remediation guidance).',
            ],
        ],
    ],
    'cryptography' => [
        1 => [
            [
                'text' => 'What is the fundamental difference between Symmetric Encryption and Asymmetric Encryption? What are typical use cases for each?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Symmetric uses single shared secret key for encryption and decryption (AES, fast, bulk data encryption). Asymmetric uses public-private key pair (RSA/ECC, slower, key exchange and digital signatures).',
            ],
            [
                'text' => 'How does the Advanced Encryption Standard (AES) operate? Explain block size, key sizes (128, 192, 256 bits), and substitution-permutation networks.',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Fixed 128-bit block size with 128/192/256-bit keys; operates over multiple rounds consisting of SubBytes (S-box), ShiftRows, MixColumns, and AddRoundKey transformations.',
            ],
            [
                'text' => 'Compare AES cipher modes: Electronic Codebook (ECB), Cipher Block Chaining (CBC), and Galois/Counter Mode (GCM). Why is ECB considered insecure?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'ECB encrypts identical plaintext blocks into identical ciphertext blocks, preserving visual patterns (ECB penguin). CBC uses initialization vector (IV) and chaining. GCM provides Authenticated Encryption with Associated Data (AEAD).',
            ],
            [
                'text' => 'What is an Initialization Vector (IV) or Nonce in symmetric cryptography, and why must an IV never be repeated under the same key in GCM mode?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Random or unique starting value ensuring identical plaintexts produce distinct ciphertexts; repeating nonce in AES-GCM allows attacker to XOR ciphertexts and recover GHASH authentication key, breaking integrity.',
            ],
            [
                'text' => 'What is PKCS#7 padding, and how does a Padding Oracle attack allow an adversary to decrypt CBC-mode ciphertexts without the key?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Pads plaintexts to integer multiple of block size. Padding oracle leaks whether decrypted ciphertext has valid padding, allowing attacker to query byte-by-byte and decrypt ciphertext blocks using CBC XOR properties.',
            ],
        ],
        2 => [
            [
                'text' => 'How does the RSA cryptosystem work mathematically based on the difficulty of prime factorization (Euler’s totient function, public key (e, n), private key d)?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Generates primes p, q; n = p*q; phi(n) = (p-1)*(q-1); chooses e coprime to phi(n); computes private exponent d = e^-1 mod phi(n). Encryption c = m^e mod n; Decryption m = c^d mod n.',
            ],
            [
                'text' => 'How does Elliptic Curve Cryptography (ECC) provide the same security strength as RSA with significantly smaller key sizes (e.g. 256-bit ECC vs 3072-bit RSA)?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Based on Elliptic Curve Discrete Logarithm Problem (ECDLP) on y^2 = x^3 + ax + b over finite fields; no known sub-exponential algorithm exists to solve ECDLP, allowing smaller keys with lower compute and bandwidth overhead.',
            ],
            [
                'text' => 'Explain the Diffie-Hellman Key Exchange (DH) algorithm and how it enables two parties to negotiate a shared secret over an insecure channel.',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Parties agree on public base g and prime p; Alice picks secret a and sends g^a mod p; Bob picks secret b and sends g^b mod p; both compute (g^b)^a = (g^a)^b = g^(ab) mod p as shared secret.',
            ],
            [
                'text' => 'How do Digital Signatures (e.g. RSA-PSS, ECDSA) guarantee authenticity, non-repudiation, and message integrity?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Signer computes cryptographic hash of message and encrypts hash with private key; recipient decrypts signature with sender’s public key and verifies it matches newly computed hash of message.',
            ],
            [
                'text' => 'What is Perfect Forward Secrecy (PFS), and how does Ephemeral Diffie-Hellman (DHE/ECDHE) ensure past encrypted communications cannot be decrypted if the private server key is compromised?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Generates unique ephemeral session key pair for every handshake; session keys are destroyed after connection terminates, so compromising server long-term private key later cannot decrypt recorded historical traffic.',
            ],
        ],
        3 => [
            [
                'text' => 'What are the properties of a secure Cryptographic Hash Function (Pre-image resistance, Second pre-image resistance, Collision resistance)?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Pre-image: given h, computationally infeasible to find m such that hash(m)=h. Second pre-image: given m1, infeasible to find m2 with hash(m1)=hash(m2). Collision resistance: infeasible to find any two distinct m1, m2 with same hash.',
            ],
            [
                'text' => 'What is an HMAC (Hash-based Message Authentication Code), and why is simple hash concatenation (hash(secret + message)) vulnerable to length-extension attacks?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'HMAC = H((K ^ opad) || H((K ^ ipad) || M)). In Merkle-Damgard hashes (MD5, SHA-1, SHA-256), knowing hash(secret || message) allows attacker to append data and compute valid hash without knowing secret.',
            ],
            [
                'text' => 'Walk through the steps of a modern TLS 1.3 handshake: Key Exchange, Certificate Verification, and Session Ticket resumption.',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'ClientHello sends supported ciphers and key shares (ECDH); ServerHello agrees on cipher, sends server key share, encrypted certificate, and handshake finished tag in 1-RTT (or 0-RTT with PSK resumption).',
            ],
            [
                'text' => 'Why must passwords never be hashed with fast algorithms like SHA-256, and why are Argon2, bcrypt, or PBKDF2 with salt required?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'GPUs compute billions of SHA-256 hashes per second enabling fast brute-force and rainbow table lookups. Password hashing functions use configurable work factors (CPU/memory hardness) and unique salts per user.',
            ],
            [
                'text' => 'What threat does Shor’s Algorithm running on a quantum computer pose to public-key cryptography (RSA, ECC), and what are NIST Post-Quantum standards (e.g. ML-KEM/Kyber)?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Shor’s algorithm solves prime factorization and discrete log in polynomial time, breaking RSA, DH, and ECC. NIST standardized lattice-based algorithms (ML-KEM/Kyber for encryption, ML-DSA/Dilithium for signatures).',
            ],
        ],
    ],
    'software_testing' => [
        1 => [
            [
                'text' => 'Explain the Software Testing Pyramid: Unit Tests, Integration Tests, and End-to-End (E2E) Tests. Why should unit tests form the broadest base?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Unit tests: fast, isolated, cheap to write and maintain (broad base). Integration tests: verify interaction between components/APIs. E2E tests: verify full user journeys through UI (slow, brittle, expensive).',
            ],
            [
                'text' => 'What is the difference between Black-Box, White-Box, and Grey-Box testing techniques?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Black-box tests functionality without internal code knowledge (specifications). White-box tests internal code logic, branches, and statements. Grey-box combines knowledge of internal data structures/APIs with functional black-box tests.',
            ],
            [
                'text' => 'Explain Boundary Value Analysis (BVA) and Equivalence Class Partitioning (ECP) with a form input validation example.',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'ECP partitions inputs into valid and invalid classes, picking one representative from each. BVA tests extreme edges of partitions (min-1, min, min+1, max-1, max, max+1) where boundary off-by-one errors frequently occur.',
            ],
            [
                'text' => 'What are the essential elements of an effective, high-quality Defect/Bug Report in Jira or GitHub Issues?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Clear descriptive title, environment details (OS, browser, app version), step-by-step reproduction instructions, expected result, actual result, screenshots/video/logs, and severity vs priority.',
            ],
            [
                'text' => 'What is the difference between Regression Testing and Smoke/Sanity Testing in a release cycle?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Smoke testing verifies critical path stability to decide whether a build is ready for deeper testing. Regression testing reruns full test suites to ensure bug fixes or new features haven’t broken existing working functionality.',
            ],
        ],
        2 => [
            [
                'text' => 'What is the Page Object Model (POM) design pattern in test automation frameworks, and how does it reduce test maintenance?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Separates page UI locators and user action methods from test assertions; if a UI selector changes, only the single Page Object class is updated rather than updating dozens of test cases.',
            ],
            [
                'text' => 'Compare Selenium WebDriver and Microsoft Playwright for modern web application test automation.',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Selenium uses HTTP/W3C webdriver protocol with explicit waits. Playwright uses Chrome DevTools Protocol / WebSockets with built-in auto-waiting, native network mocking, tracing, and multi-tab/context isolation out of the box.',
            ],
            [
                'text' => 'What is the difference between Implicit Waits, Explicit Waits, and Fluent Waits in Selenium? Why should you avoid Thread.sleep()?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Implicit sets global timeout for all elements; Explicit waits dynamically for specific ExpectedConditions (visibility, clickability); Fluent adds polling intervals and exception ignores. Thread.sleep causes flaky, unnecessarily slow tests.',
            ],
            [
                'text' => 'How do you locate dynamic web elements reliably using XPath and CSS Selectors when element IDs change on every build?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Prefer data-testid or role attributes; use contains(), starts-with(), text() matches, or hierarchical parent/sibling traversing rather than brittle auto-generated dynamic IDs.',
            ],
            [
                'text' => 'How do you handle testing challenges like alert popups, iframe elements, and multiple browser windows/tabs in automation scripts?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Alerts: switchTo().alert().accept()/dismiss(). Iframes: switchTo().frame(frameElement) and switchTo().defaultContent(). Windows: getWindowHandles() and switchTo().window(handle).',
            ],
        ],
        3 => [
            [
                'text' => 'How do you structure automated API tests using Postman, Newman, or RestAssured (assertions on status, headers, JSON schema)?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Validate HTTP status code, response time SLA, response headers, JSON body fields, and JSON Schema validation (ajv) ensuring payload structure adherence; Newman runs collections in CI.',
            ],
            [
                'text' => 'Explain Performance Testing concepts: Load Testing, Stress Testing, Spike Testing, and Soak (Endurance) Testing using tools like Apache JMeter or k6.',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Load (expected normal peak traffic), Stress (pushing beyond capacity to find breaking point), Spike (sudden extreme surge), Soak (sustained moderate load over 24-48 hours to uncover memory leaks).',
            ],
            [
                'text' => 'How do you integrate automated test suites into a CI/CD pipeline (e.g. GitHub Actions) and generate test execution reports (Allure, HTML)?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Run headless tests on pull request triggers, record video/trace artifacts on failure, generate Allure/JUnit XML test reports, and block merge gates if test pass rate falls below 100%.',
            ],
            [
                'text' => 'What is Mocking versus Stubbing in integration tests, and how do tools like WireMock simulate external third-party API dependencies?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Stub provides canned pre-recorded responses to calls; Mock verifies behavior (asserts that specific method was called with specific arguments). WireMock spins up mock HTTP server returning stubbed JSON and error codes.',
            ],
            [
                'text' => 'What is Mutation Testing, and how does it evaluate whether your test suite actually catches subtle bugs in the source code?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Mutation tools (Stryker, PIT) introduce deliberate bugs ("mutants", e.g. changing > to <, or removing method calls) into code; if your test suite passes, the mutant "survived" (weak test); if tests fail, mutant is "killed" (strong test).',
            ],
        ],
    ],
    'embedded_systems' => [
        1 => [
            [
                'text' => 'Why is the volatile keyword essential in Embedded C, and what happens when the compiler optimizes code accessing hardware memory without it?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Tells compiler that variable value can change unexpectedly outside normal program flow (e.g. hardware register, ISR). Without volatile, aggressive compiler optimizations cache value in CPU register and omit reads.',
            ],
            [
                'text' => 'How do bitwise operators (&, |, ^, ~, <<, >>) manipulate individual bits in microcontroller memory-mapped peripheral registers?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Setting bit: REG |= (1 << n); Clearing bit: REG &= ~(1 << n); Toggling bit: REG ^= (1 << n); Checking bit: if (REG & (1 << n)); bit masking isolates multiple bit fields without modifying neighboring bits.',
            ],
            [
                'text' => 'What is the memory layout of an embedded microcontroller firmware binary (.text, .rodata, .data, .bss, heap, stack)?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => '.text (Flash executable code), .rodata (Flash constants), .data (initialized globals copied to RAM at startup), .bss (uninitialized globals zeroed in RAM), stack (local variables, returns), heap (dynamic memory).',
            ],
            [
                'text' => 'How does an ARM Cortex-M microcontroller boot up from reset? Explain the vector table, stack pointer initialization, and Reset_Handler.',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Reads initial Main Stack Pointer (MSP) value from address 0x00000000; reads Reset_Handler address from 0x00000004; jumps to Reset_Handler which copies .data from Flash to RAM, zeroes .bss, calls SystemInit(), then enters main().',
            ],
            [
                'text' => 'What is the role of General Purpose Input/Output (GPIO) pins, and what are Push-Pull, Open-Drain, Pull-Up, and Pull-Down configurations?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Push-pull actively drives pin High (VCC) and Low (GND). Open-drain only pulls Low (requires external pull-up resistor to go High, used for I2C and shared buses). Pull-up/pull-down bias floating inputs.',
            ],
        ],
        2 => [
            [
                'text' => 'Compare UART, SPI, and I2C serial communication protocols: wire count, master-slave topology, speed, and duplex capability.',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'UART: asynchronous, 2 wires (TX/RX), point-to-point, full duplex. SPI: synchronous, 4 wires (MOSI/MISO/SCK/CS), single master multi-slave, fast (10-50MHz), full duplex. I2C: synchronous, 2 wires (SDA/SCL), multi-master, half duplex, addressable.',
            ],
            [
                'text' => 'How does the I2C protocol handle START/STOP conditions, 7-bit device addressing, and ACK/NACK signaling on an open-drain bus?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'START: SDA transitions high-to-low while SCL is high; STOP: SDA transitions low-to-high while SCL is high. Master transmits 7-bit address + R/W bit; slave pulls SDA low on 9th clock pulse to ACK.',
            ],
            [
                'text' => 'What is the Controller Area Network (CAN bus) protocol, and how does non-destructive bitwise arbitration resolve bus contention?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Differential 2-wire serial bus (CAN_H, CAN_L) used in automotive/industrial; dominant bit (0) overwrites recessive bit (1). Nodes transmit message identifier; node transmitting lower numeric ID wins arbitration without frame loss.',
            ],
            [
                'text' => 'How does Analog-to-Digital Conversion (ADC) work in microcontrollers (e.g. Successive Approximation Register - SAR ADC)?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Sample-and-hold capacitor samples analog voltage; SAR comparator performs binary search comparing input against DAC reference voltage bit-by-bit from MSB to LSB over N clock cycles to produce digital output.',
            ],
            [
                'text' => 'What is Pulse Width Modulation (PWM), and how are timer prescaler, period/ARR, and duty cycle/CCR registers configured to control DC motors or LEDs?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Rapid digital square wave modulating average delivered voltage; Prescaler divides timer clock; Auto-Reload Register (ARR) sets PWM frequency/period; Capture-Compare Register (CCR) sets pulse width / duty cycle percentage.',
            ],
        ],
        3 => [
            [
                'text' => 'What is an Interrupt Service Routine (ISR), and why must ISRs be kept as short and non-blocking as possible?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Hardware preempts main thread to execute ISR on event. ISRs must not call blocking functions, delay loops, or printf/malloc; long ISRs starve lower-priority interrupts and degrade system real-time determinism (defer to task queue/deferred ISR).',
            ],
            [
                'text' => 'What is an RTOS (e.g. FreeRTOS)? How does a preemptive priority-based scheduler select which task to run on each SysTick timer tick?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Real-Time Operating System guarantees deterministic response deadlines. SysTick interrupt invokes scheduler; scheduler selects highest priority task in Ready state; context switches by saving/restoring CPU registers to task stack.',
            ],
            [
                'text' => 'How do Binary Semaphores, Counting Semaphores, and Mutexes differ in FreeRTOS? What is Priority Inversion, and how does Priority Inheritance solve it?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Mutex supports ownership and Priority Inheritance: when high-priority task blocks on mutex held by low-priority task, low-priority task temporarily inherits high priority, preventing medium-priority tasks from preempting it.',
            ],
            [
                'text' => 'What is a Watchdog Timer (WDT), and how does your firmware "kick/feed" the watchdog to recover from deadlocks and system crashes?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Independent countdown hardware timer; main loop periodically resets counter. If firmware enters infinite loop or deadlocks, counter expires (underflows) and triggers hardware MCU reset to restore operation.',
            ],
            [
                'text' => 'What low-power sleep modes (Sleep, Stop, Standby) do modern microcontrollers offer, and how do you wake them via external pin interrupts or RTC alarms?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Sleep turns off CPU core keeping peripherals running. Stop turns off high-speed PLL clocks retaining SRAM. Standby powers down SRAM and core for microamp consumption. Woken by EXTI GPIO interrupt or Real-Time Clock alarm.',
            ],
        ],
    ],
    'cpp' => [
        1 => [
            [
                'text' => 'What is the difference between a pointer and a reference in C++? When should you prefer a reference over a pointer?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'References cannot be null, must be initialized at declaration, and cannot be reseated to refer to another object. Pointers can be null, reassigned, and support pointer arithmetic. Prefer references for function parameters and operator overloads.',
            ],
            [
                'text' => 'Explain Object-Oriented Programming in C++: Encapsulation, Inheritance, Polymorphism, and how Virtual Functions work via vtables and vptrs.',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Classes define member access (public/private/protected). Virtual functions enable runtime polymorphism: compiler creates virtual method table (vtable) per class; object instances hold pointer (_vptr) resolving method at runtime.',
            ],
            [
                'text' => 'Why must a base class destructor always be declared virtual when using polymorphic inheritance in C++?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'If deleting a derived class instance through a base class pointer (Base* b = new Derived(); delete b;), a non-virtual base destructor invokes only Base destructor, leaking Derived class members and causing undefined behavior.',
            ],
            [
                'text' => 'What are the differences between stack allocation and heap allocation (new/delete) in C++ regarding speed, lifetime, and memory management?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Stack: contiguous memory, managed automatically by compiler (LIFO scope), extremely fast pointer increment. Heap: allocated dynamically at runtime via OS memory allocator, requires explicit deallocation, slower, prone to memory leaks and fragmentation.',
            ],
            [
                'text' => 'What is the difference between const, constexpr, and consteval in modern C++ (C++11 through C++20)?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'const specifies read-only variable (evaluated at compile or runtime). constexpr specifies value or function that can be evaluated at compile-time if inputs are known. consteval (C++20) forces function evaluation strictly at compile-time (immediate functions).',
            ],
        ],
        2 => [
            [
                'text' => 'What is Resource Acquisition Is Initialization (RAII) in C++, and how does it guarantee leak-free resource cleanup even when exceptions are thrown?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Binds lifecycle of a resource (heap memory, file handles, sockets, mutex locks) to object lifetime; constructor acquires resource, destructor automatically releases it during stack unwinding on exit or exception.',
            ],
            [
                'text' => 'Compare modern C++ smart pointers: std::unique_ptr, std::shared_ptr, and std::weak_ptr. How does reference counting work in shared_ptr?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'unique_ptr: exclusive ownership, zero overhead. shared_ptr: shared ownership via heap control block tracking strong ref count. weak_ptr: non-owning observer of shared_ptr preventing circular reference memory leaks.',
            ],
            [
                'text' => 'What are Lvalues and Rvalues in C++? Explain Move Semantics and how std::move converts an lvalue to an rvalue reference (T&&).',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Lvalue has identifiable memory address; Rvalue is temporary object. Move semantics transfers ownership of internal resources from temporary without deep copying. std::move is static_cast<T&&>(lvalue).',
            ],
            [
                'text' => 'Explain the Rule of Zero, Rule of Three, and Rule of Five in modern C++ class design.',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Rule of 3 (C++98): if you define destructor, copy constructor, or copy assignment, define all three. Rule of 5 (C++11): add move constructor and move assignment. Rule of 0: use RAII types so compiler auto-generates all 5 correctly.',
            ],
            [
                'text' => 'What is Perfect Forwarding in C++ templates, and how do std::forward and universal references (forwarding references T&&) preserve value categories?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Allows template functions to forward arguments to other functions while preserving whether original argument was lvalue or rvalue. Uses reference collapsing rules and std::forward<T>(arg).',
            ],
        ],
        3 => [
            [
                'text' => 'Compare C++ Standard Library containers: std::vector, std::list, and std::deque. Why is std::vector the default choice for almost all sequential data?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'vector: contiguous memory, cache-friendly CPU prefetching, O(1) random access. list: doubly-linked, cache-unfriendly pointer chasing. deque: chunked pages. Vector’s spatial locality outperforms node-based containers even for insertions.',
            ],
            [
                'text' => 'How do std::map (Red-Black tree) and std::unordered_map (Hash Table) compare in lookup complexity, memory overhead, and ordering guarantees?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'std::map is balanced BST, sorted keys, O(log N) lookup. std::unordered_map is bucketed hash table, unordered, O(1) average lookup (O(N) worst-case bucket collision), requires std::hash.',
            ],
            [
                'text' => 'How do you create threads in C++ using std::thread or std::jthread (C++20)? How do std::mutex and std::lock_guard prevent data races?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'std::jthread joins automatically in destructor; std::mutex ensures mutually exclusive access; std::lock_guard / std::unique_lock use RAII to lock mutex on entry and unlock on scope exit, preventing deadlocks on exceptions.',
            ],
            [
                'text' => 'What is std::atomic in C++, and how do atomic operations achieve thread synchronization without using mutexes (lock-free programming)?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Wraps primitive types with hardware atomic CPU instructions (CMPXCHG); guarantees indivisible read-modify-write without data races; configurable memory orders (memory_order_relaxed, memory_order_acquire/release, seq_cst).',
            ],
            [
                'text' => 'How do you detect memory leaks, buffer overflows, and undefined behavior in C++ applications using AddressSanitizer (ASan) and Valgrind?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Compile with -fsanitize=address,undefined -g; ASan instruments pointers with redzones to catch out-of-bounds access and use-after-free at runtime with low overhead; Valgrind/Memcheck tracks uninitialized memory reads and heap leaks.',
            ],
        ],
    ],
];
