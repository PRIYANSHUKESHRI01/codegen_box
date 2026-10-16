<?php

namespace App\Services;

use App\Models\User;
use App\Services\Vault\VaultSyncService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/**
 * Permanently deletes ONE account — the superadmin's "delete this user".
 *
 * Only roles that belong to a single person's own data are deletable here: a
 * student/coder and a section coordinator. Everything the account owns goes
 * with it (submissions, attempts, applications, sessions, registrations — every
 * table that points at users cascades or nulls on delete, checked against the
 * live schema when CollegePurgeService was written), plus the pieces with no
 * foreign key at all: its API tokens, its subscriptions, and the files it
 * uploaded (avatar, resume, recorded answers).
 *
 * What is deliberately NOT deleted: payment records. `payment_orders.user_id`
 * is set to null instead, and the payer's name and email were snapshotted on the
 * row, so the money trail stays reconcilable against Razorpay after the person
 * is gone.
 *
 * Staff, TPO, company and superadmin accounts are refused: they own platform or
 * college content (contests, drives, templates) whose fate is a decision, not a
 * side effect. Block them, or delete the college for a TPO.
 *
 * The delete is one transaction, and files are removed only after it commits, so
 * a rollback can never cost anyone a file. The same file-collection code serves
 * CollegePurgeService, which deletes whole colleges.
 */
class UserPurgeService
{
    /** Roles whose account can be deleted on its own. */
    public const DELETABLE_ROLES = [User::ROLE_USER, User::ROLE_SECTION_COORDINATOR];

    public function canDelete(User $user): bool
    {
        return in_array($user->role, self::DELETABLE_ROLES, true);
    }

    /**
     * What deleting this account would remove, for the confirmation dialog.
     * Cheap COUNTs only.
     *
     * @return array<string, int>
     */
    public function preview(User $user): array
    {
        $count = fn (string $table, string $column = 'user_id') => DB::table($table)->where($column, $user->id)->count();

        return [
            'practice_submissions' => $count('submissions'),
            'contest_entries' => $count('contest_participants'),
            'interview_sessions' => $count('interview_sessions'),
            'drive_applications' => $count('drive_applications'),
            'subscriptions' => DB::table('subscriptions')->where('subscriber_type', User::class)->where('subscriber_id', $user->id)->count(),
            // Kept, not deleted: the payment record outlives the person.
            'payments_kept' => $count('payment_orders'),
        ];
    }

    /**
     * @return array<string, int> the preview() counts as they were just before deletion
     *
     * @throws \Throwable anything that stops the delete; nothing has been deleted when it does
     */
    public function purge(User $user): array
    {
        $removed = $this->preview($user);
        $files = $this->collectFiles([$user->id]);

        DB::transaction(function () use ($user) {
            // Mellow Vault holds a copy of a listed student's profile. The profile row is about to cascade
            // away, so the withdrawal (and the scrub of what the outbox still remembers) is queued first.
            app(VaultSyncService::class)->withdrawForDeletedUsers([$user->id]);

            DB::table('personal_access_tokens')->where('tokenable_type', User::class)->where('tokenable_id', $user->id)->delete();
            DB::table('subscriptions')->where('subscriber_type', User::class)->where('subscriber_id', $user->id)->delete();
            User::whereKey($user->id)->delete();
        });

        $this->deleteFiles($files);

        return $removed;
    }

    /**
     * Paths of files these users uploaded or recorded, grouped by storage disk
     * (avatars are public; resumes and recordings are private).
     *
     * @param  list<int>  $userIds
     * @return array<string, list<string>>
     */
    public function collectFiles(array $userIds): array
    {
        $files = ['public' => [], 'local' => []];

        foreach (array_chunk($userIds, 500) as $chunk) {
            $files['public'] = array_merge($files['public'], DB::table('users')->whereIn('id', $chunk)->whereNotNull('avatar_path')->pluck('avatar_path')->all());
            $files['local'] = array_merge(
                $files['local'],
                DB::table('users')->whereIn('id', $chunk)->whereNotNull('resume_path')->pluck('resume_path')->all(),
                DB::table('speaking_attempts')->whereIn('user_id', $chunk)->whereNotNull('audio_path')->pluck('audio_path')->all(),
                DB::table('interview_responses')
                    ->whereIn('interview_session_id', DB::table('interview_sessions')->whereIn('user_id', $chunk)->select('id'))
                    ->whereNotNull('audio_path')
                    ->pluck('audio_path')
                    ->all(),
            );
        }

        return $files;
    }

    /**
     * Removes files collected by collectFiles(). Call only once the rows that
     * pointed at them are really gone.
     *
     * @param  array<string, list<string>>  $files
     */
    public function deleteFiles(array $files): void
    {
        foreach ($files as $disk => $paths) {
            Storage::disk($disk)->delete(array_values(array_unique($paths)));
        }
    }
}
