<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * One row per recording the student submits — mirrors interview_responses'
 * "always keep the transcript, audio is opportunistic" shape. Scored
 * synchronously by GeminiSpeakingScoringService (not queued — see
 * SpeakingPracticeController::submit(), same weight as the existing
 * synchronous GeminiQuestionGeneratorService call, unlike the queued
 * whole-session ScoreInterviewSessionJob). scoring_failed_at mirrors
 * interview_sessions' column of the same name — set instead of the score
 * columns if Gemini fails, so the frontend can show an honest retry state
 * rather than a fabricated score.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('speaking_attempts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('speaking_prompt_id')->constrained()->restrictOnDelete();
            $table->unsignedInteger('attempt_number')->default(1);
            $table->text('transcript_text')->nullable();
            $table->string('audio_path')->nullable();
            $table->unsignedInteger('duration_seconds')->nullable();
            $table->unsignedSmallInteger('pacing_wpm')->nullable();
            $table->unsignedTinyInteger('overall_score')->nullable();
            $table->unsignedTinyInteger('clarity_score')->nullable();
            $table->unsignedTinyInteger('fluency_score')->nullable();
            $table->unsignedTinyInteger('accuracy_score')->nullable();
            $table->text('feedback')->nullable();
            $table->json('improvement_tips')->nullable();
            $table->boolean('passed')->default(false);
            $table->dateTime('scored_at')->nullable();
            $table->dateTime('scoring_failed_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'speaking_prompt_id']);
            $table->index(['user_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('speaking_attempts');
    }
};
