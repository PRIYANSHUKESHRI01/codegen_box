<?php

namespace Database\Seeders;

use App\Models\Article;
use App\Models\ArticleTopic;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Seeds the 10-article curriculum for Database Internals & SQL Mastery.
 * Idempotent (updateOrCreate by slug).
 */
class DatabaseInternalsArticlesSeeder extends Seeder
{
    public function run(): void
    {
        $topic = ArticleTopic::where('slug', 'database-internals')->first();

        if (! $topic) {
            $this->command?->error("Database Internals & SQL Mastery article topic not found. Run ArticleTopicSeeder first.");
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
                'slug' => 'storage-engines-row-vs-column-oriented',
                'title' => 'How Databases Store Data: Row-Oriented vs. Column-Oriented Storage Engines',
                'excerpt' => 'Databases do not store tables as spreadsheet grids on disk. Compare OLTP row-oriented storage (Postgres heap files, MySQL InnoDB clustered indexes) against OLAP columnar engines (Parquet, ClickHouse, Snowflake) and analyze disk I/O efficiency.',
                'display_order' => 1,
                'content' => $this->storageEnginesRowVsColumnOrientedArticle(),
            ],
            [
                'slug' => 'b-trees-and-b-plus-trees-relational-indexing',
                'title' => 'B-Trees and B+ Trees: Why Relational Databases Use Them for Indexes',
                'excerpt' => 'Why don\'t relational databases use Red-Black trees or Hash tables for primary keys? Discover the anatomy of B+ Trees, node fan-out, disk block alignment, and why linked leaf pages make range scans blazingly fast.',
                'display_order' => 2,
                'content' => $this->bTreesAndBPlusTreesRelationalIndexingArticle(),
            ],
            [
                'slug' => 'lsm-trees-and-sstables-in-nosql-databases',
                'title' => 'LSM-Trees and SSTables: The Storage Engine Powering Cassandra and RocksDB',
                'excerpt' => 'B+ Trees suffer from random disk writes during high-throughput ingestion. Learn how Log-Structured Merge-Trees (LSM) turn random writes into sequential disk flushes using MemTables, WAL, SSTables, and compaction algorithms.',
                'display_order' => 3,
                'content' => $this->lsmTreesAndSstablesInNosqlDatabasesArticle(),
            ],
            [
                'slug' => 'write-ahead-logging-and-crash-recovery-aries',
                'title' => 'Write-Ahead Logging (WAL) and Crash Recovery via ARIES',
                'excerpt' => 'What guarantees your database doesn\'t lose money when the server suddenly loses power mid-transaction? Understand Write-Ahead Logging (WAL), dirty page flushing, checkpoints, and the ARIES recovery algorithm.',
                'display_order' => 4,
                'content' => $this->writeAheadLoggingAndCrashRecoveryAriesArticle(),
            ],
            [
                'slug' => 'acid-invariants-and-transaction-isolation-levels',
                'title' => 'ACID Invariants and Transaction Isolation Levels: From Dirty Reads to Serializable',
                'excerpt' => 'Concurrency without isolation causes phantom rows, non-repeatable reads, and lost updates. Explore the ANSI SQL isolation levels, Postgres snapshot isolation, and the anomalies that leak through in production.',
                'display_order' => 5,
                'content' => $this->acidInvariantsAndTransactionIsolationLevelsArticle(),
            ],
            [
                'slug' => 'concurrency-control-2pl-vs-mvcc',
                'title' => 'Concurrency Control: Two-Phase Locking (2PL) vs. Multi-Version Concurrency Control (MVCC)',
                'excerpt' => 'Why don\'t readers block writers in Postgres and MySQL? Contrast pessimistic Two-Phase Locking (Shared vs Exclusive locks) with optimistic MVCC row versioning, vacuuming, and undo logs.',
                'display_order' => 6,
                'content' => $this->concurrencyControl2PlVsMvccArticle(),
            ],
            [
                'slug' => 'sql-query-optimization-explain-and-join-algorithms',
                'title' => 'SQL Query Optimization: EXPLAIN Plans, Index Scans, and Join Algorithms',
                'excerpt' => 'A slow database query can cripple an entire engineering stack. Master how the query optimizer interprets SQL, how to read EXPLAIN ANALYZE, and how Nested Loop, Hash, and Merge joins operate.',
                'display_order' => 7,
                'content' => $this->sqlQueryOptimizationExplainAndJoinAlgorithmsArticle(),
            ],
            [
                'slug' => 'composite-indexes-and-leftmost-prefix-rule',
                'title' => 'Composite Indexes, Covering Indexes, and the Leftmost Prefix Rule',
                'excerpt' => 'Adding an index on every column slows down writes and fails to speed up multi-column queries. Master composite index ordering, the Leftmost Prefix Rule, partial indexes, and index selectivity.',
                'display_order' => 8,
                'content' => $this->compositeIndexesAndLeftmostPrefixRuleArticle(),
            ],
            [
                'slug' => 'connection-pooling-deadlocks-and-contention',
                'title' => 'Connection Pooling, Deadlocks, and High-Concurrency Lock Contention',
                'excerpt' => 'Why does doubling your database connection pool from 20 to 200 make queries 10x slower? Understand PostgreSQL process models, PgBouncer, deadlock detection graphs, and lock acquisition ordering.',
                'display_order' => 9,
                'content' => $this->connectionPoolingDeadlocksAndContentionArticle(),
            ],
            [
                'slug' => 'distributed-sql-spanner-cockroachdb-and-raft-sharding',
                'title' => 'Distributed SQL: Google Spanner, CockroachDB, and Raft-Based Sharding',
                'excerpt' => 'Can a database offer horizontal scalability without sacrificing ACID transactions and relational SQL? Explore Distributed SQL architectures, TrueTime atomic clocks, Multi-Raft consensus groups, and distributed query planning.',
                'display_order' => 10,
                'content' => $this->distributedSqlSpannerCockroachdbAndRaftShardingArticle(),
            ],
        ];

