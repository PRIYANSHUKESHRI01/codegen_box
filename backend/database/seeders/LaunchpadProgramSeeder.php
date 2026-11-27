<?php

namespace Database\Seeders;

use App\Models\LaunchpadProgram;
use App\Models\User;
use App\Services\LaunchpadProgramService;
use Illuminate\Database\Seeder;

/**
 * Idempotent starter seeder for the two official Mellow Vault 2026 campaign tracks:
 *   1. Tech Track (21 days, 3 rotated proctored assessments)
 *   2. Non-Tech Track (5 days, 3 rotated proctored assessments)
 * Seeded as drafts so SuperAdmin chooses the target College -> Branch -> Students
 * and clicks Publish to start each cohort's live countdown.
 */
class LaunchpadProgramSeeder extends Seeder
{
    public function run(): void
    {
        $actor = User::where('role', User::ROLE_SUPERADMIN)->first()
            ?? User::where('role', User::ROLE_ADMIN_INTERNAL)->first();

        if (! $actor) {
            return;
        }

        $service = app(LaunchpadProgramService::class);

        if (! LaunchpadProgram::where('track', LaunchpadProgram::TRACK_TECH)
            ->where('title', LaunchpadProgram::DEFAULT_CAMPAIGN_TITLE)
            ->exists()) {
            $service->createProgram($actor, [
                'track' => LaunchpadProgram::TRACK_TECH,
                'title' => LaunchpadProgram::DEFAULT_CAMPAIGN_TITLE,
                'publish_now' => false,
                'target_scope' => ['student_mode' => 'selected', 'user_ids' => []],
            ]);
        }

        if (! LaunchpadProgram::where('track', LaunchpadProgram::TRACK_NON_TECH)
            ->where('title', LaunchpadProgram::DEFAULT_CAMPAIGN_TITLE)
            ->exists()) {
            $service->createProgram($actor, [
                'track' => LaunchpadProgram::TRACK_NON_TECH,
                'title' => LaunchpadProgram::DEFAULT_CAMPAIGN_TITLE,
                'publish_now' => false,
                'target_scope' => ['student_mode' => 'selected', 'user_ids' => []],
            ]);
        }
    }
}
