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

    /** A student paid for it through Razorpay checkout. */
    public const SOURCE_PURCHASE = 'purchase';

    /** A superadmin gave it by hand — free of charge, or against a payment taken outside the gateway (bank transfer, cash). */
    public const SOURCE_ADMIN_GRANT = 'admin_grant';

    /** Assigned by Mellow staff to a college or company through a sales conversation, or started as a demo. */
    public const SOURCE_ADMIN_ASSIGNED = 'admin_assigned';

    /** The free plan every student starts on, or a row from before sources were recorded. */
    public const SOURCE_SYSTEM = 'system';

    /**
     * How this subscription came to exist, for the superadmin's list and a
     * student's plan history. Rows written before sources were recorded carry
     * no `source`, so it is worked out from what they do carry: a payment
     * reference means checkout, a college/company subscriber means Ops
     * assigned it, anything else is the default free plan.
     */
    public function source(): string
    {
        $recorded = $this->meta['source'] ?? null;

        if (is_string($recorded) && $recorded !== '') {
            return $recorded;
        }

        if (! empty($this->meta['purchase_ref'])) {
            return self::SOURCE_PURCHASE;
        }

        return $this->subscriber_type === User::class ? self::SOURCE_SYSTEM : self::SOURCE_ADMIN_ASSIGNED;
    }

    /** What the subscriber was actually charged for this row, in whole rupees — 0 for anything given free. Null when nothing was recorded (a college's price lives on its plan). */
    public function pricePaid(): ?int
    {
        $paid = $this->meta['price_paid'] ?? null;

        return $paid === null ? null : (int) $paid;
    }

    /**
     * Where this row stands right now, in the words the superadmin's list uses:
     * `canceled`, `expired` (swept or simply past its end date), or `active`.
     * `isActive()` alone can't say it — a canceled row is also "not active".
     */
    public function state(): string
    {
        if ($this->status === self::STATUS_CANCELED) {
            return self::STATUS_CANCELED;
        }

        return $this->isActive() ? self::STATUS_ACTIVE : self::STATUS_EXPIRED;
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
