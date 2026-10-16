<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * The Vault — getting hired through Mellow Vault — is a Grandmaster feature for individual students, and
 * comes with a college's plan for the students that college covers (the same shape as Hack Arena access).
 * `vault_access` is the switch the server enforces; the superadmin can change it per plan.
 *
 * It starts as a copy of `talent_pool_access`, the switch the Vault replaces, so every plan keeps the
 * intent it already had (Coder and Expert off; Grandmaster and every college plan on) and nothing has to
 * be re-entered. The old column is left in place — a column is never dropped in the same release as the
 * code that stops reading it.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('plans', 'vault_access')) {
            Schema::table('plans', function (Blueprint $table) {
                $table->boolean('vault_access')->default(true)->after('hackathon_access');
            });
        }

        if (Schema::hasColumn('plans', 'talent_pool_access')) {
            DB::table('plans')->update(['vault_access' => DB::raw('talent_pool_access')]);
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('plans', 'vault_access')) {
            Schema::table('plans', function (Blueprint $table) {
                $table->dropColumn('vault_access');
            });
        }
    }
};
