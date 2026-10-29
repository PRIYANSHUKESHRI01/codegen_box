<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** "Tell me when this Vault AI Interview stack opens." One row per student per stack. */
class VaultStackInterest extends Model
{
    protected $fillable = ['user_id', 'stack_key', 'notified_at'];

    protected function casts(): array
    {
        return ['notified_at' => 'datetime'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
