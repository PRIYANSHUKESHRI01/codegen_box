<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

/**
 * One checkout of a self-serve plan purchase — see the create_payment_tables
 * migration for why it exists before the student pays and why it outlives them.
 *
 * Money is stored as integer paise (what Razorpay speaks); rupees only appear
 * in the presenters, because every price in this app is whole rupees.
 *
 * `gateway` says which payment gateway the order was opened on and every later
 * operation (re-check, refund, a late webhook) goes back to THAT gateway, not to
 * whichever one is active now. `gateway_order_id` is the gateway's handle for the
 * checkout — a Razorpay order id, a PayU `txnid` — and `gateway_payment_id` the
 * payment itself — a Razorpay `pay_…`, a PayU `mihpayid`.
 *
 * Never mass-assign `status`, `gateway_payment_id` or the refund columns from a
 * request: they change only inside CheckoutService, after a gateway-verified fact.
 */
class PaymentOrder extends Model
{
    public const GATEWAY_RAZORPAY = 'razorpay';

    public const GATEWAY_PAYU = 'payu';

    public const STATUS_CREATED = 'created';

    public const STATUS_PAID = 'paid';

    public const STATUS_EXPIRED = 'expired';

    public const STATUS_PARTIALLY_REFUNDED = 'partially_refunded';

    public const STATUS_REFUNDED = 'refunded';

    /** Money was taken but the plan could not be handed over (and the automatic refund did not go through). Someone must look. */
    public const STATUS_NEEDS_REVIEW = 'needs_review';

    protected $fillable = [
        'public_id',
        'user_id',
        'payer_name',
        'payer_email',
        'gateway',
        'gateway_mode',
        'gateway_order_id',
        'gateway_payment_id',
        'status',
        'currency',
        'amount_paise',
        'plan_code',
        'cart',
        'quote',
        'method',
        'attempts',
        'failure_code',
        'failure_reason',
        'paid_at',
        'fulfilled_at',
        'refund_id',
        'refunded_paise',
        'refunded_at',
        'refund_reason',
        'meta',
    ];

    protected function casts(): array
    {
        return [
            'amount_paise' => 'integer',
            'refunded_paise' => 'integer',
            'attempts' => 'integer',
            'cart' => 'array',
            'quote' => 'array',
            'meta' => 'array',
            'paid_at' => 'datetime',
            'fulfilled_at' => 'datetime',
            'refunded_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (PaymentOrder $order) {
            $order->public_id ??= (string) Str::ulid();
        });
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** Orders a payment may still arrive for: unpaid ones, including ones we gave up waiting on. */
    public function scopeAwaitingPayment(Builder $query): Builder
    {
        return $query->whereIn('status', [self::STATUS_CREATED, self::STATUS_EXPIRED]);
    }

    public function isPaid(): bool
    {
        return in_array($this->status, [self::STATUS_PAID, self::STATUS_PARTIALLY_REFUNDED, self::STATUS_REFUNDED], true);
    }

    public function isAwaitingPayment(): bool
    {
        return in_array($this->status, [self::STATUS_CREATED, self::STATUS_EXPIRED], true);
    }

    public function amountRupees(): int
    {
        return intdiv($this->amount_paise, 100);
    }

    /** Short label for the receipts list: what was bought, e.g. "Expert". */
    public function description(): string
    {
        $names = array_column($this->quote['lines'] ?? [], 'name');

        return $names === [] ? 'AptRun plan' : implode(' + ', $names);
    }

    /** How long what was bought lasts, in words: "1 year", "1 month", "one-time". */
    public function termLabel(): string
    {
        $days = collect($this->quote['lines'] ?? [])->pluck('duration_days')->filter()->max();

        return match (true) {
            $days === null => 'one-time',
            (int) $days === 365 => '1 year',
            (int) $days === 30 => '1 month',
            default => $days.' days',
        };
    }

    /**
     * What a student sees in their payment history — never the gateway order id,
     * signature or failure internals beyond a human reason.
     *
     * @return array<string, mixed>
     */
    public function toReceipt(): array
    {
        // An unpaid order that has had a failed attempt reads as "failed" to the student;
        // it is still payable, but "pending" would suggest they only need to wait.
        $display = match (true) {
            $this->status === self::STATUS_CREATED && $this->failure_code !== null => 'failed',
            $this->status === self::STATUS_EXPIRED => 'expired',
            $this->status === self::STATUS_NEEDS_REVIEW => 'processing',
            default => $this->status === self::STATUS_CREATED ? 'pending' : $this->status,
        };

        return [
            'id' => $this->public_id,
            'status' => $display,
            'description' => $this->description(),
            'plan_code' => $this->plan_code,
            'currency' => $this->currency,
            'amount' => $this->amountRupees(),
            'list_price' => $this->quote['subtotal'] ?? null,
            'discount' => $this->quote['discount'] ?? null,
            'method' => $this->method,
            'payment_id' => $this->gateway_payment_id,
            'failure_reason' => $display === 'failed' ? $this->failure_reason : null,
            'refunded_amount' => intdiv($this->refunded_paise, 100),
            'test_mode' => $this->gateway_mode !== 'live',
            'created_at' => $this->created_at,
            'paid_at' => $this->paid_at,
            'refunded_at' => $this->refunded_at,
        ];
    }
}
