import os
import sys

sys.path.append(os.path.dirname(__file__))
from vault_helper import write_php_file
from question_generator_core import make_q, build_set_rounds, generate_domain_parent_sets

OUT_DIR = os.path.join(os.path.dirname(__file__), 'mock_questions_parent_sets')
os.makedirs(OUT_DIR, exist_ok=True)

frontend_data = {}

# 1. REACT & NEXT.JS
frontend_data['react_nextjs'] = {
    2: build_set_rounds(
        [
            make_q("How do React Server Components (RSC) fundamentally differ from traditional Client Components in terms of bundle size, execution environment, and hydration?",
                   "RSCs execute exclusively on the server, rendering into a special virtual DOM wire format streamed to the client with 0kb JavaScript bundle overhead. They cannot use browser APIs, state hooks (useState), or effect hooks (useEffect). Client Components ('use client') bundle code for the browser to enable user interactivity and state management.",
                   "React Server Components vs Client Components"),
            make_q("Explain the Next.js App Router layout hierarchy. How do nested layouts, templates, and error boundaries (error.js) interact during client-side navigation?",
                   "Layouts (layout.js) wrap pages and preserve component state across navigation without re-rendering. Templates (template.js) create a fresh component instance on every route change. error.js wraps pages in a React Error Boundary, catching runtime rendering errors and rendering fallback UIs without crashing the root application.",
                   "App Router Layouts & Error Boundaries"),
            make_q("What are Server Actions in Next.js? How do they handle form submissions, automatic revalidation (revalidatePath, revalidateTag), and optimistic UI updates?",
                   "Server Actions are asynchronous functions marked with 'use server' that execute on the server. They handle POST requests directly without dedicated API routes. revalidatePath() and revalidateTag() purge Next.js Data Cache for specific routes, streaming updated UI to the client seamlessly.",
                   "Server Actions & Cache Revalidation"),
            make_q("How does Zustand provide high-performance global state management in React without the re-rendering penalties of React Context?",
                   "Zustand uses a hook-based store outside the React component tree. Components subscribe to state slices via selector functions (e.g. useStore(state => state.user)). When state updates, only components whose selected slices changed (shallow equality) re-render, eliminating unnecessary re-renders across the tree.",
                   "Zustand & Selector Subscriptions"),
            make_q("How do you implement streaming UI in Next.js with React Suspense and loading.js?",
                   "loading.js wraps route segments in a React Suspense boundary. Next.js streams the initial layout and loading skeleton HTML immediately over HTTP, and progressively streams resolved data chunks as server components finish fetching, dramatically reducing Time to First Byte (TTFB).",
                   "Streaming with React Suspense"),
        ],
        [
            make_q("How does TanStack Query (React Query) handle server state caching, background refetching, and query key invalidation?",
                   "TanStack Query caches server data by query key (['users', id]). It automatically dedupes concurrent requests, serves cached data instantly (stale-while-revalidate), and refetches on window focus or network reconnect. queryClient.invalidateQueries() marks queries stale to trigger background updates.",
                   "TanStack Query Server State"),
            make_q("What causes hydration errors in React and Next.js applications? How do you diagnose and eliminate them?",
                   "Hydration errors occur when the initial server-rendered HTML does not match the client-side pre-render output (e.g. rendering window.innerWidth, new Date(), or improper HTML nesting like <p> inside <p>). Mitigate by using useEffect for browser-only data, or suppressHydrationWarning for timestamp displays.",
                   "Hydration Errors Diagnosis & Fixes"),
            make_q("How do you manage complex, multi-step asynchronous forms in React using React Hook Form and Zod validation schemas?",
                   "React Hook Form uses uncontrolled inputs via ref registration, minimizing re-renders on keystroke. Integrate with Zod via zodResolver(schema). Split forms across steps while persisting form state in parent state or URL query params, and trigger form.trigger() to validate each step before advancement.",
                   "React Hook Form & Zod Validation"),
            make_q("Explain how to implement optimistic UI updates with useOptimistic in React 19.",
                   "useOptimistic accepts initial state and an update function. Inside a transition or Server Action, setOptimistic() immediately updates the UI with expected results. When the server action resolves, React automatically synchronizes the UI with true server state, rolling back if an error occurs.",
                   "React 19 useOptimistic"),
            make_q("How do you implement real-time updates in a Next.js application using Server-Sent Events (SSE) or WebSockets?",
                   "Create a Route Handler returning a ReadableStream with Content-Type: text/event-stream. The client connects via new EventSource('/api/events'). For bidirectional messaging, connect to a standalone WebSocket server or serverless WebSocket service (Pusher/Reverb).",
                   "Next.js Server-Sent Events"),
        ],
        [
            make_q("How do you optimize Core Web Vitals (LCP, INP, CLS) in Next.js applications?",
                   "LCP: Use next/image with priority on hero images and preload fonts with next/font. INP: Avoid long JavaScript tasks blocking main thread; use useTransition to yield to user input. CLS: Set explicit width/height or aspect ratios on images and reserve space for dynamic ads/embeds.",
                   "Core Web Vitals Optimization"),
            make_q("Explain the difference between useMemo, useCallback, and React.memo. When does memoization degrade performance instead of improving it?",
                   "React.memo memoizes component render output based on prop equality. useMemo caches expensive computation values. useCallback caches function references. Memoization adds memory overhead and comparison cost on every render; avoid memoizing trivial primitives or components that re-render frequently anyway.",
                   "Memoization Best Practices & Caveats"),
            make_q("How do you reduce JavaScript bundle size in Next.js using dynamic imports (next/dynamic) and bundle analyzers?",
                   "Install @next/bundle-analyzer to inspect production bundle sizes. Replace heavy libraries (e.g. Moment.js with date-fns or native Intl). Use dynamic(() => import('./HeavyModal'), { ssr: false }) to lazy-load components only when needed, splitting them into separate chunks.",
                   "Bundle Splitting & next/dynamic"),
            make_q("How do you design a high-performance design system in Next.js using Tailwind CSS, CVA (class-variance-authority), and Radix UI?",
                   "Use Radix UI primitives for unstyled, accessible keyboard navigation and ARIA attributes. Use CVA to declare typed variant maps (intent, size). Merge Tailwind classes cleanly using clsx and tailwind-merge (cn() utility) to avoid CSS class specificity conflicts.",
                   "Design System with Radix & CVA"),
            make_q("How do you prevent Cross-Site Scripting (XSS) in React applications when rendering rich HTML content?",
                   "React automatically escapes strings inside JSX. When rendering raw HTML with dangerouslySetInnerHTML, sanitize the markup using DOMPurify. Avoid storing user-controlled strings in href attributes (preventing javascript: URIs), and enforce a strict Content Security Policy (CSP).",
                   "React XSS Prevention & DOMPurify"),
        ]
    ),
    3: build_set_rounds(
        [
            make_q("How do Next.js Route Handlers (route.ts) work? Compare edge runtime vs Node.js runtime for API endpoints.",
                   "Route Handlers export HTTP methods (GET, POST, etc.) accepting NextRequest and returning NextResponse. Edge runtime runs on V8 isolates (Cloudflare/Vercel edge) with sub-millisecond cold starts and global distribution, but lacks full Node.js APIs (fs, child_process). Node runtime provides full Node ecosystem support.",
                   "Route Handlers & Edge vs Node Runtime"),
            make_q("How do you implement authenticated API proxying in Next.js Middleware without introducing latency bottlenecks?",
                   "Next.js middleware runs on edge before matching routes. Verify JWT signature or session token. Forward user claims as request headers (x-user-id, x-user-role) to downstream route handlers or backend microservices. Avoid making heavy database calls inside middleware.",
                   "Next.js Middleware & Auth Proxying"),
            make_q("Explain the caching layers in Next.js: Request Memoization, Data Cache, Full Route Cache, and Router Cache.",
                   "Request Memoization deduplicates identical fetch() calls within a single render cycle. Data Cache persists fetch results across requests and deployments (revalidate: 60). Full Route Cache caches static HTML/RSC payloads on server. Router Cache stores RSC payloads in browser memory during navigation.",
                   "Next.js 4-Tier Caching Architecture"),
            make_q("How do you design an internationalized (i18n) Next.js App Router application with sub-path routing (/en, /fr)?",
                   "Implement edge middleware to detect Accept-Language headers or cookies and rewrite URLs to the appropriate locale prefix (/[lang]/...). Dynamic layout segments read [lang] and load localized dictionary JSON files with typed dictionary keys.",
                   "Next.js i18n Sub-path Architecture"),
            make_q("How do you implement secure file uploads to AWS S3 in Next.js using presigned PUT URLs?",
                   "Route Handler verifies authentication and calls @aws-sdk/s3-request-presigner to generate a temporary presigned upload URL with file size and MIME constraints. The browser uploads the file directly to S3 via PUT, and notifies Next.js with the S3 key.",
                   "S3 Presigned Uploads in Next.js"),
        ],
        [
            make_q("How do you manage relational database persistence in Next.js using Prisma ORM with connection pooling in serverless environments?",
                   "Serverless functions open new DB connections per invocation, exhausting database connection limits. Use Prisma Accelerate, AWS RDS Proxy, or PgBouncer. Cache the PrismaClient instance globally on globalThis in development to prevent duplicate instances during hot reloads.",
                   "Prisma ORM in Serverless Next.js"),
            make_q("How do you design resilient optimistic mutations with TanStack Query and rollback handlers on network failure?",
                   "In useMutation, implement onMutate to cancel outgoing queries, snapshot current data, and optimistically update query cache. In onError, restore previous snapshot using queryClient.setQueryData(). In onSettled, invalidate queries to ensure final sync with server.",
                   "TanStack Query Optimistic Rollbacks"),
            make_q("How do you implement full-text search with instant debounced autocomplete in Next.js using URL search parameters?",
                   "Sync search state with URL query parameters (?q=keyword) using useSearchParams and useRouter. Debounce user keystrokes (useDebouncedCallback) by 300ms before router.replace() with { scroll: false }. The server component receives the updated searchParam and renders filtered results.",
                   "URL Search State & Debounced Autocomplete"),
            make_q("Explain how to implement Webhook endpoints in Next.js with raw body signature verification (e.g. Stripe webhooks).",
                   "Stripe requires the unparsed raw request body to verify webhook signatures. In Next.js App Router, read const rawBody = await req.text() and pass to stripe.webhooks.constructEvent(rawBody, sig, secret). Acknowledge with return new Response(null, { status: 200 }).",
                   "Stripe Webhook Verification in Next.js"),
            make_q("How do you handle distributed caching and cache invalidation with Redis in Next.js API routes?",
                   "Use Upstash Redis or ioredis. Cache serialized API responses with TTLs. On data mutations in Server Actions or Route Handlers, delete cache keys or publish cache-invalidation events to ensure read endpoints return fresh data immediately.",
                   "Redis Caching in Next.js"),
        ],
        [
            make_q("How do you configure OpenTelemetry distributed tracing in Next.js for tracking frontend-to-backend request latency?",
                   "Enable experimental.instrumentationHook in next.config.js. Implement instrumentation.ts exporting register() to initialize OpenTelemetry SDK. Next.js traces server component rendering, fetch calls, and route handlers, exporting spans to Jaeger or Datadog.",
                   "OpenTelemetry in Next.js"),
            make_q("How do you set up synthetic monitoring and real user monitoring (RUM) for Next.js applications in production?",
                   "Use useReportWebVitals hook or integrate Sentry/Vercel Analytics. Report metrics (TTFB, FCP, LCP, CLS, INP) to monitoring endpoints. Set up synthetic uptime monitors (Datadog/Checkly) to run automated browser checks against critical checkout and login flows.",
                   "Real User Monitoring & Web Vitals"),
            make_q("How do you configure Content Security Policy (CSP) headers with nonces in Next.js to eliminate inline script vulnerabilities?",
                   "In middleware, generate a random crypto nonce (Buffer.from(crypto.randomUUID()).toString('base64')). Set Content-Security-Policy header including 'nonce-{nonce}'. Forward nonce via request headers to root layout so Next.js script tags include the nonce attribute.",
                   "Strict CSP Nonce in Next.js"),
            make_q("How do you handle graceful degradation and offline caching with Progressive Web App (PWA) service workers in Next.js?",
                   "Integrate @ducanh2912/next-pwa or Serwist. Service worker caches static assets with cache-first and API endpoints with network-first or stale-while-revalidate strategy. When offline, serve cached pages and fallback offline.html view.",
                   "Next.js PWA & Service Workers"),
            make_q("How do you structure comprehensive automated testing in Next.js across Vitest (unit), React Testing Library (integration), and Playwright (E2E)?",
                   "Vitest runs fast unit tests for utility functions and custom hooks. React Testing Library tests component user interactions and accessibility (userEvent). Playwright executes headless browser E2E tests against live production builds, verifying full routing and authentication flows.",
                   "Testing Pyramid: Vitest, RTL & Playwright"),
        ]
    ),
    4: build_set_rounds(
        [
            make_q("How does the React 18/19 Concurrent Renderer work? Explain transitions (useTransition, useDeferredValue) and time-slicing.",
                   "Concurrent React breaks rendering into interruptible chunks (time-slicing). Urgent updates (typing in input) execute immediately. Non-urgent updates wrapped in startTransition() or useDeferredValue yield to main thread events, preventing input lag and UI freezing.",
                   "Concurrent React & useTransition"),
            make_q("How do you profile rendering performance and identify unnecessary re-renders using the React DevTools Profiler?",
                   "Record a profile during user action. Inspect Flamegraph and Ranked views. Colored bars indicate rendering time. Check 'Why did this component render?' to find which prop, state, or context change caused the render. Identify missing memoization or unstable callback references.",
                   "React Profiler Flamegraph Analysis"),
            make_q("Explain how Virtualized Lists (TanStack Virtual / react-window) render millions of items with 60fps scrolling performance.",
                   "Virtualization calculates total scroll height and renders only the small subset of DOM elements currently visible in the viewport plus a small overscan buffer (e.g. 20 items instead of 100,000), drastically reducing memory and layout computation overhead.",
                   "List Virtualization & TanStack Virtual"),
            make_q("How do you optimize Web Workers in React for running CPU-intensive operations (image filtering, data processing) off the main thread?",
                   "Use Comlink or native Web Workers. Instantiate worker using new Worker(new URL('./worker.ts', import.meta.url)). Worker executes computations in background OS thread and posts results back via postMessage, keeping UI interactions at 60fps.",
                   "Web Workers in React with Comlink"),
            make_q("How do you eliminate layout shifts (CLS) when loading web fonts, hero banners, and dynamic user avatars in Next.js?",
                   "Use next/font to automatically inline font CSS and self-host font files with size-adjust fallbacks to eliminate Flash of Unstyled Text (FOUT). Reserve fixed container dimensions for dynamic avatars and banner images using aspect-ratio CSS properties.",
                   "Cumulative Layout Shift Elimination"),
        ],
        [
            make_q("How do you debug and fix memory leaks in React applications caused by uncleaned listeners, intervals, and WebSocket subscriptions?",
                   "Take memory heap snapshots in Chrome DevTools before and after navigating back and forth between views. Search for Detached HTMLDivElements. Common causes: missing cleanup in useEffect (window.removeEventListener, clearInterval, ws.close, queryClient subscriptions).",
                   "React Memory Leaks & Detached DOM"),
            make_q("Explain how to implement dynamic bundle splitting and route prefetching optimization in Next.js.",
                   "Next.js automatically prefetches visible Link components in viewport. For heavy subcomponents, use next/dynamic with ssr: false. For mouse-hover prefetching of complex routes, invoke router.prefetch(path) to preload route bundles before the user clicks.",
                   "Dynamic Splitting & Route Prefetching"),
            make_q("How do you optimize image delivery with next/image across AVIF, WebP, responsive srcSet, and blur placeholder generators?",
                   "next/image converts images on-demand to AVIF and WebP based on browser Accept headers. Specify sizes attribute for responsive srcSets. Use placeholder='blur' with blurDataURL generated at build time (plaiceholder) to show low-quality image placeholders while loading.",
                   "next/image Optimization & AVIF"),
            make_q("How do you benchmark client-side interaction latency and measure Interaction to Next Paint (INP) using web-vitals.js?",
                   "Import onINP from 'web-vitals'. INP measures the longest latency between user interaction (click, tap, keydown) and next visual frame update. High INP is caused by long JS tasks; resolve by breaking work into micro-tasks using scheduler.yield() or setTimeout().",
                   "Interaction to Next Paint (INP) Benchmarking"),
            make_q("How do you design a scalable micro-frontend architecture using Webpack Module Federation or Next.js Multi-Zones?",
                   "Multi-Zones configure independent Next.js applications hosted under distinct paths (e.g. /shop, /blog) behind a shared reverse proxy or rewrites. Module Federation allows independent React applications to share components and state libraries dynamically at runtime.",
                   "Micro-Frontends & Multi-Zones"),
        ],
        [
            make_q("How do you secure Next.js applications against Server-Side Request Forgery (SSRF) when using fetch() inside Server Components?",
                   "Server Components execute on server. If a user supplies a URL passed to fetch(), an attacker could query internal network resources (AWS metadata at 169.254.169.254). Validate URLs against strict domain allowlists and reject internal RFC 1918 IP addresses.",
                   "Server Component SSRF Defense"),
            make_q("How do you prevent Cross-Site Scripting (XSS) and Prototype Pollution in React when handling dynamic JSON configurations?",
                   "Never use dangerouslySetInnerHTML with unvalidated content. Use Object.freeze() on configuration objects. Validate dynamic inputs against Zod schemas. Ensure dependencies are audited with npm audit to prevent prototype pollution in utility libraries.",
                   "React XSS & Prototype Defense"),
            make_q("How do you implement secure authentication in Next.js using Auth.js (NextAuth) with HTTP-only cookies and PKCE?",
                   "Auth.js stores session tokens in encrypted, HTTP-only, SameSite=Lax cookies, inaccessible to client-side JavaScript (immune to XSS token theft). When integrating OAuth providers, use Authorization Code flow with PKCE (Proof Key for Code Exchange).",
                   "Auth.js & HTTP-Only PKCE Cookies"),
            make_q("How do you prevent Clickjacking attacks in Next.js applications using X-Frame-Options and Frame-Ancestors?",
                   "Set X-Frame-Options: DENY and Content-Security-Policy: frame-ancestors 'none' in next.config.js headers. This prevents malicious third-party websites from embedding your application inside invisible iframes to hijack user clicks.",
                   "Clickjacking Defense & Frame-Ancestors"),
            make_q("How do you audit and secure third-party script integrations (Google Tag Manager, analytics, ads) using Partytown and next/script?",
                   "next/script provides strategy options: beforeInteractive, afterInteractive, and lazyOnload. For third-party analytics that degrade main-thread performance, use Partytown (worker strategy) to run tracking scripts inside background Web Workers.",
                   "Third-Party Scripts & Partytown"),
        ]
    ),
    5: build_set_rounds(
        [
            make_q("Design a high-scale e-commerce frontend architecture in Next.js capable of handling 50,000 concurrent shoppers during a flash sale.",
                   "Use Edge Middleware for geo-routing and bot mitigation. Render product catalog with ISR (Incremental Static Regeneration) cached at Cloudflare edge. Dynamic inventory and cart use TanStack Query with optimistic UI. Stripe checkout redirects directly to hosted payment gateway.",
                   "System Design: High-Scale E-Commerce Frontend"),
            make_q("How would you architect a real-time collaborative whiteboarding application in React (like Figma / Miro) with canvas and WebSockets?",
                   "Use HTML5 Canvas with Konva/Pixi.js for rendering thousands of shapes at 60fps. Synchronize state using Conflict-Free Replicated Data Types (CRDTs via Yjs) over WebSockets. Maintain local undo/redo stacks and render remote user cursors on a separate lightweight layer.",
                   "System Design: Real-time Whiteboard with CRDTs"),
            make_q("Design an enterprise Design System in React distributed as an npm monorepo with Turborepo, Storybook, and Changesets.",
                   "Organize monorepo with Turborepo: packages/ui, packages/tokens, apps/docs. Build accessible components on Radix primitives with Tailwind/CVA. Automate visual regression testing with Storybook and Chromatic. Manage semantic versioning and changelogs with Changesets.",
                   "System Design: Enterprise Design System"),
            make_q("How do you architect a multi-tenant SaaS frontend in Next.js with custom domains (e.g. tenant.platform.com and custom-domain.com)?",
                   "Edge middleware inspects Host header. Query Redis/Edge Config to lookup tenant ID for the domain. Rewrite URL internally to app/[tenant]/... Dynamic layout applies custom tenant branding (colors, logos, fonts) loaded via server components.",
                   "Multi-Tenant Custom Domains Architecture"),
            make_q("How do you migrate a massive single-page application (SPA) with 500,000 lines of legacy React code to Next.js App Router without downtime?",
                   "Use the Strangler Fig pattern with reverse proxy rewrites: host both legacy SPA and new Next.js app behind Cloudflare/Nginx. Migrate routes one by one (e.g. Marketing, Auth, Dashboard). Share common design system components via npm package.",
                   "Legacy React to Next.js Migration"),
        ],
        [
            make_q("How do you architect edge-side rendering and personalization in Next.js using Vercel Edge Middleware and Edge Config?",
                   "Edge Middleware intercepts incoming requests at the nearest CDN POP. Read user geolocation and experiment variants from Vercel Edge Config (<1ms latency). Rewrite route or inject headers to serve personalized content without server origin roundtrips.",
                   "Edge-Side Rendering & Personalization"),
            make_q("How do you manage complex distributed state and offline synchronization in Progressive Web Apps using IndexedDB and CRDTs?",
                   "Store application data in browser IndexedDB using Dexie.js. Offline mutations are queued as pending CRDT operations. When network reconnects, background sync worker pushes operations to server and merges remote updates deterministically without data loss.",
                   "Offline Sync & IndexedDB CRDTs"),
            make_q("How do you design a zero-downtime canary deployment pipeline for Next.js applications on Kubernetes or Vercel?",
                   "Deploy canary instances alongside current production. Route 5% of traffic to canary using ALB weighted routing or Vercel Deployment Protection. Monitor real-time error rates and Web Vitals in Sentry/Datadog. Automatically roll forward or roll back based on alert metrics.",
                   "Canary Deployment Architecture"),
            make_q("Explain how to implement comprehensive End-to-End visual regression testing in Next.js using Playwright and Percy/Chromatic.",
                   "In CI pipeline, spin up preview deployment. Playwright scripts navigate through all responsive breakpoints (mobile, tablet, desktop) and user interactions, capturing full-page screenshots. Percy compares visual diffs against baseline snapshots with threshold tolerances.",
                   "E2E Visual Regression Testing"),
            make_q("How do you implement resilient client-side error recovery and fallback states across a large Next.js micro-frontend architecture?",
                   "Wrap independent micro-frontend zones in granular React Error Boundaries. If a non-essential widget crashes (e.g. recommended products), catch the error, log to Sentry, and render a graceful fallback without crashing the parent page or navigation bar.",
                   "Micro-Frontend Error Resiliency"),
        ],
        [
            make_q("Walk through how you would triage and resolve a critical production incident: white-screen crashes affecting 40% of users after a Next.js deployment.",
                   "1) Immediate rollback to previous stable deployment. 2) Check Sentry/error logs: identify error signature (e.g. 'Minified React error #310', ChunkLoadError, or missing environment variable in client bundle). 3) Reproduce locally in production build. 4) Fix root cause and verify via automated CI tests.",
                   "Incident Response: Production White-Screen Crash"),
            make_q("How do you resolve severe ChunkLoadError failures in Next.js during high-frequency production deployments?",
                   "ChunkLoadError happens when users on an older page session request a code-split JS chunk that was deleted by a new deployment. Mitigate by keeping older build assets in CDN/S3 for 48 hours, or handling ChunkLoadError in global error boundary to trigger an automatic hard reload.",
                   "ChunkLoadError & Asset Retention"),
            make_q("What architectural trade-offs exist between Server-Side Rendering (SSR), Static Site Generation (SSG), and Client-Side Rendering (CSR)?",
                   "SSG provides fastest TTFB and lowest server costs, but stale data unless regenerated (ISR). SSR provides fresh data per request, but higher TTFB and server compute. CSR offers dynamic app-like interactivity, but larger initial JS bundles, slower FCP, and weaker SEO.",
                   "SSR vs SSG vs CSR Architectural Trade-offs"),
            make_q("How do you lead a technical frontend engineering team through adopting strict TypeScript and enforcing zero 'any' policy across 100 developers?",
                   "1) Enable strict mode in tsconfig.json with noImplicitAny: true. 2) Integrate ESLint with @typescript-eslint/no-explicit-any. 3) For legacy code, introduce TypeScript project references or typed boundaries. 4) Conduct workshops on generics and discriminated unions. 5) Enforce PR checks in CI.",
                   "Enterprise TypeScript Adoption"),
            make_q("How do you architect a frontend accessibility (a11y) governance program to achieve continuous WCAG 2.2 AA compliance?",
                   "Integrate automated axe-core accessibility checks in Playwright/Cypress E2E tests and CI. Use ESLint jsx-a11y plugin. Mandate keyboard navigation testing (tab order, focus rings). Require all design system components to follow WAI-ARIA Authoring Practices.",
                   "WCAG 2.2 AA Accessibility Governance"),
        ]
    )
}

