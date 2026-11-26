<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class VoiceVerificationProctoringViolation extends Model
{
    protected $fillable = [
        'voice_verification_profile_id',
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

    public function profile(): BelongsTo
    {
        return $this->belongsTo(VoiceVerificationProfile::class, 'voice_verification_profile_id');
    }
}
