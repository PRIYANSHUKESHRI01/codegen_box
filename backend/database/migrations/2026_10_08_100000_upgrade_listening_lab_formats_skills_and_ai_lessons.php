<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Listening Lab production upgrade. Purely additive: every existing lesson
 * and attempt keeps working unchanged (new columns are nullable or default to
 * the old behaviour).
 *
 * listening_lessons
 *  - `format`: comprehension (one speaker + multiple choice, what every
 *    pre-existing lesson is), conversation (two or three speakers, multiple
 *    choice) or dictation (hear a sentence, type it).
 *  - `speakers` / `script`: for conversations only — who is talking and the
 *    ordered turns. `passage_text` stays the full spoken text for every
 *    format, so older readers of the row still see a complete transcript.
 *  - `user_id` / `source` / `interest`: lessons can be generated for one
 *    student around their own topic (private to `user_id`; NULL = the shared
 *    library everyone sees), exactly like speaking_prompts.
 *
 * listening_attempts
 *  - `mode`: practice (replay freely) or exam (limited plays, like a real
 *    assessment). `plays_used` is what the client reported, kept for the
 *    student's own history, never trusted for scoring.
 *  - `skill_breakdown`: [{skill, correct, total}] for this attempt, so the
 *    student's skill profile is a cheap aggregate instead of re-reading every
 *    lesson's answer key.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('listening_lessons', function (Blueprint $table) {
            $table->foreignId('user_id')->nullable()->after('id')->constrained()->cascadeOnDelete();
            $table->string('format', 16)->default('comprehension')->after('difficulty'); // comprehension | conversation | dictation
            $table->string('source', 16)->default('library')->after('format'); // library | ai
            $table->string('interest', 120)->nullable()->after('source');
            $table->json('speakers')->nullable()->after('questions'); // [{key,label,gender}] — conversations only
            $table->json('script')->nullable()->after('speakers'); // [{speaker,text}] — conversations only

            $table->index(['source', 'is_active']);
            $table->index(['user_id', 'created_at']);
        });

        Schema::table('listening_attempts', function (Blueprint $table) {
            $table->string('mode', 8)->default('practice')->after('attempt_number'); // practice | exam
            $table->unsignedTinyInteger('plays_used')->nullable()->after('mode');
            $table->json('skill_breakdown')->nullable()->after('passed');
        });
    }

    public function down(): void
    {
        Schema::table('listening_attempts', function (Blueprint $table) {
            $table->dropColumn(['mode', 'plays_used', 'skill_breakdown']);
        });

        Schema::table('listening_lessons', function (Blueprint $table) {
            $table->dropIndex(['source', 'is_active']);
            $table->dropIndex(['user_id', 'created_at']);
            $table->dropConstrainedForeignId('user_id');
            $table->dropColumn(['format', 'source', 'interest', 'speakers', 'script']);
        });
    }
};
