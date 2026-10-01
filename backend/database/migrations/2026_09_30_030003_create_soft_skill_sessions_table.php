<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Mirrors `interview_sessions` — one row per candidate attempt. No
 * `invited_at`/`invited_by`/`current_question_order` equivalents: unlike
 * the strictly-linear voice interview, an MCQ test lets a student navigate
 * freely between questions (see SoftSkillController::answer()), and there's
 * no invite step in v1 (see the assessments migration's docblock on
 * targeting). `category_breakdown` is computed once at submit() time —
 * e.g. {"aptitude":{"correct":17,"total":20}} — so the results screen and
 * the Reports card never have to re-derive it from raw responses.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('soft_skill_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('soft_skill_assessment_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('status')->default('in_progress'); // in_progress | completed
            $table->unsignedInteger('attempt_number')->default(1);
            $table->dateTime('started_at');
            $table->dateTime('completed_at')->nullable();
            $table->decimal('score_percent', 5, 2)->nullable();
            $table->boolean('passed')->default(false);
            $table->json('category_breakdown')->nullable();
            $table->timestamps();

            $table->index(['soft_skill_assessment_id', 'user_id']);
            $table->index(['user_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('soft_skill_sessions');
    }
};