        foreach ($articles as $data) {
            $content = $data['content'];
            Article::updateOrCreate(
                ['slug' => $data['slug']],
                [
                    'article_topic_id' => $topic->id,
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

    private function storageEnginesRowVsColumnOrientedArticle(): string
    {
        return <<<'MARKDOWN'
Software engineers interact with databases through SQL abstractions: `SELECT * FROM users WHERE id = 10`. But beneath that query parser lies a storage engine that dictates how bytes are physically packed onto persistent storage.

Choosing between a **row-oriented** and a **column-oriented** database is the defining architectural distinction between **OLTP (Online Transaction Processing)** and **OLAP (Online Analytical Processing)**.

---

## 1. Row-Oriented Storage: Built for OLTP

In a row-oriented database (PostgreSQL, MySQL, SQLite), all columns belonging to a single record are stored contiguously in 8 KB disk pages:

```
[Row 1: ID, Name, Email, Age] [Row 2: ID, Name, Email, Age] [Row 3: ID, Name, Email, Age]
```

### Why Row Storage Excels at Transactions:
- **Fast Single-Record Operations:** An `INSERT`, `UPDATE`, or `DELETE` for a specific user reads or writes a single contiguous block of disk bytes.
- **Atomic Locking:** Locking a row locks a small contiguous memory region without impacting neighboring rows.

### The Problem with Row Storage for Analytics:
Suppose you want to compute the average age across 50,000,000 users:
```sql
SELECT AVG(age) FROM users;
```
In a row-oriented database, the disk must read the **entire row** (ID, name, email, bio, password hash) into RAM just to extract the 4-byte integer `age`. 95% of the disk I/O and RAM bandwidth is wasted reading unused columns!

---

## 2. Column-Oriented Storage: Built for OLAP

In a columnar database (ClickHouse, Snowflake, BigQuery, AWS Redshift), values belonging to the **same column** are stored together contiguously:

```
Column ID:    [1, 2, 3, 4, 5, ...]
Column Name:  ["Alice", "Bob", "Charlie", ...]
Column Age:   [25, 30, 22, 45, ...]
```

### Why Columnar Storage Excels at Analytics:
1. **Zero Wasted Disk I/O:** `SELECT AVG(age)` reads **only** the `Age` column file from disk, skipping all other attributes completely.
2. **Massive Compression Ratios:** Because an entire file contains values of the exact same data type, algorithms like Run-Length Encoding (RLE), Delta Encoding, and Dictionary Compression reduce data size by **70–90%**.
3. **SIMD Vectorized Processing:** Modern CPUs can load multiple contiguous numbers into SIMD registers and sum them in a single clock cycle.

---

## Key Takeaways

1. Use row-oriented databases (Postgres, MySQL) for high-concurrency transactional OLTP systems.
2. Use columnar engines (ClickHouse, Snowflake) for multi-million row analytical aggregations.
3. Disk I/O bandwidth is the universal database bottleneck; columnar layouts minimize bytes transferred from disk.
MARKDOWN;
    }

    private function bTreesAndBPlusTreesRelationalIndexingArticle(): string
    {
        return <<<'MARKDOWN'
Software engineers master binary search trees (BSTs), AVL trees, and Red-Black trees in college. Yet virtually every relational database in the world (MySQL InnoDB, PostgreSQL, Oracle, SQLite) uses **B+ Trees** for its primary indexing structure.

Why did B+ Trees win the database storage war?

---

## 1. The Hardware Reality: Disk Block Alignment

A Binary Search Tree has a fan-out of 2: each node has at most two children. In a tree with 1,000,000 elements, tree depth is $\approx 20$.
In disk-based storage, traversing a pointer to a child node requires a **random disk read** (5–10ms on HDD, 50–100μs on SSD). Chasing 20 random pointers across disk would take unacceptable time.

### The B-Tree Solution: High Fan-Out
A B-Tree node is sized to match the database page size (typically **8 KB** in Postgres, **16 KB** in MySQL InnoDB).
- Instead of 2 children, a single 16 KB page holds **hundreds of keys and child pointers** (a fan-out of 500+).
- Tree depth drops from 20 down to **3 or 4**:
  $$\text{Capacity with Depth 3} = 500^3 = 125,000,000 \text{ rows}$$
Finding any row among 125 million records requires reading only **3 pages from disk**, with the top 2 pages permanently cached in RAM!

---

## 2. B-Tree vs. B+ Tree: The Critical Difference

| Feature | Classic B-Tree | B+ Tree |
| :--- | :--- | :--- |
| **Data Storage** | Data stored in *both* internal nodes and leaf nodes | Data stored **exclusively in leaf nodes** |
| **Internal Nodes** | Keys + Data pointers | Keys + Child page pointers only |
| **Fan-Out** | Lower (data consumes page space) | Much higher (more keys fit per 16 KB page) |
| **Range Queries** | Must perform expensive tree traversals | Instant linear scan via **doubly linked leaf list** |

In a B+ Tree, all leaf nodes are connected via a **doubly linked list**:
```
[Leaf 1: 1..100] <---> [Leaf 2: 101..200] <---> [Leaf 3: 201..300]
```
For range queries (`WHERE age BETWEEN 20 AND 30`), the database uses the tree once to find the start key (20), and then simply walks the linked leaf pages horizontally without ever touching the upper tree again!

---

## Key Takeaways

1. High fan-out keeps B+ Tree height at 3–4 levels, minimizing random disk page reads.
2. B+ Trees store data strictly in leaf pages, maximizing the key capacity of internal nodes.
3. Doubly linked leaf nodes allow $O(\log N + K)$ range queries.
MARKDOWN;
    }

    private function lsmTreesAndSstablesInNosqlDatabasesArticle(): string
    {
        return <<<'MARKDOWN'
While relational databases rely on B+ Trees, modern write-heavy NoSQL databases (Cassandra, ScyllaDB, RocksDB, Google Bigtable) use **Log-Structured Merge-Trees (LSM-Trees)**.

LSM-Trees were created to overcome a fundamental hardware limitation: **random disk writes are significantly slower than sequential writes**, even on modern NVMe SSDs.

---

## 1. The Core Architecture of an LSM-Tree

An LSM-Tree consists of four coordinated components:

```
             Write Request
                  |
         +--------+--------+
         |                 |
         v                 v
   [ Write-Ahead Log ]  [ In-Memory MemTable (SkipList) ]
   (Sequential Append)     |
                           | (Flushed to disk when full)
                           v
                [ Level 0 SSTable ]
                [ Level 1 SSTables (Compacted) ]
                [ Level 2 SSTables ]
```

1. **Write-Ahead Log (WAL):** Write appended sequentially to disk to survive crashes.
2. **MemTable:** An in-memory sorted data structure (usually a Concurrent SkipList). Writes return to the client immediately after being inserted into the MemTable!
3. **SSTable (Sorted String Table):** When the MemTable reaches 64 MB, it is frozen and written to disk as an **immutable, sorted file**.
4. **Compaction:** A background process continuously merges smaller SSTables into larger sorted levels, discarding deleted and overwritten keys.

---

## 2. Read Optimization: Bloom Filters and Sparse Indexes

Because SSTables are immutable, reading a key might require searching multiple SSTables on disk.
To prevent slow reads:
- **Bloom Filters:** Each SSTable has an in-memory Bloom filter that can instantly determine with 100% certainty if a key is **not** present, avoiding unnecessary disk reads.
- **Sparse Index:** An in-memory index pointing to key offsets every few kilobytes within the SSTable.

---

## Key Takeaways

1. LSM-Trees convert random writes into ultra-fast sequential append writes.
2. SSTables are immutable sorted disk files, eliminating in-place page fragmentation.
3. Background compaction merges files and garbage-collects deleted tombstones.
4. Bloom filters prevent disk reads for non-existent keys.
MARKDOWN;
    }

    private function writeAheadLoggingAndCrashRecoveryAriesArticle(): string
    {
        return <<<'MARKDOWN'
When a bank transaction transfers \$1,000 between accounts, the database must guarantee the **Durability** property of ACID: once committed, the update will never be lost, even if a backhoe severs the data center's power cables a microsecond later.

Flushing modified database pages (which are 8 KB–16 KB blocks scattered across disk) on every transaction would destroy database throughput. The solution is **Write-Ahead Logging (WAL)**.

---

## 1. The Fundamental Rule of WAL

> **The Write-Ahead Logging Protocol:**
> A dirty database page in RAM must **never** be written to disk until the corresponding log record describing the update has been safely flushed to persistent storage.

```
1. Client sends UPDATE.
2. Changes applied to 8 KB Data Page in RAM (Page marked "dirty").
3. Compact change record written to WAL buffer.
4. WAL buffer flushed to disk sequentially via fsync().
5. Client receives "COMMIT OK".
6. Dirty Data Page written to disk later asynchronously by background flusher.
```

Because WAL records are appended sequentially, disk heads do not seek, allowing thousands of transactions to commit per second.

---

## 2. The ARIES Recovery Algorithm

When a database crashes and restarts, it executes the legendary **ARIES (Algorithms for Recovery and Isolation Exploiting Semantics)** algorithm in three phases:

1. **Analysis Phase:** Scans the WAL forward from the last checkpoint to identify dirty pages in the buffer pool and active uncommitted transactions at the time of the crash.
2. **Redo Phase:** Scans forward from the earliest unwritten log sequence number (LSN) and replays **all** logged changes (even those of aborted transactions) to restore the database to the exact state it was in right before the crash.
3. **Undo Phase:** Scans backwards through the log and reverses (undoes) all transactions that were active and uncommitted at the moment of the crash, writing compensating log records.

---

## Key Takeaways

1. WAL guarantees Durability by logging small sequential change entries before flushing dirty pages.
2. `fsync()` guarantees log bytes are physically written to non-volatile disk platters.
3. ARIES crash recovery operates in three deterministic phases: Analysis, Redo, and Undo.
MARKDOWN;
    }

    private function acidInvariantsAndTransactionIsolationLevelsArticle(): string
    {
        return <<<'MARKDOWN'
The **ACID** properties are the cornerstone of relational reliability:
- **Atomicity:** All-or-nothing execution.
- **Consistency:** State transitions preserve schema constraints and foreign keys.
- **Isolation:** Concurrent transactions execute without mutual interference.
- **Durability:** Committed updates survive crashes.

Among these four, **Isolation** is the most complex because perfect isolation (Serializable) incurs high lock contention and latency.

---

## 1. The Read Anomalies

When transactions execute concurrently without adequate isolation, three classic anomalies emerge:

1. **Dirty Read:** Transaction A reads data modified by Transaction B that has **not yet committed**. If Transaction B rolls back, Transaction A acted on ghost data.
2. **Non-Repeatable Read (Fuzzy Read):** Transaction A reads a row. Transaction B updates that row and commits. Transaction A re-reads the row and sees different values.
3. **Phantom Read:** Transaction A queries a range of rows (`WHERE age > 30`). Transaction B inserts a new row matching that condition and commits. Transaction A re-executes the query and sees a new "phantom" row.

---

## 2. ANSI SQL Isolation Levels

| Isolation Level | Dirty Read | Non-Repeatable Read | Phantom Read | Mechanism |
| :--- | :---: | :---: | :---: | :--- |
| **Read Uncommitted** | Possible | Possible | Possible | No read locks; dangerous |
| **Read Committed** | Prevented | Possible | Possible | Reads take short-lived locks or snapshot per query (Postgres default) |
| **Repeatable Read** | Prevented | Prevented | Prevented* | Snapshot created at start of transaction |
| **Serializable** | Prevented | Prevented | Prevented | Strict 2PL or Serializable Snapshot Isolation (SSI) |

*In Postgres, Repeatable Read prevents phantom reads using Snapshot Isolation.

---

## 3. Write Skew: The Anomaly Repeatable Read Cannot Catch

Consider a hospital database with an on-call constraint: *"At least one doctor must be on call at all times."*
Two doctors, Alice and Bob, are currently on call. Both simultaneously request leave:
- Transaction 1 (Alice): Counts active doctors (finds 2: Alice & Bob). Decrements Alice.
- Transaction 2 (Bob): Counts active doctors (finds 2: Alice & Bob). Decrements Bob.
Both transactions commit successfully under **Repeatable Read**! Now **zero doctors** are on call!

This is **Write Skew**: transactions make decisions based on an invariant over multiple rows that are mutually invalidated.
**Solution:** Use `SELECT ... FOR UPDATE` to lock the rows, or upgrade to **Serializable**.

---

## Key Takeaways

1. Read Committed is the standard default, but does not prevent non-repeatable reads.
2. Repeatable Read isolates reads against concurrent updates, but remains vulnerable to Write Skew.
3. Use Serializable isolation or explicit row locks (`FOR UPDATE`) for critical multi-row invariants.
MARKDOWN;
    }

    private function concurrencyControl2PlVsMvccArticle(): string
    {
        return <<<'MARKDOWN'
In the early days of databases, ensuring transaction isolation required **locking**: if Transaction A was reading a row, Transaction B had to wait to write to it. If Transaction B was writing, Transaction A could not read.

In modern databases, **readers never block writers, and writers never block readers**. This breakthrough was achieved by replacing pure locking with **Multi-Version Concurrency Control (MVCC)**.

---

## 1. Two-Phase Locking (2PL): Pessimistic Control

2PL enforces serializability using two types of locks:
- **Shared Lock (S):** Acquired for reads. Multiple transactions can hold Shared locks concurrently.
- **Exclusive Lock (X):** Acquired for writes. Only one transaction can hold an Exclusive lock.

### The Two Phases:
1. **Growing Phase:** Transaction acquires locks as needed; no locks can be released.
2. **Shrinking Phase:** Transaction releases locks; no new locks can be acquired.

*Trade-off:* 2PL guarantees serializability, but readers and writers block each other, causing deadlocks and severe throughput degradation under high concurrency.

---

## 2. MVCC: Concurrency Through Row Versioning

Instead of overwriting rows in place, MVCC creates a **new version** of the row on every `UPDATE` or `DELETE`.

In PostgreSQL, every row contains hidden system attributes:
- `xmin`: Transaction ID (XID) that created this row version.
- `xmax`: Transaction ID (XID) that deleted/overwrote this row version.

```
+----+-------+------+------+
| ID | Name  | xmin | xmax |
+----+-------+------+------+
| 1  | Alice | 100  | 105  |  <- Old version (deleted by TX 105)
| 1  | Ally  | 105  | 0    |  <- Active version (created by TX 105)
+----+-------+------+------+
```

When Transaction 102 reads ID 1:
- Because Transaction 105 committed after Transaction 102 began, Transaction 102 reads the old version ("Alice")!
- It does not block or wait for Transaction 105 to finish!

---

## 3. The Cost of MVCC: Postgres VACUUM vs MySQL Undo Logs

- **PostgreSQL:** Appends new row versions directly into the table heap. Dead row versions remain on disk until removed by the **`VACUUM`** process. If autovacuum cannot keep up, table bloat degrades query performance.
- **MySQL (InnoDB):** Updates the row in-place and writes older versions to a separate **Undo Log**. Reads reconstruct older snapshots by walking the undo chain backwards.

---

## Key Takeaways

1. 2PL uses shared/exclusive locks where readers block writers and vice versa.
2. MVCC allows concurrent reads and writes by maintaining multiple historical row versions.
3. Tune autovacuum in Postgres to prevent dead-tuple table bloat.
MARKDOWN;
    }

    private function sqlQueryOptimizationExplainAndJoinAlgorithmsArticle(): string
    {
        return <<<'MARKDOWN'
SQL is a declarative language: you specify **what** data you want, not **how** to fetch it. The database's **Cost-Based Optimizer (CBO)** generates multiple execution plans, estimates CPU and I/O costs using table statistics, and picks the fastest plan.

When a query runs in 5 seconds instead of 5 milliseconds, reading `EXPLAIN ANALYZE` is your primary diagnostic tool.

---

## 1. Deconstructing `EXPLAIN` Execution Nodes

When running `EXPLAIN ANALYZE SELECT ...`:

- **Seq Scan (Sequential Scan):** Reads every single page of the table from disk. Acceptable for tiny tables (under 1,000 rows); disastrous for large tables.
- **Index Scan:** Walks the B+ Tree index, finds matching row pointers (`tid`), and fetches each corresponding heap page from disk.
- **Index Only Scan:** The absolute holy grail of performance! All requested columns are contained directly in the index itself (Covering Index). The database **never touches the table heap at all!**

---

## 2. The 3 Physical Join Algorithms

When joining Table A and Table B on `A.user_id = B.user_id`, the database selects one of three algorithms:

### 1. Nested Loop Join
For every row in the outer table, search the inner table (ideally using an index on the inner table).
- *Best for:* Small outer table + indexed inner table.
- *Complexity:* $O(N \times \log M)$.

### 2. Hash Join
The database reads the smaller table into RAM and builds an in-memory hash table on the join key. Then it scans the larger table and probes the hash table for matches.
- *Best for:* Large unindexed tables, equality joins (`=`).
- *Complexity:* $O(N + M)$ time, but consumes RAM (`work_mem`).

### 3. Merge Join (Sort-Merge Join)
Both tables are sorted by the join key. The database advances pointers through both lists concurrently.
- *Best for:* Tables that are already sorted by an index or range queries (`<`, `>`).
- *Complexity:* $O(N + M)$ if pre-sorted.

---

## Key Takeaways

1. Never optimize blindly: run `EXPLAIN (ANALYZE, BUFFERS)` to see actual page hits vs estimates.
2. Aim for Index Only Scans to eliminate table heap reads entirely.
3. Verify that table statistics are fresh by running `ANALYZE table_name` regularly.
MARKDOWN;
    }

    private function compositeIndexesAndLeftmostPrefixRuleArticle(): string
    {
        return <<<'MARKDOWN'
When faced with slow multi-column queries, novice engineers often add individual indexes to each column:
```sql
CREATE INDEX idx_user ON orders(user_id);
CREATE INDEX idx_status ON orders(status);
CREATE INDEX idx_created ON orders(created_at);
```
In reality, the database engine can usually use **only one index per table** during a query! To speed up multi-condition filtering, you need a **Composite Index**.

---

## 1. The Leftmost Prefix Rule

A composite index on `(user_id, status, created_at)` orders data strictly from left to right:
First sorted by `user_id`, then within equal `user_id` sorted by `status`, and within equal `status` sorted by `created_at`.

```
Index: (user_id, status, created_at)
-----------------------------------------------
(101, 'COMPLETED', '2026-01-01')
(101, 'PENDING',   '2026-01-02')
(102, 'COMPLETED', '2026-01-01')
(103, 'CANCELLED', '2026-01-05')
```

### Which queries CAN use the index?
- `WHERE user_id = 101` -> **YES** (Uses leftmost prefix)
- `WHERE user_id = 101 AND status = 'PENDING'` -> **YES** (Uses 2 leftmost columns)
- `WHERE user_id = 101 AND status = 'COMPLETED' AND created_at > ...` -> **YES** (Uses all 3)

### Which queries CANNOT use the index?
- `WHERE status = 'PENDING'` -> **NO!** (Skipped leftmost column `user_id`)
- `WHERE created_at > '2026-01-01'` -> **NO!**
- `WHERE status = 'PENDING' AND created_at > '2026-01-01'` -> **NO!**

---

## 2. The Equality First, Range Last Rule

When designing composite indexes, the golden rule of column ordering is:
1. **Equality columns first** (`WHERE user_id = ?`)
2. **Range / Inequality columns last** (`WHERE created_at > ?`)

Why? Because once the index encounters a range condition, it cannot use subsequent index columns for binary searching; it must scan all remaining rows linearly!

---

## 3. Covering Indexes (`INCLUDE` Clause)

If a query needs only one extra column that isn't part of the search filter, don't add it to the index key (which increases tree size). Use the `INCLUDE` clause:
```sql
CREATE INDEX idx_orders_covering ON orders(user_id, status) INCLUDE (total_amount);
```
The leaf pages store `total_amount` alongside the row pointer, enabling a pure **Index Only Scan** without changing index sort order.

---

## Key Takeaways

1. Composite indexes must satisfy the Leftmost Prefix Rule to be utilized.
2. Put high-cardinality equality columns before range filter columns.
3. Use covering indexes (`INCLUDE`) to serve queries directly from leaf pages.
MARKDOWN;
    }

    private function connectionPoolingDeadlocksAndContentionArticle(): string
    {
        return <<<'MARKDOWN'
When an application experiences high latency under heavy traffic, developers often increase the database connection pool:
```yaml
pool:
  max_connections: 500 # "More connections = more concurrency, right?"
```
Shortly after deployment, database CPU spikes to 100%, query latency increases by 1,000%, and the system grinds to a halt.

Why did more connections cripple the database?

---

## 1. The PostgreSQL Process Model and CPU Context Switching

In PostgreSQL, every client connection spawns an independent **operating system process** (not a lightweight thread!).
- A server with **16 physical CPU cores** can execute exactly **16 instructions in parallel**.
- When 300 active connections fight for 16 CPU cores, the Linux kernel spends almost all its time **context-switching** between processes and contending on internal spinlocks (`WALWriteLock`, buffer pool locks), rather than executing SQL.

### The Famous HikariCP Sizing Formula:
$$\text{connections} = (\text{core\_count} \times 2) + \text{effective\_spindle\_count}$$
For a 16-core server with SSD storage, the optimal pool size is often **between 32 and 40 connections**, capable of handling tens of thousands of requests per second through rapid reuse!

---

## 2. External Connection Pooling: PgBouncer

To handle thousands of client connections without overloading the database, deploy an external pooler like **PgBouncer**:
- Clients maintain persistent connections to PgBouncer.
- PgBouncer maintains a tight pool of 30 physical connections to PostgreSQL, multiplexing client transactions through them in transaction-pooling mode.

---

## 3. Deadlocks: Detection and Prevention

A deadlock occurs when two transactions wait for locks held by each other:
- Transaction 1 holds Lock A, wants Lock B.
- Transaction 2 holds Lock B, wants Lock A.

Neither transaction can proceed. The database's background **deadlock detector** periodically builds a directed "wait-for" graph, detects cycles, and kills one transaction with an error (`ERROR: deadlock detected`).

### The Golden Rule of Deadlock Prevention:
**Always acquire locks in the exact same deterministic order.**
If updating both User 1 and User 2, always sort IDs first:
```go
if userA.ID > userB.ID {
    userA, userB = userB, userA // Lock smaller ID first!
}
```

---

## Key Takeaways

1. Oversized connection pools cause CPU thrashing and context switching; keep pools small.
2. Use PgBouncer in transaction mode to support thousands of frontend clients.
3. Eliminate deadlocks by sorting resource IDs and acquiring locks in identical order across all transactions.
MARKDOWN;
    }

    private function distributedSqlSpannerCockroachdbAndRaftShardingArticle(): string
    {
        return <<<'MARKDOWN'
For decades, systems architects were forced into a painful dichotomy:
- Choose **Relational SQL (Postgres/MySQL)** for ACID transactions and relational joins, but suffer single-node scalability limits.
- Choose **NoSQL (Cassandra/DynamoDB)** for infinite horizontal scale, but surrender joins, foreign keys, and strong consistency.

In 2012, Google published the groundbreaking **Google Spanner** paper, birthing the era of **Distributed SQL** (commercialized by CockroachDB and YugabyteDB).

---

## 1. The Architecture of Distributed SQL

Distributed SQL decomposes a database into three distinct tiers:

```
                  +---------------------------+
                  | SQL Query Execution Layer | (Distributed Parser/Optimizer)
                  +-------------+-------------+
                                |
                                v
                  +---------------------------+
                  | Distributed Key-Value Tier| (Keyspace partitioned into Ranges)
                  +-------------+-------------+
                                |
                                v
                  +---------------------------+
                  | Multi-Raft Consensus Group| (Replication across nodes)
                  +---------------------------+
```

1. **SQL Layer:** Stateless nodes accept SQL, parse queries, and generate distributed query execution plans.
2. **Range Partitioning:** The global keyspace is split into contiguous chunks called **Ranges** (typically 64 MB blocks).
3. **Multi-Raft Consensus:** Every Range is replicated across 3 or 5 nodes using a dedicated Raft consensus group.

---

## 2. TrueTime vs. Hybrid Logical Clocks (HLC)

To achieve serializable transactions across data centers without massive coordination latency, transactions must be ordered by timestamp.

- **Google Spanner (TrueTime):** Uses GPS receivers and atomic clocks in Google data centers to bound clock drift uncertainty $\epsilon$ to under 7 milliseconds.
- **CockroachDB (Hybrid Logical Clocks):** Runs on commodity cloud hardware without atomic clocks by combining physical NTP timestamps with Lamport logical counters.

---

## Key Takeaways

1. Distributed SQL combines the horizontal scaling of NoSQL with the ACID transactions of relational SQL.
2. Tables are partitioned into Ranges and replicated via Multi-Raft consensus.
3. TrueTime and Hybrid Logical Clocks enable distributed serializable snapshot isolation.
MARKDOWN;
    }
}
