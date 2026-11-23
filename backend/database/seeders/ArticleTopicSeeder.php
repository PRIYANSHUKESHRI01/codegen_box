<?php

namespace Database\Seeders;

use App\Models\ArticleTopic;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * The 10 flagship learning topics for the AptRun Articles knowledge base.
 * Idempotent (updateOrCreate by slug) so reseeding never duplicates rows.
 */
class ArticleTopicSeeder extends Seeder
{
    public function run(): void
    {
        $priya = User::where('email', 'priya@mellow.ai')->first()
            ?? User::where('role', User::ROLE_SUPERADMIN)->first()
            ?? User::first();

        if (! $priya) {
            return;
        }

        $topics = [
            [
                'slug' => 'dsa',
                'name' => 'Data Structures & Algorithms',
                'description' => 'Core DSA theory explained from first principles — the patterns that actually show up in technical interviews.',
                'icon' => 'Binary',
                'color' => 'indigo',
                'display_order' => 1,
            ],
            [
                'slug' => 'go-programming',
                'name' => 'Go Programming',
                'description' => 'Practical, production-minded deep-dives into Go — concurrency, memory layout, runtime internals, and high-performance services.',
                'icon' => 'Cpu',
                'color' => 'sky',
                'display_order' => 2,
            ],
            [
                'slug' => 'system-design',
                'name' => 'System Design & Distributed Systems',
                'description' => 'Scalability blueprints, CAP theorem, consistent hashing, caching hierarchies, database sharding, and event-driven architecture.',
                'icon' => 'Layers',
                'color' => 'indigo',
                'display_order' => 3,
            ],
            [
                'slug' => 'database-internals',
                'name' => 'Database Internals & SQL Mastery',
                'description' => 'Storage engines, B-Trees vs LSM-Trees, WAL, ACID guarantees, transaction isolation levels, MVCC, and query optimization.',
                'icon' => 'Database',
                'color' => 'emerald',
                'display_order' => 4,
            ],
            [
                'slug' => 'computer-networks',
                'name' => 'Computer Networks & Web Protocols',
                'description' => 'TCP/IP mechanics, flow control, TLS 1.3 handshakes, HTTP/2 multiplexing, HTTP/3 QUIC, DNS hierarchy, and WebSockets.',
                'icon' => 'Network',
                'color' => 'sky',
                'display_order' => 5,
            ],
            [
                'slug' => 'operating-systems',
                'name' => 'Operating Systems & Linux Systems',
                'description' => 'Process virtualization, CFS scheduling, virtual memory, paging & TLB, IPC, epoll subsystem, and Linux cgroups.',
                'icon' => 'Terminal',
                'color' => 'amber',
                'display_order' => 6,
            ],
            [
                'slug' => 'object-oriented-design',
                'name' => 'Object-Oriented Design & Design Patterns',
                'description' => 'SOLID principles, Creational, Structural, and Behavioral GoF patterns, Domain-Driven Design, and Low-Level Design (LLD) case studies.',
                'icon' => 'GitBranch',
                'color' => 'rose',
                'display_order' => 7,
            ],
            [
                'slug' => 'javascript-typescript',
                'name' => 'JavaScript & TypeScript Deep Dives',
                'description' => 'The V8 engine, event loop, closures, prototype chain, async/await deconstructed, and advanced TypeScript type gymnastics.',
                'icon' => 'Code2',
                'color' => 'amber',
                'display_order' => 8,
            ],
            [
                'slug' => 'devops-cloud',
                'name' => 'DevOps, Docker & Cloud Architecture',
                'description' => 'Container namespaces, multi-stage Dockerfiles, Kubernetes control plane, CI/CD pipelines, Terraform IaC, and observability.',
                'icon' => 'Cloud',
                'color' => 'emerald',
                'display_order' => 9,
            ],
            [
                'slug' => 'web-security',
                'name' => 'Web Security & Cryptography',
                'description' => 'OWASP Top 10 defenses, JWT security, modern CSP, SQLi prevention, Argon2id password hashing, and OAuth 2.0 PKCE.',
                'icon' => 'ShieldCheck',
                'color' => 'rose',
                'display_order' => 10,
            ],
        ];

        foreach ($topics as $t) {
            ArticleTopic::updateOrCreate(
                ['slug' => $t['slug']],
                [
                    'name' => $t['name'],
                    'description' => $t['description'],
                    'icon' => $t['icon'],
                    'color' => $t['color'],
                    'display_order' => $t['display_order'],
                    'created_by' => $priya->id,
                ]
            );
        }
    }
}
