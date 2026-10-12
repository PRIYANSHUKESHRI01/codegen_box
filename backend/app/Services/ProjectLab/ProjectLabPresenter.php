<?php

namespace App\Services\ProjectLab;

use App\Models\ProjectEnrollment;
use App\Models\ProjectSubmission;
use App\Models\ProjectTopic;
use App\Models\User;
use App\Services\Workspaces\WorkspaceManager;

/**
 * Turns Project Lab models into the JSON the student UI consumes, in one place
 * so the catalog, the topic page and the workspace page cannot drift apart.
 *
 * The rule that matters here: what a non-entitled student gets is a PREVIEW
 * (what the project is, what stack, how many milestones, their titles) — enough
 * to want it, never the paid substance (the SOW body, milestone descriptions
 * and acceptance criteria, the workspace). That rule lives in `entitled` /
 * `canReadSow` below, and nowhere else.
 */
class ProjectLabPresenter
{
    public function __construct(private readonly WorkspaceManager $workspaces) {}

    /**
     * A catalog tile. Safe for any student.
     *
     * @return array<string, mixed>
     */
    public function card(ProjectTopic $topic, ?ProjectEnrollment $enrollment = null): array
    {
        $milestoneCount = $topic->milestones_count ?? $topic->milestones()->count();

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
            'icon' => $topic->icon,
            'is_free_sample' => $topic->is_free_sample,
            'milestone_count' => $milestoneCount,
            'enrollment' => $enrollment === null ? null : [
                'id' => $enrollment->id,
                'status' => $enrollment->status,
                'milestones_done' => $enrollment->progress_count ?? $enrollment->progress()->count(),
                'milestones_total' => $milestoneCount,
            ],
        ];
    }

    /**
     * The topic page: the card plus the SOW and milestones — the paid parts
     * only when the student may have them.
     *
     * @return array<string, mixed>
     */
    public function topic(ProjectTopic $topic, User $user, ?ProjectEnrollment $enrollment): array
    {
        $entitled = $user->hasProjectLabAccess();
        $canReadSow = $entitled || $topic->is_free_sample;

        return $this->card($topic->loadCount('milestones'), $enrollment) + [
            'sow_version' => $topic->sow_version,
            'has_sow' => $topic->hasSow(),
            'sow_locked' => ! $canReadSow,
            'sow_markdown' => $canReadSow ? $topic->sow_markdown : null,
            'can_download_sow' => $canReadSow && $topic->hasSow(),
            'milestones' => $topic->milestones->map(fn ($m) => [
                'id' => $m->id,
                'position' => $m->position,
                'title' => $m->title,
                'estimated_hours' => $m->estimated_hours,
                'description' => $entitled ? $m->description : null,
                'acceptance_criteria' => $entitled ? ($m->acceptance_criteria ?? []) : [],
            ])->values()->all(),
        ];
    }

    /**
     * One enrollment with everything the workspace page needs.
     *
     * @return array<string, mixed>
     */
    public function enrollment(ProjectEnrollment $enrollment, User $user): array
    {
        $enrollment->loadMissing(['topic.milestones', 'progress', 'workspace', 'submissions']);

        $entitled = $user->hasProjectLabAccess();
        $doneAt = $enrollment->progress->keyBy('project_milestone_id');
        $topic = $enrollment->topic;

        return [
            'id' => $enrollment->id,
            'status' => $enrollment->status,
            'started_at' => $enrollment->started_at?->toIso8601String(),
            'submitted_at' => $enrollment->submitted_at?->toIso8601String(),
            'sow_version' => $enrollment->sow_version,
            'sow_outdated' => $topic->sow_version > $enrollment->sow_version,
            'entitled' => $entitled,
            'topic' => [
                'id' => $topic->id,
                'slug' => $topic->slug,
                'title' => $topic->title,
                'category' => $topic->category,
                'difficulty' => $topic->difficulty,
                'estimated_hours' => $topic->estimated_hours,
                'tech_stack' => $topic->tech_stack ?? [],
                'sow_version' => $topic->sow_version,
                'sow_markdown' => $entitled ? $topic->sow_markdown : null,
            ],
            'milestones' => $topic->milestones->map(fn ($m) => [
                'id' => $m->id,
                'position' => $m->position,
                'title' => $m->title,
                'estimated_hours' => $m->estimated_hours,
                'description' => $entitled ? $m->description : null,
                'acceptance_criteria' => $entitled ? ($m->acceptance_criteria ?? []) : [],
                'done' => $doneAt->has($m->id),
                'completed_at' => $doneAt->get($m->id)?->completed_at?->toIso8601String(),
            ])->values()->all(),
            'progress' => ['done' => $doneAt->count(), 'total' => $topic->milestones->count()],
            'workspace' => $entitled && $enrollment->workspace !== null ? $this->workspaces->present($enrollment->workspace) : null,
            'submissions' => $enrollment->submissions->map(fn (ProjectSubmission $s) => $this->submission($s))->values()->all(),
        ];
    }

    /** @return array<string, mixed> a submission as its own student sees it (never the storage path) */
    public function submission(ProjectSubmission $submission): array
    {
        return [
            'id' => $submission->id,
            'attempt' => $submission->attempt,
            'status' => $submission->status,
            'score' => $submission->score,
            'rubric' => $submission->rubric ?? [],
            'feedback' => $submission->feedback,
            'repo_url' => $submission->repo_url,
            'live_url' => $submission->live_url,
            'notes' => $submission->notes,
            'milestones_done' => $submission->milestones_done,
            'milestones_total' => $submission->milestones_total,
            'has_snapshot' => $submission->hasSnapshot(),
            'snapshot_size_bytes' => $submission->snapshot_size_bytes,
            'warnings' => $submission->warnings ?? [],
            'submitted_at' => $submission->submitted_at?->toIso8601String(),
            'reviewed_at' => $submission->reviewed_at?->toIso8601String(),
        ];
    }
}
