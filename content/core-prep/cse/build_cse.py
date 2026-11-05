"""
Builds backend/database/data/domain_questions/cse.json - the Computer Science core (CSE / IT) Domain Prep bank.

Run:  python content/core-prep/cse/build_cse.py

Edit THIS file, never the JSON. Original questions written for AptRun in the style of the GATE (CS) and campus-placement technical
papers; nothing is copied from any paper or book. Every question has a worked explanation. Numerical answers are computed in code next
to the question so an arithmetic slip cannot hide. The correct option is written first and then placed deterministically so the answer
letters are balanced (about 25 % each). Every question is tagged `editorial-v1` and has the source "Original (AptRun editorial v1)" so
staff can filter, review or retire exactly these.

NOT reviewed by a faculty member yet: have one person read the file before the discipline is switched live for everyone.
"""

import json
import math
import os
import sys

SOURCE = "Original (AptRun editorial v1)"
TAGS = "GATE / campus placement style;editorial-v1"

# subject code -> (id prefix, subject name for messages)
SUBJECTS = {
    "dbms": "DBMS",
    "operating_systems": "OS",
    "computer_networks": "CN",
    "oop": "OOP",
    "data_structures": "DS",
    "algorithms": "ALGO",
    "computer_organization": "COA",
    "theory_of_computation": "TOC",
    "software_engineering": "SE",
    "discrete_math": "DM",
}

QUESTIONS = []
COUNTERS = {}


def _id(subject):
    COUNTERS[subject] = COUNTERS.get(subject, 0) + 1
    return "CSE-%s-%03d" % (SUBJECTS[subject], COUNTERS[subject])


def mcq(subject, topic, difficulty, stem, correct, wrong, explanation):
    """One single-answer MCQ. `wrong` is exactly three distractors."""
    assert len(wrong) == 3, stem
    options = list(wrong)
    slot = len(QUESTIONS) % 4  # balanced answer letters
    options.insert(slot, correct)
    QUESTIONS.append({
        "external_id": _id(subject), "discipline": "cse", "subject": subject, "topic": topic, "type": "mcq_single",
        "difficulty": difficulty, "usage": "both", "marks": 1, "negative_marks": 0.25,
        "question": stem, "explanation": explanation, "tags": TAGS, "source": SOURCE, "status": "published",
        "option_a": options[0], "option_b": options[1], "option_c": options[2], "option_d": options[3],
        "correct": "ABCD"[slot],
    })


def num(subject, topic, difficulty, stem, answer, explanation, unit=None, tol=0):
    """One numerical question; the accepted range is [answer - tol, answer + tol]."""
    QUESTIONS.append({
        "external_id": _id(subject), "discipline": "cse", "subject": subject, "topic": topic, "type": "numeric",
        "difficulty": difficulty, "usage": "both", "marks": 1, "negative_marks": 0,
        "question": stem, "explanation": explanation, "tags": TAGS, "source": SOURCE, "status": "published",
        "numeric_min": answer - tol, "numeric_max": answer + tol, "numeric_unit": unit,
    })


# ═════════════════════════════════ DBMS ═════════════════════════════════
S = "dbms"
mcq(S, "ER model and keys", "easy", "A candidate key is best described as", "a minimal set of attributes that uniquely identifies every tuple",
    ["any set of attributes that contains the primary key", "an attribute that references the primary key of another relation", "an attribute that may hold NULL values"],
    "A candidate key is a minimal superkey: it identifies tuples uniquely and no proper subset of it does. One candidate key is chosen as the primary key.")
mcq(S, "ER model and keys", "medium", "In a relation R(A, B, C, D) the functional dependencies are A -> B, B -> C and C -> D. How many candidate keys does R have?", "1",
    ["2", "3", "4"], "The closure of A is {A, B, C, D}, so A is a key. No other attribute determines A, so A is the only candidate key.")
mcq(S, "ER model and keys", "easy", "A foreign key constraint enforces", "referential integrity",
    ["entity integrity", "domain integrity", "functional dependency"], "A foreign key must match an existing primary or candidate key value in the referenced table (or be NULL); that is referential integrity.")
mcq(S, "Relational algebra and SQL", "easy", "Which SQL clause is used to filter groups after aggregation?", "HAVING",
    ["WHERE", "GROUP BY", "ORDER BY"], "WHERE filters rows before grouping; HAVING filters the groups produced by GROUP BY and may use aggregate functions.")
mcq(S, "Relational algebra and SQL", "medium", "Table T has 5 rows and column X, of which 2 values are NULL. What does SELECT COUNT(X) return?", "3",
    ["5", "2", "0"], "COUNT(column) counts only the non-NULL values of that column. COUNT(*) would return 5.")
mcq(S, "Relational algebra and SQL", "medium", "A LEFT OUTER JOIN of A (4 rows) with B returns at least how many rows?", "4",
    ["0", "the number of matching rows only", "the product of the two row counts"], "A left outer join keeps every row of the left table, padding with NULLs when there is no match, so it returns at least the number of left rows.")
mcq(S, "Relational algebra and SQL", "medium", "Which operation in relational algebra is used to combine two relations having the same attributes and removes duplicates?", "Union",
    ["Cartesian product", "Natural join", "Difference"], "Union of two union-compatible relations contains all tuples that are in either, without duplicates.")
mcq(S, "Normalization", "medium", "A relation is in 2NF if it is in 1NF and", "no non-prime attribute is partially dependent on any candidate key",
    ["no non-prime attribute is transitively dependent on a candidate key", "every determinant is a candidate key", "it has no multivalued dependency"],
    "2NF removes partial dependencies on part of a composite key. Removing transitive dependencies gives 3NF; every determinant being a key gives BCNF.")
mcq(S, "Normalization", "medium", "Which of the following is true?", "Every relation in BCNF is also in 3NF",
    ["Every relation in 3NF is also in BCNF", "BCNF always preserves all functional dependencies", "A relation with a single candidate key can never be in 2NF"],
    "BCNF is stricter than 3NF, so BCNF implies 3NF. The converse fails, and BCNF decomposition may lose dependency preservation.")
mcq(S, "Normalization", "hard", "R(A, B, C) has the functional dependencies AB -> C and C -> B. The highest normal form of R is", "3NF but not BCNF",
    ["BCNF", "2NF but not 3NF", "1NF only"], "The keys are AB and AC. C -> B has a non-superkey determinant, violating BCNF, but B is a prime attribute, so 3NF holds.")
