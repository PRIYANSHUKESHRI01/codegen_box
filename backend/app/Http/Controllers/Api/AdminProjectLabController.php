<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\ProjectEnrollment;
use App\Models\ProjectSubmission;
use App\Models\ProjectTopic;
use App\Services\ProjectLab\SowPdfService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Mellow-internal-staff-only (role: admin_internal, superadmin; permission:
 * project_lab) — the authoring and review surface for Project Lab.
 *
 * Topics and their SOWs are written by hand here (Markdown + structured
 * milestones with acceptance criteria); nothing is generated. A topic is
 * invisible to students until it is published, and cannot be published without a
 * SOW and at least one milestone. A topic anyone has worked on can be archived
 * but never deleted.
 */
class AdminProjectLabController extends Controller
{
    // ───────────────────────────── topics ─────────────────────────────

    public function topics()
    {
        $topics = ProjectTopic::withCount(['milestones', 'enrollments'])
            ->orderBy('display_order')
            ->orderBy('title')
            ->get()
            ->map(fn (ProjectTopic $t) => $this->listRow($t));

        return response()->json(['topics' => $topics]);
    }

    public function showTopic(ProjectTopic $projectTopic)
    {
        return response()->json(['topic' => $this->full($projectTopic)]);
    }

    public function storeTopic(Request $request)
    {
        $data = $request->validate($this->rules());

        $topic = DB::transaction(function () use ($data, $request) {
            $topic = ProjectTopic::create($this->attributes($data) + [
                'slug' => ProjectTopic::uniqueSlug($data['title']),
                'created_by' => $request->user()->id,
            ]);

            $this->syncMilestones($topic, $data['milestones'] ?? []);
            $this->assertPublishable($topic);
            $this->stampPublished($topic);

            return $topic;
        });

        ActivityLog::record($request->user(), 'Created a Project Lab topic', 'Project', $topic->title);

        // fresh(): columns that took their default in the database (sow_version…) aren't on the created model.
        return response()->json(['topic' => $this->full($topic->fresh())], 201);
    }

    public function updateTopic(Request $request, ProjectTopic $projectTopic)
    {
        $data = $request->validate($this->rules());

        DB::transaction(function () use ($data, $projectTopic) {
            $attributes = $this->attributes($data);

            // A material change to the SOW is announced by bumping its version — students mid-way
            // are then told "the SOW has been updated". A typo fix must not do that, so it is opt-in.
            if (! empty($data['bump_sow_version'])) {
                $attributes['sow_version'] = $projectTopic->sow_version + 1;
            }

            $projectTopic->update($attributes);

            if (array_key_exists('milestones', $data)) {
                $this->syncMilestones($projectTopic, $data['milestones'] ?? []);
            }

            $this->assertPublishable($projectTopic->fresh());
            $this->stampPublished($projectTopic->fresh());
        });

        ActivityLog::record($request->user(), 'Updated a Project Lab topic', 'Project', $projectTopic->title);

        return response()->json(['topic' => $this->full($projectTopic->fresh())]);
    }

    public function destroyTopic(Request $request, ProjectTopic $projectTopic)
    {
        if ($projectTopic->enrollments()->exists()) {
            return response()->json([
                'message' => 'Students have worked on this project, so it cannot be deleted. Archive it instead.',
            ], 409);
        }

        $title = $projectTopic->title;
        $projectTopic->delete();

        ActivityLog::record($request->user(), 'Deleted a Project Lab topic', 'Project', $title);

        return response()->json(['message' => 'Topic deleted.']);
    }

    // ──────────────────────────── submissions ────────────────────────────

    /** The review queue. Defaults to what needs a reviewer; `?status=all` for history. */
    public function submissions(Request $request)
    {
        $status = $request->query('status');

        $query = ProjectSubmission::with(['user:id,name,email', 'enrollment.topic:id,title,slug'])
            ->orderByRaw("CASE status WHEN 'pending_review' THEN 0 WHEN 'in_review' THEN 1 ELSE 2 END")
            ->orderByDesc('submitted_at');

        if ($status === null || $status === 'open') {
            $query->whereIn('status', [ProjectSubmission::STATUS_PENDING, ProjectSubmission::STATUS_IN_REVIEW]);
        } elseif ($status !== 'all') {
            $query->where('status', $status);
        }

        return response()->json([
            'submissions' => $query->limit(300)->get()->map(fn (ProjectSubmission $s) => $this->submissionRow($s)),
            'counts' => [
                'pending_review' => ProjectSubmission::where('status', ProjectSubmission::STATUS_PENDING)->count(),
                'in_review' => ProjectSubmission::where('status', ProjectSubmission::STATUS_IN_REVIEW)->count(),
            ],
        ]);
    }

