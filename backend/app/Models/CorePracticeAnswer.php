<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One answer a student gave in Core Prep practice. Every attempt is kept, so mastery is measured, not guessed. */
class CorePracticeAnswer extends Model
{
    protected $fillable = ['user_id', 'core_question_id', 'subject_id', 'topic_id', 'selected', 'numeric_value', 'is_correct', 'time_taken_seconds', 'study_sitting_id'];

    protected function casts(): array
    {
        return ['selected' => 'array', 'numeric_value' => 'float', 'is_correct' => 'boolean'];
    }

    public function question(): BelongsTo
    {
        return $this->belongsTo(CoreQuestion::class, 'core_question_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
