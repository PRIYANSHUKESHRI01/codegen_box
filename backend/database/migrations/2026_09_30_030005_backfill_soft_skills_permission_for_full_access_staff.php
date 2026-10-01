<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Same gap as the interviews/articles/talent_pool backfills before it:
 * `soft_skills` (User::PERM_SOFT_SKILLS) was added to the internal
 * permission catalog after
 * 2026_09_24_060005_backfill_talent_pool_permission_for_full_access_staff
 * had already run and backfilled every existing admin_internal account with
 * that migration's then-current full set (the original 6, plus interviews,
 * articles, talent_pool). Without this, every Ops account provisioned
 * before this feature is silently locked out of it.
 *
 * Same "additive, not a retroactive lockout" philosophy, applied narrowly:
 * only accounts that currently hold the FULL 9-permission set from that
 * point (i.e. were never deliberately narrowed by a superadmin) gain
 * `soft_skills` too. Migrations are a frozen historical record, so —
 * matching every prior migration in this chain — that permission list is
 * hardcoded here rather than read from User's constants.
 */
return new class extends Migration
{
    public function up(): void
    {
        $currentFullSet = ['colleges', 'platform_users', 'problem_bank', 'placements', 'contests', 'interviews', 'customers', 'articles', 'talent_pool'];

        DB::table('users')
            ->where('role', 'admin_internal')
            ->orderBy('id')
            ->chunk(100, function ($users) use ($currentFullSet) {
                foreach ($users as $user) {
                    $current = json_decode($user->permissions ?? '[]', true) ?? [];

                    $hadFullSet = empty(array_diff($currentFullSet, $current));

                    if ($hadFullSet && ! in_array('soft_skills', $current, true)) {
                        DB::table('users')
                            ->where('id', $user->id)
                            ->update(['permissions' => json_encode([...$current, 'soft_skills'])]);
                    }
                }
            });
    }

    public function down(): void
    {
        $users = DB::table('users')->where('role', 'admin_internal')->get();

        foreach ($users as $user) {
            $current = json_decode($user->permissions ?? '[]', true) ?? [];
            $without = array_values(array_diff($current, ['soft_skills']));

            DB::table('users')->where('id', $user->id)->update(['permissions' => json_encode($without)]);
        }
    }
};
