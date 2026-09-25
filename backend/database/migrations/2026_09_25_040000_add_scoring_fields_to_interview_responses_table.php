<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * v1 scoring is 100% human-reviewed (no Gemini/AI grading, to control API
 * cost) — a reviewer listens/reads a response and assigns `score` 0-100
 * against the round's category-weighted rubric (see
 * InterviewTrackAdvancementService::computeWeightedComposite()). Only ever
 * populated for a response to a track-round question — a standalone
 * interview's responses keep these columns null forever, matching
 * Interview's "nothing here scores an answer" posture for non-track rows.
 * Named `score`, not `human_score`: a future AI-assisted-scoring phase adds
 * a sibling `ai_score`/`ai_score_rationale` column later, additively — no
 * rename needed here.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('interview_responses', function (Blueprint $table) {
            $table->unsignedTinyInteger('score')->nullable()->after('answered_at');
            $table->text('review_notes')->nullable()->after('score');
            $table->foreignId('scored_by')->nullable()->after('review_notes')->constrained('users')->nullOnDelete();
            $table->dateTime('scored_at')->nullable()->after('scored_by');
        });
    }

    public function down(): void
    {
        Schema::table('interview_responses', function (Blueprint $table) {
            $table->dropConstrainedForeignId('scored_by');
            $table->dropColumn(['score', 'review_notes', 'scored_at']);
        });
    }
};
