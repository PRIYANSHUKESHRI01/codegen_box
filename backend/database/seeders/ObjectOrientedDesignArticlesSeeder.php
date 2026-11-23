<?php

namespace Database\Seeders;

use App\Models\Article;
use App\Models\ArticleTopic;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Seeds the 10-article curriculum for Object-Oriented Design & Design Patterns.
 * Idempotent (updateOrCreate by slug).
 */
class ObjectOrientedDesignArticlesSeeder extends Seeder
{
    public function run(): void
    {
        $topic = ArticleTopic::where('slug', 'object-oriented-design')->first();

        if (! $topic) {
            $this->command?->error("Object-Oriented Design & Design Patterns article topic not found. Run ArticleTopicSeeder first.");
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
                'slug' => 'solid-principles-in-practice-production-refactorings',
                'title' => 'SOLID Principles in Practice: From Textbook Definitions to Production Refactoring',
                'excerpt' => 'SOLID is often recited as dry theory for interview exams. Analyze each of the 5 principles with concrete before-and-after refactorings, showing how Single Responsibility, Open-Closed, and Dependency Inversion prevent fragile spaghetti codebases.',
                'display_order' => 1,
                'content' => $this->solidPrinciplesInPracticeProductionRefactoringsArticle(),
            ],
            [
                'slug' => 'creational-patterns-factory-abstract-factory-builder',
                'title' => 'Creational Patterns: Factory Method, Abstract Factory, and Fluent Builder',
                'excerpt' => 'Directly calling new MyClass() couples your business logic to concrete implementations. Master the Factory Method, Abstract Factory families, and the Fluent Builder pattern for complex object graphs.',
                'display_order' => 2,
                'content' => $this->creationalPatternsFactoryAbstractFactoryBuilderArticle(),
            ],
            [
                'slug' => 'singleton-pattern-thread-safety-and-anti-patterns',
                'title' => 'The Singleton Pattern: Thread Safety, Double-Checked Locking, and Pitfalls',
                'excerpt' => 'Singleton is the simplest pattern to draw on a whiteboard and the most abused in production. Explore thread-safe lazy initialization, double-checked locking, reflection attacks, and why singletons ruin unit testing.',
                'display_order' => 3,
                'content' => $this->singletonPatternThreadSafetyAndAntiPatternsArticle(),
            ],
            [
                'slug' => 'structural-patterns-adapter-facade-decorator',
                'title' => 'Structural Patterns: Adapter, Facade, and Decorator in Real-World Codebases',
                'excerpt' => 'How do you make incompatible interfaces work together without rewriting legacy code? Compare the Adapter (interface translator), Facade (simplified interface), and Decorator (runtime behavior extension).',
                'display_order' => 4,
                'content' => $this->structuralPatternsAdapterFacadeDecoratorArticle(),
            ],
            [
                'slug' => 'proxy-pattern-and-dynamic-proxies-in-aop',
                'title' => 'The Proxy Pattern and Dynamic Proxies in Aspect-Oriented Programming',
                'excerpt' => 'A Proxy controls access to an underlying object, adding lazy initialization, caching, logging, or security checks. Discover virtual proxies, protection proxies, and how dynamic proxies power Spring, Hibernate, and NestJS.',
                'display_order' => 5,
                'content' => $this->proxyPatternAndDynamicProxiesInAopArticle(),
            ],
            [
                'slug' => 'behavioral-patterns-strategy-vs-state-pattern',
                'title' => 'Behavioral Patterns: Strategy vs. State Pattern (Decoupling State Machines)',
                'excerpt' => 'Strategy and State share identical UML class diagrams, but solve completely opposite problems. Learn how Strategy swaps interchangeable algorithms, how State encapsulates lifecycle transitions, and how to eliminate 20-case switch statements.',
                'display_order' => 6,
                'content' => $this->behavioralPatternsStrategyVsStatePatternArticle(),
            ],
            [
                'slug' => 'observer-and-pub-sub-patterns-event-decoupling',
                'title' => 'Observer and Pub-Sub Patterns: Decoupling Event Producers from Consumers',
                'excerpt' => 'Synchronous method calls create tight coupling. Compare the in-memory Observer pattern (direct subject-to-observer callbacks) against the decoupled architectural Publish-Subscribe pattern with event brokers.',
                'display_order' => 7,
                'content' => $this->observerAndPubSubPatternsEventDecouplingArticle(),
            ],
            [
                'slug' => 'command-pattern-undo-redo-and-transactional-queues',
                'title' => 'Command Pattern: Implementing Undo/Redo and Transactional Action Queues',
                'excerpt' => 'Turning method calls into first-class objects. Learn how the Command pattern encapsulates actions, receivers, and parameters into executable units, enabling undo/redo stacks and deferred job queues.',
                'display_order' => 8,
                'content' => $this->commandPatternUndoRedoAndTransactionalQueuesArticle(),
            ],
            [
                'slug' => 'domain-driven-design-entities-value-objects-aggregates',
                'title' => 'Domain-Driven Design (DDD) Basics: Entities, Value Objects, and Aggregates',
                'excerpt' => 'Move beyond naive CRUD database modeling to true domain architecture. Master the fundamental building blocks of Eric Evans\' Domain-Driven Design: Entities with identities, immutable Value Objects, Aggregate Roots, and Repositories.',
                'display_order' => 9,
                'content' => $this->domainDrivenDesignEntitiesValueObjectsAggregatesArticle(),
            ],
            [
                'slug' => 'lld-case-study-rate-limiter-and-parking-lot',
                'title' => 'Low-Level Design (LLD) Case Study: Designing an In-Memory Rate Limiter and Parking Lot',
                'excerpt' => 'A complete, production-grade Low-Level Design (LLD) interview solution. Walk through object-oriented class modeling, design pattern selection, concurrency thread safety, and extensibility for classic interview challenges.',
                'display_order' => 10,
                'content' => $this->lldCaseStudyRateLimiterAndParkingLotArticle(),
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

    private function solidPrinciplesInPracticeProductionRefactoringsArticle(): string
    {
        return <<<'MARKDOWN'
The SOLID principles, introduced by Robert C. Martin ("Uncle Bob"), are the bedrock guidelines of clean object-oriented architecture. When followed, codebases remain modular, easily testable, and resilient to feature requests; when ignored, codebases degenerate into tightly coupled "god classes" where a bug fix in billing breaks user authentication.

---

## 1. Single Responsibility Principle (SRP)

> **"A class should have one, and only one, reason to change."**

### The Violation (God Class):
```typescript
class UserService {
    registerUser(email: string, pass: string) {
        // 1. Validate email format
        // 2. Hash password
        // 3. Insert into MySQL database
        // 4. Format HTML welcome email
        // 5. Send via SMTP server
    }
}
```
This class has **4 distinct reasons to change**: database schema changes, SMTP provider migration, password hashing algorithm updates, or email template tweaks.

### The Refactoring:
Extract dedicated domain services: `UserRepository` (data persistence), `PasswordHasher` (cryptography), and `NotificationService` (email delivery).

---

## 2. Open-Closed Principle (OCP)

> **"Software entities should be open for extension, but closed for modification."**

You should be able to introduce new behavior without touching or modifying existing, tested source code.

### The Fix via Polymorphism:
Instead of a gigantic `switch (paymentMethod)` statement that must be edited every time a new provider is added:
```typescript
interface PaymentGateway {
    process(amount: number): Promise<PaymentReceipt>;
}

class StripeGateway implements PaymentGateway { ... }
class PayPalGateway implements PaymentGateway { ... }
class ApplePayGateway implements PaymentGateway { ... }
```
Adding `CryptoGateway` simply requires authoring a new class that implements `PaymentGateway` without modifying a single line of existing checkout logic!

---

## 3. Liskov Substitution Principle (LSP)

> **"Subtypes must be substitutable for their base types without altering program correctness."**

The classic violation is `Square extends Rectangle`. If a client function sets `width = 5` and `height = 10`, a true rectangle has area 50, but a square overwrites its side to 10, producing area 100 and breaking the caller's contract!

---

## 4. Interface Segregation Principle (ISP)

> **"Clients should not be forced to depend upon methods they do not use."**

Prefer many small, cohesive interfaces over a single bloated interface. A `Worker` interface with `code()`, `eatLunch()`, and `fileTaxes()` forces a `RobotWorker` class to implement dummy `eatLunch()` methods that throw exceptions. Split into `Workable` and `Feedable`.

---

## 5. Dependency Inversion Principle (DIP)

> **"High-level modules should not depend on low-level modules. Both should depend on abstractions."**

High-level business rules should never instantiate a concrete `MySQLDatabase` directly via `new`. They must accept a `DatabaseInterface` via **Dependency Injection (DI)**, allowing unit tests to effortlessly swap in an in-memory mock repository.

---

## Key Takeaways

1. SRP eliminates fragile god-classes by isolating reasons to change.
2. OCP leverages interfaces to add new features without mutating existing code.
3. DIP decouples business logic from external frameworks via Dependency Injection.
MARKDOWN;
    }

    private function creationalPatternsFactoryAbstractFactoryBuilderArticle(): string
    {
        return <<<'MARKDOWN'
Object creation seems trivial until object initialization requires complex parameter validation, conditional configuration, or assembly of nested dependencies. Directly invoking `new Order(...)` scatters instantiation logic throughout your codebase.

**Creational Design Patterns** abstract the instantiation process, making systems independent of how their objects are created, composed, and represented.

---

## 1. Factory Method Pattern

Defines an interface for creating an object, but lets subclasses decide which class to instantiate:

```typescript
abstract class Dialog {
    // The Factory Method:
    abstract createButton(): Button;

    render() {
        const okButton = this.createButton();
        okButton.onClick(() => this.close());
        okButton.paint();
    }
}

class WindowsDialog extends Dialog {
    createButton(): Button { return new WindowsButton(); }
}

class MacDialog extends Dialog {
    createButton(): Button { return new MacButton(); }
}
```

The core `render()` logic is written entirely against the abstract `Button` interface, completely decoupled from OS-specific rendering!

---

## 2. Abstract Factory Pattern

Provides an interface for creating **families of related or dependent objects** without specifying their concrete classes.
For example, a UI toolkit must generate matching sets of widgets:
- `WindowsFactory`: creates `WindowsButton`, `WindowsScrollbar`, `WindowsCheckbox`.
- `MacFactory`: creates `MacButton`, `MacScrollbar`, `MacCheckbox`.

Using an Abstract Factory guarantees that an application never accidentally pairs a Windows Button with a Mac Scrollbar.

---

## 3. The Fluent Builder Pattern

When an object has 10+ configurable parameters, using a constructor with 10 arguments creates the dreaded **Telescoping Constructor Anti-pattern**:
```typescript
// Horrible readability, error-prone parameter ordering:
new HttpRequest("GET", "https://api.com", null, 5000, true, "gzip", headers, null, 3);
```

The Builder pattern constructs complex objects step-by-step using a clean, fluent API:

```typescript
const request = new HttpRequestBuilder()
    .setMethod("GET")
    .setUrl("https://api.com")
    .setTimeout(5000)
    .enableGzip()
    .withHeader("Authorization", "Bearer token")
    .build();
```

---

## Key Takeaways

1. Use Factory Method when a class cannot anticipate the class of objects it must create.
2. Use Abstract Factory when a system must configure families of matching products.
3. Use the Builder pattern to construct complex objects with readable, self-documenting method chains.
MARKDOWN;
    }

    private function singletonPatternThreadSafetyAndAntiPatternsArticle(): string
    {
        return <<<'MARKDOWN'
The **Singleton Pattern** ensures that a class has only one instance and provides a global point of access to it. It is commonly used for database connection pools, hardware drivers, and logging managers.

However, in modern software engineering, Singleton is widely regarded as an **anti-pattern** when misused as a glorified global variable.

---

## 1. Thread-Safe Lazy Initialization: Double-Checked Locking

In multi-threaded environments (Java, C++, C#), a naive lazy singleton suffers from race conditions where two threads enter `getInstance()` simultaneously and instantiate two separate objects.

The **Double-Checked Locking** idiom provides thread safety with zero locking overhead after initialization:

```java
public class DatabaseConnection {
    // volatile prevents CPU instruction reordering!
    private static volatile DatabaseConnection instance;

    private DatabaseConnection() {} // Private constructor prevents new

    public static DatabaseConnection getInstance() {
        if (instance == null) { // First Check (No Lock)
            synchronized (DatabaseConnection.class) {
                if (instance == null) { // Second Check (With Lock)
                    instance = new DatabaseConnection();
                }
            }
        }
        return instance;
    }
}
```

> **Why `volatile` is mandatory:** In modern CPU architectures, the instruction `instance = new DatabaseConnection()` can be reordered by the compiler into:
> 1. Allocate memory.
> 2. Assign pointer to `instance`.
> 3. Call constructor.
> Without `volatile`, a second thread could see a non-null `instance` whose constructor has **not finished executing**, crashing when reading uninitialized fields!

---

## 2. Why Singletons Are Problematic in Production

1. **Destroys Unit Testing:** Singletons introduce global mutable state across test suites. Test A mutates the singleton; Test B fails mysteriously due to polluted state.
2. **Hidden Dependencies:** When a function calls `DatabaseConnection.getInstance()` internally, its dependencies are hidden from the caller, violating the Dependency Inversion Principle.
3. **Classloader / Multi-Tenant Leaks:** In modern containerized or serverless runtimes, multiple classloaders can spawn multiple singleton instances.

### The Modern Alternative:
Create a single instance at application startup and pass it down via **Dependency Injection**.

---

## Key Takeaways

1. Lazy-loaded singletons require double-checked locking and `volatile` memory barriers.
2. Prefer Dependency Injection over global Singletons to preserve testability.
MARKDOWN;
    }

    private function structuralPatternsAdapterFacadeDecoratorArticle(): string
    {
        return <<<'MARKDOWN'
Structural design patterns explain how to assemble objects and classes into larger structures while keeping these structures flexible and efficient.

Among the 7 structural patterns, **Adapter**, **Facade**, and **Decorator** are the workhorses of real-world enterprise architectures.

---

## 1. The Adapter Pattern: The Translator

The Adapter converts the interface of a class into another interface that clients expect. It acts like a foreign travel plug adapter:

```typescript
// What your application expects:
interface ModernPaymentProcessor {
    charge(amountInCents: number, currency: string): Promise<boolean>;
}

// Third-party legacy vendor SDK:
class LegacyPayPalSDK {
    sendMoney(dollars: string): boolean { ... }
}

// The Adapter:
class PayPalAdapter implements ModernPaymentProcessor {
    constructor(private legacySDK: LegacyPayPalSDK) {}

    async charge(amountInCents: number, currency: string): Promise<boolean> {
        const dollars = (amountInCents / 100).toFixed(2);
        return this.legacySDK.sendMoney(dollars);
    }
}
```

---

## 2. The Facade Pattern: The Simplified Gateway

A Facade provides a clean, simplified interface to an intricate, complex subsystem of classes:
- Converting an MP4 video requires initializing audio decoders, video parsers, color space matrices, and container multiplexers.
- A `VideoConverterFacade` exposes a single friendly method:
  `convertVideo(filename, format)`.
- It shields callers from the internal complexity of 15 interacting subsystem classes.

---

## 3. The Decorator Pattern: Dynamic Behavior Wrapping

The Decorator attaches additional responsibilities to an object **dynamically at runtime** without modifying the original class. It relies on composition over inheritance:

```typescript
interface Notifier {
    send(message: string): void;
}

class EmailNotifier implements Notifier {
    send(msg: string) { console.log("Email: " + msg); }
}

// Base Decorator:
class NotifierDecorator implements Notifier {
    constructor(protected wrappee: Notifier) {}
    send(msg: string) { this.wrappee.send(msg); }
}

// Concrete Decorator adding SMS capability:
class SMSDecorator extends NotifierDecorator {
    send(msg: string) {
        super.send(msg);
        console.log("SMS: " + msg);
    }
}
```
Clients can wrap an `EmailNotifier` in an `SMSDecorator`, and wrap that in a `SlackDecorator`, producing multi-channel notifications dynamically!

---

## Key Takeaways

1. **Adapter** makes incompatible interfaces work together.
2. **Facade** simplifies a complex subsystem behind a single unified interface.
3. **Decorator** dynamically stacks new behaviors onto objects at runtime without subclassing.
MARKDOWN;
    }

    private function proxyPatternAndDynamicProxiesInAopArticle(): string
    {
        return <<<'MARKDOWN'
The **Proxy Pattern** provides a surrogate or placeholder for another object to control access to it. The proxy implements the **exact same interface** as the original service object, allowing it to masquerade as the genuine object seamlessly.

---

## 1. The 4 Common Types of Proxies

1. **Virtual Proxy (Lazy Initialization):** If an object is memory-heavy to instantiate (e.g., parsing a 500 MB 3D graphics model), the proxy delays creation until a method is actually invoked.
2. **Protection Proxy (Access Control):** Checks security permissions (e.g., verifying user roles) before forwarding calls to the underlying service.
3. **Remote Proxy (RPC / Stub):** Represents an object that lives on a remote server across the network (e.g., gRPC client stubs).
4. **Caching Proxy:** Caches operation results and returns cached values without invoking the expensive underlying service.

---

## 2. Dynamic Proxies in Enterprise Frameworks (AOP)

In modern enterprise frameworks (Spring Boot in Java, NestJS in TypeScript, SQLAlchemy in Python), you write simple annotated classes:
```java
@Transactional
@Secured("ROLE_ADMIN")
public void transferMoney(Account from, Account to, BigDecimal amount) { ... }
```
How does the framework automatically open a database transaction, verify security credentials, and roll back on error?

**Through Dynamic Proxies!**
The framework wraps your class in a runtime generated proxy:
1. Proxy intercepts the call.
2. Checks user permissions (`@Secured`).
3. Calls `db.beginTransaction()`.
4. Invokes your genuine `transferMoney()` method.
5. If no exception: `db.commit()`. If exception: `db.rollback()`.

This is **Aspect-Oriented Programming (AOP)**: separating cross-cutting concerns (transactions, security, logging) from core business logic using proxies.

---

## Key Takeaways

1. A Proxy shares the identical interface as the subject to intercept and control method execution.
2. Virtual proxies provide lazy loading; protection proxies enforce authorization.
3. Modern enterprise frameworks use dynamic proxies to power annotations and transactions.
MARKDOWN;
    }

    private function behavioralPatternsStrategyVsStatePatternArticle(): string
    {
        return <<<'MARKDOWN'
The **Strategy Pattern** and the **State Pattern** are two of the most popular behavioral design patterns. In fact, if you look at their UML class diagrams, they appear structurally identical: a Context class delegates execution to an interface reference.

Yet their architectural intent and runtime behavior are diametrically opposed.

---

## 1. The Strategy Pattern: Swapping Algorithms

The Strategy pattern defines a family of interchangeable algorithms, encapsulates each one, and makes them swappable at runtime:
- The client chooses which strategy to inject.
- Strategies typically **do not know about each other**.
- Strategies are stateless functions or algorithms (e.g., sorting algorithms, discount calculators, routing paths).

```typescript
interface RouteStrategy {
    calculateRoute(start: LatLng, end: LatLng): Route;
}

class DrivingStrategy implements RouteStrategy { ... }
class WalkingStrategy implements RouteStrategy { ... }
class TransitStrategy implements RouteStrategy { ... }

// Navigator delegates directly to the selected strategy:
navigator.setStrategy(new TransitStrategy());
```

---

## 2. The State Pattern: Finite State Machines

The State pattern allows an object to alter its behavior when its internal state changes. The object will appear to change its class:
- The states **know about each other and trigger transitions between states**.
- Eliminates giant, fragile `switch (status)` statements in order lifecycles:

```typescript
interface OrderState {
    pay(order: Order): void;
    cancel(order: Order): void;
    ship(order: Order): void;
}

class PendingPaymentState implements OrderState {
    pay(order: Order) {
        order.setState(new PaidState()); // Transitions to next state!
    }
    cancel(order: Order) {
        order.setState(new CancelledState());
    }
    ship(order: Order) {
        throw new Error("Cannot ship an unpaid order!");
    }
}
```

When an order moves from `PendingPaymentState` to `PaidState`, its behavior changes completely. Calling `cancel()` on a `PaidState` now issues a refund instead of a simple cancellation!

---

## Key Takeaways

1. **Strategy** is configured by the client to choose an algorithm (e.g., Sorting, Routing).
2. **State** changes dynamically as the internal state machine transitions (e.g., Draft -> Review -> Published).
3. Use the State pattern to decompose monolithic state-switch statements into clean, testable classes.
MARKDOWN;
    }

    private function observerAndPubSubPatternsEventDecouplingArticle(): string
    {
        return <<<'MARKDOWN'
When an event occurs in an application (e.g., a candidate completes a mock interview), multiple secondary actions must occur:
- Calculate score breakdown
- Send congratulatory email
- Update student readiness leaderboard
- Trigger Slack alert for campus recruiter

If the `MockInterviewController` directly calls all 4 services, it becomes tightly coupled to unrelated business modules.

---

## 1. The Classic Observer Pattern (GoF)

In the classic Observer pattern, the **Subject** maintains a list of **Observers**:
- Observers register themselves via `subject.subscribe(observer)`.
- When an event occurs, the Subject loops through its list and invokes `observer.notify(event)`.

```
[ Subject ] -- notify() --> [ Observer 1 (Email) ]
            -- notify() --> [ Observer 2 (Leaderboard) ]
```

### The Inherent Coupling in Observer:
While decoupled by interface, the Subject and Observer **must run in the same memory space** and execute **synchronously**. If Observer 1 takes 5 seconds, Observer 2 is stalled!

---

## 2. The Publish-Subscribe (Pub-Sub) Pattern

Pub-Sub introduces an independent **Event Bus / Message Broker** (e.g., Redis Pub/Sub, Kafka, RabbitMQ) between publishers and subscribers:

```
[ Publisher ]  ---> (Emits "InterviewCompleted") ---> [ Message Broker ]
                                                             |
            +------------------------------------------------+
            |
            +---> [ Subscriber 1: Analytics Worker ] (Server A)
            +---> [ Subscriber 2: Email Worker ]     (Server B)
```

### Key Differences:
- **Zero Mutual Awareness:** Publishers have zero knowledge of who (if anyone) is listening.
- **Asynchronous & Distributed:** Subscribers can run across different microservices, physical servers, or programming languages.

---

## Key Takeaways

1. Observer operates in-memory via direct callback registration on the subject.
2. Pub-Sub introduces a message broker, enabling cross-service asynchronous event streaming.
3. Always unregister in-memory observers in component unmount lifecycles to prevent memory leaks.
MARKDOWN;
    }

    private function commandPatternUndoRedoAndTransactionalQueuesArticle(): string
    {
        return <<<'MARKDOWN'
Traditional object-oriented programming invokes methods directly: `editor.insertText("hello")`. While straightforward, directly invoking methods means actions cannot be delayed, queued, serialized across a network, or undone.

The **Command Pattern** encapsulates a request as a standalone object containing all information needed to perform an action.

---

## 1. Anatomy of the Command Pattern

A Command consists of four key components:
1. **Command Interface:** Declares an `execute()` method and optionally an `undo()` method.
2. **Concrete Command:** Defines the binding between an action and a Receiver. Stores execution parameters and previous state.
3. **Receiver:** The business object that performs the actual heavy work (e.g., `Document`).
4. **Invoker:** Triggers the command (e.g., UI Button, Undo Manager).

```typescript
interface Command {
    execute(): void;
    undo(): void;
}

class PasteCommand implements Command {
    private previousText: string = "";

    constructor(private doc: Document, private textToPaste: string) {}

    execute(): void {
        this.previousText = this.doc.getText();
        this.doc.append(this.textToPaste);
    }

    undo(): void {
        this.doc.setText(this.previousText); // Restores exact previous state!
    }
}
```

---

## 2. Implementing an Undo/Redo Stack

With the Command pattern, building an undo/redo engine is straightforward:
- An **Undo Stack** stores executed commands.
- When the user presses `Ctrl+Z`, the invoker pops the top command from the Undo Stack, calls `command.undo()`, and pushes it onto the **Redo Stack**.
- When the user presses `Ctrl+Y`, the invoker pops from the Redo Stack and calls `command.execute()`.

---

## 3. Asynchronous Job Queues and Serialization

Because a Command encapsulates all parameters, it can be serialized to JSON and stored in a database or Redis queue:
```json
{
    "command": "SendTransactionalEmail",
    "params": { "userId": 1042, "template": "INVOICE" }
}
```
A worker daemon dequeues the record, reconstructs the Command object, and calls `execute()`.

---

## Key Takeaways

1. The Command pattern converts requests into first-class standalone objects.
2. Storing previous state inside commands makes multi-level Undo/Redo trivial.
3. Enables transactional job queues, macro recording, and deferred scheduling.
MARKDOWN;
    }

    private function domainDrivenDesignEntitiesValueObjectsAggregatesArticle(): string
    {
        return <<<'MARKDOWN'
When designing enterprise applications, teams often fall into the **Anemic Domain Model** trap: entities are treated as dumb database rows with getters and setters, while business rules are scattered across massive procedural service classes.

**Domain-Driven Design (DDD)**, pioneered by Eric Evans, centers software design on the complex business domain itself.

---

## 1. Entities vs. Value Objects

### Entity (Defined by Unique Identity)
An Entity has a distinct identity that runs through time and different states:
- A `User` with ID `42` remains the same user even if they change their name, email, and address.
- Two users with identical names and emails are **different entities** because their IDs differ.

### Value Object (Defined by Attributes, Strictly Immutable)
A Value Object has **no conceptual identity**; it is defined solely by its data attributes:
- A `Money` object representing `$50 USD` has no ID. Any `$50 USD` is completely interchangeable with any other `$50 USD`.
- **Value Objects are strictly immutable.** You cannot change the currency of a `$50 USD` object; you create a new Value Object.

```typescript
class Money {
    constructor(readonly amount: number, readonly currency: string) {
        if (amount < 0) throw new Error("Amount cannot be negative");
    }

    add(other: Money): Money {
        if (this.currency !== other.currency) throw new Error("Currency mismatch");
        return new Money(this.amount + other.amount, this.currency);
    }
}
```

---

## 2. Aggregates and the Aggregate Root

In complex business domains, objects form linked clusters: an `Order` contains multiple `OrderItem` objects, which reference `Product` items and a `ShippingAddress`.

An **Aggregate** is a cluster of associated domain objects treated as a single transactional unit:
- The **Aggregate Root** is the only member of the aggregate that external classes are allowed to hold references to.
- External classes cannot directly mutate an `OrderItem`. They must call methods on the `Order` root:
  `order.addItem(product, quantity)`.
- The Aggregate Root enforces all business invariants (e.g., maximum 10 items per order, total price non-negative) atomically.

---

## Key Takeaways

1. Entities are defined by identity; Value Objects are defined by attributes and are immutable.
2. Aggregates enforce transactional invariants within a single boundary.
3. External clients must interact only with the Aggregate Root.
MARKDOWN;
    }

    private function lldCaseStudyRateLimiterAndParkingLotArticle(): string
    {
        return <<<'MARKDOWN'
Low-Level Design (LLD) or Machine Coding interviews evaluate your ability to translate ambiguous requirements into clean, object-oriented code complete with class diagrams, interface design, design pattern selection, and thread safety.

Let's walk through an end-to-end solution for a classic LLD problem: **The Multi-Floor Parking Lot System**.

---

## 1. Requirements & Scope

- Support multiple vehicle types: Motorcycle, Compact Car, Large Truck.
- Multiple floors, each with dedicated parking spots sized for specific vehicle types.
- Multiple entry and exit gates.
- Dynamic fee calculation based on parking duration and vehicle type (Strategy pattern).
- Thread-safe spot allocation under concurrent entry gate traffic.

---

## 2. Class Hierarchy & Design Patterns

### Step 1: Vehicle and ParkingSpot Abstraction
```typescript
enum VehicleType { MOTORCYCLE, COMPACT, TRUCK }

abstract class Vehicle {
    constructor(readonly licensePlate: string, readonly type: VehicleType) {}
}

class Car extends Vehicle {
    constructor(plate: string) { super(plate, VehicleType.COMPACT); }
}

abstract class ParkingSpot {
    private currentVehicle: Vehicle | null = null;
    constructor(readonly id: string, readonly type: VehicleType) {}

    isAvailable(): boolean { return this.currentVehicle === null; }
    assignVehicle(v: Vehicle) { this.currentVehicle = v; }
    removeVehicle() { this.currentVehicle = null; }
}
```

### Step 2: The Fee Calculation Strategy
```typescript
interface PricingStrategy {
    calculateFee(hoursParked: number, type: VehicleType): number;
}

class StandardHourlyPricing implements PricingStrategy {
    calculateFee(hours: number, type: VehicleType): number {
        const rates = { [VehicleType.MOTORCYCLE]: 10, [VehicleType.COMPACT]: 20, [VehicleType.TRUCK]: 40 };
        return Math.ceil(hours) * rates[type];
    }
}
```

### Step 3: Thread-Safe Spot Assignment (Singleton / Mutex)
When two cars approach Gate 1 and Gate 2 simultaneously, the `ParkingLot` manager must acquire an internal mutex lock before inspecting and reserving spots:

```typescript
class ParkingLot {
    private static instance: ParkingLot;
    private floors: ParkingFloor[] = [];
    private pricingStrategy: PricingStrategy = new StandardHourlyPricing();

    public static getInstance(): ParkingLot { ... }

    public synchronized parkVehicle(vehicle: Vehicle): ParkingTicket | null {
        for (const floor of this.floors) {
            const spot = floor.findAvailableSpot(vehicle.type);
            if (spot) {
                spot.assignVehicle(vehicle);
                return new ParkingTicket(vehicle, spot, new Date());
            }
        }
        return null; // Lot is full
    }
}
```

---

## Key Takeaways

1. Start LLD interviews by clarifying constraints and identifying core nouns (Entities).
2. Apply the Strategy pattern for calculation logic that is prone to policy changes (pricing, routing).
3. Always address multi-threading and concurrency race conditions in shared resource pools.
MARKDOWN;
    }
}
