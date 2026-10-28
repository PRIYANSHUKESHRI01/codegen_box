<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * The two scores a college will want to filter and rank students by, kept ON the student so a list can be filtered, sorted and
 * exported with one indexed column instead of scoring every student first:
 *
 *  - readiness_score      the student's latest readiness score (0-100). Written whenever readiness is worked out for them
 *                         (the scheduled refresh, opening their Vault page, the Vault AI Interview's access check) - only when it changed.
 *  - vault_ai_score       their best Vault AI Interview series average (0-100): the mean of the three sets of a series, kept
 *                         when a series is completed - whether it qualified them or not.
 *
 * Neither replaces its source of truth (ReadinessScoreService; vault_interview_qualifications / vault_profiles): they are the
 * latest answer, remembered. The timestamps say how fresh each is.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->unsignedTinyInteger('readiness_score')->nullable()->after('vault_ai_unlocked_at')->index();
            $table->timestamp('readiness_scored_at')->nullable()->after('readiness_score');
            $table->decimal('vault_ai_score', 5, 2)->nullable()->after('readiness_scored_at')->index();
            $table->timestamp('vault_ai_scored_at')->nullable()->after('vault_ai_score');
        });

        // Students who already have scores on file are not left blank until their next visit.
        if (Schema::hasTable('vault_interview_qualifications')) {
            DB::statement('UPDATE users SET vault_ai_score = (SELECT MAX(q.series_average) FROM vault_interview_qualifications q WHERE q.user_id = users.id AND q.series_average IS NOT NULL), vault_ai_scored_at = CURRENT_TIMESTAMP WHERE EXISTS (SELECT 1 FROM vault_interview_qualifications q2 WHERE q2.user_id = users.id AND q2.series_average IS NOT NULL)');
        }

        if (Schema::hasTable('readiness_snapshots')) {
            DB::statement('UPDATE users SET readiness_score = (SELECT s.score FROM readiness_snapshots s WHERE s.user_id = users.id ORDER BY s.snapshot_date DESC LIMIT 1), readiness_scored_at = CURRENT_TIMESTAMP WHERE EXISTS (SELECT 1 FROM readiness_snapshots s2 WHERE s2.user_id = users.id)');
        }
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex(['readiness_score']);
            $table->dropIndex(['vault_ai_score']);
            $table->dropColumn(['readiness_score', 'readiness_scored_at', 'vault_ai_score', 'vault_ai_scored_at']);
        });
    }
};
