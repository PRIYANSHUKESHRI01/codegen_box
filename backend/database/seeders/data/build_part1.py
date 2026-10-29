import os
import json

def php_quote(s):
    # Single-quoted PHP string: only backslash and single quote need escaping.
    # PHP never interpolates variables like $_FILES or $var in single-quoted strings.
    escaped = s.replace('\\', '\\\\').replace("'", "\\'")
    return f"'{escaped}'"

def to_php_array(data, indent=0):
    spaces = ' ' * indent
    if isinstance(data, dict):
        lines = ['[']
        for k, v in data.items():
            k_repr = php_quote(k)
            lines.append(f"{spaces}    {k_repr} => {to_php_array(v, indent + 4)},")
        lines.append(f"{spaces}]")
        return '\n'.join(lines)
    elif isinstance(data, list):
        lines = ['[']
        for item in data:
            lines.append(f"{spaces}    {to_php_array(item, indent + 4)},")
        lines.append(f"{spaces}]")
        return '\n'.join(lines)
    elif isinstance(data, str):
        return php_quote(data)
    elif isinstance(data, bool):
        return 'true' if data else 'false'
    elif isinstance(data, (int, float)):
        return str(data)
    elif data is None:
        return 'null'
    else:
        return php_quote(str(data))

def write_php_file(filepath, data):
    php_content = "<?php\n\n// Auto-generated curated vault questions for Mellow Vault AI Interview\n\nreturn " + to_php_array(data) + ";\n"
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(php_content)
    print(f"Wrote {filepath}")

