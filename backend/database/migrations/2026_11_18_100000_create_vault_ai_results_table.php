<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The Vault AI Interview report record: for every student and stack, the FINAL AVERAGE of the three sets of every series they have
 * completed, the best of those, and a pointer to the PDF report kept for it.
 *
 * It is a ledger, not a view of the qualification: an admin's "fresh start" wipes the qualification's own scores (and a student who
 * qualified keeps no failed-series trail), but the best result a student ever earned must survive a second go. `history` keeps every
 * completed series (its three set scores, its average, when) and `best_*` is the highest of them.
 *
 * college_id is copied on so "this college's results" is one indexed read; there is no foreign key to colleges on purpose (a purged
 * college's rows go with its students, which cascade from users).
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('vault_ai_results')) {
            return;
        }

        Schema::create('vault_ai_results', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->unsignedBigInteger('college_id')->nullable();
            $table->string('stack_key', 60);
            $table->string('role_key', 60)->nullable();
            $table->string('stack_name', 120)->nullable();

            // The best series so far: its three set scores and their average (the "final average").
            $table->decimal('best_average', 5, 2)->nullable();
            $table->json('best_scores')->nullable();
            $table->unsignedTinyInteger('best_series')->nullable();
            $table->dateTime('best_at')->nullable();

            // The most recent completed series.
            $table->decimal('last_average', 5, 2)->nullable();
            $table->json('last_scores')->nullable();
            $table->dateTime('last_at')->nullable();

            $table->unsignedSmallInteger('attempts')->default(0);
            // qualified | in_progress | cooling_down | not_started — as the qualification stands now.
            $table->string('status', 16)->default('in_progress');
            $table->boolean('ever_qualified')->default(false);
            $table->dateTime('first_completed_at')->nullable();
            // Every completed series, oldest first: [{key, series, scores{1,2,3}, average, passed, at, source, reset}]
            $table->json('history')->nullable();

            // The PDF kept for this result (generated_reports.public_id). Replaced whenever a new series completes or marks change.
            $table->string('report_id', 26)->nullable();
            $table->dateTime('report_generated_at')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'stack_key']);
            $table->index(['college_id', 'best_average']);
            $table->index('stack_key');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vault_ai_results');
    }
};
