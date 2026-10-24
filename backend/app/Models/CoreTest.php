<?php

namespace App\Models;

use App\Models\Concerns\HasBranchAudience;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

/**
 * A timed, proctored Core Prep test: a fixed list of published questions for one branch family.
 *
 * Owner tiers mirror Soft Skills: `general` is written by Mellow for every student of the family;
 * `tpo_mock` belongs to one college and is visible only to it. (A hiring partner's own core tests are not
 * a thing yet — and would never count toward readiness.) A test can be aimed at certain branches inside its
 * family with `branch_audience`, and given an availability window.
 */
class CoreTest extends Model
{
    use HasBranchAudience;

    public const TYPE_GENERAL = 'general';

    public const TYPE_TPO_MOCK = 'tpo_mock';

    public const STATUS_DRAFT = 'draft';

    public const STATUS_PUBLISHED = 'published';

    public const STATUS_CANCELLED = 'cancelled';

    public const STATUSES = [self::STATUS_DRAFT, self::STATUS_PUBLISHED, self::STATUS_CANCELLED];

    protected $fillable = [
        'slug', 'title', 'description', 'discipline_code', 'status', 'test_type', 'owning_college_id', 'duration_minutes',
        'pass_percentage', 'shuffle_options', 'shuffle_questions', 'max_attempts', 'available_from', 'available_until',
    ];

    protected function casts(): array
    {
        return [
            'duration_minutes' => 'integer',
            'pass_percentage' => 'integer',
            'shuffle_options' => 'boolean',
            'shuffle_questions' => 'boolean',
            'max_attempts' => 'integer',
            'available_from' => 'datetime',
            'available_until' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (CoreTest $test) {
            $test->public_id ??= (string) Str::ulid();
        });
    }

    public function getRouteKeyName(): string
    {
        return 'slug';
    }

    public function owningCollege(): BelongsTo
    {
        return $this->belongsTo(College::class, 'owning_college_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function testQuestions(): HasMany
    {
        return $this->hasMany(CoreTestQuestion::class)->orderBy('position');
    }

    public function questions(): BelongsToMany
    {
        return $this->belongsToMany(CoreQuestion::class, 'core_test_questions')->withPivot(['position', 'section'])->orderBy('core_test_questions.position');
    }

    public function sessions(): HasMany
    {
        return $this->hasMany(CoreTestSession::class);
    }

    /**
     * The tests whose results count toward a student's readiness: Mellow's and their own college's. The one definition
     * of that rule (the same role as Contest/Interview/SoftSkillAssessment::scopeCountsTowardReadiness) — a hiring
     * partner's test, when there is one, will never be in it.
     */
    public function scopeCountsTowardReadiness($query)
    {
        return $query->whereIn('core_tests.test_type', [self::TYPE_GENERAL, self::TYPE_TPO_MOCK]);
    }

    public function isPublished(): bool
    {
        return $this->status === self::STATUS_PUBLISHED;
    }

    public function isOpenNow(): bool
    {
        return ($this->available_from === null || $this->available_from->lte(now()))
            && ($this->available_until === null || $this->available_until->gte(now()));
    }

    /**
     * Whether a student may see this test at all — the rule every student endpoint asks. (Starting it
     * additionally needs a plan that allows tests and an open window; see CoreTestService::start.)
     */
    public function isVisibleToUser(User $user): bool
    {
        if (! $this->isPublished() || $this->discipline_code !== $user->discipline) {
            return false;
        }

        if ($this->test_type === self::TYPE_TPO_MOCK && ($user->college_id === null || $this->owning_college_id !== $user->college_id)) {
            return false;
        }

        return $this->audienceIncludes($user);
    }

    public static function uniqueSlug(string $title): string
    {
        $base = Str::slug($title) ?: 'core-test';
        $slug = $base;
        $suffix = 1;

        while (self::where('slug', $slug)->exists()) {
            $suffix++;
            $slug = "{$base}-{$suffix}";
        }

        return $slug;
    }
}
