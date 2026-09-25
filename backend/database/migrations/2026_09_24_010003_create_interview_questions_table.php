<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Mirrors `contest_problems` — attaches a bank question into one specific
 * Interview instance. No `points` column: unlike a contest problem, nothing
 * here is auto-scored (see InterviewResponse — a human reviews the
 * transcript/audio and manually moves DriveApplication.stage).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('interview_questions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('interview_id')->constrained()->cascadeOnDelete();
            $table->foreignId('interview_question_bank_id')->constrained('interview_question_banks')->restrictOnDelete();
            $table->unsignedInteger('display_order')->default(0);
            $table->timestamps();

            $table->unique(['interview_id', 'interview_question_bank_id'], 'interview_questions_interview_bank_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('interview_questions');
    }
};
