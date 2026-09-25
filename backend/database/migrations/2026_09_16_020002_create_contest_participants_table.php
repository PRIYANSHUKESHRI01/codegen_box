<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * One row per registered student per contest. `score`/`penalty_minutes` are
 * live, updated on every contest submit (see ContestScoringService) so the
 * leaderboard can read them directly. `rank`/`rating_before`/`rating_after`
 * are the opposite — nullable, and written ONLY by ContestFinalizeService
 * after the contest ends. No code path outside finalize may ever write
 * `rank`: computing it live per-submission would serialize every
 * participant's submissions against every other participant's in the same
 * contest, a real bottleneck under concurrent load. The live leaderboard
 * instead computes rank on read (ORDER BY score DESC, penalty_minutes ASC).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('contest_participants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('contest_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->dateTime('registered_at');
            $table->integer('score')->default(0);
            $table->unsignedInteger('penalty_minutes')->default(0);
            $table->unsignedInteger('rank')->nullable();
            $table->integer('rating_before')->nullable();
            $table->integer('rating_after')->nullable();
            $table->timestamps();

            $table->unique(['contest_id', 'user_id']);
            $table->index(['contest_id', 'score', 'penalty_minutes']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('contest_participants');
    }
};
