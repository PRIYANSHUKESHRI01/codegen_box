<?php

namespace App\Models;

use App\Support\ListeningScript;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ListeningLesson extends Model
{
    public const DIFFICULTY_BEGINNER = 'beginner';

    public const DIFFICULTY_INTERMEDIATE = 'intermediate';

    public const DIFFICULTY_ADVANCED = 'advanced';

    public const DIFFICULTIES = [self::DIFFICULTY_BEGINNER, self::DIFFICULTY_INTERMEDIATE, self::DIFFICULTY_ADVANCED];

    /** One speaker, multiple-choice questions — what every lesson was before formats existed. */
    public const FORMAT_COMPREHENSION = 'comprehension';

    /** Two or three speakers (an interview, a call, a stand-up), multiple-choice questions. */
    public const FORMAT_CONVERSATION = 'conversation';

    /** Hear a sentence, type it — graded by word alignment, no questions. */
    public const FORMAT_DICTATION = 'dictation';

    public const FORMATS = [self::FORMAT_COMPREHENSION, self::FORMAT_CONVERSATION, self::FORMAT_DICTATION];

    /** Shared library lesson — `user_id` is NULL and every student sees it. */
    public const SOURCE_LIBRARY = 'library';

    /** Generated for one student around their own topic — private to `user_id`. */
    public const SOURCE_AI = 'ai';

    /** A student keeps at most this many active generated lessons; older ones are archived (is_active=false), never deleted, since attempts reference them. */
    public const MAX_ACTIVE_AI_PER_USER = 20;

    /** The listening skills a question can train. Dictation has its own, scored by alignment rather than per question. */
    public const SKILL_MAIN_IDEA = 'main_idea';

    public const SKILL_DETAIL = 'detail';

    public const SKILL_NUMBERS = 'numbers';

    public const SKILL_INFERENCE = 'inference';

    public const SKILL_VOCABULARY = 'vocabulary';

    public const SKILL_PURPOSE = 'purpose';

    public const SKILL_DICTATION = 'dictation';

    public const QUESTION_SKILLS = [
        self::SKILL_MAIN_IDEA,
        self::SKILL_DETAIL,
        self::SKILL_NUMBERS,
        self::SKILL_INFERENCE,
        self::SKILL_VOCABULARY,
        self::SKILL_PURPOSE,
    ];

    public const SKILLS = [...self::QUESTION_SKILLS, self::SKILL_DICTATION];

    /** @var array<string,string> Human labels, shared with the frontend (types/learningCentre.ts mirrors this). */
    public const SKILL_LABELS = [
        self::SKILL_MAIN_IDEA => 'Main idea',
        self::SKILL_DETAIL => 'Key details',
        self::SKILL_NUMBERS => 'Numbers & times',
        self::SKILL_INFERENCE => 'Reading between the lines',
        self::SKILL_VOCABULARY => 'Words in context',
        self::SKILL_PURPOSE => 'Speaker\'s purpose',
        self::SKILL_DICTATION => 'Dictation',
    ];

    protected $fillable = [
        'user_id',
        'title',
        'passage_text',
        'category',
        'difficulty',
        'format',
        'source',
        'interest',
        'questions',
        'speakers',
        'script',
        'is_active',
        'display_order',
    ];

    protected function casts(): array
    {
        return [
            'questions' => 'array',
            'speakers' => 'array',
            'script' => 'array',
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
        return $this->hasMany(ListeningAttempt::class);
    }

    /** Library lessons plus this student's own generated ones — never anyone else's. */
    public function scopeVisibleTo(Builder $query, int $userId): Builder
    {
        return $query->where(fn (Builder $q) => $q->whereNull('user_id')->orWhere('user_id', $userId));
    }

    public function isVisibleTo(int $userId): bool
    {
        return $this->user_id === null || $this->user_id === $userId;
    }

    public function isDictation(): bool
    {
        return $this->format === self::FORMAT_DICTATION;
    }

    /** Never send correct_index/explanation to the client before they've answered — see ListeningLabController::show(). */
    public function questionsWithoutAnswers(): array
    {
        return collect($this->questions)
            ->map(fn (array $q) => ['question' => $q['question'], 'options' => $q['options']])
            ->values()
            ->all();
    }

    /**
     * The lesson cut into spoken sentences — the one list the audio player
     * walks through and every question's `evidence` indexes into. See
     * ListeningScript for why this is computed server-side only.
     *
     * @return list<array{index:int,text:string,speaker:?string}>
     */
    public function sentences(): array
    {
        return ListeningScript::sentences((string) $this->passage_text, $this->script);
    }

    /** What a student answers: one dictation sentence each, or one question each for every other format. */
    public function itemCount(): int
    {
        return $this->isDictation() ? count($this->sentences()) : count($this->questions ?? []);
    }

    public function estimatedSeconds(): int
    {
        return ListeningScript::estimateSeconds((string) $this->passage_text);
    }

    /** The distinct skills this lesson trains, in a stable order — shown on the lesson card. @return list<string> */
    public function skills(): array
    {
        if ($this->isDictation()) {
            return [self::SKILL_DICTATION];
        }

        $found = collect($this->questions ?? [])->pluck('skill')->filter()->unique()->all();

        return array_values(array_filter(self::QUESTION_SKILLS, fn (string $skill) => in_array($skill, $found, true)));
    }
}