num(S, "Normalization", "medium", "R(A, B, C, D, E) has the dependencies A -> B, BC -> D and D -> E. The number of candidate keys of R is", 1,
    "Attributes that never appear on a right-hand side must be in every key: A and C. The closure of AC is {A, B, C, D, E}, so AC is the only candidate key.")
mcq(S, "Transactions and concurrency", "easy", "Which ACID property ensures that a committed transaction survives a system crash?", "Durability",
    ["Atomicity", "Consistency", "Isolation"], "Durability guarantees committed changes persist, using write-ahead logging and recovery.")
mcq(S, "Transactions and concurrency", "medium", "Reading a value written by another transaction that later rolls back is called", "a dirty read",
    ["a phantom read", "a non-repeatable read", "a lost update"], "A dirty read sees uncommitted data. READ COMMITTED and higher isolation levels prevent it.")
mcq(S, "Transactions and concurrency", "medium", "The two-phase locking protocol guarantees", "conflict serializability but not freedom from deadlock",
    ["freedom from deadlock but not serializability", "both serializability and freedom from deadlock", "neither serializability nor recoverability"],
    "2PL produces conflict-serializable schedules, but transactions can still wait on each other in a cycle.")
mcq(S, "Transactions and concurrency", "hard", "A schedule is conflict serializable if and only if", "its precedence graph has no cycle",
    ["its precedence graph is a tree", "every transaction commits before the next starts", "it uses strict two-phase locking"], "Build an edge Ti -> Tj for every conflicting pair where Ti's operation comes first. The schedule is conflict serializable exactly when the graph is acyclic.")
mcq(S, "Indexing and storage", "medium", "The main reason B+ trees are preferred to binary search trees for database indexes is", "their high fan-out keeps the tree shallow, so few disk blocks are read",
    ["they use less memory per key", "they allow duplicate keys", "they never need rebalancing"], "A B+ tree node fills a disk block with many keys, so a lookup touches only a handful of blocks.")
mcq(S, "Indexing and storage", "medium", "A table can have at most how many clustered indexes?", "one",
    ["two", "as many as it has columns", "none"], "A clustered index defines the physical order of the rows, so only one is possible.")
mcq(S, "Indexing and storage", "medium", "Which index structure supports efficient equality lookups but not range queries?", "Hash index",
    ["B+ tree index", "Sorted array index", "ISAM index"], "A hash index maps a key to a bucket, so equality is O(1) on average, but neighbouring keys are scattered, so ranges are not supported.")
mcq(S, "NoSQL and recent trends", "easy", "Which of the following is a document-oriented NoSQL database?", "MongoDB",
    ["Redis", "Neo4j", "Cassandra"], "MongoDB stores JSON-like documents. Redis is a key-value store, Neo4j a graph database and Cassandra a wide-column store.")
mcq(S, "NoSQL and recent trends", "medium", "According to the CAP theorem, during a network partition a distributed system must choose between", "consistency and availability",
    ["consistency and durability", "availability and latency", "partition tolerance and scalability"], "When a partition happens the system cannot keep both every node answering and every answer being the latest write: it gives up consistency or availability.")

# ═════════════════════════════════ OPERATING SYSTEMS ═════════════════════════════════
S = "operating_systems"
mcq(S, "Processes and threads", "easy", "Which of the following is shared by all threads of a process?", "the heap and open files",
    ["the stack", "the program counter", "the register set"], "Threads share code, heap, globals and open files; each thread has its own stack, registers and program counter.")
mcq(S, "Processes and threads", "easy", "A process moves from the running state to the ready state when", "its time slice expires",
    ["it requests an I/O operation", "it terminates", "it is created"], "On pre-emption (time slice end or a higher-priority arrival) a running process goes back to ready. An I/O request moves it to waiting.")
mcq(S, "Processes and threads", "medium", "What does a call to fork() return in the child process?", "0",
    ["the child's process id", "-1", "the parent's process id"], "fork() returns 0 to the child, the child's pid to the parent and -1 on failure.")
num(S, "Processes and threads", "medium", "A program calls fork() three times in sequence, with no conditions. The total number of processes created (not counting the original) is", 7,
    "Each fork doubles the number of processes: 1 -> 2 -> 4 -> 8. Total of 8 processes, so 7 new ones (2^3 - 1).")
mcq(S, "CPU scheduling", "medium", "Which scheduling algorithm gives the minimum average waiting time for a given set of processes (all available at time 0)?", "Shortest Job First",
    ["First Come First Served", "Round Robin", "Priority scheduling"], "SJF is provably optimal for minimising average waiting time when burst times are known.")
num(S, "CPU scheduling", "medium", "Three processes arrive at time 0 with burst times 6, 3 and 1 ms. Using SJF (non-pre-emptive), the average waiting time in ms is", round((0 + 1 + 4) / 3, 2),
    "Order: 1, 3, 6. Waiting times: 0, 1, 4. Average = 5/3 = 1.67 ms.", "ms", 0.01)
mcq(S, "CPU scheduling", "medium", "Starvation of low-priority processes in priority scheduling is usually solved by", "ageing",
    ["increasing the time quantum", "using FCFS", "disabling pre-emption"], "Ageing gradually raises the priority of processes that wait for a long time.")
mcq(S, "CPU scheduling", "hard", "In Round Robin scheduling, if the time quantum is made very large, the algorithm behaves like", "First Come First Served",
    ["Shortest Job First", "Priority scheduling", "Multilevel feedback queue"], "When the quantum exceeds every burst, each process runs to completion in arrival order: FCFS.")
mcq(S, "Synchronisation and deadlocks", "easy", "Which of the following is NOT a necessary condition for deadlock?", "Pre-emption",
    ["Mutual exclusion", "Hold and wait", "Circular wait"], "The four conditions are mutual exclusion, hold and wait, NO pre-emption and circular wait. Pre-emption would break deadlock.")
mcq(S, "Synchronisation and deadlocks", "medium", "A semaphore S is initialised to 1. Processes P1 and P2 each execute wait(S) then signal(S) around a critical section. This provides", "mutual exclusion",
    ["no protection at all", "deadlock-free progress only", "a bounded number of simultaneous entries greater than one"], "A binary semaphore initialised to 1 lets only one process in the critical section at a time.")
