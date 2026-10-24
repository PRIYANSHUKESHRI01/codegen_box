<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * One Core Prep question: MCQ (single or multi-select) or numerical, written in Markdown with
 * KaTeX maths, filed under a subject (and optionally a topic) of a branch family.
 *
 * Authoring lifecycle: draft → in_review → published → retired. Only `published` questions are
 * ever shown to students. `usage` keeps practice (instant feedback, shows the answer) apart from
 * timed tests, so practising can never leak a proctored test's answers.
 *
 * Plain-string types/statuses (constants here) rather than DB enums: the soft-skills question bank's
 * hard-coded category enum is exactly the pain this avoids.
 */
class CoreQuestion extends Model
{
    public const TYPE_MCQ_SINGLE = 'mcq_single';

    public const TYPE_MCQ_MULTI = 'mcq_multi';

    public const TYPE_NUMERIC = 'numeric';

    public const TYPES = [self::TYPE_MCQ_SINGLE, self::TYPE_MCQ_MULTI, self::TYPE_NUMERIC];

    public const STATUS_DRAFT = 'draft';

    public const STATUS_IN_REVIEW = 'in_review';

    public const STATUS_PUBLISHED = 'published';

    public const STATUS_RETIRED = 'retired';

    public const STATUSES = [self::STATUS_DRAFT, self::STATUS_IN_REVIEW, self::STATUS_PUBLISHED, self::STATUS_RETIRED];

    public const USAGE_PRACTICE = 'practice';

    public const USAGE_TEST = 'test';

    public const USAGE_BOTH = 'both';

    public const USAGES = [self::USAGE_PRACTICE, self::USAGE_TEST, self::USAGE_BOTH];

    public const DIFFICULTIES = ['easy', 'medium', 'hard'];

    /** Option ids, in order. A question has 2–6 options. */
    public const OPTION_IDS = ['a', 'b', 'c', 'd', 'e', 'f'];

    protected $fillable = [
        'external_id', 'discipline_code', 'subject_id', 'topic_id', 'type', 'stem', 'image_path', 'options', 'correct',
        'numeric_min', 'numeric_max', 'numeric_unit', 'marks', 'negative_marks', 'difficulty', 'explanation', 'tags',
        'companies', 'source', 'usage', 'status', 'owning_college_id', 'owning_company_id',
    ];

    protected function casts(): array
    {
        return [
            'options' => 'array',
            'correct' => 'array',
            'tags' => 'array',
            'companies' => 'array',
            'numeric_min' => 'float',
            'numeric_max' => 'float',
            'marks' => 'float',
            'negative_marks' => 'float',
            'version' => 'integer',
            'attempts_count' => 'integer',
            'key_fixed_at' => 'datetime',
            'reviewed_at' => 'datetime',
            'published_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (CoreQuestion $question) {
            $question->public_id ??= (string) Str::ulid();
        });
    }

    public function subject(): BelongsTo
    {
        return $this->belongsTo(CoreSubject::class, 'subject_id');
    }

    public function topic(): BelongsTo
    {
        return $this->belongsTo(CoreTopic::class, 'topic_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function audits(): HasMany
    {
        return $this->hasMany(CoreQuestionAudit::class)->latest('id');
    }

    public function stat(): \Illuminate\Database\Eloquent\Relations\HasOne
    {
        return $this->hasOne(CoreQuestionStat::class);
    }

    public function reports(): HasMany
    {
        return $this->hasMany(CoreQuestionReport::class);
    }

    public function isPublished(): bool
    {
        return $this->status === self::STATUS_PUBLISHED;
    }

    public function isNumeric(): bool
    {
        return $this->type === self::TYPE_NUMERIC;
    }

    /** Whether students may see this in a timed test (published and used for tests). */
    public function scopeForTests($query)
    {
        return $query->where('status', self::STATUS_PUBLISHED)->whereIn('usage', [self::USAGE_TEST, self::USAGE_BOTH]);
    }

    /** Whether students may practise it (published and used for practice). */
    public function scopeForPractice($query)
    {
        return $query->where('status', self::STATUS_PUBLISHED)->whereIn('usage', [self::USAGE_PRACTICE, self::USAGE_BOTH]);
    }

    /**
     * Once any student has answered, changing the key would score some attempts against one
     * key and some against another — so the key is locked and changed only through the audited
     * "fix key" action (CoreQuestionService::fixKey), which regrades.
     */
    public function isKeyLocked(): bool
    {
        return $this->attempts_count > 0;
    }

    public function imageUrl(): ?string
    {
        return $this->image_path ? Storage::disk('public')->url($this->image_path) : null;
    }

    /**
     * The fields that decide whether an answer is right. Everything else (stem wording, explanation,
     * tags, even an option's text) can be corrected freely.
     *
     * @return array<string, mixed>
     */
    public function keyFields(): array
    {
        return [
            'type' => $this->type,
            'option_ids' => collect($this->options ?? [])->pluck('id')->all(),
            'correct' => $this->correct,
            'numeric_min' => $this->numeric_min,
            'numeric_max' => $this->numeric_max,
            'marks' => $this->marks,
            'negative_marks' => $this->negative_marks,
        ];
    }

    /** The staff view of the question — everything, key included. */
    public function toAuthoringArray(): array
    {
        return [
            'id' => $this->id,
            'public_id' => $this->public_id,
            'external_id' => $this->external_id,
            'discipline_code' => $this->discipline_code,
            'subject' => $this->relationLoaded('subject') && $this->subject ? ['id' => $this->subject->id, 'code' => $this->subject->code, 'name' => $this->subject->name] : null,
            'topic' => $this->relationLoaded('topic') && $this->topic ? ['id' => $this->topic->id, 'code' => $this->topic->code, 'name' => $this->topic->name] : null,
            'type' => $this->type,
            'stem' => $this->stem,
            'image_url' => $this->imageUrl(),
            'options' => $this->options,
            'correct' => $this->correct,
            'numeric_min' => $this->numeric_min,
            'numeric_max' => $this->numeric_max,
            'numeric_unit' => $this->numeric_unit,
            'marks' => $this->marks,
            'negative_marks' => $this->negative_marks,
            'difficulty' => $this->difficulty,
            'explanation' => $this->explanation,
            'tags' => $this->tags ?? [],
            'companies' => $this->companies ?? [],
            'source' => $this->source,
            'usage' => $this->usage,
            'status' => $this->status,
            'version' => $this->version,
            'attempts_count' => $this->attempts_count,
            'key_locked' => $this->isKeyLocked(),
            // What students' answers say about it (nightly item analysis) — present once it has been answered.
            'stats' => $this->relationLoaded('stat') && $this->stat ? [
                'test_attempts' => $this->stat->test_attempts, 'facility' => $this->stat->facility, 'discrimination' => $this->stat->discrimination,
                'practice_attempts' => $this->stat->practice_attempts, 'practice_facility' => $this->stat->practice_facility,
                'flags' => $this->stat->flags ?? [], 'suspect_option' => $this->stat->suspect_option, 'computed_at' => $this->stat->computed_at?->toIso8601String(),
            ] : null,
            'reviewed_at' => $this->reviewed_at?->toIso8601String(),
            'published_at' => $this->published_at?->toIso8601String(),
            'created_by' => $this->relationLoaded('creator') ? $this->creator?->only(['id', 'name']) : null,
            'reviewed_by' => $this->relationLoaded('reviewer') ? $this->reviewer?->only(['id', 'name']) : null,
            'open_reports' => $this->open_reports_count ?? null,
            'updated_at' => $this->updated_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
