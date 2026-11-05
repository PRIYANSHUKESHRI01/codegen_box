<?php

namespace App\Services\ProjectLab;

use App\Models\ProjectEnrollment;
use App\Models\ProjectWorkspace;
use App\Services\Workspaces\SnapshotScript;
use App\Services\Workspaces\WorkspaceException;
use App\Services\Workspaces\WorkspaceHosts;
use App\Services\Workspaces\WorkspaceRuntime;
use Illuminate\Support\Facades\Storage;
use Throwable;

/**
 * Packs a student's code out of their RUNNING workspace: the archive is built inside the container, copied out as one file, hashed,
 * stored on the private snapshot disk and inspected for where the code came from. Used by "Save progress" and by "Submit" — the same
 * snapshot either way, and the only way code ever reaches AptRun: there is no upload anywhere in Project Lab.
 *
 * (It drives the workspace host through the existing runtime and SnapshotScript exactly as the submission always has; nothing under
 * app/Services/Workspaces is changed or needed to change.)
 */
class SnapshotTaker
{
    public function __construct(
        private readonly WorkspaceRuntime $runtime,
        private readonly WorkspaceHosts $hosts,
        private readonly SnapshotInspector $inspector,
    ) {}

    /**
     * @param  string  $folder  sub-folder of the snapshot directory ('' for submissions, 'saves' for checkpoints)
     * @return array{path: string, size: int, sha256: string, provenance: array<string, mixed>|null}
     *
     * @throws WorkspaceException 422 snapshot too big, 503 host failure
     */
    public function take(ProjectWorkspace $workspace, ProjectEnrollment $enrollment, string $folder = ''): array
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

            $provenance = null;
            try {
                $provenance = $this->inspector->inspect($local, ($workspace->created_at ?? now()));
            } catch (Throwable) {
                // Evidence only: never a reason to lose a student's snapshot.
            }

            $disk = Storage::disk((string) config('workspaces.snapshot.disk'));
            $directory = trim((string) config('workspaces.snapshot.directory'), '/').($folder !== '' ? '/'.trim($folder, '/') : '');
            $path = $directory.'/'.$workspace->user_id.'/'.$enrollment->id.'-'.now()->format('YmdHis').'-'.substr($sha256, 0, 8).'.tgz';

            $stream = fopen($local, 'rb');
            try {
                $disk->put($path, $stream);
            } finally {
                if (is_resource($stream)) {
                    fclose($stream);
                }
            }

            return ['path' => $path, 'size' => $size, 'sha256' => $sha256, 'provenance' => $provenance];
        } finally {
            @unlink($local);
            $this->removeRemote($host, $workspace);
        }
    }

    private function removeRemote($host, ProjectWorkspace $workspace): void
    {
        try {
            $this->runtime->exec($host, $workspace->container_name, ['rm', '-f', SnapshotScript::OUTPUT]);
        } catch (Throwable) {
            // Best effort: /var/tmp is ephemeral anyway.
        }
    }
}
