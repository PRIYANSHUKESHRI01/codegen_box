<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * The real placement pipeline — one row per student per drive they're
 * tracked against, moved through `stage` by their TPO (see
 * DrivePipelineService). `college_id` is a deliberate snapshot, set once
 * at creation from the student's college_id and never re-synced — same
 * "what was true at the time" idiom ActivityLog already uses, so a report
 * never retroactively reclassifies a past application if a student's
 * college is corrected later.
 */
class DriveApplication extends Model
{
    public const STAGE_REGISTERED = 'registered';

    public const STAGE_ONLINE_TEST = 'online_test';

    public const STAGE_TECHNICAL_INTERVIEW = 'technical_interview';

    public const STAGE_HR_ROUND = 'hr_round';

    public const STAGE_OFFER_EXTENDED = 'offer_extended';

    public const STAGE_OFFER_ACCEPTED = 'offer_accepted';

    public const STAGE_REJECTED = 'rejected';

    public const STAGE_WITHDRAWN = 'withdrawn';

    public const STAGES = [
        self::STAGE_REGISTERED,
        self::STAGE_ONLINE_TEST,
        self::STAGE_TECHNICAL_INTERVIEW,
        self::STAGE_HR_ROUND,
        self::STAGE_OFFER_EXTENDED,
        self::STAGE_OFFER_ACCEPTED,
        self::STAGE_REJECTED,
        self::STAGE_WITHDRAWN,
    ];

    /** Closed records — a transition into any of these can never be transitioned out of through the normal endpoint. */
    public const TERMINAL_STAGES = [
        self::STAGE_OFFER_ACCEPTED,
        self::STAGE_REJECTED,
        self::STAGE_WITHDRAWN,
    ];

    protected $fillable = [
        'placement_drive_id',
        'user_id',
        'college_id',
        'stage',
        'stage_updated_at',
        'stage_updated_by',
        'ctc_offered',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'stage_updated_at' => 'datetime',
            'ctc_offered' => 'decimal:2',
        ];
    }

    public function placementDrive(): BelongsTo
    {
        return $this->belongsTo(PlacementDrive::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function college(): BelongsTo
    {
        return $this->belongsTo(College::class);
    }

    public function stageUpdatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'stage_updated_by');
    }

    public function isTerminal(): bool
    {
        return in_array($this->stage, self::TERMINAL_STAGES, true);
    }

    /** One source of truth for a human-readable stage name, shared by every surface that displays a stage (TPO ATS panel, student-facing status). */
    public static function stageLabel(string $stage): string
    {
        return match ($stage) {
            self::STAGE_REGISTERED => 'Registered',
            self::STAGE_ONLINE_TEST => 'Online Test',
            self::STAGE_TECHNICAL_INTERVIEW => 'Technical Interview',
            self::STAGE_HR_ROUND => 'HR Round',
            self::STAGE_OFFER_EXTENDED => 'Offer Extended',
            self::STAGE_OFFER_ACCEPTED => 'Offer Accepted',
            self::STAGE_REJECTED => 'Rejected',
            self::STAGE_WITHDRAWN => 'Withdrawn',
            default => $stage,
        };
    }
}
