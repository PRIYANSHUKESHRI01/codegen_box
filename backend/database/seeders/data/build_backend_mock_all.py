import os
import sys

sys.path.append(os.path.dirname(__file__))
from vault_helper import write_php_file
from question_generator_core import make_q, build_set_rounds

OUT_DIR = os.path.join(os.path.dirname(__file__), 'mock_questions_parent_sets')
os.makedirs(OUT_DIR, exist_ok=True)

# Import completed backend data
from build_backend_mock_sets_p4 import backend_data

# Function to generate authentic domain questions for any tech stack
def generate_domain_parent_sets(stack_key, domain_name, core_concepts, framework_concepts, prod_concepts, adv_concepts, scale_concepts):
    return {
        2: build_set_rounds(
            [make_q(f"How do {c[0]} work in {domain_name}? Explain the internal mechanics and implementation best practices.", c[1], c[0]) for c in core_concepts[:5]],
            [make_q(f"How do you implement {c[0]} in {domain_name} for production applications?", c[1], c[0]) for c in framework_concepts[:5]],
            [make_q(f"Describe how to debug and solve {c[0]} in {domain_name}.", c[1], c[0]) for c in prod_concepts[:5]],
        ),
        3: build_set_rounds(
            [make_q(f"How do you design robust APIs and contracts with {c[0]} in {domain_name}?", c[1], c[0]) for c in prod_concepts[5:10]],
            [make_q(f"Explain how database persistence and transaction management work with {c[0]} in {domain_name}.", c[1], c[0]) for c in prod_concepts[10:15]],
            [make_q(f"How do you handle monitoring, queues, and observability for {c[0]} in {domain_name}?", c[1], c[0]) for c in prod_concepts[15:20]],
        ),
        4: build_set_rounds(
            [make_q(f"How do you handle high-throughput concurrency and async patterns with {c[0]} in {domain_name}?", c[1], c[0]) for c in adv_concepts[:5]],
            [make_q(f"Explain performance profiling and latency optimization strategies for {c[0]} in {domain_name}.", c[1], c[0]) for c in adv_concepts[5:10]],
            [make_q(f"How do you secure {c[0]} in {domain_name} against OWASP vulnerabilities and security threats?", c[1], c[0]) for c in adv_concepts[10:15]],
        ),
        5: build_set_rounds(
            [make_q(f"How would you architect an enterprise system using {c[0]} in {domain_name} at scale?", c[1], c[0]) for c in scale_concepts[:5]],
            [make_q(f"Explain fault tolerance, high-availability, and disaster recovery strategies for {c[0]} in {domain_name}.", c[1], c[0]) for c in scale_concepts[5:10]],
            [make_q(f"Walk through triaging a severe live production incident involving {c[0]} in {domain_name}.", c[1], c[0]) for c in scale_concepts[10:15]],
        ),
    }

# =====================================================================
# REMAINING BACKEND STACKS
# =====================================================================

# 6. PHP
backend_data['php'] = generate_domain_parent_sets(
    'php', 'Modern PHP 8.4',
    [
        ('PHP 8.4 Property Hooks & Asymmetric Visibility', 'Property hooks allow custom get/set logic directly on class properties. Asymmetric visibility allows public read but private/protected write (public private(set)).'),
        ('PHP Fiber Concurrency & Coroutines', 'Fibers are lightweight cooperative coroutines managed in user space that allow pausing and resuming execution with Fiber::suspend() and resume().'),
        ('OPcache & JIT Compilation Architecture', 'OPcache stores precompiled script bytecode in shared memory. JIT compiles bytecode into native machine code (tracing JIT vs function JIT).'),
        ('Generators and Yield for Streaming Datasets', 'Generators yield values on demand, maintaining internal execution state without allocating full collections in memory.'),
        ('WeakMaps and Garbage Collection', 'WeakMap associates data with objects without preventing the garbage collector from freeing the object when no other references remain.'),
    ],
    [
        ('PDO Prepared Statements & Connection Attributes', 'PDO prepares SQL templates on the database server, binding parameters separately to eliminate SQL injection attacks completely.'),
        ('Composer Autoloading Optimization (Classmap & Authoritative)', 'composer dump-autoload -o builds a classmap. Authoritative classmap (--classmap-authoritative) skips filesystem checks entirely.'),
        ('Attributes & Reflection API in PHP 8', 'Native Attributes provide structured metadata parsed at compile time via ReflectionClass::getAttributes(), replacing docblock annotations.'),
        ('Error Handling with Throwable, Error, and Exception', 'PHP 8 unifies fatal runtime errors and exceptions under Throwable interface, allowing catching Error (TypeError, ParseError) in try/catch.'),
        ('Session Serialization & Redis Session Handlers', 'Store sessions in Redis using session.save_handler = redis. Use session_regenerate_id(true) on login to prevent session fixation.'),
    ],
    [
        ('REST API Design with PSR-7 and PSR-15 Middlewares', 'PSR-7 defines HTTP message interfaces; PSR-15 defines request handler and middleware interfaces for composable HTTP pipelines.') for _ in range(20)
    ],
    [
        ('Swoole & RoadRunner High-Concurrency Architecture', 'Swoole and RoadRunner boot the PHP application once into RAM, keeping worker processes alive to handle thousands of concurrent requests.') for _ in range(15)
    ],
    [
        ('Enterprise Multi-Tenant PHP Architecture', 'Isolate tenants via dynamic database connection switching or tenant-specific schemas in PostgreSQL with automated migration runners.') for _ in range(15)
    ]
)

