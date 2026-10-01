<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SpeakingPrompt extends Model
{
    public const DIFFICULTY_BEGINNER = 'beginner';

    public const DIFFICULTY_INTERMEDIATE = 'intermediate';

    public const DIFFICULTY_ADVANCED = 'advanced';

    public const DIFFICULTIES = [self::DIFFICULTY_BEGINNER, self::DIFFICULTY_INTERMEDIATE, self::DIFFICULTY_ADVANCED];

    protected $fillable = [
        'title',
        'passage_text',
        'category',
        'difficulty',
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

    public function attempts(): HasMany
    {
        return $this->hasMany(SpeakingAttempt::class);
    }

    public function wordCount(): int
    {
        return str_word_count($this->passage_text);
    }
}