# 2. TYPESCRIPT
frontend_data['typescript'] = generate_domain_parent_sets(
    'typescript', 'TypeScript (Advanced)',
    [
        ('Conditional Types & The `infer` Keyword', 'Conditional types take the form T extends U ? X : Y. The infer keyword introduces a type variable within the conditional clause to extract inner types (e.g. ReturnType<T>, Awaited<T>).'),
        ('Mapped Types & Key Remapping (`as`)', 'Mapped types create new types based on old ones using [K in keyof T]. Key remapping with `as` allows filtering or transforming keys (e.g. [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K]).'),
        ('Template Literal Types & String Manipulation', 'Template literal types produce new string literal types via union expansion (type Event = `${Domain}_${Action}`). Built-in utilities: Uppercase, Lowercase, Capitalize, Uncapitalize.'),
        ('Type Narrowing, Discriminated Unions & Custom Type Guards', 'Discriminated unions use a common literal property (kind, type). Custom type guards use parameter type predicates (val is User) to narrow types inside conditional branches.'),
        ('Declaration Merging & Ambient Module Augmentation', 'Interfaces and namespaces of the same name merge their declarations. Module augmentation (declare module "library") extends third-party library types without modifying source code.'),
    ],
    [('TypeScript Generics & Constraints (`extends`)', 'Generic constraints restrict type parameters to specific shapes (T extends { id: string }).') for _ in range(5)],
    [('TypeScript Compiler (tsc) Performance Tuning', 'Analyze compilation speed with --extendedDiagnostics. Use project references and tsconfig incremental builds.') for _ in range(20)],
    [('Runtime Validation with Zod and Type Inference', 'z.infer<typeof schema> derives TypeScript types directly from runtime validation schemas, eliminating duplication.') for _ in range(15)],
    [('Enterprise Monorepo TypeScript Architecture', 'Configure tsconfig base configurations, path aliases, and project references in Turborepo/Nx monorepos.') for _ in range(15)]
)

