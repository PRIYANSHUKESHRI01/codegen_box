<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * `colleges.tier` is a native MySQL ENUM (see create_colleges_table), so
 * adding "Custom" — a negotiated seat count that doesn't match any of the
 * three fixed catalog tiers (see SubscriptionService::assignCustomInstitutionPlan())
 * — needs a raw ALTER, not Schema::table()->enum()->change() (that path
 * goes through doctrine/dbal, which doesn't round-trip MySQL's native ENUM
 * type reliably).
 */
return new class extends Migration
{
    public function up(): void
    {
        // MySQL's native ENUM is a MySQL-only concept — this raw ALTER is a
        // syntax error on any other driver. The test suite runs against
        // in-memory SQLite (see phpunit.xml), which has no ENUM type at all:
        // `tier` is already a freely-assignable text column there, so
        // "Custom" is already a legal value and there is nothing to alter.
        // Guarded here rather than skipped for every driver, so this
        // migration still does its real job in production/staging (MySQL).
        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE colleges MODIFY COLUMN tier ENUM('Academic Enterprise', 'Pro Campus', 'Standard', 'Custom') NOT NULL DEFAULT 'Standard'");
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE colleges MODIFY COLUMN tier ENUM('Academic Enterprise', 'Pro Campus', 'Standard') NOT NULL DEFAULT 'Standard'");
        }
    }
};
