<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SoftSkillQuestion extends Model
{
    public const CATEGORY_APTITUDE = 'aptitude';

    public const CATEGORY_REASONING = 'reasoning';

    public const CATEGORY_ENGLISH = 'english';

    public const CATEGORY_SITUATIONAL = 'situational';

    public const CATEGORIES = [
        self::CATEGORY_APTITUDE,
        self::CATEGORY_REASONING,
        self::CATEGORY_ENGLISH,
        self::CATEGORY_SITUATIONAL,
    ];

    public const DIFFICULTY_EASY = 'easy';

    public const DIFFICULTY_MEDIUM = 'medium';

    public const DIFFICULTY_HARD = 'hard';

    public const DIFFICULTIES = [self::DIFFICULTY_EASY, self::DIFFICULTY_MEDIUM, self::DIFFICULTY_HARD];

    protected $fillable = [
        'category',
        'difficulty',
        'question_text',
        'options',
        'correct_index',
        'explanation',
        'is_active',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'options' => 'array',
            'correct_index' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function assessmentQuestions(): HasMany
    {
        return $this->hasMany(SoftSkillAssessmentQuestion::class);
    }

    /** Never expose correct_index/explanation before the student has answered — see SoftSkillController's answer-stripped payloads. */
    public function toUnansweredPayload(): array
    {
        return [
            'id' => $this->id,
            'category' => $this->category,
            'question_text' => $this->question_text,
            'options' => $this->options,
        ];
    }
}
