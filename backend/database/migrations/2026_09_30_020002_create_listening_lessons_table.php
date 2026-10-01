<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Learning Centre — Listening Lab content bank. `passage_text` is read
 * aloud client-side via the existing VoiceEngine.speak() (browser TTS) —
 * no audio file stored. `questions` is the full answer key (correct_index +
 * explanation included); ListeningLabController::show() strips both before
 * sending to the client so the answer key is never visible in the network
 * tab before submission — see submit()'s server-side grading.
 *
 * Deliberately built on the same VoiceEngine seam used by AI Interviews so a
 * future live Gemini voice agent replaces just this module's playback/
 * interaction, not the whole feature (see the module's "coming soon" badge
 * on the frontend).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('listening_lessons', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->text('passage_text');
            $table->string('category');
            $table->string('difficulty'); // beginner | intermediate | advanced
            $table->json('questions'); // [{question, options[4], correct_index, explanation}]
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('display_order')->default(0);
            $table->timestamps();

            $table->index(['difficulty', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('listening_lessons');
    }
};
