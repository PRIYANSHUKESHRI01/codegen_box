<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * `questions` holds the full Gemini-generated answer key from the moment
 * generate() creates this row — see the creating migration's docblock.
 * `answers`/`score`/`passed`/`submitted_at` stay null between generate()
 * and submit(); isSubmitted() is the "has the student actually answered
 * yet" check used to reject a duplicate submit().
 */
class VocabularyAttempt extends Model
{
    public const PASS_THRESHOLD = 60;

    protected $fillable = [
        'user_id',
        'topic',
        'difficulty',
        'questions',
        'answers',
        'score',
        'passed',
        'submitted_at',
    ];

    protected function casts(): array
    {
        return [
            'questions' => 'array',
            'answers' => 'array',
            'score' => 'integer',
            'passed' => 'boolean',
            'submitted_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isSubmitted(): bool
    {
        return $this->submitted_at !== null;
    }

    /** Mirrors ListeningLesson::questionsWithoutAnswers() — never expose correct_index/explanation before grading. */
    public function questionsWithoutAnswers(): array
    {
        return collect($this->questions)
            ->map(fn (array $q) => ['word' => $q['word'], 'sentence' => $q['sentence'], 'options' => $q['options']])
            ->values()
            ->all();
    }
}
