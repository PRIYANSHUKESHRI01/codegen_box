<?php

/**
 * Multi-Parent-Set Framework for AptRun Mock AI Interviews.
 *
 * Each tech stack provides 5 Parent Interview Sets:
 *   - Parent Set 1: Core Fundamentals & System Architecture (Foundational)
 *   - Parent Set 2: Applied Problem Solving & Framework Internals (Intermediate)
 *   - Parent Set 3: Production Engineering, APIs & System Resilience (Applied Production)
 *   - Parent Set 4: Concurrency, Performance Optimization & Security (Advanced)
 *   - Parent Set 5: Enterprise System Design & High-Bar Industry Mastery (FAANG / Tier-1 Mastery)
 *
 * Each Parent Set comprises 3 rounds with real, curated voice interview questions.
 */

return [

    'default_sets' => [
        1 => [
            'title' => 'Series 1: Core Fundamentals & System Architecture',
            'level' => 'Foundational',
            'blurb' => 'Core language mechanics, primitives, execution model, component lifecycle, and baseline architecture.',
            'rounds' => [
                1 => [
                    'title' => 'Round 1: Syntax, Primitives & Language Foundations',
                    'description' => 'Core language features, data types, scoping rules, memory references, and standard library foundations.',
                    'duration_minutes' => 15,
                ],
                2 => [
                    'title' => 'Round 2: Architecture, Lifecycle & Framework Core',
                    'description' => 'Application lifecycle, modular structure, dependency handling, and primary design patterns.',
                    'duration_minutes' => 15,
                ],
                3 => [
                    'title' => 'Round 3: Practical Implementation & Error Handling',
                    'description' => 'Hands-on problem solving, standard error flows, input validation, and baseline algorithmic operations.',
                    'duration_minutes' => 15,
                ],
            ],
        ],
        2 => [
            'title' => 'Series 2: Applied Problem Solving & Framework Internals',
            'level' => 'Intermediate',
            'blurb' => 'Framework deep dive, state management, asynchronous patterns, and real-world feature implementation.',
            'rounds' => [
                1 => [
                    'title' => 'Round 1: Framework Internals & Advanced Design Patterns',
                    'description' => 'Internal lifecycle hooks, inversion of control, factory/observer patterns, and framework conventions.',
                    'duration_minutes' => 15,
                ],
                2 => [
                    'title' => 'Round 2: State Management & Event-Driven Patterns',
                    'description' => 'Managing mutable vs immutable state, pub-sub/event emitters, asynchronous streaming, and reactive data flow.',
                    'duration_minutes' => 15,
                ],
                3 => [
                    'title' => 'Round 3: Real-World Scenario Solving & Robust Workflows',
                    'description' => 'End-to-end feature implementations, edge case handling, business logic validation, and defensive programming.',
                    'duration_minutes' => 15,
                ],
            ],
        ],
        3 => [
            'title' => 'Series 3: Production Engineering, APIs & System Resilience',
            'level' => 'Applied Production',
            'blurb' => 'REST/gRPC contracts, database transactions, caching layers, and production-grade engineering.',
            'rounds' => [
                1 => [
                    'title' => 'Round 1: API Design, Serialization & Service Contracts',
                    'description' => 'RESTful endpoints, GraphQL/gRPC schemas, validation, rate limiting, and backwards-compatible APIs.',
                    'duration_minutes' => 15,
                ],
                2 => [
                    'title' => 'Round 2: Database Persistence, Query Tuning & Transactions',
                    'description' => 'ORM nuances, raw SQL query optimization, indexes, connection pooling, and multi-table transaction consistency.',
                    'duration_minutes' => 15,
                ],
                3 => [
                    'title' => 'Round 3: Production Reliability, Queues & Observability',
                    'description' => 'Logging, metrics, health checks, background job processing, queue backpressure, and zero-downtime upgrades.',
                    'duration_minutes' => 15,
                ],
            ],
        ],
        4 => [
            'title' => 'Series 4: Concurrency, Performance Optimization & Security',
            'level' => 'Advanced',
            'blurb' => 'High-throughput concurrency, profiling, memory leaks, OWASP security vulnerabilities, and latency mitigation.',
            'rounds' => [
                1 => [
                    'title' => 'Round 1: Concurrency, Threading & Asynchronous Safety',
                    'description' => 'Event loop vs thread pool, locks, deadlocks, race conditions, atomic operations, and parallel execution safety.',
                    'duration_minutes' => 15,
                ],
                2 => [
                    'title' => 'Round 2: Performance Profiling, Memory Leaks & Latency Optimization',
                    'description' => 'Memory leak detection, GC tuning, caching layers (Redis/Memcached), payload compression, and CPU hotspots.',
                    'duration_minutes' => 15,
                ],
                3 => [
                    'title' => 'Round 3: Application Security, Hardening & OWASP Defense',
                    'description' => 'OWASP Top 10 defense, injection mitigation, CORS/CSRF, JWT/OAuth tokens, cryptographic signing, and safe sanitization.',
                    'duration_minutes' => 15,
                ],
            ],
        ],
        5 => [
            'title' => 'Series 5: Enterprise System Design & High-Bar Industry Mastery',
            'level' => 'FAANG / Tier-1 Mastery',
            'blurb' => 'Large-scale distributed architecture, CAP theorem trade-offs, fault tolerance, and senior technical interview scenarios.',
            'rounds' => [
                1 => [
                    'title' => 'Round 1: Distributed Architecture, Microservices & Scalability',
                    'description' => 'Horizontal scaling, load balancing, database sharding, CQRS, and microservices decomposition.',
                    'duration_minutes' => 15,
                ],
                2 => [
                    'title' => 'Round 2: Fault Tolerance, High Availability & Disaster Recovery',
                    'description' => 'Circuit breakers, distributed consensus, retry backoff with jitter, idempotency, and disaster recovery.',
                    'duration_minutes' => 15,
                ],
                3 => [
                    'title' => 'Round 3: Senior Architectural Trade-offs & Production Outage Defense',
                    'description' => 'Evaluating complex trade-offs, resolving live production outages, legacy refactoring, and senior technical interview questions.',
                    'duration_minutes' => 15,
                ],
            ],
        ],
        6 => [
            'title' => 'Series 6: Advanced Asynchronous Architecture & Event-Driven Systems',
            'level' => 'Event-Driven Mastery',
            'blurb' => 'Asynchronous streaming, event pub/sub brokers, reactive pipelines, and message-driven architectures.',
            'rounds' => [
                1 => [
                    'title' => 'Round 1: Event Brokers, Kafka/RabbitMQ & Stream Processing',
                    'description' => 'Publish-subscribe topologies, consumer group offsets, partition balancing, and stream processing primitives.',
                    'duration_minutes' => 15,
                ],
                2 => [
                    'title' => 'Round 2: Background Job Queues, Backpressure & Worker Pools',
                    'description' => 'Asynchronous worker scaling, queue backpressure mitigation, priority queues, and rate-limited dispatching.',
                    'duration_minutes' => 15,
                ],
                3 => [
                    'title' => 'Round 3: Idempotent Consumers, Dead Letter Queues & Replay Architecture',
                    'description' => 'Exactly-once processing semantics, poison pill handling with DLQs, transactional outbox pattern, and event replay.',
                    'duration_minutes' => 15,
                ],
            ],
        ],
        7 => [
            'title' => 'Series 7: High-Throughput Data Persistence, Caching & Distributed Storage',
            'level' => 'Data Engineering',
            'blurb' => 'Multi-tier caching, query execution plans, database partitioning, and polyglot persistence models.',
            'rounds' => [
                1 => [
                    'title' => 'Round 1: Distributed Caching, Cache Stampede & Write-Through Strategies',
                    'description' => 'Cache-aside vs write-through, probabilistic early expiration, thundering herd prevention, and Redis clustering.',
                    'duration_minutes' => 15,
                ],
                2 => [
                    'title' => 'Round 2: Database Partitioning, Read Replicas & Connection Pooling',
                    'description' => 'Horizontal and vertical partitioning, replication lag mitigation, connection pool sizing, and query execution plans.',
                    'duration_minutes' => 15,
                ],
                3 => [
                    'title' => 'Round 3: Polyglot Persistence, NoSQL Trade-offs & Consistency Models',
                    'description' => 'Relational vs Document vs Columnar vs Graph stores, eventual consistency trade-offs, and ACID vs BASE paradigms.',
                    'duration_minutes' => 15,
                ],
            ],
        ],
        8 => [
            'title' => 'Series 8: Cloud Native Infrastructure, Reliability & Chaos Engineering',
            'level' => 'SRE / Cloud Native',
            'blurb' => 'Container orchestration, distributed tracing, zero-downtime releases, and chaos engineering resilience.',
            'rounds' => [
                1 => [
                    'title' => 'Round 1: Container Orchestration, Service Meshes & Traffic Routing',
                    'description' => 'Kubernetes ingress, service mesh sidecars, canary/blue-green traffic shifting, and health probe configurations.',
                    'duration_minutes' => 15,
                ],
                2 => [
                    'title' => 'Round 2: Distributed Tracing, APM Metrics & Golden Signals Observability',
                    'description' => 'OpenTelemetry standards, distributed context propagation, 4 golden signals (latency, traffic, errors, saturation), and alerting.',
                    'duration_minutes' => 15,
                ],
                3 => [
                    'title' => 'Round 3: Chaos Engineering, Self-Healing Systems & Post-Mortem Defense',
                    'description' => 'Fault injection testing, graceful degradation, circuit breaker configurations, and live post-mortem incident review.',
                    'duration_minutes' => 15,
                ],
            ],
        ],
        9 => [
            'title' => 'Series 9: Enterprise Security Hardening, Cryptography & Compliance',
            'level' => 'Security Architecture',
            'blurb' => 'Zero-trust architecture, OAuth2/OIDC token flows, cryptographic security, and enterprise compliance.',
            'rounds' => [
                1 => [
                    'title' => 'Round 1: Identity, Modern Authentication (OAuth2/OIDC) & RBAC/ABAC',
                    'description' => 'OAuth2 PKCE authorization flows, JWT signature validation, identity federation, and fine-grained ABAC permissions.',
                    'duration_minutes' => 15,
                ],
                2 => [
                    'title' => 'Round 2: Cryptographic Primitives, Key Rotation & Secrets Management',
                    'description' => 'Symmetric vs asymmetric encryption, envelope encryption, automated KMS key rotation, and secret zeroization.',
                    'duration_minutes' => 15,
                ],
                3 => [
                    'title' => 'Round 3: Zero Trust Architecture, API Gateways & Secure SDLC',
                    'description' => 'Microsegmentation, mTLS mutual authentication, WAF rate limiting, dependency auditing, and supply chain security.',
                    'duration_minutes' => 15,
                ],
            ],
        ],
        10 => [
            'title' => 'Series 10: FAANG / Staff-Level System Design & Planetary Scale Mastery',
            'level' => 'Staff-Level FAANG',
            'blurb' => 'Planetary scale distributed systems, consensus protocols, multi-region active-active deployments, and executive trade-offs.',
            'rounds' => [
                1 => [
                    'title' => 'Round 1: Planetary Scale Distributed Design & Multi-Region Replication',
                    'description' => 'Geo-distributed routing, active-active data center synchronisation, conflict-free replicated data types (CRDTs), and latency budgets.',
                    'duration_minutes' => 15,
                ],
                2 => [
                    'title' => 'Round 2: Consensus Protocols, CAP/PACELC Trade-offs & High Availability',
                    'description' => 'Raft and Paxos leader election, split-brain resolution, quorum reads/writes, and PACELC latency-consistency boundaries.',
                    'duration_minutes' => 15,
                ],
                3 => [
                    'title' => 'Round 3: Senior Architectural Decision-Making & Production Outage Defense',
                    'description' => 'System modernization trade-offs, business vs technical alignment, catastrophic cascading failure defense, and executive technical leadership.',
                    'duration_minutes' => 15,
                ],
            ],
        ],
    ],

    /*
     * Stack-specific custom titles for enhanced authenticity across flagship tech stacks.
     */
    'stacks' => [
        'react_nextjs' => [
            1 => [
                'title' => 'Series 1: React Fundamentals & Hooks Lifecycle',
                'blurb' => 'JSX compilation, Virtual DOM reconciliation, useState, useEffect, and component lifecycle.',
            ],
            2 => [
                'title' => 'Series 2: Server Components, Next.js App Router & State Architecture',
                'blurb' => 'React Server Components (RSC), App Router layouts, streaming with Suspense, and global state with Zustand/Context.',
            ],
            3 => [
                'title' => 'Series 3: Production Data Fetching, Mutations & Hydration',
                'blurb' => 'TanStack Query (React Query), Server Actions, optimistic UI updates, hydration errors, and route handlers.',
            ],
            4 => [
                'title' => 'Series 4: Rendering Performance, Bundle Optimization & Security',
                'blurb' => 'Core Web Vitals (INP, LCP, CLS), dynamic imports, code splitting, memoization caveats, and XSS sanitization.',
            ],
            5 => [
                'title' => 'Series 5: Enterprise Micro-Frontends & High-Scale Web Architecture',
                'blurb' => 'Module Federation, multi-zone Next.js, design systems at scale, edge middleware, and high-traffic resilience.',
            ],
        ],
        'nodejs' => [
            1 => [
                'title' => 'Series 1: Node.js Architecture, Event Loop & V8 Internals',
                'blurb' => 'Libuv event loop phases (timers, I/O, check, microtasks), Streams, Buffers, and commonJS vs ES modules.',
            ],
            2 => [
                'title' => 'Series 2: Express / Fastify Framework Internals & Middleware Chains',
                'blurb' => 'HTTP request pipeline, asynchronous middleware error propagation, route matching, and schema-based serialization.',
            ],
            3 => [
                'title' => 'Series 3: REST & Streaming APIs, Prisma / TypeORM & Redis Caching',
                'blurb' => 'Chunked transfers, backpressure in streams, database transactions with Prisma, and distributed caching patterns.',
            ],
            4 => [
                'title' => 'Series 4: Worker Threads, Cluster Mode, Memory Profiling & Security',
                'blurb' => 'Multi-core scaling with cluster, worker_threads for CPU tasks, heap dump debugging, and prototype pollution defense.',
            ],
            5 => [
                'title' => 'Series 5: Distributed Node.js Microservices, Message Brokers & Scale',
                'blurb' => 'Kafka/RabbitMQ event streams, gRPC communication, circuit breaking, distributed tracing, and zero-downtime clustering.',
            ],
        ],
        'python' => [
            1 => [
                'title' => 'Series 1: Python Core, Memory Model & Data Model',
                'blurb' => 'Dunder methods, memory management (reference counting & cyclic GC), decorators, generators, and packaging.',
            ],
            2 => [
                'title' => 'Series 2: FastAPI / Django Internals, Asynchronous I/O & ORM',
                'blurb' => 'Pydantic validation, ASGI vs WSGI, async/await event loops, Django ORM query optimization, and signals.',
            ],
            3 => [
                'title' => 'Series 3: Production API Engineering, Celery Queues & Database Transactions',
                'blurb' => 'Celery worker pools with Redis/RabbitMQ, database connection pooling, ACID transaction boundaries, and rate limiting.',
            ],
            4 => [
                'title' => 'Series 4: Concurrency (GIL, asyncio, multiprocessing) & Profiling',
                'blurb' => 'Global Interpreter Lock (GIL) circumvention, multiprocessing, cProfile hotspot analysis, and memory leak mitigation.',
            ],
            5 => [
                'title' => 'Series 5: Distributed Python Systems, Event-Driven Services & High-Bar Scenarios',
                'blurb' => 'High-throughput event streaming, distributed lock management, service meshes, and senior architectural trade-offs.',
            ],
        ],
        'java' => [
            1 => [
                'title' => 'Series 1: Java Core, JVM Memory Model & OOP Foundations',
                'blurb' => 'JVM architecture (heap, stack, metaspace), classloaders, garbage collection basics, generics, and collections.',
            ],
            2 => [
                'title' => 'Series 2: Spring Boot Internals, Dependency Injection & JPA',
                'blurb' => 'ApplicationContext, bean scopes, proxy patterns, Spring Data JPA, Hibernate caching levels, and transactional isolation.',
            ],
            3 => [
                'title' => 'Series 3: Microservices, Spring Cloud, Kafka & Distributed Transactions',
                'blurb' => 'Service discovery, API gateway routing, Kafka event streaming, Saga pattern, and distributed consistency.',
            ],
            4 => [
                'title' => 'Series 4: JVM Garbage Collection Tuning, Multi-threading & Virtual Threads',
                'blurb' => 'G1/ZGC garbage collector tuning, thread pools, Java 21 Project Loom virtual threads, and synchronized locks.',
            ],
            5 => [
                'title' => 'Series 5: Enterprise Distributed Systems, Resilience4j & High-Scale Design',
                'blurb' => 'Fault tolerance with Resilience4j, multi-region database failover, observability (Micrometer/Prometheus), and FAANG scenarios.',
            ],
        ],
        'laravel' => [
            1 => [
                'title' => 'Series 1: Laravel Service Container, Routing & Eloquent Foundations',
                'blurb' => 'IoC container resolution, service providers, eloquent relationships, middleware pipeline, and form requests.',
            ],
            2 => [
                'title' => 'Series 2: Advanced Eloquent, Query Scopes & Event-Listener Patterns',
                'blurb' => 'Local/global query scopes, polymorphic relations, event broadcasting, model observers, and custom collections.',
            ],
            3 => [
                'title' => 'Series 3: Queue Workers, Redis, Database Transactions & API Resources',
                'blurb' => 'Laravel Horizon queue management, Redis caching with tags, DB transactions, API resources, and rate limiting.',
            ],
            4 => [
                'title' => 'Series 4: Laravel Octane / Swoole, Query Optimization & Security',
                'blurb' => 'High-performance stateful servers with Octane, N+1 query elimination, SQL indexing, and Sanctum/Passport token security.',
            ],
            5 => [
                'title' => 'Series 5: Multi-Tenant Architecture, High-Availability Laravel & System Design',
                'blurb' => 'Multi-database tenancy, zero-downtime deployment (Envoy), distributed session storage, and enterprise scale.',
            ],
        ],
    ],
];
