<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Departments — the level above branches.
 *
 * A college runs one or more departments (Engineering & Technology, Management & Business Administration,
 * Commerce & Accounting, Arts/Humanities & Social Sciences); a department holds disciplines (the family a
 * dashboard, Domain Prep and readiness are keyed by) and a discipline holds branches. Until now the product
 * had one implicit department, engineering, so every column added here defaults to it.
 *
 *  • departments            the four (and any Superadmin adds), with the capability switches that decide which
 *                           modules their students see (coding practice, contests, Project Lab …).
 *  • college_departments    which departments a college runs. A college with no rows is treated as engineering-only
 *                           (see College::departmentCodes()), so nothing changes until someone enables another.
 *  • disciplines / branches carry optional capability overrides ("CSE has no Domain Prep", "B.Com (Computer
 *                           Applications) keeps coding on").
 *  • users.department       resolved with the branch (User::resolveBranchFromLabel), or stated by the roster import /
 *                           the student when the branch label is not recognised. Null = not known yet, which behaves
 *                           exactly like engineering (fail open: nobody loses a module because we have not classified them).
 *  • branch_aliases.department_code   spellings that only mean something inside one department ("Finance").
 *  • core_subjects.branch_codes       a Domain Prep subject can be FOR specific branches (MBA Finance → Security Analysis).
 *
 * No foreign keys on purpose, like the branch columns: codes are looked up in a memoised catalogue, never joined, and a
 * renamed code must not be blocked by thousands of student rows.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('departments', function (Blueprint $table) {
            $table->id();
            $table->string('code', 30)->unique();
            $table->string('name', 120);
            $table->string('short', 40);
            $table->string('description', 255)->nullable();
            $table->string('icon', 30)->default('graduation-cap');
            $table->string('accent', 20)->default('indigo');
            $table->unsignedSmallInteger('sort')->default(0);
            $table->boolean('is_active')->default(true);
            // Sparse {capability: bool} — only what differs from the registry default (config/departments.php).
            $table->json('capabilities')->nullable();
            // Wording and small knobs: {"domain_prep_label": "Management Prep", …}
            $table->json('settings')->nullable();
            $table->timestamps();
        });

        Schema::create('college_departments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('college_id')->constrained()->cascadeOnDelete();
            $table->string('department_code', 30);
            $table->unsignedBigInteger('enabled_by')->nullable();
            $table->timestamps();

            $table->unique(['college_id', 'department_code']);
            $table->index('department_code');
        });

        Schema::table('disciplines', function (Blueprint $table) {
            $table->string('department_code', 30)->default('engineering')->after('short');
            $table->json('capabilities')->nullable();
            $table->index('department_code');
        });

        Schema::table('branches', function (Blueprint $table) {
            $table->json('capabilities')->nullable();
        });

        Schema::table('branch_aliases', function (Blueprint $table) {
            // '' = the spelling means the same in every department (all rows that existed before).
            $table->string('department_code', 30)->default('')->after('college_id');
        });

        Schema::table('branch_aliases', function (Blueprint $table) {
            $table->dropUnique(['college_id', 'alias_key']);
            $table->unique(['college_id', 'alias_key', 'department_code'], 'branch_aliases_scope_key_unique');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->string('department', 30)->nullable();
            // A student of a department without coding practice may ask for it (Settings → "Show coding practice").
            $table->boolean('coding_opt_in')->default(false);
            $table->index(['college_id', 'department'], 'users_college_department_index');
            $table->index('department', 'users_department_index');
        });

        Schema::table('student_imports', function (Blueprint $table) {
            $table->string('department_code', 30)->nullable()->after('college_id');
        });

        Schema::table('core_subjects', function (Blueprint $table) {
            $table->json('branch_codes')->nullable();
        });

        $this->seedEngineering();
    }

    public function down(): void
    {
        Schema::table('core_subjects', function (Blueprint $table) {
            $table->dropColumn('branch_codes');
        });

        Schema::table('student_imports', function (Blueprint $table) {
            $table->dropColumn('department_code');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex('users_college_department_index');
            $table->dropIndex('users_department_index');
            $table->dropColumn(['department', 'coding_opt_in']);
        });

        // Scoped spellings cannot survive the old (college, key) unique index.
        DB::table('branch_aliases')->where('department_code', '!=', '')->delete();

        Schema::table('branch_aliases', function (Blueprint $table) {
            $table->dropUnique('branch_aliases_scope_key_unique');
            $table->unique(['college_id', 'alias_key']);
        });

        Schema::table('branch_aliases', function (Blueprint $table) {
            $table->dropColumn('department_code');
        });

        Schema::table('branches', function (Blueprint $table) {
            $table->dropColumn('capabilities');
        });

        Schema::table('disciplines', function (Blueprint $table) {
            $table->dropIndex(['department_code']);
            $table->dropColumn(['department_code', 'capabilities']);
        });

        Schema::dropIfExists('college_departments');
        Schema::dropIfExists('departments');
    }

    /** The department rows, and engineering's disciplines linked to it with the per-family switches they used to have in code. */
    private function seedEngineering(): void
    {
        $data = require database_path('data/department_taxonomy.php');
        $now = now();

        foreach ($data['departments'] as $code => $d) {
            DB::table('departments')->insertOrIgnore([
                'code' => $code, 'name' => $d['name'], 'short' => $d['short'], 'description' => $d['description'],
                'icon' => $d['icon'], 'accent' => $d['accent'], 'sort' => $d['sort'], 'is_active' => true,
                'capabilities' => $d['capabilities'] === [] ? null : json_encode($d['capabilities']),
                'settings' => json_encode($d['settings']),
                'created_at' => $now, 'updated_at' => $now,
            ]);
        }

        foreach ($data['engineering_disciplines'] as $code => $d) {
            DB::table('disciplines')->where('code', $code)->update([
                'department_code' => 'engineering',
                'capabilities' => $d['capabilities'] === [] ? null : json_encode($d['capabilities']),
            ]);
        }
    }
};
