<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Soft Skills — structural sibling of `interviews` (see that migration's
 * docblock): the same 3-way ownership shape (general | tpo_mock | company),
 * minus interview_tracks' round/qualifying-score machinery, which has no
 * equivalent here — a soft skill test is never a multi-round pipeline.
 *
 * Deliberately simpler than Interview's `company` type: no
 * placement_drive_id / explicit college-picker here — visibility for a
 * `company`-type assessment is "any college with an approved, active
 * DriveCollegeMapping to ANY of this company's drives" (see
 * SoftSkillAssessment::isVisibleToUser()), not one specific drive's curated
 * college list. A deliberate v1 simplification (see the feature's plan
 * doc) — per-assessment targeting is a real fast-follow, not built now.
 *
 * `max_attempts` null = unlimited (practice-oriented general/tpo_mock
 * default); company-created tests default to 1 in
 * CompanySoftSkillController::store(), for the same integrity reason a real
 * hiring test shouldn't be infinitely retakeable.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('soft_skill_assessments', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->string('slug')->unique();
            $table->text('description')->nullable();
            $table->string('status')->default('draft'); // draft | published | cancelled
            $table->string('assessment_type')->default('general'); // general | tpo_mock | company
            $table->foreignId('owning_college_id')->nullable()->constrained('colleges')->nullOnDelete();
            $table->foreignId('owning_company_id')->nullable()->constrained('companies')->nullOnDelete();
            $table->unsignedSmallInteger('duration_minutes')->default(45);
            $table->unsignedTinyInteger('pass_percentage')->default(60);
            $table->unsignedTinyInteger('max_attempts')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('assessment_type');
            $table->index('owning_college_id');
            $table->index('owning_company_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('soft_skill_assessments');
    }
};