# 7. C# & .NET
backend_data['csharp_dotnet'] = generate_domain_parent_sets(
    'csharp_dotnet', 'C# & .NET 8/9',
    [
        ('CLR Garbage Collection & Large Object Heap (LOH)', 'Generational GC (Gen 0, Gen 1, Gen 2) with dedicated LOH for objects >= 85,000 bytes. LOH is collected during Gen 2 and compacted on demand.'),
        ('Span<T>, Memory<T>, and Ref Structs', 'Span<T> provides type-safe, memory-safe views over contiguous memory (arrays, stackalloc, native memory) with zero heap allocations.'),
        ('async/await State Machines & SynchronizationContext', 'Compiler transforms async methods into state machine structs. SynchronizationContext marshals continuations back to the caller thread.'),
        ('LINQ Internals & Expression Trees', 'LINQ to Objects uses deferred execution via IEnumerable generators. LINQ to Entities converts IQueryable Expression Trees to native SQL.'),
        ('ValueTask vs Task in High-Throughput Scenarios', 'ValueTask is a struct that avoids heap allocation when an asynchronous operation completes synchronously (e.g. from cache).'),
    ],
    [
        ('Dependency Injection Scopes in .NET', 'Transient creates a new instance per request. Scoped creates one per HTTP request. Singleton creates a single instance across the application lifetime.'),
        ('Entity Framework Core Change Tracking & AsNoTracking', 'ChangeTracker monitors entity property modifications. AsNoTracking() bypasses snapshot tracking for read-only queries, reducing memory by 50%.'),
        ('ASP.NET Core Middleware Pipeline', 'Request delegates executed in an onion pipeline via app.Use(). Each middleware can short-circuit or call next() to pass to the next component.'),
        ('C# Pattern Matching and Record Types', 'Records provide value-based equality, non-destructive mutation via with expressions, and positional deconstruction with pattern matching.'),
        ('Source Generators in .NET', 'Roslyn Source Generators inspect user code during compilation and generate additional C# source files on the fly, eliminating runtime reflection.'),
    ],
    [('REST & gRPC Microservices in .NET', 'Build high-performance gRPC services over HTTP/2 with strongly-typed Protobuf contracts, integrated with ASP.NET Core DI.') for _ in range(20)],
    [('Concurrency with Channels and Parallel.ForEachAsync', 'System.Threading.Channels provides lock-free, high-performance producer-consumer queues. Parallel.ForEachAsync throttles parallel tasks.') for _ in range(15)],
    [('Enterprise Microservices with MassTransit & RabbitMQ', 'MassTransit abstracts message bus communication, providing sagas, outbox pattern, automatic retries, and dead-letter queues.') for _ in range(15)]
)

# 8. ASP.NET CORE
backend_data['aspnet_core'] = generate_domain_parent_sets(
    'aspnet_core', 'ASP.NET Core',
    [
        ('Kestrel Web Server Architecture & Socket Pipelines', 'Kestrel is a cross-platform, asynchronous I/O web server built on libuv and managed sockets, designed for extreme HTTP throughput.'),
        ('Minimal APIs vs Controller-based Architecture', 'Minimal APIs map endpoints directly to lambdas using route handlers, bypassing MVC reflection overhead for high-performance microservices.'),
        ('Model Binding, Validation & Filters', 'Model binders extract data from route, query, body, and headers. Action filters and validation attributes execute before controller actions.'),
        ('Options Pattern & Configuration Reloading', 'IOptions, IOptionsSnapshot (scoped, reloads per request), and IOptionsMonitor (real-time notifications on config file changes).'),
        ('Authentication & Authorization with JWT Bearer & Policies', 'AddAuthentication(JwtBearerDefaults). RequireAuthorization(policy) uses requirement handlers for fine-grained claim evaluation.'),
    ],
    [('Health Checks & K8s Readiness Probes', 'Microsoft.Extensions.Diagnostics.HealthChecks exposes endpoints for DB, Redis, and disk checks with custom tags.') for _ in range(5)],
    [('EF Core Query Optimization & Split Queries', 'AsSplitQuery() avoids Cartesian explosion when loading multiple collections in a single entity query.') for _ in range(20)],
    [('Memory Profiling with dotnet-dump and dotnet-trace', 'Capture diagnostic dumps without stopping production processes and analyze in Visual Studio or lldb.') for _ in range(15)],
    [('Distributed Caching with IDistributedCache & Redis', 'Implement Redis distributed caching with sliding expiration and tag invalidation.') for _ in range(15)]
)

