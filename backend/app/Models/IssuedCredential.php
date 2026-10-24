<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * See the issued_credentials migration. Always go through App\Services\IssuedCredentialVault — never read `secret`
 * anywhere else, and never serialise this model (the secret is hidden as a second line of defence).
 */
class IssuedCredential extends Model
{
    protected $fillable = ['user_id', 'secret', 'source', 'issued_by', 'expires_at', 'last_revealed_at', 'reveal_count'];

    protected $hidden = ['secret'];

    protected function casts(): array
    {
        return [
            // Encrypted with APP_KEY on write, decrypted on read.
            'secret' => 'encrypted',
            'expires_at' => 'datetime',
            'last_revealed_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
