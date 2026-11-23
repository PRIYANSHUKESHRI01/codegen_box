import os
import re
import math
from topic_system_design import SYSTEM_DESIGN_ARTICLES
from topic_database_internals import DATABASE_INTERNALS_ARTICLES
from topic_computer_networks import COMPUTER_NETWORKS_ARTICLES
from topic_operating_systems import OPERATING_SYSTEMS_ARTICLES
from topic_object_oriented_design import OBJECT_ORIENTED_DESIGN_ARTICLES
from topic_javascript_typescript import JAVASCRIPT_TYPESCRIPT_ARTICLES
from topic_devops_cloud import DEVOPS_CLOUD_ARTICLES
from topic_web_security import WEB_SECURITY_ARTICLES

TOPIC_MODULES = [
    {
        "slug": "system-design",
        "name": "System Design & Distributed Systems",
        "class_name": "SystemDesignArticlesSeeder",
        "articles": SYSTEM_DESIGN_ARTICLES,
    },
    {
        "slug": "database-internals",
        "name": "Database Internals & SQL Mastery",
        "class_name": "DatabaseInternalsArticlesSeeder",
        "articles": DATABASE_INTERNALS_ARTICLES,
    },
    {
        "slug": "computer-networks",
        "name": "Computer Networks & Web Protocols",
        "class_name": "ComputerNetworksArticlesSeeder",
        "articles": COMPUTER_NETWORKS_ARTICLES,
    },
    {
        "slug": "operating-systems",
        "name": "Operating Systems & Linux Systems",
        "class_name": "OperatingSystemsArticlesSeeder",
        "articles": OPERATING_SYSTEMS_ARTICLES,
    },
    {
        "slug": "object-oriented-design",
        "name": "Object-Oriented Design & Design Patterns",
        "class_name": "ObjectOrientedDesignArticlesSeeder",
        "articles": OBJECT_ORIENTED_DESIGN_ARTICLES,
    },
    {
        "slug": "javascript-typescript",
        "name": "JavaScript & TypeScript Deep Dives",
        "class_name": "JavaScriptTypeScriptArticlesSeeder",
        "articles": JAVASCRIPT_TYPESCRIPT_ARTICLES,
    },
    {
        "slug": "devops-cloud",
        "name": "DevOps, Docker & Cloud Architecture",
        "class_name": "DevOpsCloudArticlesSeeder",
        "articles": DEVOPS_CLOUD_ARTICLES,
    },
    {
        "slug": "web-security",
        "name": "Web Security & Cryptography",
        "class_name": "WebSecurityArticlesSeeder",
        "articles": WEB_SECURITY_ARTICLES,
    },
]

def estimate_reading_time(text: str) -> int:
    words = len(re.findall(r'\b\w+\b', text))
    return max(1, round(words / 200))

def escape_mysql_string(val: str) -> str:
    val = val.replace('\\', '\\\\')
    val = val.replace("'", "\\'")
    val = val.replace('"', '\\"')
    return val

