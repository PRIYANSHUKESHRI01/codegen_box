<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Widens the `role` ENUM to add 'admin_company' — same reasoning as
 * 2026_09_22_050000_widen_users_role_enum_for_section_coordinator.php: MySQL
 * enforces this constraint, not Eloquent, so adding the role to
 * User::ROLES alone would silently truncate on INSERT until the column
 * itself is widened here.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! $this->isMySql()) {
            return;
        }

        DB::statement("ALTER TABLE users MODIFY COLUMN role ENUM('user', 'admin_internal', 'admin_tpo', 'admin_marketing', 'superadmin', 'section_coordinator', 'admin_company') NOT NULL DEFAULT 'user'");
    }

    public function down(): void
    {
        if (! $this->isMySql()) {
            return;
        }

        DB::statement("ALTER TABLE users MODIFY COLUMN role ENUM('user', 'admin_internal', 'admin_tpo', 'admin_marketing', 'superadmin', 'section_coordinator') NOT NULL DEFAULT 'user'");
    }

    /** ENUM columns only exist on MySQL/MariaDB; other drivers (the SQLite test DB) have nothing to widen. */
    private function isMySql(): bool
    {
        return in_array(DB::getDriverName(), ['mysql', 'mariadb'], true);
    }
};
