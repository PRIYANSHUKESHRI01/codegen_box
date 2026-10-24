<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Str;

/**
 * One student's attempt at a Core test. `deadline_at` is the clock — enforced on the server for every
 * answer and submit (a short grace covers a slow connection), and a scheduled command grades abandoned
 * attempts, so a student who closes the tab cannot keep a test open forever or leave it ungraded.
 */
class CoreTestSession extends Model
{
    public const STATUS_IN_PROGRESS = 'in_progress';

    public const STATUS_COMPLETED = 'completed';

    /** Seconds past the deadline an answer is still accepted (clock skew, slow network). */
    public const GRACE_SECONDS = 30;

    protected $fillable = [
        'core_test_id', 'user_id', 'attempt_number', 'status', 'started_at', 'deadline_at', 'completed_at', 'score', 'max_score',
        'score_percent', 'passed', 'correct_count', 'wrong_count', 'skipped_count', 'subject_breakdown', 'terminated_by_proctoring',
    ];

    protected function casts(): array
    {
        return [
            'started_at' => 'datetime',
            'deadline_at' => 'datetime',
            'completed_at' => 'datetime',
            'score' => 'float',
            'max_score' => 'float',
            'score_percent' => 'float',
            'passed' => 'boolean',
            'subject_breakdown' => 'array',
            'terminated_by_proctoring' => 'boolean',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (CoreTestSession $session) {
            $session->public_id ??= (string) Str::ulid();
        });
    }

    public function getRouteKeyName(): string
    {
        return 'public_id';
    }

    public function test(): BelongsTo
    {
        return $this->belongsTo(CoreTest::class, 'core_test_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function responses(): HasMany
    {
        return $this->hasMany(CoreTestResponse::class)->orderBy('position');
    }

    public function proctoringSession(): HasOne
    {
        return $this->hasOne(CoreTestProctoringSession::class);
    }

    public function isCompleted(): bool
    {
        return $this->status === self::STATUS_COMPLETED;
    }

    public function isPastDeadline(bool $withGrace = false): bool
    {
        return $this->deadline_at->copy()->addSeconds($withGrace ? self::GRACE_SECONDS : 0)->isPast();
    }
}
