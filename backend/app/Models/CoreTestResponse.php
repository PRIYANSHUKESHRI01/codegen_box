<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CoreTestResponse extends Model
{
    protected $fillable = [
        'core_test_session_id', 'core_question_id', 'position', 'option_order', 'selected', 'numeric_value', 'marked_for_review',
        'time_spent_seconds', 'answered_at', 'is_correct', 'marks_awarded',
    ];

    protected function casts(): array
    {
        return [
            'option_order' => 'array',
            'selected' => 'array',
            'numeric_value' => 'float',
            'marked_for_review' => 'boolean',
            'answered_at' => 'datetime',
            'is_correct' => 'boolean',
            'marks_awarded' => 'float',
        ];
    }

    public function session(): BelongsTo
    {
        return $this->belongsTo(CoreTestSession::class, 'core_test_session_id');
    }

    public function question(): BelongsTo
    {
        return $this->belongsTo(CoreQuestion::class, 'core_question_id');
    }

    /** Whether the student actually answered (an unanswered question is skipped, never marked wrong). */
    public function wasAnswered(): bool
    {
        return $this->selected !== null && $this->selected !== [] || $this->numeric_value !== null;
    }
}
