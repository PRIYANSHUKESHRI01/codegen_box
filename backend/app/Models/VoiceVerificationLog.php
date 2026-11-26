<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class VoiceVerificationLog extends Model
{
    public const VERDICT_MATCH = 'match';

    public const VERDICT_MISMATCH = 'mismatch';

    public const VERDICT_INCONCLUSIVE = 'inconclusive';

    public const VERDICT_BLOCKED = 'blocked';

    protected $fillable = [
        'user_id',
        'voice_verification_profile_id',
        'interview_id',
        'interview_session_id',
        'interview_response_id',
        'sample_audio_path',
        'similarity_score',
        'acoustic_score',
        'ai_score',
        'verdict',
        'reason',
        'meta',
        'checked_at',
    ];

    protected function casts(): array
    {
        return [
            'similarity_score' => 'float',
            'acoustic_score' => 'float',
            'ai_score' => 'float',
            'meta' => 'array',
            'checked_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function profile(): BelongsTo
    {
        return $this->belongsTo(VoiceVerificationProfile::class, 'voice_verification_profile_id');
    }
}
