<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A hiring partner's relationship with one Talent Pool candidate — see the
 * creating migration's docblock. One row per (candidate, company) pair;
 * every action (interest/schedule interview/hire/decline) transitions the
 * same row rather than creating a new one.
 */
class TalentPoolInquiry extends Model
{
    public const STATUS_INTERESTED = 'interested';

    public const STATUS_INTERVIEW_SCHEDULED = 'interview_scheduled';

    public const STATUS_INTERVIEW_COMPLETED = 'interview_completed';

    public const STATUS_HIRED = 'hired';

    public const STATUS_DECLINED_BY_COMPANY = 'declined_by_company';

    public const STATUS_DECLINED_BY_CANDIDATE = 'declined_by_candidate';

    public const STATUS_WITHDRAWN = 'withdrawn';

    public const STATUSES = [
        self::STATUS_INTERESTED,
        self::STATUS_INTERVIEW_SCHEDULED,
        self::STATUS_INTERVIEW_COMPLETED,
        self::STATUS_HIRED,
        self::STATUS_DECLINED_BY_COMPANY,
        self::STATUS_DECLINED_BY_CANDIDATE,
        self::STATUS_WITHDRAWN,
    ];

    /** Closed records — matches DriveApplication::TERMINAL_STAGES' convention. */
    public const TERMINAL_STATUSES = [
        self::STATUS_HIRED,
        self::STATUS_DECLINED_BY_COMPANY,
        self::STATUS_DECLINED_BY_CANDIDATE,
        self::STATUS_WITHDRAWN,
    ];

    public const MODE_ONLINE = 'online';

    public const MODE_OFFLINE = 'offline';

    public const MODES = [self::MODE_ONLINE, self::MODE_OFFLINE];

    protected $fillable = [
        'talent_pool_candidate_id',
        'company_id',
        'initiated_by',
        'status',
        'interview_scheduled_at',
        'interview_mode',
        'interview_location',
        'interview_notes',
        'responded_at',
        'ctc_offered',
        'hired_at',
    ];

    protected function casts(): array
    {
        return [
            'interview_scheduled_at' => 'datetime',
            'responded_at' => 'datetime',
            'ctc_offered' => 'decimal:2',
            'hired_at' => 'datetime',
        ];
    }

    public function candidate(): BelongsTo
    {
        return $this->belongsTo(TalentPoolCandidate::class, 'talent_pool_candidate_id');
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function initiatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'initiated_by');
    }

    public function messages(): HasMany
    {
        return $this->hasMany(TalentPoolMessage::class)->orderByDesc('created_at');
    }

    public function isTerminal(): bool
    {
        return in_array($this->status, self::TERMINAL_STATUSES, true);
    }

    /** One source of truth for a human-readable status name — mirrors DriveApplication::stageLabel(). */
    public static function statusLabel(string $status): string
    {
        return match ($status) {
            self::STATUS_INTERESTED => 'Interested',
            self::STATUS_INTERVIEW_SCHEDULED => 'HR Interview Scheduled',
            self::STATUS_INTERVIEW_COMPLETED => 'Interview Completed',
            self::STATUS_HIRED => 'Hired',
            self::STATUS_DECLINED_BY_COMPANY => 'Declined by Company',
            self::STATUS_DECLINED_BY_CANDIDATE => 'Declined by Candidate',
            self::STATUS_WITHDRAWN => 'Withdrawn',
            default => $status,
        };
    }
}
