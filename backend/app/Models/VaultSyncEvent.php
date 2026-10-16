<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

/**
 * One thing Mellow Vault has to be told — see the creating migration. Written by
 * VaultSyncService (the only writer) in the same step as the change that caused
 * it, delivered by `vault:sync`.
 */
class VaultSyncEvent extends Model
{
    public const TYPE_UPSERT = 'profile.upsert';

    public const TYPE_WITHDRAW = 'profile.withdraw';

    public const STATUS_PENDING = 'pending';

    public const STATUS_PROCESSING = 'processing';

    public const STATUS_DELIVERED = 'delivered';

    public const STATUS_FAILED = 'failed';

    /** Gave up after the maximum number of attempts — an admin has to look at it (and can retry it). */
    public const STATUS_DEAD = 'dead';

    protected $fillable = [
        'uuid',
        'vault_profile_id',
        'profile_public_id',
        'type',
        'reason',
        'sequence',
        'payload',
        'status',
        'attempts',
        'available_at',
        'processing_at',
        'delivered_at',
        'last_status_code',
        'last_error',
    ];

    protected function casts(): array
    {
        return [
            'payload' => 'array',
            'sequence' => 'integer',
            'attempts' => 'integer',
            'available_at' => 'datetime',
            'processing_at' => 'datetime',
            'delivered_at' => 'datetime',
            'last_status_code' => 'integer',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (VaultSyncEvent $event) {
            $event->uuid ??= (string) Str::uuid();
        });
    }
}
