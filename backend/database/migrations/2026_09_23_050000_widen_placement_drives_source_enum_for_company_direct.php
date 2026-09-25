<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Widens placement_drives.source to add 'company_direct' — a job opening a
 * company hiring tenant posts themselves, entirely outside the campus-drive
 * system (no DriveCollegeMapping, no college eligibility gating at all).
 * Same raw-ALTER pattern as the users.role widenings: this is a real MySQL
 * ENUM (see 2026_09_12_090005_add_provenance_to_companies_and_placement_drives.php),
 * not a plain string like contests.contest_type.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! $this->isMySql()) {
            return;
        }

        DB::statement("ALTER TABLE placement_drives MODIFY COLUMN source ENUM('catalog', 'tpo_created', 'company_direct') NOT NULL DEFAULT 'catalog'");
    }

    public function down(): void
    {
        if (! $this->isMySql()) {
            return;
        }

        DB::statement("ALTER TABLE placement_drives MODIFY COLUMN source ENUM('catalog', 'tpo_created') NOT NULL DEFAULT 'catalog'");
    }

    private function isMySql(): bool
    {
        return in_array(DB::getDriverName(), ['mysql', 'mariadb'], true);
    }
};
