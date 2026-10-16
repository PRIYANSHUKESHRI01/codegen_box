<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Soft Skills "question sets" — the reusable, numbered, ready-made papers AptRun
 * ships ("Soft Skill Assessment – Set 12": 25 hand-written questions) as a library.
 *
 * A set is NOT a new kind of object: it is a Mellow-owned, published, general
 * assessment that students can attempt directly (so every existing attempt, score
 * and readiness input keeps working untouched), flagged so the product can tell the
 * library apart from ordinary tests:
 *
 *   soft_skill_assessments.is_question_set      true for a library set
 *   soft_skill_assessments.question_set_number  the "Set N" number (unique among sets)
 *
 * soft_skill_assessment_sets — provenance. When a TPO, hiring partner or Mellow
 * staff member builds a test FROM a set, the set's questions are copied into the
 * test (so later edits to the library never change a live test) and one row here
 * records which set it came from. That row is what lets the next person who
 * schedules a test be told "this set was already used in <test> on <date>".
 * `set_title` / `set_number` are snapshots: the usage history stays readable even if
 * a set is later retired and deleted (the FK is nullOnDelete). The unique key stops
 * the same set being added to the same test twice.
 *
 * Existing rows are backfilled by slug (`soft-skill-assessment-set-<N>`, which is how
 * the seeder names them), so a database that already holds the 45 sets needs no
 * re-seed.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('soft_skill_assessments', function (Blueprint $table) {
            $table->boolean('is_question_set')->default(false)->after('assessment_type');
            $table->unsignedSmallInteger('question_set_number')->nullable()->after('is_question_set');

            $table->index('is_question_set');
            $table->unique('question_set_number');
        });

        Schema::create('soft_skill_assessment_sets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('soft_skill_assessment_id')->constrained('soft_skill_assessments')->cascadeOnDelete();
            $table->foreignId('question_set_id')->nullable()->constrained('soft_skill_assessments')->nullOnDelete();
            $table->string('set_title');
            $table->unsignedSmallInteger('set_number')->nullable();
            $table->unsignedSmallInteger('questions_added')->default(0);
            $table->foreignId('added_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['soft_skill_assessment_id', 'question_set_id'], 'ss_assessment_sets_unique');
            $table->index('question_set_id');
        });

        DB::table('soft_skill_assessments')
            ->where('assessment_type', 'general')
            ->whereNull('owning_college_id')
            ->whereNull('owning_company_id')
            ->where('slug', 'like', 'soft-skill-assessment-set-%')
            ->orderBy('id')
            ->get(['id', 'slug'])
            ->each(function ($row) {
                if (preg_match('/^soft-skill-assessment-set-(\d+)$/', $row->slug, $m) !== 1) {
                    return;
                }

                DB::table('soft_skill_assessments')->where('id', $row->id)->update([
                    'is_question_set' => true,
                    'question_set_number' => (int) $m[1],
                ]);
            });
    }

    public function down(): void
    {
        Schema::dropIfExists('soft_skill_assessment_sets');

        Schema::table('soft_skill_assessments', function (Blueprint $table) {
            $table->dropUnique(['question_set_number']);
            $table->dropIndex(['is_question_set']);
            $table->dropColumn(['is_question_set', 'question_set_number']);
        });
    }
};
