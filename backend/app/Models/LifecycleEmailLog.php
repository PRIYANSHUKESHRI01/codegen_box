<?php

namespace App\Models;

use App\Enums\LifecycleEmail;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\UniqueConstraintViolationException;

/**
 * "This message was sent to this person" — see the create_lifecycle_emails_table
 * migration for what the table is for. Written only by App\Jobs\SendLifecycleEmail
 * (through claim()) and read by the nudge sweeps for pacing.
 */
class LifecycleEmailLog extends Model
{
    protected $table = 'lifecycle_emails';

    protected $fillable = ['user_id', 'type', 'dedupe_key', 'sent_at'];

    protected function casts(): array
    {
        return ['sent_at' => 'datetime'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Reserves the right to send this message. Returns the row when the caller
     * may send, or null when it has already been sent (or another process is
     * sending it right now) — the unique index decides, not a read-then-write.
     * If the send then fails, the caller deletes the row so a retry can go out.
     */
    public static function claim(int $userId, LifecycleEmail $type, string $dedupeKey = ''): ?self
    {
        try {
            return self::create([
                'user_id' => $userId,
                'type' => $type->value,
                'dedupe_key' => mb_substr($dedupeKey, 0, 80),
                'sent_at' => now(),
            ]);
        } catch (UniqueConstraintViolationException) {
            return null;
        }
    }
}
