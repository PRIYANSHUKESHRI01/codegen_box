<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SpeakingPrompt extends Model
{
    public const DIFFICULTY_BEGINNER = 'beginner';

    public const DIFFICULTY_INTERMEDIATE = 'intermediate';

    public const DIFFICULTY_ADVANCED = 'advanced';

    public const DIFFICULTIES = [self::DIFFICULTY_BEGINNER, self::DIFFICULTY_INTERMEDIATE, self::DIFFICULTY_ADVANCED];

    /** Shared library passage — `user_id` is NULL and every student sees it. */
    public const SOURCE_LIBRARY = 'library';

    /** Generated for one student around their own interest — private to `user_id`. */
    public const SOURCE_AI = 'ai';

    /** A student keeps at most this many active generated passages; older ones are archived (is_active=false) as new ones arrive. */
    public const MAX_ACTIVE_AI_PER_USER = 30;

    protected $fillable = [
        'user_id',
        'title',
        'passage_text',
        'category',
        'difficulty',
        'source',
        'interest',
        'target_wpm_min',
        'target_wpm_max',
        'is_active',
        'display_order',
    ];

    protected function casts(): array
    {
        return [
            'target_wpm_min' => 'integer',
            'target_wpm_max' => 'integer',
            'is_active' => 'boolean',
            'display_order' => 'integer',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function attempts(): HasMany
    {
        return $this->hasMany(SpeakingAttempt::class);
    }

    /** Library passages plus this student's own generated ones — never anyone else's. */
    public function scopeVisibleTo(Builder $query, int $userId): Builder
    {
        return $query->where(fn (Builder $q) => $q->whereNull('user_id')->orWhere('user_id', $userId));
    }

    public function isVisibleTo(int $userId): bool
    {
        return $this->user_id === null || $this->user_id === $userId;
    }

    public function wordCount(): int
    {
        return str_word_count($this->passage_text);
    }
}
