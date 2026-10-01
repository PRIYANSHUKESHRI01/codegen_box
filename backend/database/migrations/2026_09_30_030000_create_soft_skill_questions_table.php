<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Soft Skills — the shared, permanent question bank, mirroring
 * `interview_question_banks` exactly, but option-based rather than spoken:
 * `options` + `correct_index` instead of a free-form expected answer, since
 * grading here is exact-match verification, never AI judgement (see
 * SoftSkillController::submit()). `explanation` is shown to the student only
 * after they've answered — real prep value, same posture as Learning
 * Centre's listening_lessons.questions. Shared across every authoring role
 * (Ops/TPO/Company), same trust model as interview_question_banks.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('soft_skill_questions', function (Blueprint $table) {
            $table->id();
            $table->string('category'); // aptitude | reasoning | english | situational
            $table->string('difficulty')->default('medium'); // easy | medium | hard
            $table->text('question_text');
            $table->json('options'); // exactly 4 strings
            $table->unsignedTinyInteger('correct_index');
            $table->text('explanation')->nullable();
            $table->boolean('is_active')->default(true);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['category', 'is_active']);
            $table->index('difficulty');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('soft_skill_questions');
    }
};
