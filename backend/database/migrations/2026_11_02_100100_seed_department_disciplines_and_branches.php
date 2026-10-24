<?php

use App\Support\BranchNormalizer;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * The disciplines, branches and spellings of the Management, Commerce and Arts/Humanities departments
 * (database/data/department_taxonomy.php). Idempotent: rows are keyed by code, and a spelling that already belongs
 * to another branch is left with its first owner — the same "first claim wins" rule the engineering seed used.
 *
 * Engineering's own rows are untouched; the previous migration only linked them to their department.
 */
return new class extends Migration
{
    public function up(): void
    {
        $data = require database_path('data/department_taxonomy.php');
        $now = now();

        foreach ($data['disciplines'] as $code => [$name, $short, $sort, $department]) {
            DB::table('disciplines')->insertOrIgnore([
                'code' => $code, 'name' => $name, 'short' => $short, 'sort' => $sort, 'department_code' => $department,
                // Domain Prep (the generalised Core Prep) is a department-level capability for these departments; nothing to override here.
                'is_live' => false, 'created_at' => $now, 'updated_at' => $now,
            ]);
        }

        // Every spelling already in the global list (including the engineering ones), so a new branch can never steal one.
        $taken = DB::table('branch_aliases')->where('college_id', 0)->where('department_code', '')->pluck('branch_code', 'alias_key')->all();
        $sort = (int) DB::table('branches')->max('sort');
        $rows = [];

        foreach ($data['branches'] as $code => [$discipline, $name, $short, $aliases]) {
            DB::table('branches')->insertOrIgnore([
                'code' => $code, 'discipline_code' => $discipline, 'name' => $name, 'short' => $short,
                'sort' => ++$sort, 'created_at' => $now, 'updated_at' => $now,
                'capabilities' => isset($data['branch_capabilities'][$code]) ? json_encode($data['branch_capabilities'][$code]) : null,
            ]);

            foreach ([$code, $name, $short, ...$aliases] as $label) {
                $key = BranchNormalizer::key($label);

                if ($key === null || isset($taken[$key])) {
                    continue;
                }

                $taken[$key] = $code;
                $rows[] = [
                    'alias_key' => $key, 'branch_code' => $code, 'college_id' => 0, 'department_code' => '', 'label' => mb_substr($label, 0, 150),
                    'created_at' => $now, 'updated_at' => $now,
                ];
            }
        }

        // Department-scoped spellings: "Finance" means one thing in a Management import and another in a Commerce one.
        $scopedTaken = [];
        foreach ($data['scoped_aliases'] as $department => $branches) {
            foreach ($branches as $code => $labels) {
                foreach ($labels as $label) {
                    $key = BranchNormalizer::key($label);

                    if ($key === null || isset($scopedTaken[$department][$key])) {
                        continue;
                    }

                    $scopedTaken[$department][$key] = true;
                    $rows[] = [
                        'alias_key' => $key, 'branch_code' => $code, 'college_id' => 0, 'department_code' => $department, 'label' => mb_substr($label, 0, 150),
                        'created_at' => $now, 'updated_at' => $now,
                    ];
                }
            }
        }

        // Chunked: ~2,700 rows would blow SQLite's bound-variable limit in one statement.
        foreach (array_chunk($rows, 200) as $chunk) {
            DB::table('branch_aliases')->insertOrIgnore($chunk);
        }
    }

    public function down(): void
    {
        $data = require database_path('data/department_taxonomy.php');
        $codes = array_keys($data['branches']);

        DB::table('branch_aliases')->whereIn('branch_code', $codes)->delete();
        DB::table('branches')->whereIn('code', $codes)->delete();
        DB::table('disciplines')->whereIn('code', array_keys($data['disciplines']))->delete();
    }
};
