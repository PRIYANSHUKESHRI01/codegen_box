<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class ContestParticipant extends Model
{
    protected $fillable = [
        'contest_id',
        'user_id',
        'registered_at',
        'score',
        'penalty_minutes',
        'rank',
        'rating_before',
        'rating_after',
    ];

    protected function casts(): array
    {
        return [
            'registered_at' => 'datetime',
            'score' => 'integer',
            'penalty_minutes' => 'integer',
            'rank' => 'integer',
            'rating_before' => 'integer',
            'rating_after' => 'integer',
        ];
    }

    public function contest(): BelongsTo
    {
        return $this->belongsTo(Contest::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** Null until the student actually opens a contest problem — see ContestProctoringController::start(). */
    public function proctoringSession(): HasOne
    {
        return $this->hasOne(ProctoringSession::class);
    }
}
