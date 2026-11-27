<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LaunchpadProgramEnrollment extends Model
{
    public const STATUS_ENROLLED = 'enrolled';

    public const STATUS_IN_PROGRESS = 'in_progress';

    public const STATUS_COMPLETED = 'completed';

    protected $fillable = [
        'launchpad_program_id',
        'user_id',
        'college_id',
        'rotation_offset',
        'assessment_1_set',
        'assessment_2_set',
        'assessment_3_set',
        'assessment_1_id',
        'assessment_2_id',
        'assessment_3_id',
        'status',
        'starts_at',
        'ends_at',
        'last_reminded_at',
    ];

    protected function casts(): array
    {
        return [
            'rotation_offset' => 'integer',
            'assessment_1_set' => 'integer',
            'assessment_2_set' => 'integer',
            'assessment_3_set' => 'integer',
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
            'last_reminded_at' => 'datetime',
        ];
    }

    public function program(): BelongsTo
    {
        return $this->belongsTo(LaunchpadProgram::class, 'launchpad_program_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function college(): BelongsTo
    {
        return $this->belongsTo(College::class);
    }

    public function assessment1(): BelongsTo
    {
        return $this->belongsTo(CollegeAssessment::class, 'assessment_1_id');
    }

    public function assessment2(): BelongsTo
    {
        return $this->belongsTo(CollegeAssessment::class, 'assessment_2_id');
    }

    public function assessment3(): BelongsTo
    {
        return $this->belongsTo(CollegeAssessment::class, 'assessment_3_id');
    }
}
