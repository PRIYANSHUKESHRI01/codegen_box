<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SoftSkillSession extends Model
{
    public const STATUS_IN_PROGRESS = 'in_progress';

    public const STATUS_COMPLETED = 'completed';

    public const STATUSES = [self::STATUS_IN_PROGRESS, self::STATUS_COMPLETED];

    protected $fillable = [
        'soft_skill_assessment_id',
        'user_id',
        'status',
        'attempt_number',
        'started_at',
        'completed_at',
        'score_percent',
        'passed',
        'category_breakdown',
    ];

    protected function casts(): array
    {
        return [
            'attempt_number' => 'integer',
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
            'score_percent' => 'decimal:2',
            'passed' => 'boolean',
            'category_breakdown' => 'array',
        ];
    }

    public function assessment(): BelongsTo
    {
        return $this->belongsTo(SoftSkillAssessment::class, 'soft_skill_assessment_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function responses(): HasMany
    {
        return $this->hasMany(SoftSkillResponse::class);
    }

    public function isCompleted(): bool
    {
        return $this->status === self::STATUS_COMPLETED;
    }
}
