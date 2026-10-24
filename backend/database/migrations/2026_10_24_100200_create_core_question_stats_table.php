<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * What students' answers say about each Core question — recomputed nightly by `core:analyse-items`, never written by
 * hand. One row per question that has been answered:
 *
 *  • facility          the share who got it right in a timed test (high = easy)
 *  • discrimination    point-biserial: do the students who score well overall get THIS one right? Near zero means the
 *                      question tells strong from weak students nothing; negative means the strong ones get it wrong —
 *                      the signature of a wrong answer key.
 *  • flags / flagged   what the numbers suggest staff look at (too_easy, too_hard, low_discrimination,
 *                      negative_discrimination, suspected_key). `flagged` is the same fact as a plain boolean so the
 *                      Ops list can filter on it in any database.
 *  • suspect_option    for a suspected wrong key: the option the stronger students keep choosing instead.
 *
 * A flag is a prompt for a human, not a verdict: nothing here changes a key or retires a question.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('core_question_stats', function (Blueprint $table) {
            $table->id();
            $table->foreignId('core_question_id')->unique()->constrained('core_questions')->cascadeOnDelete();
            $table->unsignedInteger('test_attempts')->default(0);
            $table->decimal('facility', 5, 4)->nullable();
            $table->decimal('discrimination', 6, 4)->nullable();
            $table->unsignedInteger('practice_attempts')->default(0);
            $table->decimal('practice_facility', 5, 4)->nullable();
            $table->json('flags')->nullable();
            $table->boolean('flagged')->default(false)->index();
            $table->string('suspect_option', 64)->nullable();
            $table->dateTime('computed_at');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('core_question_stats');
    }
};
