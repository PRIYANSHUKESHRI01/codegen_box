<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

/**
 * Master seeder for all Accenture Fresher Campus Recruitment Question Sets:
 * 1. Placement Prep Questions & Recommended Problems (AccenturePlacementSeeder)
 * 2. Soft Skills & Cognitive Assessment Question Sets (AccentureSoftSkillQuestionSetSeeder)
 * 3. Communication Assessment Versant Spoken Question Sets (AccentureCommunicationQuestionSetSeeder)
 * 4. Technical & HR Interview Question Sets (AccentureInterviewQuestionSetSeeder)
 */
class AccentureQuestionSetsSeeder extends Seeder
{
    public function run(): void
    {
        $this->command?->info('Seeding Accenture Campus Recruitment Question Sets across all rounds...');

        $this->call([
            AccenturePlacementSeeder::class,
            AccentureSoftSkillQuestionSetSeeder::class,
            AccentureCommunicationQuestionSetSeeder::class,
            AccentureInterviewQuestionSetSeeder::class,
        ]);

        $this->command?->info('All Accenture Question Sets seeded successfully.');
    }
}

