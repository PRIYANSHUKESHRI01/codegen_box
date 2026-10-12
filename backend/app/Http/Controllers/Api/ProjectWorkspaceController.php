<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ProjectEnrollment;
use App\Models\ProjectWorkspace;
use App\Services\ProjectLab\ProjectLabAccess;
use App\Services\ProjectLab\ProjectLabPresenter;
use App\Services\ProjectLab\ProjectSubmissionService;
use App\Services\Workspaces\WorkspaceException;
use App\Services\Workspaces\WorkspaceIntegrity;
use App\Services\Workspaces\WorkspaceManager;
use Illuminate\Http\Request;

/**
 * The student's browser VS Code for one enrollment: start, poll, heartbeat,
 * stop, and submit from it. Every route is scoped to the enrollment's owner.
 *
 * The workspace page polls show() until `ready`, then heartbeats every minute
 * for as long as it is open — that heartbeat is both the idle detector and the
 * hours meter (see WorkspaceManager).
 */
class ProjectWorkspaceController extends Controller
{
    public function __construct(
        private readonly WorkspaceManager $workspaces,
        private readonly ProjectLabAccess $access,
        private readonly ProjectLabPresenter $presenter,
        private readonly WorkspaceIntegrity $integrity,
    ) {}

    public function start(Request $request, ProjectEnrollment $enrollment)
    {
        $this->authorizeOwner($request, $enrollment);

        if (! config('workspaces.enabled', true)) {
            throw new WorkspaceException('Workspaces are temporarily unavailable. Please try again soon.', 'workspaces_disabled', 503);
        }

        if ($enrollment->status !== ProjectEnrollment::STATUS_ACTIVE) {
            throw new WorkspaceException('This project is not in progress, so its workspace cannot be opened.', 'enrollment_not_active', 409);
        }

        $workspace = $this->workspaces->provision($enrollment);
        $workspace = $this->workspaces->start($workspace, $request->user());

        return response()->json($this->payload($request, $workspace));
    }

    /** Poll target while the editor boots; also refreshes a running workspace's true state. */
    public function show(Request $request, ProjectEnrollment $enrollment)
    {
        $this->authorizeOwner($request, $enrollment);

        $workspace = $enrollment->workspace;

        if ($workspace === null) {
            return response()->json(['workspace' => null, 'project_lab' => $this->access->summary($request->user())]);
        }

        return response()->json($this->payload($request, $this->workspaces->refresh($workspace)));
    }

    /** Runs every minute for every open workspace page, so it is cheap: the manager asks Docker whether the container still exists only every ~100 s. */
    public function heartbeat(Request $request, ProjectEnrollment $enrollment)
    {
        $this->authorizeOwner($request, $enrollment);

        $workspace = $enrollment->workspace;

        if ($workspace === null) {
            return response()->json(['status' => ProjectWorkspace::STATUS_STOPPED]);
        }

        $workspace = $this->workspaces->heartbeat($workspace);
        $summary = $this->access->summary($request->user());

        return response()->json([
            'status' => $workspace->status,
            'stop_reason' => $workspace->stop_reason,
            'hours' => $summary['hours'],
            'enabled' => $summary['enabled'],
        ]);
    }

    /**
     * What the editor's authorship guard reports (see WorkspaceIntegrity): refused pastes, typing no person produces,
     * and a pulse that says the guard is running. Metadata only. A bad event is dropped, not an error: the guard is
     * best-effort and must never be able to break the student's session.
     */
    public function integrity(Request $request, ProjectEnrollment $enrollment)
    {
        $this->authorizeOwner($request, $enrollment);

        $data = $request->validate([
            'v' => ['nullable', 'string', 'max:16'],
            'active' => ['sometimes', 'boolean'],
            'events' => ['sometimes', 'array', 'max:'.(int) config('authorship.max_events_per_call', 50)],
            'events.*' => ['array'],
        ]);

        $workspace = $enrollment->workspace;

        if ($workspace === null) {
            return response()->json(['accepted' => 0, 'duplicates' => 0, 'dropped' => count($data['events'] ?? [])]);
        }

        return response()->json($this->integrity->record($workspace, $request->user(), $data));
    }

    public function stop(Request $request, ProjectEnrollment $enrollment)
    {
        $this->authorizeOwner($request, $enrollment);

        $workspace = $enrollment->workspace;

        if ($workspace !== null) {
            $this->workspaces->stop($workspace, ProjectWorkspace::STOP_USER);
        }

        return response()->json($this->payload($request, $workspace?->fresh()));
    }

    public function submit(Request $request, ProjectEnrollment $enrollment, ProjectSubmissionService $submissions)
    {
        $this->authorizeOwner($request, $enrollment);

        $data = $request->validate([
            'repo_url' => ['nullable', 'url:https', 'max:500'],
            'live_url' => ['nullable', 'url:http,https', 'max:500'],
            'notes' => ['nullable', 'string', 'max:4000'],
        ]);

        $submission = $submissions->submit($enrollment, $request->user(), $data);

        return response()->json([
            'submission' => $this->presenter->submission($submission),
            'enrollment' => $this->presenter->enrollment($enrollment->fresh(), $request->user()),
        ], 201);
    }

    /** @return array<string, mixed> */
    private function payload(Request $request, ?ProjectWorkspace $workspace): array
    {
        return [
            'workspace' => $workspace === null ? null : $this->workspaces->present($workspace),
            'project_lab' => $this->access->summary($request->user()),
        ];
    }

    private function authorizeOwner(Request $request, ProjectEnrollment $enrollment): void
    {
        abort_unless($enrollment->user_id === $request->user()->id, 404);
    }
}
