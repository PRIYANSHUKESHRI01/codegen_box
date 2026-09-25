<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Granular, per-employee access control for Mellow's two internal staff
 * roles. Until now, admin_internal/admin_marketing were all-or-nothing:
 * every account of a role saw every section that role's routes exposed. A
 * superadmin creating a new hire can now hand-pick exactly which sections
 * (Colleges, Platform Users, Problem Bank, Companies & Placement Drives,
 * Contests, Customers for Ops; Leads and Lead Outreach for Marketing) that
 * one employee actually gets — see User::hasPermission() and the new
 * `permission:` route middleware.
 *
 * The values below are deliberately hardcoded (not read from User's
 * constants) — migrations are a frozen historical record and must keep
 * working exactly as written even if the permission catalog changes later.
 *
 * Every account that already exists is backfilled with its role's FULL
 * permission set, not left empty — this is additive access control, not a
 * retroactive lockout of staff who were already working with full access.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->json('permissions')->nullable()->after('role');
        });

        $internalPermissions = json_encode(['colleges', 'platform_users', 'problem_bank', 'placements', 'contests', 'customers']);
        $marketingPermissions = json_encode(['leads', 'lead_outreach']);

        DB::table('users')->where('role', 'admin_internal')->update(['permissions' => $internalPermissions]);
        DB::table('users')->where('role', 'admin_marketing')->update(['permissions' => $marketingPermissions]);
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('permissions');
        });
    }
};
