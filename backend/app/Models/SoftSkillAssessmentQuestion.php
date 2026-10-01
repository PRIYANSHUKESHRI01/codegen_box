<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Mirrors InterviewQuestion — the curator-picked, fixed pivot between one assessment and one bank question. */
class SoftSkillAssessmentQuestion extends Model
{
    protected $fillable = [
        'soft_skill_assessment_id',
        'soft_skill_question_id',
        'display_order',
    ];

    protected function casts(): array
    {
        return [
            'display_order' => 'integer',
        ];
    }

    public function assessment(): BelongsTo
    {
        return $this->belongsTo(SoftSkillAssessment::class, 'soft_skill_assessment_id');
    }

    public function question(): BelongsTo
    {
        return $this->belongsTo(SoftSkillQuestion::class, 'soft_skill_question_id');
    }
}
