<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A company hiring tenant's own job opening (source=company_direct only —
 * see PlacementDrive::SOURCE_COMPANY_DIRECT) marked visible to every
 * role=user account platform-wide, no DriveCollegeMapping needed: every
 * college's students AND college-less "Mellow Direct" users. Orthogonal to
 * college-wise proposing — a drive can be open_to_all, have live
 * DriveCollegeMapping rows, both, or neither; see Contest::isVisibleToUser()
 * for the actual visibility gate this flag feeds. Deliberately a plain
 * boolean, not folded into `source` (which answers "who created/owns this,"
 * not "who can see it") — same "on/off policy flag" shape already used by
 * drive_college_mappings.is_active / contests.is_rated / users.must_change_password.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('placement_drives', function (Blueprint $table) {
            $table->boolean('is_open_to_all')->default(false)->after('source');
        });
    }

    public function down(): void
    {
        Schema::table('placement_drives', function (Blueprint $table) {
            $table->dropColumn('is_open_to_all');
        });
    }
};
