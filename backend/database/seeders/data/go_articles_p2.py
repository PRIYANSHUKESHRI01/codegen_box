"""
Go Programming Curriculum - Part 2 (Articles 6 - 10)
Deep, production-grade technical articles for Go backend engineers and candidates.
"""

ARTICLES_PART2 = [
    {
        "slug": "context-propagation-and-cancellation-in-go",
        "title": "Context Propagation and Cancellation: Managing Lifecycles in Go",
        "excerpt": "Passing context.Context is ubiquitous in Go microservices, yet context misuse leads to leaked goroutines and dropped deadlines. Learn how context trees propagate cancellation signals across network boundaries, how to enforce timeouts, and the strict boundaries of context.WithValue.",
        "display_order": 6,
        "content": """In modern Go distributed systems and backend APIs, `context.Context` is the universal thread linking concurrent operations. It carries cancellation signals, deadlines, and request-scoped values across API boundaries and goroutine trees.

Despite being in standard library since Go 1.7, context mismanagement is still one of the most common causes of leaked goroutines, unresponsive microservices, and thread pool exhaustion.

---

## 1. The Anatomy of `context.Context`

The `context.Context` interface is intentionally minimal:

```go
type Context interface {
    Deadline() (deadline time.Time, ok bool)
    Done() <-chan struct{}
    Err() error
    Value(key any) any
}
```

- **`Done()`**: Returns a receive-only channel. When the context is cancelled or times out, the channel is closed. Because receiving from a closed channel unblocks immediately, multiple goroutines can listen on `<-ctx.Done()` simultaneously.
- **`Err()`**: Explains why the context closed (`context.Canceled` or `context.DeadlineExceeded`).

---

## 2. The Context Tree Hierarchy

Contexts form an immutable, hierarchical tree. Every derived context holds a reference to its parent:

```
                  context.Background()
                           |
                 ctx, cancel := WithCancel()
                    /              \\
    ctxTimeout, _ := WithTimeout()   ctxVal := WithValue()
```

### The Invariants of Context Cancellation:
1. **Cancellation cascades downwards**: Cancelling a parent automatically and immediately cancels all child contexts derived from it.
2. **Cancellation never moves upwards**: Cancelling a child has zero effect on its parent or siblings.

---

## 3. Preventing Goroutine Leaks with Contexts

In Go, if a goroutine is launched to perform background work (e.g., querying an upstream service or database), and the HTTP client disconnects, that goroutine must not run forever in the background.

### Leaking Goroutine (Anti-Pattern):
```go
func processItems(items []string) {
    ch := make(chan string)
    go func() {
        for _, item := range items {
            // If the receiver gives up early, this send blocks FOREVER!
            ch <- heavyProcessing(item)
        }
    }()
    // Leaks the goroutine if caller doesn't read all items
}
```

### Context-Aware Clean Goroutine (Production Pattern):
```go
func processItemsSafe(ctx context.Context, items []string) <-chan string {
    out := make(chan string)
    go func() {
        defer close(out)
        for _, item := range items {
            select {
            case <-ctx.Done(): // Unblocks immediately if context is cancelled!
                return         // Cleanly exits; no leaked goroutine or memory
            case out <- heavyProcessing(item):
            }
        }
    }()
    return out
}
```

---

## 4. Timeouts and Deadlines: `WithTimeout` vs `WithDeadline`

Always enforce bounded latency on network and database operations:

```go
ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
defer cancel() // CRITICAL: Always defer cancel() to free timer resources immediately!

req, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://api.example.com/data", nil)
if err != nil {
    return err
}

resp, err := http.DefaultClient.Do(req)
if err != nil {
    if errors.Is(ctx.Err(), context.DeadlineExceeded) {
        log.Println("Operation timed out after 2 seconds")
    }
    return err
}
defer resp.Body.Close()
```

> **Why `defer cancel()` is required:** Even if the work finishes in 10ms, the internal timer created by `WithTimeout` remains active until the full 2 seconds expire unless cancelled, keeping the context in memory. Calling `cancel()` disarms the timer immediately.

---

## 5. The Three Rules of `context.WithValue`

`context.WithValue` allows embedding key-value pairs into a context. However, it is easily abused as a hidden dumping ground for global variables.

### Rule 1: Never pass optional function parameters
If a function needs a database connection, user ID, or configuration struct, pass it explicitly as a function argument. Don't hide required parameters inside `context.Value`.

### Rule 2: Only pass transit metadata
Valid uses include:
- Distributed trace IDs (OpenTelemetry traceparent)
- Request correlation IDs
- Authenticated JWT claims / Security principals

### Rule 3: Always use custom unexported types for keys
Using plain strings or integers as keys creates collisions between independent packages:

```go
package telemetry

type contextKey struct{} // unexported struct prevents collisions

var traceIDKey = contextKey{}

func WithTraceID(ctx context.Context, traceID string) context.Context {
    return context.WithValue(ctx, traceIDKey, traceID)
}

func TraceIDFromContext(ctx context.Context) (string, bool) {
    val, ok := ctx.Value(traceIDKey).(string)
    return val, ok
}
```

---

## Key Takeaways

1. Context cancellation is a broadcast signal: listening to `<-ctx.Done()` allows graceful termination.
2. Always `defer cancel()` when creating contexts with timeouts or cancellation.
3. Pass `context.Context` as the very first parameter of a function: `func Do(ctx context.Context, ...)`.
4. Context values must be transit metadata only; use unexported structs as keys to prevent collisions."""
    },
    {
        "slug": "low-level-concurrency-sync-and-atomic",
        "title": "Low-Level Concurrency: Mutexes, Atomic Operations, and sync.Pool",
        "excerpt": "Channels are not always the answer. For high-frequency state updates, caching, and hot paths, the sync and sync/atomic packages deliver orders of magnitude higher throughput. Learn sync.Mutex, sync.RWMutex, sync.Once, cache-line contention, lock-free primitives, and GC relief with sync.Pool.",
        "display_order": 7,
        "content": """The Go community famously emphasizes: *"Do not communicate by sharing memory; share memory by communicating."* While channels are ideal for ownership transfer, worker dispatch, and pipelines, using channels for simple state mutations or high-frequency shared counters introduces massive CPU overhead.

For high-throughput systems, low-latency caches, and fine-grained resource pooling, the `sync` and `sync/atomic` packages provide the fundamental primitives of hardware-level concurrency.

---

## 1. Channels vs. Mutexes: When to Use What

| Requirement | Use Channels | Use Mutex / Atomics |
| :--- | :--- | :--- |
| **Passing ownership of data** | Yes (clean sender -> receiver transfer) | No |
| **Distributing units of work** | Yes (Worker pool pattern) | No |
| **In-place cache or struct mutation** | No (too much allocation / scheduling overhead) | Yes (`sync.Mutex` / `sync.RWMutex`) |
| **High-frequency counters / metrics** | No (channel operations take ~50-100ns) | Yes (`sync/atomic` takes ~2-5ns) |
| **Resource reuse / GC relief** | No | Yes (`sync.Pool`) |

---

## 2. `sync.Mutex` vs. `sync.RWMutex`

### `sync.Mutex`: Exclusive Lock
Only one goroutine can hold the lock at any time.

```go
type SafeCounter struct {
    mu    sync.Mutex
    count int
}

func (c *SafeCounter) Inc() {
    c.mu.Lock()
    defer c.mu.Unlock()
    c.count++
}
```

### `sync.RWMutex`: Reader-Writer Lock
Allows arbitrary concurrent readers, but writing requires an exclusive lock:
- Use `RLock()` / `RUnlock()` for reads.
- Use `Lock()` / `Unlock()` for writes.

> **Caution with `RWMutex`:** If writes are frequent, `sync.RWMutex` can be slower than `sync.Mutex` because tracking active readers incurs additional atomic bookkeeping overhead. Only reach for `RWMutex` when reads outnumber writes by **at least 10:1**.

---

## 3. `sync.Once`: Safe Initialization

Ensures a block of code executes **exactly once**, regardless of how many goroutines invoke it concurrently.

```go
var (
    dbInstance *sql.DB
    once       sync.Once
)

func GetDB() *sql.DB {
    once.Do(func() {
        dbInstance = initializeDatabaseConnection()
    })
    return dbInstance
}
```
In Go 1.21+, you can use `sync.OnceValue` and `sync.OnceValues` to return typed values and errors directly from the initialization closure!

---

## 4. Hardware-Level Lock-Free Concurrency: `sync/atomic`

When updating a single number, pointer, or boolean flag, acquiring a mutex forces the OS thread or goroutine scheduler to manage lock contention.

Hardware CPU architectures (x86, ARM64) provide atomic CPU instructions (like `LOCK CMPXCHG` or `LDREX/STREX`) that execute in a single memory cycle.

In Go 1.19+, standard typed atomics are available:

```go
package metrics

import "sync/atomic"

type ServerMetrics struct {
    activeConnections atomic.Int64
    isShuttingDown     atomic.Bool
}

func (m *ServerMetrics) AddConnection() {
    m.activeConnections.Add(1) // Atomic fetch-and-add (thread-safe, zero locks)
}

func (m *ServerMetrics) RemoveConnection() {
    m.activeConnections.Add(-1)
}

func (m *ServerMetrics) Current() int64 {
    return m.activeConnections.Load() // Atomic memory read
}
```

---

## 5. Reducing Garbage Collection Overhead with `sync.Pool`

In high-throughput HTTP or TCP servers, allocating temporary byte buffers for every incoming request generates millions of short-lived heap allocations, putting heavy pressure on the Go Garbage Collector.

`sync.Pool` provides a thread-safe pool of reusable memory instances:

```go
package serializer

import (
    "bytes"
    "sync"
)

var bufferPool = sync.Pool{
    New: func() any {
        return new(bytes.Buffer)
    },
}

func FormatLog(user string, action string) []byte {
    // Acquire a buffer from the pool (or creates one via New)
    buf := bufferPool.Get().(*bytes.Buffer)
    buf.Reset() // Always reset before reuse!
    defer bufferPool.Put(buf) // Return back to pool when done

    buf.WriteString("User: ")
    buf.WriteString(user)
    buf.WriteString(" Action: ")
    buf.WriteString(action)

    // Make an independent copy if the bytes outlive this function
    res := make([]byte, buf.Len())
    copy(res, buf.Bytes())
    return res
}
```

---

## Key Takeaways

1. Channels are for communication and coordination; mutexes and atomics are for shared mutable state.
2. `sync/atomic` provides lock-free, nano-second speed updates for numbers and flags.
3. Never copy a mutex by value; use pointer receivers on structs embedding a mutex.
4. Use `sync.Pool` to eliminate heap allocations in hot paths like buffer formatting and JSON decoding."""
    },
    {
        "slug": "writing-high-performance-http-services-in-go",
        "title": "High-Performance HTTP Services: net/http, Middleware, and Graceful Shutdown",
        "excerpt": "Go's standard library net/http powers modern cloud backends. Learn how connection pooling, multiplexing (http.ServeMux enhancements in Go 1.22+), robust server timeout tuning against Slowloris attacks, idiomatic middleware chains, and zero-downtime graceful shutdown keep services resilient under load.",
        "display_order": 8,
        "content": """Go is renowned for its standard library. Unlike Python or Node.js where production frameworks (FastAPI, Express, NestJS) are mandatory, Go's standard `net/http` package is production-ready out of the box and forms the foundation of modern cloud-native systems like Kubernetes, Docker, and CockroachDB.

However, using `net/http` with default parameters in production is an invitation to service failure. This guide covers how `net/http` works internally, how to harden it against connection exhaustion, and how to structure robust services.

---

## 1. How `net/http` Works Under the Hood

When you call `http.ListenAndServe(addr, handler)`:
1. An internal TCP listener accepts new connections.
2. For **every single TCP connection**, Go spawns a **dedicated goroutine** (`c.serve()`).
3. HTTP/1.1 connections remain persistent (Keep-Alive) by default, reading requests sequentially on that goroutine.
4. HTTP/2 connections multiplex multiple request streams across that single TCP connection.

Because goroutines are lightweight (~2 KB), a single Go server can comfortably hold hundreds of thousands of concurrent idle HTTP connections without thread exhaustion.

---

## 2. Hardening Server Timeouts (Preventing Slowloris Attacks)

The single biggest mistake in Go web development is using `http.ListenAndServe`:
```go
// DANGEROUS IN PRODUCTION: Zero timeouts!
http.ListenAndServe(":8080", mux)
```
By default, Go has **no timeouts**. If a malicious client sends 1 byte every 10 seconds (a Slowloris attack) or a mobile client drops connectivity, the connection stays open indefinitely, leaking goroutines and file descriptors until the OS crashes.

### The Production Server Configuration:
```go
server := &http.Server{
    Addr:         ":8080",
    Handler:      mux,
    ReadTimeout:  5 * time.Second,  // Max duration reading entire request including body
    ReadHeaderTimeout: 2 * time.Second, // Max duration reading headers (defense against Slowloris)
    WriteTimeout: 10 * time.Second, // Max duration writing response
    IdleTimeout:  120 * time.Second, // Max time to keep idle Keep-Alive connection open
    MaxHeaderBytes: 1 << 20,       // 1 MB maximum header size
}
```

---

## 3. Modern Routing in Go 1.22+

In Go 1.22, `http.ServeMux` received major upgrades: it now supports HTTP methods and path wildcards natively, eliminating the need for 3rd-party routers for many applications!

```go
mux := http.NewServeMux()

// Method + Exact path match:
mux.HandleFunc("POST /api/v1/users", handleCreateUser)

// Path parameter matching with {id}:
mux.HandleFunc("GET /api/v1/users/{id}", func(w http.ResponseWriter, r *http.Request) {
    id := r.PathValue("id") // Extract path parameter directly!
    fmt.Fprintf(w, "User ID: %s", id)
})

// Wildcard trailing path:
mux.HandleFunc("GET /static/{path...}", handleStaticFiles)
```

---

## 4. Writing Idiomatic Middleware

Middleware in Go is simply a function that wraps an `http.Handler` and returns a new `http.Handler`:

```go
type Middleware func(http.Handler) http.Handler

func LoggingMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        start := time.Now()
        next.ServeHTTP(w, r)
        log.Printf("%s %s took %v", r.Method, r.URL.Path, time.Since(start))
    })
}
```

### Chaining Middleware Cleanly:
```go
func Chain(h http.Handler, middlewares ...Middleware) http.Handler {
    for i := len(middlewares) - 1; i >= 0; i-- {
        h = middlewares[i](h)
    }
    return h
}
```

---

## 5. Zero-Downtime Graceful Shutdown

When deploying to Kubernetes or updating a container, the OS sends a `SIGTERM` or `SIGINT` signal. If your app terminates immediately, in-flight customer transactions are killed midway.

Go provides `server.Shutdown(ctx)` which:
1. Stops accepting new connections on the listener.
2. Closes all idle Keep-Alive connections.
3. Waits for active in-flight requests to complete before exiting.

```go
func main() {
    server := &http.Server{Addr: ":8080", Handler: mux}

    // Run server in background goroutine:
    go func() {
        if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
            log.Fatalf("Server error: %v", err)
        }
    }()

    // Wait for termination signal (SIGINT / SIGTERM):
    quit := make(chan os.Signal, 1)
    signal.Notify(quit, os.Interrupt, syscall.SIGTERM)
    <-quit
    log.Println("Shutting down server gracefully...")

    // Allow active requests 10 seconds to finish:
    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()

    if err := server.Shutdown(ctx); err != nil {
        log.Fatalf("Server forced to shutdown: %v", err)
    }
    log.Println("Server exited cleanly.")
}
```

---

## Key Takeaways

1. Never run `http.ListenAndServe` without setting explicit timeouts on `http.Server`.
2. Go 1.22+ `http.ServeMux` natively supports HTTP methods (`GET`, `POST`) and path parameters (`{id}`).
3. Middleware is built using the standard `func(http.Handler) http.Handler` wrapper pattern.
4. Implement graceful shutdown with `server.Shutdown(ctx)` to prevent dropping active customer requests during rolling deployments."""
    },
    {
        "slug": "profiling-benchmarking-and-go-tooling-pprof-trace",
        "title": "Profiling, Benchmarking, and Go Tooling: pprof, Trace, and the Race Detector",
        "excerpt": "Guessing performance bottlenecks is a recipe for wasted engineering hours. Learn how to write rigorous benchmarks with testing.B, find memory allocations with b.ReportAllocs(), profile live production services safely with net/http/pprof, inspect execution pauses with go tool trace, and detect subtle race conditions with -race.",
        "display_order": 9,
        "content": """Engineering intuition about performance is notoriously unreliable. Developers often spend days optimizing an arithmetic calculation that accounts for 0.01% of CPU time, completely missing an accidental heap allocation or lock contention in the main request loop.

Go provides some of the best built-in diagnostic and profiling tooling of any modern programming language:
- **`testing.B`**: Statistical micro-benchmarks
- **`net/http/pprof`**: Low-overhead production CPU and memory profiling
- **`go tool trace`**: Deep goroutine scheduler and runtime tracer
- **`-race`**: ThreadSanitizer data race detector

---

## 1. Writing Statistical Benchmarks with `testing.B`

Go has first-class benchmark support built directly into the `testing` package:

```go
func BenchmarkHashString(b *testing.B) {
    input := "high-throughput-sample-payload"
    
    b.ResetTimer()    // Exclude setup time from the benchmark clock
    b.ReportAllocs()  // Automatically reports B/op (bytes per op) and allocs/op

    for i := 0; i < b.N; i++ {
        _ = computeHash(input)
    }
}
```

### Running Benchmarks:
```bash
go test -bench=. -benchmem -count=5
```
Example Output:
```
BenchmarkHashString-8   5000000   240 ns/op   0 B/op   0 allocs/op
```

> **The Compiler Optimization Trap:** If you don't store or read the result of `computeHash(input)`, the Go compiler's dead-code elimination might optimize away the entire loop! Always assign results to a package-level sink variable:
> ```go
> var resultSink uint64
> func BenchmarkHash(b *testing.B) {
>     var r uint64
>     for i := 0; i < b.N; i++ { r = computeHash(...) }
>     resultSink = r
> }
> ```

---

## 2. Profiling Live Production Services with `pprof`

`pprof` operates via statistical sampling (typically 100 Hz for CPU), meaning it introduces minimal runtime overhead (~1–3%), making it safe to run in production.

### Enabling in an HTTP Service:
```go
import _ "net/http/pprof" // Registers pprof endpoints under /debug/pprof/

// In production, bind pprof to a private internal management port:
go func() {
    log.Println(http.ListenAndServe("localhost:6060", nil))
}()
```

### Capturing Profiles:
1. **CPU Profile (30-second sample):**
   ```bash
   go tool pprof http://localhost:6060/debug/pprof/profile?seconds=30
   ```
2. **Heap Memory Profile:**
   ```bash
   go tool pprof http://localhost:6060/debug/pprof/heap
   ```
3. **Goroutine Dump (find leaks):**
   ```bash
   go tool pprof http://localhost:6060/debug/pprof/goroutine
   ```

### Interactive Web View & Flame Graphs:
Launch a browser-based flame graph visualization:
```bash
go tool pprof -http=:8081 cpu.pb.gz
```

---

## 3. Flat vs. Cumulative Time

When reading `pprof` top lists:
- **`flat`**: Time spent strictly inside that function's own instructions.
- **`cum` (Cumulative)**: Time spent in that function **plus** all functions called downstream from it.

If a function has low `flat` time but massive `cum` time, it's a dispatcher or coordinator. If it has high `flat` time, it is doing the heavy computational lifting.

---

## 4. `go tool trace`: The Ultimate Execution Microscope

While `pprof` tells you *where* CPU time was spent, `go tool trace` reveals *when* and *why* goroutines were waiting:
- Network blocking
- Mutex lock contention
- GC pause stop-the-world phases
- Goroutine scheduling latency

### Recording a Trace:
```go
import "runtime/trace"

f, _ := os.Create("trace.out")
trace.Start(f)
defer trace.Stop()
```
View the interactive trace timeline in Chrome:
```bash
go tool trace trace.out
```

---

## 5. The Data Race Detector (`-race`)

A data race occurs when two goroutines access the same memory location concurrently, and at least one access is a write.

Go includes ThreadSanitizer directly in the toolchain. Simply add the `-race` flag:
```bash
go test -race ./...
go build -race main.go
```

If a race condition is detected, the program halts immediately with the exact stack traces of both offending goroutines.

> **Production note:** The race detector increases CPU usage by 2–10x and memory usage by 5–20x. Run it in CI tests and on canary instances, not across your entire production cluster.

---

## Key Takeaways

1. Always benchmark with `b.ReportAllocs()` to track memory allocations alongside latency.
2. Protect against compiler dead-code elimination using package-level sink variables.
3. Use `pprof` with flame graphs (`-http=:8081`) to identify hot spots visually.
4. Use `go tool trace` to diagnose concurrency stalls and mutex contention.
5. Always run automated integration tests with `go test -race`."""
    },
    {
        "slug": "go-generics-and-type-constraints-in-practice",
        "title": "Go Generics and Type Constraints: Practical Patterns and Antipatterns",
        "excerpt": "Type parameters brought parametric polymorphism to Go without compromising its simplicity. Discover how to write reusable data structures and algorithms using type sets, comparable, and tilde ~ approximation constraints, understand the runtime performance characteristics of GCShape stenciling, and avoid the trap of premature generic abstraction.",
        "display_order": 10,
        "content": """For over a decade, the absence of generics was the most debated topic in the Go community. When generics finally arrived in Go 1.18 via **Type Parameters**, the Go design team prioritized maintaining fast compilation times and readable syntax over complex meta-programming features like template metaprogramming or operator overloading.

Mastering Go generics means knowing not just **how** to write parameterized code, but knowing **when** generics are the right tool and when standard interfaces remain superior.

---

## 1. Syntax Basics: Type Parameters and Constraints

A generic function or type defines type parameters enclosed in square brackets `[T Constraint]`:

```go
// Generic function: operates on any slice of comparable elements
func Contains[T comparable](slice []T, target T) bool {
    for _, item := range slice {
        if item == target {
            return true
        }
    }
    return false
}
```

### Calling the Generic Function:
```go
foundInt := Contains([]int{1, 2, 3}, 2)        // Compiler infers T = int
foundStr := Contains([]string{"a", "b"}, "b") // Compiler infers T = string
```

---

## 2. Built-in Constraints: `any` and `comparable`

- **`any`**: An alias for `interface{}`. Allows any type whatsoever. Does not allow comparison operators (`==` or `!=`).
- **`comparable`**: Allows any type that supports equality checks (`==` and `!=`). Required whenever using `T` as a key in a map.

```go
// Generic Set data structure:
type Set[T comparable] struct {
    elements map[T]struct{}
}

func NewSet[T comparable]() *Set[T] {
    return &Set[T]{elements: make(map[T]struct{})}
}

func (s *Set[T]) Add(val T) {
    s.elements[val] = struct{}{}
}

func (s *Set[T]) Has(val T) bool {
    _, exists := s.elements[val]
    return exists
}
```

---

## 3. Custom Constraints and the Tilde `~` Operator

You can define custom constraints using interfaces that specify **type sets**:

```go
package mathutils

// Number constraint: any signed/unsigned integer or floating-point number
type Number interface {
    ~int | ~int8 | ~int16 | ~int32 | ~int64 |
    ~uint | ~uint8 | ~uint16 | ~uint32 | ~uint64 |
    ~float32 | ~float64
}

func Max[T Number](a, b T) T {
    if a > b {
        return a
    }
    return b
}
```

### The Tilde `~` (Approximation Constraint):
Notice the `~` symbol before each type.
- `int` matches **only** the strict built-in type `int`.
- `~int` matches any type whose **underlying type** is `int` (for example, `type Port int` or `type UserID int64`).

---

## 4. Under the Hood: GCShape Stenciling

How does the Go compiler compile generic code without causing binary bloat or slow execution?

- In **C++ templates**, every unique type instantiates a completely separate copy of machine code (monomorphization), causing large binary sizes.
- In **Java generics**, type erasure converts everything to `Object`, requiring boxing and runtime casts.

Go uses a hybrid model called **GCShape Stenciling**:
1. All pointer-based types (`*User`, `*Order`, `*string`) share the **same compiled machine code** because they have the same GC memory layout.
2. Value types of different sizes (`int`, `float64`, custom structs) get distinct specialized machine code implementations for optimal CPU efficiency.

---

## 5. When NOT to Use Generics (Antipatterns)

Generics are powerful, but they can easily make Go code convoluted and unidiomatic if misused.

### Antipattern 1: Replacing Classic Interfaces with Generics
If dynamic polymorphism is needed at runtime, standard interfaces are still the right choice:
```go
// BAD: Unnecessary generic complexity
func ReadPayload[R io.Reader](r R) ([]byte, error) { ... }

// GOOD: Clean, idiomatic standard Go
func ReadPayload(r io.Reader) ([]byte, error) { ... }
```

### Antipattern 2: Generics on Method Receivers
Go does not allow methods on structs to declare independent type parameters. All type parameters must be declared on the struct itself.

### The Litmus Test: When Should You Use Generics?
1. **Generic Data Structures**: Trees, Stacks, Queues, Graphs, Sets, Concurrent Caches.
2. **General-purpose Algorithms**: Slices utilities (`Map`, `Filter`, `Reduce`, `Chunk`, `Sort`).
3. **Reducing Boilerplate across Numeric Types**: Math formulas, matrix math, coordinate manipulation.

---

## Key Takeaways

1. Generics use square brackets `[T Constraint]` for type parameters.
2. `comparable` is required for types used as map keys or compared with `==`.
3. Use the tilde `~T` operator in constraint interfaces to support custom types with underlying type `T`.
4. Go uses GCShape stenciling to balance fast compile times, small binaries, and native execution speed.
5. Do not replace simple `io.Reader` style interfaces with generic parameters."""
    }
]