    public function showSubmission(ProjectSubmission $submission)
    {
        $submission->load(['user:id,name,email,college_id', 'enrollment.topic.milestones', 'enrollment.progress', 'reviewer:id,name']);

        $enrollment = $submission->enrollment;
        $done = $enrollment->progress->pluck('project_milestone_id')->flip();

        return response()->json([
            'submission' => $this->submissionRow($submission) + [
                'notes' => $submission->notes,
                'rubric' => $submission->rubric ?? [],
                'feedback' => $submission->feedback,
                'warnings' => $submission->warnings ?? [],
                'integrity' => $submission->integrity,
                'integrity_events' => $this->integrityTimeline($submission),
                'reviewer' => $submission->reviewer?->name,
                'milestones' => $enrollment->topic->milestones->map(fn ($m) => [
                    'id' => $m->id,
                    'title' => $m->title,
                    'acceptance_criteria' => $m->acceptance_criteria ?? [],
                    'done' => $done->has($m->id),
                ])->values(),
                'previous_attempts' => $enrollment->submissions()
                    ->where('id', '!=', $submission->id)
                    ->get(['id', 'attempt', 'status', 'score', 'submitted_at']),
            ],
        ]);
    }

    /**
     * The guard's most recent reports for this project, newest first, for the reviewer's timeline. Metadata only:
     * kind, size, where, when. There is no text to show, by design.
     *
     * @return list<array{kind: string, size: ?int, target: ?string, at: string, report_only: bool}>
     */
    private function integrityTimeline(ProjectSubmission $submission): array
    {
        $workspace = $submission->enrollment->workspace;

        if ($workspace === null) {
            return [];
        }

        return $workspace->integrityEvents()
            ->whereNotIn('kind', ['paste_internal', 'drop_asset'])
            ->latest('occurred_at')
            ->limit(60)
            ->get()
            ->map(fn ($e) => [
                'kind' => $e->kind,
                'size' => $e->size,
                'target' => $e->target,
                'at' => $e->occurred_at->toIso8601String(),
                'report_only' => (bool) ($e->meta['reportOnly'] ?? false),
            ])
            ->all();
    }

    /** Stream the snapshot. Authorised and audited — it is a student's source code. */
    public function downloadSnapshot(Request $request, ProjectSubmission $submission)
    {
        $disk = Storage::disk((string) config('workspaces.snapshot.disk'));

        abort_unless($submission->hasSnapshot() && $disk->exists($submission->snapshot_path), 404);

        ActivityLog::record($request->user(), 'Downloaded a project snapshot', 'Project', $submission->enrollment->topic->title, [
            'submission_id' => $submission->id,
            'student_id' => $submission->user_id,
        ]);

        $name = 'project-'.$submission->project_enrollment_id.'-attempt-'.$submission->attempt.'.tgz';

        return $disk->download($submission->snapshot_path, $name, ['Content-Type' => 'application/gzip']);
    }

    public function review(Request $request, ProjectSubmission $submission)
    {
        $data = $request->validate([
            'status' => ['required', Rule::in([
                ProjectSubmission::STATUS_IN_REVIEW,
                ProjectSubmission::STATUS_REVIEWED,
                ProjectSubmission::STATUS_NEEDS_CHANGES,
            ])],
            'score' => ['nullable', 'integer', 'min:0', 'max:100', 'required_if:status,'.ProjectSubmission::STATUS_REVIEWED],
            'rubric' => ['nullable', 'array', 'max:12'],
            'rubric.*.criterion' => ['required', 'string', 'max:120'],
            'rubric.*.score' => ['required', 'numeric', 'min:0'],
            'rubric.*.max' => ['required', 'numeric', 'min:1'],
            'feedback' => ['nullable', 'string', 'max:8000', 'required_if:status,'.ProjectSubmission::STATUS_NEEDS_CHANGES],
        ]);

        $final = $data['status'] !== ProjectSubmission::STATUS_IN_REVIEW;

        DB::transaction(function () use ($submission, $data, $request, $final) {
            $submission->update([
                'status' => $data['status'],
                'score' => $data['score'] ?? $submission->score,
                'rubric' => $data['rubric'] ?? $submission->rubric,
                'feedback' => $data['feedback'] ?? $submission->feedback,
                'reviewed_by' => $request->user()->id,
                'reviewed_at' => $final ? now() : null,
            ]);

            // reviewed = finished; needs_changes hands the project back so the student can fix and resubmit.
            $submission->enrollment->update(['status' => match ($data['status']) {
                ProjectSubmission::STATUS_REVIEWED => ProjectEnrollment::STATUS_REVIEWED,
                ProjectSubmission::STATUS_NEEDS_CHANGES => ProjectEnrollment::STATUS_ACTIVE,
                default => ProjectEnrollment::STATUS_SUBMITTED,
            }]);
        });

        ActivityLog::record($request->user(), 'Reviewed a project submission', 'Project', $submission->enrollment->topic->title, [
            'submission_id' => $submission->id,
            'outcome' => $data['status'],
            'score' => $data['score'] ?? null,
        ]);

        return $this->showSubmission($submission->fresh());
    }

