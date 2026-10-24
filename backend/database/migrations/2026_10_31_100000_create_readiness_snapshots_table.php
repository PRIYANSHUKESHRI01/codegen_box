<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A student's readiness score, one row per student per day.
 *
 * The score itself is never stored as the source of truth — it is computed from what the student did (see
 * ReadinessScoreService). This table is the HISTORY of that computation, so a student at 23% can see 23 → 31 → 45 on a
 * chart, the Vault page can say "you crossed 60 on 12 Oct", and the inactivity penalty has a day-by-day record behind it.
 *
 * It is also where the penalty's clock starts: a student is only charged for days missed AFTER their first row here, so
 * switching the penalty on never reaches back and punishes a student for days before they were being tracked.
 *
 * The row for today is rewritten as the day goes on (readiness:refresh); once the day is over it stays as it ended.
 * A student with nothing to track (no score at all) has no rows.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('readiness_snapshots', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->date('snapshot_date');

            // `score` is what the student sees and what the Vault goes by: base_score minus penalty, never below 0.
            $table->unsignedTinyInteger('score');
            $table->unsignedTinyInteger('base_score');
            $table->unsignedTinyInteger('penalty')->default(0);
            // Days the student did nothing, in the penalty window, as of this row — what `penalty` was charged for.
            $table->unsignedSmallInteger('missed_days')->default(0);
            $table->boolean('active_today')->default(false);

            $table->string('tier', 20)->nullable();
            $table->string('profile', 16)->nullable();
            $table->unsignedSmallInteger('version')->nullable();
            // {component key: component score} — small, and enough to chart which part moved.
            $table->json('components')->nullable();

            $table->timestamps();

            $table->unique(['user_id', 'snapshot_date']);
            $table->index('snapshot_date');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('readiness_snapshots');
    }
};
