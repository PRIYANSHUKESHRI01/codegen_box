<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

/**
 * Top-level master seeder for the AptRun Articles knowledge base.
 * Calls curriculum seeders for all 10 flagship topics (100 articles total):
 *  1. Data Structures & Algorithms (DsaArticlesSeeder)
 *  2. Go Programming (GoArticlesSeeder)
 *  3. System Design & Distributed Systems (SystemDesignArticlesSeeder)
 *  4. Database Internals & SQL Mastery (DatabaseInternalsArticlesSeeder)
 *  5. Computer Networks & Web Protocols (ComputerNetworksArticlesSeeder)
 *  6. Operating Systems & Linux Systems (OperatingSystemsArticlesSeeder)
 *  7. Object-Oriented Design & Design Patterns (ObjectOrientedDesignArticlesSeeder)
 *  8. JavaScript & TypeScript Deep Dives (JavaScriptTypeScriptArticlesSeeder)
 *  9. DevOps, Docker & Cloud Architecture (DevOpsCloudArticlesSeeder)
 * 10. Web Security & Cryptography (WebSecurityArticlesSeeder)
 *
 * Idempotent (updateOrCreate by slug). Requires ArticleTopicSeeder to have already run.
 */
class ArticleSeeder extends Seeder
{
    public function run(): void
    {
        // 1. Data Structures & Algorithms
        $this->call(DsaArticlesSeeder::class);
        // 2. Go Programming
        $this->call(GoArticlesSeeder::class);
        // 3. System Design & Distributed Systems
        $this->call(SystemDesignArticlesSeeder::class);
        // 4. Database Internals & SQL Mastery
        $this->call(DatabaseInternalsArticlesSeeder::class);
        // 5. Computer Networks & Web Protocols
        $this->call(ComputerNetworksArticlesSeeder::class);
        // 6. Operating Systems & Linux Systems
        $this->call(OperatingSystemsArticlesSeeder::class);
        // 7. Object-Oriented Design & Design Patterns
        $this->call(ObjectOrientedDesignArticlesSeeder::class);
        // 8. JavaScript & TypeScript Deep Dives
        $this->call(JavaScriptTypeScriptArticlesSeeder::class);
        // 9. DevOps, Docker & Cloud Architecture
        $this->call(DevOpsCloudArticlesSeeder::class);
        // 10. Web Security & Cryptography
        $this->call(WebSecurityArticlesSeeder::class);
    }
}
