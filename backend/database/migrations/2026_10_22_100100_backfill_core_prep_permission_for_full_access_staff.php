<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Same gap and same remedy as the project_lab / hackathons backfills: `core_prep`
 * (User::PERM_CORE_PREP) joined the internal permission catalog after every existing Ops
 * account was provisioned, so without this each of them would be silently locked out of
 * authoring Core Prep questions.
 *
 * Additive, never a retroactive lockout: only accounts that currently hold the FULL set
 * (never deliberately narrowed by a superadmin) gain `core_prep`. The set is hardcoded because
 * migrations are a frozen record.
 */
return new class extends Migration
{
    public function up(): void
    {
        $currentFullSet = ['colleges', 'platform_users', 'problem_bank', 'placements', 'contests', 'interviews', 'customers', 'articles', 'vault', 'soft_skills', 'project_lab', 'hackathons'];

        DB::table('users')
            ->where('role', 'admin_internal')
            ->orderBy('id')
            ->chunk(100, function ($users) use ($currentFullSet) {
                foreach ($users as $user) {
                    $current = json_decode($user->permissions ?? '[]', true) ?? [];

                    $hadFullSet = empty(array_diff($currentFullSet, $current));

                    if ($hadFullSet && ! in_array('core_prep', $current, true)) {
                        DB::table('users')
                            ->where('id', $user->id)
                            ->update(['permissions' => json_encode([...$current, 'core_prep'])]);
                    }
                }
            });
    }

    public function down(): void
    {
        $users = DB::table('users')->where('role', 'admin_internal')->get();

        foreach ($users as $user) {
            $current = json_decode($user->permissions ?? '[]', true) ?? [];
            $without = array_values(array_diff($current, ['core_prep']));

            DB::table('users')->where('id', $user->id)->update(['permissions' => json_encode($without)]);
        }
    }
};
