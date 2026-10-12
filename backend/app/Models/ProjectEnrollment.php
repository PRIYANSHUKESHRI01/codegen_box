<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * A student's attempt at one project. Exactly one per (student, topic):
 * restarting a project re-opens the same enrollment, workspace and history
 * rather than forking a second copy of someone's half-built app.
 *
 * `active` and `submitted` both count toward the plan's max_active_projects —
 * a project under review is still occupying the student's attention; only
 * `reviewed` (finished) and `abandoned` free the slot.
 */
class ProjectEnrollment extends Model
{
    public const STATUS_ACTIVE = 'active';

    public const STATUS_SUBMITTED = 'submitted';

    public const STATUS_REVIEWED = 'reviewed';

    public const STATUS_ABANDONED = 'abandoned';

    /** Statuses that occupy one of the student's active-project slots. */
    public const OCCUPYING = [self::STATUS_ACTIVE, self::STATUS_SUBMITTED];

    protected $fillable = [
        'user_id',
        'project_topic_id',
        'sow_version',
        'status',
        'started_at',
        'submitted_at',
    ];

    protected function casts(): array
    {
        return [
            'sow_version' => 'integer',
            'started_at' => 'datetime',
            'submitted_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function topic(): BelongsTo
    {
        return $this->belongsTo(ProjectTopic::class, 'project_topic_id');
    }

    public function progress(): HasMany
    {
        return $this->hasMany(ProjectMilestoneProgress::class);
    }

    public function workspace(): HasOne
    {
        return $this->hasOne(ProjectWorkspace::class);
    }

    public function submissions(): HasMany
    {
        return $this->hasMany(ProjectSubmission::class)->orderByDesc('attempt');
    }

    public function occupiesSlot(): bool
    {
        return in_array($this->status, self::OCCUPYING, true);
    }
}
