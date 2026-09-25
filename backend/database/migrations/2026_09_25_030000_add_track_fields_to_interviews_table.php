<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Lets an `interviews` row be one round of an InterviewTrack (see that
 * migration's docblock) rather than a standalone interview. All 5 columns
 * are nullable and stay null/inert for every standalone interview that
 * exists today — this migration changes no existing row's behavior.
 *
 * `category_weights`/`qualifying_score_percent` are a scoped, additive
 * reversal of 2026_09_24_060001_add_audience_scope_to_interviews_table's
 * claim that "an AI interview is never auto-scored... never gates anything
 * itself" — that remains true for every interview with `interview_track_id`
 * null. Only a track round is scored (by a human, see
 * 2026_09_25_040000_add_scoring_fields_to_interview_responses_table) and
 * gates advancement to the next round (see InterviewTrackAdvancementService).
 * Both columns are SNAPSHOTTED from InterviewRoleTemplate.rounds_config at
 * track-creation time, never read live from the template afterward — same
 * convention ContestProblem uses for points.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('interviews', function (Blueprint $table) {
            $table->foreignId('interview_track_id')->nullable()->after('id')->constrained('interview_tracks')->cascadeOnDelete();
            $table->unsignedTinyInteger('round_number')->nullable()->after('interview_track_id');
            $table->string('round_name')->nullable()->after('round_number');
            $table->json('category_weights')->nullable()->after('round_name');
            $table->decimal('qualifying_score_percent', 5, 2)->nullable()->after('category_weights');

            $table->index(['interview_track_id', 'round_number']);
        });
    }

    public function down(): void
    {
        Schema::table('interviews', function (Blueprint $table) {
            $table->dropConstrainedForeignId('interview_track_id');
            $table->dropColumn(['round_number', 'round_name', 'category_weights', 'qualifying_score_percent']);
        });
    }
};
