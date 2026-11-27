<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

/**
 * SuperAdmin-curated composite College Assessment combining any subset of:
 *   1. Soft Skills test (`soft_skill_assessment_id`)
 *   2. Coding test (`contest_id`)
 *   3. AI Interview (`interview_id`)
 *
 * Targeted college-wise, branch/department-wise, and/or individual student-wise
 * via `college_assessment_assignments`.
 */
class CollegeAssessment extends Model
{
    public const STATUS_DRAFT = 'draft';

    public const STATUS_PUBLISHED = 'published';

    public const STATUS_CLOSED = 'closed';

    public const STATUSES = [
        self::STATUS_DRAFT,
        self::STATUS_PUBLISHED,
        self::STATUS_CLOSED,
    ];

    protected $fillable = [
        'slug',
        'title',
        'description',
        'status',
        'starts_at',
        'ends_at',
        'enforce_sequence',
        'passing_score_percent',
        'target_scope',
        'include_soft_skills',
        'soft_skill_assessment_id',
        'soft_skill_weight',
        'soft_skill_config',
        'include_coding',
        'contest_id',
        'coding_weight',
        'coding_config',
        'include_interview',
        'interview_id',
        'interview_weight',
        'interview_config',
        'created_by',
        'published_at',
    ];

    protected function casts(): array
    {
        return [
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
            'published_at' => 'datetime',
            'enforce_sequence' => 'boolean',
            'passing_score_percent' => 'float',
            'target_scope' => 'array',
            'include_soft_skills' => 'boolean',
            'soft_skill_weight' => 'integer',
            'soft_skill_config' => 'array',
            'include_coding' => 'boolean',
            'coding_weight' => 'integer',
            'coding_config' => 'array',
            'include_interview' => 'boolean',
            'interview_weight' => 'integer',
            'interview_config' => 'array',
        ];
    }

    public function getRouteKeyName(): string
    {
        return 'slug';
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function softSkillAssessment(): BelongsTo
    {
        return $this->belongsTo(SoftSkillAssessment::class, 'soft_skill_assessment_id');
    }

    public function contest(): BelongsTo
    {
        return $this->belongsTo(Contest::class, 'contest_id');
    }

    public function interview(): BelongsTo
    {
        return $this->belongsTo(Interview::class, 'interview_id');
    }

    public function assignments(): HasMany
    {
        return $this->hasMany(CollegeAssessmentAssignment::class);
    }

    public function isPublished(): bool
    {
        return $this->status === self::STATUS_PUBLISHED;
    }

    public function isClosed(): bool
    {
        return $this->status === self::STATUS_CLOSED || ($this->ends_at !== null && now()->gte($this->ends_at));
    }

    public function isOpenForTaking(): bool
    {
        if (! $this->isPublished()) {
            return false;
        }
        $now = now();
        if ($this->starts_at !== null && $now->lt($this->starts_at)) {
            return false;
        }
        if ($this->ends_at !== null && $now->gte($this->ends_at)) {
            return false;
        }

        return true;
    }

    public static function uniqueSlug(string $title): string
    {
        $base = Str::slug($title) ?: 'college-assessment';
        $slug = $base;
        $suffix = 1;

        while (self::where('slug', $slug)->exists()) {
            $suffix++;
            $slug = "{$base}-{$suffix}";
        }

        return $slug;
    }
}
