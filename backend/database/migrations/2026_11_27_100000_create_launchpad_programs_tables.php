<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('launchpad_programs')) {
            Schema::create('launchpad_programs', function (Blueprint $table) {
                $table->id();
                $table->string('slug', 190)->unique();
                $table->string('title', 255);
                $table->string('subtitle', 255)->nullable();
                $table->text('description')->nullable();
                $table->string('track', 24)->default('tech'); // tech | non_tech
                $table->string('status', 20)->default('draft'); // draft | published | closed
                $table->unsignedSmallInteger('duration_days')->default(21);
                $table->decimal('min_readiness_percent', 5, 2)->default(60.00);
                $table->decimal('passing_score_percent', 5, 2)->default(60.00);
                $table->boolean('enforce_proctoring')->default(true);
                $table->json('target_scope')->nullable();
                $table->dateTime('starts_at')->nullable();
                $table->dateTime('ends_at')->nullable();
                $table->dateTime('published_at')->nullable();
                $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
                $table->timestamps();

                $table->index(['track', 'status'], 'launchpad_programs_track_status_idx');
            });
        }

        if (! Schema::hasTable('launchpad_program_slots')) {
            Schema::create('launchpad_program_slots', function (Blueprint $table) {
                $table->id();
                $table->foreignId('launchpad_program_id')->constrained('launchpad_programs')->cascadeOnDelete();
                $table->unsignedTinyInteger('assessment_number'); // 1, 2, 3
                $table->unsignedTinyInteger('set_number'); // 1, 2, 3
                $table->foreignId('college_assessment_id')->constrained('college_assessments')->cascadeOnDelete();
                $table->timestamps();

                $table->unique(
                    ['launchpad_program_id', 'assessment_number', 'set_number'],
                    'launchpad_program_slot_unique'
                );
            });
        }

        if (! Schema::hasTable('launchpad_program_enrollments')) {
            Schema::create('launchpad_program_enrollments', function (Blueprint $table) {
                $table->id();
                $table->foreignId('launchpad_program_id')->constrained('launchpad_programs')->cascadeOnDelete();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->foreignId('college_id')->nullable()->constrained('colleges')->nullOnDelete();
                $table->unsignedTinyInteger('rotation_offset')->default(0); // 0, 1, 2
                $table->unsignedTinyInteger('assessment_1_set')->default(1);
                $table->unsignedTinyInteger('assessment_2_set')->default(2);
                $table->unsignedTinyInteger('assessment_3_set')->default(3);
                $table->foreignId('assessment_1_id')->nullable()->constrained('college_assessments')->nullOnDelete();
                $table->foreignId('assessment_2_id')->nullable()->constrained('college_assessments')->nullOnDelete();
                $table->foreignId('assessment_3_id')->nullable()->constrained('college_assessments')->nullOnDelete();
                $table->string('status', 24)->default('enrolled'); // enrolled | in_progress | completed
                $table->dateTime('starts_at')->nullable();
                $table->dateTime('ends_at')->nullable();
                $table->dateTime('last_reminded_at')->nullable();
                $table->timestamps();

                $table->unique(['launchpad_program_id', 'user_id'], 'launchpad_enrollment_program_user_unique');
                $table->index(['launchpad_program_id', 'college_id'], 'launchpad_enrollment_program_college_idx');
                $table->index(['user_id', 'status'], 'launchpad_enrollment_user_status_idx');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('launchpad_program_enrollments');
        Schema::dropIfExists('launchpad_program_slots');
        Schema::dropIfExists('launchpad_programs');
    }
};
