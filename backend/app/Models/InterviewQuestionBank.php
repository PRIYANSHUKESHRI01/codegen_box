<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * The real, permanent interview question bank (see the creating migration's
 * docblock). Bulk content is fed in later by hand/CSV against this same
 * table — nothing here is LLM-generated, and nothing about the schema
 * assumes it ever will be.
 */
class InterviewQuestionBank extends Model
{
    protected $table = 'interview_question_banks';

    public const CATEGORY_TECHNICAL = 'technical';

    public const CATEGORY_BEHAVIORAL = 'behavioral';

    public const CATEGORY_HR = 'hr';

    public const CATEGORY_SITUATIONAL = 'situational';

    public const CATEGORY_APTITUDE = 'aptitude';

    public const CATEGORIES = [
        self::CATEGORY_TECHNICAL,
        self::CATEGORY_BEHAVIORAL,
        self::CATEGORY_HR,
        self::CATEGORY_SITUATIONAL,
        self::CATEGORY_APTITUDE,
    ];

    public const DIFFICULTY_EASY = 'easy';

    public const DIFFICULTY_MEDIUM = 'medium';

    public const DIFFICULTY_HARD = 'hard';

    public const DIFFICULTIES = [self::DIFFICULTY_EASY, self::DIFFICULTY_MEDIUM, self::DIFFICULTY_HARD];

    protected $fillable = [
        'question_text',
        'category',
        'difficulty',
        'expected_duration_seconds',
        'tags',
        'notes_for_reviewer',
        'is_active',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'tags' => 'array',
            'is_active' => 'boolean',
            'expected_duration_seconds' => 'integer',
        ];
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function interviewQuestions(): HasMany
    {
        return $this->hasMany(InterviewQuestion::class);
    }

    /** Companies Ops has tagged this question as relevant to — see company_recommended_interview_questions. */
    public function recommendedForCompanies(): BelongsToMany
    {
        return $this->belongsToMany(Company::class, 'company_recommended_interview_questions');
    }
}
