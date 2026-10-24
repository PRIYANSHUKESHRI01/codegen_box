<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One proctoring event on a Core test. The violation vocabulary is borrowed from contest proctoring so nothing can disagree about what a strike is. */
class CoreTestProctoringViolation extends Model
{
    public const STRIKE_TYPES = ProctoringViolation::STRIKE_TYPES;

    public const TYPES = ProctoringViolation::TYPES;

    protected $fillable = ['core_test_proctoring_session_id', 'type', 'counted_toward_lock', 'ip_address', 'meta', 'occurred_at'];

    protected function casts(): array
    {
        return ['counted_toward_lock' => 'boolean', 'meta' => 'array', 'occurred_at' => 'datetime'];
    }

    public function session(): BelongsTo
    {
        return $this->belongsTo(CoreTestProctoringSession::class, 'core_test_proctoring_session_id');
    }

    public static function isStrikeType(string $type): bool
    {
        return ProctoringViolation::isStrikeType($type);
    }
}