# 3. WEB FUNDAMENTALS (HTML, CSS, JS)
frontend_data['web_fundamentals'] = generate_domain_parent_sets(
    'web_fundamentals', 'Web Fundamentals (HTML, CSS, JavaScript)',
    [
        ('Browser Rendering Pipeline (DOM, CSSOM, Render Tree, Layout, Paint, Composite)', 'HTML builds DOM, CSS builds CSSOM. They combine into Render Tree. Browser calculates geometry (Layout), paints pixels (Paint), and layers are drawn to screen by GPU (Composite).'),
        ('Event Bubbling, Capturing & Delegation', 'Events propagate in 3 phases: Capturing (down from window to target), Target, and Bubbling (up from target to window). Event delegation attaches a single listener to a parent element to handle events on dynamic children.'),
        ('CSS Layout Engines: Modern Flexbox vs Grid', 'Flexbox is one-dimensional (row or column). CSS Grid is two-dimensional (simultaneous rows and columns). Subgrid allows nested grid items to inherit parent tracks.'),
        ('JavaScript Prototypal Inheritance & The Prototype Chain', 'Every JavaScript object has an internal [[Prototype]] link (__proto__). Property lookups traverse up the prototype chain to Object.prototype before returning undefined.'),
        ('Web Storage API: localStorage, sessionStorage, Cookies, and IndexedDB', 'localStorage (5MB, persists). sessionStorage (cleared on tab close). Cookies (4KB, sent with HTTP). IndexedDB (hundreds of MBs, transactional NoSQL in browser).'),
    ],
    [('CSS Custom Properties (Variables) & Theming', 'CSS variables (--primary-color) cascade and can be updated dynamically in JavaScript via element.style.setProperty().') for _ in range(5)],
    [('Web Accessibility (a11y) & Semantic HTML5', 'Use semantic tags (<main>, <article>, <nav>). ARIA attributes (aria-expanded, aria-live) communicate UI states to screen readers.') for _ in range(20)],
    [('Critical Rendering Path & Performance Optimization', 'Eliminate render-blocking CSS/JS. Use async/defer on scripts. Inline critical above-the-fold CSS.') for _ in range(15)],
    [('Cross-Browser Compatibility & Modern Polyfills', 'Use PostCSS with Autoprefixer and Browserslist to ensure modern CSS and JS run reliably across all major browsers.') for _ in range(15)]
)

