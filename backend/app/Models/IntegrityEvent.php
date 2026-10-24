<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One row of the append-only, hash-chained integrity log. The row is inserted once and never changed: `hash` covers
 * the previous row's hash and this row's content, so editing or removing a row breaks every hash after it.
 * (`php artisan integrity:verify {uuid}` re-walks the chain.)
 *
 * `payload` is TEXT holding the exact canonical JSON that was hashed — see the creating migration.
 */
class IntegrityEvent extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'integrity_session_id', 'seq', 'source', 'type', 'severity', 'strike', 'weight', 'occurred_at', 'client_at', 'payload',
        'prev_hash', 'hash',
    ];

    protected function casts(): array
    {
        return [
            'seq' => 'integer',
            'strike' => 'integer',
            'weight' => 'integer',
            'occurred_at' => 'datetime',
            'client_at' => 'datetime',
        ];
    }

    public function session(): BelongsTo
    {
        return $this->belongsTo(IntegritySession::class, 'integrity_session_id');
    }

    /** @return array<string, mixed> */
    public function data(): array
    {
        if ($this->payload === null || $this->payload === '') {
            return [];
        }

        $decoded = json_decode($this->payload, true);

        return is_array($decoded) ? $decoded : [];
    }
}
