<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A student handing in a project: a snapshot of the workspace's code (private
 * disk, never publicly served), optional repo/live links, and a note. A
 * student can submit again after `needs_changes`; `attempt` numbers them.
 * Reviewed by Mellow staff against the topic's milestone acceptance criteria.
 */
class ProjectSubmission extends Model
{
    public const STATUS_PENDING = 'pending_review';

    public const STATUS_IN_REVIEW = 'in_review';

    public const STATUS_REVIEWED = 'reviewed';

    public const STATUS_NEEDS_CHANGES = 'needs_changes';

    public const STATUSES = [self::STATUS_PENDING, self::STATUS_IN_REVIEW, self::STATUS_REVIEWED, self::STATUS_NEEDS_CHANGES];

    protected $fillable = [
        'project_enrollment_id',
        'user_id',
        'attempt',
        'snapshot_path',
        'snapshot_size_bytes',
        'snapshot_sha256',
        'repo_url',
        'live_url',
        'notes',
        'milestones_done',
        'milestones_total',
        'warnings',
        'integrity',
        'status',
        'score',
        'rubric',
        'feedback',
        'reviewed_by',
        'reviewed_at',
        'submitted_at',
    ];

    /** The storage path of a student's code is an internal detail; staff download through an authorised route. */
    protected $hidden = ['snapshot_path'];

    protected function casts(): array
    {
        return [
            'attempt' => 'integer',
            'snapshot_size_bytes' => 'integer',
            'milestones_done' => 'integer',
            'milestones_total' => 'integer',
            'warnings' => 'array',
            'integrity' => 'array',
            'score' => 'integer',
            'rubric' => 'array',
            'reviewed_at' => 'datetime',
            'submitted_at' => 'datetime',
        ];
    }

    public function enrollment(): BelongsTo
    {
        return $this->belongsTo(ProjectEnrollment::class, 'project_enrollment_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function hasSnapshot(): bool
    {
        return $this->snapshot_path !== null;
    }
}
