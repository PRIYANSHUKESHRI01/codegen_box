<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Mirrors `interview_responses` — one row per attached question per
 * session, pre-created (empty) for every soft_skill_assessment_question at
 * SoftSkillController::start(), so the student can answer them in any
 * order (see answer()'s autosave-by-id shape, unlike the interview flow's
 * strict current-question gate). `is_correct` is computed once, at
 * submit() time, from the bank's correct_index — never trusted from the
 * client, never recomputed ad hoc elsewhere.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('soft_skill_responses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('soft_skill_session_id')->constrained()->cascadeOnDelete();
            $table->foreignId('soft_skill_assessment_question_id')->constrained()->restrictOnDelete();
            $table->unsignedTinyInteger('selected_index')->nullable();
            $table->boolean('is_correct')->nullable();
            $table->dateTime('answered_at')->nullable();
            $table->timestamps();

            $table->unique(['soft_skill_session_id', 'soft_skill_assessment_question_id'], 'soft_skill_responses_session_question_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('soft_skill_responses');
    }
};
