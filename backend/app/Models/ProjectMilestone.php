<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One checkable step of a project's SOW, with the acceptance criteria that say
 * when it is genuinely done ("Admin can create a course", "Passwords are
 * hashed"). Reviewers grade against these, and a student's progress is a row
 * per milestone in ProjectMilestoneProgress.
 */
class ProjectMilestone extends Model
{
    protected $fillable = [
        'project_topic_id',
        'position',
        'title',
        'description',
        'acceptance_criteria',
        'estimated_hours',
    ];

    protected function casts(): array
    {
        return [
            'position' => 'integer',
            'acceptance_criteria' => 'array',
            'estimated_hours' => 'integer',
        ];
    }

    public function topic(): BelongsTo
    {
        return $this->belongsTo(ProjectTopic::class, 'project_topic_id');
    }
}
