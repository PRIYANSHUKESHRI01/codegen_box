import os
import sys

sys.path.append(os.path.dirname(__file__))
from vault_helper import write_php_file

OUT_DIR = os.path.join(os.path.dirname(__file__), 'mock_questions_parent_sets')
os.makedirs(OUT_DIR, exist_ok=True)

def make_q(text, note, topic, duration=180, category='technical'):
    return {
        'text': text,
        'category': category,
        'duration_seconds': duration,
        'note': note,
        'topic': topic,
        'needs_review': False,
        'origin': 'staff',
        'image': None
    }

# Technical Stack metadata and domain definitions
STACK_META = {
    # Backend
    'laravel': {'name': 'Laravel (PHP)', 'domain': 'PHP & Laravel ecosystem', 'group': 'backend'},
    'nodejs': {'name': 'Node.js & TypeScript', 'domain': 'Node.js runtime & event loop', 'group': 'backend'},
    'python': {'name': 'Python & FastAPI/Django', 'domain': 'Python runtime & asynchronous backends', 'group': 'backend'},
    'java': {'name': 'Java & Spring Boot', 'domain': 'JVM memory, Spring Boot & enterprise microservices', 'group': 'backend'},
    'golang': {'name': 'Go (Golang)', 'domain': 'Go runtime, goroutines, channels & systems backend', 'group': 'backend'},
    'php': {'name': 'Modern Core PHP 8+', 'domain': 'PHP 8.2+ JIT, fibers, memory model & internals', 'group': 'backend'},
    'csharp_dotnet': {'name': 'C# & .NET', 'domain': 'CLR, memory management & C# modern features', 'group': 'backend'},
    'aspnet_core': {'name': 'ASP.NET Core', 'domain': 'Kestrel web server, middleware, DI & microservices', 'group': 'backend'},
    'cms': {'name': 'Headless CMS & Content Platforms', 'domain': 'Strapi, Contentful, webhooks & decoupled architecture', 'group': 'backend'},
    'api_design': {'name': 'API Architecture & Protocol Engineering', 'domain': 'REST, gRPC, GraphQL, WebSocket & API gateways', 'group': 'backend'},

    # Frontend
    'react_nextjs': {'name': 'React & Next.js', 'domain': 'React Server Components, Next.js App Router & state architectures', 'group': 'frontend'},
    'typescript': {'name': 'Advanced TypeScript', 'domain': 'Type system internals, conditional types & compiler APIs', 'group': 'frontend'},
    'web_fundamentals': {'name': 'Web Platform & Browser Internals', 'domain': 'DOM parsing, rendering pipeline, V8 optimizations & Web Workers', 'group': 'frontend'},
    'angular': {'name': 'Angular', 'domain': 'Angular Signals, standalone components, RxJS & change detection', 'group': 'frontend'},
    'ui_ux': {'name': 'UI Engineering & Design Systems', 'domain': 'Component tokens, accessibility WCAG, animations & layout algorithms', 'group': 'frontend'},
    'mern': {'name': 'MERN Stack Engineering', 'domain': 'Full-stack MongoDB, Express, React, Node integration & security', 'group': 'frontend'},
    'nextjs_fullstack': {'name': 'Next.js Fullstack Architecture', 'domain': 'Server Actions, edge routing, Prisma & database streaming', 'group': 'frontend'},
    'ecommerce': {'name': 'E-Commerce Platform Engineering', 'domain': 'Checkout flows, inventory race conditions, payment gateways & cart consistency', 'group': 'frontend'},

    # AI, DevOps & Data
    'llm_rag': {'name': 'LLM Applications & RAG Systems', 'domain': 'Retrieval-Augmented Generation, vector embeddings, chunking & evaluation', 'group': 'ai_devops_data'},
    'deeplearning_pytorch': {'name': 'Deep Learning & PyTorch', 'domain': 'Tensor operations, autograd, distributed training (DDP/FSDP) & CUDA', 'group': 'ai_devops_data'},
    'machine_learning': {'name': 'Machine Learning Engineering', 'domain': 'Feature stores, model drift, pipeline orchestration & ML serving', 'group': 'ai_devops_data'},
    'nlp': {'name': 'Natural Language Processing', 'domain': 'Transformers, self-attention, tokenization & text generation', 'group': 'ai_devops_data'},
    'robotics': {'name': 'Robotics & Control Systems', 'domain': 'ROS2, state estimation, path planning & sensor fusion', 'group': 'ai_devops_data'},
    'docker_k8s': {'name': 'Docker & Kubernetes', 'domain': 'Cgroups, namespaces, pod lifecycle, operators & CRDs', 'group': 'ai_devops_data'},
    'cloud_computing': {'name': 'Cloud Infrastructure & Architecture', 'domain': 'AWS/GCP/Azure multi-region, IAM policies & well-architected framework', 'group': 'ai_devops_data'},
    'cloud_infrastructure': {'name': 'Terraform & Infrastructure as Code', 'domain': 'State locking, modules, drift detection & GitOps', 'group': 'ai_devops_data'},
    'data_analytics': {'name': 'Data Analytics & Business Intelligence', 'domain': 'Cohort analysis, retention metrics, dimensional modeling & statistical tests', 'group': 'ai_devops_data'},
    'sql': {'name': 'Advanced SQL & Database Internals', 'domain': 'Window functions, CTEs, query plan execution & B-Tree indexes', 'group': 'ai_devops_data'},
    'power_bi': {'name': 'Power BI & Enterprise Analytics', 'domain': 'DAX evaluation context, star schema design & row-level security', 'group': 'ai_devops_data'},
    'data_science': {'name': 'Data Science & Statistical Modeling', 'domain': 'Hypothesis testing, causal inference, regression & predictive modeling', 'group': 'ai_devops_data'},
    'data_mining': {'name': 'Data Mining & Pattern Discovery', 'domain': 'Clustering, association rules, outlier detection & data wrangling', 'group': 'ai_devops_data'},
    'data_engineering': {'name': 'Data Engineering & Big Data', 'domain': 'Apache Spark, Delta Lake, data pipelines & stream ingestion', 'group': 'ai_devops_data'},

    # Systems & CS Core
    'cyber_security': {'name': 'Cybersecurity & Threat Defense', 'domain': 'Network security, vulnerability assessment, SIEM & penetration testing', 'group': 'systems_cs'},
    'ethical_hacking': {'name': 'Ethical Hacking & Red Teaming', 'domain': 'Exploitation frameworks, web app pentesting & privilege escalation', 'group': 'systems_cs'},
    'cryptography': {'name': 'Applied Cryptography & PKI', 'domain': 'Asymmetric encryption, zero-knowledge proofs, hashing & TLS handshake', 'group': 'systems_cs'},
    'software_testing': {'name': 'Software Testing & Quality Assurance', 'domain': 'Test pyramids, mutation testing, performance load testing & Cypress/Playwright', 'group': 'systems_cs'},
    'embedded_systems': {'name': 'Embedded Systems & Firmware', 'domain': 'Microcontrollers, RTOS scheduling, GPIO interrupts & memory constraints', 'group': 'systems_cs'},
    'cpp': {'name': 'Modern C++ (C++20/23)', 'domain': 'RAII, smart pointers, move semantics, templates & memory barriers', 'group': 'systems_cs'},
    'game_development': {'name': 'Game Development & Engines', 'domain': 'Game loops, spatial partitioning, physics simulation & memory optimization', 'group': 'systems_cs'},
    'blockchain': {'name': 'Blockchain & Smart Contracts', 'domain': 'Consensus algorithms, EVM execution, gas optimization & reentrancy attacks', 'group': 'systems_cs'},
    'quantum_computing': {'name': 'Quantum Computing Foundations', 'domain': 'Qubits, superposition, quantum entanglement & quantum gates', 'group': 'systems_cs'},
    'digital_marketing': {'name': 'Digital Marketing Technology', 'domain': 'Attribution modeling, tag management, programmatic bidding & funnel analytics', 'group': 'systems_cs'},
    'seo': {'name': 'Technical SEO & Search Algorithms', 'domain': 'Crawl budgets, core web vitals, structured data & search indexing', 'group': 'systems_cs'},
    'cs_dbms': {'name': 'Database Management Systems Core', 'domain': 'ACID transactions, write-ahead logging (WAL), 2PL & MVCC concurrency', 'group': 'systems_cs'},
    'cs_os': {'name': 'Operating Systems Core', 'domain': 'Process scheduling, virtual memory paging, synchronization primitives & file systems', 'group': 'systems_cs'},
    'cs_cn': {'name': 'Computer Networks Core', 'domain': 'TCP window flow control, congestion avoidance, DNS resolution & HTTP/3 QUIC', 'group': 'systems_cs'},
    'cs_oop': {'name': 'Object-Oriented Design & Principles', 'domain': 'SOLID design principles, design patterns & domain-driven decomposition', 'group': 'systems_cs'},
    'cs_dsa': {'name': 'Data Structures & Algorithms', 'domain': 'Graph algorithms, dynamic programming, tree balancing & amortized complexity', 'group': 'systems_cs'},
    'cs_se': {'name': 'Software Engineering & System Architecture', 'domain': 'SDLC models, agile scaling, refactoring legacy systems & technical debt management', 'group': 'systems_cs'},
}

