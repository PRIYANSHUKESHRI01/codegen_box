<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Adds the direct Mellow Vault integration columns (`mv_profile_percentage`,
 * `mv_skill`) to `users` so production can receive Mellow Vault student data
 * directly into `users` without requiring an external DB connection.
 *
 * Also makes `mellow_vault_profile_percent` nullable so AptRun-native users
 * (who do not come from Mellow Vault) stay strictly `null` instead of `0`.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('users')) {
            return;
        }

        Schema::table('users', function (Blueprint $table) {
            if (! Schema::hasColumn('users', 'mv_profile_percentage')) {
                $after = Schema::hasColumn('users', 'mellow_vault_pro_id') ? 'mellow_vault_pro_id' : 'email';
                $table->unsignedTinyInteger('mv_profile_percentage')
                    ->nullable()
                    ->after($after)
                    ->index();
            }

            if (! Schema::hasColumn('users', 'mv_skill')) {
                $after = Schema::hasColumn('users', 'mv_profile_percentage') ? 'mv_profile_percentage' : 'email';
                $table->string('mv_skill', 255)
                    ->nullable()
                    ->after($after);
            }

            if (Schema::hasColumn('users', 'mellow_vault_profile_percent')) {
                $table->unsignedTinyInteger('mellow_vault_profile_percent')
                    ->nullable()
                    ->default(null)
                    ->change();
            }
        });

        // Keep AptRun-only users strictly NULL across MV fields, while backfilling
        // already-synced Mellow Vault students into the new columns.
        if (Schema::hasColumn('users', 'mellow_vault_profile_percent')) {
            DB::table('users')
                ->whereNull('mellow_vault_dev_id')
                ->whereNull('mellow_vault_profile_synced_at')
                ->whereNull('mv_profile_percentage')
                ->whereNull('mv_skill')
                ->update([
                    'mellow_vault_profile_percent' => null,
                ]);

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
        }

        if (Schema::hasColumn('users', 'mellow_vault_stack_name') && Schema::hasColumn('users', 'mv_skill')) {
            DB::table('users')
                ->whereNull('mv_skill')
                ->whereNotNull('mellow_vault_stack_name')
                ->update([
                    'mv_skill' => DB::raw('mellow_vault_stack_name'),
                ]);
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('users')) {
            return;
        }

        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'mv_skill')) {
                $table->dropColumn('mv_skill');
            }
            if (Schema::hasColumn('users', 'mv_profile_percentage')) {
                $table->dropIndex(['mv_profile_percentage']);
                $table->dropColumn('mv_profile_percentage');
            }
        });
    }
};
