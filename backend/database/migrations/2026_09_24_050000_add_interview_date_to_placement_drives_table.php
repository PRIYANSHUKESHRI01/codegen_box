<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Deliberately separate from `drive_date` (labeled "Target Close Date" in
 * the UI — the drive's overall deadline). `interview_date` is when the
 * actual interview round happens for shortlisted candidates, usually
 * *before* the close date, not after. Powers
 * PlacementDrive::interviewUrgency() — the "interview is coming up, publish
 * a mock or the final AI interview" nudge on the hiring-partner/Ops drive
 * screens. Nullable: most drives won't know this until shortlisting is
 * underway, well after the drive itself is posted.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('placement_drives', function (Blueprint $table) {
            $table->dateTime('interview_date')->nullable()->after('drive_date');
        });
    }

    public function down(): void
    {
        Schema::table('placement_drives', function (Blueprint $table) {
            $table->dropColumn('interview_date');
        });
    }
};