# Part 1: backend (php, cms, api_design)
part1_data = {
    # ------------------ PHP ------------------
    # Series 1
    'backend-php-s1-set1': [
        {
            'text': "How does the PHP request-response lifecycle under PHP-FPM manage state between requests compared to persistent runtimes like Node.js or Go? Explain why superglobals like $_SERVER and $_POST are reinitialized per request and how FPM worker processes are pooled.",
            'category': 'technical',
            'duration_seconds': 180,
            'note': "Candidate should contrast PHP's share-nothing architecture (clean state teardown per request via RSHUTDOWN) with persistent runtimes, explain FastCGI protocol message passing between Nginx and PHP-FPM workers, and describe worker recycling (pm.max_requests) to prevent memory leaks."
        },
        {
            'text': "Explain the difference between passing arguments by value versus by reference in PHP. What internal mechanism does PHP use to optimize memory for arrays passed by value?",
            'category': 'technical',
            'duration_seconds': 180,
            'note': "Candidate must discuss copy-on-write (COW), refcount tracking in zval containers, and memory duplication occurring only when mutation happens, contrasting with explicit '&' references."
        },
        {
            'text': "How does PHP's Garbage Collector manage memory? Explain Zval reference counting, refcount increments/decrements, and how cyclic references (objects referencing each other) are detected and cleaned up by the cyclic GC algorithm.",
            'category': 'technical',
            'duration_seconds': 180,
            'note': "Explain that refcounting handles immediate cleanup when refcount reaches 0. For cyclic references (where objects hold references to each other, preventing refcount from hitting 0), PHP buffers potential roots and runs synchronous cycle detection (marking nodes purple, grey, black) to collect unreachable cycles."
        },
        {
            'text': "What are PHP Namespaces, why are they necessary in modern applications, and how do they integrate with Composer's PSR-4 autoloading standard?",
            'category': 'technical',
            'duration_seconds': 180,
            'note': "Look for understanding of name collision prevention, matching fully qualified namespace prefixes to root directory structures, and the autoload_psr4 mapping inside composer.json."
        },
        {
            'text': "How does PHP 8's strict typing work when 'declare(strict_types=1);' is specified? What are union types, nullable types, and intersection types, and how does strict mode catch silent type coercion bugs?",
            'category': 'technical',
            'duration_seconds': 180,
            'note': "Candidate should explain that strict_types=1 is file-scoped and governs function calls originating in that file; without it, PHP coerces string '42' to int 42. Discuss TypeErrors thrown on mismatch, union types ('int|float'), nullable types ('?string'), and intersection types ('Renderable&Countable')."
        }
    ],
    'backend-php-s1-set2': [
        {
            'text': "How does PHP Data Objects (PDO) provide secure database interaction? Why are parameterized prepared statements impervious to standard SQL injection?",
            'category': 'technical',
            'duration_seconds': 180,
            'note': "Candidate must contrast string concatenation with two-phase query execution (prepare separates SQL syntax tree from data values), and mention emulation mode ('ATTR_EMULATE_PREPARES => false')."
        },
        {
            'text': "How does PHP manage session state across stateless HTTP requests? Where is session data stored by default, and how does session locking impact concurrent AJAX requests?",
            'category': 'technical',
            'duration_seconds': 180,
            'note': "Look for PHPSESSID cookie, files in /tmp or session.save_path, file-based exclusive locking on session_start() until session_write_close(), and switching to Redis/Memcached cluster drivers."
        },
        {
            'text': "Explain the difference between Errors and Exceptions in PHP 8. How does the Throwable interface hierarchy structure error handling?",
            'category': 'technical',
            'duration_seconds': 180,
            'note': "Must mention Throwable as the root interface, subclasses Exception and Error (TypeError, ParseError), try-catch-finally control flow, and custom global error/exception handlers."
        },
        {
            'text': "How should file uploads be safely handled in PHP using $_FILES? Detail validation checks required before moving the temporary file to permanent storage.",
            'category': 'technical',
            'duration_seconds': 180,
            'note': "Candidate must cover checking UPLOAD_ERR_OK, validating mime type via finfo_file (not trusting $_FILES['type'] or extension), size limits, sanitizing file names, and using is_uploaded_file() / move_uploaded_file()."
        },
        {
            'text': "What is Composer, what is the exact difference between composer.json and composer.lock, and what is the difference between running 'composer install' and 'composer update'?",
            'category': 'technical',
            'duration_seconds': 180,
            'note': "Should clearly state that composer.lock pins exact commit hashes/versions for team reproducibility, 'install' respects lockfile without recalculating dependency graph, while 'update' recalculates and modifies the lockfile."
        }
    ],
    'backend-php-s1-set3': [
        {
            'text': "What is Zend OPcache, how does it dramatically improve PHP performance, and what trade-offs exist with OPcache preloading introduced in PHP 7.4/8.0?",
            'category': 'architecture',
            'duration_seconds': 180,
            'note': "Candidate must explain bytecode compilation caching in shared memory, skipping lexing/parsing per request, preloading scripts into server memory on startup, and requiring FPM restart on deploy."
        },
        {
            'text': "You discover a high-traffic production PHP script consuming 100% CPU and timing out under database deadlocks. Walk me through your step-by-step diagnostic and remediation process.",
            'category': 'scenario',
            'duration_seconds': 180,
            'note': "Listen for inspecting PHP-FPM slow logs, MySQL SHOW FULL PROCESSLIST and engine innodb status, identifying lock order inversions, adding short timeouts, retries, and row locking analysis."
        },
        {
            'text': "How does PHP handle password hashing securely? Compare password_hash() using modern Argon2id or Bcrypt algorithms against legacy MD5 or SHA-256.",
            'category': 'technical',
            'duration_seconds': 180,
            'note': "Focus on salting automatically, work cost factors, memory-hard hashing resistant to GPU cracking (Argon2id), password_verify(), and password_needs_rehash() for migrating cost factors over time."
        },
        {
            'text': "Explain how you would design a robust background queue worker system in PHP without third-party frameworks. How do you prevent memory leaks in long-running CLI processes?",
            'category': 'architecture',
            'duration_seconds': 180,
            'note': "Must touch upon CLI looping, consuming messages from Redis/RabbitMQ, unsetting variables, manual gc_collect_cycles(), monitoring memory_get_usage(), and recycling workers after N jobs."
        },
        {
            'text': "What are PHP 8 Fibers, how do they differ from threads or generators, and how do they enable cooperative multitasking and asynchronous runtime frameworks like Revolt or Swoole?",
            'category': 'technical',
            'duration_seconds': 180,
            'note': "Candidate should explain stackful coroutines that can pause (suspend) and resume execution without callbacks, enabling non-blocking I/O event loops while preserving synchronous-style call stacks."
        }
    ],

    # Series 2
    'backend-php-s2-set1': [
        {
            'text': "Explain how PHP implements inheritance, traits, and method overriding. How does PHP resolve method name conflicts when multiple traits are used in the same class?",
            'category': 'technical',
            'duration_seconds': 180,
            'note': "Must mention precedence: class methods override trait methods, which override inherited parent methods. Trait conflict resolution via 'insteadof' and 'as' aliasing keywords."
        },
        {
            'text': "What are PHP Magic Methods (such as __get, __set, __call, __invoke, __clone), and what are the architectural and performance implications of relying heavily on them?",
            'category': 'technical',
            'duration_seconds': 180,
            'note': "Candidate should identify runtime method/property interception, difficulty for static analysis tools (PHPStan/IDE auto-complete), and overhead compared to explicitly declared class members."
        },
        {
            'text': "Explain the difference between self, parent, and static keywords in PHP. What is Late Static Binding and how does it function under inheritance?",
            'category': 'technical',
            'duration_seconds': 180,
            'note': "Crucial to explain that self:: binds to the defining class at compile time, whereas static:: resolves to the runtime calling class using late static binding (e.g., in factory methods)."
        },
        {
            'text': "What are PHP Generators and the 'yield' keyword? How do they allow processing massive datasets (like a 5GB CSV file) with minimal memory footprint?",
            'category': 'technical',
            'duration_seconds': 180,
            'note': "Explain Generator implementing Iterator, on-demand lazy value calculation, pausing execution state, yielding single records, and avoiding loading entire arrays into memory."
        },
        {
            'text': "What is the difference between anonymous functions (closures) and arrow functions (fn() => ...) in PHP 7.4/8.0? How does variable scoping differ?",
            'category': 'technical',
            'duration_seconds': 180,
            'note': "Highlight that classic closures require explicit 'use ($var)' binding by value or reference, while arrow functions automatically capture outer scope variables by value with single-expression returns."
        }
    ],
    'backend-php-s2-set2': [
        {
            'text': "How would you build a lightweight Dependency Injection (DI) Container in vanilla PHP using PHP Reflection APIs?",
            'category': 'architecture',
            'duration_seconds': 180,
            'note': "Candidate should talk through ReflectionClass, inspect constructor parameters via ReflectionParameter::getType(), recursively resolving dependencies, and caching instantiations for singletons."
        },
        {
            'text': "What are PSR-7 (HTTP Message) and PSR-15 (HTTP Server Handlers / Middleware)? Explain how an immutable request/response pipeline is structured in modern PHP.",
            'category': 'technical',
            'duration_seconds': 180,
            'note': "Must discuss immutability of ServerRequestInterface (withMethod, withHeader creating new instances), and how PSR-15 RequestHandlerInterface and MiddlewareInterface form onion-layer pipelines."
        },
        {
            'text': "How do you execute multiple HTTP requests in parallel using native PHP cURL multi-handles (curl_multi)? Walk through the event loop mechanics.",
            'category': 'technical',
            'duration_seconds': 180,
            'note': "Listen for curl_multi_init, attaching curl handles with curl_multi_add_handle, non-blocking polling with curl_multi_exec and curl_multi_select, reading results, and closing handles."
        },
        {
            'text': "What is PHP Object Injection and how do unsafe calls to unserialize() lead to Remote Code Execution (RCE)? How should safe data serialization be handled?",
            'category': 'technical',
            'duration_seconds': 180,
            'note': "Must explain gadget chains exploiting magic methods (__wakeup, __destruct), attacker crafting arbitrary class payloads, and using json_encode/json_decode or allowed_classes whitelist."
        },
        {
            'text': "How does PHP's cyclic garbage collector work alongside reference counting? How does it detect and clean up circular references between objects?",
            'category': 'technical',
            'duration_seconds': 180,
            'note': "Should explain that refcount > 0 in circular references prevents immediate deallocation, triggering the Concurrent Cycle Collection algorithm that identifies isolated subgraphs and frees memory."
        }
    ],
    'backend-php-s2-set3': [
        {
            'text': "How do you tune a PHP-FPM pool for a dedicated 16-core, 32GB RAM web server handling sudden traffic surges? What do pm, pm.max_children, and pm.max_requests control?",
            'category': 'architecture',
            'duration_seconds': 180,
            'note': "Look for calculating max_children based on (Available RAM - OS/DB overhead) / Average PHP process memory (e.g. 50MB), using dynamic vs static pm, and max_requests preventing memory leaks."
        },
        {
            'text': "A legacy enterprise PHP application throws intermittent 'MySQL server has gone away' and 'Packets out of order' errors under high load. How do you isolate and resolve this?",
            'category': 'scenario',
            'duration_seconds': 180,
            'note': "Should explore wait_timeout, max_allowed_packet, long-running batch jobs keeping connections idle, connection pooling, and reconnect logic with exponential backoff."
        },
        {
            'text': "How would you design a zero-downtime deployment pipeline for a high-traffic PHP application using symlinks and atomic directory switching without breaking in-flight requests?",
            'category': 'architecture',
            'duration_seconds': 180,
            'note': "Candidate must cover releases directories, current symlink pointing, realpath cache clear (clearstatcache), OPcache reset via HTTP/FCGI command, and keeping old releases active for running workers."
        },
        {
            'text': "Explain the difference between optimistic locking and pessimistic locking in database records using PDO, and give an example of when each should be applied in an e-commerce context.",
            'category': 'technical',
            'duration_seconds': 180,
            'note': "Pessimistic locking (SELECT FOR UPDATE) holds exclusive lock during checkout inventory deduction; optimistic locking (version column in WHERE clause) handles low-conflict user profile updates."
        },
        {
            'text': "How do you implement distributed tracing in a PHP backend interacting with multiple microservices? What headers and telemetry formats are standard?",
            'category': 'architecture',
            'duration_seconds': 180,
            'note': "Listen for W3C Trace Context (traceparent, tracestate), OpenTelemetry PHP SDK, propagating span IDs across downstream HTTP/queue calls, and exporting to Jaeger/Zipkin."
        }
    ],

    # Series 3
    'backend-php-s3-set1': [
        {
            'text': "What are PHP Attributes (introduced in PHP 8.0), how do they improve upon legacy DocBlock annotations, and how are they reflected and parsed at runtime?",
            'category': 'technical',
            'duration_seconds': 180,
            'note': "Covers native language tokens, compile-time syntax validation, ReflectionClass::getAttributes(), instantiated via newInstance(), avoiding regex parsing of docblock strings."
        },
        {
            'text': "Explain the concept of type juggling in PHP and walk through how loose comparisons (==) historically enabled authentication bypasses. How do strict comparisons (===) fix this?",
            'category': 'technical',
            'duration_seconds': 180,
            'note': "Explain string-to-number casting (e.g. '0e123' == '0e456' treated as scientific notation zero), hash comparison bugs, strict type equality checking both type and value, and hash_equals() timing attack prevention."
        },
        {
            'text': "What are WeakMaps and WeakReferences in PHP 8.0? How do they assist in implementing object caches without preventing garbage collection?",
            'category': 'technical',
            'duration_seconds': 180,
            'note': "Candidate should explain that standard array key/value references increment refcount, preventing GC, whereas WeakMap keys hold weak references allowing unreferenced objects to be destroyed naturally."
        },
        {
            'text': "How does PHP 8.2+ handle Readonly Classes and Disjunctive Normal Form (DNF) types? How do these improve domain-driven design and immutability?",
            'category': 'technical',
            'duration_seconds': 180,
            'note': "Readonly classes enforce immutable value objects where all properties must be typed and initialized once; DNF types allow combining union and intersection types like (A&B)|C."
        },
        {
            'text': "Describe the difference between synchronous execution in standard PHP and non-blocking asynchronous event loops provided by frameworks like ReactPHP or Amp.",
            'category': 'technical',
            'duration_seconds': 180,
            'note': "Candidate should articulate single-threaded event loop, stream_select / epoll under the hood, non-blocking socket reads, event listeners, and cooperative task scheduling."
        }
    ],
    'backend-php-s3-set2': [
        {
            'text': "How would you design a distributed rate limiter in PHP across a cluster of 50 web servers with zero database bottlenecks?",
            'category': 'architecture',
            'duration_seconds': 180,
            'note': "Strong answers mention Redis with atomic Lua scripts implementing sliding window log or token bucket algorithm, avoiding race conditions and minimizing round-trips."
        },
        {
            'text': "You need to export 10 million user transactions into an encrypted streaming ZIP archive on-the-fly without running out of PHP memory or hitting execution timeouts. How do you design this?",
            'category': 'architecture',
            'duration_seconds': 180,
            'note': "Look for PDO unbuffered queries (cursor-based), chunking through generators, streaming directly to php://output using streaming zip libraries (ZipStream-PHP), and flushing output buffers."
        },
        {
            'text': "Describe how you would implement resilient Webhook delivery from a PHP backend to third-party customer endpoints, including signing, retries, and failure containment.",
            'category': 'technical',
            'duration_seconds': 180,
            'note': "Key elements: HMAC-SHA256 signature with shared secret in header, async queue dispatch, exponential backoff with jitter, dead-letter queue, and disabling failing endpoints after threshold."
        },
        {
            'text': "How do you detect and fix memory fragmentation or native memory leaks in a PHP extension or CLI daemon that standard memory_get_usage() fails to report?",
            'category': 'scenario',
            'duration_seconds': 180,
            'note': "Candidate should differentiate Zend engine memory allocator (emalloc/efree) from system malloc, inspect OS process RSS memory (htop, /proc/$pid/status), and use Valgrind or GDB."
        },
        {
            'text': "Walk through how you would architect a multi-tenant PHP application where tenants require strict data isolation, custom domains, and dynamic database routing.",
            'category': 'architecture',
            'duration_seconds': 180,
            'note': "Must discuss tenant resolution via hostname/subdomain, database-per-tenant vs shared database with tenant_id scoping and PostgreSQL Row-Level Security (RLS), and dynamic PDO connection switching."
        }
    ],
    'backend-php-s3-set3': [
        {
            'text': "Architect an enterprise-scale backend handling 50,000 requests per second built on PHP. Detail the caching tiers, database clustering, message brokers, and failure mitigation strategies.",
            'category': 'architecture',
            'duration_seconds': 180,
            'note': "Comprehensive overview covering CDN edge caching, load balancers with health checks, PHP-FPM clusters with OPcache preloading, Redis caching layer, Kafka event bus, MySQL read replicas with ProxySQL, and circuit breakers."
        },
        {
            'text': "A critical vulnerability is disclosed where attackers can exploit PHP's open_basedir and disable_functions restrictions. How does an attacker bypass these, and how do you harden Linux/PHP environments?",
            'category': 'technical',
            'duration_seconds': 180,
            'note': "Discuss shared libraries LD_PRELOAD bypass, putenv/mail exploits, hardening via chroot/containers (Docker/cgroups), running PHP-FPM under dedicated unprivileged users with read-only root filesystems."
        },
        {
            'text': "Explain the trade-offs of using RoadRunner or FrankenPHP (Go-based application servers running PHP worker pools in memory) versus traditional Nginx + PHP-FPM.",
            'category': 'technical',
            'duration_seconds': 180,
            'note': "Candidate should analyze keeping application state in memory (eliminating framework bootstrap per request), speed gains (5x-10x), risks of static variable leakage, state pollution, and requiring clean reset listeners."
        },
        {
            'text': "During an active black swan traffic spike, your primary database master CPU hits 100% and connection queues fill up. Describe your immediate triage and graceful degradation strategy.",
            'category': 'scenario',
            'duration_seconds': 180,
            'note': "Immediate actions: shedding non-critical load (disabling recommendations/analytics), enabling aggressive stale-while-revalidate caching, queueing writes, activating circuit breakers, and rate limiting."
        },
        {
            'text': "How do you structure automated CI/CD quality gates for a PHP repository of 500k lines of code with 50 contributing engineers? What tooling ensures zero regressions?",
            'category': 'architecture',
            'duration_seconds': 180,
            'note': "Must include static analysis at highest level (PHPStan / Psalm level 8+), coding standards (PHP-CS-Fixer), unit and integration testing with parallel PHPUnit / Pest, architectural tests (Pest Arch), and mutation testing (Infection)."
        }
    ],

    # ------------------ CMS (WordPress) ------------------
    # Series 1
    'backend-cms-s1-set1': [
        {
            'text': "Explain the WordPress Template Hierarchy. What template file takes precedence when rendering a single post of a custom post type called 'event'?",
            'category': 'technical',
            'duration_seconds': 180,
            'note': "Candidate should list hierarchy order: single-event-{slug}.php -> single-event.php -> single.php -> singular.php -> index.php, showing firm grasp of template routing."
        },
        {
            'text': "What is 'The Loop' in WordPress, and how do functions like have_posts(), the_post(), and the_content() operate within it?",
            'category': 'technical',
            'duration_seconds': 180,
            'note': "Explain iterating through the global $wp_query array, advancing the internal post pointer, setting up the global $post object, and population of template tags."
        },
        {
            'text': "What is the architectural difference between an Action Hook and a Filter Hook in WordPress? Give a real-world code example of each.",
            'category': 'technical',
            'duration_seconds': 180,
            'note': "Actions (do_action, add_action) execute code at specific lifecycle moments without returning data; Filters (apply_filters, add_filter) receive data, modify it, and must return the modified value."
        },
        {
            'text': "Why should theme developers always use child themes instead of directly modifying a parent theme? How does a child theme enqueue its styles properly?",
            'category': 'technical',
            'duration_seconds': 180,
            'note': "Focus on preserving custom code across parent theme updates, declaring Template in style.css, and using wp_enqueue_scripts with wp_enqueue_style and get_stylesheet_uri()."
        },
        {
            'text': "How does WordPress enqueue scripts and styles using wp_enqueue_script() and wp_enqueue_style()? Why is hardcoding <script> tags in header.php considered bad practice?",
            'category': 'technical',
            'duration_seconds': 180,
            'note': "Explain dependency management (e.g. ['jquery']), versioning for cache busting, conditional loading in footer vs header, preventing duplicate inclusions across plugins, and clean hook timing."
        }
    ],
    'backend-cms-s1-set2': [
        {
            'text': "How do you register a Custom Post Type (CPT) and a Custom Taxonomy in WordPress using register_post_type() and register_taxonomy()? What hook must be used?",
            'category': 'technical',
            'duration_seconds': 180,
            'note': "Must state the 'init' hook, parameters like public, has_archive, supports, show_in_rest (for Gutenberg editor), rewrite rules, and registering taxonomies before post types."
        },
        {
            'text': "Explain how WP_Query works. Why should you avoid using query_posts(), and when should you use pre_get_posts instead of creating a secondary WP_Query instance?",
            'category': 'technical',
            'duration_seconds': 180,
            'note': "query_posts overwrites main loop destructively; pre_get_posts alters query before SQL executes, saving an extra database query; WP_Query creates safe isolated secondary loops (with wp_reset_postdata)."
        },
        {
            'text': "What is the WordPress Transients API? How does it differ from standard options, and how does it utilize object caching when Redis or Memcached is installed?",
            'category': 'technical',
            'duration_seconds': 180,
            'note': "Transients store cached data with an expiration time. In standard setups they write to wp_options with timeout rows; with persistent object cache plugins they store directly in memory, bypassing MySQL."
        },
        {
            'text': "How do Nonces work in WordPress to prevent Cross-Site Request Forgery (CSRF)? Detail how to generate, output, and verify a nonce in a form or AJAX handler.",
            'category': 'technical',
            'duration_seconds': 180,
            'note': "Covers wp_create_nonce() / wp_nonce_field(), checking wp_verify_nonce() / check_ajax_referer(), unique token generated per user/action/time window (12-24h), preventing unauthorized actions."
        },
        {
            'text': "What is the difference between sanitizing and escaping data in WordPress? List at least three sanitization functions and three escaping functions provided by core.",
            'category': 'technical',
            'duration_seconds': 180,
            'note': "Sanitize on input (sanitize_text_field, sanitize_email, wp_kses_post); escape on output immediately before rendering (esc_html, esc_attr, esc_url, esc_js) to prevent stored and reflected XSS."
        }
    ],
    'backend-cms-s1-set3': [
        {
            'text': "What causes the 'headers already sent' error in WordPress, how do you debug its exact source, and how does it relate to PHP output buffering and whitespace?",
            'category': 'scenario',
            'duration_seconds': 180,
            'note': "Explain HTTP header transmission before cookie/redirect execution, whitespace or echo before <?php or after ?>, checking error stack trace for file and line number, and ob_start()."
        },
        {
            'text': "How do you securely expose and authenticate custom REST API endpoints using register_rest_route()? Why is the 'permission_callback' argument mandatory?",
            'category': 'technical',
            'duration_seconds': 180,
            'note': "Discuss namespace/route structure, methods (WP_REST_Server::READABLE/CREATABLE), and permission_callback returning boolean/WP_Error (e.g. current_user_can('edit_posts')) to prevent unauthorized access."
        },
        {
            'text': "A WordPress site with 50,000 posts takes 10 seconds to load the homepage. How do you identify the slow queries, and how do you optimize postmeta querying?",
            'category': 'scenario',
            'duration_seconds': 180,
            'note': "Use Query Monitor plugin, inspect slow queries in MySQL slow log, eliminate expensive meta_query with non-indexed keys, add persistent object caching, and use custom tables for high-cardinality data."
        },
        {
            'text': "Explain the difference between Full-Site Editing (FSE) block themes using theme.json and classic PHP-based WordPress themes. What advantages does theme.json offer?",
            'category': 'technical',
            'duration_seconds': 180,
            'note': "FSE uses HTML block templates and theme.json for global settings (palette, typography, layout) rendered by Gutenberg, eliminating boilerplate PHP and enqueuing only CSS styles needed on-demand."
        },
        {
            'text': "How should database schema migrations be handled in a custom WordPress plugin using dbDelta()? What strict syntax rules does dbDelta enforce?",
            'category': 'technical',
            'duration_seconds': 180,
            'note': "Must explain primary key on own line, two spaces after PRIMARY KEY, KEY keyword for indexes, storing plugin version in wp_options, and running migration on plugin activation or version update."
        }
    ],

    # Series 2
    'backend-cms-s2-set1': [
        {
            'text': "How does the WordPress database schema organize post relationships? Explain the roles of wp_posts, wp_postmeta, wp_terms, wp_term_taxonomy, and wp_term_relationships.",
            'category': 'technical',
            'duration_seconds': 180,
            'note': "Candidate should diagram how taxonomies and tags connect to posts via term_relationships, and explain the key-value storage model of postmeta with its single post_id foreign key."
        },
        {
            'text': "What is the autoload column in the wp_options table, why does an overgrown autoloaded dataset degrade server performance, and how do you diagnose and fix it?",
            'category': 'technical',
            'duration_seconds': 180,
            'note': "All options with autoload='yes' load into memory on EVERY request. Querying SUM(LENGTH(option_value)) where autoload='yes', identifying abandoned plugin transients, and setting autoload='no'."
        },
        {
            'text': "How does WordPress manage user roles and capabilities? How do you create a custom capability and check if the current user possesses it?",
            'category': 'technical',
            'duration_seconds': 180,
            'note': "Explain WP_Roles class, adding capabilities to roles via get_role('editor')->add_cap(), and runtime authorization check current_user_can('custom_cap') before executing administrative actions."
        },
        {
            'text': "What are Shortcodes in WordPress? Explain how add_shortcode() processes attributes and enclosing content, and why the callback function must return content rather than echoing it.",
            'category': 'technical',
            'duration_seconds': 180,
            'note': "Shortcodes intercept tokens in content, shortcode_atts() handles default parameters, output must be returned so WordPress can position it correctly inside the filtered post content flow."
        },
        {
            'text': "How do you manage WordPress internationalization (i18n) and localization (l10n) in plugins? Explain the purpose of text domains, __(), _e(), and load_plugin_textdomain().",
            'category': 'technical',
            'duration_seconds': 180,
            'note': "Text domain uniquely identifies translation strings, __() returns translated string, _e() echoes it, _n() handles plurals, and POT/PO/MO files are loaded via load_plugin_textdomain on 'plugins_loaded'."
        }
    ],
    'backend-cms-s2-set2': [
        {
            'text': "Walk through creating a custom dynamic Gutenberg block in WordPress. Explain the role of block.json, edit.js, save.js, and server-side rendering with render.php.",
            'category': 'architecture',
            'duration_seconds': 180,
            'note': "block.json registers metadata and attributes, edit() provides React UI in Gutenberg editor, save() returns null for dynamic blocks, and render.php (or render_callback) executes PHP at request time."
        },
        {
            'text': "How does WP-Cron work under the hood? Why is it considered pseudo-cron, and why should high-traffic production websites disable it in favor of system crontab?",
            'category': 'technical',
            'duration_seconds': 180,
            'note': "WP-Cron only fires when a visitor loads a page (spawning spawn_cron HTTP request). Sites with irregular traffic miss scheduled posts; high-traffic sites spawn excessive cron requests. Fix: DISABLE_WP_CRON and Linux crontab."
        },
        {
            'text': "How do you customize WooCommerce checkout flows and add custom order metadata? Detail the action hooks involved in order placement and payment processing.",
            'category': 'technical',
            'duration_seconds': 180,
            'note': "Covers woocommerce_checkout_fields filter, woocommerce_checkout_create_order action hook for saving metadata to WC_Order, and woocommerce_payment_complete for triggering post-purchase workflows."
        },
        {
            'text': "Explain how page caching plugins (like WP Rocket, W3 Total Cache, or server-level Nginx FastCGI cache) work with WordPress. How do you handle cache invalidation on post publish?",
            'category': 'architecture',
            'duration_seconds': 180,
            'note': "Stores fully rendered HTML responses to bypass PHP and MySQL entirely for anonymous visitors; hooks into 'save_post' or 'clean_post_cache' to purge the specific post URL, archive, and homepage caches."
        },
        {
            'text': "How do you securely handle third-party webhook callbacks in a custom WordPress plugin without relying on standard cookies or session nonces?",
            'category': 'technical',
            'duration_seconds': 180,
            'note': "Expose endpoint via REST API with permission_callback => '__return_true', verify HMAC signature in request header (e.g., Stripe-Signature) against shared secret, and return 200 OK fast before async processing."
        }
    ],
    'backend-cms-s2-set3': [
        {
            'text': "You inherit a hacked WordPress site redirecting mobile traffic to malicious domains. Walk through your step-by-step incident response, malware cleanup, and hardening procedure.",
            'category': 'scenario',
            'duration_seconds': 180,
            'note': "Steps: take maintenance mode & full backup, inspect wp-config.php and .htaccess for base64 injection, replace core files and official plugins with fresh copies from wordpress.org, audit admin users, rotate all salts/passwords."
        },
        {
            'text': "How do you architect a Headless WordPress setup using Next.js on the frontend and WordPress as a decoupled CMS? What are the caching and previewing trade-offs?",
            'category': 'architecture',
            'duration_seconds': 180,
            'note': "Uses WP REST API or WPGraphQL, Next.js Incremental Static Regeneration (ISR), on-demand revalidation webhooks on save_post, draft preview mode with preview tokens, and CORS configuration."
        },
        {
            'text': "A WooCommerce client is experiencing cart race conditions where customers purchase out-of-stock items during flash sales. How do you resolve this at the database and application layer?",
            'category': 'architecture',
            'duration_seconds': 180,
            'note': "Implement stock reservation on checkout initiation, Redis distributed locks on inventory decrement, database transactions with SELECT FOR UPDATE, and disabling caching on cart/checkout and AJAX cart fragments."
        },
        {
            'text': "How would you migrate a standalone WordPress site into a WordPress Multisite Network with subdomain mapping? What database and server changes are required?",
            'category': 'architecture',
            'duration_seconds': 180,
            'note': "Enable WP_ALLOW_MULTISITE in wp-config, run Network Setup, configure wildcard DNS (*.domain.com), setup wp-content/uploads/sites/ directory permissions, and update .htaccess rewrite rules."
        },
        {
            'text': "How do you offload WordPress media uploads (wp-content/uploads) to an Amazon S3 bucket with CloudFront CDN distribution while keeping admin workflows transparent?",
            'category': 'architecture',
            'duration_seconds': 180,
            'note': "Filter wp_handle_upload and wp_generate_attachment_metadata, upload file to S3 via AWS SDK, rewrite image URLs to CDN endpoint, remove local copies or keep thumbnails, and handle media library delete hooks."
        }
    ],

    # Series 3
    'backend-cms-s3-set1': [
        {
            'text': "Explain the security purpose of the security salts and keys in wp-config.php (AUTH_KEY, SECURE_AUTH_KEY, LOGGED_IN_KEY, NONCE_KEY). What happens when they are regenerated?",
            'category': 'technical',
            'duration_seconds': 180,
            'note': "Salts provide cryptographic entropy for password hashing and authentication cookies. Regenerating them instantly invalidates all active user sessions and cookies across the entire site, logging everyone out."
        },
        {
            'text': "How does WordPress handle rewrite rules internally ($wp_rewrite)? Why is calling flush_rewrite_rules() on every page load catastrophic for performance?",
            'category': 'technical',
            'duration_seconds': 180,
            'note': "Rewrite rules map friendly URLs to index.php?var=val. Flushing rewrite rules regenerates regex tables and writes to .htaccess / wp_options; it must ONLY be called on plugin/theme activation or deactivation."
        },
        {
            'text': "What are the security implications of allow_url_fopen and allow_url_include in PHP when running WordPress plugins, and how do they relate to Local/Remote File Inclusion (LFI/RFI)?",
            'category': 'technical',
            'duration_seconds': 180,
            'note': "If plugins unsafely pass user input to include/require, allow_url_include allows executing external malicious scripts (RFI); hardening requires disabling both in php.ini and validating template paths."
        },
        {
            'text': "How do you create an automated unit test suite for a custom WordPress plugin using PHPUnit and the WordPress Core Integration Testing Library?",
            'category': 'technical',
            'duration_seconds': 180,
            'note': "Utilizes WP_UnitTestCase, separate test database provisioned by install-wp-tests.sh, rollback of database transactions after each test, factory helpers ($this->factory->post->create()), and mocking HTTP requests."
        },
        {
            'text': "What are the architectural trade-offs of using ACF (Advanced Custom Fields) vs native WordPress Gutenberg custom block attributes for structured content?",
            'category': 'technical',
            'duration_seconds': 180,
            'note': "ACF stores data in wp_postmeta (leading to bloated meta tables on high volume); Gutenberg block attributes store data directly in post_content as JSON comments, reducing DB joins but complicating SQL filtering."
        }
    ],
    'backend-cms-s3-set2': [
        {
            'text': "How do you architect a high-availability WordPress deployment on AWS spanning multiple Availability Zones? Detail database, shared storage, and caching layers.",
            'category': 'architecture',
            'duration_seconds': 180,
            'note': "Architecture includes ALB load balancer, stateless EC2/Fargate instances running Nginx+PHP-FPM, AWS Aurora MySQL Multi-AZ cluster, Amazon EFS or S3 for wp-content/uploads, and ElastiCache Redis for object caching."
        },
        {
            'text': "You notice that the wp_options table has grown to 500MB and simple queries are locking the database. Walk through your strategy to analyze, clean, and re-index it without site downtime.",
            'category': 'scenario',
            'duration_seconds': 180,
            'note': "Identify oversized option_values (e.g. transients, bloated log entries), batch delete expired transients via WP-CLI, alter autoload flags, optimize table with pt-online-schema-change or OPTIMIZE TABLE during low traffic."
        },
        {
            'text': "How would you build an automated CI/CD deployment pipeline for WordPress that manages database updates, Composer dependencies, theme asset compilation, and zero-downtime release?",
            'category': 'architecture',
            'duration_seconds': 180,
            'note': "GitHub Actions compiles assets (npm run build) and installs production composer packages, runs PHPStan/PHPUnit, deploys via SSH/rsync to atomic releases folder, runs wp core update-db, and purges CDN cache."
        },
        {
            'text': "Explain how SQL injection vulnerabilities commonly arise in custom WordPress plugins through wpdb::prepare() misusage, and how to audit legacy code for vulnerabilities.",
            'category': 'technical',
            'duration_seconds': 180,
            'note': "Misuse occurs when developers interpolate variables directly into SQL string before passing to wpdb::prepare(), or concatenate table names/identifiers which cannot be parameterized. Use PHP_CodeSniffer with WordPress-VIP rules."
        },
        {
            'text': "How do you handle real-time content synchronization between a staging WordPress environment and a production environment without overwriting new customer orders or comments?",
            'category': 'architecture',
            'duration_seconds': 180,
            'note': "Separate content tables (posts, postmeta) from transactional tables (orders, order_items, users, comments), use selective database merge scripts, or push content via REST API / WP Migrate DB Pro with exclude rules."
        }
    ],
    'backend-cms-s3-set3': [
        {
            'text': "Architect a publishing platform built on WordPress serving 100 million pageviews per month with 10,000 concurrent readers during breaking news. What is your full infrastructure design?",
            'category': 'architecture',
            'duration_seconds': 180,
            'note': "Comprehensive design: Cloudflare Enterprise CDN with aggressive edge caching and Cache-Control headers, Nginx FastCGI microcaching, Redis object cache cluster, read replicas for editorial staff, and decoupled search (Elasticsearch)."
        },
        {
            'text': "How do you implement Content Security Policy (CSP), Subresource Integrity (SRI), and HTTP Security Headers in an enterprise WordPress environment where plugins dynamically inject scripts?",
            'category': 'technical',
            'duration_seconds': 180,
            'note': "Discuss generating CSP nonces on the fly in PHP, injecting nonces into wp_enqueue_script via wp_script_add_data, setting headers via Nginx or send_headers action, and using CSP reporting endpoints."
        },
        {
            'text': "A third-party plugin vulnerability allows unauthenticated attackers to execute arbitrary PHP files uploaded to wp-content/uploads. How do you configure server rules to permanently neutralize this vector?",
            'category': 'technical',
            'duration_seconds': 180,
            'note': "Configure Nginx / Apache web server rules specifically denying execution of .php files inside /wp-content/uploads/ directory (e.g. 'location ~* /uploads/.*\.php$ { deny all; }'), enforcing static-only serving."
        },
        {
            'text': "Explain the database sharding strategies available for hyper-scale WordPress installations using solutions like Automattic's HyperDB or LudicrousDB.",
            'category': 'architecture',
            'duration_seconds': 180,
            'note': "HyperDB intercepts wpdb and routes queries: splits reads and writes between master and replicas, partitions specific datasets (e.g. blog_id in multisite or post_id ranges) across different database servers."
        },
        {
            'text': "How do you integrate enterprise federated Single Sign-On (SSO) with SAML 2.0 or OpenID Connect (OIDC) into WordPress, ensuring user role mapping and automated provisioning?",
            'category': 'architecture',
            'duration_seconds': 180,
            'note': "Intercept login via template_redirect or authenticate filter, redirect to identity provider (Okta/Azure AD), validate signed SAML assertion/JWT, map IDP claims to WP roles, and auto-provision user accounts."
        }
    ],

    # ------------------ API DESIGN ------------------
    # Series 1
    'backend-api_design-s1-set1': [
        {
            'text': "Explain the core HTTP methods (GET, POST, PUT, PATCH, DELETE). Which methods are defined as safe, and which are defined as idempotent according to RFC specifications?",
            'category': 'technical',
            'duration_seconds': 180,
            'note': "Candidate must define safe (GET, HEAD: no server state mutation) and idempotent (GET, PUT, DELETE: multiple identical requests have same outcome as single request), and explain PATCH as non-idempotent partial update."
        },
        {
            'text': "Walk through standard HTTP status code ranges (2xx, 3xx, 4xx, 5xx). What is the exact semantic difference between 401 Unauthorized and 403 Forbidden?",
            'category': 'technical',
            'duration_seconds': 180,
            'note': "401 means unauthenticated (missing or invalid credentials; client should authenticate); 403 means authenticated but unauthorized (identity known, but lacking permission to access resource)."
        },
        {
            'text': "What are the core constraints of REST (Representational State Transfer) architecture as outlined by Roy Fielding? Explain why statelessness is critical for horizontal scaling.",
            'category': 'technical',
            'duration_seconds': 180,
            'note': "Constraints: Client-Server, Stateless, Cacheable, Layered System, Uniform Interface, Code on Demand (optional). Statelessness means servers retain no client session context, allowing any server to handle any request."
        },
        {
            'text': "When designing RESTful URIs, how should plural nouns, resource hierarchies, and actions be structured? Why should verbs be avoided in URI endpoints?",
            'category': 'technical',
            'duration_seconds': 180,
            'note': "URIs model resources, not operations: e.g. GET /users/123/orders instead of /getUserOrders?id=123. Actions are communicated via HTTP verbs (POST, DELETE) or sub-resource states (POST /orders/123/cancellations)."
        },
        {
            'text': "What is HTTP Content Negotiation, and how do the Accept and Content-Type headers coordinate data formats between client and server?",
            'category': 'technical',
            'duration_seconds': 180,
            'note': "Content-Type specifies the MIME type of the payload being sent (e.g. application/json); Accept specifies what response formats the client can process. Server returns 406 Not Acceptable or 415 Unsupported Media Type if unmatched."
        }
    ],
    'backend-api_design-s1-set2': [
        {
            'text': "Compare offset-based pagination (LIMIT/OFFSET) with cursor-based pagination (keyset pagination). Why does cursor-based pagination scale better for large datasets and prevent duplicate items?",
            'category': 'technical',
            'duration_seconds': 180,
            'note': "Offset pagination scans and discards N records (slow O(N) at high offsets) and skips/duplicates rows when new records are inserted concurrently; cursor pagination uses indexed WHERE id > cursor LIMIT K (fast O(1))."
        },
        {
            'text': "How should filtering, sorting, and sparse fieldsets be designed in REST query parameters? Provide clean, idiomatic URL design examples.",
            'category': 'technical',
            'duration_seconds': 180,
            'note': "Examples: Filtering (?status=active&created_after=2026-01-01), Sorting (?sort=-created_at,name where minus indicates DESC), and Sparse Fieldsets (?fields=id,title,price) to minimize network payload."
        },
        {
            'text': "What is the RFC 7807 (Problem Details for HTTP APIs) specification, and why is standardizing error responses essential for public-facing developer APIs?",
            'category': 'technical',
            'duration_seconds': 180,
            'note': "RFC 7807 defines standard JSON object keys: type (URI), title (summary), status (HTTP code), detail (specific human explanation), and instance (URI). Prevents inconsistent error shapes across endpoints."
        },
        {
            'text': "Compare API authentication mechanisms: API Keys, HTTP Basic Auth, Bearer Tokens (JWT), and OAuth 2.0. Where should credentials be transmitted in HTTP requests?",
            'category': 'technical',
            'duration_seconds': 180,
            'note': "Always in the Authorization header (e.g. 'Bearer <token>'), never in query parameters (preventing log leakage). Detail stateless JWT claims vs delegated authorization in OAuth 2.0."
        },
        {
            'text': "How should an API handle input validation errors? Walk through the status code and structure of returning multiple validation failures for a complex POST request.",
            'category': 'technical',
            'duration_seconds': 180,
            'note': "Return 422 Unprocessable Entity (or 400 Bad Request) with structured array detailing field names, rejected values, and validation error messages (e.g. 'errors': [{'field': 'email', 'message': 'Invalid format'}])."
        }
    ],
    'backend-api_design-s1-set3': [
        {
            'text': "What are the common strategies for API versioning (URI path, custom request headers, Accept header content negotiation)? Detail the trade-offs of each approach.",
            'category': 'architecture',
            'duration_seconds': 180,
            'note': "URI path (/v1/users) is clear and cache-friendly but mixes routing with resources; Headers (X-API-Version or Accept: application/vnd.company.v1+json) maintain clean URIs but are harder to test via browser and proxy."
        },
        {
            'text': "Explain the difference between Token Bucket and Leaky Bucket algorithms for API rate limiting. What HTTP headers communicate rate limit status to clients?",
            'category': 'technical',
            'duration_seconds': 180,
            'note': "Token Bucket allows bursts up to bucket capacity; Leaky Bucket smooths traffic at constant output rate. Headers: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, and 429 Too Many Requests with Retry-After."
        },
        {
            'text': "Why are Idempotency Keys critical for payment and order creation APIs? How does a backend server process an incoming 'Idempotency-Key' header?",
            'category': 'architecture',
            'duration_seconds': 180,
            'note': "Prevents duplicate charges on network retries. Backend checks Redis/DB for the key: if completed, returns cached response immediately; if in-flight, rejects concurrent attempt (409/locked); if new, executes transaction and caches result."
        },
        {
            'text': "What is CORS (Cross-Origin Resource Sharing)? Explain what triggers a preflight OPTIONS request and how headers like Access-Control-Allow-Origin function.",
            'category': 'technical',
            'duration_seconds': 180,
            'note': "Triggered by non-simple methods (PUT, DELETE, PATCH) or custom headers (Authorization). Browser sends OPTIONS preflight to verify server allows origin, methods, and headers before sending actual request."
        },
        {
            'text': "How does HTTP caching work in REST APIs using Cache-Control, ETag (Entity Tag), and conditional requests with If-None-Match? What is the 304 Not Modified status?",
            'category': 'technical',
            'duration_seconds': 180,
            'note': "Server returns ETag hash of resource. On next request, client sends If-None-Match: <etag>. If unchanged, server returns 304 Not Modified with empty body, saving significant bandwidth and compute."
        }
    ],

    # Series 2
    'backend-api_design-s2-set1': [
        {
            'text': "What is HATEOAS (Hypermedia As The Engine Of Application State) and Richardson Maturity Model Level 3? Why is it rarely fully adopted in commercial REST APIs?",
            'category': 'technical',
            'duration_seconds': 180,
            'note': "HATEOAS provides dynamic hypermedia links (_links) in payloads guiding client transitions. Rarely used due to client-side parsing complexity, payload bloat, and modern mobile app UI decoupling."
        },
        {
            'text': "Explain how HTTP/2 multiplexing and binary framing impact API design compared to HTTP/1.1. Do techniques like sprite sheets and resource bundling still make sense?",
            'category': 'technical',
            'duration_seconds': 180,
            'note': "HTTP/2 allows interleaving hundreds of concurrent requests over a single TCP connection, eliminating head-of-line blocking at HTTP layer. Bundling/domain sharding are largely obsolete anti-patterns in HTTP/2."
        },
        {
            'text': "How should an API handle long-running asynchronous operations (such as generating a massive export or training a model)? Detail the status codes and polling pattern.",
            'category': 'architecture',
            'duration_seconds': 180,
            'note': "Return 202 Accepted with a Location header pointing to status polling endpoint (e.g. /tasks/xyz). Polling returns 200 with task status ('pending', 'running') until finished, then redirects (303) to completed asset."
        },
        {
            'text': "What is OpenAPI Specification (OAS 3.0 / Swagger), and what are the advantages of a 'Design-First' (Contract-First) API development approach over 'Code-First'?",
            'category': 'technical',
            'duration_seconds': 180,
            'note': "Design-first establishes a shared YAML/JSON contract before coding, allowing frontend and backend to develop in parallel using mock servers (Prism), generates SDKs, and enforces contract testing."
        },
        {
            'text': "How should sensitive personal data (PII) and credentials be protected across API request logs, traces, and error payloads?",
            'category': 'technical',
            'duration_seconds': 180,
            'note': "Masking/redacting sensitive keys (password, credit_card, ssn) in logging middleware, preventing PII in URL query strings (which get logged by web servers and proxies), and encrypting payload fields."
        }
    ],
    'backend-api_design-s2-set2': [
        {
            'text': "Walk through the architectural role of an API Gateway (such as Kong, Apigee, or AWS API Gateway). What responsibilities should reside in the gateway vs microservice backends?",
            'category': 'architecture',
            'duration_seconds': 180,
            'note': "Gateway handles cross-cutting concerns: SSL termination, global rate limiting, authentication/token verification, CORS, IP whitelisting, and routing. Business logic and domain validation stay in services."
        },
        {
            'text': "How do you design a robust Webhook notification system for an API? Detail payload design, signature verification (HMAC), replay protection, and retry backoff.",
            'category': 'architecture',
            'duration_seconds': 180,
            'note': "Include timestamp and event ID in payload; send HMAC-SHA256 signature in header using shared secret; client verifies signature and checks timestamp to prevent replay attacks; server retries with exponential backoff."
        },
        {
            'text': "Compare REST APIs with GraphQL and gRPC. In what architectural scenarios would you choose GraphQL or gRPC over a standard RESTful design?",
            'category': 'architecture',
            'duration_seconds': 180,
            'note': "REST for simple CRUD and broad public consumption; GraphQL for complex frontend data graphs avoiding over/under-fetching; gRPC (Protocol Buffers + HTTP/2) for high-performance internal microservice communication."
        },
        {
            'text': "How should bulk or batch operations be modeled in a REST API? How should the server respond when 8 out of 10 items in a batch succeed and 2 fail?",
            'category': 'technical',
            'duration_seconds': 180,
            'note': "POST /bulk/items returning 207 Multi-Status (WebDAV RFC 4918) or 200 OK with an array of individual status codes and error payloads per item, enabling granular client reconciliation."
        },
        {
            'text': "Explain the OAuth 2.0 Authorization Code Grant with PKCE (Proof Key for Code Exchange). Why is PKCE mandatory for Single Page Apps and Mobile Apps?",
            'category': 'technical',
            'duration_seconds': 180,
            'note': "Public clients cannot securely store a client_secret. PKCE generates code_verifier and hashed code_challenge sent during authorization, verified during token exchange, preventing authorization code interception."
        }
    ],
    'backend-api_design-s2-set3': [
        {
            'text': "How do you handle breaking changes in an API consumed by 10,000 mobile app users who cannot be forced to immediately update their app?",
            'category': 'scenario',
            'duration_seconds': 180,
            'note': "Maintain additive non-breaking changes, use API versioning, run side-by-side legacy endpoints with adapter transformers, announce sunset timeline with Sunset and Deprecation HTTP headers, and monitor legacy traffic."
        },
        {
            'text': "Design a secure, scalable file upload API for a SaaS application handling 50MB video files. Why should client files never be proxied directly through application server memory?",
            'category': 'architecture',
            'duration_seconds': 180,
            'note': "Application generates pre-signed S3 upload URLs with temporary expiration and size constraints; client uploads directly to object storage via PUT; S3 fires webhook/event notification to backend on completion."
        },
        {
            'text': "How do you implement optimistic concurrency control in a REST API using the ETag and If-Match headers to prevent the 'lost update' problem?",
            'category': 'technical',
            'duration_seconds': 180,
            'note': "GET returns resource with ETag: 'v1'. Client sends update via PUT with If-Match: 'v1'. If another user updated it first (ETag now 'v2'), server rejects with 412 Precondition Failed, prompting client to reload."
        },
        {
            'text': "You discover that a public API is suffering from cascading failures due to downstream service latency. How do you implement Circuit Breakers and Graceful Degradation?",
            'category': 'architecture',
            'duration_seconds': 180,
            'note': "Circuit breaker states (Closed, Open, Half-Open); when downstream fails or times out beyond threshold, trip circuit to Open, immediately return cached response or fallback degraded data without waiting."
        },
        {
            'text': "How do you implement distributed tracing across microservice API boundaries using the W3C Trace Context standard (traceparent and tracestate)?",
            'category': 'technical',
            'duration_seconds': 180,
            'note': "traceparent header contains version, 16-byte trace-id (consistent across entire request tree), 8-byte parent-id (current span), and trace-flags. Services extract, create child span, and propagate downstream."
        }
    ],

    # Series 3
    'backend-api_design-s3-set1': [
        {
            'text': "What is JSON:API specification (jsonapi.org)? How does it structure resource objects, relationships, compound documents (included), and links?",
            'category': 'technical',
            'duration_seconds': 180,
            'note': "Specifies top-level keys ('data', 'errors', 'meta'), resource objects with 'type', 'id', and 'attributes', and sidesteps N+1 requests via compound documents (?include=author,comments)."
        },
        {
            'text': "How should real-time updates be delivered in modern web APIs? Compare Server-Sent Events (SSE), WebSockets, and Webhooks in terms of directionality and infrastructure overhead.",
            'category': 'technical',
            'duration_seconds': 180,
            'note': "SSE: unidirectional server-to-client over HTTP, auto-reconnect, lightweight for live feeds; WebSockets: full-duplex TCP connection for interactive chat/gaming; Webhooks: server-to-server asynchronous HTTP callbacks."
        },
        {
            'text': "What is the difference between URI encoding (percent-encoding) and form URL encoding? How should reserved and unreserved characters be handled in API path segments?",
            'category': 'technical',
            'duration_seconds': 180,
            'note': "Percent encoding represents special characters as %HEX; form URL encoding converts spaces to '+' instead of '%20'. Path parameters with slashes must be carefully encoded to prevent route misinterpretation."
        },
        {
            'text': "How does Mutual TLS (mTLS) work in securing high-trust B2B enterprise APIs? How does it differ from standard one-way TLS?",
            'category': 'technical',
            'duration_seconds': 180,
            'note': "Standard TLS only verifies server identity to client; mTLS requires client to also present its own X.509 certificate during TLS handshake, cryptographically verified by server before any HTTP payload is exchanged."
        },
        {
            'text': "Explain the purpose of the Deprecation and Sunset HTTP response headers (RFC 8594 / draft-ietf-httpapi-deprecation-header) in gracefully retiring API endpoints.",
            'category': 'technical',
            'duration_seconds': 180,
            'note': "Deprecation header indicates endpoint is deprecated (date or true); Sunset header provides exact date/time when endpoint will become unavailable (410 Gone); Link header points to documentation."
        }
    ],
    'backend-api_design-s3-set2': [
        {
            'text': "Architect a distributed multi-tenant rate limiting service using Redis that enforces tiered limits (e.g. Free: 60 req/min, Enterprise: 10,000 req/min) with sliding window accuracy.",
            'category': 'architecture',
            'duration_seconds': 180,
            'note': "Redis sorted sets (ZADD) with timestamps as score and member, ZREMRANGEBYSCORE to trim entries outside current sliding window, ZCARD to count hits, and EXPIRE inside an atomic Lua script."
        },
        {
            'text': "How do you design a transactional Saga pattern across distributed microservice APIs where a traditional two-phase commit (2PC) is unfeasible?",
            'category': 'architecture',
            'duration_seconds': 180,
            'note': "Choreography (event-driven via Kafka) vs Orchestration (central coordinator); each microservice performs local transaction and publishes event; on failure, orchestrator invokes compensating rollback APIs."
        },
        {
            'text': "How do you prevent Thundering Herd problem and cache stampedes on an API endpoint when a popular cached resource expires?",
            'category': 'architecture',
            'duration_seconds': 180,
            'note': "Techniques include mutex locks (only one worker regenerates cache while others wait), probabilistic early expiration (XFetch algorithm), or background stale-while-revalidate asynchronous updating."
        },
        {
            'text': "Explain how you would design an API contract testing pipeline using Pact to guarantee consumer-driven contracts between 20 microservices before deployment.",
            'category': 'technical',
            'duration_seconds': 180,
            'note': "Consumers write unit tests asserting expected request/response shapes, generating a Pact JSON file published to Pact Broker. Provider verification tests run against the broker in CI, preventing breaking changes."
        },
        {
            'text': "How do you protect a public API against the OWASP API Security Top 10 vulnerabilities, specifically Broken Object Level Authorization (BOLA / IDOR)?",
            'category': 'technical',
            'duration_seconds': 180,
            'note': "BOLA occurs when client accesses /orders/456 without server verifying that order 456 belongs to authenticated user. Remediation: enforce authorization checks at data layer (WHERE user_id = auth_id) on every resource request."
        }
    ],
    'backend-api_design-s3-set3': [
        {
            'text': "Architect a global public developer platform API handling 100,000 requests per second across three continents with sub-100ms response times and 99.999% availability.",
            'category': 'architecture',
            'duration_seconds': 180,
            'note': "Anycast DNS / Cloudflare routing, multi-region API Gateway clusters, edge caching, CockroachDB/Spanner active-active multi-region databases, Redis cluster for rate limiting, and automated health failovers."
        },
        {
            'text': "How would you design a GraphQL Federation architecture (Apollo Federation) to replace a sprawling legacy REST API ecosystem while preserving backwards compatibility?",
            'category': 'architecture',
            'duration_seconds': 180,
            'note': "Federation Gateway acts as unified entry point; individual subgraphs define entity types using @key directives; gateway builds query execution plan composing data across subgraphs; legacy REST endpoints proxy into subgraphs."
        },
        {
            'text': "A critical zero-day vulnerability requires you to instantly invalidate 1 million active JWT bearer tokens issued to users across your distributed API. How do you implement this when JWTs are stateless?",
            'category': 'architecture',
            'duration_seconds': 180,
            'note': "Stateless JWT revocation options: maintain distributed Redis blacklist/revocation set of jti (JWT IDs) or user token_invalid_before timestamps checked by gateway, rotate signing keys, or use short-lived JWTs (5m) with refresh tokens."
        },
        {
            'text': "How do you design an API monetization and metering system that accurately tracks API credit usage down to the millisecond without degrading request throughput?",
            'category': 'architecture',
            'duration_seconds': 180,
            'note': "Asynchronous metering: gateway validates cached balance in Redis, processes request, emits usage event to Kafka/SQS topic; stream workers aggregate consumption into billing ledger, periodically reconciling account balance."
        },
        {
            'text': "Discuss the technical and organizational trade-offs between monolithic API Gateways versus Service Mesh sidecar proxies (Envoy / Istio) for internal service-to-service communication.",
            'category': 'architecture',
            'duration_seconds': 180,
            'note': "API Gateway handles north-south traffic (ingress, auth, rate limiting, public contracts); Service Mesh manages east-west internal traffic (mTLS, service discovery, circuit breaking, fine-grained telemetry) without application code changes."
        }
    ]
}

if __name__ == '__main__':
    out_dir = os.path.join(os.path.dirname(__file__), 'vault_questions')
    os.makedirs(out_dir, exist_ok=True)
    out_file = os.path.join(out_dir, 'backend_part1.php')
    write_php_file(out_file, part1_data)
