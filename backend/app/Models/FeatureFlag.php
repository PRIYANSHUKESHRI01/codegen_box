<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A real, persisted platform config toggle. See the create_feature_flags_table
 * migration for what "real" does and doesn't mean here — persistence yes,
 * runtime gating not yet.
 */
class FeatureFlag extends Model
{
    protected $fillable = [
        'key',
        'name',
        'description',
        'category',
        'enabled',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'enabled' => 'boolean',
        ];
    }

    public function updatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }
}
