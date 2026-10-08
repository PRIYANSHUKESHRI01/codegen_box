<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** Mirrors InterviewProctoringSession / ProctoringSession — see the creating migration's docblock. */
class SoftSkillProctoringSession extends Model
{
    public const STATUS_ACTIVE = 'active';

    public const STATUS_LOCKED = 'locked';

    public const STATUS_COMPLETED = 'completed';

    public const STATUSES = [self::STATUS_ACTIVE, self::STATUS_LOCKED, self::STATUS_COMPLETED];

    protected $fillable = [
        'soft_skill_session_id',
        'status',
        'consented_at',
        'violation_count',
        'locked_at',
        'completed_at',
        'device_info',
    ];

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

    public function softSkillSession(): BelongsTo
    {
        return $this->belongsTo(SoftSkillSession::class);
    }

    public function violations(): HasMany
    {
        return $this->hasMany(SoftSkillProctoringViolation::class);
    }

    public function isLocked(): bool
    {
        return $this->status === self::STATUS_LOCKED;
    }
}
