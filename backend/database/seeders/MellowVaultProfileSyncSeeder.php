<?php

namespace Database\Seeders;

use App\Models\User;
use App\Services\Vault\MellowVaultProfileSyncService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Production-safe idempotent seeder for Mellow Vault 90% profile -> Vault AI Interview invites:
 *  1. Seeds/updates all Mellow Vault `pro_id` / heading -> AptRun stack mappings.
 *  2. Ensures AptRun-native users (~90% of platform users) remain strictly `NULL`
 *     for `mv_profile_percentage` and `mv_skill` (never defaulted to 0).
 *  3. Backfills any existing Mellow Vault students and resolves their `mv_skill`
 *     into matching AptRun Vault AI Interview stacks (`mellow_vault_stack_key` / `mellow_vault_stack_name`).
 */
class MellowVaultProfileSyncSeeder extends Seeder
{
    public function run(): void
    {
        $this->call(MellowVaultStackMappingSeeder::class);

        if (! Schema::hasTable('users') || ! Schema::hasColumn('users', 'mv_profile_percentage')) {
            return;
        }

        // 1. Ensure AptRun-only users keep null MV columns instead of 0
        DB::table('users')
            ->whereNull('mellow_vault_dev_id')
            ->whereNull('mellow_vault_profile_synced_at')
            ->whereNull('mv_profile_percentage')
            ->whereNull('mv_skill')
            ->update([
                'mellow_vault_profile_percent' => null,
            ]);

        // 2. Backfill already-synced Mellow Vault users cleanly
        DB::table('users')
            ->where(function ($q) {
                $q->whereNotNull('mellow_vault_dev_id')
                    ->orWhereNotNull('mellow_vault_profile_synced_at');
            })
            ->whereNull('mv_profile_percentage')
            ->whereNotNull('mellow_vault_profile_percent')
            ->update([
                'mv_profile_percentage' => DB::raw('mellow_vault_profile_percent'),
            ]);

        if (Schema::hasColumn('users', 'mellow_vault_stack_name') && Schema::hasColumn('users', 'mv_skill')) {
            DB::table('users')
                ->whereNull('mv_skill')
                ->whereNotNull('mellow_vault_stack_name')
                ->update([
                    'mv_skill' => DB::raw('mellow_vault_stack_name'),
                ]);
        }

        // 3. Resolve `mv_skill` -> stack mapping for Mellow Vault users without emitting emails during seeding
        $sync = app(MellowVaultProfileSyncService::class);
        User::query()
            ->where('role', User::ROLE_USER)
            ->where(function ($q) {
                $q->whereNotNull('mv_profile_percentage')
                    ->orWhereNotNull('mv_skill');
            })
            ->chunkById(200, function ($users) use ($sync) {
                foreach ($users as $user) {
                    $sync->handleDirectMvColumnsChanged($user, dispatchEmail: false);
                }
            });
    }
}
