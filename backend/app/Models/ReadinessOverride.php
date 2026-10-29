<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A readiness score a superadmin set by hand for one student (see ReadinessOverrideService, and ReadinessScoreService::applyOverride()
 * for what it changes). One row per student; it is in force until it is removed or its expiry passes.
 */
class ReadinessOverride extends Model
{
    protected $fillable = ['user_id', 'score', 'reason', 'set_by_id', 'expires_at'];

    protected $casts = [
        'score' => 'integer',
        'expires_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function setBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'set_by_id');
    }

    /** @param  Builder<self>  $query */
    public function scopeInForce(Builder $query): void
    {
        $query->where(fn ($q) => $q->whereNull('expires_at')->orWhere('expires_at', '>', now()));
    }

    public function isInForce(): bool
    {
        return $this->expires_at === null || $this->expires_at->isFuture();
    }
}
