<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

/**
 * Multi-Assessment Campaign ("Mellow Vault Multi-Disciplinary Internship & Launchpad Program 2026").
 * Runs as either a 21-day Tech track (3 x [Soft Skills + Coding + Technical AI Interview])
 * or a 5-day Non-Tech track (3 x [Soft Skills & Analytical + Domain/HR AI Interview]),
 * rotating questions across Set 1 / Set 2 / Set 3 per student inside each college.
 */
class LaunchpadProgram extends Model
{
    public const TRACK_TECH = 'tech';

    public const TRACK_NON_TECH = 'non_tech';

    public const TRACKS = [self::TRACK_TECH, self::TRACK_NON_TECH];

    public const STATUS_DRAFT = 'draft';

    public const STATUS_PUBLISHED = 'published';

    public const STATUS_CLOSED = 'closed';

    public const DEFAULT_CAMPAIGN_TITLE = 'Mellow Vault Multi-Disciplinary Internship & Launchpad Program 2026';

    protected $fillable = [
        'slug',
        'title',
        'subtitle',
        'description',
        'track',
        'status',
        'duration_days',
        'min_readiness_percent',
        'passing_score_percent',
        'enforce_proctoring',
        'target_scope',
        'starts_at',
        'ends_at',
        'published_at',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'duration_days' => 'integer',
            'min_readiness_percent' => 'float',
            'passing_score_percent' => 'float',
            'enforce_proctoring' => 'boolean',
            'target_scope' => 'array',
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
            'published_at' => 'datetime',
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

    public function slots(): HasMany
    {
        return $this->hasMany(LaunchpadProgramSlot::class)->orderBy('assessment_number')->orderBy('set_number');
    }

    public function enrollments(): HasMany
    {
        return $this->hasMany(LaunchpadProgramEnrollment::class);
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
        return $this->isPublished() && ! $this->isClosed();
    }

    public static function uniqueSlug(string $title): string
    {
        $base = Str::slug($title) ?: 'launchpad-program';
        $slug = $base;
        $i = 1;
        while (self::where('slug', $slug)->exists()) {
            $i++;
            $slug = "{$base}-{$i}";
        }

        return $slug;
    }
}
