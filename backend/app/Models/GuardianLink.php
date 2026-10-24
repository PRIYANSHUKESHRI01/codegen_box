<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A student's currently-paired Guardian. `token_hash` is the SHA-256 of a random bearer token the Guardian holds (the
 * plain token is shown once, at pairing); `state` is the last operating-system snapshot it reported.
 *
 * The link belongs to the USER, not to one exam: the Guardian is running and verified before an attempt starts, and
 * everything it reports while an attempt is open is written into that attempt's integrity log.
 */
class GuardianLink extends Model
{
    protected $fillable = ['user_id', 'guardian_install_id', 'token_hash', 'paired_at', 'last_beat_at', 'last_seq', 'state', 'expires_at', 'revoked_at'];

    protected $hidden = ['token_hash'];

    protected function casts(): array
    {
        return [
            'paired_at' => 'datetime',
            'last_beat_at' => 'datetime',
            'expires_at' => 'datetime',
            'revoked_at' => 'datetime',
            'last_seq' => 'integer',
            'state' => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function install(): BelongsTo
    {
        return $this->belongsTo(GuardianInstall::class, 'guardian_install_id');
    }

    public function isUsable(): bool
    {
        return $this->revoked_at === null && $this->expires_at->isFuture();
    }

    /** Spoke within the stale window — i.e. it is actually watching right now. */
    public function isFresh(): bool
    {
        return $this->isUsable()
            && $this->last_beat_at !== null
            && $this->last_beat_at->gt(now()->subSeconds((int) config('integrity.guardian.stale_after', 30)));
    }
}
