<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One proctoring event in a study sitting. The vocabulary (and which events are strikes) is the one every other proctoring flow uses. */
class StudySittingViolation extends Model
{
    public const STRIKE_TYPES = ProctoringViolation::STRIKE_TYPES;

    public const TYPES = ProctoringViolation::TYPES;

    public $timestamps = false;

    protected $fillable = ['study_sitting_id', 'type', 'counted_toward_lock', 'ip_address', 'meta', 'occurred_at'];

    protected function casts(): array
    {
        return ['counted_toward_lock' => 'boolean', 'meta' => 'array', 'occurred_at' => 'datetime'];
    }

    public function sitting(): BelongsTo
    {
        return $this->belongsTo(StudySitting::class, 'study_sitting_id');
    }
}
