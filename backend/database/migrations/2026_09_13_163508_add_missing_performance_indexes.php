<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Two lookups that every role-gated controller runs on essentially every
 * request had no supporting index:
 *
 * - `users.role` is filtered on directly (AdminController::users(),
 *   SuperAdminController::users()) but, unlike a foreign key column, plain
 *   enum columns get no automatic index — at real scale (a handful of
 *   colleges each bulk-importing thousands of students) this was a full
 *   table scan on every Platform Users / User Governance page load.
 * - `drive_college_mappings` only had a UNIQUE(placement_drive_id,
 *   college_id) index. Composite indexes only serve queries filtering on
 *   their LEFTMOST column(s) — but TpoDriveController::mapped() and
 *   StudentDriveController::index() both filter by college_id alone (never
 *   placement_drive_id), so that unique index never actually helped them.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->index('role');
        });

        Schema::table('drive_college_mappings', function (Blueprint $table) {
            $table->index(['college_id', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex(['role']);
        });

        Schema::table('drive_college_mappings', function (Blueprint $table) {
            $table->dropIndex(['college_id', 'is_active']);
        });
    }
};
