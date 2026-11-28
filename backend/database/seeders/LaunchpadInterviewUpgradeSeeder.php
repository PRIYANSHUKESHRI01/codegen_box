<?php

namespace Database\Seeders;

use App\Models\User;
use App\Services\LaunchpadProgramService;
use Illuminate\Database\Seeder;

/**
 * Production-safe, idempotent seeder that upgrades all unstarted Launchpad AI Interview slots
 * (both Tech and Non-Tech tracks) to Vault-grade difficulty (`hard`) with explicit
 * `notes_for_reviewer` grading rubrics, without touching any active or completed student sessions.
 *
 * Safe to run standalone on production after deploy:
 *   php artisan db:seed --class=LaunchpadInterviewUpgradeSeeder
 */
class LaunchpadInterviewUpgradeSeeder extends Seeder
{
    public function run(): void
    {
        $actor = User::where('role', User::ROLE_SUPERADMIN)->first()
            ?? User::where('role', User::ROLE_ADMIN_INTERNAL)->first()
            ?? User::first();

        if (! $actor) {
            return;
        }

        $upgraded = app(LaunchpadProgramService::class)->refreshUnstartedSlotInterviews(null, $actor);

        if ($this->command) {
            $this->command->info("Upgraded {$upgraded} unstarted Launchpad AI Interview slot(s) with Vault-grade questions & rubrics.");
        }
    }
}
