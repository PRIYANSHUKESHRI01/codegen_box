<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** Mirrors SoftSkillProctoringSession / InterviewProctoringSession. */
class CoreTestProctoringSession extends Model
{
    public const STATUS_ACTIVE = 'active';

    public const STATUS_LOCKED = 'locked';

    public const STATUS_COMPLETED = 'completed';

    protected $fillable = ['core_test_session_id', 'status', 'consented_at', 'violation_count', 'locked_at', 'completed_at', 'device_info'];

    protected function casts(): array
    {
        return [
            'consented_at' => 'datetime',
            'violation_count' => 'integer',
            'locked_at' => 'datetime',
            'completed_at' => 'datetime',
            'device_info' => 'array',
        ];
    }

    public function testSession(): BelongsTo
    {
        return $this->belongsTo(CoreTestSession::class, 'core_test_session_id');
    }

    public function violations(): HasMany
    {
        return $this->hasMany(CoreTestProctoringViolation::class);
    }

    public function isLocked(): bool
    {
        return $this->status === self::STATUS_LOCKED;
    }
}
