<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The finalized outcome of a reviewer scoring every response in a track
 * round's session — see InterviewTrackAdvancementService::finalizeAndAdvance().
 * `reviewed_at` is the idempotency guard (same role as Contest.finalized_at):
 * once set, finalizing again is a no-op. `advanced` is a cached convenience
 * flag computed once at finalize time (same "computed once, cached"
 * precedent as ContestParticipant.score/rank), not a live source of truth —
 * re-deriving it always means re-running finalize logic, never reading this
 * column as authoritative on its own. All four columns stay null/false
 * forever for a standalone (non-track) interview's sessions.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('interview_sessions', function (Blueprint $table) {
            $table->decimal('composite_score_percent', 5, 2)->nullable()->after('current_question_order');
            $table->dateTime('reviewed_at')->nullable()->after('composite_score_percent');
            $table->foreignId('reviewed_by')->nullable()->after('reviewed_at')->constrained('users')->nullOnDelete();
            $table->boolean('advanced')->default(false)->after('reviewed_by');
        });
    }

    public function down(): void
    {
        Schema::table('interview_sessions', function (Blueprint $table) {
            $table->dropConstrainedForeignId('reviewed_by');
            $table->dropColumn(['composite_score_percent', 'reviewed_at', 'advanced']);
        });
    }
};