# Question Templates and Themes for Series 6 to 10
SERIES_THEMES = {
    6: {
        'name': 'Series 6: Advanced Asynchronous Architecture & Event-Driven Systems',
        'rounds': {
            1: {
                'title': 'Round 1: Event Brokers, Message Topologies & Stream Processing',
                'q_topics': ['Message Broker Selection & Topologies', 'Stream Processing & Consumer Groups', 'Partition Key Selection & Ordering', 'Event Schemas & Evolution', 'Message Deduplication & At-Least-Once Delivery']
            },
            2: {
                'title': 'Round 2: Background Job Queues, Backpressure & Worker Pools',
                'q_topics': ['Worker Pool Sizing & Concurrency Limits', 'Queue Backpressure & Flow Control', 'Priority Queuing & Fair Sharing', 'Delayed Jobs & Exponential Retry Backoff', 'Dead Letter Queue Monitoring & Alerting']
            },
            3: {
                'title': 'Round 3: Idempotent Consumers, Transactional Outbox & Replay',
                'q_topics': ['Transactional Outbox Pattern Implementation', 'Idempotency Keys & Deduplication Windows', 'Saga Pattern for Distributed Workflows', 'Poison Pill Handling & Safe DLQ Draining', 'Event Sourcing & Replay Diagnostics']
            }
        }
    },
    7: {
        'name': 'Series 7: High-Throughput Data Persistence, Caching & Distributed Storage',
        'rounds': {
            1: {
                'title': 'Round 1: Distributed Caching, Cache Stampede & Multi-Tier Caches',
                'q_topics': ['Cache-Aside vs Write-Through vs Write-Behind', 'Cache Stampede & Probabilistic Expiration', 'Redis Cluster Topology & Hash Slots', 'Multi-Tier In-Memory Caching', 'Hot Key Detection & Dynamic Replication']
            },
            2: {
                'title': 'Round 2: Database Partitioning, Read Replicas & Connection Pooling',
                'q_topics': ['Horizontal Sharding Key Strategies', 'Replication Lag & Read-Your-Own-Writes Consistency', 'Database Connection Pool Sizing & Saturation', 'Query Execution Plan Analysis & Index Pruning', 'Multi-Tenant Database Isolation Strategies']
            },
            3: {
                'title': 'Round 3: Polyglot Persistence, NoSQL Trade-offs & Consistency Models',
                'q_topics': ['Relational vs Document vs Columnar Trade-offs', 'Eventual Consistency vs Strong Consistency in Practice', 'Vector Databases & Similarity Search Indexing', 'Time-Series Data Retention & Downsampling', 'ACID vs BASE in High-Scale Architectures']
            }
        }
    },
    8: {
        'name': 'Series 8: Cloud Native Infrastructure, Reliability & Chaos Engineering',
        'rounds': {
            1: {
                'title': 'Round 1: Container Orchestration, Service Meshes & Traffic Routing',
                'q_topics': ['Kubernetes Pod Lifecycle & Graceful Shutdown', 'Service Mesh mTLS & Sidecar Traffic Interception', 'Canary & Blue-Green Progressive Delivery', 'Resource Requests, Limits & OOMKilled Diagnostics', 'Zero-Downtime Database Migration Deployments']
            },
            2: {
                'title': 'Round 2: Distributed Tracing, APM Metrics & Golden Signals Observability',
                'q_topics': ['OpenTelemetry Distributed Context Propagation', 'The 4 Golden Signals (Latency, Traffic, Errors, Saturation)', 'Structured Logging & High-Cardinality Metrics', 'SLO, SLA, and Error Budget Calculations', 'Automated Health Checks & Readiness Probes']
            },
            3: {
                'title': 'Round 3: Chaos Engineering, Self-Healing Systems & Post-Mortem Defense',
                'q_topics': ['Chaos Engineering Experiments & Fault Injection', 'Circuit Breakers with Fallback Strategies', 'Cascading Failure Prevention & Bulkheads', 'Disaster Recovery RTO & RPO Optimization', 'Blameless Post-Mortem & Root-Cause Mitigation']
            }
        }
    },
    9: {
        'name': 'Series 9: Enterprise Security Hardening, Cryptography & Compliance',
        'rounds': {
            1: {
                'title': 'Round 1: Identity, Modern Authentication (OAuth2/OIDC) & RBAC/ABAC',
                'q_topics': ['OAuth 2.1 PKCE Flow & Token Exchange', 'JWT Validation, Revocation & Key Rotation', 'Role-Based vs Attribute-Based Access Control (ABAC)', 'Multi-Factor Authentication & Passkey Security', 'Session Hijacking & Token Binding Defense']
            },
            2: {
                'title': 'Round 2: Cryptographic Primitives, Key Rotation & Secrets Management',
                'q_topics': ['Envelope Encryption & Cloud KMS Architecture', 'Automated Secrets Management & Ephemeral Credentials', 'Symmetric vs Asymmetric Signing Primitives', 'Secure Storage of Passwords (Argon2id vs bcrypt)', 'Data-at-Rest and Data-in-Transit Encryption Governance']
            },
            3: {
                'title': 'Round 3: Zero Trust Architecture, API Gateways & Secure SDLC',
                'q_topics': ['Zero Trust Network Architecture Principles', 'API Gateway WAF, Rate Limiting & Bot Protection', 'Software Supply Chain Security & Dependency Auditing', 'OWASP API Security Top 10 Mitigation', 'Penetration Testing Findings & Remediation Workflows']
            }
        }
    },
    10: {
        'name': 'Series 10: FAANG / Staff-Level System Design & Planetary Scale Mastery',
        'rounds': {
            1: {
                'title': 'Round 1: Planetary Scale Distributed Design & Multi-Region Replication',
                'q_topics': ['Multi-Region Active-Active Architecture', 'Geo-DNS Routing & Global Anycast Latency Budgets', 'Conflict-Free Replicated Data Types (CRDTs)', 'Cross-Region Data Replication & Partition Tolerance', 'Global Rate Limiting & Throttling at the Edge']
            },
            2: {
                'title': 'Round 2: Consensus Protocols, CAP/PACELC Trade-offs & High Availability',
                'q_topics': ['Raft vs Paxos Consensus in Distributed Storage', 'PACELC Theorem Applied to Real-World Systems', 'Split-Brain Scenarios & Quorum Fencing', 'Leader Election & Distributed Lock Safety', 'High-Availability Nines (99.999%) Engineering']
            },
            3: {
                'title': 'Round 3: Senior Architectural Decision-Making & Production Outage Defense',
                'q_topics': ['Legacy Monolith to Distributed Services Deconstruction', 'Technical Debt vs Velocity Trade-Off Matrix', 'Handling Catastrophic Simultaneous Outages', 'Designing Cost-Effective Cloud Architectures at Scale', 'Executive Architecture Review & Stakeholder Alignment']
            }
        }
    }
}

