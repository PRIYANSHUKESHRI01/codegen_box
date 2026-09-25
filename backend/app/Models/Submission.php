<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Submission extends Model
{
    public const STATUS_ACCEPTED = 'accepted';

    public const STATUS_WRONG_ANSWER = 'wrong_answer';

    public const STATUS_RUNTIME_ERROR = 'runtime_error';

    public const STATUS_COMPILE_ERROR = 'compile_error';

    protected $fillable = [
        'user_id',
        'problem_id',
        'language',
        'status',
        'submitted_on',
        'runtime_ms',
        'memory_kb',
    ];

    protected function casts(): array
    {
        return [
            'submitted_on' => 'date',
            'runtime_ms' => 'integer',
            'memory_kb' => 'integer',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function problem(): BelongsTo
    {
        return $this->belongsTo(Problem::class);
    }
}
