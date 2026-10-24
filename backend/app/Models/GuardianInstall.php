<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One installation of the AptRun Guardian desktop agent. `public_key` (Ed25519) is how every report it sends is verified. */
class GuardianInstall extends Model
{
    protected $fillable = ['user_id', 'install_id', 'public_key', 'platform', 'version', 'exe_sha256', 'machine', 'first_seen_at', 'last_seen_at', 'revoked_at'];

    protected function casts(): array
    {
        return [
            'machine' => 'array',
            'first_seen_at' => 'datetime',
            'last_seen_at' => 'datetime',
            'revoked_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isRevoked(): bool
    {
        return $this->revoked_at !== null;
    }
}
