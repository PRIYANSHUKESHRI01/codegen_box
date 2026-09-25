<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A candidate's current standing in the shared Talent Pool marketplace — see
 * the creating migration's docblock for the full visibility_status state
 * machine. Written only by TalentPoolQualificationService (on qualification)
 * and StudentTalentPoolController/AdminTalentPoolController/
 * CompanyTalentPoolController (on consent/visibility/hire changes).
 */
class TalentPoolCandidate extends Model
{
    public const STATUS_PENDING_CONSENT = 'pending_consent';

    public const STATUS_VISIBLE = 'visible';

    public const STATUS_HIDDEN_BY_CANDIDATE = 'hidden_by_candidate';

    public const STATUS_HIDDEN_BY_MELLOW = 'hidden_by_mellow';

    public const STATUS_HIRED = 'hired';

    public const STATUSES = [
        self::STATUS_PENDING_CONSENT,
        self::STATUS_VISIBLE,
        self::STATUS_HIDDEN_BY_CANDIDATE,
        self::STATUS_HIDDEN_BY_MELLOW,
        self::STATUS_HIRED,
    ];

    protected $fillable = [
        'user_id',
        'source_contest_id',
        'score_percent',
        'qualified_at',
        'visibility_status',
        'consent_given_at',
        'hired_by_company_id',
        'hired_at',
    ];

    protected function casts(): array
    {
        return [
            'score_percent' => 'decimal:2',
            'qualified_at' => 'datetime',
            'consent_given_at' => 'datetime',
            'hired_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function sourceContest(): BelongsTo
    {
        return $this->belongsTo(Contest::class, 'source_contest_id');
    }

    public function hiredByCompany(): BelongsTo
    {
        return $this->belongsTo(Company::class, 'hired_by_company_id');
    }

    public function inquiries(): HasMany
    {
        return $this->hasMany(TalentPoolInquiry::class);
    }

    /** The only status a hiring partner's browse listing ever includes — see CompanyTalentPoolController::index(). */
    public function isBrowsable(): bool
    {
        return $this->visibility_status === self::STATUS_VISIBLE;
    }

    public function isHired(): bool
    {
        return $this->visibility_status === self::STATUS_HIRED;
    }
}
