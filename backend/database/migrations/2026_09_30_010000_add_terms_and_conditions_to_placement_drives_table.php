<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Free-text terms set by whoever creates the drive — Mellow Ops for a
 * catalog drive, a TPO for their own campus-only drive, or a hiring
 * partner for their own opening (see AdminPlacementDriveController,
 * TpoDriveController, CompanyDriveController). Lives once on the drive
 * itself, never duplicated onto DriveCollegeMapping/DriveApplication —
 * every college mapping and application inherits it the same way they
 * already inherit title/ctc_range/etc. Nullable: most existing drives
 * were created before this field existed and have none.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('placement_drives', function (Blueprint $table) {
            $table->longText('terms_and_conditions')->nullable()->after('eligible_branches');
        });
    }

    public function down(): void
    {
        Schema::table('placement_drives', function (Blueprint $table) {
            $table->dropColumn('terms_and_conditions');
        });
    }
};
