<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One proctoring event on a Soft Skills attempt. The violation vocabulary
 * (which types exist, which of them are strikes, how they read to a human) is
 * deliberately NOT redeclared here — it is borrowed from ProctoringViolation
 * (contest proctoring), so a test and a contest can never disagree about what
 * counts as a strike. The frontend mirror lives in lib/proctoring/types.ts.
 */
class SoftSkillProctoringViolation extends Model
{
    public const STRIKE_TYPES = ProctoringViolation::STRIKE_TYPES;

    public const TYPES = ProctoringViolation::TYPES;

    protected $fillable = [
        'soft_skill_proctoring_session_id',
        'type',
        'counted_toward_lock',
        'ip_address',
        'meta',
        'occurred_at',
    ];

    protected function casts(): array
    {
        return [
            'counted_toward_lock' => 'boolean',
            'meta' => 'array',
            'occurred_at' => 'datetime',
        ];
    }

    public function session(): BelongsTo
    {
        return $this->belongsTo(SoftSkillProctoringSession::class, 'soft_skill_proctoring_session_id');
    }

    public static function isStrikeType(string $type): bool
    {
        return ProctoringViolation::isStrikeType($type);
    }

    public static function label(string $type): string
    {
        return ProctoringViolation::label($type);
    }
}
