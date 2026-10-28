<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Year-wise cohorts and the Vault AI Interview's unlock clock.
 *
 *  - users.graduation_year      the year a college student passes out. The year they are in (2nd, 3rd, 4th) is derived from it, so it
 *                               moves on by itself every July - see App\Support\AcademicYear. Null = the college has not said.
 *  - users.first_login_at       when the account was first really used (stamped by AuthController). Starts the 45 / 90 day clock.
 *  - users.vault_ai_unlocked_at the moment a college student met both unlock conditions; kept, so readiness decay cannot re-lock them.
 *  - student_imports.study_year the year the whole roster file was imported as (a row may name its own year).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->unsignedSmallInteger('graduation_year')->nullable()->after('section');
            $table->timestamp('first_login_at')->nullable()->after('last_seen_at');
            $table->timestamp('vault_ai_unlocked_at')->nullable()->after('first_login_at');

            // The TPO's year view: "this college's students who pass out in 2028".
            $table->index(['college_id', 'graduation_year'], 'users_college_graduation_year_index');
        });

        Schema::table('student_imports', function (Blueprint $table) {
            $table->unsignedTinyInteger('study_year')->nullable()->after('department_code');
        });

        // Students who have already been using the platform are not made to start the wait over on deploy: their clock is
        // taken to have started when the account was created - the earliest we can honestly say (an account cannot have been used
        // before it existed). Accounts never opened have no first sign-in yet; it is stamped when they first sign in.
        DB::table('users')
            ->where('role', 'user')
            ->whereNotNull('last_seen_at')
            ->whereNull('first_login_at')
            ->update(['first_login_at' => DB::raw('created_at')]);
    }

    public function down(): void
    {
        Schema::table('student_imports', function (Blueprint $table) {
            $table->dropColumn('study_year');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex('users_college_graduation_year_index');
            $table->dropColumn(['graduation_year', 'first_login_at', 'vault_ai_unlocked_at']);
        });
    }
};
