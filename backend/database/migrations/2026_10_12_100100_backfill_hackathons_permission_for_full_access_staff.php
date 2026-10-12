<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Same gap and same remedy as the project_lab and soft_skills backfills:
 * `hackathons` (User::PERM_HACKATHONS) joined the internal permission catalog
 * after every existing Ops account was provisioned, so without this each of
 * them would be silently locked out of hosting hackathons.
 *
 * Additive, never a retroactive lockout: only accounts that currently hold the
 * FULL 11-permission set (never deliberately narrowed by a superadmin) gain
 * `hackathons`. The set is hardcoded because migrations are a frozen record.
 */
return new class extends Migration
{
    public function up(): void
    {
        $currentFullSet = ['colleges', 'platform_users', 'problem_bank', 'placements', 'contests', 'interviews', 'customers', 'articles', 'talent_pool', 'soft_skills', 'project_lab'];

        DB::table('users')
            ->where('role', 'admin_internal')
            ->orderBy('id')
            ->chunk(100, function ($users) use ($currentFullSet) {
                foreach ($users as $user) {
                    $current = json_decode($user->permissions ?? '[]', true) ?? [];

                    $hadFullSet = empty(array_diff($currentFullSet, $current));

                    if ($hadFullSet && ! in_array('hackathons', $current, true)) {
                        DB::table('users')
                            ->where('id', $user->id)
                            ->update(['permissions' => json_encode([...$current, 'hackathons'])]);
                    }
                }
            });
    }

    public function down(): void
    {
        $users = DB::table('users')->where('role', 'admin_internal')->get();

        foreach ($users as $user) {
            $current = json_decode($user->permissions ?? '[]', true) ?? [];
            $without = array_values(array_diff($current, ['hackathons']));

            DB::table('users')->where('id', $user->id)->update(['permissions' => json_encode($without)]);
        }
    }
};
