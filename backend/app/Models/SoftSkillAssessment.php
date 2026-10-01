<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

/**
 * Soft Skills — structural sibling of Interview (see the creating
 * migration's docblock). isVisibleToUser() mirrors
 * Interview::isVisibleToCollege() but simpler — see that method's docblock
 * for why `company` type doesn't need Interview's drive/college-picker
 * machinery here.
 */
class SoftSkillAssessment extends Model
{
    public const STATUS_DRAFT = 'draft';

    public const STATUS_PUBLISHED = 'published';

    public const STATUS_CANCELLED = 'cancelled';

    public const STATUSES = [self::STATUS_DRAFT, self::STATUS_PUBLISHED, self::STATUS_CANCELLED];

    public const TYPE_GENERAL = 'general';

    public const TYPE_TPO_MOCK = 'tpo_mock';

    public const TYPE_COMPANY = 'company';

    public const TYPES = [self::TYPE_GENERAL, self::TYPE_TPO_MOCK, self::TYPE_COMPANY];

    protected $fillable = [
        'title',
        'slug',
        'description',
        'status',
        'assessment_type',
        'owning_college_id',
        'owning_company_id',
        'duration_minutes',
        'pass_percentage',
        'max_attempts',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'duration_minutes' => 'integer',
            'pass_percentage' => 'integer',
            'max_attempts' => 'integer',
        ];
    }

    public function getRouteKeyName(): string
    {
        return 'slug';
    }

    public function assessmentQuestions(): HasMany
    {
        return $this->hasMany(SoftSkillAssessmentQuestion::class);
    }

    public function sessions(): HasMany
    {
        return $this->hasMany(SoftSkillSession::class);
    }

    public function owningCollege(): BelongsTo
    {
        return $this->belongsTo(College::class, 'owning_college_id');
    }

    public function owningCompany(): BelongsTo
    {
        return $this->belongsTo(Company::class, 'owning_company_id');
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function isPublished(): bool
    {
        return $this->status === self::STATUS_PUBLISHED;
    }

    public function isTpoMock(): bool
    {
        return $this->assessment_type === self::TYPE_TPO_MOCK;
    }

    public function isCompanyType(): bool
    {
        return $this->assessment_type === self::TYPE_COMPANY;
    }

    /**
     * general -> every student; tpo_mock -> only students at the owning
     * college; company -> students at any college with an approved, active
     * DriveCollegeMapping to ANY of this company's drives (a deliberately
     * looser check than Interview's per-drive college picker — see this
     * model's docblock).
     */
    public function isVisibleToUser(User $user): bool
    {
        return match ($this->assessment_type) {
            self::TYPE_TPO_MOCK => $user->college_id !== null && $this->owning_college_id === $user->college_id,
            self::TYPE_COMPANY => $user->college_id !== null && DriveCollegeMapping::where('college_id', $user->college_id)
                ->where('status', DriveCollegeMapping::STATUS_APPROVED)
                ->where('is_active', true)
                ->whereHas('placementDrive', fn ($q) => $q->where('company_id', $this->owning_company_id))
                ->exists(),
            default => true,
        };
    }

    public static function uniqueSlug(string $title): string
    {
        $base = Str::slug($title) ?: 'soft-skills-test';
        $slug = $base;
        $suffix = 1;

        while (self::where('slug', $slug)->exists()) {
            $suffix++;
            $slug = "{$base}-{$suffix}";
        }

        return $slug;
    }
}
