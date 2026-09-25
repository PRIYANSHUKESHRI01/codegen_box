<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DriveCollegeMapping extends Model
{
    use HasFactory;

    /** Awaiting the college's TPO to approve or decline — see AdminPlacementDriveController::mapColleges(). Never active. */
    public const STATUS_PENDING = 'pending';

    /** Live — either a TPO's own self-map/campus drive (implicit consent) or a Mellow proposal the TPO explicitly approved. */
    public const STATUS_APPROVED = 'approved';

    /** A TPO explicitly rejected a Mellow-proposed mapping. Never active; Mellow may re-propose, which resets this back to pending. */
    public const STATUS_DECLINED = 'declined';

    public const STATUSES = [
        self::STATUS_PENDING,
        self::STATUS_APPROVED,
        self::STATUS_DECLINED,
    ];

    protected $fillable = [
        'placement_drive_id',
        'college_id',
        'min_cgpa_override',
        'max_backlogs_override',
        'eligible_branches_override',
        'mapped_by',
        'mapped_at',
        'unmapped_at',
        'is_active',
        'status',
        'approved_by',
        'approved_at',
        'declined_at',
    ];

    protected function casts(): array
    {
        return [
            'eligible_branches_override' => 'array',
            'min_cgpa_override' => 'decimal:2',
            'mapped_at' => 'datetime',
            'unmapped_at' => 'datetime',
            'is_active' => 'boolean',
            'approved_at' => 'datetime',
            'declined_at' => 'datetime',
        ];
    }

    public function placementDrive(): BelongsTo
    {
        return $this->belongsTo(PlacementDrive::class);
    }

    public function college(): BelongsTo
    {
        return $this->belongsTo(College::class);
    }

    public function mappedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'mapped_by');
    }

    public function approvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function isPending(): bool
    {
        return $this->status === self::STATUS_PENDING;
    }

    public function isApproved(): bool
    {
        return $this->status === self::STATUS_APPROVED;
    }

    /** Whether the company itself (rather than Mellow Ops staff) proposed this mapping — see DriveMappingProposalMail's attribution branch. */
    public function proposedByCompany(): bool
    {
        return $this->mappedBy?->role === User::ROLE_ADMIN_COMPANY;
    }

    /**
     * Resolve this college's actual eligibility requirements for the drive:
     * a per-college override if the TPO set one, otherwise the drive's own
     * baseline. Centralized here so student- and TPO-facing controllers
     * never duplicate the override-vs-base fallback logic.
     */
    public function effectiveEligibility(): array
    {
        $base = $this->placementDrive->baseEligibility();

        return [
            'min_cgpa' => $this->min_cgpa_override ?? $base['min_cgpa'],
            'max_backlogs' => $this->max_backlogs_override ?? $base['max_backlogs'],
            'eligible_branches' => $this->eligible_branches_override ?? $base['eligible_branches'],
        ];
    }
}
