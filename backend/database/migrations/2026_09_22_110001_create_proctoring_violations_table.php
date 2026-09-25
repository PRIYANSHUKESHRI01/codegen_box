<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The full timeline of every proctoring event for a session — not just the
 * ones that count as a strike (see ProctoringViolation::STRIKE_TYPES).
 * `counted_toward_lock` records, per row, whether THIS event actually
 * incremented the session's violation_count at the time it happened (kept
 * denormalized rather than re-derived, since a future change to which
 * types count as strikes must never rewrite history for past contests).
 * This table (plus device_info on proctoring_sessions) is the entire
 * evidentiary record a TPO/Section Coordinator gets — see
 * SendProctoringViolationReport and TpoProctoringController::show().
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('proctoring_violations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('proctoring_session_id')->constrained()->cascadeOnDelete();
            // Which problem the student was looking at when this fired — nullOnDelete since a problem is never really deleted in this app, but this stays defensive.
            $table->foreignId('contest_problem_id')->nullable()->constrained()->nullOnDelete();
            $table->string('type'); // See App\Models\ProctoringViolation::TYPES
            $table->boolean('counted_toward_lock')->default(false);
            $table->string('ip_address', 45)->nullable();
            $table->json('meta')->nullable();
            $table->dateTime('occurred_at');
            $table->timestamps();

            $table->index(['proctoring_session_id', 'occurred_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('proctoring_violations');
    }
};
