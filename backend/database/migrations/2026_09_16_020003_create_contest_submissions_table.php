<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Deliberately a SEPARATE table from the practice `submissions` table, not
 * a shared one distinguished by a nullable contest_id. Contest scoring
 * needs the full multi-attempt history per (user, contest_problem) — ICPC-
 * style penalty is 10 minutes per wrong attempt before the accepted one —
 * and `submissions` unique(user_id, problem_id, submitted_on) constraint
 * (only the day's latest status survives) is fundamentally incompatible
 * with that. `submitted_at` is a full datetime (not a date, unlike
 * `submissions.submitted_on`) because contest penalty math needs
 * minute-level precision from contest start.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('contest_submissions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('contest_id')->constrained()->cascadeOnDelete();
            $table->foreignId('contest_problem_id')->constrained()->restrictOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('language');
            $table->string('status'); // accepted | wrong_answer | runtime_error | compile_error — see App\Models\ContestSubmission
            $table->dateTime('submitted_at');
            $table->integer('points_awarded')->nullable();
            $table->timestamps();

            $table->index(['contest_id', 'user_id', 'submitted_at']);
            $table->index(['contest_problem_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('contest_submissions');
    }
};
