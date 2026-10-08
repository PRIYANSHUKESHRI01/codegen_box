<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One answered question. Append-only, and unique per (attempt, question), so
 * it doubles as the guard that stops a question being answered twice. Feeds the
 * daily goal, streak, accuracy and each session's summary.
 */
class VocabularyAnswer extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = [
        'user_id',
        'vocabulary_attempt_id',
        'question_index',
        'vocabulary_word_id',
        'type',
        'response',
        'is_correct',
        'box_before',
        'box_after',
        'response_ms',
    ];

    protected function casts(): array
    {
        return [
            'question_index' => 'integer',
            'is_correct' => 'boolean',
            'box_before' => 'integer',
            'box_after' => 'integer',
            'response_ms' => 'integer',
            'created_at' => 'datetime',
        ];
    }

    public function attempt(): BelongsTo
    {
        return $this->belongsTo(VocabularyAttempt::class, 'vocabulary_attempt_id');
    }

    public function word(): BelongsTo
    {
        return $this->belongsTo(VocabularyWord::class, 'vocabulary_word_id');
    }
}
