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
        'code',
        'status',
        'submitted_on',
        'runtime_ms',
        'memory_kb',
    ];

    /**
     * Excluded from JSON by default. `code` can be up to 64KB per row (see
     * config('judge.limits.max_code_length')), and every list endpoint that
     * touches this model — recentSubmissions(), a student's full activity
     * report — returns many rows at once purely for their verdict metadata;
     * without this, each of those responses would silently balloon by
     * megabytes and hand back full source nobody asked to see on a list
     * screen. `$hidden` doesn't stop Eloquent selecting the column (a plain
     * `->get()` still reads it into memory), only serialization — so the
     * one real "view this submission's code" endpoint calls
     * `makeVisible('code')` on that single model before returning it,
     * rather than this column needing a query-level opt-in everywhere else.
     */
    protected $hidden = ['code'];

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