mcq(S, "Synchronisation and deadlocks", "hard", "The Banker's algorithm is used for", "deadlock avoidance",
    ["deadlock detection only", "deadlock prevention by removing hold and wait", "process scheduling"], "It grants a request only if the system stays in a safe state, so a deadlock can never occur: avoidance.")
num(S, "Synchronisation and deadlocks", "hard", "A system has 12 identical resources of one type shared by n processes, each needing at most 4. What is the largest n for which deadlock is impossible?", 3,
    "Deadlock needs every process to hold 3 (max - 1) and wait for one more, using n x 3 resources. Deadlock is impossible while 12 >= 3n + 1, so n <= 3 (for n = 4, four processes holding 3 each use all 12 and none can finish).")
mcq(S, "Memory management", "easy", "In memory management, paging eliminates", "external fragmentation",
    ["internal fragmentation", "page faults", "the need for a page table"], "Equal-size frames mean any free frame fits any page, so there is no external fragmentation. The last page of a process can still waste space (internal fragmentation).")
num(S, "Memory management", "medium", "A system has 32-bit virtual addresses and 4 KB pages. The number of bits used for the page offset is", 12,
    "4 KB = 2^12 bytes, so 12 bits address a byte within a page.", "bits")
num(S, "Memory management", "medium", "With 32-bit virtual addresses and 4 KB pages, a single-level page table has how many entries (answer in 2^k, give k)?", 20,
    "Page number bits = 32 - 12 = 20, so the table has 2^20 entries.", None)
mcq(S, "Memory management", "medium", "The purpose of the TLB is to", "cache recent page-table translations",
    ["store the page table on disk", "increase the page size", "swap pages to disk"], "The translation lookaside buffer holds recent virtual-to-physical mappings to avoid a memory access for the page table on every reference.")
num(S, "Memory management", "hard", "TLB hit ratio is 80 %, TLB access takes 10 ns and a memory access takes 100 ns. The effective access time (ns) with a single-level page table, assuming the TLB lookup always happens, is", 0.8 * (10 + 100) + 0.2 * (10 + 100 + 100),
    "Hit: 10 + 100 = 110 ns. Miss: 10 + 100 (page table) + 100 = 210 ns. EAT = 0.8 x 110 + 0.2 x 210 = 130 ns.", "ns", 0.5)
mcq(S, "Virtual memory", "medium", "Which page replacement algorithm can suffer from Belady's anomaly?", "FIFO",
    ["LRU", "Optimal", "Both LRU and Optimal"], "With FIFO, adding frames can increase the number of page faults for some reference strings. Stack algorithms (LRU, Optimal) never do.")
num(S, "Virtual memory", "medium", "For the reference string 1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5 and 3 frames, the number of page faults with FIFO is", 9,
    "Simulating FIFO with 3 frames gives faults on 1,2,3,4,1,2,5,3,4 = 9 faults (hits on the second 1 and 2 after 5 and on 5).")
mcq(S, "Virtual memory", "medium", "Thrashing occurs when", "the system spends more time paging than executing",
    ["the CPU is idle because no process is ready", "too few processes are in memory", "the page size is too large"], "When working sets do not fit in memory, processes fault constantly and useful work collapses.")
mcq(S, "File systems and I/O", "medium", "In a Unix file system, the inode of a file does NOT store", "the file name",
    ["the file size", "the block pointers", "the owner and permissions"], "File names live in directory entries that map a name to an inode number; the inode holds attributes and block pointers.")
num(S, "File systems and I/O", "hard", "A disk has requests for cylinders 98, 183, 37, 122, 14, 124, 65, 67 and the head is at 53. Using FCFS, the total head movement (cylinders) is", sum(abs(a - b) for a, b in zip([53, 98, 183, 37, 122, 14, 124, 65], [98, 183, 37, 122, 14, 124, 65, 67])),
    "Moves: 45 + 85 + 146 + 85 + 108 + 110 + 59 + 2 = 640 cylinders.", "cylinders")

# ═════════════════════════════════ COMPUTER NETWORKS ═════════════════════════════════
S = "computer_networks"
mcq(S, "Layered models", "easy", "Which layer of the OSI model is responsible for routing packets between networks?", "Network layer",
    ["Data link layer", "Transport layer", "Session layer"], "The network layer (IP) chooses paths between networks using logical addresses.")
mcq(S, "Layered models", "easy", "Which device operates at the data-link layer and forwards frames using MAC addresses?", "Switch",
    ["Hub", "Router", "Repeater"], "A switch learns which MAC address is on which port and forwards frames only where needed.")
mcq(S, "Layered models", "medium", "Which layer of the TCP/IP model combines the OSI session, presentation and application layers?", "Application layer",
    ["Transport layer", "Internet layer", "Link layer"], "TCP/IP merges the three top OSI layers into one application layer.")
mcq(S, "Data link and LAN", "medium", "The CSMA/CD protocol is used in", "classic shared-medium Ethernet",
    ["Wi-Fi (802.11)", "Token ring", "ATM"], "Ethernet on a shared medium listens, transmits and detects collisions. Wi-Fi uses collision avoidance (CSMA/CA).")
num(S, "Data link and LAN", "medium", "A bit string 1101011011 is protected by CRC with the generator 10011. The number of CRC bits appended is", 4,
    "The generator polynomial has degree 4 (5 bits), so 4 zero bits are appended and replaced by the remainder.", "bits")
mcq(S, "Data link and LAN", "medium", "In the TCP/IP suite, what does ARP do?", "maps an IP address to a MAC address",
    ["maps a domain name to an IP address", "assigns IP addresses dynamically", "routes packets between networks"], "ARP broadcasts a request on the local network and the owner of the IP replies with its MAC address.")
num(S, "IP addressing and subnetting", "medium", "The number of usable host addresses in a /26 IPv4 subnet is", 2 ** 6 - 2,
    "A /26 leaves 6 host bits: 64 addresses, minus the network and broadcast addresses gives 62 usable hosts.")
num(S, "IP addressing and subnetting", "medium", "A /22 network is divided into /26 subnets. The number of subnets is", 2 ** (26 - 22),
    "Borrowing 4 more bits gives 2^4 = 16 subnets.")
mcq(S, "IP addressing and subnetting", "easy", "The IPv4 address 192.168.10.25 belongs to", "a private address range",
    ["the loopback range", "a multicast range", "a link-local range"], "192.168.0.0/16 is reserved for private networks (RFC 1918).")
