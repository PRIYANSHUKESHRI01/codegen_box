<?php

// Auto-generated curated vault questions for Mellow Vault AI Interview

return [
    'laravel' => [
        1 => [
            [
                'text' => 'How does Dependency Injection work in Laravel controllers and services? What is the difference between binding a class as a singleton versus a regular bind in a ServiceProvider?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Explain that Laravel\'s Service Container uses PHP reflection to inspect constructor parameter typehints and automatically resolve dependencies. $this->app->bind() instantiates a fresh object on every resolution; $this->app->singleton() resolves the class once and returns the cached instance across subsequent calls within the request lifecycle.',
            ],
            [
                'text' => 'How do Eloquent Model Relationships work in Laravel? Compare hasOne, hasMany, and belongsTo with a realistic Users and Posts database schema example.',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Explain foreign key conventions (e.g. user_id on posts table). User hasMany Post defines 1-to-many; Post belongsTo User defines inverse relationship holding the foreign key. hasOne defines 1-to-1 (e.g. User hasOne Profile). Show how methods return relationship instances allowing query chaining.',
            ],
            [
                'text' => 'What is the N+1 query problem in Laravel Eloquent? How do eager loading (with()) and lazy eager loading (load()) prevent database query explosions?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'N+1 occurs when iterating through N parent models and querying a related model inside the loop (1 parent query + N child queries = N+1). Eager loading with(\'posts\') executes exactly 2 queries using WHERE IN. lazy eager loading ($user->load(\'posts\')) applies eager loading on an already retrieved model collection.',
            ],
            [
                'text' => 'How does Laravel Form Request validation work? Why is separating validation into a dedicated FormRequest class cleaner than validating inside a controller method?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'FormRequest encapsulates authorization (authorize() method returning bool) and validation rules (rules() method). If validation fails, Laravel automatically interrupts execution and redirects back with session errors (or returns 422 JSON response for API requests), keeping controllers lean and adhering to Single Responsibility Principle.',
            ],
            [
                'text' => 'Explain the execution flow of Laravel Middleware. How do global, route-specific, and middleware groups (web vs api) protect application endpoints?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Middleware forms an onion layer around the HTTP request. A request passes through each middleware\'s handle($request, Closure $next) method before reaching the controller. Global middleware runs on every request; route middleware attaches to specific routes (e.g. \'auth:sanctum\'); \'web\' group adds sessions/CSRF, while \'api\' group applies stateless token auth and throttling.',
            ],
        ],
        2 => [
            [
                'text' => 'How do Laravel Queues and Background Jobs improve web application responsiveness? Walk through dispatching a SendWelcomeEmail job with retry configurations.',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Heavy I/O (sending emails, image processing, webhook calls) blocks user HTTP responses. Queuing pushes job payloads onto drivers (Redis, database, SQS). A worker process (php artisan queue:work) consumes jobs asynchronously. Discuss configuring public $tries = 3, $backoff = [10, 30], and the failed() method for handling poisoned jobs.',
            ],
            [
                'text' => 'How does Database Transaction management work in Laravel? Why should multiple related database updates be wrapped in DB::transaction()?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'DB::transaction(callback, attempts) guarantees ACID atomicity: if an exception is thrown inside the closure, all preceding database mutations are rolled back automatically, preventing orphaned or corrupt records (e.g. debiting an account without crediting recipient). Discuss manual DB::beginTransaction(), DB::commit(), and DB::rollBack().',
            ],
            [
                'text' => 'What are Eloquent Query Scopes in Laravel? Compare Local Scopes with Global Scopes and provide a practical usecase for each.',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Local scopes (scopeActive($query)) define reusable query constraints callable on models ($user->active()->get()). Global scopes (implementing Scope interface or booted() static closures) apply constraints automatically to all queries on the model (e.g. SoftDeletes filtering out deleted_at is not null, or multi-tenant team isolation by team_id).',
            ],
            [
                'text' => 'How does Cache management work in Laravel? Compare Cache::remember(), Cache::put(), and explain how Cache Tags organize cached items for mass invalidation.',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Cache::remember(key, ttl, closure) retrieves cached data or executes closure, saves result, and returns it. Cache::put stores directly. Cache Tags (supported in Redis/Memcached) allow tagging related cached keys (e.g. Cache::tags([\'users\', \'team_1\'])) and flushing all related items simultaneously with Cache::tags([\'team_1\'])->flush() on team updates.',
            ],
            [
                'text' => 'How do API Resources (JsonResource and ResourceCollection) structure JSON API responses in Laravel? Why is using API Resources superior to returning raw Eloquent models?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'API Resources act as a transformation layer between Eloquent models and client responses. They prevent accidental exposure of sensitive model attributes (password hashes, internal flags), format dates consistently, structure relationship data conditionally (whenLoaded()), and decouple API response schemas from internal database column names.',
            ],
        ],
        3 => [
            [
                'text' => 'How does Laravel Sanctum handle SPA (Single Page Application) authentication versus Mobile API token authentication? Explain the cookie-based session vs personal access token workflow.',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'For SPAs on first-party domains, Sanctum uses stateful cookie authentication: frontend fetches CSRF cookie from /sanctum/csrf-cookie, then posts credentials; session cookie is attached with same-origin CORS protection. For mobile apps or third-party clients, Sanctum issues Bearer personal access tokens stored hashed in personal_access_tokens table.',
            ],
            [
                'text' => 'How do you implement API Rate Limiting in Laravel? Explain RateLimiter::for() definition and how the \'throttle\' middleware protects endpoints from abuse.',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Define rate limiters in AppServiceProvider or RouteServiceProvider using RateLimiter::for(\'api\', fn($request) => Limit::perMinute(60)->by($request->user()?->id ?: $request->ip())). Attach via throttle:api middleware. Returns 429 Too Many Requests with Retry-After and X-RateLimit headers when threshold is exceeded.',
            ],
            [
                'text' => 'How do you debug and optimize slow database queries in a Laravel application? What tools (Laravel Telescope, Debugbar, DB::listen) help identify missing indexes?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Tools: Laravel Debugbar visualizes query execution time and duplicate queries per request; Telescope logs slow queries across environments. Using DB::listen() logs execution time in ms. Identify full table scans by running EXPLAIN on raw SQL. Solutions: add composite indexes, replace eager loading all fields with select(\'id\', \'name\'), and implement pagination.',
            ],
            [
                'text' => 'Explain Event and Listener architecture in Laravel. When should an event listener implement the ShouldQueue contract?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Events (e.g. OrderPlaced) represent application domain occurrences; Listeners (SendInvoiceNotification, UpdateInventory) handle reactions, decoupling business logic. If a listener performs non-critical or slow tasks (sending emails, calling external APIs), implementing ShouldQueue delegates execution to background queue workers, preserving fast HTTP response times.',
            ],
            [
                'text' => 'How does File Storage abstraction work in Laravel via Flysystem? How do you upload a user avatar to an Amazon S3 bucket and generate a temporary presigned URL for private downloads?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Laravel uses Storage facade configured in config/filesystems.php. Upload using Storage::disk(\'s3\')->putFile(\'avatars\', $file, \'private\'). To provide secure time-limited downloads without exposing bucket publicly, generate presigned URLs using Storage::disk(\'s3\')->temporaryUrl($path, now()->addMinutes(15)).',
            ],
        ],
    ],
    'nodejs' => [
        1 => [
            [
                'text' => 'Explain the Node.js Event Loop architecture. What are the phases of the event loop (timers, pending callbacks, poll, check, close), and where do process.nextTick and Promise microtasks execute?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Node.js runs single-threaded JS using libuv. Phases: Timers (setTimeout), Pending I/O, Poll (retrieves new I/O events), Check (setImmediate), Close callbacks. Microtasks (process.nextTick queue has highest priority, followed by resolved Promise microtask queue) drain immediately after the current operation finishes, before moving to the next event loop phase.',
            ],
            [
                'text' => 'What is the difference between CommonJS (require / module.exports) and ES Modules (import / export) in Node.js? How does Node.js resolve module formats?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'CommonJS is synchronous, runtime evaluated, default in older Node (`module.exports = ...`). ES Modules (ESM) are static, asynchronous, evaluated before execution, supporting top-level await and tree-shaking. Node determines ESM via package.json \'type\': \'module\' or .mjs file extensions. CJS cannot easily require() pure ESM modules.',
            ],
            [
                'text' => 'Explain error handling best practices in asynchronous Node.js code. Why does an unhandled Promise rejection or uncaught exception crash the Node process?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'In async/await, wrap asynchronous calls in try/catch blocks; with Express 4, pass errors to next(err) for global error middleware. Unhandled promise rejections trigger \'unhandledRejection\' and in modern Node.js terminate the process with exit code 1 to prevent continuing in an undefined/corrupt memory state.',
            ],
            [
                'text' => 'How does Express.js middleware work? Walk through the signature (req, res, next) and explain what happens if a middleware function forgets to call next() or send a response.',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Express middleware functions execute sequentially in the order defined by app.use(). They inspect or mutate req/res. Calling next() passes control to the next middleware in the pipeline; sending res.json() terminates the cycle. If neither is called, the HTTP connection hangs until client or server socket timeout.',
            ],
            [
                'text' => 'What is the Node.js Buffer class, and why is it necessary for handling binary data, network streams, and file system reads?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'JavaScript originally had no mechanism for reading or manipulating raw binary data. Buffer allocates fixed-size, raw binary memory outside the V8 JavaScript heap. It represents sequences of bytes (octets), essential for TCP streams, reading binary files (images, PDFs), and cryptographic operations.',
            ],
        ],
        2 => [
            [
                'text' => 'How do Node.js Streams work? Compare Readable, Writable, Duplex, and Transform streams. How does pipeline() or pipe() prevent memory exhaustion when streaming large files?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Streams process data chunk by chunk rather than buffering entire files in RAM. Readable streams produce data (fs.createReadStream); Writable consumes data. pipe() streams data from source to destination. stream.pipeline() automatically handles stream closure, error propagation, and backpressure (pausing readable stream when destination buffer is full).',
            ],
            [
                'text' => 'Compare Express.js with Fastify. What architectural design choices make Fastify significantly faster in JSON serialization and HTTP routing?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Fastify achieves high throughput using: 1) fast-json-stringify for compiled schema-based serialization instead of generic JSON.stringify; 2) Radix tree router (find-my-way) for O(k) URL routing vs Express regex matching; 3) Low-overhead async plugin architecture with encapsulation.',
            ],
            [
                'text' => 'How do you structure JWT (JSON Web Token) authentication in a Node.js REST API? Explain token signing, verification middleware, and storing access tokens vs refresh tokens.',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Server signs payload with secret key using jsonwebtoken.sign(payload, secret, {expiresIn: \'15m\'}). Middleware extracts Authorization: Bearer <token> header, verifies signature using jwt.verify(), and attaches user to req.user. Short-lived access tokens expire quickly; long-lived refresh tokens stored securely (e.g. httpOnly cookie, DB) issue new access tokens.',
            ],
            [
                'text' => 'What are Worker Threads and the Cluster Module in Node.js? How do you scale a single-threaded Node.js HTTP server across all available CPU cores?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Node.js runs single-threaded by default. The Cluster module forks multiple independent Node processes sharing the same server port, with master routing connections via round-robin. Worker Threads run multiple JS execution threads inside a single process sharing memory via SharedArrayBuffer, ideal for CPU-intensive computing (encryption, data compression).',
            ],
            [
                'text' => 'How do you sanitize and validate incoming request payloads in Node.js using schema validation libraries like Zod or Joi?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Schema validation libraries define expected object shapes and types (e.g. z.object({ email: z.string().email(), age: z.number().min(18) })). In middleware, validate req.body with schema.parse(req.body) or safeParse(). Rejects malformed requests with 400 Bad Request before controller runs, ensuring type safety and stripping unexpected keys.',
            ],
        ],
        3 => [
            [
                'text' => 'How do memory leaks occur in Node.js applications? What are the common causes (unbounded global caches, lingering event listeners, unclosed sockets), and how do you profile heap dumps?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Memory leaks happen when references to unused objects remain reachable from root. Common culprits: global objects holding growing maps without eviction (LRU needed), forgotten EventEmitter listeners (emitter.on without emitter.off), closures retaining outer scope variables. Profile using Chrome DevTools or heapdump package to compare baseline and loaded memory snapshots.',
            ],
            [
                'text' => 'How does Database Connection Pooling work in Node.js database drivers (e.g. pg for PostgreSQL or mysql2)? Why is establishing a new TCP connection per HTTP request disastrous for performance?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Opening a database connection requires TCP 3-way handshake, TLS negotiation, and backend authentication, costing 50-200ms per request. A connection pool maintains an active set of reusable connections (e.g. poolSize: 20). Requests borrow an idle connection, execute queries, and return it immediately, keeping database server connection counts bounded.',
            ],
            [
                'text' => 'How do you implement Graceful Shutdown in a Node.js production server when receiving SIGTERM or SIGINT signals (e.g. during a Kubernetes pod termination)?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Listen for process.on(\'SIGTERM\', ...). 1) Stop accepting new HTTP connections via server.close(); 2) Allow active in-flight requests to complete (with a 10-30s timeout safety net); 3) Close database pools and message queue connections; 4) Call process.exit(0). Prevents dropped user requests during rolling deployments.',
            ],
            [
                'text' => 'What is the Circuit Breaker pattern in microservices (e.g. using opossum in Node.js)? How does it protect your application when a downstream third-party API is failing?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Three states: Closed (requests flow normally), Open (when failure rate exceeds threshold, e.g. 50% failures, calls fail immediately with fallback response without hitting downstream API), and Half-Open (allows trial requests to check if downstream service recovered). Prevents cascading thread/socket exhaustion across services.',
            ],
            [
                'text' => 'Explain Security Best Practices for an Express.js production API: Helmet headers, CORS policies, preventing Prototype Pollution, and rate limiting against brute force.',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Helmet sets secure HTTP response headers (HSTS, X-Content-Type-Options: nosniff, frameguard). CORS restricts allowed origins. Prototype pollution occurs when recursively merging unvalidated user input into Object.prototype; prevent with Object.freeze or Map. Rate limiting (express-rate-limit + Redis) throttles login and public endpoints.',
            ],
        ],
    ],
    'python' => [
        1 => [
            [
                'text' => 'Explain Python\'s GIL (Global Interpreter Lock). Why does the GIL prevent standard multithreading from speeding up CPU-bound code in CPython, and how does multiprocessing solve this?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'The GIL is a mutex that prevents multiple native threads from executing CPython bytecodes at once, required because CPython memory management uses non-thread-safe reference counting. For I/O-bound tasks, threads release the GIL during network/disk wait. For CPU-bound tasks, multiprocessing creates separate Python processes with independent GILs and memory spaces.',
            ],
            [
                'text' => 'What are Python Decorators? How do you write a custom @timer decorator that measures and logs the execution duration of any function?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Decorators are higher-order functions that take a function as an argument, extend behavior, and return a callable wrapper. Use functools.wraps to preserve original function __name__ and docstrings. Inside wrapper(*args, **kwargs), record time.perf_counter() before and after calling func(), log difference, and return result.',
            ],
            [
                'text' => 'What is the mutable default argument trap in Python? What happens if you define \'def append_item(val, items=[])\', and how do you write it idiomatically?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Default arguments are evaluated once when the function definition is executed, NOT every time the function is called. If default is a mutable list ([]), mutations persist across subsequent invocations. Idiomatic fix: use \'items=None\' as default, and inside function check \'if items is None: items = []\'.',
            ],
            [
                'text' => 'Explain Python Generators and the \'yield\' keyword. How do generators allow processing massive datasets without running out of memory?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Generators are functions containing the yield keyword. When called, they return a generator iterator without executing the function body immediately. Each call to next() executes up to yield, emits the value, and suspends state (local variables and instruction pointer), enabling streaming of millions of records with constant O(1) memory.',
            ],
            [
                'text' => 'What is the difference between shallow copy and deep copy in Python? Demonstrate with nested lists or dictionaries using the copy module.',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'A shallow copy (copy.copy() or list[:]) creates a new outer container, but inserts references to the original nested objects; modifying a nested list modifies both copies. A deep copy (copy.deepcopy()) recursively copies all nested objects, creating completely independent duplicate data trees in memory.',
            ],
        ],
        2 => [
            [
                'text' => 'How does FastAPI achieve high performance using ASGI and Starlette? Explain how \'async def\' endpoints handle concurrent I/O requests compared to traditional WSGI frameworks like Flask.',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'WSGI (Flask/traditional Django) is synchronous: each concurrent request requires a dedicated OS worker thread or process. ASGI (FastAPI/Uvicorn) runs on an async event loop (asyncio). When an endpoint awaits I/O (database query, HTTP call), the worker thread yields control to process other incoming requests, achieving thousands of concurrent connections with low memory.',
            ],
            [
                'text' => 'How does Pydantic provide data validation and schema generation in FastAPI? Explain BaseModel, Field validation, and type annotations.',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Pydantic uses Python type hints to parse, validate, and coerce incoming JSON payloads into strongly typed Python objects. If validation fails, FastAPI automatically returns detailed 422 Unprocessable Entity errors. Pydantic also automatically powers OpenAPI (Swagger) documentation schemas.',
            ],
            [
                'text' => 'In Django ORM, explain the difference between select_related() and prefetch_related(). When should each be used to prevent N+1 query problems?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'select_related() performs an SQL JOIN in a single query; used for single-valued relationships (ForeignKey and OneToOneField). prefetch_related() executes a separate query using WHERE IN and joins data in Python memory; used for multi-valued relationships (ManyToManyField and reverse ForeignKey).',
            ],
            [
                'text' => 'How does Dependency Injection work in FastAPI using Depends()? Give an example of injecting a database session or verifying an authenticated user.',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'FastAPI\'s Depends() declares dependencies as function parameters. FastAPI resolves them before executing the route. For database sessions: a generator function yields a session and commits/closes in a finally block. For auth: a dependency extracts the Bearer token, decodes JWT, queries the user, and raises HTTPException(401) on failure.',
            ],
            [
                'text' => 'How do Background Tasks work in FastAPI (BackgroundTasks)? When should you use built-in BackgroundTasks versus a distributed task queue like Celery?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'FastAPI BackgroundTasks runs tasks in the same process after returning the HTTP response; suitable for lightweight tasks (sending a simple email, writing an audit log). For heavy computation, guaranteed retries, task prioritization, or scheduled cron jobs, use Celery with Redis/RabbitMQ brokers across dedicated worker machines.',
            ],
        ],
        3 => [
            [
                'text' => 'How do you manage Database Migrations in Django and Alembic (for FastAPI/SQLAlchemy)? What happens if two developers create conflicting migration files?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Django tracks migrations in django_migrations table; Alembic uses alembic_version table. Conflicting migrations happen when both branch off the same base migration. Django detects multiple leaf nodes and requires running \'python manage.py makemigrations --merge\'; Alembic requires \'alembic merge heads\'.',
            ],
            [
                'text' => 'How do you handle asynchronous background processing and task scheduling in Python using Celery with Redis as a broker and result backend?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Celery serializes task arguments and pushes messages to Redis queues. Worker processes consume messages. Use task decorators (@app.task(bind=True, max_retries=3)), call task.delay(*args), configure Celery Beat for cron scheduling, and monitor worker health using Flower.',
            ],
            [
                'text' => 'Explain Security Considerations in Django: CSRF protection tokens, SQL injection defense in the ORM, XSS escaping in templates, and clickjacking protection headers.',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Django enables CsrfViewMiddleware by default, injecting {% csrf_token %} into POST forms. The ORM parameterizes queries natively (raw() queries require parameter tuples to prevent SQLi). Django templates auto-escape HTML unless marked |safe. Clickjacking is blocked via X-Frame-Options: DENY in XFrameOptionsMiddleware.',
            ],
            [
                'text' => 'How do you profile and diagnose slow endpoints in Python applications? What is cProfile, and how do database query analyzers (like django-debug-toolbar) reveal bottlenecks?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Use cProfile to measure cumulative time spent in Python functions. In Django, django-debug-toolbar inspects SQL queries, execution time, and duplicate queries per page. For ASGI/FastAPI, use APM tools (OpenTelemetry, Prometheus metrics) to track request latency breakdowns across DB, external HTTP, and compute.',
            ],
            [
                'text' => 'What are Context Managers in Python? Explain the __enter__ and __exit__ dunder methods, and how the contextlib.contextmanager decorator simplifies custom resource handling.',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Context managers manage setup and teardown around code blocks using \'with\'. __enter__ sets up resource (e.g. opens file, acquires lock); __exit__ handles cleanup and exception suppression even if errors occur inside block. contextlib.contextmanager allows writing a generator with try/yield/finally instead of a full class.',
            ],
        ],
    ],
    'java' => [
        1 => [
            [
                'text' => 'Explain the difference between the JDK, JRE, and JVM in Java. How does Java achieve \'Write Once, Run Anywhere\' (WORA) platform independence?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'JDK contains development tools (compiler javac, debugger); JRE provides runtime libraries; JVM executes bytecode (.class) on physical hardware. Platform independence is achieved because javac compiles Java source into bytecode, which any platform-specific JVM can execute via Just-In-Time (JIT) compilation to machine code.',
            ],
            [
                'text' => 'Explain Memory Management in Java: Stack memory versus Heap memory. How does Java Garbage Collection (Eden, Survivor, Tenured/Old generation) reclaim unused objects?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Stack holds primitive local variables and method call frames (LIFO, thread-private); Heap holds all instantiated objects (shared across threads). Generational GC: new objects are allocated in Eden space; surviving Minor GCs move through Survivor spaces (S0/S1); long-lived objects are promoted to Old Generation, collected via Major GC (G1GC/ZGC).',
            ],
            [
                'text' => 'What is the difference between == and equals() in Java? Why must you override hashCode() whenever you override equals() in a class used as a HashMap key?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => '== compares primitive values or object memory reference addresses; equals() evaluates logical state equality. Hash-based collections (HashMap, HashSet) use hashCode() to locate the bucket; if two objects are equal according to equals(), they MUST return the identical hashCode(), otherwise HashMap cannot find existing entries.',
            ],
            [
                'text' => 'Compare ArrayList and LinkedList in the Java Collections Framework. What are their time complexities for random access get(index) versus insertions at the beginning?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'ArrayList uses dynamically resizing contiguous array: O(1) random access get(index), O(N) insertion at beginning (shifting elements). LinkedList uses doubly-linked nodes: O(N) random access (traversing nodes), O(1) insertion at head/tail. ArrayList is almost always preferred due to CPU cache locality and lower memory overhead.',
            ],
            [
                'text' => 'Explain the difference between Checked Exceptions and Unchecked (Runtime) Exceptions in Java. Give an example of each and when each should be thrown.',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Checked exceptions inherit from Exception (excluding RuntimeException) and must be handled via try-catch or declared in throws signature (e.g. IOException, SQLException); used for recoverable external errors. Unchecked exceptions inherit from RuntimeException (e.g. NullPointerException, IllegalArgumentException); represent programming logic defects.',
            ],
        ],
        2 => [
            [
                'text' => 'How does Spring Boot\'s Dependency Injection and Inversion of Control (IoC) work? Compare @Component, @Service, @Repository, and @Controller annotations.',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Spring IoC container instantiates, configures, and manages bean lifecycles. @Component is generic stereotype. @Service denotes business logic layer. @Repository indicates data access layer (enabling automatic translation of database exceptions to Spring\'s DataAccessException). @Controller / @RestController handles HTTP requests.',
            ],
            [
                'text' => 'Explain Spring Boot Auto-Configuration. How do @SpringBootApplication, @EnableAutoConfiguration, and conditional annotations (like @ConditionalOnClass) configure beans automatically?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => '@SpringBootApplication bundles @Configuration, @EnableAutoConfiguration, and @ComponentScan. Auto-configuration inspects classpath dependencies (e.g. finding spring-boot-starter-data-jpa and postgresql driver) and instantiates preconfigured DataSource and EntityManager beans unless explicitly overridden by the developer.',
            ],
            [
                'text' => 'How does Spring Data JPA simplify database operations? Explain how method naming conventions (e.g. findByEmailAndStatus) automatically generate SQL queries.',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Spring Data JPA extends JpaRepository<Entity, ID>, providing CRUD and pagination out-of-the-box. Query derivation parses method names based on entity properties (e.g. findByStatusOrderByCreatedAtDesc), automatically creating JPQL queries at runtime. For complex queries, @Query allows writing custom JPQL or native SQL.',
            ],
            [
                'text' => 'How does transaction management work in Spring Boot using @Transactional? What is the difference between rollback on RuntimeException versus checked exceptions?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => '@Transactional uses Spring AOP proxies to begin, commit, or rollback database transactions around method execution. By default, Spring rolls back ONLY on unchecked exceptions (RuntimeException and Error); checked exceptions commit unless explicitly configured via @Transactional(rollbackFor = Exception.class).',
            ],
            [
                'text' => 'How do you handle global exception handling in Spring Boot REST APIs using @ControllerAdvice and @ExceptionHandler? What is the ProblemDetail specification (RFC 7807)?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => '@ControllerAdvice intercepts exceptions thrown across all controllers. Methods annotated with @ExceptionHandler(EntityNotFoundException.class) construct standardized error response bodies with HTTP status codes. Modern Spring Boot 3 supports RFC 7807 ProblemDetail (type, title, status, detail, instance) for uniform error payloads.',
            ],
        ],
        3 => [
            [
                'text' => 'How does Spring Security filter chain architecture protect web applications? Walk through how UsernamePasswordAuthenticationFilter and JWT filters authenticate incoming requests.',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Spring Security uses a DelegatingFilterProxy invoking a SecurityFilterChain. A custom OncePerRequestFilter extracts Bearer JWT token from header, validates signature with secret key, extracts user authorities, constructs a UsernamePasswordAuthenticationToken, and stores it in SecurityContextHolder.',
            ],
            [
                'text' => 'What are Java Virtual Threads (Project Loom introduced in Java 21)? How do they achieve massive concurrency compared to traditional platform (OS-level) threads?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Traditional Java threads map 1:1 to heavy OS kernel threads (consuming ~1MB stack memory each, limiting systems to thousands of threads). Virtual threads are lightweight user-mode threads managed by the JVM. When a virtual thread blocks on I/O, the JVM unmounts it from the underlying carrier OS thread and mounts another, enabling millions of concurrent threads with low memory.',
            ],
            [
                'text' => 'How do you configure and optimize connection pooling in Spring Boot using HikariCP? What are the critical pool settings (maximumPoolSize, connectionTimeout, idleTimeout)?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'HikariCP is the default ultra-fast JDBC pool in Spring Boot. maximumPoolSize sets ceiling of active connections (calculated based on CPU cores and disk I/O); connectionTimeout sets max ms to wait for a connection before throwing SQLException (prevents thread hanging); idleTimeout frees surplus connections.',
            ],
            [
                'text' => 'Explain the N+1 problem in Hibernate / Spring Data JPA. Compare @EntityGraph and JOIN FETCH queries for optimizing entity relationship retrieval.',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'N+1 happens with Lazy loading when accessing a relationship in a loop, firing N individual queries. JOIN FETCH in JPQL (\'SELECT o FROM Order o JOIN FETCH o.items\') forces Hibernate to load relationships in a single SQL join query. @EntityGraph provides declarative eager loading per repository query without writing custom JPQL.',
            ],
            [
                'text' => 'What are Spring Boot Actuator and Micrometer? How do you expose health checks, metrics, and Prometheus endpoints for production monitoring?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Spring Boot Actuator exposes operational endpoints (/actuator/health, /actuator/metrics, /actuator/info). Micrometer acts as a vendor-neutral facade collecting dimensional metrics (JVM memory, HTTP request latencies, DB pool stats) and exposing a /actuator/prometheus endpoint for Prometheus scraping and Grafana dashboards.',
            ],
        ],
    ],
    'golang' => [
        1 => [
            [
                'text' => 'Explain Goroutines and the Go runtime scheduler (the GMP model: Goroutines, Machines, Processors). Why are goroutines so much lighter than OS threads?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Goroutines start with only 2KB of stack memory that grows dynamically, compared to 1-2MB for OS threads. The GMP scheduler maps M goroutines (G) across P logical processors onto N OS kernel threads (M). It uses work-stealing algorithms and cooperative preemption at function prologues, context-switching in nanoseconds in user space.',
            ],
            [
                'text' => 'How do Channels work in Go? Compare unbuffered channels with buffered channels and explain how channels coordinate data sharing without explicit mutex locks.',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Channels provide synchronized communication between goroutines adhering to: \'Do not communicate by sharing memory; instead, share memory by communicating.\' Unbuffered channels (\'make(chan int)\') block until both sender and receiver are ready (synchronous rendezvous). Buffered channels (\'make(chan int, 5)\') only block when buffer is full (sending) or empty (receiving).',
            ],
            [
                'text' => 'Explain Error Handling philosophy in Go. Why does Go use explicit multiple return values (val, err := func()) instead of try-catch exception blocks?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Go treats errors as ordinary values implementing the error interface (\'Error() string\'). Functions return (T, error). Calling code must explicitly handle \'if err != nil\'. This prevents unexpected control flow jumps, forces developers to consider failure cases at the exact point of occurrence, and makes error propagation transparent.',
            ],
            [
                'text' => 'What is the difference between Array and Slice in Go? How does a slice\'s internal header (pointer to array, length, capacity) behave during append()?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'An array has a fixed compile-time size and is passed by value (copying all elements). A slice is a lightweight 24-byte header referencing an underlying array: pointer (*ptr), length (len), and capacity (cap). When append() exceeds capacity, Go allocates a new larger array (typically 2x), copies elements, and updates the pointer.',
            ],
            [
                'text' => 'Explain the \'defer\' statement in Go. When do deferred functions execute, and how does defer interact with return values and panic recovery?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Deferred calls push functions onto a LIFO stack executed immediately before the surrounding function returns. Arguments are evaluated when defer is declared, not when executed. Defer is used for cleanup (file.Close(), mutex.Unlock()). In combination with recover(), defer intercepts active panics to restore normal execution.',
            ],
        ],
        2 => [
            [
                'text' => 'How do Interfaces work in Go? Why is Go interface implementation considered implicit (\'duck typing\'), and what is the empty interface interface{} (or any in Go 1.18+)?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'A type implements an interface implicitly simply by implementing all methods in the interface signature—no \'implements\' keyword needed. This decouples packages and promotes composition. The empty interface \'interface{}\' (aliased as \'any\') has zero methods, meaning any type in Go satisfies it.',
            ],
            [
                'text' => 'Explain the \'select\' statement in Go. How does select handle multiple channel operations, timeouts with time.After(), and non-blocking channel reads with default?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'select blocks until one of its channel cases can proceed; if multiple are ready, it picks one pseudo-randomly. Adding a case <-time.After(2 * time.Second) implements request timeouts. Adding a \'default:\' case makes channel operations non-blocking, executing immediately if no channel is ready.',
            ],
            [
                'text' => 'How does the \'context\' package (context.Context) manage request cancellation, deadlines, and metadata propagation across goroutines in Go HTTP services?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Context propagates cancellation signals, timeouts, and request-scoped values down a tree of goroutines. When a client cancels an HTTP request, ctx.Done() closes; long-running database or external API operations listening to ctx.Done() terminate immediately, preventing wasted server resources.',
            ],
            [
                'text' => 'How do sync.WaitGroup and sync.Mutex work in Go? Show how to synchronize concurrent worker goroutines and prevent race conditions on shared data.',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'sync.WaitGroup tracks pending goroutines: wg.Add(1), defer wg.Done(), and wg.Wait() blocks until counter reaches 0. sync.Mutex (or RWMutex for read-heavy loads) guards critical sections: mu.Lock() and defer mu.Unlock() ensure only one goroutine accesses shared memory at a time.',
            ],
            [
                'text' => 'How does Go\'s race detector work? How do you run tests with the race detector enabled (-race flag), and what kind of bugs does it catch?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Compile and test using \'go test -race\' or \'go run -race\'. The race detector instruments memory accesses at compile time, tracking synchronization events. It detects data races when two goroutines access the same memory location concurrently and at least one access is a write without synchronization.',
            ],
        ],
        3 => [
            [
                'text' => 'How do you build a high-performance HTTP REST server in Go using chi or Gin? Compare standard library net/http with third-party routers.',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'net/http is production-ready out-of-the-box. Third-party routers like chi (idiomatic, lightweight, 100% net/http compatible) or Gin (radix tree router, built-in binding/validation) simplify URL parameter parsing (/users/{id}), middleware chaining, and JSON payload handling with high allocation efficiency.',
            ],
            [
                'text' => 'How does Database Connection Management work in Go\'s database/sql package? What do SetMaxOpenConns, SetMaxIdleConns, and SetConnMaxLifetime configure?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'database/sql maintains an internal thread-safe connection pool. SetMaxOpenConns limits total concurrent open connections to the DB (prevents exhausting DB connection limits). SetMaxIdleConns maintains warm connections in the pool. SetConnMaxLifetime recycles connections to prevent stale connection errors from firewall/load balancer timeouts.',
            ],
            [
                'text' => 'How do Go Generics (type parameters introduced in Go 1.18) work? How do you write a generic Map() or Filter() function for slices of any type [T any]?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Generics allow functions and data structures to accept type parameters: func Map[T any, R any](items []T, f func(T) R) []R. Constrain types using interface constraints (e.g. comparable for map keys, or constraints.Ordered for comparisons). Go compiler uses GCShape stenciling to share implementation for pointer types, balancing binary size and execution speed.',
            ],
            [
                'text' => 'Explain Profiling and Benchmarking in Go. How do you write a benchmark function (BenchmarkXxx(b *testing.B)) and inspect memory allocations with pprof?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Benchmark functions iterate b.N times; run with \'go test -bench=. -benchmem\' to view nanoseconds per operation and heap allocations per op (B/op, allocs/op). pprof generates interactive CPU, heap, and goroutine profiles viewable via web browser (\'go tool pprof -http=:8080 profile.pb.gz\').',
            ],
            [
                'text' => 'What are best practices for structuring a production Go backend project (e.g. cmd/, internal/, pkg/ directories)? Why is keeping packages in \'internal/\' recommended?',
                'category' => 'architecture',
                'duration_seconds' => 180,
                'note' => 'cmd/<app>/main.go contains binary entrypoints. internal/ contains private application business logic; Go compiler strictly enforces that packages inside internal/ cannot be imported by external modules, preventing accidental public API coupling. pkg/ contains shared libraries safe for external reuse.',
            ],
        ],
    ],
    'php' => [
        1 => [
            [
                'text' => 'Explain the difference between single quotes (\'\') and double quotes ("") in PHP strings. How does variable interpolation and escape sequence parsing differ?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Double quotes parse escape sequences (\\n, \\t) and evaluate embedded variables ("Hello $name"). Single quotes treat characters literally without variable interpolation or escape parsing (except \\\' and \\\\), executing marginally faster and preventing accidental variable interpolation.',
            ],
            [
                'text' => 'How do Associative Arrays work in PHP? What internal data structure does PHP use to implement arrays that support both integer indices and string keys?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'PHP arrays are ordered hash maps (Zend Hashtable). They store bucket arrays of values with hash keys, maintaining an internal doubly-linked list to preserve insertion order for foreach iterations, allowing hybrid numerical indexing and associative key-value mappings seamlessly.',
            ],
            [
                'text' => 'Explain Object-Oriented Programming access modifiers in PHP: public, protected, and private. When should a property be private versus protected in class inheritance?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Public is accessible from anywhere. Protected is accessible only within the defining class and its child/inherited classes. Private is accessible strictly within the defining class. Private prevents child classes from mutating internal state directly, preserving encapsulation.',
            ],
            [
                'text' => 'What are Constructor Property Promotion and Readonly Properties introduced in PHP 8? How do they reduce boilerplate in Data Transfer Objects (DTOs)?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Constructor property promotion allows declaring visibility (public/private/readonly) directly in __construct() arguments, automatically creating and assigning class properties without repetitive declaration and assignment. Readonly properties enforce immutability: once initialized, they cannot be modified.',
            ],
            [
                'text' => 'Explain how Exception Handling works in modern PHP. What is the difference between try, catch, and finally blocks, and can multiple catch blocks handle different exception types?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Code in try executes; if an exception is thrown, execution jumps to matching catch block. Multiple catch blocks can catch specific exceptions (e.g. catch (DatabaseException | NetworkException $e)). Finally block executes unconditionally regardless of whether an exception occurred or was caught, ideal for closing file or socket handles.',
            ],
        ],
        2 => [
            [
                'text' => 'How do PDO Prepared Statements protect PHP applications from SQL injection? Contrast PDO::prepare() and execute() with direct query concatenation.',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'String concatenation allows user inputs containing quotes and SQL commands to alter the query structure. Prepared statements send the SQL template to the database server first to compile the query plan; bound parameters are sent separately as raw data, making it impossible for input to be executed as SQL syntax.',
            ],
            [
                'text' => 'How does Session Management work in PHP? Explain session_start(), how the session cookie (PHPSESSID) coordinates state, and how to prevent Session Fixation attacks.',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'session_start() reads the PHPSESSID cookie sent by browser, loads the serialized session file from disk (or Redis), and populates $_SESSION. Session fixation occurs when an attacker tricks a user into authenticating with a known session ID; prevent by calling session_regenerate_id(true) immediately upon user login.',
            ],
            [
                'text' => 'What are Traits in PHP? How do traits enable code reuse across independent class hierarchies, and how do you resolve method name conflicts between traits?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'PHP has single class inheritance. Traits allow injecting reusable methods into multiple independent classes using the \'use TraitName;\' statement. Method conflicts between two traits are resolved explicitly using the \'insteadof\' operator (e.g. TraitA::method insteadof TraitB) and aliasing with \'as\'.',
            ],
            [
                'text' => 'How do you securely handle file uploads in PHP? Detail the validation checks required on $_FILES (file size, MIME type verification with finfo, sanitizing file names).',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => '1) Verify $_FILES[\'file\'][\'error\'] === UPLOAD_ERR_OK; 2) Validate file size against maximum limits; 3) Check real MIME type using finfo_file (never trust client-supplied $_FILES[\'file\'][\'type\'] or file extension); 4) Sanitize file name and generate random UUID slug; 5) Store outside public web root and move using move_uploaded_file().',
            ],
            [
                'text' => 'What is the difference between include, include_once, require, and require_once in PHP? When does an include failure trigger a Warning versus a Fatal Error?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'include emits an E_WARNING on failure and continues script execution; require emits an E_COMPILE_ERROR (fatal error) and halts script execution immediately. The _once variants track included files and ensure a file is not loaded a second time, preventing duplicate class/function declaration errors.',
            ],
        ],
        3 => [
            [
                'text' => 'What is OPcache in PHP? How does bytecode caching improve execution speed, and what configuration settings (opcache.validate_timestamps, memory_consumption) are critical in production?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'OPcache compiles PHP human-readable scripts into opcode bytecode once and stores them in shared memory, eliminating lexing/parsing overhead on subsequent requests. In production, set opcache.validate_timestamps=0 to avoid checking file modification timestamps on disk, clearing OPcache via FPM reload on deployments.',
            ],
            [
                'text' => 'How does Password Hashing work in modern PHP using password_hash() and password_verify()? Why should MD5 and SHA-256 never be used for passwords?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'MD5 and SHA-256 are designed to be fast, making them vulnerable to GPU brute-force and rainbow table attacks. PHP\'s password_hash($password, PASSWORD_BCRYPT or PASSWORD_ARGON2ID) uses slow key-stretching algorithms with automatic unique cryptographic salt generation and adjustable cost/memory parameters. password_verify() compares timing-safe hashes.',
            ],
            [
                'text' => 'What are PHP Generators and the \'yield\' keyword? Write an example of streaming a 2GB CSV file row-by-row without exceeding a 128MB memory limit.',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Generators pause execution and return values without building an in-memory array. In a while (($row = fgetcsv($handle)) !== false) loop, calling yield $row emits each row sequentially. The calling foreach processes one record at a time, keeping RAM consumption constant at a few kilobytes regardless of file size.',
            ],
            [
                'text' => 'How do you detect and fix Memory Leaks in long-running PHP CLI worker scripts? Explain the role of gc_collect_cycles() and unsetting circular references.',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Standard PHP requests teardown memory at end of request, but CLI queue workers run indefinitely. Leaks happen from static variables accumulating data, unclosed DB cursors, or cyclic references. Use memory_get_usage(), explicitly unset() large objects, invoke gc_collect_cycles() periodically, or restart worker after N jobs.',
            ],
            [
                'text' => 'How do you configure PHP-FPM for high traffic? Explain the pm configuration directives: pm = dynamic vs static, pm.max_children, and pm.max_requests.',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'pm=static dedicates a fixed number of worker processes (ideal for dedicated servers); dynamic scales workers between min/max spare servers based on load. pm.max_children = (Total RAM - OS RAM) / Average PHP Process Size (e.g. 50MB). pm.max_requests (e.g. 1000) automatically recycles workers after N requests to prevent memory leak buildup.',
            ],
        ],
    ],
    'cms' => [
        1 => [
            [
                'text' => 'Explain the difference between an Action Hook and a Filter Hook in WordPress. Provide a code example showing when to use add_action() versus add_filter().',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Action hooks (do_action, add_action) allow executing custom logic at specific lifecycle points (e.g. wp_enqueue_scripts, init) without returning a value. Filter hooks (apply_filters, add_filter) intercept data, modify it, and MUST return the modified value (e.g. modifying the_content or login_redirect).',
            ],
            [
                'text' => 'What is the WordPress Template Hierarchy? What template files does WordPress search for when rendering a single blog post versus an archive page?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Hierarchy determines which theme PHP file renders a request. Single post: single-{post-type}-{slug}.php -> single-{post-type}.php -> single.php -> singular.php -> index.php. Category archive: category-{slug}.php -> category-{id}.php -> category.php -> archive.php -> index.php.',
            ],
            [
                'text' => 'What is \'The Loop\' in WordPress? How do have_posts(), the_post(), the_title(), and the_content() interact with the global $wp_query object?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'The Loop iterates through posts fetched by the main query: while (have_posts()) : the_post();. the_post() advances the internal post pointer and sets up the global $post object, enabling template tags like the_title(), the_permalink(), and the_content() to output contextual post data.',
            ],
            [
                'text' => 'Why must WordPress themes use wp_enqueue_script() and wp_enqueue_style() instead of hardcoding <script> and <link> tags in header.php?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Enqueuing manages asset dependencies (e.g. ensuring jQuery loads before custom script), appends file version query strings for cache busting, prevents duplicate script inclusions by multiple plugins, and allows conditional loading in header vs footer.',
            ],
            [
                'text' => 'What is a Child Theme in WordPress, and why should theme customizations always be made in a child theme rather than editing the parent theme directly?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Editing parent themes causes custom code to be completely wiped out during parent theme updates. A child theme inherits all parent styles and templates while overriding only specified files (functions.php, style.css, template files), ensuring update safety and clean separation of customizations.',
            ],
        ],
        2 => [
            [
                'text' => 'How do you register a Custom Post Type (CPT) and Custom Taxonomy in WordPress using register_post_type() and register_taxonomy() on the \'init\' hook?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Call register_post_type(\'portfolio\', $args) and register_taxonomy(\'portfolio_category\', \'portfolio\', $args) inside an \'init\' hook callback. Configure arguments: public => true, has_archive => true, supports => [\'title\', \'editor\', \'thumbnail\'], and \'show_in_rest\' => true to enable the modern Gutenberg block editor.',
            ],
            [
                'text' => 'How do you query posts in WordPress using WP_Query? Contrast WP_Query with query_posts() and explain why query_posts() should never be used.',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'WP_Query creates independent custom queries ($query = new WP_Query($args); if ($query->have_posts()) ...) followed by wp_reset_postdata(). query_posts() overwrites the main global query, breaking pagination, slowing performance, and causing unpredictable side-effects across theme components.',
            ],
            [
                'text' => 'What are Nonces in WordPress (wp_create_nonce, check_admin_referer)? How do they protect WordPress administrative forms and AJAX actions from CSRF attacks?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Nonces (\'number used once\') are cryptographic tokens valid for a specific user, action, and time window (typically 12-24 hours). Embed with wp_nonce_field(\'delete_action\', \'nonce_name\') in forms. In the processing script or AJAX handler, verify with check_admin_referer() or wp_verify_nonce(), blocking unauthorized forged requests.',
            ],
            [
                'text' => 'How does the WordPress REST API work? How do you register a custom REST endpoint using register_rest_route() with permission callbacks?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Register on \'rest_api_init\' hook using register_rest_route(\'myplugin/v1\', \'/data\', [\'methods\' => \'GET\', \'callback\' => \'handle_data\', \'permission_callback\' => \'is_user_logged_in\']). The permission callback verifies authentication before the main handler executes, preventing unauthorized data access.',
            ],
            [
                'text' => 'What are Post Meta and the wp_postmeta table? How do add_post_meta(), get_post_meta(), and update_post_meta() store custom fields, and how do plugins like ACF simplify this?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'wp_postmeta stores key-value metadata attached to post_id. get_post_meta($post_id, \'key\', true) retrieves values. Storing single=true returns a string/unserialized object. Advanced Custom Fields (ACF) provides a visual UI to define meta boxes and simplifies retrieval with get_field(\'field_name\').',
            ],
        ],
        3 => [
            [
                'text' => 'How do you harden a WordPress production site against common security vulnerabilities? Cover wp-config.php security, file permissions, disabling XML-RPC, and two-factor authentication.',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Security hardening: 1) Change table prefix from default wp_; 2) Move wp-config.php one directory above root and disable file editing (DISALLOW_FILE_EDIT); 3) Set correct file permissions (644 for files, 755 for directories); 4) Disable XML-RPC (xmlrpc.php) to prevent brute-force amplification; 5) Enforce 2FA for admin roles.',
            ],
            [
                'text' => 'How does Caching work in high-traffic WordPress sites? Compare Page Caching (HTML output caching), Object Caching (Redis/Memcached with WP_Object_Cache), and Opcode caching.',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Page caching (WP Super Cache / Cloudflare) serves static HTML directly to anonymous users, bypassing PHP execution. Object caching stores database query results in Redis/Memcached across requests via wp_cache_get/set. Opcode caching (OPcache) caches compiled PHP bytecode in RAM.',
            ],
            [
                'text' => 'What is the Gutenberg Block Editor architecture? Explain the difference between server-rendered dynamic blocks and client-side React-rendered static blocks.',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Static blocks save rendered HTML directly into post_content in the database during post save; client renders instantly. Dynamic blocks save only block attributes and JSON comments (<!-- wp:my-block {"count":5} /-->); when page is requested, PHP callback (render_callback) executes on server to fetch latest dynamic data.',
            ],
            [
                'text' => 'How does Database Optimization work in WordPress? What bloat accumulates in wp_posts and wp_options (transients, post revisions, spam comments), and how do you prune it?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Bloat accumulates from infinite post revisions, auto-drafts, trashed comments, and expired transients in wp_options with autoload=\'yes\'. Prune using WP-CLI (\'wp transient delete --expired\', \'wp post delete $(wp post list --post_type=revision --format=ids)\') and configure WP_POST_REVISIONS constant to cap revisions (e.g. 5).',
            ],
            [
                'text' => 'What is Headless WordPress? How do modern frontend frameworks (Next.js/Astro) fetch content via GraphQL (WPGraphQL) or REST API while using WordPress strictly as a backend CMS?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Headless WordPress decouples content authoring from presentation. Editors manage content in WordPress; modern static site generators fetch data via WPGraphQL queries or REST API during build or on-demand ISR (Incremental Static Regeneration), delivering instant page load speeds, superior SEO, and immunity to frontend WordPress exploits.',
            ],
        ],
    ],
    'api_design' => [
        1 => [
            [
                'text' => 'Explain the difference between Safe HTTP methods and Idempotent HTTP methods according to RFC specifications. Categorize GET, POST, PUT, PATCH, and DELETE.',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Safe methods do not modify server state (GET, HEAD, OPTIONS). Idempotent methods produce the exact same outcome whether executed once or ten times in a row (GET, PUT, DELETE, HEAD). POST is neither safe nor idempotent (repeated calls create duplicate records). PATCH is typically non-idempotent partial update.',
            ],
            [
                'text' => 'Walk through standard HTTP Status Codes: 200, 201, 204, 400, 401, 403, 404, 409, 422, and 500. When should an API return 401 Unauthorized versus 403 Forbidden?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => '200 OK; 201 Created; 204 No Content; 400 Bad Request; 401 Unauthorized (unauthenticated, missing/invalid credentials); 403 Forbidden (authenticated, but lacking permissions for resource); 404 Not Found; 409 Conflict (e.g. duplicate email); 422 Unprocessable Entity (validation error); 500 Internal Server Error.',
            ],
            [
                'text' => 'How should RESTful resource URIs be designed? Explain best practices for plural nouns, sub-resource relationships, and avoiding verbs in endpoints.',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'URIs identify resources, not actions: use nouns in plural (e.g. GET /api/v1/users, POST /api/v1/orders). Nested hierarchies represent relationships: GET /api/v1/users/12/orders. Avoid verbs in URIs (use DELETE /articles/5 instead of /deleteArticle?id=5). Use kebab-case for multi-word paths.',
            ],
            [
                'text' => 'Explain HTTP Content Negotiation. How do the Accept and Content-Type request/response headers coordinate data serialization formats between client and server?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Content-Type header tells the receiver the format of the body being sent (e.g. Content-Type: application/json). Accept header tells the server what formats the client can understand (e.g. Accept: application/json, application/xml). If server cannot provide requested format, it returns 406 Not Acceptable.',
            ],
            [
                'text' => 'What is CORS (Cross-Origin Resource Sharing)? Why does the browser send an HTTP OPTIONS preflight request, and what response headers (Access-Control-Allow-Origin, Methods) are required?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'CORS is a browser security mechanism restricting cross-origin HTTP requests. For non-simple requests (custom headers, PUT/DELETE/PATCH), the browser sends an OPTIONS preflight request asking server permission. Server must respond with Access-Control-Allow-Origin, Access-Control-Allow-Methods, and Access-Control-Allow-Headers.',
            ],
        ],
        2 => [
            [
                'text' => 'Compare Offset-based Pagination (?page=2&limit=20) with Cursor-based Pagination (?cursor=xyz). Why is cursor-based pagination preferred for infinite feeds and large databases?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Offset pagination (OFFSET 10000 LIMIT 20) forces database to scan and discard 10,000 rows (O(N) performance degradation), and suffers skipping/duplicate items when new records are inserted concurrently. Cursor pagination queries WHERE id > last_seen_id ORDER BY id LIMIT 20 using indexes (O(1) execution, stable under concurrent insertions).',
            ],
            [
                'text' => 'How do you design API Error Responses? What information should be returned in a standardized JSON error payload (code, message, details, field errors)?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Error payloads should be consistent across all endpoints: return an HTTP status code, a machine-readable error code string (e.g. \'INVALID_EMAIL\'), a human-readable message, and a details array listing specific field validation errors ({field: \'email\', issue: \'must be a valid email address\'}). Never leak internal stack traces in production.',
            ],
            [
                'text' => 'What are the common API Versioning strategies: URI path (/v1/users), Query parameter (?version=1), and Custom Headers (Accept: application/vnd.company.v1+json)? Discuss trade-offs.',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'URI path versioning (/v1/users) is clear, discoverable, and easily cached by CDNs (most popular). Header versioning adheres strictly to REST principles keeping URIs clean, but is harder to test in browsers. Query parameter versioning is flexible but clutters URLs. Major versions change only on breaking changes.',
            ],
            [
                'text' => 'How does Idempotency Keys work in payment and order APIs? How does passing an \'Idempotency-Key\' header prevent accidental duplicate charges during network timeouts?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Client generates a unique UUID (Idempotency-Key) and sends it with POST /charges. Server caches the key and initial execution result in Redis/DB. If network drops and client retries with the same key, server recognizes the key, skips re-charging the card, and returns the cached response, preventing double payments.',
            ],
            [
                'text' => 'What is OpenAPI / Swagger specification? How does maintaining an OpenAPI schema automate API documentation, mock servers, and client SDK code generation?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'OpenAPI is a standardized JSON/YAML schema describing endpoints, request parameters, request/response bodies, and authentication schemes. It automatically generates interactive documentation (Swagger UI), mock servers for frontend development before backend is ready, and strongly typed client SDKs across languages.',
            ],
        ],
        3 => [
            [
                'text' => 'Compare REST APIs with GraphQL and gRPC. What are the strengths, weaknesses, and ideal use cases for each communication paradigm?',
                'category' => 'architecture',
                'duration_seconds' => 180,
                'note' => 'REST: universal, cacheable, resource-oriented, standard for public APIs. GraphQL: client queries exact fields needed, solving over-fetching and under-fetching in complex mobile/web frontends, but lacks native HTTP caching. gRPC: Protocol Buffers over HTTP/2, binary, ultra-fast, strongly typed, ideal for internal microservice communication.',
            ],
            [
                'text' => 'How do Webhooks work in modern API architectures? How should a webhook provider handle delivery retries with exponential backoff and HMAC signature verification?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Webhooks push real-time event notifications via HTTP POST to consumer endpoints. Provider signs payload using HMAC-SHA256 with a shared secret, sending signature in header (X-Signature) so receiver can verify authenticity. If consumer endpoint returns non-2xx or times out, provider retries with exponential backoff (e.g. 5m, 30m, 2h).',
            ],
            [
                'text' => 'How does API Rate Limiting work using Token Bucket and Leaky Bucket algorithms? What HTTP headers (X-RateLimit-Limit, X-RateLimit-Remaining, Retry-After) communicate limits?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Token Bucket adds tokens at a constant rate up to bucket capacity; each request consumes a token, allowing short bursts of traffic. Leaky Bucket processes requests at a smooth constant rate. Rate limit headers inform clients of their quota: X-RateLimit-Limit (max allowed), X-RateLimit-Remaining (tokens left), and Retry-After (seconds until reset).',
            ],
            [
                'text' => 'How do you design APIs for backward compatibility? What constitutes a breaking change versus a non-breaking change in REST APIs?',
                'category' => 'architecture',
                'duration_seconds' => 180,
                'note' => 'Non-breaking changes: adding new endpoints, adding optional request fields, adding new response fields. Breaking changes: removing or renaming endpoints, removing response fields, changing data types (string to int), adding required request parameters. Use API versioning when breaking changes are unavoidable.',
            ],
            [
                'text' => 'How does an API Gateway (like Kong, AWS API Gateway, or Envoy) fit into microservice architecture? What cross-cutting concerns (routing, auth, rate limiting, logging) does it offload?',
                'category' => 'architecture',
                'duration_seconds' => 180,
                'note' => 'An API Gateway sits as a reverse proxy between clients and internal microservices. It centralizes cross-cutting concerns: SSL termination, client authentication/JWT verification, rate limiting, request routing, response caching, CORS handling, and unified access logging, keeping individual microservices focused strictly on business logic.',
            ],
        ],
    ],
];
