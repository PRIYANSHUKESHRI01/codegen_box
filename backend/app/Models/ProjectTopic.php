<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

/**
 * One Project Lab project a student can pick ("Learning Management System",
 * "Hospital Management System"…). The SOW (statement of work) is the
 * Markdown in `sow_markdown`; the milestones a student ticks off while
 * following it are structured rows in `project_milestones` so progress can be
 * tracked and reviewed without parsing prose.
 *
 * Written by hand by Mellow staff (see AdminProjectLabController) — never
 * generated. Only `published` topics reach students; once anyone has worked on
 * a topic it is archived rather than deleted (enrollments restrict deletion).
 *
 * `sow_version` is bumped whenever the SOW text changes materially, and each
 * enrollment records the version it started on, so a student mid-way through a
 * project can be shown "the SOW has been updated" instead of silently
 * following a different document.
 */
class ProjectTopic extends Model
{
    public const STATUS_DRAFT = 'draft';

    public const STATUS_PUBLISHED = 'published';

    public const STATUS_ARCHIVED = 'archived';

    public const STATUSES = [self::STATUS_DRAFT, self::STATUS_PUBLISHED, self::STATUS_ARCHIVED];

    public const DIFFICULTY_BEGINNER = 'beginner';

    public const DIFFICULTY_INTERMEDIATE = 'intermediate';

    public const DIFFICULTY_ADVANCED = 'advanced';

    public const DIFFICULTIES = [self::DIFFICULTY_BEGINNER, self::DIFFICULTY_INTERMEDIATE, self::DIFFICULTY_ADVANCED];

    /** Students must write the code themselves: pasting from outside the workspace is refused. The default. */
    public const AUTHORSHIP_STRICT = 'strict';

    /** For the rare project where pasting is fine: the editor's guard is switched off. */
    public const AUTHORSHIP_OPEN = 'open';

    public const AUTHORSHIP_MODES = [self::AUTHORSHIP_STRICT, self::AUTHORSHIP_OPEN];

    /** Slugs that would collide with a frontend route segment or admin action. */
    private const RESERVED_SLUGS = ['new', 'edit', 'submissions', 'workspace', 'view'];

    protected $fillable = [
        'slug',
        'title',
        'category',
        'summary',
        'difficulty',
        'estimated_hours',
        'tech_stack',
        'outcomes',
        'sow_markdown',
        'sow_version',
        'status',
        'is_free_sample',
        'authorship_mode',
        'icon',
        'display_order',
        'created_by',
        'published_at',
    ];

    protected function casts(): array
    {
        return [
            'estimated_hours' => 'integer',
            'tech_stack' => 'array',
            'outcomes' => 'array',
            'sow_version' => 'integer',
            'is_free_sample' => 'boolean',
            'display_order' => 'integer',
            'published_at' => 'datetime',
        ];
    }

    public function milestones(): HasMany
    {
        return $this->hasMany(ProjectMilestone::class)->orderBy('position')->orderBy('id');
    }

    public function enrollments(): HasMany
    {
        return $this->hasMany(ProjectEnrollment::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function scopePublished(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_PUBLISHED);
    }

    public function isPublished(): bool
    {
        return $this->status === self::STATUS_PUBLISHED;
    }

    public function hasSow(): bool
    {
        return trim((string) $this->sow_markdown) !== '';
    }

    public static function uniqueSlug(string $title, ?int $ignoreId = null): string
    {
        $base = Str::slug($title) ?: 'project';
        $slug = $base;
        $suffix = 1;

        while (
            in_array($slug, self::RESERVED_SLUGS, true)
            || self::where('slug', $slug)->when($ignoreId, fn ($q) => $q->whereKeyNot($ignoreId))->exists()
        ) {
            $suffix++;
            $slug = "{$base}-{$suffix}";
        }

        return $slug;
    }
}
