<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One student's readiness on one day — see the creating migration. Written only by
 * App\Services\ReadinessHistoryService, in bulk, so nothing here is saved through Eloquent on a hot path.
 */
class ReadinessSnapshot extends Model
{
    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'snapshot_date' => 'date:Y-m-d',
            'components' => 'array',
            'active_today' => 'boolean',
            'score' => 'integer',
            'base_score' => 'integer',
            'penalty' => 'integer',
            'missed_days' => 'integer',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
