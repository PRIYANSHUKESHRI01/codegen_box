<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class VoiceVerificationSample extends Model
{
    protected $fillable = [
        'voice_verification_profile_id',
        'user_id',
        'voice_verification_prompt_id',
        'prompt_index',
        'audio_path',
        'duration_seconds',
        'transcript_text',
        'acoustic_features',
        'ai_vocal_notes',
        'recorded_at',
    ];

    protected function casts(): array
    {
        return [
            'prompt_index' => 'integer',
            'duration_seconds' => 'integer',
            'acoustic_features' => 'array',
            'recorded_at' => 'datetime',
        ];
    }

    public function profile(): BelongsTo
    {
        return $this->belongsTo(VoiceVerificationProfile::class, 'voice_verification_profile_id');
    }

    public function prompt(): BelongsTo
    {
        return $this->belongsTo(VoiceVerificationPrompt::class, 'voice_verification_prompt_id');
    }
}
