<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * One row per (candidate, company) relationship once a hiring partner has
 * acted on a Talent Pool profile — the CRM-style record backing every
 * "Express Interest / Schedule HR Interview / Hire" action in
 * CompanyTalentPoolController. Unique on (talent_pool_candidate_id,
 * company_id): further actions from the same company update this same row
 * rather than creating a parallel one, so a company's relationship with a
 * given candidate always has exactly one current status.
 *
 * Deliberately its own model rather than reusing DriveApplication/
 * PlacementDrive — a Talent Pool hire isn't tied to any job opening the
 * company created, so forcing it through that pipeline would mean silently
 * fabricating a placement_drives row per company. Kept purpose-built and
 * legible instead, same way LeadNote/ActivityLog are each their own small
 * table rather than overloaded generic ones.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('talent_pool_inquiries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('talent_pool_candidate_id')->constrained('talent_pool_candidates')->cascadeOnDelete();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('initiated_by')->constrained('users')->cascadeOnDelete();
            // interested | interview_scheduled | interview_completed | hired
            // | declined_by_company | declined_by_candidate | withdrawn
            $table->string('status')->default('interested');
            $table->timestamp('interview_scheduled_at')->nullable();
            $table->string('interview_mode')->nullable(); // online | offline
            $table->string('interview_location')->nullable(); // meeting link or physical address
            $table->text('interview_notes')->nullable();
            // The candidate's own accept/decline timestamp on a scheduled
            // interview — see StudentTalentPoolController::respondToInterview().
            $table->timestamp('responded_at')->nullable();
            $table->decimal('ctc_offered', 10, 2)->nullable();
            $table->timestamp('hired_at')->nullable();
            $table->timestamps();

            $table->unique(['talent_pool_candidate_id', 'company_id']);
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('talent_pool_inquiries');
    }
};
