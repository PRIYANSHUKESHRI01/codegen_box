<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Vocabulary Sprint grows from "Gemini quiz, thrown away after scoring" into a
 * word trainer with memory:
 *
 *  - vocabulary_words: a curated library (user_id null, source 'library') plus
 *    private words a student picked up from their own AI quizzes (source 'ai').
 *  - vocabulary_word_progress: one row per student per word — a Leitner box and
 *    the date it is next due. This is what makes review "spaced".
 *  - vocabulary_answers: an append-only log of every answer. It is the single
 *    record of "this question was answered" (unique per attempt+question), and
 *    it feeds the daily goal, accuracy and streak.
 *  - vocabulary_attempts gains `kind`/`deck` so one session model serves daily
 *    sprints, deck sprints, weak-word practice and the original AI quiz.
 *
 * Everything is additive with safe defaults: attempts that already exist keep
 * working as `kind = 'custom'` (they were all AI quizzes).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vocabulary_words', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->cascadeOnDelete();
            $table->string('source', 10)->default('library'); // library | ai
            $table->string('deck', 40)->nullable(); // deck slug; null for a student's own AI words
            $table->string('word', 80);
            $table->string('part_of_speech', 24)->default('word');
            $table->string('level', 16)->default('intermediate'); // beginner | intermediate | advanced
            $table->string('meaning', 255);
            $table->string('example', 300);
            $table->json('synonyms')->nullable();
            $table->json('distractors')->nullable(); // three authored wrong words for the sentence-blank question
            $table->string('pair_word', 80)->nullable(); // the look-alike this word is usually confused with
            $table->string('note', 255)->nullable(); // a usage tip worth remembering
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['source', 'deck', 'sort_order']);
            $table->unique(['user_id', 'source', 'word']);
        });

        Schema::create('vocabulary_word_progress', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('vocabulary_word_id')->constrained('vocabulary_words')->cascadeOnDelete();
            $table->unsignedTinyInteger('box')->default(0); // 0 = just met / lapsed … 5 = long-term memory
            $table->unsignedSmallInteger('streak')->default(0); // consecutive correct answers
            $table->unsignedSmallInteger('seen_count')->default(0);
            $table->unsignedSmallInteger('correct_count')->default(0);
            $table->unsignedSmallInteger('lapse_count')->default(0);
            $table->dateTime('last_seen_at')->nullable();
            $table->date('due_on')->nullable();
            $table->dateTime('mastered_at')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'vocabulary_word_id']);
            $table->index(['user_id', 'due_on']);
        });

        Schema::create('vocabulary_answers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('vocabulary_attempt_id')->constrained('vocabulary_attempts')->cascadeOnDelete();
            $table->unsignedTinyInteger('question_index');
            $table->foreignId('vocabulary_word_id')->nullable()->constrained('vocabulary_words')->nullOnDelete();
            $table->string('type', 12); // meaning | word | cloze | recall
            $table->string('response', 120)->nullable(); // what the student chose or typed
            $table->boolean('is_correct');
            $table->unsignedTinyInteger('box_before')->nullable();
            $table->unsignedTinyInteger('box_after')->nullable();
            $table->unsignedInteger('response_ms')->nullable();
            $table->timestamp('created_at')->nullable();

            $table->unique(['vocabulary_attempt_id', 'question_index']);
            $table->index(['user_id', 'created_at']);
        });

        Schema::table('vocabulary_attempts', function (Blueprint $table) {
            $table->string('kind', 12)->default('custom')->after('user_id'); // daily | deck | weak | custom
            $table->string('deck', 40)->nullable()->after('kind');
            $table->json('meta')->nullable()->after('questions'); // {title, new_count, review_count, practice} — how the session was put together
            $table->index(['user_id', 'kind']);
        });
    }

    public function down(): void
    {
        Schema::table('vocabulary_attempts', function (Blueprint $table) {
            $table->dropIndex(['user_id', 'kind']);
            $table->dropColumn(['kind', 'deck', 'meta']);
        });

        Schema::dropIfExists('vocabulary_answers');
        Schema::dropIfExists('vocabulary_word_progress');
        Schema::dropIfExists('vocabulary_words');
    }
};
