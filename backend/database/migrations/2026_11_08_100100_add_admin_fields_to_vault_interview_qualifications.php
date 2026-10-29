<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * What a superadmin did to a Vault AI Interview qualification by hand (give access again, correct a score, mark qualified, take a
 * qualification back), and the bookkeeping that lets a fresh start be fresh:
 *
 *  - admin_log              the newest actions, with who did them and why
 *  - qualified_by_admin_id  set when a student was qualified by a person rather than by sitting the series
 *  - attempt_offset         added to the attempt sequence on every fresh start, so an interview left over from before it is never
 *                           mistaken for one of the new cycle (the sequence is otherwise the number of failed series + 1)
 *  - cycle_start            index into attempt_history where the current cycle begins: the student sees only the attempts of this cycle
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vault_interview_qualifications', function (Blueprint $table) {
            $table->json('admin_log')->nullable()->after('attempt_history');
            $table->unsignedSmallInteger('attempt_offset')->default(0)->after('admin_log');
            $table->unsignedSmallInteger('cycle_start')->default(0)->after('attempt_offset');
            $table->foreignId('qualified_by_admin_id')->nullable()->after('qualified_at')->constrained('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('vault_interview_qualifications', function (Blueprint $table) {
            $table->dropConstrainedForeignId('qualified_by_admin_id');
            $table->dropColumn(['admin_log', 'attempt_offset', 'cycle_start']);
        });
    }
};
