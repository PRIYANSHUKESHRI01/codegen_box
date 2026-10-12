<?php

namespace App\Services\ProjectLab;

use App\Models\ActivityLog;
use App\Models\ProjectEnrollment;
use App\Models\ProjectSubmission;
use App\Models\ProjectWorkspace;
use App\Models\User;
use App\Services\Workspaces\AuthorshipReport;
use App\Services\Workspaces\SnapshotScript;
use App\Services\Workspaces\WorkspaceException;
use App\Services\Workspaces\WorkspaceHosts;
use App\Services\Workspaces\WorkspaceManager;
use App\Services\Workspaces\WorkspaceRuntime;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Throwable;

/**
 * Hand-in: archive the student's code out of their running workspace, store it
 * privately, and queue it for review.
 *
 * The archive is taken at submission time from the live container, so what the
 * reviewer sees is exactly what the student had when they pressed Submit —
 * there is no "upload a zip" path to fake or forget. A submission needs either
 * that snapshot or a repository link; a snapshot needs the workspace open.
 */
class ProjectSubmissionService
{
    public function __construct(
        private readonly WorkspaceRuntime $runtime,
        private readonly WorkspaceHosts $hosts,
        private readonly ProjectLabAccess $access,
        private readonly WorkspaceManager $workspaces,
        private readonly AuthorshipReport $authorship,
    ) {}

    /**
     * @param  array{repo_url?: ?string, live_url?: ?string, notes?: ?string}  $data
     *
     * @throws WorkspaceException 402 not entitled, 409 wrong state or workspace not open and no repo link,
     *                            422 snapshot too big, 503 host failure
     */
    public function submit(ProjectEnrollment $enrollment, User $user, array $data): ProjectSubmission
    {
        $this->access->requireAccess($user);

        if ($enrollment->status !== ProjectEnrollment::STATUS_ACTIVE) {
            throw new WorkspaceException(
                $enrollment->status === ProjectEnrollment::STATUS_SUBMITTED
                    ? 'Your project is already under review.'
                    : 'This project can no longer be submitted.',
                'submission_not_allowed',
                409
            );
        }

        $workspace = $enrollment->workspace;
        $running = $workspace !== null && $workspace->status === ProjectWorkspace::STATUS_RUNNING;
        $repoUrl = $data['repo_url'] ?? null;

        if (! $running && blank($repoUrl)) {
            throw WorkspaceException::notRunning();
        }

        $snapshot = $running ? $this->takeSnapshot($workspace, $enrollment) : null;
        $integrity = $this->authorshipEvidence($workspace, $enrollment, $running);

        $total = $enrollment->topic->milestones()->count();
        $done = $enrollment->progress()->count();

        $warnings = [];
        if ($snapshot === null) {
            $warnings[] = 'No code snapshot is attached — the reviewer will rely on the repository link.';
        }
        if ($done === 0 && $total > 0) {
            $warnings[] = 'No milestones were marked complete.';
        }

        $submission = DB::transaction(function () use ($enrollment, $user, $data, $snapshot, $total, $done, $warnings, $integrity) {
            $attempt = (int) $enrollment->submissions()->max('attempt') + 1;

            $submission = ProjectSubmission::create([
                'project_enrollment_id' => $enrollment->id,
                'user_id' => $user->id,
                'attempt' => $attempt,
                'snapshot_path' => $snapshot['path'] ?? null,
                'snapshot_size_bytes' => $snapshot['size'] ?? 0,
                'snapshot_sha256' => $snapshot['sha256'] ?? null,
                'repo_url' => $data['repo_url'] ?? null,
                'live_url' => $data['live_url'] ?? null,
                'notes' => $data['notes'] ?? null,
                'milestones_done' => $done,
                'milestones_total' => $total,
                'warnings' => $warnings ?: null,
                'integrity' => $integrity,
                'status' => ProjectSubmission::STATUS_PENDING,
                'submitted_at' => now(),
            ]);

            $enrollment->update(['status' => ProjectEnrollment::STATUS_SUBMITTED, 'submitted_at' => now()]);

            ActivityLog::record($user, 'Submitted a Project Lab project', 'Project', $enrollment->topic->title, [
                'attempt' => $attempt,
                'milestones' => "{$done}/{$total}",
            ]);

            return $submission;
        });

        // The code is captured and the project is out of the student's hands until a
        // reviewer answers, so the workspace has nothing left to do: stop it now rather
        // than leaving a container running (and hours ticking) until the idle reaper
        // notices. If the reviewer asks for changes the student simply starts it again —
        // the volume, and so every file, is untouched. Done after the commit so a host
        // that is slow or unreachable can never undo a submission that was accepted.
        if ($workspace !== null && $workspace->isLive()) {
            $this->workspaces->stop($workspace, ProjectWorkspace::STOP_SUBMITTED);
        }

        return $submission;
    }