# 4. ANGULAR
frontend_data['angular'] = generate_domain_parent_sets(
    'angular', 'Angular 17/18',
    [
        ('Angular Signals vs RxJS Observables', 'Signals represent reactive values with synchronous glitch-free reactivity (signal, computed, effect). RxJS handles asynchronous event streams.'),
        ('OnPush Change Detection & Zone.js', 'Default change detection checks entire tree on every event. ChangeDetectionStrategy.OnPush checks only when @Input reference changes or signal updates.'),
        ('Standalone Components & Modern Control Flow (@if, @for)', 'Angular 17 introduced standalone components (eliminating NgModules) and built-in control flow (@if, @for, @switch) compiled directly into template instructions.'),
        ('Angular Dependency Injection & Hierarchical Injectors', 'Injectors form a hierarchy: Root injector (singletons), Component injector, and EnvironmentInjector. @Injectable({ providedIn: "root" }).'),
        ('Angular Routing, Resolvers & Functional Guards', 'Functional guards (canActivate: [authGuard]) validate navigation before route activation. Resolvers fetch critical data before component rendering.'),
    ],
    [('State Management with NgRx Store & ComponentStore', 'Redux pattern in Angular: Actions, Reducers, Selectors, and Effects handling asynchronous side-effects.') for _ in range(5)],
    [('Angular HTTP Interceptors & Token Injection', 'Functional HttpInterceptorFn intercepts HTTP requests, cloning requests to append Authorization Bearer headers.') for _ in range(20)],
    [('Angular Universal & Server-Side Rendering (SSR)', 'Pre-render Angular apps on Node.js using @angular/ssr with hydration support for instant FCP and SEO.') for _ in range(15)],
    [('Enterprise Angular Monorepo Architecture with Nx', 'Partition large Angular applications into feature libraries, UI libraries, and utility libraries with strict boundary linting.') for _ in range(15)]
)

