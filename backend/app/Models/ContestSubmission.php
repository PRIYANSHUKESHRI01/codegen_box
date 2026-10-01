<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ContestSubmission extends Model
{
    public const STATUS_ACCEPTED = 'accepted';

    public const STATUS_WRONG_ANSWER = 'wrong_answer';

    public const STATUS_RUNTIME_ERROR = 'runtime_error';

    public const STATUS_COMPILE_ERROR = 'compile_error';

    protected $fillable = [
        'contest_id',
        'contest_problem_id',
        'user_id',
        'judge_token',
        'language',
        'code',
        'status',
        'submitted_at',
        'points_awarded',
    ];

    /** Same "excluded from JSON, not from the query" convention as Submission::$hidden — see that model's docblock. */
    protected $hidden = ['code'];

    protected function casts(): array
    {
        return [
            'submitted_at' => 'datetime',
            'points_awarded' => 'integer',
        ];
    }

    public function contest(): BelongsTo
    {
        return $this->belongsTo(Contest::class);
    }

    public function contestProblem(): BelongsTo
    {
        return $this->belongsTo(ContestProblem::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
