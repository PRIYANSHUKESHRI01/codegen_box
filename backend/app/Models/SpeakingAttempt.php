<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Passing threshold is fixed at 60 (see SpeakingPracticeController) — the
 * frontend "Try Again" flow triggers off `passed === false`, never off a
 * hardcoded 60 client-side, so the threshold only ever needs to change here.
 */
class SpeakingAttempt extends Model
{
    public const PASS_THRESHOLD = 60;

    protected $fillable = [
        'user_id',
        'speaking_prompt_id',
        'attempt_number',
        'transcript_text',
        'audio_path',
        'duration_seconds',
        'pacing_wpm',
        'overall_score',
        'clarity_score',
        'fluency_score',
        'accuracy_score',
        'feedback',
        'improvement_tips',
        'passed',
        'scored_at',
        'scoring_failed_at',
    ];

    protected function casts(): array
    {
        return [
            'attempt_number' => 'integer',
            'duration_seconds' => 'integer',
            'pacing_wpm' => 'integer',
            'overall_score' => 'integer',
            'clarity_score' => 'integer',
            'fluency_score' => 'integer',
            'accuracy_score' => 'integer',
            'improvement_tips' => 'array',
            'passed' => 'boolean',
            'scored_at' => 'datetime',
            'scoring_failed_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function speakingPrompt(): BelongsTo
    {
        return $this->belongsTo(SpeakingPrompt::class);
    }

    public function hasScoreAvailable(): bool
    {
        return $this->scored_at !== null;
    }

    public function scoringFailed(): bool
    {
        return $this->scoring_failed_at !== null;
    }
}