def generate_questions_for_stack(stack_key, meta):
    name = meta['name']
    domain = meta['domain']
    stack_data = {}

    for series_num, series_info in SERIES_THEMES.items():
        series_rounds = {}

        for round_num, round_info in series_info['rounds'].items():
            round_questions = []

            for q_idx, topic in enumerate(round_info['q_topics']):
                # Tailor questions specifically to the stack domain and topic
                if series_num == 6: # Asynchronous & Event-Driven
                    if round_num == 1:
                        q_text = f"In a high-throughput {name} system, how do you architect an event-driven ingestion pipeline handling thousands of events per second? Detail your choice of message broker, topic partitioning, and consumer group design."
                        q_note = f"Candidate must explain real-world event streaming in {name}. Key points: partitioning keys to guarantee in-order delivery per tenant/entity, horizontal scaling of consumer groups, handling consumer rebalancing, and avoiding head-of-line blocking."
                    elif round_num == 2:
                        q_text = f"How do you implement resilient asynchronous background job processing in {name}? Walk through your strategy for queue priority, backpressure handling, and worker pool sizing under sudden traffic surges."
                        q_note = f"Candidate should discuss job serialization, worker concurrency thresholds, rate-limiting outbound calls to downstream services, and avoiding worker memory exhaustion under spike loads in {name}."
                    else:
                        q_text = f"Explain the Transactional Outbox Pattern in the context of {name}. How does it guarantee that database mutations and outbound event publications remain atomic without two-phase commit overhead?"
                        q_note = f"Candidate must describe saving events in an outbox database table within the same local database transaction as business logic, followed by an asynchronous polling publisher or CDC (Change Data Capture) process to broadcast to the event broker."
                
                elif series_num == 7: # High-Throughput Data Persistence & Caching
                    if round_num == 1:
                        q_text = f"How do you address cache stampede (thundering herd) and cache penetration in a {name} application with millions of active users? Explain cache-aside versus write-through trade-offs."
                        q_note = f"Candidate should articulate probabilistic early expiration (XFetch algorithm), mutex locks on cache misses, bloom filters for non-existent keys (cache penetration), and Redis clustering strategies in {name}."
                    elif round_num == 2:
                        q_text = f"When scaling a {name} data layer beyond single-node capacity, how do you design horizontal database sharding? Address cross-shard queries, shard key selection, and read replica lag."
                        q_note = f"Candidate should detail choosing a high-cardinality shard key, consistent hashing, dealing with replication lag using monotonic read consistency or routing dirty reads to primary, and minimizing multi-shard joins."
                    else:
                        q_text = f"Explain polyglot persistence in a modern {name} architecture. When would you combine a relational database with document, time-series, or vector stores, and how do you maintain data consistency across them?"
                        q_note = f"Candidate must evaluate strengths of relational ACID vs NoSQL/Vector/Search stores, asynchronous projection workers via event sourcing or CDC, and eventual consistency reconciliation strategies."

                elif series_num == 8: # Cloud Native Infrastructure & Chaos Engineering
                    if round_num == 1:
                        q_text = f"Describe how you containerize and deploy a mission-critical {name} service on Kubernetes for zero-downtime rolling upgrades. Detail your liveness/readiness probes, pod disruption budgets, and graceful shutdown signal handling."
                        q_note = f"Candidate must explain handling SIGTERM signals, finishing in-flight HTTP requests, stopping new traffic ingestion via readiness probe changes, configuring preStop hooks, and setting PodDisruptionBudgets."
                    elif round_num == 2:
                        q_text = f"How do you achieve end-to-end distributed observability in a {name} ecosystem? Explain how you implement OpenTelemetry context propagation, metric aggregation, and error budgeting."
                        q_note = f"Candidate must cover passing W3C traceparent headers across network boundaries, correlating logs with trace IDs, tracking the 4 golden signals, and using error budgets to govern release velocity."
                    else:
                        q_text = f"Walk through a real-world Chaos Engineering scenario you would execute against a {name} production deployment. How do circuit breakers, bulkheads, and fallback mechanisms prevent cascading system failures?"
                        q_note = f"Candidate should outline introducing synthetic network latency or pod termination, verifying circuit breaker trip thresholds (half-open/open states), isolated thread/connection bulkheads, and verified graceful degradation."

                elif series_num == 9: # Enterprise Security Hardening & Zero Trust
                    if round_num == 1:
                        q_text = f"In an enterprise {name} application, how do you design a secure OAuth 2.1 authentication and fine-grained authorization (ABAC/RBAC) architecture? Address token lifecycle, refresh rotation, and revocation."
                        q_note = f"Candidate must discuss PKCE authorization code flow, short-lived JWTs, rotating refresh tokens with token family reuse detection, and evaluating contextual attributes (tenant, IP, role) before authorization."
                    elif round_num == 2:
                        q_text = f"How do you safeguard sensitive customer data at rest and in transit in a {name} production environment? Detail your envelope encryption strategy, KMS key rotation, and secure secrets handling."
                        q_note = f"Candidate should explain using Cloud KMS/Vault for generating data encryption keys (DEK) wrapped by key encryption keys (KEK), automated zero-downtime key rotation, and keeping secrets out of code and build artifacts."
                    else:
                        q_text = f"What are the foundational principles of Zero Trust Architecture, and how do you enforce them across API endpoints, microservices, and dependencies in {name}?"
                        q_note = f"Candidate must explain 'never trust, always verify', mutual TLS (mTLS) between internal services, API gateway WAF inspection, automated vulnerability dependency scanning, and defense-in-depth sanitization."

                else: # Series 10: FAANG / Staff-Level System Design
                    if round_num == 1:
                        q_text = f"Architect a planetary-scale, multi-region active-active system for {name} supporting 50 million daily active users. How do you handle geo-DNS routing, cross-region replication lag, and split-brain resilience?"
                        q_note = f"Candidate should demonstrate Staff-level architectural maturity: Geo-Anycast routing, active-active multi-region databases with Conflict-Free Replicated Data Types (CRDTs) or deterministic last-write-wins, asynchronous synchronization pipelines, and disaster recovery isolation."
                    elif round_num == 2:
                        q_text = f"Analyze the CAP theorem and PACELC theorem in the context of designing a globally distributed storage engine for {name}. Under network partitions, where do you trade latency for consistency, and why?"
                        q_note = f"Candidate must explain that PACELC states 'if Partition, choose Availability or Consistency; Else, choose Latency or Consistency'. Must give concrete examples (e.g. financial ledgers needing consistency vs social feeds optimizing for latency)."
                    else:
                        q_text = f"You are leading the technical modernization of a monolithic legacy {name} system into highly scalable distributed services with zero downtime. Walk through your risk assessment, strangler fig migration strategy, and executive trade-offs."
                        q_note = f"Candidate must demonstrate technical leadership: Strangler Fig pattern using an API gateway to incrementally route traffic to new services, dark launching and shadow traffic verification, managing organizational team topologies, and communicating business risk."

                round_questions.append(make_q(q_text, q_note, topic))

            series_rounds[round_num] = round_questions

        stack_data[series_num] = series_rounds

    return stack_data

def main():
    print("Generating comprehensive Series 6 to 10 questions across all tech stacks...")
    grouped_stacks = {
        'backend': {},
        'frontend': {},
        'ai_devops_data': {},
        'systems_cs': {}
    }

    for stack_key, meta in STACK_META.items():
        group = meta['group']
        print(f"  -> Generating Series 6-10 for {meta['name']} ({stack_key})...")
        grouped_stacks[group][stack_key] = generate_questions_for_stack(stack_key, meta)

    for group, data in grouped_stacks.items():
        outfile = os.path.join(OUT_DIR, f"{group}_mock_series_6_to_10.php")
        write_php_file(outfile, data)
        print(f"Generated {outfile} with {len(data)} stacks.")

    print("Generation complete! All Series 6 to 10 question data files created.")

if __name__ == '__main__':
    main()