# 5. UI/UX DESIGN
frontend_data['ui_ux'] = generate_domain_parent_sets(
    'ui_ux', 'UI/UX Design & Architecture',
    [
        ('Design Systems & Design Tokens (Color, Spacing, Typography)', 'Design tokens store design decisions (hex codes, rem units, font weights) in platform-agnostic JSON, transforming to CSS, iOS, and Android variables.'),
        ('Figma-to-Code Workflows & Component Architecture', 'Designing with auto-layout, variants, component properties, and boolean flags matching production React component props.'),
        ('WCAG 2.2 AA Accessibility & Color Contrast Standards', 'Ensure minimum 4.5:1 contrast for normal text, 3:1 for large text. Ensure focus indicators are visible and interfaces are keyboard-navigable.'),
        ('Responsive Design, Fluid Typography & Breakpoints', 'Use mobile-first media queries, CSS clamp() for fluid typography and spacing scaling seamlessly across viewport widths.'),
        ('Micro-interactions, Animation Principles & Motion Design', 'Applying Disney animation principles (anticipation, easing curves, duration 200-400ms) with prefers-reduced-motion fallbacks.'),
    ],
    [('User Research, Personas & Usability Testing', 'Conducting qualitative interviews, heuristic evaluations (Nielsen Norman), and tree testing to validate information architectures.') for _ in range(5)],
    [('Information Architecture & User Journey Mapping', 'Designing mental models, wireframes, and customer journey maps to eliminate user friction in complex workflows.') for _ in range(20)],
    [('Dark Mode & Theme Token Architecture', 'Structuring semantic color tokens (bg-surface, text-primary) to switch themes seamlessly without visual bugs.') for _ in range(15)],
    [('Design Operations (DesignOps) at Enterprise Scale', 'Managing cross-functional design collaboration, design system versioning, and continuous designer-developer handoff pipelines.') for _ in range(15)]
)

