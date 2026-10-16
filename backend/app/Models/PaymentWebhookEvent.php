<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * An event Razorpay delivered to POST /api/webhooks/razorpay. Unique on the
 * gateway's own event id (`x-razorpay-event-id`), because Razorpay delivers
 * at-least-once: the second copy must find this row and do nothing.
 */
class PaymentWebhookEvent extends Model
{
    public const STATUS_RECEIVED = 'received';

    public const STATUS_PROCESSED = 'processed';

    /** Verified and well-formed, but not about one of our orders or not an event we act on. */
    public const STATUS_IGNORED = 'ignored';

    /** Handling threw. The endpoint answered 5xx, so the sender will retry — and the retry re-enters here. */
    public const STATUS_FAILED = 'failed';

    protected $fillable = [
        'gateway',
        'event_id',
        'event',
        'payment_order_id',
        'status',
        'error',
        'payload',
        'processed_at',
    ];

    protected function casts(): array
    {
        return [
            'payload' => 'array',
            'processed_at' => 'datetime',
        ];
    }

    public function paymentOrder(): BelongsTo
    {
        return $this->belongsTo(PaymentOrder::class);
    }
}