    /**
     * The authorship evidence, frozen at hand-in. It is evidence for a reviewer, never a gate: whatever goes wrong
     * here, the submission still goes through (with no report) rather than failing a student's hand-in.
     *
     * @return array<string, mixed>|null
     */
    private function authorshipEvidence(?ProjectWorkspace $workspace, ProjectEnrollment $enrollment, bool $running): ?array
    {
        if ($workspace === null) {
            return null;
        }

        try {
            return $this->authorship->build($workspace, $enrollment, inspectContainer: $running);
        } catch (Throwable $e) {
            Log::warning("authorship report failed for enrollment {$enrollment->id}: ".$e->getMessage());

            return null;
        }
    }

    /**
     * Archive the workspace inside the container, copy the single file out, hash
     * and store it. The remote and local temp files are always removed.
     *
     * @return array{path: string, size: int, sha256: string}
     */
    private function takeSnapshot(ProjectWorkspace $workspace, ProjectEnrollment $enrollment): array
    {
        $host = $this->hosts->find($workspace->host)
            ?? throw WorkspaceException::hostError("workspace {$workspace->id} is pinned to unknown host [{$workspace->host}]");

        $maxBytes = (int) config('workspaces.snapshot.max_bytes');
        $script = SnapshotScript::build((array) config('workspaces.snapshot'));

        $result = $this->runtime->exec($host, $workspace->container_name, ['bash', '-c', $script], null, 300);

        if (! $result->successful()) {
            $this->removeRemote($host, $workspace);

            throw WorkspaceException::hostError('snapshot failed: '.trim($result->stderr));
        }

        $remoteSize = (int) trim($result->stdout);

        if ($remoteSize > $maxBytes) {
            $this->removeRemote($host, $workspace);

            throw new WorkspaceException(
                'Your project is too large to submit ('.round($remoteSize / 1048576).' MB; the limit is '.round($maxBytes / 1048576).' MB). Remove build output and large files, then try again.',
                'snapshot_too_large',
                422
            );
        }

        $local = tempnam(sys_get_temp_dir(), 'aptrun-snap-');

        try {
            $this->runtime->copyOut($host, $workspace->container_name, SnapshotScript::OUTPUT, $local);

            $size = (int) filesize($local);
            $sha256 = (string) hash_file('sha256', $local);

            $disk = Storage::disk((string) config('workspaces.snapshot.disk'));
            $path = trim((string) config('workspaces.snapshot.directory'), '/')
                .'/'.$workspace->user_id
                .'/'.$enrollment->id.'-'.now()->format('YmdHis').'-'.substr($sha256, 0, 8).'.tgz';

            $stream = fopen($local, 'rb');
            try {
                $disk->put($path, $stream);
            } finally {
                if (is_resource($stream)) {
                    fclose($stream);
                }
            }

            return ['path' => $path, 'size' => $size, 'sha256' => $sha256];
        } finally {
            @unlink($local);
            $this->removeRemote($host, $workspace);
        }
    }

    private function removeRemote($host, ProjectWorkspace $workspace): void
    {
        try {
            $this->runtime->exec($host, $workspace->container_name, ['rm', '-f', SnapshotScript::OUTPUT]);
        } catch (\Throwable) {
            // Best effort: /var/tmp is ephemeral anyway.
        }
    }
}
