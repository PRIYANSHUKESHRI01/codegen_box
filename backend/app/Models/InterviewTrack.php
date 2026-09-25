<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

/**
 * The "Final Interview" container — see the creating migration's docblock.
 * Owns identity/visibility/ownership ONCE per track; each of its 3 rounds is
 * a completely ordinary App\Models\Interview row tagged with
 * `interview_track_id`/`round_number` that inherits this row's targeting
 * rather than carrying its own independent one (see
 * Interview::isVisibleToUser()'s track branch). No `talent_pool` type: a
 * 3-round human-reviewed pipeline doesn't fit that single-assessment
 * sourcing model.
 */
class InterviewTrack extends Model
{
    public const STATUS_DRAFT = 'draft';

    public const STATUS_PUBLISHED = 'published';

    public const STATUS_CANCELLED = 'cancelled';

    public const STATUSES = [self::STATUS_DRAFT, self::STATUS_PUBLISHED, self::STATUS_CANCELLED];

    public const TRACK_TYPE_GENERAL = 'general';

    public const TRACK_TYPE_COMPANY = 'company';

    public const TRACK_TYPE_TPO_MOCK = 'tpo_mock';

    public const TRACK_TYPE_COMPANY_HIRING = 'company_hiring';

    public const TRACK_TYPES = [
        self::TRACK_TYPE_GENERAL,
        self::TRACK_TYPE_COMPANY,
        self::TRACK_TYPE_TPO_MOCK,
        self::TRACK_TYPE_COMPANY_HIRING,
    ];

    protected $fillable = [
        'title',
        'slug',
        'description',
        'status',
        'track_type',
        'role_title',
        'interview_role_template_id',
        'company_id',
        'placement_drive_id',
        'owning_college_id',
        'owning_company_id',
        'created_by',
    ];

    public function getRouteKeyName(): string
    {
        return 'slug';
    }

    public function rounds(): HasMany
    {
        return $this->hasMany(Interview::class)->orderBy('round_number');
    }

    public function roleTemplate(): BelongsTo
    {
        return $this->belongsTo(InterviewRoleTemplate::class, 'interview_role_template_id');
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function placementDrive(): BelongsTo
    {
        return $this->belongsTo(PlacementDrive::class);
    }

    public function owningCollege(): BelongsTo
    {
        return $this->belongsTo(College::class, 'owning_college_id');
    }

    public function owningCompany(): BelongsTo
    {
        return $this->belongsTo(Company::class, 'owning_company_id');
    }

    /** A `company` track's own explicit college targeting — mirrors Interview::colleges(). */
    public function colleges(): BelongsToMany
    {
        return $this->belongsToMany(College::class, 'interview_track_colleges');
    }

    public function isPublished(): bool
    {
        return $this->status === self::STATUS_PUBLISHED;
    }

    public function isCompanyTrack(): bool
    {
        return $this->track_type === self::TRACK_TYPE_COMPANY;
    }

    public function isTpoMock(): bool
    {
        return $this->track_type === self::TRACK_TYPE_TPO_MOCK;
    }

    public function isCompanyHiring(): bool
    {
        return $this->track_type === self::TRACK_TYPE_COMPANY_HIRING;
    }

    /** Byte-similar to Interview::isVisibleToCollege() minus the talent_pool arm — see that method's docblock. */
    public function isVisibleToCollege(?int $collegeId): bool
    {
        return match ($this->track_type) {
            self::TRACK_TYPE_TPO_MOCK => $collegeId !== null && $this->owning_college_id === $collegeId,
            self::TRACK_TYPE_COMPANY => $collegeId !== null && $this->placement_drive_id !== null
                && $this->colleges()->where('colleges.id', $collegeId)->exists()
                && DriveCollegeMapping::query()
                    ->where('placement_drive_id', $this->placement_drive_id)
                    ->where('college_id', $collegeId)
                    ->where('status', DriveCollegeMapping::STATUS_APPROVED)
                    ->where('is_active', true)
                    ->exists(),
            default => true,
        };
    }

    /**
     * Used only for the track-overview/browse read paths (Ops/TPO/Company
     * track lists, the student pipeline page) — NOT for gating whether a
     * candidate can take a specific round; that's Interview::isVisibleToUser()
     * on the round itself, which for round 1 delegates to this same logic
     * and for round 2/3 requires an actual invited session instead.
     */
    public function isVisibleToUser(User $user): bool
    {
        if ($this->track_type === self::TRACK_TYPE_COMPANY_HIRING) {
            return $this->rounds()->whereHas('sessions', fn ($q) => $q->where('user_id', $user->id))->exists();
        }

        return $this->isVisibleToCollege($user->college_id);
    }

    /**
     * Creates the 3 round Interview rows from a (validated) rounds_config
     * array — the actual snapshot: category_weights/qualifying_score_percent
     * are copied onto each round now and never read live from the template
     * again. Shared by all 3 *InterviewTrackController::store() methods.
     *
     * @param  array<int, array<string, mixed>>  $roundsConfig
     */
    public function createRounds(array $roundsConfig): void
    {
        foreach ($roundsConfig as $round) {
            $this->rounds()->create([
                'title' => "{$this->title} — {$round['round_name']}",
                'slug' => Interview::uniqueSlug("{$this->title}-{$round['round_name']}"),
                'status' => Interview::STATUS_DRAFT,
                'interview_type' => $this->roundInterviewType(),
                'company_id' => $this->company_id,
                'placement_drive_id' => $this->placement_drive_id,
                'owning_college_id' => $this->owning_college_id,
                'owning_company_id' => $this->owning_company_id,
                'created_by' => $this->created_by,
                'round_number' => $round['round_number'],
                'round_name' => $round['round_name'],
                'category_weights' => $round['category_weights'],
                'qualifying_score_percent' => $round['qualifying_score_percent'],
            ]);
        }
    }

    private function roundInterviewType(): string
    {
        return match ($this->track_type) {
            self::TRACK_TYPE_TPO_MOCK => Interview::INTERVIEW_TYPE_TPO_MOCK,
            self::TRACK_TYPE_COMPANY_HIRING => Interview::INTERVIEW_TYPE_COMPANY_HIRING,
            self::TRACK_TYPE_COMPANY => Interview::INTERVIEW_TYPE_COMPANY,
            default => Interview::INTERVIEW_TYPE_GENERAL,
        };
    }

    public static function uniqueSlug(string $title): string
    {
        $base = Str::slug($title) ?: 'interview-track';
        $slug = $base;
        $suffix = 1;

        while (self::where('slug', $slug)->exists()) {
            $suffix++;
            $slug = "{$base}-{$suffix}";
        }

        return $slug;
    }
}
