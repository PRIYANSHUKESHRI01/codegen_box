<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One finished sitting of a study set, kept permanently (see the creating migration). Written only by App\Services\Study\StudyAttemptRecorder.
 */
class StudyAttempt extends Model
{
    protected $fillable = [
        'user_id', 'interview_id', 'stack_key', 'exam_name', 'round_id', 'set_number', 'set_title', 'score', 'question_count', 'answered_count',
        'green_count', 'yellow_count', 'red_count', 'duration_seconds', 'completed_at', 'results',
    ];

    protected function casts(): array
    {
        return [
            'set_number' => 'integer',
            'score' => 'integer',
            'question_count' => 'integer',
            'answered_count' => 'integer',
            'green_count' => 'integer',
            'yellow_count' => 'integer',
            'red_count' => 'integer',
            'duration_seconds' => 'integer',
            'completed_at' => 'datetime',
            'results' => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** Fewer questions answered than the set has: the student left early. Its score is the average of what they did answer. */
    public function isPartial(): bool
    {
        return $this->answered_count < $this->question_count;
    }
}
