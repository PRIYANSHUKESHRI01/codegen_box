<?php

// Mock AI Interview practice questions: C# & .NET (csharp_dotnet) and ASP.NET Core (aspnet_core), both under the Backend role.
// stack key => round number => 5 questions. The three rounds are the stack's Series-1 set themes (config/curated_interview_domains.php).
// Loaded by database/seeders/MockInterviewQuestionsSeeder (glob) and by the 2026_11_19_100000 migration, both as idempotent upserts.

$t = static fn (string $text, string $note): array => [
    'text' => $text, 'category' => 'technical', 'duration_seconds' => 180, 'note' => $note,
];

return [

    'csharp_dotnet' => [

        // Round 1 — C# Language Core & OOP
        1 => [
            $t('What is the difference between a class and a struct in C#? Give an example of when you would use each.',
                'Classes are reference types allocated on the heap and copied by reference; structs are value types copied by value, best for small immutable data such as a point or a money amount. Structs cannot inherit from another class, and large or mutable structs hurt performance and cause confusing copies.'),
            $t('Explain the difference between an abstract class and an interface in C#. When do you use which?',
                'An abstract class can contain fields, constructors and implemented methods and is used for a shared base in an is-a hierarchy; an interface declares a contract that unrelated classes can implement, and a class can implement many interfaces. Prefer interfaces for loose coupling and testing, abstract classes when sharing state and behaviour.'),
            $t('What is the difference between const, readonly and static readonly in C#?',
                'const is a compile-time constant substituted into the code (only primitives and strings); readonly is assigned at declaration or in the constructor so each instance can differ; static readonly is assigned once per type at run time. Changing a const in a library requires recompiling its consumers, which is why public values that may change should be static readonly.'),
            $t('What do the ref, out and in keywords do when passing parameters to a method?',
                'ref passes a variable by reference and it must be initialised before the call; out passes by reference and the method must assign it before returning (used for extra return values like TryParse); in passes by reference as read-only, avoiding copies of large structs.'),
            $t('Explain virtual, override and new (method hiding) in C#. What is polymorphism and how does it relate to them?',
                'A virtual method can be overridden in a derived class and the runtime picks the implementation by the actual object type, which is polymorphism. new hides a base method instead, so the called method depends on the compile-time variable type, which often causes bugs. Use override for polymorphic behaviour.'),
        ],

        // Round 2 — LINQ, Async & Collections
        2 => [
            $t('What is the difference between an array and a List<T> in C#? When do you use each?',
                'An array has a fixed size and is slightly more efficient; List<T> is a resizable collection with Add, Remove and Insert methods, internally using an array that grows. Use arrays for fixed-size data and performance-critical code, List<T> for most everyday collections.'),
            $t('How does a Dictionary<TKey, TValue> work internally and what is the average time to look up a value? Why do keys need good GetHashCode and Equals implementations?',
                'A dictionary hashes the key to find a bucket and then compares keys with Equals, giving average O(1) lookup, insert and removal. Poor hash codes cause many collisions and degrade it towards O(n); keys must have stable hash codes and consistent equality, so mutable keys are dangerous.'),
            $t('What is LINQ? Show examples of Where, Select, GroupBy and OrderBy, and explain what deferred execution means.',
                'LINQ is a set of query operators over collections and data sources. Where filters, Select projects, GroupBy groups and OrderBy sorts. Deferred execution means the query runs only when you enumerate it (foreach, ToList, Count), so changes to the source before that point are included and repeated enumeration repeats the work.'),
            $t('Explain async and await in C# with a simple example such as downloading a web page. What problem do they solve?',
                'async and await let you write non-blocking code that reads like synchronous code: await pauses the method until the Task completes without blocking the thread, so a UI stays responsive and a server can handle many requests with few threads. A method returns Task or Task<T>, and you should avoid blocking with .Result.'),
            $t('What are delegates and events in C#? Give an example of using Action, Func and an event handler.',
                'A delegate is a type-safe reference to a method. Action represents a method returning void and Func a method returning a value. An event is built on a delegate and lets a publisher notify subscribers (button clicked, order placed) while preventing outsiders from invoking it; subscribers should unsubscribe to avoid leaks.'),
        ],

        // Round 3 — Runtime, Memory & Production .NET
        3 => [
            $t('What is the CLR and what does the JIT compiler do? How does .NET (modern) differ from the old .NET Framework?',
                'The CLR is the runtime that loads assemblies, manages memory, security and execution. C# compiles to IL, and the JIT turns IL into machine code at run time. .NET Framework is Windows-only; modern .NET (formerly .NET Core) is cross-platform, open source, faster and the one where new features are added.'),
            $t('How does garbage collection work in .NET? What are generations, and why might you still need to dispose of objects?',
                'The GC automatically frees unused managed objects using generations (0, 1, 2), assuming most objects die young. It does not know about unmanaged resources such as file handles, sockets or database connections, so you implement IDisposable and use using statements to release them promptly.'),
            $t('What does the using statement do and how do you implement IDisposable in a class?',
                'using calls Dispose in a finally block when the scope ends, even if an exception occurs. A class that owns disposable or unmanaged resources implements IDisposable with a Dispose method that releases them, and callers wrap instances in using so cleanup is deterministic.'),
            $t('How should exceptions be handled in C#? Explain try, catch, finally, throw versus throw ex, and custom exceptions.',
                'Catch only exceptions you can handle, most specific first, use finally for cleanup, and rethrow with throw; to keep the stack trace (throw ex resets it). Create custom exceptions for meaningful domain errors, and avoid using exceptions for normal control flow because they are slow.'),
            $t('Name some modern C# features you have used such as records, pattern matching, nullable reference types, top-level statements and string interpolation, and explain why they help.',
                'Records give concise immutable types with value equality; pattern matching and switch expressions simplify branching; nullable reference types find possible null errors at compile time; top-level statements remove boilerplate in small programs; string interpolation makes formatting readable. Together they reduce code and bugs.'),
        ],
    ],

    'aspnet_core' => [

        // Round 1 — Middleware, Routing & Dependency Injection
        1 => [
            $t('What is middleware in ASP.NET Core and how does the request pipeline work? Why does the order of middleware matter?',
                'Middleware are components that form a pipeline; each handles the request, calls the next one and can act on the response on the way back. Order matters because each component sees the request only after the earlier ones: for example, authentication must run before authorization and exception handling should be first so it wraps everything.'),
            $t('Explain dependency injection in ASP.NET Core and the lifetimes Transient, Scoped and Singleton with an example of each.',
                'The built-in container creates and supplies services, which are registered in Program.cs. Transient: a new instance every time (lightweight helper). Scoped: one per HTTP request (DbContext). Singleton: one for the whole app (configuration or a cache). Injecting a scoped service into a singleton is a bug.'),
            $t('What does the Program.cs file do in a modern ASP.NET Core app, and how does the minimal hosting model differ from the older Startup class?',
                'Program.cs creates the WebApplication builder, registers services, builds the app and configures the middleware pipeline and endpoints, then runs it. The older style split this into Program and Startup (ConfigureServices and Configure); .NET 6 merged them into one file with top-level statements.'),
            $t('How does routing work in ASP.NET Core? Compare controllers with attribute routes and minimal API endpoints.',
                'Routing maps a URL and HTTP method to an endpoint. Controllers use attributes such as [Route] and [HttpGet] on action methods; minimal APIs map handlers directly with app.MapGet and app.MapPost. Both support route parameters and constraints; controllers add filters and conventions, minimal APIs are shorter and lighter.'),
            $t('How do you manage configuration and different environments (Development, Staging, Production) in ASP.NET Core?',
                'Configuration comes from appsettings.json, appsettings.{Environment}.json, user secrets in development, environment variables and the command line, with later sources overriding earlier ones. The ASPNETCORE_ENVIRONMENT variable selects the environment, and typed settings are read with the options pattern; secrets are never committed.'),
        ],

        // Round 2 — Web APIs, EF Core & Data Access
        2 => [
            $t('How do you build a REST API with controllers in ASP.NET Core? Describe the [ApiController] attribute, ActionResult and the HTTP status codes you return.',
                'Create a controller class with [ApiController] and route attributes, and actions that return ActionResult<T>. Return 200 for success, 201 Created with the new location, 204 for no content, 400 for invalid input, 401 and 403 for authentication and authorisation failures, and 404 when not found. [ApiController] adds automatic validation responses and binding inference.'),
            $t('How do you validate request data in an ASP.NET Core API, and why should you use DTOs instead of exposing your database entities?',
                'Use data annotations such as [Required] and [StringLength], or FluentValidation, and let [ApiController] return a 400 automatically. DTOs expose only the fields the client needs, prevent over-posting (clients setting fields they should not), avoid leaking internal columns and decouple the API contract from the database.'),
            $t('What is Entity Framework Core? Explain DbContext, DbSet, migrations and how you would add a new column to a table.',
                'EF Core is an ORM that maps C# classes to tables. DbContext represents the database session and DbSet<T> a table. Migrations record schema changes as code: to add a column you add the property to the entity, run dotnet ef migrations add, review the generated migration and apply it with dotnet ef database update.'),
            $t('How do you load related data in EF Core? Explain Include, lazy loading and why the N+1 problem hurts performance.',
                'Include loads related entities in the same query using joins; lazy loading fetches related data on first access, which can trigger one extra query per row (the N+1 problem) and slow down lists dramatically. Prefer Include or, better, a Select projection that fetches only the columns needed.'),
            $t('Why do we use async and await in controller actions, and what happens if you block with .Result or .Wait()?',
                'Async actions release the thread while waiting for I/O such as database or HTTP calls, so the server can handle more requests with the same threads. Blocking with .Result or .Wait() holds a thread, which under load exhausts the thread pool, makes requests slow and can cause deadlocks.'),
        ],

        // Round 3 — Security, Performance & Production
        3 => [
            $t('What is the difference between authentication and authorization in ASP.NET Core? Explain how JWT bearer authentication and the [Authorize] attribute work.',
                'Authentication verifies who the user is; authorization checks what they can access. With JWT bearer authentication the client sends a signed token in the Authorization header, the middleware validates the signature, issuer, audience and expiry and builds the user from its claims, and [Authorize] (with roles or policies) protects controllers and endpoints.'),
            $t('What are CORS and CSRF, and how do you configure or defend against them in ASP.NET Core?',
                'CORS is a browser mechanism that controls which origins may call your API, configured with AddCors and a policy listing allowed origins, methods and headers (never allow any origin with credentials). CSRF is an attack that abuses cookie authentication to send unwanted requests; defend with antiforgery tokens and SameSite cookies, and it is much less relevant with bearer tokens.'),
            $t('How do you handle errors and logging in ASP.NET Core? Mention exception handling middleware, ILogger and log levels.',
                'Use a global exception handler (UseExceptionHandler) that returns a safe ProblemDetails response instead of stack traces. Inject ILogger<T> and log with levels (Information, Warning, Error, Critical) and structured message templates, sending logs to a central system such as Serilog sinks or Application Insights.'),
            $t('How do you deploy an ASP.NET Core application? Explain Kestrel, a reverse proxy such as IIS or Nginx, and a basic Docker deployment.',
                'Kestrel is the cross-platform web server inside the app; in production it usually sits behind a reverse proxy (IIS, Nginx or a cloud load balancer) that handles TLS and load balancing. With Docker you publish the app, build an image from the official ASP.NET runtime image, expose the port and pass configuration through environment variables.'),
            $t('How can you improve the performance of an ASP.NET Core application? Mention caching with IMemoryCache, response compression and health checks.',
                'Cache expensive or frequently read data with IMemoryCache or a distributed cache such as Redis (with sensible expiry), enable response compression, use async I/O, optimise database queries and indexes, and measure before tuning. Health check endpoints help load balancers and orchestrators detect unhealthy instances.'),
        ],
    ],
];
