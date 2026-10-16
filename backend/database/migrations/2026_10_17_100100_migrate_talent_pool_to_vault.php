<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * Carries the Talent Pool's rows into the Vault and renames the staff
 * permission. Nothing is dropped or altered in the old tables — if this ever
 * has to be re-run or rolled back, the originals are all still there.
 *
 *  • candidates → vault_profiles, keeping the SAME id, so every existing
 *    inquiry/message/email link keeps pointing at the right person.
 *  • inquiries / messages → vault_inquiries / vault_messages, same ids.
 *  • staff permission `talent_pool` → `vault` in users.permissions.
 *
 * Consent is deliberately NOT carried over. What a student agreed to under the
 * Talent Pool was "hiring partners on AptRun may find me"; the Vault also hands
 * the profile to Mellow Vault, which is a different thing to say yes to. So a
 * student who had opted in lands on `pending_consent` and confirms once, under
 * the new wording. A student who had opted OUT stays opted out. Hired and
 * Mellow-hidden rows keep their status, and every existing engagement with a
 * hiring partner stays reachable.
 *
 * Readiness is filled in by the first `php artisan readiness:refresh` after
 * deploy (the scheduler also does it within minutes).
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('talent_pool_candidates')) {
            DB::table('talent_pool_candidates')->orderBy('id')->chunkById(200, function ($candidates) {
                foreach ($candidates as $c) {
                    if (DB::table('vault_profiles')->where('id', $c->id)->orWhere('user_id', $c->user_id)->exists()) {
                        continue; // already migrated — safe to re-run
                    }

                    $status = match ($c->visibility_status) {
                        'hired' => 'hired',
                        'hidden_by_mellow' => 'hidden_by_mellow',
                        'hidden_by_candidate' => 'hidden_by_candidate',
                        default => 'pending_consent',
                    };

                    DB::table('vault_profiles')->insert([
                        'id' => $c->id,
                        'public_id' => (string) Str::ulid(),
                        'user_id' => $c->user_id,
                        'visibility_status' => $status,
                        'is_eligible' => true,
                        'qualified_at' => $c->qualified_at,
                        'eligible_since' => $c->qualified_at,
                        'qualification_source' => 'legacy_contest',
                        'legacy_source_contest_id' => $c->source_contest_id,
                        'legacy_score_percent' => $c->score_percent,
                        'consent_given_at' => $c->visibility_status === 'hidden_by_candidate' ? ($c->consent_given_at ?? $c->updated_at) : null,
                        'consent_withdrawn_at' => $c->visibility_status === 'hidden_by_candidate' ? $c->updated_at : null,
                        'hidden_by_staff_at' => $c->visibility_status === 'hidden_by_mellow' ? $c->updated_at : null,
                        'hidden_reason' => $c->visibility_status === 'hidden_by_mellow' ? 'Hidden by Mellow before the Vault launch' : null,
                        'hired_at' => $c->hired_at,
                        'hired_via' => $c->visibility_status === 'hired' ? 'aptrun_partner' : null,
                        'hired_by_company_id' => $c->hired_by_company_id,
                        'created_at' => $c->created_at,
                        'updated_at' => $c->updated_at,
                    ]);
                }
            });
        }

        if (Schema::hasTable('talent_pool_inquiries')) {
            DB::table('talent_pool_inquiries')->orderBy('id')->chunkById(200, function ($inquiries) {
                foreach ($inquiries as $i) {
                    if (DB::table('vault_inquiries')->where('id', $i->id)->exists()
                        || ! DB::table('vault_profiles')->where('id', $i->talent_pool_candidate_id)->exists()) {
                        continue;
                    }

                    DB::table('vault_inquiries')->insert([
                        'id' => $i->id,
                        'vault_profile_id' => $i->talent_pool_candidate_id,
                        'company_id' => $i->company_id,
                        'initiated_by' => $i->initiated_by,
                        'status' => $i->status,
                        'interview_scheduled_at' => $i->interview_scheduled_at,
                        'interview_mode' => $i->interview_mode,
                        'interview_location' => $i->interview_location,
                        'interview_notes' => $i->interview_notes,
                        'responded_at' => $i->responded_at,
                        'ctc_offered' => $i->ctc_offered,
                        'hired_at' => $i->hired_at,
                        'created_at' => $i->created_at,
                        'updated_at' => $i->updated_at,
                    ]);
                }
            });
        }

        if (Schema::hasTable('talent_pool_messages')) {
            DB::table('talent_pool_messages')->orderBy('id')->chunkById(200, function ($messages) {
                foreach ($messages as $m) {
                    if (DB::table('vault_messages')->where('id', $m->id)->exists()
                        || ! DB::table('vault_inquiries')->where('id', $m->talent_pool_inquiry_id)->exists()) {
                        continue;
                    }

                    DB::table('vault_messages')->insert([
                        'id' => $m->id,
                        'vault_inquiry_id' => $m->talent_pool_inquiry_id,
                        'sender_id' => $m->sender_id,
                        'message' => $m->message,
                        'created_at' => $m->created_at,
                    ]);
                }
            });
        }

        $this->renamePermission('talent_pool', 'vault');
    }

    public function down(): void
    {
        // The copied rows are left in place (the old tables were never touched), only the permission is put back.
        $this->renamePermission('vault', 'talent_pool');
    }

    private function renamePermission(string $from, string $to): void
    {
        DB::table('users')
            ->whereNotNull('permissions')
            ->whereIn('role', ['admin_internal', 'admin_marketing', 'superadmin'])
            ->orderBy('id')
            ->chunkById(100, function ($users) use ($from, $to) {
                foreach ($users as $user) {
                    $permissions = json_decode($user->permissions, true);

                    if (! is_array($permissions) || ! in_array($from, $permissions, true)) {
                        continue;
                    }

                    $renamed = array_values(array_unique(array_map(fn ($p) => $p === $from ? $to : $p, $permissions)));

                    DB::table('users')->where('id', $user->id)->update(['permissions' => json_encode($renamed)]);
                }
            });
    }
};
