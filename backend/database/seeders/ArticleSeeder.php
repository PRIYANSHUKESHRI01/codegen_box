<?php

namespace Database\Seeders;

use App\Models\Article;
use App\Models\ArticleTopic;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * The two launch articles for the Articles knowledge base — real,
 * substantial, hand-written technical content (not placeholder text),
 * published immediately. Idempotent (updateOrCreate by slug). Requires
 * ArticleTopicSeeder to have already run.
 */
class ArticleSeeder extends Seeder
{
    public function run(): void
    {
        $priya = User::where('email', 'priya@mellow.ai')->first();
        $dsa = ArticleTopic::where('slug', 'dsa')->first();
        $go = ArticleTopic::where('slug', 'go-programming')->first();

        if (! $priya || ! $dsa || ! $go) {
            return;
        }

        $binarySearchContent = $this->binarySearchArticle();
        Article::updateOrCreate(
            ['slug' => 'binary-search-from-first-principles-to-mastery'],
            [
                'article_topic_id' => $dsa->id,
                'title' => 'Binary Search: From First Principles to Mastery',
                'excerpt' => "Binary search looks trivial until an interviewer asks you to find the first occurrence of a value, or to binary-search an answer instead of an array. Here's the mental model, the one template worth memorizing, and every pitfall that actually trips people up.",
                'content' => $binarySearchContent,
                'icon' => null,
                'status' => Article::STATUS_PUBLISHED,
                'display_order' => 1,
                'reading_time_minutes' => Article::estimateReadingTimeMinutes($binarySearchContent),
                'created_by' => $priya->id,
                'published_at' => now(),
            ]
        );

        $goroutinesContent = $this->goroutinesArticle();
        Article::updateOrCreate(
            ['slug' => 'goroutines-and-channels-concurrency-in-go-explained'],
            [
                'article_topic_id' => $go->id,
                'title' => 'Goroutines and Channels: Concurrency in Go Explained',
                'excerpt' => "Go's whole pitch is 'concurrency made easy' — but goroutines and channels have real, sharp edges: leaks, deadlocks, and closed-channel panics. This walks through the mental model, a real worker-pool pattern, and the mistakes that actually happen in production.",
                'content' => $goroutinesContent,
                'icon' => null,
                'status' => Article::STATUS_PUBLISHED,
                'display_order' => 1,
                'reading_time_minutes' => Article::estimateReadingTimeMinutes($goroutinesContent),
                'created_by' => $priya->id,
                'published_at' => now(),
            ]
        );
    }

