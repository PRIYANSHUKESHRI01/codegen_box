<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The real, permanent interview question bank — seeded with realistic
 * placeholder questions now (see InterviewQuestionBankSeeder), with real
 * bulk content fed in later via the same admin CRUD (no LLM generation, no
 * separate bulk-CSV pipeline in v1 — see the plan's deliberate scope cut).
 * A question is attached to a specific Interview via `interview_questions`
 * (the pivot), the same two-table shape `problems` + `contest_problems`
 * already uses.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('interview_question_banks', function (Blueprint $table) {
            $table->id();
            $table->text('question_text');
            $table->string('category'); // technical | behavioral | hr | situational | aptitude
            $table->string('difficulty'); // easy | medium | hard
            $table->unsignedInteger('expected_duration_seconds');
            $table->json('tags')->nullable();
            $table->text('notes_for_reviewer')->nullable();
            $table->boolean('is_active')->default(true);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['category', 'is_active']);
            $table->index('difficulty');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('interview_question_banks');
    }
};