    // ───────────────────────────── helpers ─────────────────────────────

    /** @return array<string, mixed> */
    private function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:160'],
            'category' => ['required', 'string', 'max:60'],
            'summary' => ['required', 'string', 'max:600'],
            'difficulty' => ['required', Rule::in(ProjectTopic::DIFFICULTIES)],
            'estimated_hours' => ['required', 'integer', 'min:1', 'max:1000'],
            'tech_stack' => ['nullable', 'array', 'max:20'],
            'tech_stack.*' => ['string', 'max:40'],
            'outcomes' => ['nullable', 'array', 'max:20'],
            'outcomes.*' => ['string', 'max:200'],
            'sow_markdown' => ['nullable', 'string', 'max:'.SowPdfService::MAX_MARKDOWN_CHARS],
            'status' => ['required', Rule::in(ProjectTopic::STATUSES)],
            'is_free_sample' => ['nullable', 'boolean'],
            'authorship_mode' => ['nullable', Rule::in(ProjectTopic::AUTHORSHIP_MODES)],
            'icon' => ['nullable', 'string', 'max:40'],
            'display_order' => ['nullable', 'integer', 'min:0', 'max:100000'],
            'bump_sow_version' => ['nullable', 'boolean'],
            'milestones' => ['nullable', 'array', 'max:40'],
            'milestones.*.id' => ['nullable', 'integer'],
            'milestones.*.title' => ['required', 'string', 'max:200'],
            'milestones.*.description' => ['nullable', 'string', 'max:2000'],
            'milestones.*.acceptance_criteria' => ['nullable', 'array', 'max:20'],
            'milestones.*.acceptance_criteria.*' => ['string', 'max:300'],
            'milestones.*.estimated_hours' => ['nullable', 'integer', 'min:0', 'max:200'],
        ];
    }

    /** @return array<string, mixed> the topic columns out of validated input */
    private function attributes(array $data): array
    {
        return [
            'title' => $data['title'],
            'category' => $data['category'],
            'summary' => $data['summary'],
            'difficulty' => $data['difficulty'],
            'estimated_hours' => $data['estimated_hours'],
            'tech_stack' => array_values($data['tech_stack'] ?? []),
            'outcomes' => array_values($data['outcomes'] ?? []),
            'sow_markdown' => $data['sow_markdown'] ?? null,
            'status' => $data['status'],
            'is_free_sample' => (bool) ($data['is_free_sample'] ?? false),
            'authorship_mode' => $data['authorship_mode'] ?? ProjectTopic::AUTHORSHIP_STRICT,
            'icon' => $data['icon'] ?? null,
            'display_order' => $data['display_order'] ?? 0,
        ];
    }

    /**
     * Replace the topic's milestones with the submitted list, in order. Rows
     * carrying a known id are updated in place (so students' ticks survive a
     * rename or reorder); new rows are created; rows left out are deleted, and
     * take their progress ticks with them.
     */
    private function syncMilestones(ProjectTopic $topic, array $milestones): void
    {
        $existing = $topic->milestones()->get()->keyBy('id');
        $keep = [];

        foreach (array_values($milestones) as $position => $row) {
            $attributes = [
                'position' => $position,
                'title' => $row['title'],
                'description' => $row['description'] ?? null,
                'acceptance_criteria' => array_values($row['acceptance_criteria'] ?? []),
                'estimated_hours' => $row['estimated_hours'] ?? 4,
            ];

            $milestone = isset($row['id']) ? $existing->get($row['id']) : null;

            if ($milestone !== null) {
                $milestone->update($attributes);
            } else {
                $milestone = $topic->milestones()->create($attributes);
            }

            $keep[] = $milestone->id;
        }

        $topic->milestones()->whereNotIn('id', $keep)->delete();
    }

    /** @throws ValidationException */
    private function assertPublishable(ProjectTopic $topic): void
    {
        if ($topic->status !== ProjectTopic::STATUS_PUBLISHED) {
            return;
        }

        $problems = [];

        if (mb_strlen(trim((string) $topic->sow_markdown)) < 100) {
            $problems['sow_markdown'] = ['Write the SOW before publishing (at least a few paragraphs).'];
        }

        if (! $topic->milestones()->exists()) {
            $problems['milestones'] = ['Add at least one milestone before publishing.'];
        }

        if ($problems !== []) {
            throw ValidationException::withMessages($problems);
        }
    }

    private function stampPublished(ProjectTopic $topic): void
    {
        if ($topic->status === ProjectTopic::STATUS_PUBLISHED && $topic->published_at === null) {
            $topic->update(['published_at' => now()]);
        }
    }

    /** @return array<string, mixed> */
    private function listRow(ProjectTopic $topic): array
    {
        return [
            'id' => $topic->id,
            'slug' => $topic->slug,
            'title' => $topic->title,
            'category' => $topic->category,
            'difficulty' => $topic->difficulty,
            'estimated_hours' => $topic->estimated_hours,
            'status' => $topic->status,
            'is_free_sample' => $topic->is_free_sample,
            'sow_version' => $topic->sow_version,
            'has_sow' => $topic->hasSow(),
            'milestone_count' => $topic->milestones_count,
            'enrollment_count' => $topic->enrollments_count,
            'display_order' => $topic->display_order,
            'published_at' => $topic->published_at?->toIso8601String(),
            'updated_at' => $topic->updated_at?->toIso8601String(),
        ];
    }

    /** @return array<string, mixed> */
    private function full(ProjectTopic $topic): array
    {
        $topic->load('milestones')->loadCount('enrollments');

        return [
            'id' => $topic->id,
            'slug' => $topic->slug,
            'title' => $topic->title,
            'category' => $topic->category,
            'summary' => $topic->summary,
            'difficulty' => $topic->difficulty,
            'estimated_hours' => $topic->estimated_hours,
            'tech_stack' => $topic->tech_stack ?? [],
            'outcomes' => $topic->outcomes ?? [],
            'sow_markdown' => $topic->sow_markdown,
            'sow_version' => $topic->sow_version,
            'status' => $topic->status,
            'is_free_sample' => $topic->is_free_sample,
            'authorship_mode' => $topic->authorship_mode,
            'icon' => $topic->icon,
            'display_order' => $topic->display_order,
            'enrollment_count' => $topic->enrollments_count,
            'published_at' => $topic->published_at?->toIso8601String(),
            'milestones' => $topic->milestones->map(fn ($m) => [
                'id' => $m->id,
                'position' => $m->position,
                'title' => $m->title,
                'description' => $m->description,
                'acceptance_criteria' => $m->acceptance_criteria ?? [],
                'estimated_hours' => $m->estimated_hours,
            ])->values(),
        ];
    }

    /** @return array<string, mixed> */
    private function submissionRow(ProjectSubmission $s): array
    {
        return [
            'id' => $s->id,
            'attempt' => $s->attempt,
            'status' => $s->status,
            'score' => $s->score,
            'student' => ['id' => $s->user->id, 'name' => $s->user->name, 'email' => $s->user->email],
            'topic' => ['id' => $s->enrollment->topic->id, 'title' => $s->enrollment->topic->title, 'slug' => $s->enrollment->topic->slug],
            'repo_url' => $s->repo_url,
            'live_url' => $s->live_url,
            'has_snapshot' => $s->hasSnapshot(),
            'snapshot_size_bytes' => $s->snapshot_size_bytes,
            'milestones_done' => $s->milestones_done,
            'milestones_total' => $s->milestones_total,
            'submitted_at' => $s->submitted_at?->toIso8601String(),
            'reviewed_at' => $s->reviewed_at?->toIso8601String(),
            // Authorship evidence: just the label in the queue; the full report is on the submission.
            'authorship' => $s->integrity['label'] ?? null,
        ];
    }
}
