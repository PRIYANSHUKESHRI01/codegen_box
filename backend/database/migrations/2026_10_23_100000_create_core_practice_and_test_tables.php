<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Core Prep on the student side: untimed topic practice (every answer is kept, so mastery can be
 * measured), and timed, proctored tests with a server-enforced deadline.
 *
 * The test tables mirror the Soft Skills ones on purpose — owner tiers (Mellow `general`, a college's
 * `tpo_mock`), a published/draft lifecycle, sessions + per-question responses, and a proctoring sibling —
 * but are separate tables: the soft-skills engine is single-answer, four-option and its scores feed the
 * Soft Skills readiness component, none of which fits a numerical or multi-select question.
 *
 *  • core_tests / core_test_questions — a test is a FIXED list of published questions (picked by hand or
 *    drawn from a blueprint when it is built), so every student takes the same paper.
 *  • core_test_sessions / core_test_responses — one attempt; each response carries its own shuffled option
 *    order so neighbours in a lab do not see identical screens. The clock is `deadline_at`, enforced server-side.
 *  • core_test_proctoring_* — consent, strikes and lock, same vocabulary as every other proctored thing here.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('core_practice_answers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('core_question_id')->constrained('core_questions')->cascadeOnDelete();
            // Denormalised so mastery is one grouped query, not a join per student.
            $table->unsignedBigInteger('subject_id');
            $table->unsignedBigInteger('topic_id')->nullable();
            $table->json('selected')->nullable();
            $table->decimal('numeric_value', 20, 6)->nullable();
            $table->boolean('is_correct');
            $table->unsignedSmallInteger('time_taken_seconds')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'created_at']);
            $table->index(['user_id', 'subject_id', 'topic_id']);
            $table->index(['user_id', 'core_question_id']);
        });

        Schema::create('core_tests', function (Blueprint $table) {
            $table->id();
            $table->string('public_id', 26)->unique();
            $table->string('slug', 190)->unique();
            $table->string('title', 255);
            $table->text('description')->nullable();
            $table->string('discipline_code', 20)->index();
            $table->string('status', 12)->default('draft');
            // general = written by Mellow for every student of the family; tpo_mock = a college's own.
            $table->string('test_type', 12)->default('general');
            $table->unsignedBigInteger('owning_college_id')->nullable()->index();
            $table->unsignedSmallInteger('duration_minutes')->default(60);
            $table->unsignedTinyInteger('pass_percentage')->default(40);
            $table->boolean('shuffle_options')->default(true);
            $table->boolean('shuffle_questions')->default(false);
            $table->unsignedTinyInteger('max_attempts')->nullable();
            $table->dateTime('available_from')->nullable();
            $table->dateTime('available_until')->nullable();
            $table->json('branch_audience')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['status', 'test_type']);
        });

        Schema::create('core_test_questions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('core_test_id')->constrained('core_tests')->cascadeOnDelete();
            $table->foreignId('core_question_id')->constrained('core_questions')->restrictOnDelete();
            $table->unsignedSmallInteger('position');
            $table->string('section', 150)->nullable();
            $table->timestamps();

            $table->unique(['core_test_id', 'core_question_id']);
            $table->index(['core_test_id', 'position']);
        });

        Schema::create('core_test_sessions', function (Blueprint $table) {
            $table->id();
            $table->string('public_id', 26)->unique();
            $table->foreignId('core_test_id')->constrained('core_tests')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('attempt_number')->default(1);
            $table->string('status', 12)->default('in_progress');
            $table->dateTime('started_at');
            $table->dateTime('deadline_at');
            $table->dateTime('completed_at')->nullable();
            $table->decimal('score', 8, 2)->nullable();
            $table->decimal('max_score', 8, 2)->default(0);
            $table->decimal('score_percent', 5, 2)->nullable();
            $table->boolean('passed')->nullable();
            $table->unsignedSmallInteger('correct_count')->default(0);
            $table->unsignedSmallInteger('wrong_count')->default(0);
            $table->unsignedSmallInteger('skipped_count')->default(0);
            $table->json('subject_breakdown')->nullable();
            $table->boolean('terminated_by_proctoring')->default(false);
            $table->timestamps();

            $table->unique(['core_test_id', 'user_id', 'attempt_number']);
            $table->index(['user_id', 'status']);
            $table->index(['status', 'deadline_at']);
        });

        Schema::create('core_test_responses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('core_test_session_id')->constrained('core_test_sessions')->cascadeOnDelete();
            $table->foreignId('core_question_id')->constrained('core_questions')->restrictOnDelete();
            $table->unsignedSmallInteger('position');
            $table->json('option_order')->nullable();
            $table->json('selected')->nullable();
            $table->decimal('numeric_value', 20, 6)->nullable();
            $table->boolean('marked_for_review')->default(false);
            $table->unsignedInteger('time_spent_seconds')->default(0);
            $table->dateTime('answered_at')->nullable();
            $table->boolean('is_correct')->nullable();
            $table->decimal('marks_awarded', 6, 2)->nullable();
            $table->timestamps();

            $table->unique(['core_test_session_id', 'core_question_id'], 'core_responses_session_question_unique');
            $table->index(['core_test_session_id', 'position']);
            $table->index('core_question_id');
        });

        Schema::create('core_test_proctoring_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('core_test_session_id')->constrained('core_test_sessions', 'id', 'ctps_session_foreign')->cascadeOnDelete();
            $table->string('status')->default('active'); // active | locked | completed
            $table->dateTime('consented_at')->nullable();
            $table->unsignedInteger('violation_count')->default(0);
            $table->dateTime('locked_at')->nullable();
            $table->dateTime('completed_at')->nullable();
            $table->json('device_info')->nullable();
            $table->timestamps();

            $table->unique('core_test_session_id', 'ctps_session_unique');
            $table->index('status');
        });

        Schema::create('core_test_proctoring_violations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('core_test_proctoring_session_id')->constrained('core_test_proctoring_sessions', 'id', 'ctpv_proctoring_session_foreign')->cascadeOnDelete();
            $table->string('type');
            $table->boolean('counted_toward_lock')->default(false);
            $table->string('ip_address', 45)->nullable();
            $table->json('meta')->nullable();
            $table->dateTime('occurred_at');
            $table->timestamps();

            $table->index(['core_test_proctoring_session_id', 'occurred_at'], 'ctpv_session_occurred_at_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('core_test_proctoring_violations');
        Schema::dropIfExists('core_test_proctoring_sessions');
        Schema::dropIfExists('core_test_responses');
        Schema::dropIfExists('core_test_sessions');
        Schema::dropIfExists('core_test_questions');
        Schema::dropIfExists('core_tests');
        Schema::dropIfExists('core_practice_answers');
    }
};
