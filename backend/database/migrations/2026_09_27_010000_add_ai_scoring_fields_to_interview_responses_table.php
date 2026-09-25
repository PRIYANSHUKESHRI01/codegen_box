<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * `ai_scored` distinguishes a Gemini-scored response (ScoreInterviewSessionJob)
 * from a human-scored one (AdminInterviewController::scoreResponse() et al,
 * see 2026_09_25_040000's docblock) — both write the SAME `score`/
 * `review_notes`/`scored_at` columns, this just records which one did it
 * last. `scored_by` stays null for an AI-only score (no User row to point
 * at); it's only ever set when a human opens ReviewSessionsModal and saves
 * an edit, which also flips `ai_scored` back to false (their score, not
 * Gemini's, is now the record).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('interview_responses', function (Blueprint $table) {
            $table->boolean('ai_scored')->default(false)->after('scored_at');
        });
    }

    public function down(): void
    {
        Schema::table('interview_responses', function (Blueprint $table) {
            $table->dropColumn('ai_scored');
        });
    }
};
