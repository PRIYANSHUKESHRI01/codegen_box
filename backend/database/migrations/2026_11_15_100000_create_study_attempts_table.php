<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * One row per FINISHED sitting of a study set (the Merchant Navy orals), kept for good: the student's score history, and the report they can
 * download after every sitting.
 *
 * Why a table of its own: "Practise this set again" resets the same interview and deletes its answers, and staff can edit or remove a question
 * later, so neither the interview nor the question bank can answer "what did I score on Set 4 last month?". The attempt therefore keeps a
 * SNAPSHOT of what the student was shown and said (`results`: each question with its picture, their answer, the model answer and the match), so an
 * old report is the same report however the set or the bank has changed since.
 *
 * `interview_id` is not a foreign key on purpose: deleting an interview (a college purge, a clean-up) must not delete a student's history.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('study_attempts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->unsignedBigInteger('interview_id')->nullable();
            $table->string('stack_key', 64);
            $table->string('exam_name', 120);
            $table->string('round_id', 120);
            $table->unsignedSmallInteger('set_number');
            $table->string('set_title', 60);
            $table->unsignedTinyInteger('score');
            $table->unsignedSmallInteger('question_count');
            $table->unsignedSmallInteger('answered_count');
            $table->unsignedSmallInteger('green_count')->default(0);
            $table->unsignedSmallInteger('yellow_count')->default(0);
            $table->unsignedSmallInteger('red_count')->default(0);
            $table->unsignedInteger('duration_seconds')->nullable();
            $table->dateTime('completed_at');
            $table->json('results');
            $table->timestamps();

            // The same finished sitting is never recorded twice (a retried request, the backfill command run again).
            $table->unique(['interview_id', 'completed_at'], 'study_attempts_sitting_unique');
            $table->index(['user_id', 'stack_key', 'set_number', 'completed_at'], 'study_attempts_history_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('study_attempts');
    }
};
