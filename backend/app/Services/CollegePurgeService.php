<?php

namespace App\Services;

use App\Models\College;
use App\Models\User;
use App\Services\Vault\VaultSyncService;
use Illuminate\Support\Facades\DB;

/**
 * Permanently deletes a partner university and everything that belongs to it.
 *
 * Why this isn't just `$college->delete()`: the schema's own rules for a
 * college are NOT "delete what it owns". Its students and staff would be
 * silently detached (users.college_id is SET NULL) and turn into stray
 * accounts; the content its TPO created (contests, interviews, tracks,
 * templates, assessments, drives) would be left ownerless — a role template
 * with no owner is by definition a *platform* template, so the college's
 * private templates would become visible to everyone; its drive applications
 * would block the delete outright (drive_applications.college_id is RESTRICT);
 * and the polymorphic tables with no foreign key at all (API tokens,
 * subscriptions) would keep orphaned rows. So the purge removes it all, on
 * purpose, in an order MySQL accepts.
 *
 * What is deleted:
 *   - the college's TPO, Section Coordinator and student accounts, with
 *     everything that cascades from them (submissions, attempts, applications,
 *     sessions...), their API tokens, their subscriptions, and the files they
 *     uploaded (avatar, resume, recorded answers);
 *   - everything the college itself owns (see PREVIEW keys below);
 *   - the college's own subscriptions, and the college.
 * What is NOT deleted: Mellow staff, superadmin and hiring-company accounts
 * that happen to carry this college_id are only detached — they are never the
 * college's to lose. Shared platform content (the problem bank, global
 * contests, companies) is untouched.
 *
 * It all runs in one transaction: a foreign-key failure anywhere rolls the lot
 * back and the college is left exactly as it was. Files are removed only after
 * that transaction commits, so a rollback can never cost anyone a file.
 */
class CollegePurgeService
{
    public function __construct(private readonly UserPurgeService $users) {}

    /** Roles that belong to exactly one college and are deleted with it. */
    public const PURGED_ROLES = [User::ROLE_USER, User::ROLE_ADMIN_TPO, User::ROLE_SECTION_COORDINATOR];

    /**
     * What a purge would remove, for the confirmation dialog and the audit
     * trail. Cheap COUNTs only — the same numbers purge() reports back.
     *
     * @return array<string, int>
     */
    public function preview(College $college): array
    {
        $id = $college->id;
        $accounts = fn (string $role) => User::where('college_id', $id)->where('role', $role)->count();
        $owned = fn (string $table) => DB::table($table)->where('owning_college_id', $id)->count();

        return [
            'tpos' => $accounts(User::ROLE_ADMIN_TPO),
            'coordinators' => $accounts(User::ROLE_SECTION_COORDINATOR),
            'students' => $accounts(User::ROLE_USER),
            // Staff / superadmin / company accounts carrying this college_id: kept, only detached.
            'accounts_kept_detached' => User::where('college_id', $id)->whereNotIn('role', self::PURGED_ROLES)->count(),
            'drives' => $owned('placement_drives'),
            'contests' => $owned('contests'),
            'interviews' => $owned('interviews'),
            'interview_tracks' => $owned('interview_tracks'),
            'interview_role_templates' => $owned('interview_role_templates'),
            'soft_skill_assessments' => $owned('soft_skill_assessments'),
            'drive_applications' => DB::table('drive_applications')->where('college_id', $id)->count(),
        ];
    }

    /**
     * Delete the college and everything listed in the class docblock.
     *
     * @return array<string, int> the preview() counts as they were just before deletion
     *
     * @throws \Throwable anything that stops the purge; nothing has been deleted when it does
     */
    public function purge(College $college): array
    {
        $removed = $this->preview($college);
        $files = [];

        DB::transaction(function () use ($college, &$files) {
            $id = $college->id;

            $userIds = User::where('college_id', $id)->whereIn('role', self::PURGED_ROLES)->pluck('id')->all();
            $files = $this->users->collectFiles($userIds);

            $this->deleteOwnedContent($id);

            // The college's own applications first: this FK is RESTRICT, so any
            // row left over (e.g. from a student who has since been moved) would
            // veto the whole delete.
            DB::table('drive_applications')->where('college_id', $id)->delete();

            foreach (array_chunk($userIds, 500) as $chunk) {
                // Students listed in the Vault have a copy on Mellow Vault — queue their withdrawal (and scrub
                // the outbox of their data) before the rows that carry the information disappear.
                app(VaultSyncService::class)->withdrawForDeletedUsers($chunk);

                DB::table('personal_access_tokens')
                    ->where('tokenable_type', User::class)
                    ->whereIn('tokenable_id', $chunk)
                    ->delete();
                DB::table('subscriptions')
                    ->where('subscriber_type', User::class)
                    ->whereIn('subscriber_id', $chunk)
                    ->delete();
                // Every table that points at users cascades or nulls on delete (checked
                // against the live schema) — nothing here can be vetoed by a child row.
                User::whereIn('id', $chunk)->delete();
            }

            $college->subscriptions()->delete();
            $college->delete();
        });

        // Only now that the data is really gone.
        $this->users->deleteFiles($files);

        return $removed;
    }

    /**
     * Content the college's TPO created. Deleted, not orphaned (see the class
     * docblock). Three FKs below are RESTRICT, so their children must go before
     * the parent: contest submissions → contest problems, interview responses →
     * interview questions, soft-skill responses → assessment questions.
     */
    private function deleteOwnedContent(int $collegeId): void
    {
        $ids = fn (string $table) => DB::table($table)->where('owning_college_id', $collegeId)->pluck('id')->all();

        $contestIds = $ids('contests');
        if ($contestIds !== []) {
            DB::table('contest_submissions')->whereIn('contest_id', $contestIds)->delete();
            DB::table('contests')->whereIn('id', $contestIds)->delete();
        }

        $interviewIds = $ids('interviews');
        if ($interviewIds !== []) {
            DB::table('interview_responses')->whereIn(
                'interview_session_id',
                DB::table('interview_sessions')->whereIn('interview_id', $interviewIds)->select('id')
            )->delete();
            DB::table('interviews')->whereIn('id', $interviewIds)->delete();
        }

        // After the interviews: an interview points at its track and role template.
        $trackIds = $ids('interview_tracks');
        if ($trackIds !== []) {
            DB::table('interview_tracks')->whereIn('id', $trackIds)->delete();
        }

        $templateIds = $ids('interview_role_templates');
        if ($templateIds !== []) {
            DB::table('interview_role_templates')->whereIn('id', $templateIds)->delete();
        }

        $assessmentIds = $ids('soft_skill_assessments');
        if ($assessmentIds !== []) {
            DB::table('soft_skill_responses')->whereIn(
                'soft_skill_assessment_question_id',
                DB::table('soft_skill_assessment_questions')->whereIn('soft_skill_assessment_id', $assessmentIds)->select('id')
            )->delete();
            DB::table('soft_skill_assessments')->whereIn('id', $assessmentIds)->delete();
        }

        $driveIds = $ids('placement_drives');
        if ($driveIds !== []) {
            DB::table('placement_drives')->whereIn('id', $driveIds)->delete();
        }
    }
}
