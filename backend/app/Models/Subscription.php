<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class Subscription extends Model
{
    public const STATUS_ACTIVE = 'active';

    public const STATUS_EXPIRED = 'expired';

    public const STATUS_CANCELED = 'canceled';

    protected $fillable = [
        'subscriber_type',
        'subscriber_id',
        'plan_id',
        'status',
        'started_at',
        'current_period_end',
        'is_trial',
        'auto_renew',
        'canceled_at',
        'meta',
    ];

    protected function casts(): array
    {
        return [
            'started_at' => 'datetime',
            'current_period_end' => 'datetime',
            'is_trial' => 'boolean',
            'auto_renew' => 'boolean',
            'canceled_at' => 'datetime',
            'meta' => 'array',
        ];
    }

    public function subscriber(): MorphTo
    {
        return $this->morphTo();
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(Plan::class);
    }

    /**
     * Whole days left until current_period_end, computed live from dates
     * rather than stored — so "subscribed today" reads 30, tomorrow 29, the
     * day after 28 with zero background job needed to keep it correct.
     * Null means the plan never expires (the free Coder tier).
     */
    public function daysRemaining(): ?int
    {
        if ($this->current_period_end === null) {
            return null;
        }

        // Computed from raw timestamps (not Carbon's diffInDays) to avoid any
        // ambiguity over that method's sign convention — this is always
        // "seconds from today to the end date, in whole days."
        $todayTs = now()->startOfDay()->getTimestamp();
        $endTs = $this->current_period_end->copy()->startOfDay()->getTimestamp();

        return max(0, (int) round(($endTs - $todayTs) / 86400));
    }

    public function isActive(): bool
    {
        if ($this->status !== self::STATUS_ACTIVE) {
            return false;
        }

        return $this->current_period_end === null || $this->current_period_end->isFuture();
    }
}
