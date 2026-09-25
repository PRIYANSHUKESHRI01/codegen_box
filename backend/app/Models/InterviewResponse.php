<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Mirrors ContestSubmission — the candidate's actual answer to one
 * attached question: a transcript (always present) plus an optional stored
 * audio recording. See the creating migration's docblock. `score`/
 * `review_notes`/`scored_by`/`scored_at` are populated either by
 * ScoreInterviewSessionJob (Gemini — `ai_scored = true`, `scored_by = null`)
 * or a human reviewer (AdminInterviewController::scoreResponse() et al —
 * `ai_scored = false`, `scored_by` set) — same columns either way, `ai_scored`
 * just records which one wrote them last. Populated for every interview now
 * (track round or standalone), not only track rounds.
 */
class InterviewResponse extends Model
{
    protected $fillable = [
        'interview_session_id',
        'interview_question_id',
        'transcript_text',
        'audio_path',
        'audio_duration_seconds',
        'answered_at',
        'score',
        'review_notes',
        'scored_by',
        'scored_at',
        'ai_scored',
    ];

    protected function casts(): array
    {
        return [
            'answered_at' => 'datetime',
            'audio_duration_seconds' => 'integer',
            'score' => 'integer',
            'scored_at' => 'datetime',
            'ai_scored' => 'boolean',
        ];
    }

    public function session(): BelongsTo
    {
        return $this->belongsTo(InterviewSession::class, 'interview_session_id');
    }

    public function interviewQuestion(): BelongsTo
    {
        return $this->belongsTo(InterviewQuestion::class);
    }

    /** Null until a reviewer scores this response — only ever populated for a track-round question. */
    public function scoredBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'scored_by');
    }

    public function isScored(): bool
    {
        return $this->score !== null;
    }
}
