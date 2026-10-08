<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Speaking Practice production upgrade.
 *
 * speaking_prompts: passages can now be generated for one student around their
 * own interest/target role. `user_id` NULL = the shared library everyone sees;
 * a value = private to that student (the controller scopes every read and
 * write on it). `source`/`interest` record where a passage came from.
 *
 * speaking_attempts: scoring is now audio-first (see
 * GeminiSpeakingScoringService). `heard_transcript` is what the model actually
 * heard (the browser's transcript stays in `transcript_text` for reference
 * only), `word_feedback` holds the per-word alignment + notes the result screen
 * renders, and `scored_with_audio` replaces "does an audio file exist" now
 * that recordings are deleted right after scoring (`audio_path` is kept only
 * for rows created before this change).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('speaking_prompts', function (Blueprint $table) {
            $table->foreignId('user_id')->nullable()->after('id')->constrained()->cascadeOnDelete();
            $table->string('source', 16)->default('library')->after('difficulty'); // library | ai
            $table->string('interest', 120)->nullable()->after('source');

            $table->index(['user_id', 'created_at']);
        });

        Schema::table('speaking_attempts', function (Blueprint $table) {
            $table->text('heard_transcript')->nullable()->after('transcript_text');
            $table->json('word_feedback')->nullable()->after('improvement_tips');
            $table->unsignedSmallInteger('filler_count')->nullable()->after('pacing_wpm');
            $table->boolean('scored_with_audio')->default(false)->after('passed');
        });
    }

    public function down(): void
    {
        Schema::table('speaking_attempts', function (Blueprint $table) {
            $table->dropColumn(['heard_transcript', 'word_feedback', 'filler_count', 'scored_with_audio']);
        });

        Schema::table('speaking_prompts', function (Blueprint $table) {
            $table->dropIndex(['user_id', 'created_at']);
            $table->dropConstrainedForeignId('user_id');
            $table->dropColumn(['source', 'interest']);
        });
    }
};
