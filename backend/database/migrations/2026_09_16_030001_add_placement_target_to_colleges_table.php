<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A TPO-set goal, not an observed fact — legitimate to store as a plain
 * configurable value (unlike a fabricated "current placement rate", which
 * this table's pre-existing `placement_rate` column actually is: seeded
 * with fake numbers 92.50/81.30/68.00 in DatabaseSeeder/CampusRosterSeeder.
 * That column is left alone here — a pre-existing, known-stale legacy field
 * for post-launch cleanup, not something PlacementReportService reads from;
 * the real "current %" is always computed fresh from drive_applications.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('colleges', function (Blueprint $table) {
            $table->decimal('placement_target_percent', 5, 2)->nullable()->after('placement_rate');
            $table->date('placement_target_deadline')->nullable()->after('placement_target_percent');
        });
    }

    public function down(): void
    {
        Schema::table('colleges', function (Blueprint $table) {
            $table->dropColumn(['placement_target_percent', 'placement_target_deadline']);
        });
    }
};