# 6. MERN STACK
frontend_data['mern'] = generate_domain_parent_sets(
    'mern', 'MERN Stack (MongoDB, Express, React, Node.js)',
    [
        ('MERN Architecture: End-to-End Request Lifecycle', 'React sends HTTP request via Axios/fetch -> Express router -> Controller -> Mongoose ODM -> MongoDB -> response back to client.'),
        ('MongoDB Indexing, Compound Indexes & Aggregation Pipeline', 'Single-field and compound indexes. Aggregation stages ($match, $group, $lookup, $project) for complex analytics and data transformations.'),
        ('JWT Authentication with Refresh Tokens in MERN', 'Sign JWT access token with user payload. Issue refresh token in HTTP-only cookie. Protected Express middleware verifies JWT on API calls.'),
        ('Mongoose Schema Validation, Hooks (Middleware) & Population', 'Mongoose pre/post hooks for password hashing before save. Schema validators. .populate() for joins across collections.'),
        ('Fullstack Error Handling & CORS Configuration', 'Express centralized error middleware returning structured JSON. Configure cors middleware with exact origin allowlists and credentials: true.'),
    ],
    [('MongoDB Sharding, Replica Sets & Read Preferences', 'Replica sets (Primary-Secondary) provide high availability. Sharding distributes data across shards using a shard key.') for _ in range(5)],
    [('React State Management in MERN with Redux Toolkit', 'Slice architecture with createSlice and createAsyncThunk for handling async API calls with automated pending/fulfilled/rejected states.') for _ in range(20)],
    [('Socket.io Integration for Real-Time Features in MERN', 'Bidirectional event communication between Node.js server and React frontend with room-based messaging and reconnection handling.') for _ in range(15)],
    [('Containerizing MERN with Docker & Kubernetes', 'Multi-stage Dockerfiles for React (Nginx) and Node.js. Docker Compose for local orchestration with MongoDB container.') for _ in range(15)]
)

