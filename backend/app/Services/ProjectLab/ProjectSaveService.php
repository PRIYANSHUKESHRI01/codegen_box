<?php

namespace App\Services\ProjectLab;

use App\Models\ProjectEnrollment;
use App\Models\ProjectSave;
use App\Models\ProjectWorkspace;
use App\Models\User;
use App\Services\Workspaces\WorkspaceException;
use Illuminate\Support\Facades\Storage;

/**
 * "Save progress": a checkpoint of the student's project, packed by AptRun out of the open editor and kept privately, so a reviewer
 * (and the student) can see how the project grew. The newest few are kept; older ones are removed with their files.
 *
 * Needs the workspace open — a save is a snapshot of the editor, there is nothing else to save — and an active project (once handed in,
 * the code is the submission's). Saving twice in a few seconds returns the save just made instead of storing a duplicate.
 */
class ProjectSaveService
{
    public function __construct(
        private readonly SnapshotTaker $taker,
        private readonly ProjectLabAccess $access,
    ) {}

    /**
     * @throws WorkspaceException 402 not entitled, 409 project not active or workspace not open, 422 too big, 503 host failure
     */
    public function save(ProjectEnrollment $enrollment, User $user): ProjectSave
    {
        $this->access->requireAccess($user);

        if ($enrollment->status !== ProjectEnrollment::STATUS_ACTIVE) {
            throw new WorkspaceException(
                $enrollment->status === ProjectEnrollment::STATUS_SUBMITTED ? 'Your project is already under review, so there is nothing more to save.' : 'This project can no longer be saved.',
                'save_not_allowed',
                409
            );
        }

        $workspace = $enrollment->workspace;

        if ($workspace === null || $workspace->status !== ProjectWorkspace::STATUS_RUNNING) {
            throw WorkspaceException::notRunning();
        }

        $latest = ProjectSave::where('project_enrollment_id', $enrollment->id)->latest('id')->first();
        $interval = (int) config('project_lab.saves.min_interval_seconds', 15);

        if ($latest !== null && $latest->created_at->gt(now()->subSeconds($interval))) {
            return $latest;
        }

        $snapshot = $this->taker->take($workspace, $enrollment, 'saves');

        $save = ProjectSave::create([
            'project_enrollment_id' => $enrollment->id,
            'user_id' => $user->id,
            'snapshot_path' => $snapshot['path'],
            'snapshot_size_bytes' => $snapshot['size'],
            'snapshot_sha256' => $snapshot['sha256'],
            'files_count' => (int) ($snapshot['provenance']['files'] ?? 0),
            'milestones_done' => $enrollment->progress()->count(),
            'milestones_total' => $enrollment->topic->milestones()->count(),
            'provenance' => $snapshot['provenance'],
        ]);

        $this->prune($enrollment);

        return $save;
    }

    /** The saves of a project, newest first. */
    public function list(ProjectEnrollment $enrollment)
    {
        return ProjectSave::where('project_enrollment_id', $enrollment->id)->latest('id')->get();
    }

    /** Keeps the newest few saves; removes the rest with their files. */
    private function prune(ProjectEnrollment $enrollment): void
    {
        $keep = max(1, (int) config('project_lab.saves.keep', 10));
        $disk = Storage::disk((string) config('workspaces.snapshot.disk'));

        ProjectSave::where('project_enrollment_id', $enrollment->id)->latest('id')->skip($keep)->take(200)->get()->each(function (ProjectSave $old) use ($disk) {
            $disk->delete($old->snapshot_path);
            $old->delete();
        });
    }
}
