<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The full timeline of every proctoring event for an interview session —
 * mirrors `proctoring_violations` exactly. `counted_toward_lock` is kept
 * denormalized per row (not re-derived from the current strike-type list)
 * so a future change to which types count as strikes never rewrites
 * history for a past interview.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('interview_proctoring_violations', function (Blueprint $table) {
            $table->id();
            // Explicit short FK/index names — the natural Laravel-generated
            // names (table + column + suffix) exceed MySQL's 64-char
            // identifier limit for this particular table/column pairing.
            $table->foreignId('interview_proctoring_session_id')->constrained('interview_proctoring_sessions', 'id', 'ipv_proctoring_session_foreign')->cascadeOnDelete();
            // Which question the candidate was on when this fired — nullOnDelete since a bank question is soft-deactivated, not hard-deleted, but this stays defensive.
            $table->foreignId('interview_question_id')->nullable()->constrained()->nullOnDelete();
            $table->string('type'); // See App\Models\InterviewProctoringViolation::TYPES
            $table->boolean('counted_toward_lock')->default(false);
            $table->string('ip_address', 45)->nullable();
            $table->json('meta')->nullable();
            $table->dateTime('occurred_at');
            $table->timestamps();

            $table->index(['interview_proctoring_session_id', 'occurred_at'], 'ipv_session_occurred_at_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('interview_proctoring_violations');
    }
};
