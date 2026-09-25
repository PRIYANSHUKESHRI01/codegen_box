<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * A `company` contest's own explicit college targeting — deliberately
 * separate from DriveCollegeMapping. A drive can be live at several
 * colleges (that's the placement drive's own reach), but Ops may want to
 * run the CONTEST for only a subset of them (e.g. Infosys is live at two
 * colleges, but this particular round is only for one). See
 * Contest::isVisibleToCollege(), which requires a college to be in BOTH
 * this table AND still live-mapped to the drive — so a college that later
 * backs out of the drive entirely loses contest access automatically, even
 * if it was previously hand-picked here.
 *
 * Backfills every existing `company` contest with its drive's currently
 * live-mapped colleges, so contests created before this migration keep
 * exactly the visibility they already had (nothing silently narrows).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('contest_colleges', function (Blueprint $table) {
            $table->id();
            $table->foreignId('contest_id')->constrained()->cascadeOnDelete();
            $table->foreignId('college_id')->constrained()->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['contest_id', 'college_id']);
        });

        $companyContests = DB::table('contests')
            ->where('contest_type', 'company')
            ->whereNotNull('placement_drive_id')
            ->get(['id', 'placement_drive_id']);

        $now = now();

        foreach ($companyContests as $contest) {
            $liveCollegeIds = DB::table('drive_college_mappings')
                ->where('placement_drive_id', $contest->placement_drive_id)
                ->where('status', 'approved')
                ->where('is_active', true)
                ->pluck('college_id');

            if ($liveCollegeIds->isEmpty()) {
                continue;
            }

            DB::table('contest_colleges')->insert(
                $liveCollegeIds->map(fn ($collegeId) => [
                    'contest_id' => $contest->id,
                    'college_id' => $collegeId,
                    'created_at' => $now,
                    'updated_at' => $now,
                ])->all()
            );
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('contest_colleges');
    }
};
