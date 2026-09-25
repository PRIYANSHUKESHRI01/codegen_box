<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ProctoringSession extends Model
{
    public const STATUS_ACTIVE = 'active';

    public const STATUS_LOCKED = 'locked';

    public const STATUS_COMPLETED = 'completed';

    public const STATUSES = [self::STATUS_ACTIVE, self::STATUS_LOCKED, self::STATUS_COMPLETED];

    protected $fillable = [
        'contest_participant_id',
        'status',
        'consented_at',
        'violation_count',
        'locked_at',
        'completed_at',
        'reported_at',
        'device_info',
    ];

    protected function casts(): array
    {
        return [
            'consented_at' => 'datetime',
            'violation_count' => 'integer',
            'locked_at' => 'datetime',
            'completed_at' => 'datetime',
            'reported_at' => 'datetime',
            'device_info' => 'array',
        ];
    }

    public function contestParticipant(): BelongsTo
    {
        return $this->belongsTo(ContestParticipant::class);
    }

    public function violations(): HasMany
    {
        return $this->hasMany(ProctoringViolation::class);
    }

    public function isLocked(): bool
    {
        return $this->status === self::STATUS_LOCKED;
    }
}
