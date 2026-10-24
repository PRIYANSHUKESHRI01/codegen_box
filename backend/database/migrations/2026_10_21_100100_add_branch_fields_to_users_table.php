<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Where a student's branch is resolved to. `branch` (the raw text the college
 * typed) stays exactly as it was and is still what screens show as the
 * college's own label; these columns are what logic runs on.
 *
 *  • branch_code / discipline — canonical answer ('mech' / 'mech'); null until
 *    the text is recognised or the student says what they study.
 *  • branch_key — the normalised raw text (App\Support\BranchNormalizer), so a
 *    TPO mapping "Mech-A" → Mechanical re-resolves a whole college with one
 *    indexed UPDATE instead of reading every student.
 *  • branch_source — 'college' (imported/edited by staff, authoritative),
 *    'self' (the student said so), or null.
 *  • track_focus / core_interests — what a non-CS student wants to prepare for
 *    (core_first | balanced | it_first). Null for CSE.
 *
 * All nullable and additive. No foreign keys on purpose: the codes are looked
 * up in a memoised catalogue, never joined, and a renamed code must not be
 * blocked by thousands of student rows.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('branch_code', 40)->nullable();
            $table->string('branch_key', 150)->nullable();
            $table->string('discipline', 20)->nullable();
            $table->string('branch_source', 10)->nullable();
            $table->dateTime('branch_confirmed_at')->nullable();
            $table->dateTime('branch_disputed_at')->nullable();
            $table->dateTime('branch_prompt_skipped_at')->nullable();
            $table->string('track_focus', 20)->nullable();
            $table->json('core_interests')->nullable();

            $table->index(['college_id', 'branch_key'], 'users_college_branch_key_index');
            $table->index(['college_id', 'discipline'], 'users_college_discipline_index');
            $table->index('branch_code', 'users_branch_code_index');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex('users_college_branch_key_index');
            $table->dropIndex('users_college_discipline_index');
            $table->dropIndex('users_branch_code_index');
            $table->dropColumn([
                'branch_code', 'branch_key', 'discipline', 'branch_source', 'branch_confirmed_at',
                'branch_disputed_at', 'branch_prompt_skipped_at', 'track_focus', 'core_interests',
            ]);
        });
    }
};
