<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Unlike speaking_prompts/listening_lessons, Vocabulary Sprint has no
 * standing content bank — GeminiVocabularyQuizService generates a fresh quiz
 * per attempt. `questions` is persisted in FULL (including correct_index and
 * explanation) the moment VocabularyController::generate() creates this row,
 * so submit() can grade against the server-held answer key instead of
 * trusting anything the client sends back — generate() only ever returns the
 * answer-stripped version to the browser.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vocabulary_attempts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('topic');
            $table->string('difficulty'); // beginner | intermediate | advanced
            $table->json('questions'); // [{word, sentence, options[4], correct_index, explanation}], full answer key
            $table->json('answers')->nullable(); // filled on submit
            $table->unsignedTinyInteger('score')->nullable();
            $table->boolean('passed')->default(false);
            $table->dateTime('submitted_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vocabulary_attempts');
    }
};
