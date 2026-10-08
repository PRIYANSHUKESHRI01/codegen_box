<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ListeningAttempt extends Model
{
    public const PASS_THRESHOLD = 60;

    /** Replay freely, change speed — for learning. */
    public const MODE_PRACTICE = 'practice';

    /** Limited plays, fixed speed — rehearsal for a real assessment. */
    public const MODE_EXAM = 'exam';

    public const MODES = [self::MODE_PRACTICE, self::MODE_EXAM];

    protected $fillable = [
        'user_id',
        'listening_lesson_id',
        'attempt_number',
        'mode',
        'plays_used',
        'answers',
        'score',
        'passed',
        'skill_breakdown',
    ];

    protected function casts(): array
    {
        return [
            'attempt_number' => 'integer',
            'plays_used' => 'integer',
            'answers' => 'array',
            'score' => 'integer',
            'passed' => 'boolean',
            'skill_breakdown' => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function listeningLesson(): BelongsTo
    {
        return $this->belongsTo(ListeningLesson::class);
    }
}
