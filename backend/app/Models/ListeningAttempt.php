<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ListeningAttempt extends Model
{
    public const PASS_THRESHOLD = 60;

    protected $fillable = [
        'user_id',
        'listening_lesson_id',
        'attempt_number',
        'answers',
        'score',
        'passed',
    ];

    protected function casts(): array
    {
        return [
            'attempt_number' => 'integer',
            'answers' => 'array',
            'score' => 'integer',
            'passed' => 'boolean',
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
