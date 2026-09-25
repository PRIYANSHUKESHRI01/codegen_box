<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One row per active forgot-password attempt. requestOtp() always deletes
 * any prior unconsumed row for a user before creating a new one (see
 * PasswordResetService), so there is provably never more than one active
 * row per user — a single expires_at column governs both the OTP code's
 * validity and, once verifyOtp() sets reset_token_hash, the reset token's
 * validity too.
 */
class PasswordResetOtp extends Model
{
    protected $fillable = [
        'user_id',
        'code_hash',
        'reset_token_hash',
        'attempts',
        'expires_at',
        'consumed_at',
    ];

    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime',
            'consumed_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isExpired(): bool
    {
        return $this->expires_at->isPast();
    }

    public function isConsumed(): bool
    {
        return $this->consumed_at !== null;
    }
}
