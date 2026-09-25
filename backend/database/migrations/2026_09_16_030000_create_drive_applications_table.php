<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The real placement pipeline — replaces the previously 100%-fictional
 * PLACEMENT_FUNNEL/RECENT_PLACEMENTS/etc mock data. No automated signal
 * anywhere in this schema can infer "got an interview" or "got an offer",
 * so this is TPO-driven: a stage transition happens when a TPO records it
 * (see DrivePipelineService), the same thing TPOs do in a spreadsheet today.
 *
 * `college_id` is denormalized on purpose — set once from the student's
 * college_id at creation, never re-synced. This mirrors two precedents
 * already in this codebase: `placement_drives.owning_college_id`
 * (denormalized even though derivable via created_by), and
 * ActivityLog snapshotting actor_name/actor_role rather than joining live —
 * a placement report must reflect what was true at the time, not be
 * retroactively reclassified if a student's college is corrected later.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('drive_applications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('placement_drive_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('college_id')->constrained('colleges')->restrictOnDelete();
            $table->string('stage')->default('registered'); // see App\Models\DriveApplication::STAGES
            $table->dateTime('stage_updated_at');
            $table->foreignId('stage_updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->decimal('ctc_offered', 6, 2)->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['placement_drive_id', 'user_id']);
            $table->index(['college_id', 'stage', 'stage_updated_at']);
            $table->index(['placement_drive_id', 'stage']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('drive_applications');
    }
};
