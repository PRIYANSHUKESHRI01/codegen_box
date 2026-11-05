<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ProjectEnrollment;
use App\Models\ProjectSave;
use App\Models\ProjectSubmission;
use App\Services\ProjectLab\ProjectLabPresenter;
use App\Services\ProjectLab\ProjectSaveService;
use App\Services\ProjectLab\ProjectSubmissionService;
use App\Services\ProjectLab\SnapshotArchive;
use App\Services\Workspaces\WorkspaceException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

/**
 * How a Project Lab project reaches AptRun: SAVE it (a checkpoint of the open editor) or SUBMIT it (the same snapshot, handed in for
 * review). In both, AptRun itself packs the code out of the student's running workspace. Nothing here accepts a file — a request that
 * carries one is refused — so every byte a reviewer sees was in the AptRun editor when the student pressed the button.
 *
 * The student can download what they saved or submitted as a .zip (built from the stored snapshot, which is never altered).
 */
class ProjectSubmitController extends Controller
{
    public function __construct(
        private readonly ProjectLabPresenter $presenter,
        private readonly ProjectSaveService $saves,
        private readonly SnapshotArchive $archive,
    ) {}

    /** POST /project-lab/enrollments/{enrollment}/submit */
    public function submit(Request $request, ProjectEnrollment $enrollment, ProjectSubmissionService $submissions): JsonResponse
    {
        $this->authorizeOwner($request, $enrollment);
        $this->refuseUploads($request);

        $data = $request->validate([
            // A link is only a reference now; the code comes from the editor (see ProjectSubmissionService).
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

    /** GET …/saves — the project's saved checkpoints, newest first. */
    public function saves(Request $request, ProjectEnrollment $enrollment): JsonResponse
    {
        $this->authorizeOwner($request, $enrollment);

        return response()->json(['saves' => $this->saves->list($enrollment)->map->present()->values()]);
    }

    /** POST …/saves — "Save progress": packs the open editor into a checkpoint. */
    public function save(Request $request, ProjectEnrollment $enrollment): JsonResponse
    {
        $this->authorizeOwner($request, $enrollment);
        $this->refuseUploads($request);

        $save = $this->saves->save($enrollment, $request->user());

        return response()->json(['save' => $save->present(), 'saves' => $this->saves->list($enrollment)->map->present()->values()], 201);
    }

    /** GET …/saves/{save}/download?format=zip|tgz */
    public function downloadSave(Request $request, ProjectEnrollment $enrollment, ProjectSave $save)
    {
        $this->authorizeOwner($request, $enrollment);
        abort_unless($save->project_enrollment_id === $enrollment->id, 404);

        return $this->download($request, $save->snapshot_path, 'project-'.$enrollment->id.'-save-'.$save->id);
    }

    /** GET …/submissions/{submission}/download?format=zip|tgz — the student's own hand-in. */
    public function downloadSubmission(Request $request, ProjectEnrollment $enrollment, ProjectSubmission $submission)
    {
        $this->authorizeOwner($request, $enrollment);
        abort_unless($submission->project_enrollment_id === $enrollment->id && $submission->hasSnapshot(), 404);

        return $this->download($request, $submission->snapshot_path, 'project-'.$enrollment->id.'-attempt-'.$submission->attempt);
    }

    // ---------------------------------------------------------------- helpers

    private function download(Request $request, string $path, string $base)
    {
        $disk = Storage::disk((string) config('workspaces.snapshot.disk'));
        abort_unless($disk->exists($path), 404);

        if ($request->query('format') === 'tgz') {
            return $disk->download($path, $base.'.tgz', ['Content-Type' => 'application/gzip']);
        }

        try {
            return $this->archive->zipResponse($path, $base.'.zip');
        } catch (RuntimeException $e) {
            abort(422, $e->getMessage());
        }
    }

    /** No file is ever accepted: the code is packed by AptRun from the open editor, not sent by the browser. */
    private function refuseUploads(Request $request): void
    {
        if ($request->allFiles() !== [] || str_contains((string) $request->header('Content-Type'), 'multipart/')) {
            throw new WorkspaceException(
                'Files cannot be uploaded to Project Lab. Write your code in the AptRun editor — AptRun packs it into a zip for you when you save or submit.',
                'uploads_not_accepted',
                422
            );
        }
    }

    private function authorizeOwner(Request $request, ProjectEnrollment $enrollment): void
    {
        abort_unless($enrollment->user_id === $request->user()->id, 404);
    }
}
