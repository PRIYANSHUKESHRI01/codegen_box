<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One in-app notification for one person. Write through App\Services\NotificationService (which also applies
 * the person's mute settings and the idempotency key) — never create rows from a controller.
 */
class UserNotification extends Model
{
    public const UPDATED_AT = null;

    protected $table = 'user_notifications';

    protected $fillable = ['user_id', 'type', 'category', 'severity', 'title', 'body', 'url', 'data', 'actor_id', 'group_key', 'read_at', 'expires_at'];

    protected function casts(): array
    {
        return [
            'data' => 'array',
            'read_at' => 'datetime',
            'expires_at' => 'datetime',
            'created_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** What the frontend gets. No actor id, group key or recipient — nothing about anyone but the notification itself. */
    public function toApi(): array
    {
        return [
            'id' => $this->id,
            'type' => $this->type,
            'category' => $this->category,
            'severity' => $this->severity,
            'title' => $this->title,
            'body' => $this->body,
            'url' => $this->url,
            'data' => $this->data ?? (object) [],
            'read' => $this->read_at !== null,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
