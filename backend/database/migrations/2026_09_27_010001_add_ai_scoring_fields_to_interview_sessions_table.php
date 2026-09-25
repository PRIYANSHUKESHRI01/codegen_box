<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * `ai_scored_at` — when ScoreInterviewSessionJob successfully finished
 * scoring this session, distinct from `reviewed_at` (a HUMAN's own review —
 * see 2026_09_25_040001) which stays fully supported and unchanged; both
 * can be set (a human opened an already-AI-scored session and confirmed/
 * edited it). `scoring_failed_at` — set instead of ai_scored_at if the
 * Gemini call fails or returns unusable data, so GET /interviews/{i}/result
 * can tell the frontend to stop polling and fall back to "a person will
 * review this" rather than spinning forever.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('interview_sessions', function (Blueprint $table) {
            $table->dateTime('ai_scored_at')->nullable()->after('advanced');
            $table->dateTime('scoring_failed_at')->nullable()->after('ai_scored_at');
        });
    }

    public function down(): void
    {
        Schema::table('interview_sessions', function (Blueprint $table) {
            $table->dropColumn(['ai_scored_at', 'scoring_failed_at']);
        });
    }
};
