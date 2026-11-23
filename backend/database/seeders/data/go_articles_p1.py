"""
Go Programming Curriculum - Part 1 (Articles 1 - 5)
Deep, production-grade technical articles for Go backend engineers and candidates.
"""

ARTICLES_PART1 = [
    {
        "slug": "goroutines-and-channels-concurrency-in-go-explained",
        "title": "Goroutines and Channels: Concurrency in Go Explained",
        "excerpt": "Go's whole pitch is 'concurrency made easy' — but goroutines and channels have real, sharp edges: leaks, deadlocks, and closed-channel panics. This walks through the mental model, a real worker-pool pattern, and the mistakes that actually happen in production.",
        "display_order": 1,
        "content": """Go's whole pitch on concurrency fits in one sentence from the language's own proverbs: **"Don't communicate by sharing memory; share memory by communicating."** That sentence is doing a lot of work, and it doesn't fully click until you've actually shipped something with goroutines and channels — including the version where you got it wrong. This is the mental model, plus the pattern and the pitfalls that show up once you leave toy examples behind.

## Goroutines: lightweight by design

A goroutine is a function running concurrently, managed by the Go runtime rather than the OS. The difference that actually matters: an OS thread typically reserves 1–8 MB of stack space up front; a goroutine starts with about 2 KB and grows/shrinks its stack as needed. Go's scheduler multiplexes potentially hundreds of thousands of goroutines onto a much smaller number of OS threads (an "M:N" scheduler) — which is why spawning 100,000 goroutines is a completely normal thing to do in Go, and spawning 100,000 OS threads would take down most machines.

Starting one is the `go` keyword in front of any function call:

```go
go doSomething()
```

That's it — `doSomething()` now runs concurrently with whatever comes after it.

## Your first goroutine (and the classic gotcha)

```go
package main

import "fmt"

func main() {
    go fmt.Println("hello from a goroutine")
    fmt.Println("hello from main")
}
```

Run this and you'll often see only `"hello from main"` print — the goroutine may never get a chance to run at all. `main()` doesn't wait for goroutines it spawns; when `main()` returns, the program exits immediately, goroutines mid-flight or not. This is the single most common first mistake, and it's *why* channels exist — you need a real synchronization mechanism, not a hopeful assumption about scheduling order.

## Channels: how goroutines talk

A channel is a typed pipe: one goroutine sends a value in, another receives it out.

```go
ch := make(chan int)   // unbuffered channel of ints
go func() {
    ch <- 42            // send
}()
value := <-ch            // receive
fmt.Println(value)       // 42
```

**Unbuffered channels block on both ends** — a send blocks until a receiver is ready, and a receive blocks until a sender is ready. This is actually the fix for the earlier gotcha: replace the bare `go fmt.Println(...)` with a channel send, and have `main()` block on the matching receive, and now `main()` genuinely cannot exit before the goroutine's work is done.

**Buffered channels** (`make(chan int, 3)`) hold up to N values without a receiver present — a send only blocks once the buffer is full. Buffering is a throughput/latency trade-off, not a correctness fix: don't reach for a buffer to "solve" a deadlock without understanding why the deadlock happened in the first place.

## The `select` statement

`select` lets a goroutine wait on multiple channel operations at once, proceeding with whichever is ready first — it's Go's version of a multiplexed event loop:

```go
select {
case msg := <-ch1:
    fmt.Println("from ch1:", msg)
case msg := <-ch2:
    fmt.Println("from ch2:", msg)
case <-time.After(2 * time.Second):
    fmt.Println("timed out waiting on both channels")
default:
    fmt.Println("nothing ready right now, don't block")
}
```

The `time.After` case is the standard way to put a timeout on a channel receive — genuinely common in real code, worth knowing by heart. The `default` case is what makes a `select` non-blocking; omit it and `select` waits until one of the channel cases is ready.

## A real pattern: worker pools

This is the pattern you'll actually reach for constantly: N worker goroutines pulling jobs off a shared channel, so you get bounded, controlled concurrency instead of spawning one goroutine per unit of work (which stops scaling once "units of work" means "10 million rows from a database").

```go
package main

import (
    "fmt"
    "sync"
)

func worker(id int, jobs <-chan int, results chan<- int, wg *sync.WaitGroup) {
    defer wg.Done()
    for job := range jobs {          // exits automatically when jobs is closed and drained
        results <- job * job         // pretend this is expensive work
    }
    _ = id // (useful for logging which worker handled what, in real code)
}

func main() {
    const numWorkers = 4
    jobs := make(chan int, 100)
    results := make(chan int, 100)
    var wg sync.WaitGroup

    for w := 1; w <= numWorkers; w++ {
        wg.Add(1)
        go worker(w, jobs, results, &wg)
    }

    for j := 1; j <= 20; j++ {
        jobs <- j
    }
    close(jobs) // tells every worker's `range jobs` loop to stop once drained

    go func() {
        wg.Wait()     // wait for all workers to finish...
        close(results) // ...then it's safe to close results
    }()

    for r := range results {
        fmt.Println(r)
    }
}
```

The two details that make this correct rather than accidentally-working: **only the sender closes a channel** (here, `main` closes `jobs` because `main` is the one sending into it), and **`results` is only closed after every worker has actually finished**, via `wg.Wait()` in its own goroutine — closing it any earlier would panic the first worker still mid-send.

## Common pitfalls

- **Goroutine leaks.** A goroutine blocked forever on a channel send/receive that will never complete never gets garbage collected — it just sits there, leaking memory and a scheduler slot, forever. The worker-pool example above avoids this by making sure `jobs` always eventually gets closed, which is what lets every `range jobs` loop actually terminate.
- **Sending on a closed channel panics.** Closing a channel is a one-way broadcast signal ("no more values coming") to receivers — it is not a general-purpose cleanup call, and sending to an already-closed channel is a runtime panic, not a no-op.
- **Only the sender should close a channel.** If a receiver closes a channel that a sender is still writing to, the very next send panics. Ownership of "who closes this channel" should be unambiguous from the code's structure, exactly like the worker-pool example's `main`-closes-`jobs` design.
- **Data races on shared state that isn't actually protected by a channel or mutex.** Two goroutines mutating the same map or slice with no synchronization is undefined behavior, even if it "usually" seems to work. Run tests with `go run -race` (or `go test -race`) — the race detector catches exactly this class of bug, and it's worth running as a habit, not just when something looks wrong.

## `sync.WaitGroup` and `sync.Mutex` — when channels aren't the right tool

"Share memory by communicating" is the *idiomatic default* in Go, not a hard rule. `sync.WaitGroup` (used above) is the standard way to wait for a set of goroutines to finish when you don't actually need to pass any data between them. `sync.Mutex` is the standard way to protect a piece of genuinely shared state (a counter, a cache) when modeling it as message-passing through a channel would just be more ceremony for no real benefit. Reach for a channel when goroutines need to hand data to each other; reach for a mutex when they need to safely touch the *same* piece of state.

## Key takeaways

- Goroutines are cheap (≈2 KB starting stack, M:N-scheduled) — but `main()` exiting doesn't wait for them, so unsynchronized goroutines can simply never run.
- Unbuffered channels synchronize sender and receiver; buffered channels only change *when* that blocking kicks in, not whether synchronization is happening at all.
- `select` + `time.After` is the standard way to put a timeout on a channel operation.
- In a worker pool: only the sender closes a channel, and `results` only closes after every worker is provably done (`sync.WaitGroup`).
- Run `go run -race` as a habit — it catches the exact class of bug ("looked fine, wasn't") that's hardest to spot by reading code.

## Practice problems to try next

Implement the worker-pool pattern above from scratch without looking. Build a simple rate limiter using `time.Ticker`. Build a pub-sub broadcaster where one goroutine fans a message out to N subscriber channels. Implement the dining philosophers problem using channels instead of mutexes."""
    },
    {
        "slug": "pointers-memory-layout-and-escape-analysis",
        "title": "Pointers, Memory Layout, and Escape Analysis: Stack vs. Heap in Go",
        "excerpt": "Passing by pointer is not always faster in Go, and returning a pointer to a local variable does not cause a crash. Understand how the Go compiler decides stack vs heap allocation, how escape analysis works via go build -gcflags=\"-m\", cache locality, and how to avoid GC pressure.",
        "display_order": 2,
        "content": """Engineers coming to Go from C/C++ expect pointers to behave like raw memory addresses with manual lifetimes, while developers coming from Java or Python often assume pointers are just standard references. Both mental models lead to subtle production bugs or missed optimizations.

In Go, pointers exist, but there is **no pointer arithmetic**. More importantly, you cannot manually choose whether a variable lives on the **stack** or on the **heap**. That decision is made entirely by the Go compiler through a process called **escape analysis**.

---

## 1. Value Semantics vs. Pointer Semantics

Every function call in Go is **pass-by-value**. When you pass a variable to a function, Go creates a copy of the argument:

```go
type Counter struct {
    Value int
}

// Value receiver / argument: operates on an isolated copy
func incrementVal(c Counter) {
    c.Value++
}

// Pointer receiver / argument: operates on the shared original memory
func incrementPtr(c *Counter) {
    c.Value++
}
```

- When calling `incrementVal(c)`, 8 bytes (the integer `Value`) are copied onto the caller's stack frame. Modifications are lost when the function returns.
- When calling `incrementPtr(&c)`, an 8-byte pointer address is copied. Dereferencing `c.Value++` modifies the underlying memory.

### The Mental Rule of Thumb:
- **Use value semantics** when the type is small (primitive numbers, small structs under 64 bytes, immutable configuration) or when concurrent immutability is desired.
- **Use pointer semantics** when the method must mutate state, when the struct is large, or when representing shared system entities (e.g., `*os.File`, `*sql.DB`, `*http.Server`).

---

## 2. The Stack vs. The Heap: Cost and Lifetime

| Property | Stack | Heap |
| :--- | :--- | :--- |
| **Allocation Speed** | Instant (~1 CPU cycle: adjusts stack pointer register) | Slow (searches free lists, mcache/mcentral arenas) |
| **Deallocation** | Instant (stack pointer resets on function return) | Garbage Collector (requires mark & sweep phases) |
| **Locality** | Cache hot (L1/L2 CPU cache lines) | Fragmented, prone to cache misses |
| **Thread Model** | Contiguous, bounded per-goroutine (starts at 2 KB) | Shared globally across all OS threads |
| **GC Overhead** | Zero GC tracking | Must be scanned during GC mark phase |

In C or C++, returning the address of a local stack variable causes undefined behavior (dangling pointer):
```c
// C undefined behavior: stack memory invalidated on return
int* dangling() {
    int x = 42;
    return &x; // BUG!
}
```

In Go, this is **completely safe and idiomatic**:
```go
// Perfectly safe in Go:
func createAnswer() *int {
    x := 42
    return &x // The compiler detects this and allocates 'x' on the heap!
}
```

---

## 3. Escape Analysis: How the Compiler Decides

Escape analysis is a compile-time optimization. The compiler constructs a directed graph of variable references. If a variable's reference could outlive the stack frame of the function that created it, the compiler emits an instruction to allocate that variable in the runtime heap rather than the stack.

You can inspect the compiler's exact escape decisions using:
```bash
go build -gcflags="-m" main.go
```
Pass `-m -m` for verbose diagnostic traces.

### The 4 Major Triggers for Heap Escape:

#### Trigger 1: Returning Pointers
```go
func NewUser(name string) *User {
    u := User{Name: name} // "u escapes to heap"
    return &u
}
```

#### Trigger 2: Assigning to Interfaces (`any` / `interface{}`)
Whenever a concrete type is converted to an interface (such as passing to `fmt.Println`), the runtime must allocate the value on the heap so the interface can store a pointer to it:
```go
x := 100
fmt.Println(x) // "x escapes to heap" because fmt.Println accepts ...any
```

#### Trigger 3: Slices with Dynamic or Unbounded Capacity
```go
// Stays on stack if capacity is a small constant:
buf := make([]byte, 64)

// Escapes to heap because size is only known at runtime:
n := dynamicSize()
buf2 := make([]byte, n) // "make([]byte, n) escapes to heap"
```

#### Trigger 4: Shared Closures
```go
func counter() func() int {
    count := 0 // escapes to heap: captured by returned anonymous function
    return func() int {
        count++
        return count
    }
}
```

---

## 4. The Pointer Trap: Why Pointers Can Be Slower

Many developers reflexively pass all structs by pointer "for performance" to avoid copying. In modern CPUs, this is often a performance regression:

1. **CPU Cache Misses**: Copying a 32-byte struct across stack frames keeps the data in ultra-fast L1 cache registers. Passing a pointer forces the CPU to chase a memory reference through RAM or L3 cache.
2. **GC Tracing Overhead**: Every heap pointer must be chased during the Garbage Collector's concurrent mark phase. A struct made purely of values (integers, floats, fixed arrays) requires zero pointer scanning.
3. **Pointer Dereferencing Latency**: A pointer indirection can cost 100-200 CPU cycles if the cache line is cold, whereas copying 32 bytes takes 1-2 cycles.

### Rule of thumb:
If a struct is **under 64 bytes** (one CPU cache line) and does not need mutation, pass it by value.

---

## 5. Benchmarking Value vs. Pointer Semantics

```go
package main

import "testing"

type Coordinate struct {
    X, Y, Z, W float64 // 32 bytes
}

func calculateVal(c Coordinate) float64 {
    return c.X + c.Y + c.Z + c.W
}

func calculatePtr(c *Coordinate) float64 {
    return c.X + c.Y + c.Z + c.W
}

func BenchmarkValue(b *testing.B) {
    c := Coordinate{X: 1.1, Y: 2.2, Z: 3.3, W: 4.4}
    b.ReportAllocs()
    for i := 0; i < b.N; i++ {
        _ = calculateVal(c)
    }
}

func BenchmarkPointer(b *testing.B) {
    c := Coordinate{X: 1.1, Y: 2.2, Z: 3.3, W: 4.4}
    b.ReportAllocs()
    for i := 0; i < b.N; i++ {
        _ = calculatePtr(&c)
    }
}
```

In micro-benchmarks on modern 64-bit hardware, `BenchmarkValue` often performs at least as fast as, or faster than, `BenchmarkPointer`, with zero heap allocations in both.

---

## Key Takeaways

1. **Go uses pass-by-value everywhere**: Passing a pointer merely copies the memory address value.
2. **Returning pointers to locals is safe**: Go's escape analysis automatically moves escaped variables to the heap.
3. **Pointers create GC work**: Reducing pointer count in structs reduces GC scanning duration dramatically.
4. **Inspect escape analysis**: Use `go build -gcflags="-m"` during optimization passes to eliminate unintended allocations.
5. **Small structs should be values**: Do not wrap small read-only structs in pointers unless required by an interface or mutation."""
    },
    {
        "slug": "slices-and-maps-under-the-hood-memory-growth-traps",
        "title": "Slices and Maps Under the Hood: Memory Layout, Growth, and Silent Traps",
        "excerpt": "Slices and maps power almost every Go program, but their internal runtime headers create subtle memory leaks, aliasing bugs, and race conditions. Understand the 3-word slice header, 3-index slicing, map bucket structures, non-addressable map elements, and safe concurrent access patterns.",
        "display_order": 3,
        "content": """Slices and maps are the workhorses of Go programming. They feel as lightweight and intuitive as dynamic arrays and dictionaries in Python or JavaScript, but under the hood they are backed by precise, low-level runtime structures.

Misunderstanding how slices resize or how maps structure memory is the #1 source of data corruption, silent memory leaks, and fatal runtime crashes in Go production code.

---

## 1. The Slice Header: A 24-Byte Structure

In Go, an array has a fixed compile-time size (`[4]int`). A **slice**, however, is a dynamic view over a backing array.

At the runtime level (`reflect.SliceHeader` or `internal/abi.Slice`), a slice is represented as a simple 3-word (24-byte on 64-bit systems) struct:

```go
type SliceHeader struct {
    Data uintptr // Pointer to the underlying array element
    Len  int     // Current number of elements in the slice
    Cap  int     // Maximum elements before reallocation is needed
}
```

```
+-------------------+---------+---------+
| Data (8 bytes)    | Len (8) | Cap (8) |
+---------|---------+---------+---------+
          |
          v Backing Array in Memory
     [ 10 | 20 | 30 | 40 | 50 | .. | .. ]
```

When you pass a slice to a function, you pass this **24-byte header by value**.
- Because the header contains the `Data` pointer, mutating an element `s[0] = 99` inside a function mutates the caller's view.
- However, calling `append()` inside the function updates only the local `Len` and `Cap`. If a reallocation occurs, the local `Data` pointer moves to a new array, completely disconnecting from the caller!

---

## 2. The Aliasing Append Gotcha

Consider this common code:

```go
a := []int{1, 2, 3} // len=3, cap=3
b := append(a, 4)   // len=4, cap=6 -> allocates NEW backing array!
b[0] = 99

fmt.Println(a[0]) // Prints 1. 'a' was not affected because 'b' reallocated.
```

Now compare with preallocated capacity:

```go
a := make([]int, 3, 10) // len=3, cap=10
a[0], a[1], a[2] = 1, 2, 3

b := append(a, 4) // len=4, cap=10 -> USES EXISTING BACKING ARRAY!
b[0] = 99

fmt.Println(a[0]) // Prints 99! 'a' was mutated through 'b'!
```

### The Solution: 3-Index Slicing (`s[low:high:max]`)
To prevent a sub-slice from overwriting sibling capacity, use the 3-index slicing operator to constrain `cap`:

```go
sub := a[0:3:3] // len=3, cap=3
sub = append(sub, 4) // Forces a fresh allocation! Cannot corrupt 'a'.
```

---

## 3. The Sub-Slice Memory Leak Trap

When you take a tiny slice of a massive slice, the tiny slice keeps the **entire backing array** in memory:

```go
func getHeader(filename string) []byte {
    data, _ := os.ReadFile(filename) // Suppose file is 500 MB
    return data[:16]                 // Returns 16 bytes, but backing array is 500 MB!
}
```

As long as the returned 16-byte slice is alive, the Go garbage collector cannot free the 500 MB backing buffer.

### The Fix: Explicit Copying
```go
func getHeaderSafe(filename string) []byte {
    data, _ := os.ReadFile(filename)
    header := make([]byte, 16)
    copy(header, data[:16]) // header has its own independent 16-byte array
    return header           // The 500 MB data can now be garbage collected immediately
}
```

---

## 4. Maps Under the Hood: Buckets and Hashing

A Go `map[K]V` is a pointer to an `hmap` struct. Under the hood:

1. **Hash Distribution**: Go uses a fast AES-based or highway-hash algorithm to compute a 64-bit hash of the key.
2. **Buckets**: Memory is divided into an array of `bmap` buckets. The lower bits of the hash select which bucket contains the key.
3. **Bucket Layout**: Each bucket holds up to **8 key-value pairs**. It stores an 8-byte `tophash` array (the top 8 bits of each key's hash) for instant SIMD-like filtering before comparing full keys.
4. **Overflow Buckets**: If a 9th key lands in a bucket, an overflow bucket is linked.
5. **Growth & Evacuation**: When the average load factor exceeds **6.5**, Go allocates twice as many buckets and incrementally evacuates entries across multiple operations to avoid latency spikes.

---

## 5. Dangerous Map Traps in Production

### Trap 1: Reading vs. Writing to a `nil` Map
```go
var m map[string]int // m is nil

val := m["anything"] // SAFE: Returns zero value (0), no panic.
m["key"] = 42        // PANIC: runtime error: assignment to entry in nil map!
```
Always initialize with `make(map[string]int)` or a literal `{}` before writing.

### Trap 2: Map Elements are Non-Addressable
```go
type User struct {
    Age int
}

users := map[string]User{"alice": {Age: 25}}
// users["alice"].Age = 26 // COMPILE ERROR: cannot assign to struct field in map

// WHY? Because map growth can move bucket memory, making pointers invalid.
// FIX 1: Store pointers
usersPtr := map[string]*User{"alice": {Age: 25}}
usersPtr["alice"].Age = 26 // Perfectly valid

// FIX 2: Reassign whole struct
u := users["alice"]
u.Age = 26
users["alice"] = u
```

### Trap 3: Memory is Not Reclaimed on `delete()`
When you delete keys from a map (`delete(m, key)`), Go clears the bucket slot, but **does not shrink the bucket array**. If a map once held 1,000,000 keys, it continues to retain bucket memory even after deleting all keys.
- In Go 1.21+, use the built-in `clear(m)` function to zero out entries.
- To free the underlying bucket memory, allocate a fresh map and let the old one be collected by GC.

### Trap 4: Concurrent Map Access Crash
```go
// Fatal error: concurrent map read and map write
```
Maps are NOT thread-safe. A concurrent read and write triggers an unrecoverable runtime crash (not a catchable panic!). Use `sync.RWMutex` or `sync.Map`.

---

## Key Takeaways

1. A slice is an 8-byte pointer + two 8-byte ints (`Len`, `Cap`).
2. Slicing preserves the backing array; use `copy()` when retaining small fragments of large files.
3. Use 3-index slicing `s[0:n:n]` when passing slices to untrusted functions to prevent overwrite bugs.
4. Reading from a nil map is safe; writing to a nil map panics.
5. Map values are not addressable; store pointers if you need in-place mutation."""
    },
    {
        "slug": "interfaces-type-assertions-and-dynamic-dispatch",
        "title": "Interfaces, Type Assertions, and Dynamic Dispatch in Go",
        "excerpt": "Go's interfaces are implicitly satisfied, but their runtime representation (iface and eface) holds a notorious trap: nil is not always nil. Master interface internals, type assertions, type switches, empty interface any trade-offs, and why \"accept interfaces, return structs\" remains the foundational Go idiom.",
        "display_order": 4,
        "content": """Go's approach to polymorphism is one of its most defining design choices. Unlike Java, C#, or TypeScript, Go has no `implements` keyword. A concrete type satisfies an interface automatically simply by implementing its methods. This is known as **structural typing** or **compile-time duck typing**.

While simple on the surface, interfaces have intricate runtime machinery (`iface` and `eface`), and one specific behavior—the **typed nil trap**—has caused critical outages in almost every production Go codebase.

---

## 1. The Design Philosophy: Single-Method Interfaces

In object-oriented hierarchies, interfaces often become bloated monoliths with dozens of methods. Go encourages the exact opposite: small, focused, single-method interfaces.

Look at the Go standard library:
```go
type Reader interface {
    Read(p []byte) (n int, err error)
}

type Writer interface {
    Write(p []byte) (n int, err error)
}

type Closer interface {
    Close() error
}
```

Because `io.Reader` and `io.Writer` only have one method, hundreds of unrelated types (`os.File`, `net.Conn`, `bytes.Buffer`, `gzip.Reader`, `http.Response.Body`) can effortlessly interoperate without knowing about each other.

---

## 2. Under the Hood: `iface` and `eface`

An interface variable in Go is not a single pointer. It is a **two-word structure** (16 bytes on 64-bit systems):

### Case A: Non-Empty Interfaces (`iface`)
Used when the interface declares methods:
```go
type iface struct {
    tab  *itab          // Type metadata, interface method table, concrete type
    data unsafe.Pointer // Pointer to the underlying concrete value
}
```
The `itab` contains:
- The interface definition
- The concrete type metadata
- The compiled function pointers for dynamic dispatch

### Case B: The Empty Interface (`eface` or `any`)
Used for `interface{}` or `any`:
```go
type eface struct {
    _type *_type         // Exact type descriptor
    data  unsafe.Pointer // Pointer to the underlying concrete value
}
```

---

## 3. The Infamous "Typed Nil" Trap (`nil != nil`)

This is the most dangerous interview question and production pitfall in Go.

An interface variable is considered `nil` **if and only if both its type pointer (`tab`) and its data pointer (`data`) are nil**.

Watch what happens:

```go
package main

import "fmt"

type CustomError struct {
    Code int
}

func (e *CustomError) Error() string {
    return fmt.Sprintf("error code %d", e.Code)
}

func findUser(id int) error {
    var err *CustomError = nil // Typed pointer initialized to nil

    if id < 0 {
        err = &CustomError{Code: 400}
    }

    return err // Returns *CustomError wrapped inside the 'error' interface
}

func main() {
    err := findUser(10) // We expect no error, right?

    if err != nil {
        fmt.Println("CRITICAL ERROR: We detected an error even though id was valid!")
        fmt.Printf("Interface: %#v\\n", err)
    }
}
```

### Output:
```
CRITICAL ERROR: We detected an error even though id was valid!
Interface: (*main.CustomError)(nil)
```

### Why did this happen?
When `err` was returned from `findUser`, the `error` interface was constructed as:
- `tab`: points to metadata for `*CustomError` (NOT nil!)
- `data`: `nil`

Because `tab != nil`, the check `err != nil` evaluates to **`true`**! Calling `err.Error()` may even panic if the method dereferences fields on a nil pointer.

### The Golden Rule:
**Never assign a typed nil variable to an interface return value.** Return the untyped literal `nil` directly:

```go
func findUserSafe(id int) error {
    if id < 0 {
        return &CustomError{Code: 400}
    }
    return nil // Safe: Both tab and data are nil
}
```

---

## 4. Type Assertions and Type Switches

When you hold an interface, you frequently need to inspect or extract the underlying concrete type.

### Type Assertion:
```go
var val any = "hello world"

// Unchecked assertion: panics if val is not a string
s := val.(string)

// Checked assertion (the comma-ok idiom): NEVER panics
s, ok := val.(string)
if ok {
    fmt.Println("It is a string:", s)
} else {
    fmt.Println("Not a string!")
}
```

### Type Switch:
A type switch cleanly inspects multiple possible types without reflection:
```go
func inspect(v any) {
    switch val := v.(type) {
    case string:
        fmt.Printf("String of length %d\\n", len(val))
    case int, int64:
        fmt.Println("Integer value:", val)
    case fmt.Stringer:
        fmt.Println("Implements Stringer:", val.String())
    case nil:
        fmt.Println("Literal nil value")
    default:
        fmt.Printf("Unknown type %T\\n", val)
    }
}
```

---

## 5. Rob Pike's Idiom: "Accept Interfaces, Return Structs"

The foundational rule of Go API design:

> **"Accept interfaces, return concrete types (structs)."**

### Why accept interfaces?
Because it decouples your function from external implementations. If your function only needs to read bytes, don't demand `*os.File`—accept `io.Reader`. Now consumers can pass HTTP responses, mock buffers, or gzip streams into your function effortlessly.

### Why return concrete structs?
Because returning an interface locks the caller into the specific interface methods you decided on. Returning a concrete struct gives the caller full access to all methods and fields, allowing *them* to decide which interfaces to satisfy.

---

## Key Takeaways

1. Go interfaces use structural typing; there is no `implements` keyword.
2. An interface is a 2-word header: `(tab, data)` for `iface` and `(_type, data)` for `eface`.
3. An interface is only `nil` when both `tab` and `data` are `nil`. Returning a typed pointer that is `nil` results in a non-nil interface.
4. Always return literal `nil` for `error` return values.
5. Follow the rule: Accept narrow interfaces, return concrete structs."""
    },
    {
        "slug": "error-handling-idioms-sentinel-errors-wrapping",
        "title": "Error Handling Idioms: Sentinel Errors, Custom Types, and Wrapping",
        "excerpt": "Go deliberately avoids exceptions in favor of explicit values. Here is how to master error handling in production: errors.Is vs errors.As, wrapping with %w, building domain-specific typed error hierarchies, and handling panics safely with deferred recovery without degrading service stability.",
        "display_order": 5,
        "content": """One of the most controversial decisions in Go is its omission of `try/catch/finally` exceptions. In Go, **errors are plain values** returned as normal function results.

While junior engineers often complain about typing `if err != nil`, experienced Go engineers appreciate that control flow is linear, predictable, and visible. There are no invisible call-stack unrolls or surprise exceptions jumping across 10 layers of abstraction.

---

## 1. The `error` Interface

The entire error-handling mechanism rests on a single interface defined in the universe block:

```go
type error interface {
    Error() string
}
```

Any type that defines an `Error() string` method can be used as an error.

---

## 2. Sentinel Errors

A sentinel error is a pre-declared, exported package-level variable representing a known, expected condition:

```go
package database

import "errors"

var (
    ErrNotFound     = errors.New("record not found")
    ErrDuplicateKey = errors.New("duplicate key violation")
)
```

In standard library code:
- `io.EOF`: End of file reached
- `sql.ErrNoRows`: Query returned zero rows
- `context.Canceled`: Context was cancelled

### Caveat with Sentinel Errors:
Before Go 1.13, checking sentinel errors was done with direct equality `if err == sql.ErrNoRows`. However, if the error was annotated or wrapped, direct equality broke. Modern Go uses `errors.Is`.

---

## 3. Error Wrapping: `%w` vs. `%v` (Go 1.13+)

When an error moves up the call stack, you should add context (such as the resource ID or action being taken) without losing the original root cause.

```go
func fetchUserProfile(id int) (*Profile, error) {
    user, err := db.FindUser(id)
    if err != nil {
        // Use %w to wrap the original error:
        return nil, fmt.Errorf("fetchUserProfile %d: %w", id, err)
    }
    return user.Profile, nil
}
```

### The Difference:
- **`%w` (Wrap)**: Embeds the error into the chain. Callers can use `errors.Is` and `errors.As` to inspect the underlying cause.
- **`%v` (Format Only)**: Converts the error message into a string, intentionally **severing** the chain. Use `%v` when you want to obscure internal infrastructure details (e.g., hiding database connection strings from public API responses).

---

## 4. `errors.Is` vs. `errors.As`: The Inspecting Primitives

### `errors.Is`: Checking for Specific Values
`errors.Is` traverses the unwrapped chain to see if any wrapped error matches the target:

```go
err := fetchUserProfile(42)

if errors.Is(err, sql.ErrNoRows) {
    // Correctly matches even though it was wrapped with fmt.Errorf!
    w.WriteHeader(http.StatusNotFound)
    return
}
```

### `errors.As`: Extracting Concrete Error Types
`errors.As` traverses the chain to see if any error matches a specific **type**, and if so, copies it into the target pointer:

```go
type ValidationError struct {
    Field   string
    Message string
}

func (v *ValidationError) Error() string {
    return fmt.Sprintf("field %s: %s", v.Field, v.Message)
}

// In the caller:
var valErr *ValidationError
if errors.As(err, &valErr) {
    fmt.Printf("Validation failed on field: %s, issue: %s\\n", valErr.Field, valErr.Message)
}
```

---

## 5. Custom Error Structs in Enterprise Code

In enterprise APIs, errors often carry HTTP status codes, machine-readable slugs, and correlation IDs:

```go
type AppError struct {
    Code       int    // e.g., 404
    Slug       string // e.g., "USER_NOT_FOUND"
    Message    string // Safe message for the client
    Internal   error  // Underlying technical cause for internal logging
}

func (e *AppError) Error() string {
    if e.Internal != nil {
        return fmt.Sprintf("[%s] %s: %v", e.Slug, e.Message, e.Internal)
    }
    return fmt.Sprintf("[%s] %s", e.Slug, e.Message)
}

// Unwrap allows errors.Is / errors.As to drill into the Internal error:
func (e *AppError) Unwrap() error {
    return e.Internal
}
```

---

## 6. Panic and Recover: When (and When NOT) to Panic

Go provides `panic` and `recover`, but they are **not** substitutes for `try/catch`.

### The Rule:
- **Never panic** for expected errors (network timeout, invalid user input, file not found). Return `error`.
- **Only panic** for unrecoverable programmer errors or startup failures (e.g., failing to compile a static regex `regexp.MustCompile`, missing critical environment variables on boot, slice index out of bounds).

### Safe Recovery in HTTP Middleware:
```go
func PanicRecoveryMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        defer func() {
            if rec := recover(); rec != nil {
                log.Printf("PANIC recovered in HTTP handler: %v\\n%s", rec, debug.Stack())
                http.Error(w, "Internal Server Error", http.StatusInternalServerError)
            }
        }()
        next.ServeHTTP(w, r)
    })
}
```

---

## Key Takeaways

1. Treat errors as normal data values; check them explicitly at every call site.
2. Use `fmt.Errorf("...: %w", err)` to wrap errors with context while keeping the root cause accessible.
3. Use `errors.Is(err, target)` to check for sentinel values (`io.EOF`, `sql.ErrNoRows`).
4. Use `errors.As(err, &target)` to cast and extract custom error structs from a chain.
5. Keep panics strictly for program initialization bugs or catastrophic invariants, and protect HTTP entry points with deferred `recover()` middleware."""
    }
]
