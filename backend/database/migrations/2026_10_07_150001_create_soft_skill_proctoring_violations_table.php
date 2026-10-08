<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The full timeline of every proctoring event for a Soft Skills attempt —
 * mirrors `interview_proctoring_violations`. `counted_toward_lock` is kept
 * denormalized per row (not re-derived from the current strike-type list) so
 * a future change to which types count as strikes never rewrites history for
 * a past attempt.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('soft_skill_proctoring_violations', function (Blueprint $table) {
            $table->id();
            // Explicit short FK/index names — the generated ones (table +
            // column + suffix) exceed MySQL's 64-character identifier limit
            // for this table/column pairing.
            $table->foreignId('soft_skill_proctoring_session_id')->constrained('soft_skill_proctoring_sessions', 'id', 'sspv_proctoring_session_foreign')->cascadeOnDelete();
            $table->string('type'); // See App\Models\ProctoringViolation::TYPES (shared list)
            $table->boolean('counted_toward_lock')->default(false);
            $table->string('ip_address', 45)->nullable();
            $table->json('meta')->nullable();
            $table->dateTime('occurred_at');
            $table->timestamps();

            $table->index(['soft_skill_proctoring_session_id', 'occurred_at'], 'sspv_session_occurred_at_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('soft_skill_proctoring_violations');
    }
};
