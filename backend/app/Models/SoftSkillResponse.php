<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SoftSkillResponse extends Model
{
    protected $fillable = [
        'soft_skill_session_id',
        'soft_skill_assessment_question_id',
        'selected_index',
        'is_correct',
        'answered_at',
    ];

    protected function casts(): array
    {
        return [
            'selected_index' => 'integer',
            'is_correct' => 'boolean',
            'answered_at' => 'datetime',
        ];
    }

    public function session(): BelongsTo
    {
        return $this->belongsTo(SoftSkillSession::class, 'soft_skill_session_id');
    }

    public function assessmentQuestion(): BelongsTo
    {
        return $this->belongsTo(SoftSkillAssessmentQuestion::class, 'soft_skill_assessment_question_id');
    }

    public function isAnswered(): bool
    {
        return $this->selected_index !== null;
    }
}
