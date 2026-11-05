<?php

namespace App\Services\ProjectLab;

use App\Models\ActivityLog;
use App\Models\ProjectEnrollment;
use App\Models\ProjectSubmission;
use App\Models\ProjectWorkspace;
use App\Models\User;
use App\Services\Workspaces\AuthorshipReport;
use App\Services\Workspaces\WorkspaceException;
use App\Services\Workspaces\WorkspaceManager;
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
 * there is no "upload a zip" path to fake or forget, and (unless
 * config('project_lab.require_snapshot') is switched off) no way to hand a project in
 * without one: a repository link on its own is not a submission, because the code
 * behind it was not written in AptRun's editor. The snapshot is also checked for
 * files that were copied in from outside (see SnapshotInspector); a project that is
 * mostly that is refused, and anything less is shown to the reviewer.
 */
class ProjectSubmissionService
{
    public function __construct(
        private readonly SnapshotTaker $taker,
        private readonly ProjectLabAccess $access,
        private readonly WorkspaceManager $workspaces,
        private readonly AuthorshipReport $authorship,
    ) {}

    /**
     * @param  array{repo_url?: ?string, live_url?: ?string, notes?: ?string}  $data
     *
     * @throws WorkspaceException 402 not entitled, 409 wrong state or workspace not open, 422 snapshot too big or code copied in from
     *                            outside, 503 host failure
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
        $requireSnapshot = (bool) config('project_lab.require_snapshot', true);

        // The code has to come from the AptRun editor. A repository link is a reference the reviewer may look at, not a substitute for it.
        if (! $running && ($requireSnapshot || blank($repoUrl))) {
            throw WorkspaceException::notRunning();
        }

        $snapshot = $running ? $this->taker->take($workspace, $enrollment) : null;
        $provenance = $snapshot['provenance'] ?? null;

        if ($snapshot !== null && $provenance !== null && ($provenance['would_block'] ?? false) && config('project_lab.provenance.enforce', true)) {
            Storage::disk((string) config('workspaces.snapshot.disk'))->delete($snapshot['path']);

            throw new WorkspaceException(
                "Most of this project ({$provenance['predating']} of {$provenance['files']} files) was copied in from outside AptRun — those files are older than your workspace. "
                .'Project Lab projects have to be written in the AptRun editor. Write your own code in the workspace, then submit again.',
                'imported_files',
                422
            );
        }

        $integrity = $this->authorshipEvidence($workspace, $enrollment, $running);

        if ($provenance !== null) {
            $integrity = ($integrity ?? []) + ['provenance' => $provenance];
        }

        $total = $enrollment->topic->milestones()->count();
        $done = $enrollment->progress()->count();

        $warnings = [];
        if ($snapshot === null) {
            $warnings[] = 'No code snapshot is attached — the reviewer will rely on the repository link.';
        }
        if ($done === 0 && $total > 0) {
            $warnings[] = 'No milestones were marked complete.';
        }
        foreach (SnapshotInspector::warnings($provenance) as $line) {
            $warnings[] = $line;
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
}
