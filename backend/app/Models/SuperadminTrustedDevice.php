<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A trusted laptop / device fingerprint and IP (or CIDR) allowlist entry for a superadmin account.
 * Used when `users.enforce_trusted_login` is enabled to restrict logins to approved hardware & IPs.
 */
class SuperadminTrustedDevice extends Model
{
    protected $fillable = [
        'user_id',
        'label',
        'device_fingerprint',
        'device_id',
        'ip_address',
        'browser',
        'os',
        'gpu_renderer',
        'is_active',
        'added_by',
        'last_matched_at',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'last_matched_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function addedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'added_by');
    }
}
