<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('college_assessments')) {
            Schema::create('college_assessments', function (Blueprint $table) {
                $table->id();
                $table->string('slug', 190)->unique();
                $table->string('title', 255);
                $table->text('description')->nullable();
                $table->string('status', 20)->default('draft'); // draft | published | closed
                $table->dateTime('starts_at')->nullable();
                $table->dateTime('ends_at')->nullable();
                $table->boolean('enforce_sequence')->default(false);
                $table->decimal('passing_score_percent', 5, 2)->default(60.00);
                $table->json('target_scope')->nullable();

                // Module 1: Soft Skills
                $table->boolean('include_soft_skills')->default(false);
                $table->foreignId('soft_skill_assessment_id')->nullable()->constrained('soft_skill_assessments')->nullOnDelete();
                $table->unsignedTinyInteger('soft_skill_weight')->default(0);
                $table->json('soft_skill_config')->nullable();

                // Module 2: Coding Test
                $table->boolean('include_coding')->default(false);
                $table->foreignId('contest_id')->nullable()->constrained('contests')->nullOnDelete();
                $table->unsignedTinyInteger('coding_weight')->default(0);
                $table->json('coding_config')->nullable();

                // Module 3: AI Interview
                $table->boolean('include_interview')->default(false);
                $table->foreignId('interview_id')->nullable()->constrained('interviews')->nullOnDelete();
                $table->unsignedTinyInteger('interview_weight')->default(0);
                $table->json('interview_config')->nullable();

                $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
                $table->dateTime('published_at')->nullable();
                $table->timestamps();

                $table->index(['status', 'created_at'], 'college_assessments_status_created_idx');
            });
        }

        if (! Schema::hasTable('college_assessment_assignments')) {
            Schema::create('college_assessment_assignments', function (Blueprint $table) {
                $table->id();
                $table->foreignId('college_assessment_id')->constrained('college_assessments')->cascadeOnDelete();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->string('status', 24)->default('assigned'); // assigned | in_progress | completed

                $table->foreignId('soft_skill_session_id')->nullable()->constrained('soft_skill_sessions')->nullOnDelete();
                $table->decimal('soft_skill_score_percent', 5, 2)->nullable();

                $table->foreignId('contest_participant_id')->nullable()->constrained('contest_participants')->nullOnDelete();
                $table->unsignedInteger('coding_points')->nullable();
                $table->unsignedInteger('coding_max_points')->nullable();
                $table->decimal('coding_score_percent', 5, 2)->nullable();

                $table->foreignId('interview_session_id')->nullable()->constrained('interview_sessions')->nullOnDelete();
                $table->decimal('interview_score_percent', 5, 2)->nullable();

                $table->decimal('overall_score_percent', 5, 2)->nullable();
                $table->dateTime('started_at')->nullable();
                $table->dateTime('completed_at')->nullable();
                $table->timestamps();

                $table->unique(['college_assessment_id', 'user_id'], 'college_assessment_user_unique');
                $table->index(['user_id', 'status'], 'college_assessment_assign_user_status_idx');
                $table->index(['college_assessment_id', 'status'], 'college_assessment_assign_assess_status_idx');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('college_assessment_assignments');
        Schema::dropIfExists('college_assessments');
    }
};