def generate_seeder_code(topic_info):
    slug = topic_info["slug"]
    name = topic_info["name"]
    class_name = topic_info["class_name"]
    articles = topic_info["articles"]

    lines = []
    lines.append("<?php")
    lines.append("")
    lines.append("namespace Database\\Seeders;")
    lines.append("")
    lines.append("use App\\Models\\Article;")
    lines.append("use App\\Models\\ArticleTopic;")
    lines.append("use App\\Models\\User;")
    lines.append("use Illuminate\\Database\\Seeder;")
    lines.append("")
    lines.append("/**")
    lines.append(f" * Seeds the 10-article curriculum for {name}.")
    lines.append(" * Idempotent (updateOrCreate by slug).")
    lines.append(" */")
    lines.append(f"class {class_name} extends Seeder")
    lines.append("{")
    lines.append("    public function run(): void")
    lines.append("    {")
    lines.append(f"        $topic = ArticleTopic::where('slug', '{slug}')->first();")
    lines.append("")
    lines.append("        if (! $topic) {")
    lines.append(f'            $this->command?->error("{name} article topic not found. Run ArticleTopicSeeder first.");')
    lines.append("            return;")
    lines.append("        }")
    lines.append("")
    lines.append("        $author = User::where('email', 'priya@mellow.ai')->first()")
    lines.append("            ?? User::where('role', User::ROLE_SUPERADMIN)->first()")
    lines.append("            ?? User::first();")
    lines.append("")
    lines.append("        if (! $author) {")
    lines.append('            $this->command?->error("No valid author found to associate with articles.");')
    lines.append("            return;")
    lines.append("        }")
    lines.append("")
    lines.append("        $articles = [")

    for a in articles:
        slug_func = re.sub(r'[^a-zA-Z0-9]', '', a['slug'].title())
        func_name = slug_func[0].lower() + slug_func[1:] + "Article"
        excerpt_clean = a['excerpt'].replace("'", "\\'")

        lines.append("            [")
        lines.append(f"                'slug' => '{a['slug']}',")
        lines.append(f"                'title' => '{a['title'].replace(chr(39), chr(92)+chr(39))}',")
        lines.append(f"                'excerpt' => '{excerpt_clean}',")
        lines.append(f"                'display_order' => {a['display_order']},")
        lines.append(f"                'content' => $this->{func_name}(),")
        lines.append("            ],")

    lines.append("        ];")
    lines.append("")
    lines.append("        foreach ($articles as $data) {")
    lines.append("            $content = $data['content'];")
    lines.append("            Article::updateOrCreate(")
    lines.append("                ['slug' => $data['slug']],")
    lines.append("                [")
    lines.append("                    'article_topic_id' => $topic->id,")
    lines.append("                    'title' => $data['title'],")
    lines.append("                    'excerpt' => $data['excerpt'],")
    lines.append("                    'content' => $content,")
    lines.append("                    'icon' => null,")
    lines.append("                    'status' => Article::STATUS_PUBLISHED,")
    lines.append("                    'display_order' => $data['display_order'],")
    lines.append("                    'reading_time_minutes' => Article::estimateReadingTimeMinutes($content),")
    lines.append("                    'created_by' => $author->id,")
    lines.append("                    'published_at' => now(),")
    lines.append("                ]")
    lines.append("            );")
    lines.append("        }")
    lines.append("    }")

    for a in articles:
        slug_func = re.sub(r'[^a-zA-Z0-9]', '', a['slug'].title())
        func_name = slug_func[0].lower() + slug_func[1:] + "Article"
        lines.append("")
        lines.append(f"    private function {func_name}(): string")
        lines.append("    {")
        lines.append("        return <<<'MARKDOWN'")
        lines.append(a['content'])
        lines.append("MARKDOWN;")
        lines.append("    }")

    lines.append("}")
    lines.append("")
    return "\n".join(lines)

