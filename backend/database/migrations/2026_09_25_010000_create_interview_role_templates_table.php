<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A reusable, structured role definition (e.g. "Backend Developer — Laravel
 * & Next.js") that drives BOTH consistent AI question generation AND
 * consistent scoring weights across every candidate applying to that role,
 * replacing the free-text `role`/`role_title` string used everywhere else
 * today (see PlacementDrive.role_title, InterviewQuestionGenerationController).
 * `rounds_config` is a JSON array of exactly 3 round definitions (see
 * App\Models\InterviewRoleTemplate for the shape and validation) — it is
 * COPIED onto each round Interview at track-creation time
 * (see AdminInterviewTrackController::store()), never read live from here
 * afterward, same "snapshot, don't live-reference" convention
 * ContestProblem already uses for points.
 *
 * Ownership mirrors Interview/Contest's 3-way axis: both owning_* columns
 * null = Mellow-curated, usable by everyone; owning_company_id set = a
 * company's own private template; owning_college_id set = a TPO's own
 * private template for their college's mock tracks.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('interview_role_templates', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->text('description')->nullable();
            $table->json('tech_stack_tags')->nullable();
            $table->json('rounds_config');
            $table->foreignId('owning_college_id')->nullable()->constrained('colleges')->nullOnDelete();
            $table->foreignId('owning_company_id')->nullable()->constrained('companies')->nullOnDelete();
            $table->boolean('is_active')->default(true);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('owning_college_id');
            $table->index('owning_company_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('interview_role_templates');
    }
};