# 7. NEXT.JS FULLSTACK
frontend_data['nextjs_fullstack'] = generate_domain_parent_sets(
    'nextjs_fullstack', 'Next.js Fullstack (App Router & Edge)',
    [
        ('Server Actions for Data Mutations & Optimistic UI', 'useActionState and useOptimistic handle form submissions without separate REST endpoints, revalidating cache on the fly.'),
        ('Edge Middleware for Auth, Routing & Geolocation', 'Edge functions execute before static cache and SSR, inspecting cookies, rewriting paths, and evaluating user roles.'),
        ('Prisma ORM with PostgreSQL in Next.js Fullstack', 'Schema definitions, migrations, relations, and using Prisma Client in server components and server actions safely.'),
        ('Next.js Fullstack API Authentication with Auth.js (NextAuth)', 'Credentials, OAuth, and Email magic link providers with session callbacks and middleware route protection.'),
        ('Streaming SSR & Suspense for Fullstack Dashboards', 'Wrap dynamic server components in Suspense boundaries, streaming resolved data chunks to client for instant TTFB.'),
    ],
    [('Edge Caching & Vercel Blob/KV Integration', 'Serverless storage with Vercel Blob for files and Vercel KV (Redis) for distributed session and counter states.') for _ in range(5)],
    [('Dynamic Open Graph (OG) Image Generation with @vercel/og', 'Generate dynamic social share images on the fly using JSX and Tailwind rendered to PNG by edge runtime.') for _ in range(20)],
    [('End-to-End Type Safety with Next.js and Server Actions', 'Infer TypeScript types directly from server action signatures, guaranteeing 100% type-safe client-server contracts.') for _ in range(15)],
    [('Enterprise Multi-Region Deployment for Next.js Fullstack', 'Deploy Next.js apps with edge caching and multi-region database replication (Neon/Supabase/Aurora).') for _ in range(15)]
)

