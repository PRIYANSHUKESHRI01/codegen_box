<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PlacementDrive extends Model
{
    use HasFactory;

    public const STATUS_DRAFT = 'draft';

    public const STATUS_PUBLISHED = 'published';

    public const STATUS_COMPLETED = 'completed';

    public const STATUS_CANCELLED = 'cancelled';

    public const STATUSES = [
        self::STATUS_DRAFT,
        self::STATUS_PUBLISHED,
        self::STATUS_COMPLETED,
        self::STATUS_CANCELLED,
    ];

    /** Mellow-staff-curated — mappable by any college's TPO. */
    public const SOURCE_CATALOG = 'catalog';

    /** A TPO added this themselves for a company only their own campus is
     * hosting — never appears in another college's "available to map" list. */
    public const SOURCE_TPO_CREATED = 'tpo_created';

    /** A company hiring tenant's own job opening, posted directly. `company_id` IS the owner here (unlike SOURCE_TPO_CREATED, there's no separate creating-vs-employer distinction to track). May be run purely as a direct-invite pipeline (see CompanyCandidateController), proposed to specific colleges via the same pending-mapping-and-approval flow Mellow Ops uses for catalog drives (see DriveCollegeProposalService/CompanyDriveController::proposeToColleges()), or both at once — this source value only says "the company owns it," not "no college is involved." */
    public const SOURCE_COMPANY_DIRECT = 'company_direct';

    public const SOURCES = [
        self::SOURCE_CATALOG,
        self::SOURCE_TPO_CREATED,
        self::SOURCE_COMPANY_DIRECT,
    ];

    protected $fillable = [
        'company_id',
        'title',
        'role_title',
        'ctc_range',
        'drive_date',
        'interview_date',
        'duration_minutes',
        'min_cgpa',
        'max_backlogs',
        'eligible_branches',
        'status',
        'source',
        'is_open_to_all',
        'owning_college_id',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'drive_date' => 'datetime',
            'interview_date' => 'datetime',
            'eligible_branches' => 'array',
            'min_cgpa' => 'decimal:2',
            'is_open_to_all' => 'boolean',
        ];
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function collegeMappings(): HasMany
    {
        return $this->hasMany(DriveCollegeMapping::class);
    }

    public function applications(): HasMany
    {
        return $this->hasMany(DriveApplication::class);
    }

    public function interviews(): HasMany
    {
        return $this->hasMany(Interview::class);
    }

    public function owningCollege(): BelongsTo
    {
        return $this->belongsTo(College::class, 'owning_college_id');
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function isPublished(): bool
    {
        return $this->status === self::STATUS_PUBLISHED;
    }

    /**
     * The drive's own baseline eligibility, before any college-specific
     * override from a DriveCollegeMapping is applied on top.
     */
    public function baseEligibility(): array
    {
        return [
            'min_cgpa' => $this->min_cgpa,
            'max_backlogs' => $this->max_backlogs,
            'eligible_branches' => $this->eligible_branches,
        ];
    }

    /**
     * "Interview coming up — publish a mock or the final AI interview" nudge
     * data for the drive creator (hiring partner, or Ops for a catalog
     * drive). Null means the concept doesn't apply yet (no interview_date
     * set) — distinct from should_prompt=false, which means it applies but
     * there's nothing actionable right now (too far out, already handled,
     * or no candidates yet). Mirrors Interview::visibilityCollegeSummary()'s
     * shape; day math mirrors Subscription::daysRemaining()'s raw-timestamp
     * approach to avoid Carbon diffInDays' sign-convention ambiguity.
     */
    public function interviewUrgency(): ?array
    {
        if ($this->interview_date === null) {
            return null;
        }

        $todayTs = now()->startOfDay()->getTimestamp();
        $interviewTs = $this->interview_date->copy()->startOfDay()->getTimestamp();
        $daysUntil = (int) round(($interviewTs - $todayTs) / 86400);

        $candidatesInPipeline = $this->applications()->count();

        // general/tpo_mock interviews never carry a placement_drive_id at
        // all, so this whereIn is a defensive, self-documenting invariant
        // rather than strictly load-bearing.
        $typedInterviews = $this->interviews()
            ->whereIn('interview_type', [Interview::INTERVIEW_TYPE_COMPANY_HIRING, Interview::INTERVIEW_TYPE_COMPANY])
            ->get(['is_mock']);
        $hasMock = $typedInterviews->contains(fn (Interview $i) => $i->is_mock);
        $hasFinal = $typedInterviews->contains(fn (Interview $i) => ! $i->is_mock);

        return [
            'days_until' => $daysUntil,
            'candidates_in_pipeline' => $candidatesInPipeline,
            'has_mock_interview' => $hasMock,
            'has_final_interview' => $hasFinal,
            'should_prompt' => $daysUntil >= 0 && $daysUntil <= 5 && $candidatesInPipeline > 0 && ! $hasFinal,
        ];
    }
}
