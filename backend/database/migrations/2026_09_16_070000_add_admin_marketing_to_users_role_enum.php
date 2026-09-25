<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * The `role` column is a real MySQL ENUM (see
 * 2026_09_11_170001_add_role_and_profile_fields_to_users_table.php), not a
 * plain string — Eloquent/PHP never enforce that constraint, only MySQL
 * does, so adding a role value to User::ROLES alone silently truncates on
 * INSERT until the enum itself is widened here. Raw SQL rather than
 * Schema::table()->enum()->change(), since Laravel's Doctrine-DBAL-based
 * column-modification path doesn't reliably round-trip MySQL ENUM
 * definitions.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! $this->isMySql()) {
            return;
        }

        DB::statement("ALTER TABLE users MODIFY COLUMN role ENUM('user', 'admin_internal', 'admin_tpo', 'admin_marketing', 'superadmin') NOT NULL DEFAULT 'user'");
    }

    public function down(): void
    {
        if (! $this->isMySql()) {
            return;
        }

        DB::statement("ALTER TABLE users MODIFY COLUMN role ENUM('user', 'admin_internal', 'admin_tpo', 'superadmin') NOT NULL DEFAULT 'user'");
    }

    /** ENUM columns only exist on MySQL/MariaDB; other drivers (the SQLite test DB) have nothing to widen. */
    private function isMySql(): bool
    {
        return in_array(DB::getDriverName(), ['mysql', 'mariadb'], true);
    }
};
