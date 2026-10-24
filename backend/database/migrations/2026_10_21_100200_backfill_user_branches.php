<?php

use App\Support\BranchNormalizer;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Resolves every existing student's raw `branch` text to a canonical branch.
 *
 * One UPDATE per distinct (college, label) pair — the cost follows the number
 * of different labels (a few hundred at most), not the number of students.
 * Labels nobody recognises are still given their `branch_key`, so a TPO mapping
 * them later fixes the whole college in a single query; their branch_code stays
 * null and eligibility treats them as "unknown", not "fail".
 *
 * `php artisan branches:resolve` does the same on demand.
 */
return new class extends Migration
{
    public function up(): void
    {
        $aliases = DB::table('branch_aliases')->where('college_id', 0)->pluck('branch_code', 'alias_key')->all();
        $disciplines = DB::table('branches')->pluck('discipline_code', 'code')->all();

        $pairs = DB::table('users')
            ->where('role', 'user')
            ->whereNotNull('branch')
            ->where('branch', '!=', '')
            ->select('college_id', 'branch')
            ->distinct()
            ->get();

        foreach ($pairs as $pair) {
            $key = BranchNormalizer::key($pair->branch);
            $code = $key !== null ? ($aliases[$key] ?? null) : null;

            $query = DB::table('users')->where('role', 'user')->where('branch', $pair->branch);
            $pair->college_id === null ? $query->whereNull('college_id') : $query->where('college_id', $pair->college_id);

            $query->update([
                'branch_key' => $key,
                'branch_code' => $code,
                'discipline' => $code !== null ? ($disciplines[$code] ?? null) : null,
                'branch_source' => 'college',
            ]);
        }
    }

    public function down(): void
    {
        // The columns are dropped by the previous migration's down(); nothing to undo here.
    }
};
