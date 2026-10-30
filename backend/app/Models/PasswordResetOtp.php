<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A user's forgot-password code and, once the code has been entered correctly, the reset token it earned. Both live
 * on the one row and share its `expires_at` (a week after the code was first issued). The row stays usable until the
 * user actually sets a new password — asking for another code re-sends the same one rather than replacing it, so any
 * code or token the person already holds keeps working — and is then marked consumed, which ends it at once.
 * See PasswordResetService.
 */
class PasswordResetOtp extends Model
{
    protected $fillable = [
        'user_id',
        'code_hash',
        'code_encrypted',
        'reset_token_hash',
        'attempts',
        'expires_at',
        'consumed_at',
    ];

    protected function casts(): array
    {
        return [
            'code_encrypted' => 'encrypted',
            'expires_at' => 'datetime',
            'consumed_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** Not yet used up and not yet past its expiry. */
    public function scopeActive(Builder $query): Builder
    {
        return $query->whereNull('consumed_at')->where('expires_at', '>', now());
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
