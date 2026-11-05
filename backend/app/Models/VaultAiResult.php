<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A student's Vault AI Interview result for one stack: the final average of every completed series (three sets each), the best of
 * them, and the stored PDF report. See the vault_ai_results migration and App\Services\Vault\VaultAiResultService.
 */
class VaultAiResult extends Model
{
    protected $fillable = [
        'user_id', 'college_id', 'stack_key', 'role_key', 'stack_name',
        'best_average', 'best_scores', 'best_series', 'best_at',
        'last_average', 'last_scores', 'last_at',
        'attempts', 'status', 'ever_qualified', 'first_completed_at', 'history',
        'report_id', 'report_generated_at',
    ];

    protected function casts(): array
    {
        return [
            'best_average' => 'float',
            'best_scores' => 'array',
            'best_series' => 'integer',
            'best_at' => 'datetime',
            'last_average' => 'float',
            'last_scores' => 'array',
            'last_at' => 'datetime',
            'attempts' => 'integer',
            'ever_qualified' => 'boolean',
            'first_completed_at' => 'datetime',
            'history' => 'array',
            'report_generated_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
