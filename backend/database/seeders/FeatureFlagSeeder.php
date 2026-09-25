<?php

namespace Database\Seeders;

use App\Models\FeatureFlag;
use Illuminate\Database\Seeder;

/**
 * Starting rows for the superadmin Feature Flags registry — carried over
 * from the frontend TS mock (frontend/src/data/mockDashboardData.ts's old
 * FEATURE_FLAGS) now that a toggle is real and persists across reloads.
 */
class FeatureFlagSeeder extends Seeder
{
    public function run(): void
    {
        $flags = [
            ['key' => 'judge-memory-limit-strictness', 'name' => 'Sandboxed Memory Limit Strictness (256MB)', 'description' => 'Terminates jobs exceeding resident set size immediately without warning grace.', 'category' => 'Judge System', 'enabled' => true],
            ['key' => 'ai-plagiarism-cross-check', 'name' => 'Real-time AI Plagiarism Token Cross-Check', 'description' => 'Performs AST vector embedding similarity across concurrent submissions during rated contests.', 'category' => 'Anti-Cheat', 'enabled' => true],
            ['key' => 'tpo-proctoring-telemetry', 'name' => 'Campus TPO Proctoring Telemetry (Webcam & Tab switch)', 'description' => 'Captures focus loss and proctor events during scheduled college recruitment drives.', 'category' => 'Campus Recruitment', 'enabled' => true],
            ['key' => 'ai-editorial-assistant-beta', 'name' => 'AI Editorial Assistant in Beta', 'description' => 'Generates step-by-step algorithmic hints when a student fails 3 consecutive testcases.', 'category' => 'UI & Beta', 'enabled' => false],
            ['key' => 'judge-maintenance-mode', 'name' => 'Maintenance Mode (Read-Only Judge)', 'description' => 'Locks the code submission queue for planned database migrations.', 'category' => 'Judge System', 'enabled' => false],
        ];

        foreach ($flags as $flag) {
            FeatureFlag::updateOrCreate(['key' => $flag['key']], $flag);
        }
    }
}
