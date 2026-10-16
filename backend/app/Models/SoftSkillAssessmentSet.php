<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * "This test was built from that question set" — see the add_question_sets_to_soft_skills
 * migration. Written only by SoftSkillQuestionSetService::attach(); read to show a
 * scheduler which sets they have already used.
 */
class SoftSkillAssessmentSet extends Model
{
    protected $fillable = [
        'soft_skill_assessment_id',
        'question_set_id',
        'set_title',
        'set_number',
        'questions_added',
        'added_by',
    ];

    protected function casts(): array
    {
        return [
            'set_number' => 'integer',
            'questions_added' => 'integer',
        ];
    }

    /** The test that was built. */
    public function assessment(): BelongsTo
    {
        return $this->belongsTo(SoftSkillAssessment::class, 'soft_skill_assessment_id');
    }

    /** The library set it was built from (null once that set has been deleted — the snapshot columns still say what it was). */
    public function questionSet(): BelongsTo
    {
        return $this->belongsTo(SoftSkillAssessment::class, 'question_set_id');
    }

    public function addedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'added_by');
    }

    /** "Set 12" — or the snapshot title for a set that never had a number. */
    public function label(): string
    {
        return $this->set_number !== null ? "Set {$this->set_number}" : $this->set_title;
    }
}
