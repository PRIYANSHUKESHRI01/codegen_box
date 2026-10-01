<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Graded deterministically server-side against listening_lessons.questions
 * (exact correct_index match) — no Gemini call, see ListeningLabController.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('listening_attempts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('listening_lesson_id')->constrained()->restrictOnDelete();
            $table->unsignedInteger('attempt_number')->default(1);
            $table->json('answers'); // selected option index per question, in question order
            $table->unsignedTinyInteger('score');
            $table->boolean('passed')->default(false);
            $table->timestamps();

            $table->index(['user_id', 'listening_lesson_id']);
            $table->index(['user_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('listening_attempts');
    }
};
