<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A student ticking off one milestone of their enrollment. Presence of the row = done. */
class ProjectMilestoneProgress extends Model
{
    protected $table = 'project_milestone_progress';

    protected $fillable = [
        'project_enrollment_id',
        'project_milestone_id',
        'completed_at',
    ];

    protected function casts(): array
    {
        return [
            'completed_at' => 'datetime',
        ];
    }

    public function enrollment(): BelongsTo
    {
        return $this->belongsTo(ProjectEnrollment::class, 'project_enrollment_id');
    }

    public function milestone(): BelongsTo
    {
        return $this->belongsTo(ProjectMilestone::class, 'project_milestone_id');
    }
}