mcq(S, "IP addressing and subnetting", "medium", "The subnet mask 255.255.255.224 corresponds to the prefix length", "/27",
    ["/26", "/28", "/25"], "224 = 11100000, three more bits on top of 24, so /27.")
mcq(S, "Routing", "medium", "OSPF is an example of a", "link-state routing protocol",
    ["distance-vector routing protocol", "path-vector routing protocol", "transport protocol"], "OSPF floods link-state advertisements and runs Dijkstra's algorithm. RIP is distance-vector and BGP is path-vector.")
mcq(S, "Routing", "hard", "The count-to-infinity problem is associated with", "distance-vector routing",
    ["link-state routing", "static routing", "NAT"], "Routers exchanging distance vectors may slowly increase a metric toward infinity after a link failure. Split horizon and poison reverse reduce it.")
mcq(S, "Transport layer", "easy", "Which protocol provides reliable, connection-oriented delivery?", "TCP",
    ["UDP", "IP", "ICMP"], "TCP uses sequence numbers, acknowledgements and retransmissions for reliable ordered delivery.")
mcq(S, "Transport layer", "medium", "How many segments are exchanged in the TCP connection-establishment handshake?", "3",
    ["2", "4", "5"], "SYN, SYN-ACK and ACK: three segments.")
mcq(S, "Transport layer", "medium", "In TCP slow start, the congestion window", "doubles every round-trip time",
    ["increases by one segment every round-trip time", "stays constant", "halves every round-trip time"], "During slow start cwnd grows by one segment per ACK, which doubles it each RTT, until the threshold is reached.")
mcq(S, "Transport layer", "hard", "Which of these applications most naturally uses UDP?", "Live video streaming",
    ["File transfer", "Email delivery", "Online banking"], "Streaming tolerates some loss but not the delay of retransmission, so it prefers UDP's low latency.")
mcq(S, "Application layer and security", "easy", "The default port of HTTPS is", "443",
    ["80", "21", "25"], "HTTP uses 80, FTP 21, SMTP 25 and HTTPS 443.")
mcq(S, "Application layer and security", "medium", "DNS primarily uses which transport protocol for ordinary queries?", "UDP on port 53",
    ["TCP on port 80", "TCP on port 25", "UDP on port 67"], "Ordinary DNS queries fit in one UDP datagram; TCP is used for large responses and zone transfers.")
mcq(S, "Application layer and security", "medium", "TLS provides all of the following EXCEPT", "protection against denial-of-service attacks",
    ["confidentiality", "integrity", "server authentication"], "TLS encrypts, protects integrity and authenticates the server (and optionally the client). It does not stop a flood of traffic.")
mcq(S, "Application layer and security", "medium", "An HTTP response with status code 404 means", "the requested resource was not found",
    ["the request succeeded", "the server crashed", "the client must authenticate"], "4xx codes are client errors: 404 is Not Found; 401 asks for authentication and 500 is an internal server error.")

# ═════════════════════════════════ OOP ═════════════════════════════════
S = "oop"
mcq(S, "OOP principles", "easy", "Binding data and the methods that operate on it together, and restricting direct access, is called", "encapsulation",
    ["inheritance", "polymorphism", "abstraction"], "Encapsulation bundles state with behaviour and hides the state behind an interface.")
mcq(S, "OOP principles", "easy", "Which of the following describes a class?", "a blueprint from which objects are created",
    ["a running instance of an object", "a variable that holds a function", "a file containing source code"], "A class defines state and behaviour; objects are its instances.")
mcq(S, "OOP principles", "medium", "Abstraction differs from encapsulation in that abstraction", "focuses on exposing essential behaviour while hiding implementation detail",
    ["is implemented only with private fields", "applies only to inheritance hierarchies", "means one name for many forms"], "Abstraction is about what an object does (the interface); encapsulation is about protecting how it stores state.")
mcq(S, "Inheritance and polymorphism", "medium", "Method overriding is an example of", "run-time polymorphism",
    ["compile-time polymorphism", "encapsulation", "operator overloading"], "Which override runs is decided at run time from the actual object type (dynamic dispatch).")
mcq(S, "Inheritance and polymorphism", "medium", "Method overloading requires that the methods", "have the same name but different parameter lists",
    ["have the same name and the same parameters but different return types", "are in different classes related by inheritance", "are declared private"], "Overloads share a name and differ in the number or types of parameters; return type alone is not enough.")
mcq(S, "Inheritance and polymorphism", "hard", "The diamond problem arises in", "multiple inheritance of classes with a common ancestor",
    ["single inheritance", "method overloading", "interface declarations without default methods"], "A class inheriting from two classes that share a base may inherit the base's members twice or ambiguously.")
mcq(S, "Abstract classes and interfaces", "medium", "Which statement about an abstract class is correct?", "It cannot be instantiated directly",
    ["It cannot contain any implemented method", "It cannot have constructors", "It must have exactly one abstract method"], "An abstract class may mix implemented and abstract methods and have constructors, but you cannot create an object of it directly.")
mcq(S, "Abstract classes and interfaces", "medium", "When would you prefer an interface to an abstract class?", "when unrelated classes must share a capability",
    ["when subclasses must share state", "when you need constructors", "when you need protected fields"], "Interfaces describe a contract that any class can implement regardless of its hierarchy; abstract classes suit shared base state and behaviour.")
mcq(S, "Design principles and patterns", "easy", "The Single Responsibility Principle states that", "a class should have only one reason to change",
    ["a class should have only one method", "a class should have only one instance", "a class should extend only one class"], "Each class should own one responsibility so changes in one concern do not ripple into others.")
mcq(S, "Design principles and patterns", "medium", "Which design pattern ensures a class has only one instance and provides global access to it?", "Singleton",
    ["Factory", "Observer", "Decorator"], "Singleton restricts instantiation to one object.")
mcq(S, "Design principles and patterns", "medium", "The Liskov Substitution Principle says", "objects of a subclass should be usable wherever the base class is expected without breaking correctness",
    ["a class should depend on abstractions, not concretions", "software entities should be closed for extension", "interfaces should be small"], "Subtypes must honour the base type's contract so callers need not know which subtype they have.")
mcq(S, "Design principles and patterns", "medium", "In the Observer pattern, when the subject's state changes it", "notifies every registered observer",
    ["creates a new object of the observer class", "destroys its observers", "blocks until each observer replies"], "Observers register with the subject and are called back on change, giving loose coupling.")
