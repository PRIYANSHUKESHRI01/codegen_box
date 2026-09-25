<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Same gap, one permission later: `articles` (User::PERM_ARTICLES) was added
 * to the internal permission catalog after
 * 2026_09_24_030000_backfill_interviews_permission_for_full_access_staff.php
 * had already run and backfilled every existing admin_internal account with
 * that migration's then-current full set (the original 6 plus `interviews`).
 * Without this, every Ops account provisioned before the Articles feature is
 * silently locked out of it.
 *
 * Same "additive, not a retroactive lockout" philosophy, applied narrowly:
 * only accounts that currently hold the FULL 7-permission set from that
 * point (i.e. were never deliberately narrowed by a superadmin) gain
 * `articles` too. Migrations are a frozen historical record, so — matching
 * both prior migrations' own stated convention — that permission list is
 * hardcoded here rather than read from User's constants.
 */
return new class extends Migration
{
    public function up(): void
    {
        $currentFullSet = ['colleges', 'platform_users', 'problem_bank', 'placements', 'contests', 'interviews', 'customers'];

        DB::table('users')
            ->where('role', 'admin_internal')
            ->orderBy('id')
            ->chunk(100, function ($users) use ($currentFullSet) {
                foreach ($users as $user) {
                    $current = json_decode($user->permissions ?? '[]', true) ?? [];

                    $hadFullSet = empty(array_diff($currentFullSet, $current));

                    if ($hadFullSet && ! in_array('articles', $current, true)) {
                        DB::table('users')
                            ->where('id', $user->id)
                            ->update(['permissions' => json_encode([...$current, 'articles'])]);
                    }
                }
            });
    }

    public function down(): void
    {
        $users = DB::table('users')->where('role', 'admin_internal')->get();

        foreach ($users as $user) {
            $current = json_decode($user->permissions ?? '[]', true) ?? [];
            $withoutArticles = array_values(array_diff($current, ['articles']));

            DB::table('users')->where('id', $user->id)->update(['permissions' => json_encode($withoutArticles)]);
        }
    }
};
