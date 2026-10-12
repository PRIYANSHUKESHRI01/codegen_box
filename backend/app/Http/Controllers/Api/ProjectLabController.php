<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\ProjectEnrollment;
use App\Models\ProjectMilestone;
use App\Models\ProjectMilestoneProgress;
use App\Models\ProjectTopic;
use App\Models\ProjectWorkspace;
use App\Services\ProjectLab\ProjectLabAccess;
use App\Services\ProjectLab\ProjectLabPresenter;
use App\Services\ProjectLab\SowPdfService;
use App\Services\Workspaces\WorkspaceException;
use App\Services\Workspaces\WorkspaceManager;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Project Lab, student side: the catalog, a topic's SOW, starting a project and
 * ticking off its milestones. The workspace itself (the browser VS Code) is
 * ProjectWorkspaceController.
 *
 * Gating, in one sentence: anyone can browse the catalog and see what a project
 * is; the SOW body, the milestone detail, the PDF and the workspace need Project
 * Lab (a free-sample topic's SOW being the one exception). A 402 carries
 * `code: project_lab_required`, which the UI turns into the upgrade prompt.
 */
class ProjectLabController extends Controller
{
    public function __construct(
        private readonly ProjectLabAccess $access,
        private readonly ProjectLabPresenter $presenter,
    ) {}

    public function index(Request $request)
    {
        $user = $request->user();

        $topics = ProjectTopic::published()
            ->withCount('milestones')
            ->orderBy('display_order')
            ->orderBy('title')
            ->get();

        $enrollments = ProjectEnrollment::where('user_id', $user->id)
            ->withCount('progress')
            ->get()
            ->keyBy('project_topic_id');

        return response()->json([
            'project_lab' => $this->access->summary($user),
            'topics' => $topics->map(fn (ProjectTopic $t) => $this->presenter->card($t, $enrollments->get($t->id)))->values(),
            'categories' => $topics->pluck('category')->unique()->sort()->values(),
        ]);
    }

    public function show(Request $request, ProjectTopic $projectTopic)
    {
        abort_unless($projectTopic->isPublished(), 404);

        $user = $request->user();
        $projectTopic->load('milestones');

        $enrollment = ProjectEnrollment::where('user_id', $user->id)
            ->where('project_topic_id', $projectTopic->id)
            ->withCount('progress')
            ->first();

        return response()->json([
            'project_lab' => $this->access->summary($user),
            'topic' => $this->presenter->topic($projectTopic, $user, $enrollment),
        ]);
    }

    /** The student's own projects, newest activity first (includes ones whose plan has since lapsed). */
    public function mine(Request $request)
    {
        $user = $request->user();

        $enrollments = ProjectEnrollment::where('user_id', $user->id)
            ->with('topic')
            ->withCount('progress')
            ->latest('updated_at')
            ->get();

        return response()->json([
            'project_lab' => $this->access->summary($user),
            'projects' => $enrollments->map(function (ProjectEnrollment $e) {
                $e->topic->loadCount('milestones');

                return $this->presenter->card($e->topic, $e);
            })->values(),
        ]);
    }

    /**
     * Begin (or resume) a project. Idempotent: starting a topic you already have
     * returns the existing enrollment. Creates the workspace row but does not
     * start a container — that is the student's explicit "Open workspace".
     */
    public function start(Request $request, ProjectTopic $projectTopic, WorkspaceManager $workspaces)
    {
        abort_unless($projectTopic->isPublished(), 404);

        $user = $request->user();
        $coverage = $this->access->requireAccess($user);

        if (! $projectTopic->hasSow()) {
            throw new WorkspaceException('This project is not ready yet.', 'project_not_ready', 409);
        }

        $enrollment = DB::transaction(function () use ($user, $projectTopic, $coverage) {
            $existing = ProjectEnrollment::where('user_id', $user->id)
                ->where('project_topic_id', $projectTopic->id)
                ->lockForUpdate()
                ->first();

            if ($existing !== null) {
                if ($existing->status === ProjectEnrollment::STATUS_ABANDONED) {
                    $this->access->assertCanStartAnotherProject($user, $coverage);
                    $existing->update(['status' => ProjectEnrollment::STATUS_ACTIVE]);
                }

                return $existing;
            }

            $this->access->assertCanStartAnotherProject($user, $coverage);

            return ProjectEnrollment::create([
                'user_id' => $user->id,
                'project_topic_id' => $projectTopic->id,
                'sow_version' => $projectTopic->sow_version,
                'status' => ProjectEnrollment::STATUS_ACTIVE,
                'started_at' => now(),
            ]);
        });

        $workspaces->provision($enrollment);

        return response()->json([
            'project_lab' => $this->access->summary($user),
            'enrollment' => $this->presenter->enrollment($enrollment->fresh(), $user),
        ], $enrollment->wasRecentlyCreated ? 201 : 200);
    }

    public function showEnrollment(Request $request, ProjectEnrollment $enrollment)
    {
        $this->authorizeOwner($request, $enrollment);

        return response()->json([
            'project_lab' => $this->access->summary($request->user()),
            'enrollment' => $this->presenter->enrollment($enrollment, $request->user()),
        ]);
    }

    /** Tick or untick one milestone. Only while the project is in progress. */
    public function toggleMilestone(Request $request, ProjectEnrollment $enrollment, ProjectMilestone $milestone)
    {
        $this->authorizeOwner($request, $enrollment);
        $this->access->requireAccess($request->user());

        abort_unless($milestone->project_topic_id === $enrollment->project_topic_id, 404);

        if ($enrollment->status !== ProjectEnrollment::STATUS_ACTIVE) {
            throw new WorkspaceException('Milestones can only be changed while the project is in progress.', 'enrollment_not_active', 409);
        }

        $existing = ProjectMilestoneProgress::where('project_enrollment_id', $enrollment->id)
            ->where('project_milestone_id', $milestone->id)
            ->first();

        if ($existing !== null) {
            $existing->delete();
            $done = false;
        } else {
            ProjectMilestoneProgress::create([
                'project_enrollment_id' => $enrollment->id,
                'project_milestone_id' => $milestone->id,
                'completed_at' => now(),
            ]);
            $done = true;
        }

        return response()->json([
            'milestone_id' => $milestone->id,
            'done' => $done,
            'progress' => [
                'done' => $enrollment->progress()->count(),
                'total' => $enrollment->topic->milestones()->count(),
            ],
        ]);
    }

    /** Free the project slot. The workspace is stopped; the files stay on the volume. */
    public function abandon(Request $request, ProjectEnrollment $enrollment, WorkspaceManager $workspaces)
    {
        $this->authorizeOwner($request, $enrollment);

        if ($enrollment->status !== ProjectEnrollment::STATUS_ACTIVE) {
            throw new WorkspaceException('Only a project that is in progress can be abandoned.', 'enrollment_not_active', 409);
        }

        if ($enrollment->workspace !== null) {
            $workspaces->stop($enrollment->workspace, ProjectWorkspace::STOP_USER);
        }

        $enrollment->update(['status' => ProjectEnrollment::STATUS_ABANDONED]);

        return response()->json(['enrollment' => $this->presenter->enrollment($enrollment->fresh(), $request->user())]);
    }

    /** The watermarked SOW PDF. Logged: it is how a leaked copy is traced to an account. */
    public function downloadSow(Request $request, ProjectTopic $projectTopic, SowPdfService $pdf)
    {
        abort_unless($projectTopic->isPublished() && $projectTopic->hasSow(), 404);

        $user = $request->user();

        if (! $projectTopic->is_free_sample) {
            $this->access->requireAccess($user);
        }

        ActivityLog::record($user, 'Downloaded a SOW', 'Project', $projectTopic->title, ['sow_version' => $projectTopic->sow_version]);

        return response($pdf->render($projectTopic, $user), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="'.$pdf->filename($projectTopic).'"',
            'Cache-Control' => 'private, no-store',
        ]);
    }

    private function authorizeOwner(Request $request, ProjectEnrollment $enrollment): void
    {
        // 404, not 403: don't confirm that someone else's enrollment id exists.
        abort_unless($enrollment->user_id === $request->user()->id, 404);
    }
}
