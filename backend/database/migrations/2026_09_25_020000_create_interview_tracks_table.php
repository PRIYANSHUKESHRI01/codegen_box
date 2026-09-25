<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The "Final Interview" container — a fixed 3-round pipeline (Screening ->
 * Deep Technical -> Final/HR). Structural sibling of `interviews` (see that
 * migration's docblock) sharing the same 4-way ownership pattern (general |
 * company | tpo_mock | company_hiring — no `talent_pool`, see
 * App\Models\InterviewTrack's docblock for why), but this table owns
 * visibility/ownership ONCE per track rather than once per round: each of
 * its 3 rounds is a completely ordinary `interviews` row
 * (see 2026_09_25_030000_add_track_fields_to_interviews_table) tagged with
 * `interview_track_id`, inheriting this row's identity rather than carrying
 * its own independent ownership. `role_title` is a display-only snapshot of
 * the picked InterviewRoleTemplate's name (or a free-typed role when no
 * template was used) — not re-derived from the template afterward.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('interview_tracks', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->string('slug')->unique();
            $table->text('description')->nullable();
            $table->string('status')->default('draft'); // draft | published | cancelled
            $table->string('track_type')->default('general'); // general | company | tpo_mock | company_hiring
            $table->string('role_title')->nullable();
            $table->foreignId('interview_role_template_id')->nullable()->constrained('interview_role_templates')->nullOnDelete();
            $table->foreignId('company_id')->nullable()->constrained('companies')->nullOnDelete();
            $table->foreignId('placement_drive_id')->nullable()->constrained('placement_drives')->nullOnDelete();
            $table->foreignId('owning_college_id')->nullable()->constrained('colleges')->nullOnDelete();
            $table->foreignId('owning_company_id')->nullable()->constrained('companies')->nullOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('track_type');
            $table->index('owning_college_id');
            $table->index('owning_company_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('interview_tracks');
    }
};