# 9. CMS (WordPress / Headless)
backend_data['cms'] = generate_domain_parent_sets(
    'cms', 'CMS Development (WordPress & Headless)',
    [
        ('WordPress Hook System: Actions vs Filters', 'Actions execute custom code at specific lifecycle points; Filters modify and return variables passed through them.'),
        ('Custom Post Types (CPT) & Custom Taxonomies', 'register_post_type and register_taxonomy create custom content structures with rewrite rules and custom query support.'),
        ('WP_Query Architecture & Query Caching', 'WP_Query parses query parameters, builds optimized SQL queries against wp_posts and wp_postmeta, caching results in object cache.'),
        ('Transients API and Persistent Object Cache (Redis/Memcached)', 'set_transient() stores temporary cached data with expiration. When Redis is enabled, transients persist in RAM.'),
        ('WordPress Database Schema Optimization & Postmeta Indexing', 'wp_postmeta lacks composite indexes for meta_key/meta_value queries. Optimize with custom tables or search indexes.'),
    ],
    [('Headless WordPress with WPGraphQL & Next.js', 'Decouple frontend using WPGraphQL API, consuming data statically with Incremental Static Regeneration (ISR).') for _ in range(5)],
    [('WP REST API Authentication & Custom Endpoints', 'register_rest_route() with permission_callback, validating requests using Application Passwords or JWT.') for _ in range(20)],
    [('Security Hardening & SQLi Prevention in WordPress', '$wpdb->prepare() parameterizes queries. wp_verify_nonce() validates CSRF nonces on all form submissions.') for _ in range(15)],
    [('High-Traffic Enterprise WordPress on AWS (Aurora & CloudFront)', 'Deploy stateless WordPress containers behind ALB, offloading media to S3/CloudFront and database to Aurora.') for _ in range(15)]
)

# 10. API DESIGN
backend_data['api_design'] = generate_domain_parent_sets(
    'api_design', 'API Development & Architecture',
    [
        ('REST Architectural Constraints & Richardson Maturity Model', 'Level 0 (POX), Level 1 (Resources), Level 2 (HTTP Verbs), Level 3 (HATEOAS). Statelessness, cacheability, uniform interface.'),
        ('HTTP Status Code Semantics & Idempotency', 'GET, PUT, DELETE are idempotent; POST is non-idempotent. 200 OK, 201 Created, 204 No Content, 400, 401, 403, 404, 409, 422, 429, 500, 503.'),
        ('API Versioning: URI vs Header vs Query Parameter', 'URI path (/v1/users) is clear and cacheable. Accept header (Accept: application/vnd.company.v1+json) conforms strictly to REST semantics.'),
        ('Idempotency Keys in Payment & Mutation APIs', 'Clients send Idempotency-Key. The server verifies whether the key exists in Redis/DB; if processed, returns the saved response.'),
        ('Rate Limiting Algorithms: Token Bucket, Leaky Bucket, Sliding Window', 'Token bucket permits bursts. Leaky bucket smooths traffic. Sliding window log provides exact precision without boundary spikes.'),
    ],
    [('OpenAPI 3.1 & Schema-First API Design', 'Define API contracts in YAML/JSON first. Generate server stubs, client SDKs, and mock servers with automatic validation.') for _ in range(5)],
    [('GraphQL vs REST vs gRPC Trade-offs', 'GraphQL prevents over/under-fetching for complex frontends. REST is ubiquitous and cacheable. gRPC offers binary efficiency for microservices.') for _ in range(20)],
    [('Webhook Delivery with HMAC Signatures & Retries', 'Sign payload with HMAC SHA-256. Dispatch via queues with exponential backoff retries and dead-letter queues on failure.') for _ in range(15)],
    [('API Gateway Architecture & Service Mesh Integration', 'Deploy Kong, Envoy, or AWS API Gateway for centralized authentication, rate limiting, SSL termination, and routing.') for _ in range(15)]
)

print(f"Total Backend Stacks Generated: {len(backend_data)}")
write_php_file(os.path.join(OUT_DIR, 'backend_mock_parent_sets.php'), backend_data)
