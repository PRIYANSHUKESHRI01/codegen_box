<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class VaultScoreTransfer extends Model
{
    public const EVENT_SET_CLEARED = 'set_cleared';
    public const EVENT_SERIES_QUALIFIED = 'series_qualified';

    public const STATUS_CLEARED = 'cleared';
    public const STATUS_QUALIFIED = 'qualified';

    public const DELIVERY_DELIVERED = 'delivered';
    public const DELIVERY_FAILED = 'failed';
    public const DELIVERY_PENDING = 'pending';
    public const DELIVERY_SKIPPED = 'skipped';

    protected $fillable = [
        'uuid',
        'user_id',
        'interview_id',
        'qualification_id',
        'stack_key',
        'role_key',
        'event_type',
        'score',
        'status',
        'message',
        'payload',
        'destination_type',
        'destination_url',
        'delivery_status',
        'http_status',
        'response_body',
        'error_message',
        'attempts',
        'transferred_at',
    ];

    protected $casts = [
        'score' => 'float',
        'payload' => 'array',
        'attempts' => 'integer',
        'http_status' => 'integer',
        'transferred_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function interview(): BelongsTo
    {
        return $this->belongsTo(Interview::class);
    }

    public function qualification(): BelongsTo
    {
        return $this->belongsTo(VaultInterviewQualification::class, 'qualification_id');
    }
}