mcq(S, "Exceptions and memory", "medium", "Code in a Java finally block", "runs whether or not an exception was thrown",
    ["runs only when an exception is thrown", "runs only when no exception is thrown", "never runs if return is called in try"], "finally is used to release resources and runs on both normal and exceptional exit (barring the JVM exiting).")
mcq(S, "Exceptions and memory", "hard", "A shallow copy of an object that contains a reference to a list", "shares the same list with the original",
    ["creates an independent copy of the list", "sets the list reference to null", "copies only the primitive fields"], "A shallow copy duplicates the reference, so both objects point to one list; a change through either is visible through both.")

# ═════════════════════════════════ DATA STRUCTURES ═════════════════════════════════
S = "data_structures"
mcq(S, "Arrays and linked lists", "easy", "What is the time complexity of accessing the i-th element of an array?", "O(1)",
    ["O(n)", "O(log n)", "O(n log n)"], "Arrays are contiguous, so the address is computed directly from the index.")
mcq(S, "Arrays and linked lists", "medium", "Inserting a node at the head of a singly linked list takes", "O(1)",
    ["O(n)", "O(log n)", "O(n squared)"], "Create the node, point it to the old head and update the head pointer: constant time.")
mcq(S, "Arrays and linked lists", "medium", "Which technique finds the middle of a singly linked list in a single pass?", "slow and fast pointers",
    ["reversing the list first", "binary search on the nodes", "using a stack of all nodes only"], "Move one pointer by one and another by two; when the fast one reaches the end, the slow one is at the middle.")
mcq(S, "Stacks and queues", "easy", "Which data structure is used to evaluate a postfix expression?", "Stack",
    ["Queue", "Heap", "Binary tree"], "Operands are pushed; an operator pops two operands and pushes the result.")
mcq(S, "Stacks and queues", "medium", "A queue is implemented with two stacks. The amortised cost of a dequeue operation is", "O(1)",
    ["O(n)", "O(log n)", "O(n squared)"], "Each element is moved from the input stack to the output stack at most once, so the cost spreads to O(1) per operation.")
num(S, "Stacks and queues", "medium", "The postfix expression 5 3 2 * + 4 - evaluates to", 5 + 3 * 2 - 4,
    "3 2 * = 6; 5 6 + = 11; 11 4 - = 7. Answer 7.")
mcq(S, "Trees", "easy", "The inorder traversal of a binary search tree gives the keys in", "ascending sorted order",
    ["descending sorted order", "level order", "random order"], "Left subtree, node, right subtree visits the keys in increasing order.")
num(S, "Trees", "medium", "The maximum number of nodes in a binary tree of height 4 (a single node has height 0) is", 2 ** 5 - 1,
    "A full binary tree of height h has 2^(h+1) - 1 nodes: 2^5 - 1 = 31.")
mcq(S, "Trees", "medium", "An AVL tree keeps itself balanced by ensuring that the heights of the two subtrees of every node differ by", "at most 1",
    ["exactly 0", "at most 2", "at least 1"], "The balance factor of every node is -1, 0 or 1; rotations restore this after insertions and deletions.")
mcq(S, "Trees", "hard", "The height of a complete binary tree with n nodes is", "floor(log2 n)",
    ["n", "floor(n / 2)", "n - 1"], "Each level doubles the node count, so the height (counting edges) is floor(log2 n).")
mcq(S, "Graphs", "easy", "Which traversal uses a queue?", "Breadth-first search",
    ["Depth-first search", "Inorder traversal", "Topological sort using recursion only"], "BFS explores in layers using a FIFO queue.")
num(S, "Graphs", "medium", "A complete undirected graph on 6 vertices has how many edges?", 6 * 5 // 2,
    "n(n - 1) / 2 = 6 x 5 / 2 = 15.")
mcq(S, "Graphs", "medium", "The adjacency-matrix representation of a graph with V vertices uses", "O(V squared) space",
    ["O(V + E) space", "O(E) space", "O(V) space"], "A V x V matrix is stored regardless of the number of edges.")
mcq(S, "Hashing", "medium", "Which technique resolves a hash collision by storing colliding keys in a list attached to the bucket?", "Separate chaining",
    ["Linear probing", "Double hashing", "Rehashing"], "Chaining keeps a list per bucket. The others are open-addressing schemes that probe other slots.")
mcq(S, "Hashing", "hard", "With linear probing, the problem of long runs of occupied slots is called", "primary clustering",
    ["secondary clustering", "chaining", "rehashing"], "Keys that hash near each other form growing clusters that make later insertions slower.")
mcq(S, "Heaps", "medium", "The time to build a binary heap from n unsorted elements by the bottom-up method is", "O(n)",
    ["O(n log n)", "O(log n)", "O(n squared)"], "Most nodes sit near the leaves and sift down only a few levels, which sums to a linear bound.")
mcq(S, "Heaps", "medium", "In a max-heap stored in an array with the root at index 1, the parent of the node at index i is at", "floor(i / 2)",
    ["2i", "2i + 1", "i - 1"], "Children of i are 2i and 2i + 1, so the parent is floor(i / 2).")

# ═════════════════════════════════ ALGORITHMS ═════════════════════════════════
S = "algorithms"
mcq(S, "Complexity analysis", "easy", "What is the worst-case time complexity of binary search on a sorted array of n elements?", "O(log n)",
    ["O(n)", "O(1)", "O(n log n)"], "Each comparison halves the search range.")
mcq(S, "Complexity analysis", "medium", "The recurrence T(n) = 2T(n/2) + n solves to", "O(n log n)",
    ["O(n)", "O(n squared)", "O(log n)"], "By the Master theorem (a = 2, b = 2, f(n) = n), the work is balanced across log n levels: Theta(n log n).")
mcq(S, "Complexity analysis", "medium", "Which of the following is the tightest bound for the loop: for (i = 1; i < n; i = i * 2) { }", "O(log n)",
    ["O(n)", "O(sqrt n)", "O(n log n)"], "i doubles each iteration, so the loop runs about log2 n times.")
mcq(S, "Sorting and searching", "medium", "Which sorting algorithm has a worst-case time of O(n log n) and is stable?", "Merge sort",
    ["Quick sort", "Heap sort", "Selection sort"], "Merge sort is always O(n log n) and stable. Quick sort has an O(n squared) worst case and heap sort is not stable.")
mcq(S, "Sorting and searching", "medium", "The best-case time of insertion sort (already sorted input) is", "O(n)",
    ["O(n log n)", "O(n squared)", "O(1)"], "Each element needs only one comparison to find its place.")
