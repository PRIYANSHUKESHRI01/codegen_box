<?php

// Auto-generated curated vault questions for Mellow Vault AI Interview

return [
    'react_nextjs' => [
        1 => [
            [
                'text' => 'How does the React component lifecycle work with Hooks? Explain useState, useEffect, and how the dependency array controls effect execution.',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'useState stores local component state triggering re-renders on update. useEffect handles side-effects (fetching, subscriptions). Dependency array rules: empty array [] runs once on mount; array with values [id] runs on mount and whenever dependencies change; no array runs on every render. Returning a cleanup function unbinds listeners or cancels timers on unmount.',
            ],
            [
                'text' => 'What is the difference between Controlled Components and Uncontrolled Components in React forms? When should you use useRef instead of useState?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Controlled components have form inputs driven by React state (value={val} and onChange={e => setVal(e.target.value)}), allowing instant validation. Uncontrolled components store values directly in the DOM accessed via useRef(). useRef creates a mutable object whose .current property persists across renders without triggering a re-render when mutated.',
            ],
            [
                'text' => 'Why must React keys be unique and stable when rendering lists? What problems happen when an array index is used as a key?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'React\'s Virtual DOM reconciliation uses keys to identify which items have changed, been added, or removed. If array indexes are used as keys and items are inserted, reordered, or deleted, React confuses component identities, leading to incorrect input state retention, animation glitches, and degraded performance.',
            ],
            [
                'text' => 'What causes a React component to re-render? How do you prevent unnecessary re-renders using React.memo, useMemo, and useCallback?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'A component re-renders when: 1) its state changes, 2) its parent re-renders, 3) its props change, or 4) a consumed Context value updates. React.memo wraps a component to skip re-renders if props are shallowly equal. useMemo caches expensive calculation results; useCallback caches callback function references across renders.',
            ],
            [
                'text' => 'What is Prop Drilling in React, and what are the standard ways to avoid it (Component Composition, Context API, State Management libraries)?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Prop drilling occurs when passing data through multiple layers of intermediate components that don\'t need the data themselves just to deliver it to a deeply nested child. Solutions: 1) Component composition (passing components as children or props); 2) React Context API for global theme/auth state; 3) Lightweight state libraries like Zustand or Redux Toolkit.',
            ],
        ],
        2 => [
            [
                'text' => 'How do you create a Custom Hook in React? Write an example of a useDebounce or useFetch hook and explain how it encapsulates reusable logic.',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Custom hooks are JavaScript functions prefixed with \'use\' that call other React hooks. Example useDebounce(value, delay): uses useEffect with setTimeout updating debouncedValue, returning cleanup clearTimeout on dependency change. Encapsulates stateful logic without duplicating code across components.',
            ],
            [
                'text' => 'Compare React Context API with state management libraries like Zustand or Redux Toolkit. When is Context sufficient, and when does it cause performance issues?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Context is built-in and great for low-frequency global state (authenticated user, theme, locale). However, whenever a Context value changes, EVERY consumer component re-renders even if it only uses an unchanged slice. Libraries like Zustand use selector subscriptions, re-rendering only components subscribed to specifically mutated state slices.',
            ],
            [
                'text' => 'How does data fetching work with caching libraries like TanStack Query (React Query) or SWR? What problems (caching, deduplication, background refetching) do they solve?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Plain useEffect data fetching suffers from boilerplate, race conditions, lack of caching, and loading state duplication. React Query caches server state by query key, automatically deduplicates simultaneous requests, provides out-of-the-box loading/error states, refetches on window focus, and supports optimistic UI mutations.',
            ],
            [
                'text' => 'What are React Error Boundaries? Why can\'t try/catch blocks catch errors during rendering, and how does componentDidCatch prevent white-screen crashes?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'JavaScript try/catch cannot catch errors occurring inside declarative JSX rendering. Error Boundaries are class components implementing static getDerivedStateFromError() and componentDidCatch(). They catch errors anywhere in their child component tree, log the error, and display a fallback UI instead of crashing the entire app.',
            ],
            [
                'text' => 'How does Code Splitting and Lazy Loading work in React using React.lazy() and Suspense? How does dynamic importing reduce initial bundle sizes?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'By default, bundlers pack all application code into a single large bundle. React.lazy(() => import(\'./HeavyComponent\')) dynamically downloads component chunks only when rendered. <Suspense fallback={<Spinner />}> displays a loading state during chunk fetching, significantly reducing initial page load time and First Contentful Paint.',
            ],
        ],
        3 => [
            [
                'text' => 'In Next.js App Router, explain the difference between React Server Components (RSC) and Client Components (\'use client\'). When should each be used?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Server Components (default in App Router) execute ONLY on the server: they have zero impact on client bundle size, can securely query databases/APIs with private keys, but cannot use hooks (useState/useEffect) or browser event listeners. Client Components (\'use client\') hydrate in the browser, enabling interactivity, state, and browser APIs.',
            ],
            [
                'text' => 'How do Next.js Server Actions work? How do they allow calling server-side functions directly from form submissions without manually writing API route handlers?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Server Actions are async functions declared with \'use server\'. They can be passed directly to form action attributes (<form action={createPost}>) or called in transitions. Next.js automatically handles POST request serialization, CSRF protection, and allows revalidating cached tags (revalidateTag) or paths (revalidatePath) on completion.',
            ],
            [
                'text' => 'How does Routing work in the Next.js App Router? Compare dynamic segments ([id]), catch-all segments ([...slug]), layout.tsx, and loading.tsx files.',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'File-system routing based on folders. [id] matches single dynamic segment (/users/123). [...slug] matches multiple path segments (/docs/api/v1). layout.tsx defines shared UI wrapping children that preserves state across page navigations. loading.tsx wraps the page in an automated React Suspense boundary displaying instant skeleton states.',
            ],
            [
                'text' => 'How does Image Optimization work in Next.js using the <Image> component from \'next/image\'? What benefits (responsive sizing, modern WebP/AVIF formats, CLS prevention) does it provide?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'next/image automatically resizes, optimizes, and converts images into modern formats (WebP/AVIF) on demand. It enforces explicit width/height or fill to eliminate Cumulative Layout Shift (CLS), serves responsive srcset images matching device display sizes, and natively lazy-loads offscreen images.',
            ],
            [
                'text' => 'Explain Data Fetching and Caching in Next.js. Compare Static Data Fetching (SSG / default caching) with Dynamic Rendering (SSR / cache: \'no-store\') and Revalidation (ISR).',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Next.js extends fetch(). fetch(\'url\') defaults to caching indefinitely for static pages (SSG). Adding { cache: \'no-store\' } forces dynamic execution on every request (SSR). { next: { revalidate: 60 } } implements Incremental Static Regeneration (ISR), serving cached static pages while re-generating fresh HTML in the background every 60 seconds.',
            ],
        ],
    ],
    'typescript' => [
        1 => [
            [
                'text' => 'What is TypeScript, and how does it compile to JavaScript? What are the key advantages of static type checking over dynamic typing during development?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'TypeScript is a typed superset of JavaScript that compiles (transpiles) down to plain JavaScript. Types are erased at compile time. Static type checking catches syntax errors, null reference mistakes, and type mismatches at compile time rather than in production, and provides superior IDE autocompletion and refactoring.',
            ],
            [
                'text' => 'Compare Interfaces with Type Aliases in TypeScript. When would you choose an \'interface\' over a \'type\' (and vice versa)?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Both describe object shapes. Interfaces can be extended with \'extends\' and support declaration merging (multiple interfaces of same name merge properties, ideal for library authoring). Type aliases (\'type\') can declare primitives, union types (\'type Status = "active" | "inactive"\'), tuples, and mapped types that interfaces cannot represent.',
            ],
            [
                'text' => 'Explain Union Types (|) and Intersection Types (&) in TypeScript with practical code examples. How do Discriminated Unions help in type safety?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Union types (A | B) mean a value can be of type A OR type B. Intersection types (A & B) combine all properties of A AND B. Discriminated unions use a shared literal property (e.g. kind: \'circle\' | \'square\') allowing switch statements to exhaustively narrow types with compile-time certainty.',
            ],
            [
                'text' => 'What is the difference between \'any\' and \'unknown\' in TypeScript? Why is \'unknown\' preferred for typing unvalidated external API payloads?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => '\'any\' disables all type checking, allowing arbitrary property access and assignments (defeats TypeScript\'s purpose). \'unknown\' is the type-safe counterpart: TypeScript does not allow accessing properties or calling methods on an \'unknown\' variable until explicit type checking or narrowing (typeof, instanceof) has occurred.',
            ],
            [
                'text' => 'How does Optional Chaining (?.) and the Nullish Coalescing Operator (??) work in TypeScript and modern JavaScript? How does ?? differ from the logical OR operator (||)?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Optional chaining (user?.profile?.name) short-circuits to undefined if any left-hand reference is null/undefined without throwing TypeError. Nullish coalescing (a ?? b) returns right-hand operand ONLY if left is null or undefined. Logical OR (a || b) treats all falsy values (0, empty string \'\', false) as false, often causing unintended defaults.',
            ],
        ],
        2 => [
            [
                'text' => 'How do Generics work in TypeScript? Write a generic function or interface that wraps API responses (ApiResponse<T>) with data, status, and error fields.',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Generics provide reusable type components that work with multiple types rather than a single one: interface ApiResponse<T> { status: number; data: T; error?: string; }. Allows callers to specify payload type upon use: ApiResponse<User[]> or ApiResponse<Product>, maintaining strong type safety across API layers.',
            ],
            [
                'text' => 'Explain common TypeScript Utility Types: Partial<T>, Required<T>, Pick<T, K>, Omit<T, K>, and Record<K, V>. Give an example of how they modify existing types.',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Partial<T> makes all properties optional (for patch updates); Required<T> makes all properties mandatory; Pick<T, \'id\'|\'name\'> selects specific keys; Omit<T, \'password\'> removes specific keys; Record<string, number> creates an object map typing keys and values.',
            ],
            [
                'text' => 'How does Type Narrowing work in TypeScript? Explain how \'typeof\', \'instanceof\', \'in\' operator, and Custom Type Guards (is operator) refine types.',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'TypeScript analyzes control flow to narrow broad types into specific types. typeof narrows primitives (string, number); instanceof narrows class instances (Date, Error); \'prop in obj\' checks property existence. Custom type guard functions return \'pet is Dog\', allowing TS to treat variable as Dog inside an if-block.',
            ],
            [
                'text' => 'What are TypeScript Enums? Compare Numeric Enums, String Enums, and \'const enum\'. Why do many developers prefer Union of String Literals over Enums?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Numeric enums auto-increment (0, 1, 2) and produce reverse mappings in compiled JS; string enums map to readable strings. \'const enum\' inlines values at compile time with zero runtime JS code. Many developers prefer union of string literals (\'active\' | \'pending\') because they require zero compiled JS runtime code and have cleaner serialization.',
            ],
            [
                'text' => 'What is the \'never\' type in TypeScript? How is \'never\' used for exhaustive checking in switch statements to ensure all union variants are handled?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => '\'never\' represents the type of values that never occur (e.g. function that always throws an error or infinite loop). In switch statements over discriminated unions, assigning the default case to a never variable (const _exhaustive: never = action) triggers a compile-time error if a new union variant is added without being handled.',
            ],
        ],
        3 => [
            [
                'text' => 'What are Mapped Types and Conditional Types in TypeScript? Explain the syntax: \'T extends U ? X : Y\' and provide a practical usecase.',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Mapped types transform properties of an existing type ({ [P in keyof T]: T[P] }). Conditional types choose types based on relationship testing: type IsString<T> = T extends string ? true : false. Used in advanced utility types like NonNullable<T> = T extends null | undefined ? never : T.',
            ],
            [
                'text' => 'What is the \'infer\' keyword in TypeScript conditional types? How does infer extract the return type of a function (like the ReturnType<T> utility type)?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => '\'infer\' introduces a type variable within the extends clause of a conditional type to be deduced by the compiler. Example ReturnType: type ReturnType<T> = T extends (...args: any[]) => infer R ? R : any. It extracts and returns the function\'s return type R without calling the function.',
            ],
            [
                'text' => 'What are TypeScript Declaration Files (.d.ts)? How do \'@types/\' packages allow TypeScript to consume untyped JavaScript libraries safely?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => '.d.ts files contain only type declarations without executable JavaScript code. They act as contracts describing the shapes of external JavaScript libraries. The DefinitelyTyped community repository publishes these as npm \'@types/library_name\' packages, enabling autocomplete and type verification on raw JS packages.',
            ],
            [
                'text' => 'What are critical tsconfig.json compiler options: \'strict\', \'noImplicitAny\', \'strictNullChecks\', and \'target\'? How do they impact code safety?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => '\'strict\': true enables all strict type checking flags. \'noImplicitAny\' flags an error on expressions with implied any. \'strictNullChecks\' ensures null and undefined are not acceptable values in every type, preventing null pointer crashes. \'target\' (e.g. ES2022) sets the JavaScript version emitted by compiler.',
            ],
            [
                'text' => 'Explain the difference between Type Assertion (\'as Type\') and Type Casting. Why can type assertions be dangerous if misused?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Type assertion (\'value as string\') tells the TypeScript compiler: \'trust me, I know the type better than you\', but it does NOT perform any runtime conversion or checking. If the value is actually a number, calling string methods at runtime throws TypeError. Real type casting requires actual JS functions (String(val), Number(val)).',
            ],
        ],
    ],
    'web_fundamentals' => [
        1 => [
            [
                'text' => 'Explain the importance of Semantic HTML5 elements (<header>, <nav>, <main>, <article>, <section>, <footer>). Why are they superior to generic <div> tags for SEO and accessibility?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Semantic elements convey meaning and document structure to both the browser, search engine crawlers, and assistive technologies (screen readers). Screen readers use landmark elements to allow blind users to jump directly to main content (<main>) or navigation (<nav>), which generic <div> containers cannot provide without ARIA roles.',
            ],
            [
                'text' => 'How does CSS Specificity work? How does the browser calculate which CSS rule applies when multiple conflicting selectors target the same element?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Specificity is calculated as a 4-part weight: Inline styles (1,0,0,0) > IDs (0,1,0,0) > Classes, attributes, and pseudo-classes (0,0,1,0) > Elements and pseudo-elements (0,0,0,1). When specificities are equal, the rule appearing latest in the stylesheet wins. !important overrides all standard specificity rules.',
            ],
            [
                'text' => 'How does CSS Flexbox work? Explain main axis versus cross axis, and the roles of justify-content, align-items, flex-grow, and flex-shrink.',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Flexbox manages 1-dimensional layout. Main axis is set by flex-direction (row = horizontal, column = vertical); cross axis is perpendicular. justify-content aligns items along the main axis; align-items aligns along the cross axis. flex-grow dictates how surplus space is absorbed; flex-shrink determines how items shrink when space is constrained.',
            ],
            [
                'text' => 'Compare \'var\', \'let\', and \'const\' in JavaScript. Explain function scope versus block scope, hoisting, and the Temporal Dead Zone (TDZ).',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => '\'var\' is function-scoped and hoisted with an initial value of undefined. \'let\' and \'const\' are block-scoped ({}) and hoisted without initialization into the Temporal Dead Zone (TDZ); accessing them before declaration throws ReferenceError. \'const\' prevents variable identifier reassignment.',
            ],
            [
                'text' => 'Explain JavaScript Promises and async/await. How do Promises represent asynchronous operations compared to traditional callback functions?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Promises represent an asynchronous operation that has three states: Pending, Fulfilled, or Rejected. They eliminate \'callback hell\' by chaining .then() and .catch(). async/await is syntactic sugar built on top of Promises, allowing asynchronous code to be written and read like synchronous code with standard try/catch blocks.',
            ],
        ],
        2 => [
            [
                'text' => 'How does DOM Event Delegation work? Why is attaching a single event listener to a parent container more efficient than attaching hundreds of listeners to child elements?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Event delegation leverages Event Bubbling: events triggered on child elements bubble up the DOM tree to ancestors. Attaching one listener on the parent container (using event.target to identify the clicked child) drastically reduces memory usage, eliminates listener management when dynamic items are added/removed, and speeds up page initialization.',
            ],
            [
                'text' => 'What are Closures in JavaScript? Write an example of a closure being used to create private variables or a function counter.',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'A closure is the combination of a function bundled together with references to its surrounding lexical environment. Inner functions have access to outer function variables even after the outer function has returned. Example: function createCounter() { let count = 0; return () => ++count; }. count cannot be modified directly from outside.',
            ],
            [
                'text' => 'How does the browser Fetch API work? Explain handling HTTP responses, parsing JSON with response.json(), and why fetch() does not reject on 404 or 500 status codes.',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'fetch(url) returns a Promise resolving to a Response object. Calling response.json() asynchronously parses the response body stream. Crucial gotcha: fetch() rejects a Promise ONLY on network failure (DNS error, connection refused). For 404 or 500 HTTP errors, the promise resolves successfully; developers must check response.ok (boolean) manually.',
            ],
            [
                'text' => 'Explain the difference between Debouncing and Throttling in JavaScript. In what real-world UI scenarios (search inputs vs window scroll) is each used?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Debouncing delays execution until a specified time has passed since the LAST event call (ideal for search autocomplete inputs, waiting until the user stops typing). Throttling ensures a function executes at most once every X milliseconds regardless of how many events fire (ideal for scroll listeners or resize handlers to prevent frame drops).',
            ],
            [
                'text' => 'What is the difference between LocalStorage, SessionStorage, and Cookies? Detail capacity limits, expiration lifecycles, and server accessibility.',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'LocalStorage: ~5-10MB, persistent until explicitly cleared, client-only. SessionStorage: ~5MB, cleared when the browser tab is closed, client-only. Cookies: ~4KB, sent automatically with every HTTP request to matching domains, support expiration dates, and can be protected from JavaScript access using the HttpOnly flag.',
            ],
        ],
        3 => [
            [
                'text' => 'How does the Browser Critical Rendering Path work? Explain DOM creation, CSSOM creation, the Render Tree, Layout (Reflow), and Painting.',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => '1) Browser parses HTML bytes to tokens to DOM nodes; 2) Parses CSS to CSSOM; 3) Combines visible DOM and CSSOM into Render Tree (omitting display:none); 4) Layout (Reflow) computes exact geometry and coordinates of each element; 5) Paint fills pixels on screen; 6) Compositing layers textures on GPU. Minimizing reflows improves web performance.',
            ],
            [
                'text' => 'How do you make a web page fully Responsive across mobile, tablet, and desktop devices? Explain viewport meta tags, CSS media queries, and fluid layout units (rem, em, %).',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => '1) Set <meta name=\'viewport\' content=\'width=device-width, initial-scale=1.0\'>; 2) Use mobile-first CSS media queries (@media (min-width: 768px)); 3) Use relative units (rem for font sizes based on root html, % and vw/vh for fluid container widths); 4) Use CSS Grid and Flexbox with auto-fit/minmax() to dynamically adapt columns.',
            ],
            [
                'text' => 'Explain Web Performance Optimization techniques: Lazy loading images (loading=\'lazy\'), script loading attributes (\'async\' vs \'defer\'), and asset minification.',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'loading=\'lazy\' on <img> defers downloading offscreen images until user scrolls near them. \'async\' scripts download in background and execute immediately (blocking parsing when ready, un-ordered). \'defer\' scripts download in background and execute in order after HTML parsing completes (before DOMContentLoaded). Minification strips whitespace and renames variables to reduce payload sizes.',
            ],
            [
                'text' => 'What is CORS (Cross-Origin Resource Sharing) from a frontend perspective? Why do browsers block cross-origin AJAX requests, and how does the server enable access?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Same-Origin Policy (SOP) prevents malicious scripts on one origin from accessing sensitive data on another origin. A request is cross-origin if protocol, domain, or port differ. If frontend on localhost:3000 requests api.com:8000, browser blocks the response unless api.com sends Access-Control-Allow-Origin: http://localhost:3000.',
            ],
            [
                'text' => 'What is the JavaScript Event Loop? Explain the Call Stack, Web APIs, Task Queue (Macrotasks like setTimeout), and Microtask Queue (Promises). What is the execution order?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'JS is single-threaded. Synchronous code runs on the Call Stack. Asynchronous calls (setTimeout, fetch) offload to browser Web APIs. When complete, callbacks go to queues. The Event Loop prioritizes the Microtask Queue (Promises, queueMicrotask): it empties the entire microtask queue before processing the next Macrotask (setTimeout/setInterval).',
            ],
        ],
    ],
    'angular' => [
        1 => [
            [
                'text' => 'Explain Angular Component Architecture. What are the roles of the @Component decorator, template, styles, and selector?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Components are the fundamental building blocks of Angular UIs. @Component metadata decorator configures: \'selector\' (custom HTML tag name to instantiate component), \'templateUrl\' or inline \'template\' (HTML view), and \'styleUrls\' (scoped CSS/SCSS). The TypeScript class contains component state properties and business logic methods.',
            ],
            [
                'text' => 'How does Data Binding work in Angular? Explain interpolation {{}}, property binding [], event binding (), and two-way binding [()].',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Interpolation {{ title }} displays component properties as text. Property binding [src]=\'imageUrl\' binds component state to DOM element properties (one-way: component to DOM). Event binding (click)=\'handleClick()\' listens for DOM events (one-way: DOM to component). Two-way binding [(ngModel)]=\'username\' synchronizes state both ways simultaneously.',
            ],
            [
                'text' => 'Walk through the Angular Component Lifecycle hooks in order: ngOnInit, ngOnChanges, ngAfterViewInit, and ngOnDestroy. What code belongs in each hook?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'ngOnChanges fires when @Input properties change; ngOnInit runs once after inputs are bound, ideal for initializing state and calling HTTP services; ngAfterViewInit runs after component template and child views initialize (for @ViewChild DOM queries); ngOnDestroy runs before component teardown, essential for unsubscribing observables to prevent memory leaks.',
            ],
            [
                'text' => 'What are Angular Directives? Compare Structural Directives (*ngIf, *ngFor) with Attribute Directives (ngClass, ngStyle).',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Directives add behavior to DOM elements. Structural directives (*ngIf, *ngFor, *ngSwitch) alter DOM structure by adding, removing, or manipulating elements (the * desugars into <ng-template>). Attribute directives (ngClass, ngStyle) alter the appearance or behavior of existing DOM elements without altering document structure.',
            ],
            [
                'text' => 'What are Standalone Components introduced in modern Angular (Angular 14+)? How do they eliminate the need for NgModules?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Standalone components specify \'standalone: true\' in their @Component decorator and directly declare their own dependencies in an \'imports: []\' array (e.g. CommonModule, other components/pipes). This eliminates the complex boilerplate of registering components in intermediate NgModule files, simplifying architecture and improving tree-shaking.',
            ],
        ],
        2 => [
            [
                'text' => 'How does Dependency Injection (DI) work in Angular? Explain the @Injectable decorator and what \'providedIn: root\' achieves.',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Angular\'s DI framework instantiates and delivers dependent services to classes. @Injectable({ providedIn: \'root\' }) registers the service as an application-wide singleton that is automatically tree-shakable (omitted from final bundle if never used). If provided at component level, a new isolated service instance is created per component lifecycle.',
            ],
            [
                'text' => 'How does RxJS integrate with Angular? What is the difference between an Observable and a Promise, and why is the async pipe (| async) recommended in templates?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Promises handle a single asynchronous event and are not cancelable. RxJS Observables handle a stream of zero or multiple asynchronous events over time and are cancelable. The async pipe in templates auto-subscribes to observables, updates view when data arrives, and automatically unsubscribes on component destruction, preventing memory leaks.',
            ],
            [
                'text' => 'Compare Angular Reactive Forms with Template-Driven Forms. How do FormGroup, FormControl, and FormArray provide programmatic validation?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Template-driven forms rely on ngModel in HTML, suitable for simple forms. Reactive forms define the form model programmatically in TypeScript using FormControl, FormGroup, and FormArray. They offer synchronous access to form values, reactive valueChanges observables, and clean composable unit testing with built-in Validators (required, email, minLength).',
            ],
            [
                'text' => 'How does Routing work in Angular? Explain configuring routes with RouterModule, router-outlet, Route Guards (CanActivateFn), and passing route parameters.',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Routes map URL paths to components: { path: \'users/:id\', component: UserDetailComponent, canActivate: [authGuard] }. <router-outlet> marks the location in the view where matching components render. Route guards inspect authentication/permissions, returning true/false or a UrlTree redirect. ActivatedRoute extracts route params (route.snapshot.paramMap.get(\'id\')).',
            ],
            [
                'text' => 'What are Angular Pipes? Explain built-in pipes (date, currency, uppercase) and how to write a custom Pipe implementing PipeTransform.',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Pipes transform template values before display without mutating underlying state: {{ price | currency:\'USD\' }}. A custom pipe implements PipeTransform interface with transform(value, ...args) method. By default, pipes are Pure (re-evaluated only when primitive input values change or object references mutate, saving compute).',
            ],
        ],
        3 => [
            [
                'text' => 'Explain Angular Change Detection. How does Zone.js notify Angular of asynchronous events, and how does the OnPush change detection strategy boost performance?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Zone.js monkey-patches browser async APIs (setTimeout, events, XHR), triggering a top-down change detection cycle across the component tree when an event finishes. By default, Angular checks every component. ChangeDetectionStrategy.OnPush disables automated checking, re-checking the component ONLY when @Input object references mutate, an event fires inside it, or manual markForCheck() is called.',
            ],
            [
                'text' => 'What are Angular Signals introduced in Angular 16+? How do signal(), computed(), and effect() provide fine-grained reactivity without Zone.js?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Signals are reactive primitives holding values: const count = signal(0). Reading a signal (count()) registers dependency. computed(() => count() * 2) derives values cached until dependencies change. effect() runs side effects. Signals notify Angular exactly which DOM node needs updating, enabling sub-component fine-grained reactivity and zoneless Angular.',
            ],
            [
                'text' => 'How does Lazy Loading work in the Angular Router? How does using loadComponent / loadChildren reduce initial bundle sizes?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Instead of importing all components at the top of the route file, lazy loading uses dynamic imports: { path: \'dashboard\', loadComponent: () => import(\'./dashboard/dashboard.component\').then(m => m.DashboardComponent) }. Webpack/Vite splits the route into a separate JavaScript chunk downloaded only when the user navigates to /dashboard.',
            ],
            [
                'text' => 'How do HTTP Interceptors work in Angular? Explain how HttpInterceptorFn intercepts outgoing requests to attach Bearer tokens and catch global errors.',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'HTTP Interceptors sit in the HTTP pipeline. An auth interceptor clones the request using req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) and passes it to next(clonedReq). It can also pipe catchError() to intercept 401 Unauthorized responses and redirect to login or attempt token refresh.',
            ],
            [
                'text' => 'How do you optimize an Angular application for production? Explain Ahead-of-Time (AOT) compilation, build budgets, and tree-shaking.',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'AOT compilation converts Angular HTML templates into executable TypeScript during build time rather than in browser, eliminating the Angular compiler from the bundle and catching template syntax errors early. Build budgets in angular.json enforce maximum bundle size limits, failing CI if bundles exceed thresholds. Tree-shaking strips unused code.',
            ],
        ],
    ],
    'ui_ux' => [
        1 => [
            [
                'text' => 'Explain the 5 stages of the Design Thinking process: Empathize, Define, Ideate, Prototype, and Test. What is the goal of each stage?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Empathize: understand user needs through interviews and observation; Define: synthesize findings into actionable problem statements and personas; Ideate: brainstorm wide range of creative solutions; Prototype: build tangible low-to-high fidelity representations of ideas; Test: gather feedback from real users to validate assumptions iteratively.',
            ],
            [
                'text' => 'What is the difference between Wireframes, Mockups, and Prototypes? When is each deliverable used during the product design lifecycle?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Wireframes: low-fidelity grayscale structural layouts focusing on information architecture and hierarchy without styling. Mockups: high-fidelity static visual designs showcasing typography, color schemes, and branding. Prototypes: interactive clickable simulations demonstrating user flows, animations, and transitions for usability testing.',
            ],
            [
                'text' => 'Explain the core principles of Visual Hierarchy in UI design: scale, color contrast, whitespace, and typographic weight. How does hierarchy guide user reading flow?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Visual hierarchy directs the viewer\'s eye across the page in order of importance (typically following F-pattern for text or Z-pattern for landing pages). Achieved using larger font scales for headlines, high-contrast primary colors for action buttons, generous whitespace to declutter elements, and bold weights for key data points.',
            ],
            [
                'text' => 'What is the 8pt Grid System in digital product design? Why is aligning spacing, margins, and component dimensions to multiples of 8 (or 4) standard practice?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'The 8pt grid uses multiples of 8 (8, 16, 24, 32, 48px) for all sizing, padding, and margins. Because most screen resolutions (and pixel densities like @2x, @3x) scale cleanly by 8 and 4, it eliminates fractional pixels, ensures visual consistency across components, and speeds up developer handoff.',
            ],
            [
                'text' => 'What is Color Theory in UI design? Explain the 60-30-10 rule and why designing in grayscale first helps validate layout effectiveness.',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'The 60-30-10 rule balances palette: 60% dominant neutral background color, 30% secondary structure color (cards, sidebars), and 10% accent color reserved exclusively for primary interactive calls to action. Designing in grayscale first forces the designer to establish strong contrast and layout hierarchy before color distracts.',
            ],
        ],
        2 => [
            [
                'text' => 'What is a Design System? Explain Design Tokens (colors, typography, spacing) and how components in Figma translate to frontend code (e.g. CSS variables).',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'A design system is a collection of reusable components guided by clear standards. Design tokens are the atomic visual attributes (e.g. color-primary: #3b82f6, spacing-md: 16px) stored as platform-agnostic variables (JSON/CSS custom properties). When updated, changes propagate automatically across both design files and codebases.',
            ],
            [
                'text' => 'Explain Web Content Accessibility Guidelines (WCAG) 2.1 AA requirements: Color Contrast ratios (4.5:1 for normal text, 3:1 for large text), focus indicators, and screen reader labels.',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'WCAG 2.1 AA mandates minimum 4.5:1 contrast for normal text and 3:1 for large text against background. Interactive elements must provide visible keyboard focus rings (:focus-visible) for motor-impaired users. Icons without visible text must include aria-label or screen-reader only text (<span class=\'sr-only\'>) for screen readers.',
            ],
            [
                'text' => 'What are Usability Heuristics? Explain Jakob Nielsen\'s heuristics: \'Visibility of System Status\', \'Error Prevention\', and \'Consistency and Standards\' with UI examples.',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Visibility of system status: keep users informed of what is happening (progress bars, spinners, upload percentages). Error prevention: prevent mistakes before they happen (confirm dialog before deleting, disabling submit when forms are invalid). Consistency: use standard UI patterns (shopping cart icon in top right, blue underlined links).',
            ],
            [
                'text' => 'How do you design high-converting Form UX? Discuss inline validation vs on-submit validation, clear error messages, and reducing cognitive load.',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Best practices: 1) Single-column form layouts are faster to scan; 2) Inline validation that triggers on blur or debounced typing (don\'t show errors before user finishes typing); 3) Clear, helpful error text specifying how to fix the error (not just \'Invalid\'); 4) Masked inputs for phone/credit cards; 5) Group related inputs into multi-step wizards.',
            ],
            [
                'text' => 'What is Information Architecture (IA)? How do Card Sorting (open vs closed) and Tree Testing help structure website navigation and sitemaps?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'IA organizes and structures content to help users find information easily. Open card sorting asks users to group topic cards and name the categories (discovering mental models). Closed card sorting asks users to sort topics into predefined categories. Tree testing evaluates navigation findability on a text-only hierarchy without visual design distractions.',
            ],
        ],
        3 => [
            [
                'text' => 'How do you conduct a Usability Testing session? Explain the \'Think-Aloud Protocol\', moderated vs unmoderated testing, and measuring task completion rate.',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Moderated testing has an observer guiding the participant; unmoderated uses platforms (UserTesting) where users record themselves following prompts. Think-aloud protocol asks users to vocalize thoughts, confusions, and intentions continuously while completing realistic tasks. Core metrics: Task completion rate (%), time on task, and error frequency.',
            ],
            [
                'text' => 'What are Micro-Interactions in UI design? How do subtle animations and hover/press state feedback enhance perceived performance and user satisfaction?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Micro-interactions are single-purpose product moments (toggling a switch, button depress animation, heart like bounce). They provide immediate physical feedback confirming user actions, guide attention to updated UI states, and disguise background network latency (making apps feel faster and more responsive).',
            ],
            [
                'text' => 'How do you design for Mobile-First experiences? Discuss touch target sizes (minimum 44x44px or 48x48px), thumb-friendly navigation zones, and bottom navigation bars.',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Mobile-first prioritizes essential content first on small screens. Touch targets must be at least 48x48px with adequate padding to prevent mis-taps. Place primary interactive actions in the \'thumb zone\' (bottom half of screen accessible with one hand) using sticky bottom navigation bars instead of top hamburger menus.',
            ],
            [
                'text' => 'How do UX designers use Quantitative Analytics (heatmaps, scroll maps, session replays, drop-off funnels) alongside Qualitative Interviews to identify drop-off points?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Quantitative tools (Google Analytics, Mixpanel funnels) show WHAT is happening and WHERE users drop off (e.g. 50% drop at step 2). Heatmaps and session replays (Hotjar) show HOW users behave (rage clicks, dead clicks). Qualitative interviews explain WHY users drop off (e.g. \'I didn\'t understand why you needed my phone number\').',
            ],
            [
                'text' => 'How do you handle Developer Handoff in Figma? What documentation (component variants, auto-layout, edge-case states: empty, loading, error) ensures accurate engineering implementation?',
                'category' => 'technical',
                'duration_seconds' => 180,
                'note' => 'Handoff best practices: 1) Build using Figma Auto-Layout mimicking CSS Flexbox; 2) Document all component states (Default, Hover, Active, Disabled, Loading, Error, Empty state); 3) Use consistent design token naming; 4) Add annotations explaining responsive behaviors, maximum line counts, and dynamic text truncation.',
            ],
        ],
    ],
];
