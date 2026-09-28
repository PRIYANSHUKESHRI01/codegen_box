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
        DB::statement("ALTER TABLE colleges MODIFY COLUMN tier ENUM('Academic Enterprise', 'Pro Campus', 'Standard', 'Custom') NOT NULL DEFAULT 'Standard'");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE colleges MODIFY COLUMN tier ENUM('Academic Enterprise', 'Pro Campus', 'Standard') NOT NULL DEFAULT 'Standard'");
    }
};