num(S, "Sorting and searching", "medium", "For the array [5, 2, 4, 6, 1, 3], the number of inversions (pairs i < j with a[i] > a[j]) is", 9,
    "Pairs: (5,2),(5,4),(5,1),(5,3),(2,1),(4,1),(4,3),(6,1),(6,3) = 9.")
mcq(S, "Sorting and searching", "hard", "In quick sort, choosing the first element as the pivot on an already sorted array leads to", "O(n squared) time",
    ["O(n log n) time", "O(n) time", "incorrect output"], "Each partition removes only one element, giving n levels of work: quadratic.")
mcq(S, "Divide and conquer", "medium", "Which of the following is a divide-and-conquer algorithm?", "Merge sort",
    ["Insertion sort", "Bubble sort", "Dijkstra's algorithm"], "Merge sort splits the array, sorts each half recursively and merges.")
mcq(S, "Divide and conquer", "medium", "Strassen's algorithm multiplies two n x n matrices in about", "O(n^2.81)",
    ["O(n^2)", "O(n^3)", "O(n log n)"], "It uses 7 multiplications instead of 8 per block, giving O(n^log2 7), about O(n^2.81).")
mcq(S, "Greedy", "medium", "Which of the following problems is solved optimally by a greedy algorithm?", "Fractional knapsack",
    ["0/1 knapsack", "Longest common subsequence", "Matrix chain multiplication"], "Taking items by value-to-weight ratio is optimal when fractions are allowed; 0/1 knapsack needs dynamic programming.")
mcq(S, "Greedy", "medium", "Kruskal's algorithm builds a minimum spanning tree by", "adding the cheapest edge that does not form a cycle",
    ["adding the cheapest edge from the tree to a new vertex", "removing the costliest edge of each cycle only after sorting vertices", "running BFS from every vertex"], "It sorts edges by weight and uses union-find to skip any edge that connects two vertices already in the same tree.")
num(S, "Greedy", "hard", "Edges of a graph on 4 vertices: AB = 1, AC = 4, BC = 2, BD = 6, CD = 3. The weight of its minimum spanning tree is", 1 + 2 + 3,
    "Kruskal: take AB (1), BC (2), CD (3); the tree has 3 edges, total 6.")
mcq(S, "Dynamic programming", "medium", "Dynamic programming is applicable when a problem has", "overlapping subproblems and optimal substructure",
    ["only independent subproblems", "no recursive structure", "a greedy choice property only"], "Storing the answers of repeated subproblems is what saves the exponential recomputation.")
num(S, "Dynamic programming", "medium", "The length of the longest common subsequence of ABCBDAB and BDCABA is", 4,
    "One LCS is BCBA (also BDAB), of length 4.")
num(S, "Dynamic programming", "medium", "The number of distinct ways to climb 6 stairs taking 1 or 2 steps at a time is", 13,
    "ways(n) = ways(n-1) + ways(n-2) with ways(1) = 1 and ways(2) = 2: 1, 2, 3, 5, 8, 13.")
mcq(S, "Graph algorithms", "medium", "Dijkstra's algorithm may give wrong answers when the graph has", "negative edge weights",
    ["cycles", "multiple edges", "more than 100 vertices"], "A settled vertex is assumed final; a negative edge could later give it a shorter path.")
mcq(S, "Graph algorithms", "medium", "The time complexity of Floyd-Warshall for all-pairs shortest paths on V vertices is", "O(V cubed)",
    ["O(V squared)", "O(V log V)", "O(V + E)"], "Three nested loops over V vertices.")

# ═════════════════════════════════ COMPUTER ORGANIZATION ═════════════════════════════════
S = "computer_organization"
num(S, "Number systems and arithmetic", "easy", "The decimal value of the binary number 101101 is", 0b101101,
    "32 + 8 + 4 + 1 = 45.")
num(S, "Number systems and arithmetic", "medium", "In 8-bit two's complement, the decimal value of 11111010 is", -6,
    "Invert: 00000101, add 1: 00000110 = 6, so the value is -6.")
mcq(S, "Number systems and arithmetic", "medium", "The range of integers representable in n-bit two's complement is", "-2^(n-1) to 2^(n-1) - 1",
    ["-2^(n-1) + 1 to 2^(n-1) - 1", "0 to 2^n - 1", "-2^n to 2^n - 1"], "One extra negative value exists because zero has a single representation.")
mcq(S, "Instruction cycle and pipelining", "medium", "In a k-stage pipeline with no stalls, n instructions take about", "k + n - 1 cycles",
    ["k x n cycles", "n cycles", "k cycles"], "The first instruction needs k cycles; each following one completes one cycle later.")
num(S, "Instruction cycle and pipelining", "medium", "A 5-stage pipeline executes 100 instructions without stalls. The number of clock cycles needed is", 5 + 100 - 1,
    "k + n - 1 = 5 + 99 = 104 cycles.", "cycles")
mcq(S, "Instruction cycle and pipelining", "medium", "A data hazard of the read-after-write type is usually reduced by", "forwarding (bypassing)",
    ["increasing the clock speed", "adding more registers only", "removing the cache"], "Forwarding routes a result from a later pipeline stage straight to the instruction that needs it, avoiding a stall.")
mcq(S, "Memory hierarchy and cache", "easy", "Which memory level is the fastest?", "Registers",
    ["L2 cache", "Main memory", "Disk"], "Registers sit inside the CPU and are the fastest storage in the hierarchy.")
num(S, "Memory hierarchy and cache", "medium", "Cache access time is 2 ns, hit ratio 90 %, and main memory access time is 100 ns. The average memory access time (ns) is", 0.9 * 2 + 0.1 * (2 + 100),
    "0.9 x 2 + 0.1 x 102 = 12 ns.", "ns", 0.01)
num(S, "Memory hierarchy and cache", "hard", "A direct-mapped cache has 64 lines and a block size of 16 bytes. The number of bits in the index field of an address is", 6,
    "64 lines = 2^6, so 6 index bits (4 offset bits for 16-byte blocks).", "bits")
mcq(S, "Memory hierarchy and cache", "medium", "A write-through cache policy", "writes data to both the cache and main memory on every write",
    ["writes to main memory only when a line is evicted", "never writes to main memory", "writes only to the cache"], "Write-through keeps memory consistent at the cost of more memory traffic; write-back delays the write until eviction.")
