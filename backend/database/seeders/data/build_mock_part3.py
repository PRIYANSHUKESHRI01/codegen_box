"""Generate mock interview questions Part 3: Fullstack & DevOps (6 stacks)

Stacks:
  mern
  nextjs_fullstack
  ecommerce
  docker_k8s
  cloud_computing
  cloud_infrastructure

Outputs:
  backend/database/seeders/data/mock_questions/fullstack_devops_mock.php
"""
from pathlib import Path
from vault_helper import write_php_file

STACKS = {
    'mern': {
        1: [
            {
                'text': 'How do you design a Mongoose schema with field validation, default values, and index definitions for an Express REST API?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Should cover mongoose.Schema definition, type validations, unique or compound indexes, and handling validation errors in Express error middleware.',
            },
            {
                'text': 'Explain the difference between embedding documents versus referencing documents in MongoDB. When should you prefer one over the other in a MERN app?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Candidate should explain 1-to-few vs 1-to-many relationships, document 16MB size limit, write amplification, and populate() overhead.',
            },
            {
                'text': 'How do Express middlewares work, and how do you write a custom middleware for request logging and input validation?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Must explain req, res, next chain, order of registration, error-handling middleware signature (err, req, res, next), and libraries like zod or express-validator.',
            },
            {
                'text': 'How does MongoDB aggregation pipeline work? Walk through a pipeline that groups orders by customer and calculates total spending.',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Candidate should describe pipeline stages ($match, $group, $sum, $sort) and performance considerations like indexing prefix fields for initial $match.',
            },
            {
                'text': 'How do you structure an Express application to separate route handlers, controllers, services, and database models cleanly?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Expected separation of concerns: routes delegate to controllers, business logic stays in services, models handle persistence, keeping controllers slim.',
            },
        ],
        2: [
            {
                'text': 'How do you handle API data fetching in React using useEffect or React Query/TanStack Query, including loading and error states?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Should discuss race conditions in raw useEffect with cleanup abort controllers vs automatic caching, refetching, and status flags in React Query.',
            },
            {
                'text': 'How do you implement global state management in a MERN frontend using React Context API or Redux Toolkit? When is Context sufficient?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Candidate should contrast Context (simple auth/theme state, potential re-render of all consumers) with Redux Toolkit (complex state slices, memoized selectors).',
            },
            {
                'text': 'How do you handle form validation and submission in React with controlled components or React Hook Form before sending payloads to Express?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Should explain controlled inputs vs uncontrolled with refs, schema validation (e.g. Zod/Yup), managing submission disabled state and displaying server errors.',
            },
            {
                'text': 'How do you prevent Cross-Origin Resource Sharing (CORS) errors when your React frontend on localhost:3000 connects to an Express server on localhost:5000?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Should discuss the cors middleware in Express, Access-Control-Allow-Origin headers, preflight OPTIONS requests, and credentials handling (cookies/tokens).',
            },
            {
                'text': 'How do you implement pagination or infinite scrolling in a React UI connected to a paginated Express/MongoDB endpoint?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Should cover page/limit query parameters, cursor-based vs skip/limit in MongoDB, and IntersectionObserver or scroll event listeners in React.',
            },
        ],
        3: [
            {
                'text': 'Explain how JWT authentication works end-to-end between a React frontend and an Express backend, and where the token should be safely stored.',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Candidate should cover header/payload/signature, HTTP-only secure cookies vs localStorage (XSS risks), and sending Authorization Bearer headers.',
            },
            {
                'text': 'How do you hash passwords securely in Node.js before saving them to MongoDB, and how do you verify them during login?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Should explain bcrypt or argon2, salt rounds, asynchronous hashing, never storing plaintext passwords, and constant-time password comparisons.',
            },
            {
                'text': 'How do you protect a MERN application from common security vulnerabilities like NoSQL Injection and Cross-Site Scripting (XSS)?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Candidate should address express-mongo-sanitize for $gt injection attacks, helmet for HTTP headers, validating input with Zod, and sanitizing user HTML.',
            },
            {
                'text': 'How do you configure environment variables for both development and production in a MERN stack (dotenv on backend, env files on frontend)?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Should mention process.env, .gitignore for secrets, prefixing frontend vars (REACT_APP_ or VITE_), and injecting secrets securely in cloud environments.',
            },
            {
                'text': 'Walk through the deployment process of a MERN application: where do you host the frontend, backend, and database, and how do they build?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Expected answer touches on static hosting (Vercel/Netlify/S3) for built React bundle, container or PaaS (Render/Heroku/AWS ECS) for Node, MongoDB Atlas, and build scripts.',
            },
        ],
    },

    'nextjs_fullstack': {
        1: [
            {
                'text': 'Explain the difference between React Server Components (RSC) and Client Components in Next.js App Router. When must you use "use client"?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Should explain default server rendering, zero bundle size for RSC, and when "use client" is required: useState, useEffect, browser APIs, or event handlers.',
            },
            {
                'text': 'How does file-based routing work in Next.js App Router? Explain special files like layout.tsx, page.tsx, loading.tsx, and error.tsx.',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Must explain route segments, nested layouts persisting state across navigation, React Suspense via loading.tsx, and error boundary wrappers via error.tsx.',
            },
            {
                'text': 'How do you create dynamic routes and catch-all routes in Next.js (e.g., [id] and [...slug]), and how do you access the route parameters?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Should cover bracket folder naming, params prop passed to page and layout components, and generateStaticParams for static export.',
            },
            {
                'text': 'How does Next.js handle metadata and SEO in the App Router using the Metadata API?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Candidate should explain static metadata export and dynamic generateMetadata function, OpenGraph tags, title templates, and canonical URLs.',
            },
            {
                'text': 'How do you create Route Handlers (app/api/.../route.ts) in Next.js to handle HTTP methods like GET and POST with NextResponse?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Should describe defining named exports (GET, POST), reading request JSON body and searchParams, and returning NextResponse.json().',
            },
        ],
        2: [
            {
                'text': 'What are Server Actions in Next.js, and how do you use them to mutate data directly from a form without writing a separate API endpoint?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Must describe "use server" directive, invoking actions from form action attribute or transition hooks, and automatic progressive enhancement.',
            },
            {
                'text': 'Explain the caching layers in Next.js: Request Memoization, Data Cache, Full Route Cache, and Router Cache.',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Candidate should explain fetch request deduplication, persistent server data cache, prerendered HTML/RSC payload on server, and client-side in-memory router cache.',
            },
            {
                'text': 'How do you revalidate cached data in Next.js using revalidatePath and revalidateTag after a mutation?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Should explain on-demand revalidation, time-based revalidation (next: { revalidate: 60 }), and purging specific tags in Server Actions.',
            },
            {
                'text': 'How do you manage optimistic UI updates in Next.js using React’s useOptimistic hook alongside Server Actions?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Should cover displaying expected new state immediately while server action executes, and gracefully rolling back if the action throws an error.',
            },
            {
                'text': 'How do you integrate an ORM like Prisma or Drizzle with Next.js Server Components and Server Actions to query a PostgreSQL database?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Should discuss instantiating a singleton PrismaClient to avoid connection exhaustion in hot-reloading dev environments and querying directly in RSC.',
            },
        ],
        3: [
            {
                'text': 'How does next/image optimize images automatically, and what required props should you supply to prevent Cumulative Layout Shift (CLS)?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Candidate should describe automatic WebP/AVIF format conversion, responsive srcset, placeholder="blur", and width/height or fill with sizes attribute.',
            },
            {
                'text': 'How do you implement authentication in Next.js using NextAuth.js (Auth.js) or session cookies with middleware.ts?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Should cover Edge middleware checking JWT/session token, redirecting unauthenticated users from protected route matchers, and session providers.',
            },
            {
                'text': 'Explain the difference between Static Generation (SSG), Incremental Static Regeneration (ISR), and Dynamic Rendering (SSR) in App Router.',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Should describe build-time HTML generation, background revalidation with stale-while-revalidate, and per-request server rendering when dynamic functions (cookies, headers) are used.',
            },
            {
                'text': 'How do you optimize bundle size and page load speed in Next.js using dynamic imports (next/dynamic) and font optimization (next/font)?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Candidate should explain code splitting heavy client components with ssr: false when needed, and zero-layout-shift self-hosted Google fonts via next/font.',
            },
            {
                'text': 'What considerations should you take into account when deploying a Next.js application to a self-hosted Docker container versus Vercel?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Should mention standalone output mode in next.config.js, persistent caching storage across container restarts, and configuring sharp for image optimization.',
            },
        ],
    },

    'ecommerce': {
        1: [
            {
                'text': 'How do you model products with dynamic variants (e.g. size, color, SKU, price, inventory) in a relational database?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Expected structure: products table, product_variants table (with SKU, price, stock), and variant_attributes/options join tables.',
            },
            {
                'text': 'Explain the trade-offs between storing shopping cart items in client localStorage, Redis session store, or the primary database.',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Candidate should evaluate guest carts vs logged-in user carts, device syncing, expiration management, and write latency.',
            },
            {
                'text': 'How do you implement a coupon or promo code discount engine supporting fixed amount, percentage, and minimum order requirements?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Should cover validation logic (expiry date, usage limit, eligible categories, minimum cart subtotal), and calculating discount line items before tax.',
            },
            {
                'text': 'How do you handle product search and faceted filtering (by brand, price range, rating) in an e-commerce platform efficiently?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Should discuss database indexing vs search engines (Elasticsearch, Algolia, Meilisearch), facet aggregation queries, and URL query parameter syncing.',
            },
            {
                'text': 'How should an e-commerce checkout flow be structured step-by-step from cart review to order confirmation?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Steps: Cart review, shipping address collection, shipping method selection, tax calculation, payment collection, order creation, confirmation email.',
            },
        ],
        2: [
            {
                'text': 'How do you integrate Stripe or Razorpay checkout using PaymentIntents and client-side SDKs securely without handling raw card numbers?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Must explain PCI compliance scope reduction, server creating PaymentIntent with client_secret, client confirming via Stripe Elements, and return URL handling.',
            },
            {
                'text': 'Why are webhooks essential in e-commerce payments, and how do you ensure webhook handlers are secure and idempotent?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Must mention network dropouts during client redirect, verifying webhook signature using endpoint secret, and checking if order status is already paid before processing.',
            },
            {
                'text': 'How do you handle partial refunds and order cancellations in an e-commerce platform both in your database and with the payment processor?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Should explain recording refund transactions, releasing payment holds or creating gateway refund objects, restoring inventory, and sending customer notifications.',
            },
            {
                'text': 'What is idempotency in the context of order placement, and how do you prevent a customer from being charged twice if they click "Pay" twice?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Candidate should explain idempotency keys sent in API headers, database unique constraints on payment reference, and disabling frontend submit buttons.',
            },
            {
                'text': 'How do you calculate sales taxes and shipping costs dynamically based on the customer’s destination address?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Should discuss tax rules (destination vs origin-based), integrations with services like TaxJar/Avalara, and carrier API lookups (FedEx, UPS, Shiprocket).',
            },
        ],
        3: [
            {
                'text': 'How do you prevent overselling during flash sales when multiple users attempt to purchase the last remaining units of stock simultaneously?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Must discuss atomic database updates (WHERE stock >= qty), row-level locks (SELECT FOR UPDATE), or Redis distributed locks (Redlock) with stock reservations.',
            },
            {
                'text': 'How do you implement inventory reservations with a temporary hold timer (e.g., hold items in cart for 15 minutes during checkout)?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Candidate should describe reserved stock columns vs available stock, scheduled background jobs or Redis TTL expiring reserved units if payment fails.',
            },
            {
                'text': 'How do you scale an e-commerce database during high-traffic events like Black Friday? What parts should be cached in Redis?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Should discuss caching product catalog, categories, and homepage banners, database read replicas, connection pooling, and CDN caching of static assets.',
            },
            {
                'text': 'How do you design an audit trail for order status transitions (e.g. pending -> processing -> shipped -> delivered)?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Should describe an order_history / order_status_events table logging old status, new status, timestamp, acting user ID, and notes.',
            },
            {
                'text': 'What PCI-DSS compliance requirements apply when building a custom e-commerce checkout, and how do hosted fields or tokens keep you compliant?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Must emphasize never storing or transmitting raw PAN (card number) or CVV on your servers, using tokenization (Stripe/Braintree), and achieving SAQ A eligibility.',
            },
        ],
    },

    'docker_k8s': {
        1: [
            {
                'text': 'What is the fundamental difference between a Docker image and a Docker container, and how does the union file system layer images?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Candidate should explain images as immutable read-only blueprints made of layers, containers as writable thin layers on top, and copy-on-write semantics.',
            },
            {
                'text': 'How do multi-stage Docker builds work, and why are they critical for producing secure, lightweight production images?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Must explain using builder stages with full compilers and copying only compiled artifacts to a minimal base (Alpine, Distroless), shrinking image size and attack surface.',
            },
            {
                'text': 'Explain the difference between Docker CMD and ENTRYPOINT instructions, and how they combine when running a container.',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'ENTRYPOINT sets the default executable; CMD provides default arguments that can be overridden by docker run CLI arguments.',
            },
            {
                'text': 'How do Docker networks work (bridge, host, none, overlay)? How do containers in a docker-compose setup resolve each other by service name?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Should explain embedded Docker DNS server on custom bridge networks resolving container/service names to internal IP addresses.',
            },
            {
                'text': 'How do Docker volumes differ from bind mounts, and when should you use each for persisting container data?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Named volumes are managed by Docker in /var/lib/docker/volumes (better for performance and cross-platform); bind mounts link host directory directly (ideal for local dev code sync).',
            },
        ],
        2: [
            {
                'text': 'What is the role of a Pod in Kubernetes, and why does Kubernetes run containers inside Pods rather than running containers directly?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Pod is the smallest deployable unit; shares network namespace (localhost), IP, and storage volumes among tightly coupled containers (sidecar pattern).',
            },
            {
                'text': 'Explain the differences between Kubernetes Service types: ClusterIP, NodePort, LoadBalancer, and Ingress.',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'ClusterIP (internal cluster routing), NodePort (opens port on every worker node), LoadBalancer (provisions cloud provider LB), Ingress (HTTP/HTTPS L7 reverse proxy router).',
            },
            {
                'text': 'How does a Kubernetes Deployment manage replica sets and perform rolling updates without service downtime?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Should cover maxSurge and maxUnavailable settings, spinning up new Pods in a new ReplicaSet, checking readiness, and gradually terminating old Pods.',
            },
            {
                'text': 'What are ConfigMaps and Secrets in Kubernetes, and how do you inject them into Pods as environment variables or mounted files?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'ConfigMaps for plain text configuration, Secrets for base64 encoded sensitive data, envFrom / valueFrom configMapKeyRef, and volume mounts for dynamic updates.',
            },
            {
                'text': 'Explain the difference between Liveness, Readiness, and Startup probes in Kubernetes, and what happens when each fails.',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Startup probe disables others until startup completes; Liveness restarts crashed/deadlocked container; Readiness stops traffic routing to unready Pod without restarting it.',
            },
        ],
        3: [
            {
                'text': 'How do Horizontal Pod Autoscalers (HPA) automatically scale pods based on CPU/memory utilization or custom metrics?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Candidate should mention Metrics Server, target utilization percentage, scaling algorithm formula (desiredReplicas = ceil[currentReplicas * (currentMetric / targetMetric)]), and scale-down stabilization window.',
            },
            {
                'text': 'How do Kubernetes Persistent Volumes (PV), Persistent Volume Claims (PVC), and StorageClasses interact for dynamic storage provisioning?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'StorageClass defines CSI provisioner; PVC requests storage specifications; Kubernetes dynamically creates PV matching the claim and binds them.',
            },
            {
                'text': 'What are Kubernetes Namespaces, ResourceQuotas, and LimitRanges, and how do they enable multi-tenancy on a shared cluster?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Namespaces partition resources logically; ResourceQuotas cap aggregate compute/storage per namespace; LimitRanges enforce default and min/max limits per container.',
            },
            {
                'text': 'What best practices should you follow to harden Docker container security before deploying to Kubernetes?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Should mention running as non-root user (USER 10001), read-only root filesystems, dropping Linux capabilities, scanning images with Trivy/Clair, and avoiding privileged mode.',
            },
            {
                'text': 'How do you troubleshoot a Kubernetes Pod stuck in CrashLoopBackOff or Pending state? What commands do you run?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'For Pending: kubectl describe pod to inspect events (node resource shortage, affinity/taint mismatch, PVC unbound). For CrashLoop: kubectl logs --previous to see crash stack trace.',
            },
        ],
    },

    'cloud_computing': {
        1: [
            {
                'text': 'Explain the difference between IaaS, PaaS, and SaaS cloud service models with real-world examples of each.',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'IaaS: AWS EC2/GCE (raw compute/networking, user manages OS). PaaS: Heroku/AWS Elastic Beanstalk (platform handles runtime/OS, user manages code). SaaS: Google Workspace/Salesforce (fully managed software).',
            },
            {
                'text': 'What is AWS IAM (Identity and Access Management)? Explain the roles of Users, Groups, Policies, and IAM Roles.',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Users (human/machine identities), Groups (collections of users), Policies (JSON documents defining allow/deny permissions), IAM Roles (temporary credentials assumed by services or users).',
            },
            {
                'text': 'What is the Principle of Least Privilege in cloud security, and how do you implement it using IAM policies?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Candidate should explain granting only the minimum permissions necessary, scoping resources by ARN, avoiding wildcards (e.g. s3:* on *), and using permission boundaries.',
            },
            {
                'text': 'Compare AWS EC2 instance types and purchasing options: On-Demand, Reserved Instances, Savings Plans, and Spot Instances.',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'On-Demand (flexible, no commitment), Reserved/Savings (1-3 yr commitment for 40-70% discount), Spot (spare capacity at up to 90% discount, subject to 2-min interruption notice).',
            },
            {
                'text': 'What is a Cloud Region versus an Availability Zone (AZ)? Why should applications deploy across multiple AZs?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Region is a distinct geographic area; AZ is one or more isolated physical data centers within a region with low-latency links. Multi-AZ provides fault tolerance against data center outages.',
            },
        ],
        2: [
            {
                'text': 'Explain AWS S3 storage classes (Standard, Intelligent-Tiering, Glacier) and how S3 Lifecycle policies save storage costs.',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Standard for active data, Intelligent-Tiering for unknown access patterns, Glacier for cheap archival. Lifecycle rules transition objects automatically based on age and prefix.',
            },
            {
                'text': 'Compare managed relational databases (like AWS RDS) with NoSQL databases (like DynamoDB). When should you choose one over the other?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'RDS: relational SQL, complex joins, ACID compliance across tables. DynamoDB: horizontal scale, predictable single-digit ms latency, key-value/document model, schema-less.',
            },
            {
                'text': 'What is Serverless computing (e.g. AWS Lambda)? What are its advantages, cold start challenges, and execution limits?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Event-driven execution, automatic scaling to zero, pay-per-millisecond. Cold starts occur on new container spins; 15-minute max execution duration; stateless design.',
            },
            {
                'text': 'How do you decouple asynchronous tasks in the cloud using message queues (AWS SQS) and pub/sub notifications (AWS SNS)?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'SQS provides point-to-point durable queuing with visibility timeout and dead-letter queues. SNS enables one-to-many fanout to multiple subscribers (SQS, Lambda, HTTP endpoints).',
            },
            {
                'text': 'What is a Content Delivery Network (CDN) like AWS CloudFront, and how does edge caching improve global web performance?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'CDNs cache static assets and video at hundreds of edge locations globally near users, reducing latency, terminating SSL closer to clients, and reducing origin server load.',
            },
        ],
        3: [
            {
                'text': 'How do you design a highly available, multi-AZ web architecture on AWS using an Application Load Balancer and Auto Scaling Group?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'ALB in public subnets distributing across EC2 instances in private subnets across multiple AZs; ASG health checks target ALB target group and scale on CPU/request count.',
            },
            {
                'text': 'What strategies and AWS services can you use to optimize cloud costs and eliminate idle or overprovisioned resources?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'AWS Cost Explorer, AWS Compute Optimizer for rightsizing, turning off non-prod environments off-hours, S3 lifecycle policies, and purchasing Compute Savings Plans.',
            },
            {
                'text': 'What is the AWS Well-Architected Framework, and what are its six core pillars?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Pillars: Operational Excellence, Security, Reliability, Performance Efficiency, Cost Optimization, and Sustainability. Brief explanation of each.',
            },
            {
                'text': 'How do Disaster Recovery (DR) strategies differ: Backup & Restore, Pilot Light, Warm Standby, and Multi-Region Active-Active?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Candidate should explain RPO (Recovery Point Objective) and RTO (Recovery Time Objective) trade-offs from cheapest/slowest (Backup & Restore) to zero-downtime (Active-Active).',
            },
            {
                'text': 'How do you monitor cloud applications using AWS CloudWatch metrics, alarms, logs, and AWS CloudTrail for auditing?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'CloudWatch collects operational metrics and application log streams with alarm actions (SNS/ASG). CloudTrail logs all API calls across the account for governance and security auditing.',
            },
        ],
    },

    'cloud_infrastructure': {
        1: [
            {
                'text': 'What is Infrastructure as Code (IaC), and what problems does declarative IaC (Terraform) solve compared to manual console clicks or bash scripts?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Declarative desired state, version control of infrastructure, reproducibility across staging/prod, idempotency, avoiding human error and configuration drift.',
            },
            {
                'text': 'Explain the purpose and mechanics of the Terraform state file (terraform.tfstate). Why must state never be committed to Git?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Maps declared resources to real-world cloud IDs; contains sensitive values (passwords, private keys) in plaintext; must use remote backend (S3) with encryption and state locking (DynamoDB).',
            },
            {
                'text': 'Walk through the core Terraform workflow commands: terraform init, terraform plan, and terraform apply.',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'init downloads providers and modules; plan generates execution diff comparing state and config; apply executes changes against cloud APIs and updates state.',
            },
            {
                'text': 'How do Terraform input variables, local values, and output values work together to make modules reusable?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Variables accept caller inputs with validation rules; locals compute reusable intermediate expressions; outputs export resource IDs or DNS names to other modules.',
            },
            {
                'text': 'What are Terraform Providers and Modules? How do you publish or consume an internal Terraform module across environments?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Providers interact with cloud APIs (AWS, Azure, GitHub); modules are packaged configs with source paths (local or git tag) promoting DRY architecture.',
            },
        ],
        2: [
            {
                'text': 'How do you design a production AWS VPC with public subnets, private subnets, Internet Gateway, and NAT Gateway?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'CIDR block allocation (/16 VPC, /24 subnets), Internet Gateway attached to public subnets route table (0.0.0.0/0 -> IGW), NAT Gateway in public subnet routing private subnet outbound internet.',
            },
            {
                'text': 'What is the difference between AWS Security Groups and Network Access Control Lists (NACLs)?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Security Groups: stateful, applied at instance/ENI level, allow rules only. NACLs: stateless, applied at subnet level, evaluate numbered allow and deny rules in order.',
            },
            {
                'text': 'How does VPC Peering work, and what are its routing limitations compared to an AWS Transit Gateway?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'VPC Peering connects two VPCs non-transitively (no transitive routing); Transit Gateway acts as a central hub connecting hundreds of VPCs and on-prem VPNs with hub-and-spoke routing.',
            },
            {
                'text': 'What is a VPC Endpoint (Gateway vs Interface Endpoint), and how does AWS PrivateLink keep traffic off the public internet?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Gateway endpoints (S3, DynamoDB) modify route tables for free; Interface endpoints (PrivateLink) inject elastic network interfaces into your private subnets with private DNS.',
            },
            {
                'text': 'How do you configure route tables in AWS to direct traffic between subnets, internet gateways, and private VPN connections?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Should describe route priority (longest prefix match), associating subnets with specific route tables, and default route targets (0.0.0.0/0 to IGW, NAT, or VGW).',
            },
        ],
        3: [
            {
                'text': 'How do you structure a CI/CD pipeline in GitHub Actions or GitLab CI to test, plan, and apply Terraform configurations safely?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Pipeline stages: lint/validate (tflint, terraform fmt), security scan (tfsec/checkov), terraform plan on PR, automated PR comments with diff, manual approval gate before apply on main branch.',
            },
            {
                'text': 'What is infrastructure drift, and how do you detect and remediate drift between live cloud resources and your Terraform state?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Drift happens when changes occur outside Terraform (manual console tweaks). Detected via scheduled terraform plan -detailed-exitcode; resolved by importing or re-applying code.',
            },
            {
                'text': 'How do you manage sensitive secrets (database passwords, API tokens) in Terraform without hardcoding them in plain text files?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Reference secrets from AWS Secrets Manager or HashiCorp Vault dynamically via data sources; mark sensitive variables with sensitive = true; never output unmasked secrets.',
            },
            {
                'text': 'How do you implement blue-green or canary deployments for backend services using load balancers and target group weighting?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Deploy new version alongside current version; test with synthetic checks; gradually shift traffic percentage (e.g. 10% -> 50% -> 100%) via ALB forward action rules; rollback instantly if 5xx errors spike.',
            },
            {
                'text': 'How do you design a centralized logging and telemetry infrastructure for multi-account cloud environments (e.g. OpenTelemetry, CloudWatch, Datadog)?',
                'category': 'technical',
                'duration_seconds': 180,
                'note': 'Log forwarding agents (FluentBit/OTel collector), streaming to central S3 bucket/Elasticsearch/Datadog, cross-account IAM role assumptions, log retention policies, and structured JSON logs.',
            },
        ],
    },
}

if __name__ == '__main__':
    out_dir = Path(__file__).resolve().parent / 'mock_questions'
    out_file = out_dir / 'fullstack_devops_mock.php'
    write_php_file(out_file, STACKS)
    print(f"Wrote {out_file} ({len(STACKS)} sets)")