# 8. E-COMMERCE DEVELOPMENT
frontend_data['ecommerce'] = generate_domain_parent_sets(
    'ecommerce', 'E-Commerce Engineering & Architecture',
    [
        ('Shopping Cart State Synchronization & Session Persistence', 'Managing cart state across guest sessions and authenticated users using Redis or persistent database records.'),
        ('Inventory Reservation & Race Condition Prevention during Flash Sales', 'Preventing overselling using atomic database decrements (stock > 0) or Redis atomic locks with TTLs.'),
        ('Payment Gateway Integration & Webhook Handling (Stripe/Razorpay)', 'Creating payment intents, verifying signatures on webhooks, handling asynchronous payment success and failure events.'),
        ('Faceted Search & Filtering Architecture for Product Catalogs', 'Building multi-attribute faceted filters (price, brand, category, ratings) using Elasticsearch or PostgreSQL indexes.'),
        ('Order State Machine & Fulfillment Workflows', 'Modeling order lifecycles (Pending, Paid, Processing, Shipped, Delivered, Cancelled, Refunded) with strict state transition guards.'),
    ],
    [('E-Commerce SEO, Schema.org Product Markup & Structured Data', 'Implementing JSON-LD Product schema with offers, reviews, and availability for Google Rich Results.') for _ in range(5)],
    [('Checkout Optimization & Abandoned Cart Recovery', 'Designing frictionless single-page checkouts, guest checkouts, and automated email recovery workflows via background queues.') for _ in range(20)],
    [('High-Availability E-Commerce Caching (Varnish/Cloudflare Edge)', 'Caching product catalog pages at CDN edge with instant purge webhooks on inventory or price updates.') for _ in range(15)],
    [('PCI-DSS Compliance & E-Commerce Security Standards', 'Never storing raw credit card details; tokenizing payment data via gateway SDKs; enforcing HTTPS and strict CSP.') for _ in range(15)]
)

print(f"Total Frontend & Fullstack Stacks Generated: {len(frontend_data)}")
write_php_file(os.path.join(OUT_DIR, 'frontend_mock_parent_sets.php'), frontend_data)
