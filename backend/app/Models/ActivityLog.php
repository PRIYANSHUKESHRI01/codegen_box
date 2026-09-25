<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A real, append-only trail of the platform's sensitive admin actions
 * (college onboarding, account creation, block/unblock) — replaces what was
 * previously a fully fabricated "Live Audit Stream" on the superadmin
 * dashboard. Write via the static record() helper rather than ->create()
 * directly, so every call site captures the same actor snapshot shape.
 */
class ActivityLog extends Model
{
    protected $fillable = [
        'actor_id',
        'actor_name',
        'actor_role',
        'action',
        'target_type',
        'target_label',
        'meta',
    ];

    protected function casts(): array
    {
        return [
            'meta' => 'array',
        ];
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }

    public static function record(User $actor, string $action, ?string $targetType = null, ?string $targetLabel = null, array $meta = []): self
    {
        return self::create([
            'actor_id' => $actor->id,
            'actor_name' => $actor->name,
            'actor_role' => $actor->role,
            'action' => $action,
            'target_type' => $targetType,
            'target_label' => $targetLabel,
            'meta' => $meta ?: null,
        ]);
    }
}
