<?php

namespace Database\Seeders;

use App\Models\Article;
use App\Models\ArticleTopic;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Seeds the complete 10-article DSA curriculum for the Data Structures & Algorithms topic.
 * Each article is hand-crafted with first-principles intuition, canonical code templates,
 * Big-O complexity analysis, common interview pitfalls, worked trace tables, advanced
 * real-world extensions, and curated practice problems.
 *
 * Idempotent (updateOrCreate by slug).
 */
class DsaArticlesSeeder extends Seeder
{
    public function run(): void
    {
        $dsa = ArticleTopic::where('slug', 'dsa')->first();

        if (! $dsa) {
            $this->command?->error("DSA article topic not found. Run ArticleTopicSeeder first.");
            return;
        }

        $author = User::where('email', 'priya@mellow.ai')->first()
            ?? User::where('role', User::ROLE_SUPERADMIN)->first()
            ?? User::first();

        if (! $author) {
            $this->command?->error("No valid author found to associate with articles.");
            return;
        }

        $articles = [
            [
                'slug' => 'binary-search-from-first-principles-to-mastery',
                'title' => 'Binary Search: From First Principles to Mastery',
                'excerpt' => "Binary search looks trivial until an interviewer asks you to find the first occurrence of a value, or to binary-search an answer instead of an array. Here's the mental model, the one template worth memorizing, and every pitfall that actually trips people up.",
                'display_order' => 1,
                'content' => $this->binarySearchArticle(),
            ],
            [
                'slug' => 'two-pointers-and-sliding-window-patterns',
                'title' => 'Two Pointers and Sliding Window: The Linear Scan Invariant',
                'excerpt' => "Sliding window and two-pointer techniques turn quadratic O(n²) brute-force checks into linear O(n) traversals. Here is the unified mental model, the expandable/shrinkable window template, and how to spot when a problem allows monotonic pointer movement.",
                'display_order' => 2,
                'content' => $this->twoPointersSlidingWindowArticle(),
            ],
            [
                'slug' => 'monotonic-stack-patterns-and-applications',
                'title' => 'Monotonic Stack: Finding Next Greater and Nearest Smaller Elements',
                'excerpt' => "Whenever an interview problem asks for the 'next greater', 'previous smaller', or largest rectangle in a histogram, a monotonic stack is almost always the answer. Here is how to maintain stack invariants and eliminate redundant comparisons.",
                'display_order' => 3,
                'content' => $this->monotonicStackArticle(),
            ],
            [
                'slug' => 'fast-and-slow-pointers-floyds-cycle-detection',
                'title' => 'Fast and Slow Pointers: Floyd\'s Cycle Detection and Midpoint Mastery',
                'excerpt' => "Floyd's cycle-finding algorithm (the tortoise and the hare) does what hash sets do without the O(n) memory overhead. Here is the mathematical proof of why it works, how to locate cycle entry points, and how to apply it beyond linked lists.",
                'display_order' => 4,
                'content' => $this->fastAndSlowPointersArticle(),
            ],
            [
                'slug' => 'graph-traversal-bfs-dfs-and-topological-sort',
                'title' => 'Graph Traversal: BFS, DFS, Cycle Detection, and Topological Sort',
                'excerpt' => "Graph problems intimidate candidates because graphs come in disguise — as grids, word ladders, dependencies, or games. Here is the unified framework for modeling graphs, choosing between BFS and DFS, detecting cycles, and ordering tasks via Topological Sort.",
                'display_order' => 5,
                'content' => $this->graphTraversalArticle(),
            ],
            [
                'slug' => 'dynamic-programming-memoization-to-tabulation',
                'title' => 'Dynamic Programming: From Memoization to Tabulation',
                'excerpt' => "Dynamic programming is not math genius; it is recursion with a notebook. Learn the 5-step framework to transition from a top-down brute force recursion to memoization, bottom-up tabulation, and space-optimized O(1) state transitions.",
                'display_order' => 6,
                'content' => $this->dynamicProgrammingArticle(),
            ],
            [
                'slug' => 'prefix-sums-and-difference-arrays-mastery',
                'title' => 'Prefix Sums and Difference Arrays: Range Queries and Interval Updates',
                'excerpt' => "Prefix sums convert repeated O(n) subarray queries into instant O(1) lookups, while difference arrays allow O(1) range updates across massive arrays. Here is the complete blueprint for 1D and 2D prefix sums, hash-map combinations, and interval management.",
                'display_order' => 7,
                'content' => $this->prefixSumsDifferenceArraysArticle(),
            ],
            [
                'slug' => 'trie-prefix-tree-architecture-and-applications',
                'title' => 'Trie (Prefix Tree): Architecture, Autocomplete, and Bitwise XOR',
                'excerpt' => "A Trie organizes strings by common prefixes, turning prefix searches from O(N × L) scans into O(L) pointer walks. Here is how to implement an enterprise-grade Trie, handle wildcards, and use Bitwise Tries to solve Maximum XOR problems.",
                'display_order' => 8,
                'content' => $this->trieArticle(),
            ],
            [
                'slug' => 'heap-and-priority-queue-top-k-patterns',
                'title' => 'Heap and Priority Queue: Top K, Two Heaps, and K-Way Merges',
                'excerpt' => "A priority queue gives you instant O(1) access to extremes while maintaining O(log k) updates. Master the Min-Heap vs Max-Heap distinction, the bounded Top-K pattern, the Two-Heap median finder, and the K-Way merge.",
                'display_order' => 9,
                'content' => $this->heapPriorityQueueArticle(),
            ],
            [
                'slug' => 'backtracking-pruning-recursion-and-state-restoration',
                'title' => 'Backtracking: Pruning Recursion Trees and State Restoration',
                'excerpt' => "Backtracking is systematic brute force with an eraser. Learn the universal 'Choose, Explore, Unchoose' blueprint, how to eliminate duplicate subsets, and how aggressive bounding functions (pruning) turn exponential explosions into sub-second searches.",
                'display_order' => 10,
                'content' => $this->backtrackingArticle(),
            ],
        ];

        foreach ($articles as $data) {
            $content = $data['content'];
            Article::updateOrCreate(
                ['slug' => $data['slug']],
                [
                    'article_topic_id' => $dsa->id,
                    'title' => $data['title'],
                    'excerpt' => $data['excerpt'],
                    'content' => $content,
                    'icon' => null,
                    'status' => Article::STATUS_PUBLISHED,
                    'display_order' => $data['display_order'],
                    'reading_time_minutes' => Article::estimateReadingTimeMinutes($content),
                    'created_by' => $author->id,
                    'published_at' => now(),
                ]
            );
        }
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

    private function twoPointersSlidingWindowArticle(): string
    {
        return <<<'MARKDOWN'
Every candidate knows nested loops: check every contiguous subarray by running `for i in range(n): for j in range(i, n): ...`. That’s $O(n^2)$ work. When $n = 10^5$, an $O(n^2)$ algorithm performs 10 billion operations and hits a Time Limit Exceeded (TLE) within two seconds.

The sliding window and two-pointer paradigms exist to crush that quadratic search space down to a clean $O(n)$ linear traversal. The trick isn't magic; it is **monotonicity of the window bounds**. If expanding an invalid window can never make it valid, or if advancing the left pointer preserves accumulated state, you never need to backtrack.

## What problem does the sliding window actually solve?

Consider a classic question: *"Find the length of the longest substring with at most k distinct characters."*

In a naive scan, when you find a violation at index `right`, you discard all knowledge, increment `left` by 1, and re-scan `right` from `left`. You repeatedly re-evaluate overlapping elements.

A sliding window treats the subsegment `[left, right]` as a stateful, breathing organism:
1. **Expand**: Increment `right` to bring new information into your window state.
2. **Evaluate**: Is the window invariant violated?
3. **Shrink**: Increment `left` to evict old elements until the invariant is restored.

Because `left` and `right` only ever move from left to right and never jump backwards, both pointers traverse at most $n$ steps each. Total pointer movements: at most $2n$. That guarantees **$O(n)$ total time**.

## The canonical sliding window template

Memorize this exact skeletal structure. Virtually every sliding window problem (longest substring, shortest subarray, anagram search) is a direct specialization of this loop:

```python
def sliding_window_template(arr, k):
    left = 0
    window_state = {}  # frequency map, running sum, or character set
    best_result = 0    # or float('inf') for minimum window problems

    for right in range(len(arr)):
        # 1. Expand window by incorporating arr[right]
        val = arr[right]
        window_state[val] = window_state.get(val, 0) + 1

        # 2. While window invariant is violated, shrink from left
        while condition_is_violated(window_state, k):
            outgoing = arr[left]
            window_state[outgoing] -= 1
            if window_state[outgoing] == 0:
                del window_state[outgoing]
            left += 1  # shrink left bound

        # 3. Window [left, right] is now strictly valid
        # Update answer (length, sum, or count)
        current_window_len = right - left + 1
        best_result = max(best_result, current_window_len)

    return best_result
```

## Complexity

- **Time Complexity:** $O(n)$. Although there is a nested `while` loop inside the `for` loop, the inner pointer `left` only increments. Over the entire execution of the function, `left` increments at most $n$ times. Therefore, the inner loop executes at most $n$ times across the entire algorithm — an amortized $O(1)$ cost per outer step.
- **Space Complexity:** $O(k)$ or $O(\Sigma)$, where $k$ is the distinct number of elements inside the window and $\Sigma$ is the alphabet size (e.g., $O(1)$ for ASCII characters).

## The three primary variants

### 1. Fixed-size window (size $K$)
You do not need a `while` loop to shrink. Once `right >= k - 1`, every step forward requires evicting `arr[right - k]`.
*Use cases:* Maximum sum subarray of size $k$, find all anagrams in a string, sliding average.

### 2. Dynamically expandable window (longest valid)
You stretch `right` as far as possible. When invalid, you shrink `left` just enough to become valid again, then maximize `right - left + 1`.
*Use cases:* Longest substring without repeating characters, longest subarray with 1s after flipping $k$ zeros.

### 3. Dynamically shrinkable window (shortest valid)
You stretch `right` until the condition is *met*, and then aggressively shrink `left` while the condition *remains valid* to minimize `right - left + 1`.
*Use cases:* Minimum size subarray sum, minimum window substring.

### 4. Inward two pointers on sorted sequences
Instead of chasing each other in the same direction, two pointers start at opposite ends (`left = 0, right = len(arr) - 1`) and step inward.
*Use cases:* Two Sum II (sorted array), Container With Most Water, 3Sum, Valid Palindrome.

```python
def two_sum_sorted(numbers, target):
    left, right = 0, len(numbers) - 1
    while left < right:
        current_sum = numbers[left] + numbers[right]
        if current_sum == target:
            return [left + 1, right + 1]  # 1-indexed
        elif current_sum < target:
            left += 1   # Need a larger sum -> advance left
        else:
            right -= 1  # Need a smaller sum -> decrease right
    return []
```

## Common pitfalls in technical interviews

- **Slicing the array inside the loop.** Calling `s[left:right+1]` inside the loop creates an $O(n)$ string copy on every iteration, immediately degrading your clean $O(n)$ solution back to $O(n^2)$. Always track indices or incremental counter dictionaries.
- **Off-by-one window length.** The length of an inclusive slice `[left, right]` is `right - left + 1`, NOT `right - left`.
- **Forgetting to delete empty keys in frequency maps.** If `window_state[char] == 0`, `len(window_state)` still counts that key! You must call `del window_state[char]` so size-based invariants remain accurate.
- **Negative numbers with running sums.** If an array contains negative numbers, the running sum is no longer monotonic (expanding can decrease the sum, and shrinking can increase it). When monotonicity breaks, sliding window fails — you must switch to Prefix Sums + Hash Map.

## A worked example: Longest Substring Without Repeating Characters

Input: `s = "pwwkew"`

| Step | `right` | char | Action on Map | Valid? | `left` | Window | Max Len |
|---|---|---|---|---|---|---|---|
| 1 | 0 | `'p'` | `{'p': 0}` | Yes | 0 | `"p"` | 1 |
| 2 | 1 | `'w'` | `{'p': 0, 'w': 1}` | Yes | 0 | `"pw"` | 2 |
| 3 | 2 | `'w'` | Duplicate `'w'` seen! | No -> `left = 2` | 2 | `"w"` | 2 |
| 4 | 3 | `'k'` | `{'w': 2, 'k': 3}` | Yes | 2 | `"wk"` | 2 |
| 5 | 4 | `'e'` | `{'w': 2, 'k': 3, 'e': 4}` | Yes | 2 | `"wke"` | 3 |
| 6 | 5 | `'w'` | Duplicate `'w'` at index 2 | No -> `left = 3` | 3 | `"kew"` | 3 |

Result: `3` (representing `"wke"` or `"kew"`).

## Beyond the basics: The "never-shrink" window optimization

In problems where you only need the **maximum** window length, you don't even need to shrink the window back down with an inner `while` loop! If you find a valid window of size 5, you never care about any window of size 4 or less.

When a violation occurs, you can simply shift `left += 1` once alongside `right += 1`. The window maintains its current maximum size like a sliding ruler, expanding only when a larger valid candidate appears:

```python
def longest_ones_after_k_flips(nums, k):
    left = 0
    zeros = 0
    for right in range(len(nums)):
        if nums[right] == 0:
            zeros += 1
        if zeros > k:  # If invalid, slide the whole window forward by 1
            if nums[left] == 0:
                zeros -= 1
            left += 1
    return len(nums) - left
```

## Key takeaways

- Sliding window is applicable whenever the search condition is **monotonic** over contiguous segments.
- Monotonic pointer progression ensures that `left` and `right` step through the input at most once each, yielding $O(n)$ time.
- Always use `right - left + 1` for inclusive segment length.
- If negative values destroy monotonicity on sum queries, pivot immediately to Prefix Sums + Hash Maps.

## Practice problems to try next

Longest Substring Without Repeating Characters · Minimum Window Substring · Container With Most Water · Subarray Product Less Than K · Permutation in String · 3Sum.
MARKDOWN;
    }

    private function monotonicStackArticle(): string
    {
        return <<<'MARKDOWN'
A monotonic stack is one of the highest-yield patterns in algorithmic interviews. When an interviewer asks a question involving "the next greater element", "the nearest smaller building", "stock span", or "the maximum area rectangle under a histogram", an amateur reaches for nested loops and suffers $O(n^2)$ execution time.

An expert reaches for a **Monotonic Stack**, reducing the problem to an elegant $O(n)$ single-pass scan.

## What problem does a monotonic stack actually solve?

Consider this concrete challenge: for every element in an array, find the first element to its right that is strictly larger than it.

```text
Input:  [2,  1,  2,  4,  3]
Output: [4,  2,  4, -1, -1]
```

The brute force algorithm checks every element to the right of index `i` until it finds something larger. That takes $O(n^2)$ time in the worst case (e.g., a descending array like `[5, 4, 3, 2, 1]`).

Why does brute force do so much redundant work? Because it repeatedly compares elements that have already been superseded. If you are standing at index 0 looking right, and you encounter a massive skyscraper of height 10, any smaller buildings behind it are completely obscured from the perspective of earlier indices.

A monotonic stack maintains elements in **strictly increasing or strictly decreasing order**. When a new element enters, it aggressively evicts all existing elements in the stack that violate the ordering invariant. **The eviction moment is the exact instant the "next greater" or "next smaller" relationship is resolved.**

## The core mental model: The "Shadow" invariant

Imagine people standing in a queue. If a tall person arrives, everyone shorter in front of them is blocked from the view of anyone joining later.

- **Monotonically Decreasing Stack:** Bottom is largest, top is smallest (`[10, 7, 4, 2]`). When a new value `5` arrives, it is larger than `2` and `4`. Those elements are popped! For `2` and `4`, the arriving element `5` is their **Next Greater Element**.
- **Monotonically Increasing Stack:** Bottom is smallest, top is largest (`[2, 4, 7, 10]`). When a smaller value arrives, it pops larger elements. For those popped elements, the arriving element is their **Next Smaller Element**.

## The canonical template: Next Greater Element

Always store **indices** on the stack, not raw values. An index gives you both the value (`arr[idx]`) AND the spatial distance (`current_idx - idx`):

```python
def next_greater_elements(nums):
    n = len(nums)
    result = [-1] * n
    stack = []  # stores INDICES, maintaining decreasing values

    for i in range(n):
        # Current element is greater than elements represented by stack top
        while stack and nums[i] > nums[stack[-1]]:
            popped_idx = stack.pop()
            result[popped_idx] = nums[i]  # nums[i] is the first greater element!

        stack.append(i)

    return result
```

## Complexity

- **Time Complexity:** $O(n)$. It is tempting to look at the `while` loop inside the `for` loop and assume $O(n^2)$. But observe the lifecycle of every index: each index is pushed onto the stack **exactly once**, and popped from the stack **at most once**. Total stack operations across the entire loop cannot exceed $2n$. Hence, amortized $O(1)$ per element, leading to total $O(n)$ time.
- **Space Complexity:** $O(n)$ in the worst case (e.g., strictly decreasing input array where no elements are popped until the end).

## Key variants and interview applications

### Variant 1: Daily Temperatures (Calculating distance)
Instead of returning the value of the next greater element, return how many days you had to wait:
```python
def daily_temperatures(temperatures):
    n = len(temperatures)
    ans = [0] * n
    stack = []  # indices

    for i, temp in enumerate(temperatures):
        while stack and temp > temperatures[stack[-1]]:
            prev_day = stack.pop()
            ans[prev_day] = i - prev_day  # Distance calculation
        stack.append(i)

    return ans
```

### Variant 2: Circular Arrays (Next Greater Element II)
If the array wraps around cyclically (the next element after the last item is index 0), simulate a double-length array using modulo indexing `nums[i % n]` running up to `2 * n - 1`:
```python
for i in range(2 * n):
    val = nums[i % n]
    while stack and val > nums[stack[-1]]:
        result[stack.pop()] = val
    if i < n:
        stack.append(i)
```

## Common pitfalls in technical interviews

- **Pushing values instead of indices.** If you push values, you cannot compute distances or handle duplicate numbers correctly. Pushing indices is strictly superior.
- **Strict vs non-strict inequalities (`>` vs `>=`).** If you need the *next strictly greater* element, pop while `nums[i] > nums[stack[-1]]`. If you need the *next greater or equal*, pop while `nums[i] >= nums[stack[-1]]`. Mismatching this creates subtle bugs with duplicate elements.
- **Forgetting remaining elements in the stack.** Any elements left in the stack after the loop finishes have no next greater element. Ensure your result array is pre-filled with default fallback values (like `-1` or `0`).

## A worked example: Daily Temperatures

Input: `temperatures = [73, 74, 75, 71, 69, 72]`

| Step | `i` | Temp | Stack (indices) | Stack (temps) | Popped? | Recorded Answers |
|---|---|---|---|---|---|---|
| 0 | 0 | 73 | `[0]` | `[73]` | None | `ans = [0, 0, 0, 0, 0, 0]` |
| 1 | 1 | 74 | `[1]` | `[74]` | Pop 0 (`74 > 73`) | `ans[0] = 1 - 0 = 1` |
| 2 | 2 | 75 | `[2]` | `[75]` | Pop 1 (`75 > 74`) | `ans[1] = 2 - 1 = 1` |
| 3 | 3 | 71 | `[2, 3]` | `[75, 71]` | None (`71 < 75`) | - |
| 4 | 4 | 69 | `[2, 3, 4]` | `[75, 71, 69]`| None (`69 < 71`) | - |
| 5 | 5 | 72 | `[2, 5]` | `[75, 72]` | Pop 4 (`72 > 69`), Pop 3 (`72 > 71`) | `ans[4] = 5 - 4 = 1`, `ans[3] = 5 - 3 = 2` |

Final Result: `[1, 1, 4, 2, 1, 0]`.

## Beyond the basics: Largest Rectangle in Histogram

The hardest common application of the monotonic stack is LeetCode 84: **Largest Rectangle in Histogram**.

A rectangle with height $H = \text{heights}[i]$ can extend left until it hits a bar shorter than itself, and extend right until it hits another bar shorter than itself.
By maintaining an increasing stack, the element that pops index `i` is its **right boundary**, and the element directly underneath index `i` in the stack is its **left boundary**!

```python
def largest_rectangle_area(heights):
    stack = []  # monotonic increasing indices
    max_area = 0
    # Append dummy 0 at the end to force all bars to be popped
    heights.append(0)

    for i, h in enumerate(heights):
        while stack and h < heights[stack[-1]]:
            height = heights[stack.pop()]
            width = i if not stack else i - stack[-1] - 1
            max_area = max(max_area, height * width)
        stack.append(i)

    heights.pop()  # restore input
    return max_area
```

This single pass computes the maximum rectangular area in $O(n)$ time and $O(n)$ space — a problem that would otherwise require $O(n^2)$ brute force.

## Key takeaways

- Use a monotonic stack when you need the **nearest greater or nearest smaller** element in an array.
- Always store **indices**, which encode both relative value and physical distance.
- Every element enters once and leaves once, guaranteeing $O(n)$ time complexity.
- Appending a sentinel dummy element (like `0` or `float('inf')`) cleanly clears the stack without manual post-processing.

## Practice problems to try next

Next Greater Element I & II · Daily Temperatures · Online Stock Span · Largest Rectangle in Histogram · Maximal Rectangle · Trapping Rain Water · Sum of Subarray Minimums.
MARKDOWN;
    }

    private function fastAndSlowPointersArticle(): string
    {
        return <<<'MARKDOWN'
In graph theory and linked data structures, finding whether a structure contains a loop is a fundamental problem. The obvious approach is to record every node in a Hash Set: as you walk, if you encounter a node already in your set, you've found a cycle.

That works, but it costs $O(n)$ auxiliary memory. In embedded systems, operating system kernels, or high-throughput stream processing, allocating heap memory just to check for a cycle is unacceptable.

Enter **Floyd's Cycle Detection Algorithm**, colloquially known as the **Tortoise and the Hare**. It detects cycles and finds the exact entry point in $O(n)$ time using exactly **$O(1)$ auxiliary space**.

## What problem does fast and slow pointers solve?

Beyond simple cycle detection, the fast-and-slow pointer technique solves:
1. **Detecting cycles** in linked lists, state machines, and finite iterations.
2. **Finding the midpoint** of a linked list in a single pass without knowing its length beforehand.
3. **Locating the start node of a cycle** without storing addresses.
4. **Finding duplicate numbers** in constrained arrays without modifying the array or using extra space.

## The core idea: Relative speed in modular space

Imagine two runners on a circular track. Runner $A$ moves at 1 meter per second (slow), and Runner $B$ moves at 2 meters per second (fast).

If the track has a circumference of $C$ meters, the distance between them increases by $1$ meter every second. In a closed loop, increasing the distance between two runners by 1 unit per step guarantees that the fast runner will catch up to the slow runner from behind in at most $C$ steps. They **must** collide.

If there is no cycle, the fast runner simply reaches the end of the track (`None` / `null`) and the race terminates.

## The mathematical proof: Locating the cycle entrance

Detecting a cycle is easy; locating the exact node where the cycle begins requires an elementary mathematical insight:

```text
Head -------- L --------> Cycle Entrance -------- K --------> Meeting Point
                             ^                                      |
                             |-------------- C - K -----------------|
```

Let:
- $L$ = distance from head to the cycle entrance.
- $C$ = length (circumference) of the cycle.
- $K$ = distance from cycle entrance to the meeting point where fast catches slow.

When they meet:
- Slow has traveled distance: $D_{\text{slow}} = L + K$
- Fast has traveled distance: $D_{\text{fast}} = L + K + m \cdot C$ (where $m$ is the number of full loops fast completed).

Because Fast runs at twice the speed of Slow:
$$D_{\text{fast}} = 2 \cdot D_{\text{slow}}$$
$$L + K + m \cdot C = 2(L + K)$$
$$m \cdot C = L + K$$
$$L = m \cdot C - K = (m - 1) \cdot C + (C - K)$$

**Look at that equation closely:**
The distance from the **Head** to the Cycle Entrance ($L$) is mathematically identical to the distance from the **Meeting Point** to the Cycle Entrance ($(C - K)$), modulo the cycle length!

Therefore: if you place one pointer back at `head` and keep another pointer at `meeting_point`, and advance both at **1 step per turn**, they will collide at the exact cycle entrance node!

## The canonical template

```python
class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next

def find_cycle_entry(head):
    if not head or not head.next:
        return None

    slow = head
    fast = head

    # Step 1: Detect if a cycle exists
    has_cycle = False
    while fast and fast.next:
        slow = slow.next
        fast = fast.next.next
        if slow == fast:
            has_cycle = True
            break

    if not has_cycle:
        return None  # No cycle

    # Step 2: Locate cycle start node
    slow = head
    while slow != fast:
        slow = slow.next
        fast = fast.next

    return slow  # Both pointers meet at cycle entrance
```

## Complexity

- **Time Complexity:** $O(n)$. Let $L$ be the straight path and $C$ be the loop. Slow traverses at most $L + C$ nodes before collision. In Step 2, both pointers walk $L$ steps. Total operations are well within $3n$ pointer updates — strictly linear $O(n)$.
- **Space Complexity:** $O(1)$. Only two pointer variables are allocated.

## Variant: Single-pass list midpoint

How do you find the middle node of a singly linked list in one pass without counting the total nodes first?
Run `fast` twice as fast as `slow`. When `fast` reaches the tail, `slow` is guaranteed to be at the exact midpoint:

```python
def find_middle_node(head):
    slow = head
    fast = head
    while fast and fast.next:
        slow = slow.next
        fast = fast.next.next
    return slow  # For [1,2,3,4,5] -> 3; for [1,2,3,4,5,6] -> 4
```
*Note on even lengths:* If you want the first middle node (node 3 in `[1,2,3,4,5,6]`), adjust the loop condition to `while fast.next and fast.next.next:`.

## Common pitfalls in technical interviews

- **Null pointer exceptions on fast pointer.** You must always check both `fast` AND `fast.next` before evaluating `fast.next.next`. In Python: `while fast and fast.next:`.
- **Initializing pointers at different locations.** If you start `slow = head` and `fast = head.next`, the cycle detection still works, but the mathematical equation for finding the cycle entry point changes! Stick to starting both at `head`.
- **Assuming cycles only exist in Linked Lists.** As shown below, this pattern applies to arrays, number transformations, and state spaces.

## A worked example: Cycle detection walkthrough

Consider a list: `1 -> 2 -> 3 -> 4 -> 5 -> 3` (Node 5 points back to Node 3).
Here, $L = 2$ (`1 -> 2`), $C = 3$ (`3 -> 4 -> 5 -> 3`).

| Step | Slow Pointer (1 step) | Fast Pointer (2 steps) | Equal? |
|---|---|---|---|
| 0 (start) | Node 1 | Node 1 | Yes (start) |
| 1 | Node 2 | Node 3 | No |
| 2 | Node 3 | Node 5 | No |
| 3 | Node 4 | Node 4 | **YES (Collision at Node 4)** |

Now reset `slow` to Head (`Node 1`), leave `fast` at collision point (`Node 4`), and advance both by 1:
- Step 1: `slow` moves to `Node 2`, `fast` moves to `Node 5`.
- Step 2: `slow` moves to `Node 3`, `fast` moves to `Node 3`.
- **Collision at Node 3** — exactly the cycle entrance!

## Beyond linked lists: Floyd's algorithm on arrays

LeetCode 287 (*Find the Duplicate Number*): Given an array of $n + 1$ integers where each integer is between $1$ and $n$, prove that at least one duplicate exists and find it without modifying the array in $O(1)$ space.

Because each value is between $1$ and $n$, you can treat the array as a functional linked list where `nums[i]` is the pointer to the next node!
- Node index: $i$
- Next node: `nums[i]`

Since two indices contain the same number, two arrows point to the same node — which is the exact definition of a cycle entrance!

```python
def find_duplicate(nums):
    slow = nums[0]
    fast = nums[0]

    # Find meeting point
    while True:
        slow = nums[slow]
        fast = nums[nums[fast]]
        if slow == fast:
            break

    # Find entrance to cycle (the duplicate number)
    slow = nums[0]
    while slow != fast:
        slow = nums[slow]
        fast = nums[fast]

    return slow
```

## Key takeaways

- Fast & Slow pointers eliminate the need for $O(n)$ hash tables when looking for periodic cycles.
- When `fast` moves at $2\times$ speed, the gap closes by 1 node per iteration, guaranteeing a collision within $C$ loop steps.
- Resetting one pointer to `head` and moving both at $1\times$ speed lands both pointers on the exact cycle entry node.
- Can be applied to any finite mapping $f(x)$ where states repeat (Happy Number, Duplicate Number, Pseudo-Random Generators).

## Practice problems to try next

Linked List Cycle I & II · Middle of the Linked List · Palindrome Linked List · Happy Number · Find the Duplicate Number · Circular Array Loop.
MARKDOWN;
    }

    private function graphTraversalArticle(): string
    {
        return <<<'MARKDOWN'
In technical interviews, graph problems are rarely introduced with the words "Here is a graph." Instead, they disguise themselves:
- *"A matrix of 1s and 0s representing water and land..."* (Grid graph)
- *"A list of prerequisites for college courses..."* (Directed Acyclic Graph)
- *"Transform word 'hit' to 'cog' changing one letter at a time..."* (State-space graph)
- *"Spread of a virus in a network across minutes..."* (Multi-source shortest path)

Mastering graph algorithms requires two distinct skills: **recognizing the implicit graph**, and **choosing the correct traversal pattern**.

## The fundamental distinction: BFS vs DFS

| Property | Breadth-First Search (BFS) | Depth-First Search (DFS) |
|---|---|---|
| **Data Structure** | Queue (`collections.deque`) | Call Stack (Recursion) or explicit Stack |
| **Search Shape** | Concentric ripples / level-by-level | Deep plunge along one branch until blocked |
| **Optimality** | Guarantees **shortest path** on unweighted edges | Does NOT guarantee shortest path |
| **Memory Profile** | Proportional to maximum level width $O(W)$ | Proportional to maximum branch depth $O(D)$ |
| **Best Used For** | Shortest distance, minimum turns, level averages | Connected components, cycle detection, topological sort, backtracking |

## The canonical BFS template: Level-by-level explosion

Never use a raw Python list as a queue — `list.pop(0)` is $O(n)$, which silently turns an $O(V + E)$ BFS into $O(V^2)$. Always use `collections.deque`.

```python
from collections import deque

def bfs_shortest_path(graph, start, target):
    queue = deque([(start, 0)])  # (node, distance)
    visited = {start}            # CRITICAL: mark visited on PUSH, not pop!

    while queue:
        node, dist = queue.popleft()

        if node == target:
            return dist

        for neighbor in graph.get(node, []):
            if neighbor not in visited:
                visited.add(neighbor)  # Mark visited IMMEDIATELY
                queue.append((neighbor, dist + 1))

    return -1  # Unreachable
```

## The canonical DFS template: Cycle detection with 3-Coloring

Cycle detection in an **undirected** graph is trivial: check if an adjacent node is visited and not your direct parent.

Cycle detection in a **directed** graph is notoriously trickier: a simple visited set is insufficient because two paths converging on the same node is NOT a cycle. You need **3 states (White, Gray, Black)**:
- **State 0 (White):** Unvisited.
- **State 1 (Gray):** Currently in the active recursion stack (if we see a Gray node, there is a **back-edge**, hence a cycle!).
- **State 2 (Black):** Fully explored and all descendants confirmed cycle-free.

```python
def has_cycle_directed(num_nodes, edges):
    adj = {i: [] for i in range(num_nodes)}
    for u, v in edges:
        adj[u].append(v)

    state = [0] * num_nodes  # 0: unvisited, 1: visiting, 2: visited

    def dfs(node):
        if state[node] == 1:
            return True   # Cycle detected: hit node currently in our call stack
        if state[node] == 2:
            return False  # Already vetted; safe

        state[node] = 1   # Mark currently visiting
        for neighbor in adj[node]:
            if dfs(neighbor):
                return True
        state[node] = 2   # Mark fully processed
        return False

    for i in range(num_nodes):
        if state[i] == 0:
            if dfs(i):
                return True
    return False
```

## Topological Sort: Kahn's Algorithm (BFS)

Topological sorting orders vertices in a directed acyclic graph (DAG) such that for every directed edge $u \to v$, node $u$ comes before $v$. (e.g., Course Schedule II, build systems).

Kahn's Algorithm uses **in-degrees** (the count of incoming dependencies):
1. Compute the in-degree of every vertex.
2. Push all vertices with `in_degree == 0` into a queue (these have no prerequisites).
3. Pop a vertex, append it to the order, and decrement the in-degree of its neighbors.
4. When a neighbor's in-degree reaches 0, push it into the queue.
5. If the final ordered list length $< V$, a cycle exists!

```python
def topological_sort(num_courses, prerequisites):
    adj = {i: [] for i in range(num_courses)}
    in_degree = [0] * num_courses

    for dest, src in prerequisites:
        adj[src].append(dest)
        in_degree[dest] += 1

    queue = deque([i for i in range(num_courses) if in_degree[i] == 0])
    order = []

    while queue:
        curr = queue.popleft()
        order.append(curr)

        for neighbor in adj[curr]:
            in_degree[neighbor] -= 1
            if in_degree[neighbor] == 0:
                queue.append(neighbor)

    return order if len(order) == num_courses else []
```

## Complexity

- **Time Complexity:** $O(V + E)$ for adjacency list graphs, where $V$ is vertices and $E$ is edges. Every vertex is enqueued/visited once, and every edge is traversed once. For an $R \times C$ grid, $V = R \cdot C$ and $E \le 4 \cdot R \cdot C$, so time is $O(R \cdot C)$.
- **Space Complexity:** $O(V)$ for the visited set and recursion stack/queue.

## Common pitfalls in technical interviews

- **Marking visited on pop instead of push in BFS.** This is the #1 BFS bug. If you mark a node as visited when it is popped from the queue, multiple sibling nodes can append the same neighbor dozens of times before it is popped. The queue size blows up exponentially, triggering Memory Limit Exceeded (MLE). **Always mark visited the instant you push.**
- **Recursion depth limit in Python.** Python default recursion limit is 1,000 frames. Deep graphs or linear grids like $1000 \times 1000$ will crash with `RecursionError`. Either increase `sys.setrecursionlimit(200000)` or write iterative DFS using an explicit stack.
- **Treating directed graphs like undirected graphs.** In undirected graphs, remember to ignore the immediate parent node to prevent false cycle alarms.

## A worked example: Multi-Source BFS (Rotting Oranges)

Multi-source BFS starts with multiple seed nodes simultaneously at `time = 0`. All seeds spread outwards in lockstep.

Input grid ($2 = \text{rotten}, 1 = \text{fresh}, 0 = \text{empty}$):
```text
[2, 1, 1]
[1, 1, 0]
[0, 1, 1]
```

1. Initialize queue with **all** rotten oranges at time 0: `queue = [((0, 0), 0)]`. Fresh count = 5.
2. Minute 1: Oranges at `(0, 1)` and `(1, 0)` rot. Fresh count = 3.
3. Minute 2: Oranges at `(0, 2)` and `(1, 1)` rot. Fresh count = 1.
4. Minute 3: Nothing adjacent can rot.
5. Minute 4: Orange at `(2, 2)` is isolated by `0`s — fresh count never reaches 0!
6. Return `-1`.

Multi-source BFS ensures that when an orange rots, it was infected by the **closest possible** rotten source.

## Key takeaways

- BFS guarantees shortest distance in unweighted graphs; DFS does not.
- Always mark BFS nodes visited at the moment of **enqueue**, never dequeue.
- In directed graphs, use 3 colors (White/Gray/Black) for DFS cycle detection.
- Kahn's algorithm (in-degree BFS) simultaneously produces a topological sort and detects cycles if `len(order) != V`.

## Practice problems to try next

Number of Islands · Rotting Oranges · Course Schedule I & II · Clone Graph · Word Ladder · Pacific Atlantic Water Flow · Alien Dictionary.
MARKDOWN;
    }

    private function dynamicProgrammingArticle(): string
    {
        return <<<'MARKDOWN'
Dynamic Programming (DP) causes more interview anxiety than almost any other topic. Candidates often try to memorize solutions problem by problem: "Here is the trick for House Robber, here is the trick for Coin Change..."

This approach falls apart the moment an interviewer introduces a slight variation.

Dynamic programming is not mathematical wizardry. At its core, **dynamic programming is simply recursion without doing the same work twice**. If a problem has **optimal substructure** (the optimal solution to the problem contains optimal solutions to its subproblems) and **overlapping subproblems** (the same subproblems are solved repeatedly), it is a DP problem.

## The 5-step framework that solves any DP problem

Stop guessing formulas. Follow this exact five-step engineering pipeline:

1. **Define the state in plain English:** What does `dp[i]` or `dp[i][w]` represent? (e.g., "The minimum coins needed to make amount `i`"). If you cannot write this in a sentence, you cannot write the code.
2. **Identify the base cases:** What are the simplest possible inputs where the answer is trivial? (`dp[0] = 0`).
3. **Formulate the recurrence relation (the transition):** How do you compute the current state from previous states? What choices are available?
4. **Determine execution direction:** If `dp[i]` depends on `dp[i-1]`, you must compute from $0$ up to $n$.
5. **Optimize space:** Can you replace a full $O(n)$ array with two variables? Can you collapse a 2D matrix into a 1D row?

## From Top-Down (Memoization) to Bottom-Up (Tabulation)

Every DP problem can be solved in two equivalent styles:

### Top-Down (Memoization)
Start with natural recursion and cache results using a dictionary or `@functools.lru_cache`. Natural to write, but incurs call stack overhead:
```python
from functools import lru_cache

def coin_change_top_down(coins, amount):
    @lru_cache(None)
    def solve(rem):
        if rem == 0:
            return 0
        if rem < 0:
            return float('inf')

        min_coins = float('inf')
        for coin in coins:
            res = solve(rem - coin)
            if res != float('inf'):
                min_coins = min(min_coins, res + 1)
        return min_coins

    ans = solve(amount)
    return ans if ans != float('inf') else -1
```

### Bottom-Up (Tabulation)
Iteratively fill a table from base cases upward. Avoids stack overflow and enables memory optimization:
```python
def coin_change_bottom_up(coins, amount):
    # dp[i] = min coins needed for amount i
    dp = [float('inf')] * (amount + 1)
    dp[0] = 0  # Base case: 0 coins for amount 0

    for i in range(1, amount + 1):
        for coin in coins:
            if i - coin >= 0:
                dp[i] = min(dp[i], dp[i - coin] + 1)

    return dp[amount] if dp[amount] != float('inf') else -1
```

## The Knapsack blueprint: 0/1 vs Unbounded

The Knapsack problem is the backbone of dozens of interview variations (Partition Equal Subset Sum, Target Sum, Coin Change II).

### 0/1 Knapsack (Each item can be picked AT MOST ONCE)
Because an item can only be used once, when updating a 1D DP array, you **must iterate backwards** through the capacity loop! If you iterate forwards, you will accidentally pick the same item multiple times.

```python
def knapsack_01(weights, values, capacity):
    dp = [0] * (capacity + 1)
    for w_item, v_item in zip(weights, values):
        # Traverse BACKWARDS to ensure each item is used at most once
        for cap in range(capacity, w_item - 1, -1):
            dp[cap] = max(dp[cap], dp[cap - w_item] + v_item)
    return dp[capacity]
```

### Unbounded Knapsack (Items can be reused infinitely)
Iterate **forwards** through the capacity loop so earlier additions in the same row can be built upon:
```python
for w_item, v_item in zip(weights, values):
    for cap in range(w_item, capacity + 1):  # Traverse FORWARD
        dp[cap] = max(dp[cap], dp[cap - w_item] + v_item)
```

## Complexity

- **Time Complexity:** $\text{Total States} \times \text{Transitions per State}$. In `Coin Change`, there are $A$ states (amount) and $C$ coin transitions per state $\implies O(A \cdot C)$ time.
- **Space Complexity:** Equal to the state space size. Top-down: $O(\text{States})$ plus recursive stack. Bottom-up: often reducible from $O(n \cdot m)$ to $O(m)$ using a rolling array.

## Common pitfalls in technical interviews

- **Iterating in the wrong direction.** In 0/1 knapsack, iterating forward accidentally turns it into unbounded knapsack. Always trace whether state $i$ needs values from the *previous iteration* or the *current iteration*.
- **Off-by-one in table dimensions.** Allocating an array of size `n` instead of `n + 1` for an amount $n$. You need index $n$ to be valid, which requires `[0] * (n + 1)`.
- **Initializing with incorrect identity values.** For minimization problems, initialize with $\infty$ (`float('inf')`). For maximization, initialize with $-\infty$ or `0`.
- **Premature tabulation.** Don't try to write a bottom-up 2D loop directly if you are struggling. Write the top-down recursive function first! Once the base cases and transitions are proven, converting to bottom-up is purely mechanical.

## A worked example: House Robber

Problem: You cannot rob two adjacent houses. Find maximum loot.
`nums = [2, 7, 9, 3, 1]`

1. State: `dp[i]` = max money robbed from the first `i` houses.
2. Base cases: `dp[0] = nums[0] = 2`, `dp[1] = max(nums[0], nums[1]) = 7`.
3. Recurrence: At house `i`, you choose:
   - Rob house `i`: `nums[i] + dp[i-2]`
   - Skip house `i`: `dp[i-1]`
   - `dp[i] = max(dp[i-1], nums[i] + dp[i-2])`

Space-optimized transition (no array needed!):
```python
def rob(nums):
    if not nums:
        return 0
    prev2 = 0
    prev1 = 0
    for num in nums:
        current = max(prev1, prev2 + num)
        prev2 = prev1
        prev1 = current
    return prev1
```
Trace:
- `num = 2`: `curr = max(0, 0 + 2) = 2` $\to$ `prev2 = 0, prev1 = 2`
- `num = 7`: `curr = max(2, 0 + 7) = 7` $\to$ `prev2 = 2, prev1 = 7`
- `num = 9`: `curr = max(7, 2 + 9) = 11` $\to$ `prev2 = 7, prev1 = 11`
- `num = 3`: `curr = max(11, 7 + 3) = 11` $\to$ `prev2 = 11, prev1 = 11`
- `num = 1`: `curr = max(11, 11 + 1) = 12` $\to$ `prev2 = 11, prev1 = 12`
Result: `12` in $O(n)$ time and $O(1)$ space.

## Key takeaways

- DP is structured memoization: remember solutions to subproblems to avoid recomputation.
- Always write down the state definition in a plain English sentence first.
- In 1D Knapsack, **backward loops** prevent duplicate item reuse (0/1), whereas **forward loops** enable reuse (unbounded).
- If your transition only looks back $k$ steps, you only need $k$ variables instead of an $O(n)$ array.

## Practice problems to try next

Climbing Stairs · House Robber I & II · Coin Change · Longest Increasing Subsequence · Partition Equal Subset Sum · Edit Distance · Unique Paths.
MARKDOWN;
    }

    private function prefixSumsDifferenceArraysArticle(): string
    {
        return <<<'MARKDOWN'
Range queries are ubiquitous: *"What is the sum of elements between index L and R?"*
Doing a linear scan for each query takes $O(n)$ time. If you have $Q = 100,000$ queries, total runtime is $O(Q \cdot n) \approx 10^{10}$ operations — a guaranteed timeout.

**Prefix Sums** preprocess an array in $O(n)$ time so that any range sum query can be answered in **$O(1)$ time**.

Its inverse sibling, the **Difference Array**, solves the dual problem: apply $Q$ range updates (e.g., *"add $x$ to every element from index $L$ to $R$"*) in **$O(1)$ time per update**, computing the final array values in a single $O(n)$ pass at the end.

Together, they form the standard toolkit for range-based array manipulation.

## 1D Prefix Sum: The fundamental identity

The prefix sum array $P$ is defined such that:
$$P[i] = \sum_{j=0}^{i-1} \text{arr}[j]$$
By prepending a `0` at index 0, the sum of any contiguous subarray `arr[L...R]` (inclusive) is simply:
$$\text{Sum}(L, R) = P[R + 1] - P[L]$$

```python
class PrefixSum:
    def __init__(self, arr):
        # 1-based prefix array with leading zero
        self.prefix = [0] * (len(arr) + 1)
        for i in range(len(arr)):
            self.prefix[i + 1] = self.prefix[i] + arr[i]

    def query(self, L, R):
        """Returns sum of arr[L...R] inclusive in O(1) time."""
        return self.prefix[R + 1] - self.prefix[L]
```

Why 1-based indexing? Because when $L = 0$, `query(0, R)` evaluates cleanly to `prefix[R + 1] - prefix[0] = prefix[R + 1] - 0`. You never need an `if L == 0:` branch.

## The Difference Array: O(1) range updates

Suppose you start with an array of zeros of size $n$, and you receive hundreds of commands: *"Add 5 to range [2, 7]"*.

Instead of updating all elements from 2 to 7 in $O(k)$ time, use a **Difference Array** $D$:
- Increment $D[L] \mathrel{+}= \text{val}$ (starts the addition at index $L$).
- Decrement $D[R + 1] \mathrel{-}= \text{val}$ (cancels the addition past index $R$).

After all queries are recorded, take the running prefix sum of $D$ to recover the final values in a single $O(n)$ pass!

```python
def apply_range_updates(length, updates):
    """
    updates is a list of [L, R, val]
    """
    diff = [0] * (length + 1)

    for L, R, val in updates:
        diff[L] += val
        if R + 1 < length:
            diff[R + 1] -= val

    # Prefix sum to reconstruct final array
    result = [0] * length
    running_sum = 0
    for i in range(length):
        running_sum += diff[i]
        result[i] = running_sum

    return result
```

## The Prefix Sum + Hash Map pattern (Subarray Sum Equals K)

The most popular interview variation combines Prefix Sums with a Hash Map to find subarrays satisfying a property in $O(n)$ time.

Problem: Find the total number of continuous subarrays whose sum equals $k$.
Brute force is $O(n^2)$. Using prefix sums:
$$\text{Sum}(i, j) = P[j] - P[i] = k \implies P[i] = P[j] - k$$

As you compute the running prefix sum $P[j]$, check if $(P[j] - k)$ has been seen before in your hash map!

```python
def subarray_sum_equals_k(nums, k):
    count = 0
    current_sum = 0
    # Map prefix_sum -> number of times it has occurred
    prefix_counts = {0: 1}  # Base case: a sum of 0 has occurred once initially

    for num in nums:
        current_sum += num
        # If (current_sum - k) exists, there is a valid subarray ending here
        if (current_sum - k) in prefix_counts:
            count += prefix_counts[current_sum - k]

        prefix_counts[current_sum] = prefix_counts.get(current_sum, 0) + 1

    return count
```

## 2D Prefix Sums: Inclusion-Exclusion Principle

For an $M \times N$ matrix, the sum of any submatrix with top-left $(r_1, c_1)$ and bottom-right $(r_2, c_2)$ can be queried in $O(1)$ time using the **Inclusion-Exclusion Principle**:

$$\text{Sum} = P[r_2][c_2] - P[r_1-1][c_2] - P[r_2][c_1-1] + P[r_1-1][c_1-1]$$

The corner term $+ P[r_1-1][c_1-1]$ is added back because subtracting both top and left rectangles subtracts the overlapping top-left corner twice!

```python
class MatrixRegionSum:
    def __init__(self, matrix):
        R, C = len(matrix), len(matrix[0])
        self.P = [[0] * (C + 1) for _ in range(R + 1)]
        for r in range(R):
            for c in range(C):
                self.P[r+1][c+1] = (matrix[r][c]
                                    + self.P[r][c+1]
                                    + self.P[r+1][c]
                                    - self.P[r][c])

    def sum_region(self, r1, c1, r2, c2):
        return (self.P[r2+1][c2+1]
                - self.P[r1][c2+1]
                - self.P[r2+1][c1]
                + self.P[r1][c1])
```

## Common pitfalls in technical interviews

- **Forgetting to seed `{0: 1}` in the prefix hash map.** If a subarray starting at index 0 equals $k$, `current_sum - k = 0`. If `0` is not pre-seeded with frequency 1, this valid subarray will be missed.
- **Negative values with Modulo arithmetic.** When checking for subarrays divisible by $k$ (`Continuous Subarray Sum`), `(current_sum % k)` can be negative in languages like C++ and Java (e.g., `-1 % 5 = -1`). Always normalize: `(current_sum % k + k) % k`.
- **Off-by-one errors on difference array boundaries.** For an inclusive range $[L, R]$, the decrement goes at $R + 1$, NOT $R$. Be sure to check that $R + 1 < \text{len}$ before writing.

## Key takeaways

- 1D Prefix Sums convert range queries from $O(n)$ to $O(1)$.
- Difference Arrays convert range updates from $O(n)$ to $O(1)$, resolving values in one $O(n)$ pass.
- Prefix Sum + Hash Map turns quadratic subarray lookups into single-pass $O(n)$ solutions.
- Prepending a 0 in your prefix array eliminates special-case branching for index 0.

## Practice problems to try next

Range Sum Query - Immutable · Subarray Sum Equals K · Continuous Subarray Sum · Contiguous Array (0s and 1s) · Corporate Flight Bookings · Range Addition · Range Sum Query 2D.
MARKDOWN;
    }

    private function trieArticle(): string
    {
        return <<<'MARKDOWN'
When storing a collection of strings, a Hash Set gives $O(L)$ lookups, where $L$ is string length. But a Hash Set fails completely when your questions involve **prefixes**:
- *"Find all words that start with 'app'"*
- *"Does any word in the dictionary share a common prefix with this text?"*
- *"What is the longest word that can be built one character at a time?"*

A Hash Set hashes the entire string into an opaque integer, destroying prefix relationships.
A **Trie** (pronounced "try", from re*trie*val), or **Prefix Tree**, stores strings as paths down an $N$-ary tree. Every edge represents a character, and every node represents a prefix shared by all its descendants.

## What problem does a Trie actually solve?

1. **Prefix matching & Autocomplete:** Finding all strings matching a prefix in $O(L)$ time, regardless of whether your dictionary contains 10 words or 10 million.
2. **Space deduplication:** Common prefixes (`"transport"`, `"transition"`, `"transfer"`) share the exact same root nodes (`"trans"`), saving massive memory.
3. **Word games & Backtracking:** In Boggle or Word Search II, a Trie allows pruning entire search branches the moment a prefix does not exist.
4. **Bitwise Maximum XOR:** By treating binary numbers as 32-bit strings of `'0'` and `'1'`, a Trie solves Maximum XOR queries in $O(1)$ per number.

## The canonical Trie template

Here is the clean, object-oriented implementation standard for technical interviews:

```python
class TrieNode:
    def __init__(self):
        # Maps char -> TrieNode
        self.children = {}
        self.is_end_of_word = False

class Trie:
    def __init__(self):
        self.root = TrieNode()

    def insert(self, word: str) -> None:
        """Inserts word into the trie in O(L) time."""
        curr = self.root
        for char in word:
            if char not in curr.children:
                curr.children[char] = TrieNode()
            curr = curr.children[char]
        curr.is_end_of_word = True

    def search(self, word: str) -> bool:
        """Returns True if word is strictly in the trie."""
        node = self._find_node(word)
        return node is not None and node.is_end_of_word

    def starts_with(self, prefix: str) -> bool:
        """Returns True if any word in the trie starts with prefix."""
        return self._find_node(prefix) is not None

    def _find_node(self, prefix: str) -> TrieNode:
        curr = self.root
        for char in prefix:
            if char not in curr.children:
                return None
            curr = curr.children[char]
        return curr
```

## Complexity

- **Time Complexity:**
  - `insert(word)`: $O(L)$, where $L$ is word length.
  - `search(word)`: $O(L)$. Notice that search time is completely **independent of the number of words $N$** in the Trie! Looking up a 5-letter word takes 5 pointer hops whether the Trie has 10 words or 1,000,000 words.
  - `starts_with(prefix)`: $O(P)$, where $P$ is prefix length.
- **Space Complexity:** $O(N \cdot L \cdot \Sigma)$ in the worst case (where no words share prefixes), where $\Sigma$ is alphabet size (26 for lowercase English). In practice, extensive prefix sharing significantly compresses storage.

## Practical interview application: Pruning Backtracking (Word Search II)

In LeetCode 212 (*Word Search II*), you are given an $M \times N$ board of characters and a list of dictionary words. You must find all words present on the board.

If you search each word individually using DFS, you repeatedly explore the same grid paths.
Instead: **load the entire dictionary into a Trie**, and walk the grid while walking the Trie simultaneously! If the current path on the grid does not form a prefix in the Trie, **prune immediately**:

```python
def find_words(board, words):
    # 1. Build Trie
    root = {}
    for word in words:
        node = root
        for char in word:
            node = node.setdefault(char, {})
        node['$'] = word  # Store complete word at leaf

    rows, cols = len(board), len(board[0])
    matched_words = []

    def dfs(r, c, parent_node):
        char = board[r][c]
        curr_node = parent_node[char]

        # Check if we matched a word
        if '$' in curr_node:
            matched_words.append(curr_node['$'])
            del curr_node['$']  # Avoid duplicate matches

        board[r][c] = '#'  # Mark visited in-place

        for dr, dc in [(-1,0), (1,0), (0,-1), (0,1)]:
            nr, nc = r + dr, c + dc
            if 0 <= nr < rows and 0 <= nc < cols and board[nr][nc] in curr_node:
                dfs(nr, nc, curr_node)

        board[r][c] = char  # Backtrack / unchoose

        # Optimization: prune leaf nodes to speed up subsequent searches
        if not curr_node:
            del parent_node[char]

    for r in range(rows):
        for c in range(cols):
            if board[r][c] in root:
                dfs(r, c, root)

    return matched_words
```

## Beyond strings: The Bitwise Trie for Maximum XOR

LeetCode 421 (*Maximum XOR of Two Numbers in an Array*): Given an array of integers, find the maximum $a \oplus b$.

Brute force checks all pairs in $O(n^2)$.
With a Bitwise Trie, you can solve this in **$O(n)$ time**!
1. Insert the 32-bit binary representation of each number into a Trie (each node has two children: `0` and `1`).
2. For each number $x$, find its best partner by greedily traversing the opposite bit!
   - If bit $i$ of $x$ is `0`, try to branch to `1` (because $0 \oplus 1 = 1$).
   - If bit $i$ of $x$ is `1`, try to branch to `0` (because $1 \oplus 0 = 1$).
   - If the opposite bit branch exists, take it and set bit $i$ of the answer to 1. Otherwise, take the same bit branch.

Because integers are fixed at 32 bits, each query takes exactly 32 steps — an $O(1)$ operation!

## Common pitfalls in technical interviews

- **Confusing `is_end_of_word` with leaf nodes.** A node can be the end of a word while still having children (e.g., `"app"` is an end-of-word node inside the branch for `"apple"`). Never assume end-of-word means `len(children) == 0`.
- **Memory bloat from fixed-size arrays.** In C++ or Java, allocating `new TrieNode[26]` for every node can cause high memory overhead if the tree is sparse. In Python, dictionary-based `self.children = {}` only allocates memory for edges that actually exist.
- **Not deduplicating results in grid searches.** Words can be matched from multiple starting positions. Remember to delete the word marker or use a set for matches.

## Key takeaways

- Use a Trie whenever string search depends on **common prefixes** or autocomplete.
- Search time depends only on word length $L$, completely independent of dictionary size $N$.
- Tries allow aggressive pruning in recursive grid searches (Word Search II).
- Bitwise Tries turn quadratic XOR problems into linear-time greedy bit walks.

## Practice problems to try next

Implement Trie (Prefix Tree) · Design Add and Search Words Data Structure · Word Search II · Maximum XOR of Two Numbers in an Array · Replace Words · Stream of Characters.
MARKDOWN;
    }

    private function heapPriorityQueueArticle(): string
    {
        return <<<'MARKDOWN'
When you only care about the extremes — the smallest, the largest, or the top $K$ items — sorting the entire collection is wasteful. Sorting takes $O(n \log n)$ time.

A **Heap** (Priority Queue) gives you:
- **$O(1)$** instant access to the minimum (or maximum) element.
- **$O(\log k)$** insertion and deletion.
- **$O(n)$** batch construction (`heapify`).

In technical interviews, heaps are the weapon of choice for **streaming data**, **Top K elements**, and **dynamic order maintenance**.

## The fundamental inversion: Min-Heap vs Max-Heap for Top K

Here is the counterintuitive rule that trips up 80% of candidates:
- To find the **Top $K$ LARGEST elements**, maintain a **MIN-HEAP of size $K$**!
- To find the **Top $K$ SMALLEST elements**, maintain a **MAX-HEAP of size $K$**!

Why? Consider finding the top $K$ largest elements. In a Min-Heap of size $K$, the root is the **smallest of the top $K$ candidates** (the gatekeeper).
When a new number arrives:
- If it is smaller than the root, it has zero chance of being in the top $K$ — ignore it.
- If it is larger than the root, pop the root and push the new number.

At the end of your stream, the heap contains the $K$ largest elements, and you only spent $O(n \log k)$ time and $O(k)$ memory.

## The canonical template: Top K Frequent Elements

In Python, `heapq` is a Min-Heap by default. Here is the canonical pattern:

```python
import heapq
from collections import Counter

def top_k_frequent(nums, k):
    # Step 1: Count frequencies O(n)
    count = Counter(nums)

    # Step 2: Maintain a min-heap of size k
    # Heap stores tuples: (frequency, num)
    heap = []

    for num, freq in count.items():
        heapq.heappush(heap, (freq, num))
        if len(heap) > k:
            heapq.heappop(heap)  # Evicts the smallest frequency

    # Step 3: Extract elements
    return [num for freq, num in heap]
```

## The Two-Heap pattern: Find Median from Data Stream

How do you find the median of a continuously streaming sequence of numbers where numbers are added one by one?
- Sorting on every insertion: $O(n \log n)$ per insertion — too slow.
- Insertion sort into an array: $O(n)$ shift per insertion — too slow.

The optimal solution divides all numbers into two balanced halves using **Two Heaps**:
1. **Max-Heap (`small`):** Stores the smaller half of numbers (root is largest of small half).
2. **Min-Heap (`large`):** Stores the larger half of numbers (root is smallest of large half).

```text
Numbers: [1, 3, 5]  |  [7, 9, 11]
           Max-Heap | Min-Heap
            (root 5)| (root 7)
           Median = (5 + 7) / 2 = 6.0
```

```python
class MedianFinder:
    def __init__(self):
        # max_heap stores lower half (negate values to simulate max-heap in Python)
        self.small = []
        # min_heap stores upper half
        self.large = []

    def add_num(self, num: int) -> None:
        # Step 1: Push to max-heap
        heapq.heappush(self.small, -num)

        # Step 2: Ensure every element in small <= every element in large
        if self.small and self.large and (-self.small[0] > self.large[0]):
            val = -heapq.heappop(self.small)
            heapq.heappush(self.large, val)

        # Step 3: Balance sizes (small can have at most 1 more element than large)
        if len(self.small) > len(self.large) + 1:
            val = -heapq.heappop(self.small)
            heapq.heappush(self.large, val)
        elif len(self.large) > len(self.small):
            val = heapq.heappop(self.large)
            heapq.heappush(self.small, -val)

    def find_median(self) -> float:
        if len(self.small) > len(self.large):
            return float(-self.small[0])
        return (-self.small[0] + self.large[0]) / 2.0
```
Every insertion is $O(\log n)$, and querying the median is instant **$O(1)$**!

## Complexity

- **`heappush` / `heappop`:** $O(\log k)$, where $k$ is heap size.
- **`heap[0]` (peek):** $O(1)$.
- **`heapify(arr)`:** $O(n)$ — NOT $O(n \log n)$! Building a heap from an existing array runs in linear time because most elements reside near leaf levels and sift down at most 1 or 2 levels.

## K-Way Merge: Merging K Sorted Lists

Merge $K$ sorted linked lists containing a total of $N$ nodes into a single sorted list.
Instead of comparing all $K$ list heads on every step ($O(K \cdot N)$), maintain a Min-Heap of size $K$ containing the current head of each list:

```python
def merge_k_lists(lists):
    heap = []
    # Push (node.val, unique_id, node) to prevent comparison errors on equal vals
    for idx, node in enumerate(lists):
        if node:
            heapq.heappush(heap, (node.val, idx, node))

    dummy = ListNode(0)
    curr = dummy

    while heap:
        val, idx, node = heapq.heappop(heap)
        curr.next = node
        curr = curr.next

        if node.next:
            heapq.heappush(heap, (node.next.val, idx, node.next))

    return dummy.next
```
Runtime: **$O(N \log K)$**, using only $O(K)$ space.

## Common pitfalls in technical interviews

- **Python tuple tie-breaking collision.** When storing `(priority, item)` in `heapq`, if two items share the exact same priority, Python tries to compare `item1 < item2`. If `item` is a custom object like `ListNode` without `__lt__`, your code crashes with `TypeError: '<' not supported between instances of 'ListNode'`. **Always include a unique tie-breaker index**: `(priority, idx, item)`.
- **Forgetting that `heapify` takes $O(n)$.** Pushing $n$ items one by one into an empty heap takes $O(n \log n)$. Passing an existing array to `heapq.heapify(arr)` takes $O(n)$. Use `heapify` whenever the initial data is already in memory.
- **Modifying elements inside a heap in-place.** Mutating a value inside a heap breaks the heap invariant without triggering re-sifting. If you must change priorities dynamically, use lazy deletion (mark items deleted in a set and discard them when they pop).

## Key takeaways

- To keep the top $K$ largest elements, maintain a **Min-Heap of size $K$**.
- Two Heaps (Max-Heap + Min-Heap) provide $O(\log n)$ insertion and $O(1)$ median retrieval on live streams.
- Inserting $n$ elements into an empty heap is $O(n \log n)$; `heapify` in-place is $O(n)$.
- Always add a tie-breaking index in priority tuples to avoid comparison crashes.

## Practice problems to try next

Kth Largest Element in an Array · Top K Frequent Elements · Merge k Sorted Lists · Find Median from Data Stream · Task Scheduler · Reorganize String · Minimum Cost to Connect Sticks.
MARKDOWN;
    }

    private function backtrackingArticle(): string
    {
        return <<<'MARKDOWN'
Brute force algorithms try every possibility until they stumble upon a solution. In combinatorial problems — subsets, permutations, path finding, Sudoku — trying every possibility is fatal:
- Generating all subsets of size 30: $2^{30} \approx 10^9$ operations.
- Generating all permutations of size 15: $15! \approx 1.3 \times 10^{12}$ operations.

**Backtracking** is systematic search with an eraser. It explores a decision tree depth-first, but the moment it detects that the current partial path cannot possibly lead to a valid solution, it **prunes** that entire subtree and steps backwards, undoing its changes.

## The universal "Choose - Explore - Unchoose" blueprint

Virtually every backtracking problem conforms to this exact three-act play:

```python
def backtrack(path, state):
    # 1. Base case: Did we reach a complete solution?
    if is_solution(path):
        result.append(list(path))  # MUST make a deep copy!
        return

    # 2. Iterate through all possible choices at current step
    for choice in candidate_choices(state):
        # PRUNING: Skip invalid or unpromising paths early
        if not is_valid(choice, state):
            continue

        # ACT I: CHOOSE
        make_choice(choice, state)
        path.append(choice)

        # ACT II: EXPLORE
        backtrack(path, state)

        # ACT III: UNCHOOSE (State restoration)
        path.pop()
        undo_choice(choice, state)
```

Notice the symmetry: anything you modify before `backtrack()` must be meticulously undone directly after `backtrack()`.

## The Three Fundamental Combinatorial Shapes

### Shape 1: Subsets (Power Set)
Order does not matter (`[1, 2]` is identical to `[2, 1]`). To avoid generating duplicate permutations, pass a `start` index so elements can only be picked in forward order:

```python
def subsets(nums):
    result = []
    path = []

    def dfs(start):
        result.append(list(path))  # Every partial path is a valid subset!
        for i in range(start, len(nums)):
            path.append(nums[i])    # Choose
            dfs(i + 1)              # Explore (can only pick elements to the right)
            path.pop()              # Unchoose

    dfs(0)
    return result
```

### Shape 2: Combinations with Duplicates (Subsets II)
If the input array contains duplicate values (`[1, 2, 2]`), naive recursion produces duplicate subsets.
The solution: **sort the input first**, and skip identical adjacent values *at the same tree depth*:

```python
def subsets_with_dup(nums):
    nums.sort()  # Step 1: Sort to bring duplicates together
    result = []
    path = []

    def dfs(start):
        result.append(list(path))
        for i in range(start, len(nums)):
            # Prune duplicate branches at the SAME recursion level
            if i > start and nums[i] == nums[i - 1]:
                continue
            path.append(nums[i])
            dfs(i + 1)
            path.pop()

    dfs(0)
    return result
```

### Shape 3: Permutations
Order matters (`[1, 2]` is different from `[2, 1]`). Instead of a `start` index, use a boolean `used` array or set to know which elements are already in the current path:

```python
def permute(nums):
    result = []
    path = []
    used = [False] * len(nums)

    def dfs():
        if len(path) == len(nums):
            result.append(list(path))
            return

        for i in range(len(nums)):
            if used[i]:
                continue
            used[i] = True
            path.append(nums[i])
            dfs()
            path.pop()
            used[i] = False

    dfs()
    return result
```

## Constraint Satisfaction: N-Queens

Place $N$ queens on an $N \times N$ chessboard such that no two queens attack each other.
Two queens attack each other if they share a row, a column, or a diagonal:
- Same column: `c1 == c2`
- Same major diagonal ($\backslash$): `r1 - c1 == r2 - c2`
- Same minor diagonal ($/$): `r1 + c1 == r2 + c2`

By placing queens row by row, we never share rows. By storing active columns and diagonal identifiers in sets, validation runs in **$O(1)$ time**:

```python
def solve_n_queens(n):
    cols = set()
    diag1 = set()  # r - c
    diag2 = set()  # r + c
    result = []
    board = [['.'] * n for _ in range(n)]

    def dfs(r):
        if r == n:
            result.append(["".join(row) for row in board])
            return

        for c in range(n):
            if c in cols or (r - c) in diag1 or (r + c) in diag2:
                continue  # PRUNED!

            # Choose
            cols.add(c)
            diag1.add(r - c)
            diag2.add(r + c)
            board[r][c] = 'Q'

            # Explore
            dfs(r + 1)

            # Unchoose
            cols.remove(c)
            diag1.remove(r - c)
            diag2.remove(r + c)
            board[r][c] = '.'

    dfs(0)
    return result
```

## Common pitfalls in technical interviews

- **Appending `path` instead of `list(path)`.** In Python, `result.append(path)` appends a reference to the mutable list `path`. When the backtracking finishes and unchooses all elements, `result` will contain dozens of empty lists `[[], [], []]`. Always do `result.append(list(path))` or `result.append(path[:])`.
- **Forgetting to undo state before early returns.** If your loop contains an early `return` or `break`, ensure that any modified state is properly restored before leaving the frame.
- **Not sorting before pruning duplicate combinations.** The condition `if i > start and nums[i] == nums[i-1]: continue` ONLY works if duplicates are adjacent. If the array is unsorted, duplicate subsets will slip through.

## Complexity

- **Subsets:** $O(n \cdot 2^n)$ time, because there are $2^n$ subsets and each takes $O(n)$ time to copy into results.
- **Permutations:** $O(n \cdot n!)$ time, because there are $n!$ leaves and each takes $O(n)$ time to copy.
- **Space Complexity:** $O(n)$ auxiliary space for the recursion call stack and `path` array (excluding the result list).

## Key takeaways

- Backtracking is DFS on a decision tree with explicit state rollback.
- Structure your recursive loop around **Choose $\to$ Explore $\to$ Unchoose**.
- Use `start` index for combinations/subsets; use `used` flags for permutations.
- Always append a **copy** of `path` (`list(path)`), not the original reference.
- Mathematical diagonals can be tracked in $O(1)$ using `r - c` and `r + c`.

## Practice problems to try next

Subsets I & II · Permutations I & II · Combination Sum I & II · Palindrome Partitioning · N-Queens · Word Search · Sudoku Solver.
MARKDOWN;
    }
}
