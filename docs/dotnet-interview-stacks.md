# C# & .NET and ASP.NET Core in the Vault AI and Mock AI interviews (2026-11-07)

**Were they there?** No. Neither the Vault AI Interview nor the Mock AI Interview had any .NET stack (the catalogue had Laravel, Node, Python, Java, Go, PHP, CMS, API design under Backend and nothing for the Microsoft stack). Two stacks were added under the **Backend** role (the Mock AI Interview reads the same catalogue, so it gets them automatically):

| Stack key | Name | Round / set themes (Series 1; Mock rounds use the same three) |
| --- | --- | --- |
| `csharp_dotnet` | C# & .NET | C# Language Core & OOP · LINQ, Async & Collections · Runtime, Memory & Production .NET |
| `aspnet_core` | ASP.NET Core | Middleware, Routing & Dependency Injection · Web APIs, EF Core & Data Access · Security, Performance & Production |

Search aliases (the Mellow Vault domain map): C#, C# Developer, .NET Developer, DotNet / ASP.NET, ASP.NET Core, ASP.NET Developer.

**Why two stacks and not one:** a .NET interview splits cleanly into the language and runtime (any C# job: console, desktop, services) and the web framework (any ASP.NET job). A candidate can sit either.

## Questions
* **Vault AI:** 45 per stack = 3 series x 3 sets x 5 (series 2 and 3 are deeper and distinct: generics variance, async deadlocks, GC modes, Native AOT, transactional outbox, thread-pool starvation, zero-downtime migrations...). Each has a model-answer rubric in `note` (what the AI scorer is given). A stack opens by itself because every set has the 5 questions the catalogue requires.
* **Mock AI:** 15 per stack = 3 rounds x 5, practice-level (what is middleware, DI lifetimes, class vs struct, N+1...).
* Written by me, not from a licensed bank. **Have a .NET engineer skim them before relying on the scoring** (`needs_review` is not set; staff can edit any question in Admin → Vault AI questions / Mock interview questions).

## Where things are
| What | File |
| --- | --- |
| Stacks, labels | `backend/config/curated_interview_domains.php` |
| Vault questions | `database/seeders/data/vault_questions/dotnet_csharp_part10.php`, `dotnet_aspnet_part11.php` |
| Mock questions | `database/seeders/data/mock_questions/dotnet_mock.php` |
| Migration (ships the questions on deploy) | `database/migrations/2026_11_19_100000_add_dotnet_interview_questions.php` |
| Seeder (dev, just these two stacks) | `php artisan db:seed --class=DotNetInterviewQuestionsSeeder` (a full `db:seed` already includes them: the all-stacks seeders glob the same folders) |
| AWS SQL | `aws-db-update-2026-11-07.sql` |

Migration and seeder are idempotent upserts matched on (set, position) / (stack, round, position): re-running restores the shipped wording of an untouched position, never duplicates, and never touches questions staff added at later positions or to other stacks. `down()` removes only positions 1-5 of the two stacks.
The AWS SQL is the insert-only variant (it never overwrites an edited question), verified twice on a scratch MariaDB, and records the migration so `migrate` will not repeat it.

## Deploy
Deploy the code, then **either** `php artisan migrate --force` **or** run `aws-db-update-2026-11-07.sql` (not both is needed; doing both is harmless). Then `php artisan config:cache`. No frontend change (the explorer reads the catalogue). Already applied to the dev database.

## Tests
`DotNetStacksTest` (stacks, aliases, 45 real distinct questions each and open, Mock rounds ready, migration idempotent and staff-safe, rollback). Existing catalogue/mock tests that assume an empty bank now start from one (`VaultAiDomainCatalogTest`, `MockInterviewTest`, `MerchantNavyMockTest`) and the pinned counts moved 41 → 43 stacks. `PracticeInterviewTest::test_a_role_whose_bank_is_still_empty...` fails in the scratch copy with or without this change (pre-existing, ECE content in the working tree).

## Not done
* Mellow Vault's own `pro_id` map (`MELLOW_VAULT_PRO_ID_MAP`) has no entry for the two stacks; add `csharp_dotnet` and `aspnet_core` if Mellow Vault lists .NET roles.
* No other Microsoft-adjacent stacks (Azure, SQL Server, Blazor, WPF) were added; say if you want them.
