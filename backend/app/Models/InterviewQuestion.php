<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Pivot-with-fields, mirrors ContestProblem — attaches one
 * InterviewQuestionBank item into one specific Interview instance. No
 * `points`/scoring column: nothing here is auto-scored.
 */
class InterviewQuestion extends Model
{
    protected $fillable = [
        'interview_id',
        'interview_question_bank_id',
        'display_order',
    ];

    protected function casts(): array
    {
        return [
            'display_order' => 'integer',
        ];
    }

    public function interview(): BelongsTo
    {
        return $this->belongsTo(Interview::class);
    }

    public function questionBank(): BelongsTo
    {
        return $this->belongsTo(InterviewQuestionBank::class, 'interview_question_bank_id');
    }

    public function responses(): HasMany
    {
        return $this->hasMany(InterviewResponse::class);
    }
}
