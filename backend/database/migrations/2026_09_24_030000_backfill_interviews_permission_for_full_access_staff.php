<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * `interviews` (User::PERM_INTERVIEWS) was added to the internal permission
 * catalog after 2026_09_19_010000_add_permissions_to_users_table.php had
 * already run and backfilled every existing admin_internal account with
 * that migration's then-current full set. Without this, every Ops account
 * that predates the AI Interview feature is silently locked out of it —
 * not because anyone deliberately restricted them, but because the
 * permission simply didn't exist yet when they were provisioned.
 *
 * Same "additive, not a retroactive lockout" philosophy as that original
 * migration, applied narrowly: only accounts that currently hold the FULL
 * original 6-permission set (i.e. were never deliberately narrowed by a
 * superadmin) gain `interviews` too — an account a superadmin intentionally
 * scoped down must not have that restriction silently widened by this.
 * Migrations are a frozen historical record, so — matching that same
 * migration's own stated convention — the original permission list is
 * hardcoded here rather than read from User's constants.
 */
return new class extends Migration
{
    public function up(): void
    {
        $originalFullSet = ['colleges', 'platform_users', 'problem_bank', 'placements', 'contests', 'customers'];

        DB::table('users')
            ->where('role', 'admin_internal')
            ->orderBy('id')
            ->chunk(100, function ($users) use ($originalFullSet) {
                foreach ($users as $user) {
                    $current = json_decode($user->permissions ?? '[]', true) ?? [];

                    $hadFullOriginalSet = empty(array_diff($originalFullSet, $current));

                    if ($hadFullOriginalSet && ! in_array('interviews', $current, true)) {
                        DB::table('users')
                            ->where('id', $user->id)
                            ->update(['permissions' => json_encode([...$current, 'interviews'])]);
                    }
                }
            });
    }

    public function down(): void
    {
        $users = DB::table('users')->where('role', 'admin_internal')->get();

        foreach ($users as $user) {
            $current = json_decode($user->permissions ?? '[]', true) ?? [];
            $withoutInterviews = array_values(array_diff($current, ['interviews']));

            DB::table('users')->where('id', $user->id)->update(['permissions' => json_encode($withoutInterviews)]);
        }
    }
};