mcq(S, "I/O organization", "medium", "In a computer system, DMA is used to", "transfer blocks of data between memory and a device without CPU involvement for every byte",
    ["speed up the CPU clock", "increase the cache size", "translate virtual addresses"], "A DMA controller moves data directly and interrupts the CPU only when the transfer completes.")
mcq(S, "I/O organization", "easy", "In computer organization, an interrupt is", "a signal that makes the CPU suspend its current work to service an event",
    ["a kind of memory", "a type of instruction format", "a program loaded at boot"], "On an interrupt the CPU saves its state, runs a handler and then resumes.")

# ═════════════════════════════════ THEORY OF COMPUTATION ═════════════════════════════════
S = "theory_of_computation"
mcq(S, "Finite automata and regular expressions", "medium", "Which of the following languages is regular?", "strings over {a, b} that end with 'ab'",
    ["a^n b^n for n >= 0", "palindromes over {a, b}", "strings with equal numbers of a and b"], "A DFA can remember the last two symbols. The other languages need unbounded counting or memory.")
num(S, "Finite automata and regular expressions", "medium", "The minimum number of states in a DFA that accepts binary strings divisible by 3 is", 3,
    "States track the remainder 0, 1 or 2 of the value read so far, so three states are enough and necessary.")
mcq(S, "Finite automata and regular expressions", "medium", "Every NFA can be converted to an equivalent DFA; in the worst case the DFA has", "2^n states for an n-state NFA",
    ["n squared states", "n states", "n + 1 states"], "The subset construction can produce up to 2^n subsets of the NFA's states.")
mcq(S, "Finite automata and regular expressions", "medium", "The regular expression (a + b)* a (a + b)* describes strings that", "contain at least one a",
    ["end with a", "contain exactly one a", "start with a"], "Any prefix, then an a, then any suffix: every string with at least one a.")
mcq(S, "Context-free grammars and PDA", "medium", "The language { a^n b^n : n >= 0 } is", "context-free but not regular",
    ["regular", "not context-free", "recursively enumerable only"], "A pushdown automaton can match the counts using its stack; no finite automaton can count unboundedly.")
mcq(S, "Context-free grammars and PDA", "hard", "Which of the following is NOT closed under intersection?", "context-free languages",
    ["regular languages", "recursive languages", "recursively enumerable languages"], "The intersection of two CFLs can be non-context-free, for example { a^n b^n c^n } = { a^n b^n c^m } intersect { a^m b^n c^n }.")
mcq(S, "Context-free grammars and PDA", "medium", "A grammar is ambiguous if", "some string has more than one parse tree",
    ["it has more than one production", "it generates an infinite language", "it contains a recursive rule"], "Two distinct leftmost derivations (or parse trees) for one string make the grammar ambiguous.")
mcq(S, "Turing machines and decidability", "medium", "The halting problem is", "undecidable",
    ["decidable in polynomial time", "decidable in exponential time", "decidable only for finite inputs"], "Turing proved no algorithm can decide, for every program and input, whether the program halts.")
mcq(S, "Turing machines and decidability", "hard", "A language is recursive (decidable) if", "some Turing machine halts on every input and accepts exactly its strings",
    ["some Turing machine accepts it but may loop on non-members", "it is regular", "its complement is empty"], "Recursively enumerable languages only need acceptance; recursive languages need a decider that always halts.")
mcq(S, "Turing machines and decidability", "medium", "Which of these classes is the most powerful?", "Recursively enumerable languages",
    ["Regular languages", "Context-free languages", "Context-sensitive languages"], "The Chomsky hierarchy: regular < context-free < context-sensitive < recursively enumerable.")
mcq(S, "Compiler phases", "easy", "Which phase of a compiler groups characters into tokens?", "Lexical analysis",
    ["Syntax analysis", "Semantic analysis", "Code generation"], "The scanner reads characters and produces tokens such as identifiers, keywords and operators.")
mcq(S, "Compiler phases", "medium", "A parser that builds the parse tree from the root down, using one token of lookahead, is", "LL(1)",
    ["LR(0)", "SLR(1)", "LALR(1)"], "LL parsers scan Left to right producing a Leftmost derivation (top-down). LR family parsers are bottom-up.")
mcq(S, "Compiler phases", "medium", "Type checking is usually performed during", "semantic analysis",
    ["lexical analysis", "code generation", "linking"], "After the syntax tree is built, the compiler checks that operations are applied to compatible types.")
mcq(S, "Compiler phases", "hard", "Which optimisation replaces the expression 3 * 4 by 12 at compile time?", "constant folding",
    ["dead-code elimination", "loop unrolling", "strength reduction"], "Constant folding evaluates constant expressions during compilation.")

# ═════════════════════════════════ SOFTWARE ENGINEERING ═════════════════════════════════
S = "software_engineering"
mcq(S, "SDLC models", "easy", "In which model are the phases completed one after another with little going back?", "Waterfall model",
    ["Spiral model", "Agile", "Prototyping"], "Waterfall is strictly sequential: requirements, design, implementation, testing and maintenance.")
mcq(S, "SDLC models", "medium", "The Spiral model is best known for emphasising", "risk analysis in each iteration",
    ["no documentation", "a single release at the end", "fixed requirements"], "Each loop of the spiral plans, analyses risks, builds and evaluates.")
mcq(S, "SDLC models", "medium", "In Scrum, the person responsible for maximising the value of the product and managing the backlog is the", "Product Owner",
    ["Scrum Master", "Development Team", "Project Sponsor"], "The Product Owner orders the product backlog; the Scrum Master coaches the process.")
mcq(S, "Requirements and UML", "medium", "Which of the following is a non-functional requirement?", "The page must load within two seconds",
    ["A user can reset a password", "The system shall send an invoice by email", "An admin can add a product"], "Performance, security and usability are qualities of how the system behaves, not what it does.")
mcq(S, "Requirements and UML", "medium", "Which UML diagram shows the interactions between objects ordered in time?", "Sequence diagram",
    ["Class diagram", "Use case diagram", "Component diagram"], "A sequence diagram shows messages between lifelines along a time axis.")
mcq(S, "Requirements and UML", "easy", "A use case diagram models", "the actors and what they can do with the system",
    ["the database tables", "the order of method calls", "the deployment hardware"], "Use cases describe goals that external actors achieve using the system.")