def generate_master_sql():
    lines = []
    lines.append("-- ==============================================================================")
    lines.append("-- AptRun Flagship Articles Master Update (10 Topics, 100 Comprehensive Articles)")
    lines.append("-- Generated for AWS RDS / Production MySQL")
    lines.append("-- Date: 2026-11-23")
    lines.append("-- Idempotent: Can be run multiple times safely via ON DUPLICATE KEY UPDATE.")
    lines.append("-- ==============================================================================")
    lines.append("")
    lines.append("SET NAMES utf8mb4;")
    lines.append("SET FOREIGN_KEY_CHECKS = 0;")
    lines.append("")
    lines.append("-- Author resolution")
    lines.append("SET @author_id = (")
    lines.append("    SELECT `id` FROM `users` WHERE `email` = 'priya@mellow.ai'")
    lines.append("    UNION")
    lines.append("    SELECT `id` FROM `users` WHERE `role` = 'superadmin'")
    lines.append("    UNION")
    lines.append("    SELECT `id` FROM `users` ORDER BY `id` ASC LIMIT 1")
    lines.append(");")
    lines.append("")

    for topic_info in TOPIC_MODULES:
        slug = topic_info["slug"]
        name = topic_info["name"]
        articles = topic_info["articles"]

        lines.append(f"-- ==============================================================================")
        lines.append(f"-- TOPIC: {name} (`{slug}`)")
        lines.append(f"-- ==============================================================================")
        lines.append(f"SET @topic_id_{slug.replace('-', '_')} = (SELECT `id` FROM `article_topics` WHERE `slug` = '{slug}' LIMIT 1);")
        lines.append("")

        for a in articles:
            rt = estimate_reading_time(a['content'])
            title_esc = escape_mysql_string(a['title'])
            slug_esc = escape_mysql_string(a['slug'])
            excerpt_esc = escape_mysql_string(a['excerpt'])
            content_esc = escape_mysql_string(a['content'])

            lines.append("INSERT INTO `articles` (")
            lines.append("    `article_topic_id`,")
            lines.append("    `title`,")
            lines.append("    `slug`,")
            lines.append("    `excerpt`,")
            lines.append("    `content`,")
            lines.append("    `icon`,")
            lines.append("    `status`,")
            lines.append("    `display_order`,")
            lines.append("    `reading_time_minutes`,")
            lines.append("    `created_by`,")
            lines.append("    `published_at`,")
            lines.append("    `created_at`,")
            lines.append("    `updated_at`")
            lines.append(")")
            lines.append("VALUES (")
            lines.append(f"    @topic_id_{slug.replace('-', '_')},")
            lines.append(f"    '{title_esc}',")
            lines.append(f"    '{slug_esc}',")
            lines.append(f"    '{excerpt_esc}',")
            lines.append(f"    '{content_esc}',")
            lines.append("    NULL,")
            lines.append("    'published',")
            lines.append(f"    {a['display_order']},")
            lines.append(f"    {rt},")
            lines.append("    @author_id,")
            lines.append("    NOW(),")
            lines.append("    NOW(),")
            lines.append("    NOW()")
            lines.append(")")
            lines.append("ON DUPLICATE KEY UPDATE")
            lines.append(f"    `article_topic_id` = VALUES(`article_topic_id`),")
            lines.append(f"    `title` = VALUES(`title`),")
            lines.append(f"    `excerpt` = VALUES(`excerpt`),")
            lines.append(f"    `content` = VALUES(`content`),")
            lines.append("    `status` = 'published',")
            lines.append("    `display_order` = VALUES(`display_order`),")
            lines.append("    `reading_time_minutes` = VALUES(`reading_time_minutes`),")
            lines.append("    `published_at` = COALESCE(`published_at`, NOW()),")
            lines.append("    `updated_at` = NOW();")
            lines.append("")

    lines.append("SET FOREIGN_KEY_CHECKS = 1;")
    lines.append("-- End of AptRun Flagship Articles Master Update")
    return "\n".join(lines)

def main():
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".."))
    seeders_dir = os.path.join(root_dir, "backend", "database", "seeders")

    print(f"Generating 8 curriculum seeders in {seeders_dir}...")
    for tm in TOPIC_MODULES:
        code = generate_seeder_code(tm)
        file_path = os.path.join(seeders_dir, f"{tm['class_name']}.php")
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(code)
        print(f" -> Generated {tm['class_name']}.php ({len(code)} bytes, {len(tm['articles'])} articles)")

    # Generate master SQL file
    sql_path = os.path.join(root_dir, "aws-all-articles-update-2026-11-23.sql")
    sql_code = generate_master_sql()
    with open(sql_path, "w", encoding="utf-8") as f:
        f.write(sql_code)
    print(f" -> Generated master SQL update: {sql_path} ({len(sql_code)} bytes)")

    # Update ArticleSeeder.php
    article_seeder_path = os.path.join(seeders_dir, "ArticleSeeder.php")
    seeder_calls = [
        "        // 1. Data Structures & Algorithms",
        "        $this->call(DsaArticlesSeeder::class);",
        "        // 2. Go Programming",
        "        $this->call(GoArticlesSeeder::class);",
    ]
    for i, tm in enumerate(TOPIC_MODULES, start=3):
        seeder_calls.append(f"        // {i}. {tm['name']}")
        seeder_calls.append(f"        $this->call({tm['class_name']}::class);")

    new_article_seeder = f"""<?php

namespace Database\\Seeders;

use Illuminate\\Database\\Seeder;

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
{{
    public function run(): void
    {{
{chr(10).join(seeder_calls)}
    }}
}}
"""
    with open(article_seeder_path, "w", encoding="utf-8") as f:
        f.write(new_article_seeder)
    print(f" -> Updated ArticleSeeder.php with all 10 curriculum seeders.")

if __name__ == "__main__":
    main()
