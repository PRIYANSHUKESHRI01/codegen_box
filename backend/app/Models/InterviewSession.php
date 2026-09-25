<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * Mirrors ContestParticipant — one row per candidate per interview. See the
 * creating migration's docblock for the invited_at/invited_by convention
 * per interview_type.
 */
class InterviewSession extends Model
{
    public const STATUS_INVITED = 'invited';

    public const STATUS_IN_PROGRESS = 'in_progress';

    public const STATUS_COMPLETED = 'completed';

    public const STATUSES = [self::STATUS_INVITED, self::STATUS_IN_PROGRESS, self::STATUS_COMPLETED];

    protected $fillable = [
        'interview_id',
        'user_id',
        'status',
        'invited_at',
        'invited_by',
        'started_at',
        'completed_at',
        'current_question_order',
        'composite_score_percent',
        'reviewed_at',
        'reviewed_by',
        'advanced',
        'ai_scored_at',
        'scoring_failed_at',
    ];

    protected function casts(): array
    {
        return [
            'invited_at' => 'datetime',
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
            'current_question_order' => 'integer',
            'composite_score_percent' => 'decimal:2',
            'reviewed_at' => 'datetime',
            'advanced' => 'boolean',
            'ai_scored_at' => 'datetime',
            'scoring_failed_at' => 'datetime',
        ];
    }

    public function interview(): BelongsTo
    {
        return $this->belongsTo(Interview::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function invitedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'invited_by');
    }

    /** Set only once InterviewTrackAdvancementService::finalizeAndAdvance() has run for this (track-round-only) session. */
    public function reviewedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function isReviewed(): bool
    {
        return $this->reviewed_at !== null;
    }

    /** True once EITHER Gemini or a human has produced a real score for this session — the "is there a result to show the candidate" check, as opposed to isReviewed() which is specifically about a human's own pass. */
    public function hasScoreAvailable(): bool
    {
        return $this->ai_scored_at !== null || $this->reviewed_at !== null;
    }

    public function scoringFailed(): bool
    {
        return $this->scoring_failed_at !== null;
    }

    public function responses(): HasMany
    {
        return $this->hasMany(InterviewResponse::class);
    }

    /** Null until the candidate actually starts the interview — see InterviewProctoringController::start(). */
    public function proctoringSession(): HasOne
    {
        return $this->hasOne(InterviewProctoringSession::class);
    }

    public function isCompleted(): bool
    {
        return $this->status === self::STATUS_COMPLETED;
    }
}
