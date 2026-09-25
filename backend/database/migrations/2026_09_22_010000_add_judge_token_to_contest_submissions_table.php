<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Judging is queued now, and a queued job can be retried (a worker dies after
 * saving the verdict but before the queue hears about it). Every contest
 * attempt is its own row — unlike practice submissions, which upsert — so a
 * retry would double-count a wrong attempt and its 10-minute penalty. The
 * job's unique token is the idempotency key: JudgeOutcomePersister uses
 * firstOrCreate on it, and this unique index is the guarantee behind that.
 * Nullable so every pre-existing row (judged synchronously, no token) stays valid.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('contest_submissions', function (Blueprint $table) {
            $table->string('judge_token', 64)->nullable()->unique()->after('user_id');
        });
    }

    public function down(): void
    {
        Schema::table('contest_submissions', function (Blueprint $table) {
            $table->dropUnique(['judge_token']);
            $table->dropColumn('judge_token');
        });
    }
};
