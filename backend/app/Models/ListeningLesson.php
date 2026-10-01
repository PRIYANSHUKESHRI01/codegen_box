<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ListeningLesson extends Model
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
        'questions',
        'is_active',
        'display_order',
    ];

    protected function casts(): array
    {
        return [
            'questions' => 'array',
            'is_active' => 'boolean',
            'display_order' => 'integer',
        ];
    }

    public function attempts(): HasMany
    {
        return $this->hasMany(ListeningAttempt::class);
    }

    /** Never send correct_index/explanation to the client before they've answered — see ListeningLabController::show(). */
    public function questionsWithoutAnswers(): array
    {
        return collect($this->questions)
            ->map(fn (array $q) => ['question' => $q['question'], 'options' => $q['options']])
            ->values()
            ->all();
    }
}
