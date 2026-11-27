<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CollegeAssessmentAssignment extends Model
{
    public const STATUS_ASSIGNED = 'assigned';

    public const STATUS_IN_PROGRESS = 'in_progress';

    public const STATUS_COMPLETED = 'completed';

    protected $fillable = [
        'college_assessment_id',
        'user_id',
        'status',
        'soft_skill_session_id',
        'soft_skill_score_percent',
        'contest_participant_id',
        'coding_points',
        'coding_max_points',
        'coding_score_percent',
        'interview_session_id',
        'interview_score_percent',
        'overall_score_percent',
        'started_at',
        'completed_at',
    ];

    protected function casts(): array
    {
        return [
            'soft_skill_score_percent' => 'float',
            'coding_points' => 'integer',
            'coding_max_points' => 'integer',
            'coding_score_percent' => 'float',
            'interview_score_percent' => 'float',
            'overall_score_percent' => 'float',
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    public function assessment(): BelongsTo
    {
        return $this->belongsTo(CollegeAssessment::class, 'college_assessment_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function softSkillSession(): BelongsTo
    {
        return $this->belongsTo(SoftSkillSession::class, 'soft_skill_session_id');
    }

    public function contestParticipant(): BelongsTo
    {
        return $this->belongsTo(ContestParticipant::class, 'contest_participant_id');
    }

    public function interviewSession(): BelongsTo
    {
        return $this->belongsTo(InterviewSession::class, 'interview_session_id');
    }
}