    private function binarySearchArticle(): string
    {
        return <<<'MARKDOWN'
Binary search is the first algorithm most people learn that actually *feels* clever — and then, a year later, the same person fumbles it in an interview because the array wasn't quite what they expected, or the question wasn't "find the value" but "find the boundary." This article is the version of binary search that survives contact with a real interview.

## What problem does binary search actually solve?

The textbook framing is "search a sorted array in O(log n)." That's true, but it's the narrow case of something more general: **binary search finds the boundary point in a monotonic condition.**

A condition is monotonic if, as you scan left to right, it's `false, false, false, ..., false, true, true, true, ..., true` — it flips exactly once and never flips back. "Is `array[i] >= target`" is exactly that kind of condition on a sorted array. Once you see binary search this way, it stops being "the sorted-array trick" and becomes a tool you reach for anywhere a yes/no answer flips exactly once across a range — including ranges that were never an array at all. More on that at the end.

## The core idea

You're not scanning one element at a time. You're maintaining a shrinking window `[lo, hi]` that is guaranteed to contain the answer, and on every step you throw away *half* of what's left by checking the midpoint. Each check halves the remaining search space, so you're done in about `log2(n)` steps — for a billion elements, that's about 30 comparisons.

## The template worth memorizing

There are two classic shapes of binary search: closed-interval (`lo <= hi`) for "does this exact value exist," and half-open (`lo < hi`) for "find the boundary." The half-open form is the one worth internalizing first, because it generalizes cleanly to every variant below without you having to reason about off-by-one edge cases each time.

```python
def binary_search_boundary(arr, predicate):
    """
    Returns the smallest index i in [0, len(arr)] such that
    predicate(arr[i]) is True, given predicate is monotonic
    (False,...,False,True,...,True) across arr.
    Returns len(arr) if predicate is never True.
    """
    lo, hi = 0, len(arr)   # hi is EXCLUSIVE — "one past the end"
    while lo < hi:
        mid = lo + (hi - lo) // 2   # avoids overflow in languages with fixed-width ints
        if predicate(arr[mid]):
            hi = mid        # mid could be the answer — keep it in range
        else:
            lo = mid + 1     # mid is definitely not the answer — exclude it
    return lo   # lo == hi here: the first index where predicate is True
```

Everything below is just a different `predicate`.

## Complexity

- **Time:** O(log n) — each iteration halves the search space.
- **Space:** O(1) iterative (as above), O(log n) recursive (call stack depth) — prefer iterative unless recursion genuinely clarifies the code.

## Variant 1: find the first occurrence (lower bound)

"Find the first index where `arr[i] >= target`" — this is `predicate = lambda x: x >= target` plugged straight into the template above. If `arr[lo]` (the result) actually equals `target`, you've found the first occurrence; if not, `target` isn't in the array, but `lo` is exactly where it *would* be inserted to keep the array sorted. This is why the pattern is called "lower bound" — it's the same operation `bisect_left` performs in Python's standard library.

## Variant 2: find the last occurrence (upper bound)

Flip the trick: find the first index where `arr[i] > target` (not `>=`), then subtract one. The predicate is `lambda x: x > target`; the last occurrence of `target` is `result - 1`, provided `target` is actually in the array.

```python
def first_occurrence(arr, target):
    return binary_search_boundary(arr, lambda x: x >= target)

def last_occurrence(arr, target):
    first_greater = binary_search_boundary(arr, lambda x: x > target)
    return first_greater - 1
```

Between these two you can answer "does it exist," "how many times does it occur" (`last - first + 1`), and "where would it be inserted" — three different-sounding interview questions, one template.

## Common pitfalls

- **Integer overflow on `mid`.** `(lo + hi) // 2` can overflow in fixed-width-integer languages (C++, Java) if `lo` and `hi` are both near `INT_MAX`. `lo + (hi - lo) // 2` is the overflow-safe form — get in the habit of writing it this way even in Python, where it doesn't matter, so the muscle memory transfers.
- **Infinite loops from an inconsistent boundary update.** If your loop condition is `lo < hi` but somewhere you write `hi = mid` when you meant `hi = mid - 1` (or vice versa), you can end up with `lo`/`hi` never converging. The fix isn't "be careful" — it's to always use the *same* template shape (closed vs half-open) instead of improvising the boundaries fresh each time.
- **Off-by-one between inclusive and exclusive ranges.** The half-open template above treats `hi` as "one past the last valid index" on purpose — it's what makes "not found" naturally fall out as `hi` (= `len(arr)`), with no special-casing.
- **Assuming the array has to be sorted numbers.** It has to be *monotonic under your predicate* — see the last section.

## A worked example

Search for `23` in `[2, 5, 8, 12, 16, 23, 38, 56, 72, 91]` (indices 0–9) using `first_occurrence`:

| Step | lo | hi | mid | arr[mid] | arr[mid] >= 23? | action |
|---|---|---|---|---|---|---|
| 1 | 0 | 10 | 5 | 23 | yes | hi = 5 |
| 2 | 0 | 5 | 2 | 8 | no | lo = 3 |
| 3 | 3 | 5 | 4 | 16 | no | lo = 4 |
| 4 | 4 | 5 | 4 | 16 | no | lo = 5 |

`lo == hi == 5`, loop ends, return `5` — `arr[5] == 23`. Four comparisons instead of a six-element linear scan; the gap only widens as `n` grows.

## Beyond sorted arrays: binary search on the answer

This is the part that separates "I know binary search" from "I can actually use it." Once you frame binary search as "find the boundary of a monotonic yes/no condition," you can binary search over a *range of possible answers*, not just array indices.

Classic example: "You need to ship `n` packages in `d` days. Given each day's max-weight capacity, find the *minimum* capacity that still gets everything shipped in time." There's no array to search — but "can we finish in `d` days with capacity `c`?" is a yes/no question that's monotonic in `c` (more capacity never makes it *harder*). So you binary search `c` itself, over the range `[max(weights), sum(weights)]`, using "can we ship in time with this capacity?" as the predicate. Same template, completely different problem shape.

This reframing — "is there a monotonic yes/no condition I can binary search over?" — is the actual interview skill. The array-search version is just the training wheels.

## Key takeaways

- Binary search finds the boundary of a monotonic condition — sorted-array search is one instance of that, not the definition.
- Learn the half-open `[lo, hi)` template once, and derive first-occurrence/last-occurrence/insert-position from it instead of memorizing three separate algorithms.
- Watch for overflow, inconsistent boundary updates, and off-by-one errors — all three disappear once you commit to one template shape.
- The highest-leverage version of this skill is recognizing when a *non*-array problem still has a monotonic yes/no condition hiding in it.

## Practice problems to try next

Search in Rotated Sorted Array · Find Peak Element · Koko Eating Bananas · Capacity To Ship Packages Within D Days · Median of Two Sorted Arrays · Find Minimum in Rotated Sorted Array.
MARKDOWN;
    }

    private function goroutinesArticle(): string
    {
        return <<<'MARKDOWN'
Go's whole pitch on concurrency fits in one sentence from the language's own proverbs: **"Don't communicate by sharing memory; share memory by communicating."** That sentence is doing a lot of work, and it doesn't fully click until you've actually shipped something with goroutines and channels — including the version where you got it wrong. This is the mental model, plus the pattern and the pitfalls that show up once you leave toy examples behind.

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

Implement the worker-pool pattern above from scratch without looking. Build a simple rate limiter using `time.Ticker`. Build a pub-sub broadcaster where one goroutine fans a message out to N subscriber channels. Implement the dining philosophers problem using channels instead of mutexes.
MARKDOWN;
    }
}
