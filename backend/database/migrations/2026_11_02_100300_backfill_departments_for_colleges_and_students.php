<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Puts every existing college and student into a department.
 *
 * Until now the platform only knew engineering, so:
 *  • a student whose branch is recognised gets the department of their discipline;
 *  • a student of a college whose branch is not recognised (or absent) is engineering — that is what the college was onboarded as;
 *  • a student with no college and no recognised branch stays NULL ("not known yet"), which behaves like engineering and is
 *    asked for their department the next time the onboarding questions run;
 *  • every college runs engineering, plus any other department its students already belong to.
 *
 * One statement per step (never a loop over students), safe to re-run.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('users')
            ->where('role', 'user')
            ->whereNull('department')
            ->whereNotNull('discipline')
            ->update(['department' => DB::raw('(SELECT d.department_code FROM disciplines d WHERE d.code = users.discipline)')]);

        DB::table('users')
            ->where('role', 'user')
            ->whereNull('department')
            ->whereNotNull('college_id')
            ->update(['department' => 'engineering']);

        $now = now();

        foreach (DB::table('colleges')->pluck('id')->chunk(500) as $ids) {
            DB::table('college_departments')->insertOrIgnore(
                $ids->map(fn ($id) => ['college_id' => $id, 'department_code' => 'engineering', 'created_at' => $now, 'updated_at' => $now])->all()
            );
        }

        $others = DB::table('users')
            ->where('role', 'user')->whereNotNull('college_id')->whereNotNull('department')->where('department', '!=', 'engineering')
            ->select('college_id', 'department')->distinct()->get();

        foreach ($others as $row) {
            DB::table('college_departments')->insertOrIgnore([
                'college_id' => $row->college_id, 'department_code' => $row->department, 'created_at' => $now, 'updated_at' => $now,
            ]);
        }
    }

    public function down(): void
    {
        DB::table('college_departments')->delete();
        DB::table('users')->update(['department' => null]);
    }
};
