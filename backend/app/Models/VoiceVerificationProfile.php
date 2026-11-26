<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class VoiceVerificationProfile extends Model
{
    public const STATUS_NOT_STARTED = 'not_started';

    public const STATUS_IN_PROGRESS = 'in_progress';

    public const STATUS_VERIFIED = 'verified';

    public const STATUS_BLOCKED = 'blocked';

    protected $fillable = [
        'user_id',
        'status',
        'proctoring_status',
        'proctoring_consented_at',
        'proctoring_violation_count',
        'enrollment_lock_count',
        'max_enrollment_attempts',
        'proctoring_locked_at',
        'proctoring_device_info',
        'required_duration_seconds',
        'total_duration_seconds',
        'samples_count',
        'master_audio_path',
        'acoustic_signature',
        'voice_summary',
        'match_threshold',
        'last_match_score',
        'mismatch_strikes',
        'completed_at',
        'last_verified_at',
        'blocked_at',
        'blocked_reason',
        'blocked_interview_id',
        'unblocked_by',
        'unblocked_at',
    ];

    protected function casts(): array
    {
        return [
            'proctoring_consented_at' => 'datetime',
            'proctoring_violation_count' => 'integer',
            'enrollment_lock_count' => 'integer',
            'max_enrollment_attempts' => 'integer',
            'proctoring_locked_at' => 'datetime',
            'proctoring_device_info' => 'array',
            'required_duration_seconds' => 'integer',
            'total_duration_seconds' => 'integer',
            'samples_count' => 'integer',
            'acoustic_signature' => 'array',
            'match_threshold' => 'float',
            'last_match_score' => 'float',
            'mismatch_strikes' => 'integer',
            'completed_at' => 'datetime',
            'last_verified_at' => 'datetime',
            'blocked_at' => 'datetime',
            'unblocked_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function samples(): HasMany
    {
        return $this->hasMany(VoiceVerificationSample::class)->orderBy('prompt_index');
    }

    public function logs(): HasMany
    {
        return $this->hasMany(VoiceVerificationLog::class)->latest('checked_at');
    }

    public function proctoringViolations(): HasMany
    {
        return $this->hasMany(VoiceVerificationProctoringViolation::class)->latest('occurred_at');
    }

    public function isVerified(): bool
    {
        return $this->status === self::STATUS_VERIFIED;
    }

    public function isBlocked(): bool
    {
        return $this->status === self::STATUS_BLOCKED;
    }

    public function isProctoringLocked(): bool
    {
        return $this->proctoring_status === 'locked' || $this->isBlocked();
    }

    public function maxEnrollmentAttempts(): int
    {
        return max(1, (int) ($this->max_enrollment_attempts ?: config('voice_verification.max_enrollment_attempts', 3)));
    }

    public function remainingEnrollmentAttempts(): int
    {
        return max(0, $this->maxEnrollmentAttempts() - (int) $this->enrollment_lock_count);
    }

    public function hasExhaustedEnrollmentAttempts(): bool
    {
        return $this->remainingEnrollmentAttempts() <= 0;
    }
}
