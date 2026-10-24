<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** One proctored stretch of Core Prep practice or Skill Drills — see the creating migration and StudySittingService. */
class StudySitting extends Model
{
    public const KIND_CORE_PRACTICE = 'core_practice';

    public const KIND_DRILL = 'drill';

    public const KINDS = [self::KIND_CORE_PRACTICE, self::KIND_DRILL];

    public const STATUS_ACTIVE = 'active';

    public const STATUS_LOCKED = 'locked';

    public const STATUS_COMPLETED = 'completed';

    protected $fillable = ['user_id', 'kind', 'subject', 'status', 'consented_at', 'violation_count', 'locked_at', 'completed_at', 'device_info'];

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

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function violations(): HasMany
    {
        return $this->hasMany(StudySittingViolation::class);
    }

    public function isLocked(): bool
    {
        return $this->status === self::STATUS_LOCKED;
    }

    public function isCompleted(): bool
    {
        return $this->status === self::STATUS_COMPLETED;
    }

    public function isConsented(): bool
    {
        return $this->consented_at !== null;
    }
}