mcq(S, "Testing", "easy", "Testing individual functions or classes in isolation is called", "unit testing",
    ["integration testing", "acceptance testing", "system testing"], "Unit tests check the smallest testable parts, usually written by developers.")
mcq(S, "Testing", "medium", "Boundary value analysis is a technique of", "black-box testing",
    ["white-box testing", "static analysis only", "performance monitoring"], "It selects inputs at and next to the edges of input ranges, using only the specification.")
num(S, "Testing", "medium", "A function accepts an integer from 1 to 100. Using boundary value analysis (min - 1, min, min + 1, max - 1, max, max + 1), the number of test inputs is", 6,
    "0, 1, 2, 99, 100, 101: six test inputs.")
mcq(S, "Testing", "medium", "Statement coverage of 100 % means", "every statement was executed at least once by the tests",
    ["every branch was taken both ways", "every path was executed", "there are no bugs left"], "Statement coverage is the weakest of the structural measures; branch and path coverage are stronger and still do not prove correctness.")
mcq(S, "Maintenance and metrics", "medium", "Cyclomatic complexity of a function measures", "the number of independent paths through the code",
    ["the number of lines of code", "the number of comments", "the memory used at run time"], "V(G) = E - N + 2P, or decisions + 1 for a single function; higher values mean harder testing.")
mcq(S, "Maintenance and metrics", "hard", "Changing software to make it easier to understand without changing its behaviour is called", "refactoring",
    ["regression testing", "reverse engineering", "adaptive maintenance"], "Refactoring improves structure while preserving external behaviour, ideally protected by tests.")

# ═════════════════════════════════ DISCRETE MATHEMATICS ═════════════════════════════════
S = "discrete_math"
mcq(S, "Logic and sets", "easy", "The negation of the statement 'for all x, P(x)' is", "there exists an x such that not P(x)",
    ["for all x, not P(x)", "there exists an x such that P(x)", "not for all x, not P(x)"], "De Morgan for quantifiers: not (forall x P) is equivalent to (exists x not P).")
mcq(S, "Logic and sets", "medium", "The proposition p -> q is logically equivalent to", "not p or q",
    ["p or not q", "not p and q", "p and not q"], "An implication is false only when p is true and q is false, exactly when 'not p or q' is false.")
num(S, "Logic and sets", "medium", "A set has 5 elements. The number of its subsets is", 2 ** 5,
    "Each element is either in or out: 2^5 = 32.")
num(S, "Counting and combinatorics", "easy", "The number of ways to arrange the letters of the word LEVEL is", math.factorial(5) // (math.factorial(2) * math.factorial(2)),
    "5! / (2! for the two L's x 2! for the two E's) = 120 / 4 = 30.")
num(S, "Counting and combinatorics", "medium", "A committee of 3 is chosen from 8 people. The number of ways is", math.comb(8, 3),
    "C(8, 3) = 56.")
mcq(S, "Counting and combinatorics", "medium", "Among any 13 people, the pigeonhole principle guarantees that at least two were born in the same", "month of the year",
    ["calendar year", "day of the month", "week of the year"], "13 people into 12 months forces a repeat. The other attributes have far more than 13 possible values, so no repeat is guaranteed.")
num(S, "Graph theory basics", "medium", "A tree has 10 vertices. The number of its edges is", 9,
    "A tree on n vertices has n - 1 edges.")
mcq(S, "Graph theory basics", "medium", "A graph has an Eulerian circuit if and only if it is connected and", "every vertex has even degree",
    ["every vertex has odd degree", "it has no cycles", "it has exactly two vertices of odd degree"], "Euler's theorem: even degrees everywhere (exactly two odd vertices gives an Eulerian path, not a circuit).")
num(S, "Graph theory basics", "hard", "The chromatic number of a cycle on 5 vertices is", 3,
    "An odd cycle cannot be 2-coloured, but three colours suffice.")
mcq(S, "Probability", "easy", "Two fair coins are tossed. The probability of getting exactly one head is", "1/2",
    ["1/4", "1/3", "3/4"], "Outcomes HT and TH out of four equally likely outcomes: 2/4 = 1/2.")
num(S, "Probability", "medium", "Two fair dice are rolled. The probability (as a decimal) that the sum is 7 is", round(6 / 36, 4),
    "Six ordered pairs give sum 7 out of 36: 1/6 = 0.1667.", None, 0.001)
mcq(S, "Probability", "medium", "If A and B are independent events with P(A) = 0.3 and P(B) = 0.5, then P(A and B) is", "0.15",
    ["0.8", "0.2", "0.35"], "For independent events the probability of both is the product: 0.3 x 0.5 = 0.15.")


# ═════════════════════════════════ validate and write ═════════════════════════════════
def validate():
    errors = []
    seen = set()
    for q in QUESTIONS:
        if q["external_id"] in seen:
            errors.append("duplicate id " + q["external_id"])
        seen.add(q["external_id"])
        if q["subject"] not in SUBJECTS:
            errors.append("unknown subject " + q["subject"])
        if q["type"] == "mcq_single":
            opts = [q["option_" + c] for c in "abcd"]
            if len(set(opts)) != 4:
                errors.append("duplicate options in " + q["external_id"])
            if q["correct"] not in "ABCD":
                errors.append("bad key in " + q["external_id"])
        else:
            if q["numeric_min"] > q["numeric_max"]:
                errors.append("inverted range in " + q["external_id"])
        if not q["explanation"].strip():
            errors.append("no explanation " + q["external_id"])
    return errors


if __name__ == "__main__":
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "backend", "database", "data", "domain_questions", "cse.json")
    out = os.path.normpath(out)
    problems = validate()
    if problems:
        print("\n".join(problems))
        sys.exit(1)
    with open(out, "w", encoding="utf-8") as f:
        json.dump(QUESTIONS, f, ensure_ascii=False, indent=1)
    by_subject = {}
    for q in QUESTIONS:
        by_subject[q["subject"]] = by_subject.get(q["subject"], 0) + 1
    letters = {}
    for q in QUESTIONS:
        if q["type"] == "mcq_single":
            letters[q["correct"]] = letters.get(q["correct"], 0) + 1
    print("wrote %d questions to %s" % (len(QUESTIONS), out))
    print(by_subject)
    print("answer letters:", letters)
    bar = sum(1 for v in by_subject.values() if v >= 15)
    print("go-live bar: total %d (>=150), subjects with >=15: %d (>=4)" % (len(QUESTIONS), bar))
