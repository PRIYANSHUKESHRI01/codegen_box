<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

/**
 * A student's place in the Vault — the pool of students whose readiness score
 * says they are ready to be hired. See the creating migration for the full
 * story; the short version:
 *
 * The row stores PRIMITIVES (eligible? consented? hidden by staff? hired?) and
 * one DERIVED column, `visibility_status`, that every query filters on.
 * resolveStatus() is the only place that derivation is written down, and
 * App\Services\VaultService is the only writer of any of it.
 */
class VaultProfile extends Model
{
    public const STATUS_NOT_READY = 'not_ready';

    /** Ready by score, but the student's plan does not include the Vault (Expert or Grandmaster, or a college plan that covers them). */
    public const STATUS_UPGRADE_REQUIRED = 'upgrade_required';

    public const STATUS_PENDING_CONSENT = 'pending_consent';

    public const STATUS_VISIBLE = 'visible';

    public const STATUS_HIDDEN_BY_CANDIDATE = 'hidden_by_candidate';

    public const STATUS_HIDDEN_BY_MELLOW = 'hidden_by_mellow';

    public const STATUS_HIRED = 'hired';

    public const STATUSES = [
        self::STATUS_NOT_READY,
        self::STATUS_UPGRADE_REQUIRED,
        self::STATUS_PENDING_CONSENT,
        self::STATUS_VISIBLE,
        self::STATUS_HIDDEN_BY_CANDIDATE,
        self::STATUS_HIDDEN_BY_MELLOW,
        self::STATUS_HIRED,
    ];

    public const HIRED_VIA_PARTNER = 'aptrun_partner';

    public const HIRED_VIA_VAULT = 'mellow_vault';

    public const SOURCE_READINESS = 'readiness';

    public const SOURCE_LEGACY_CONTEST = 'legacy_contest';

    /** Cleared a Vault AI Interview qualification series (VaultInterviewQualificationService). */
    public const SOURCE_AI_INTERVIEW = 'ai_interview_series';

    public const SYNC_IDLE = 'idle';

    public const SYNC_PENDING = 'pending';

    public const SYNC_DELIVERED = 'delivered';

    public const SYNC_FAILED = 'failed';

    protected $fillable = [
        'user_id',
        'public_id',
        'visibility_status',
        'is_eligible',
        'readiness_score',
        'peak_readiness',
        'readiness_tier',
        'readiness_components',
        'readiness_version',
        'readiness_profile',
        'readiness_computed_at',
        'qualified_at',
        'eligible_since',
        'left_at',
        'qualification_source',
        'ai_interview_score',
        'ai_interview_stack',
        'ai_interview_role',
        'ai_interview_scores',
        'ai_interview_attempt',
        'ai_interview_qualified_at',
        'consent_given_at',
        'consent_withdrawn_at',
        'hidden_by_staff_at',
        'hidden_by_staff_id',
        'hidden_reason',
        'hired_at',
        'hired_via',
        'hired_by_company_id',
        'hired_employer_name',
        'ready_notified_at',
        'sync_state',
        'sync_sequence',
        'payload_hash',
        'vault_listed_at',
        'last_synced_at',
        'external_id',
    ];

    /** What a company's browse JSON must never carry: the integration plumbing. */
    protected $hidden = [
        'payload_hash',
        'sync_sequence',
        'external_id',
        'hidden_by_staff_id',
        'hidden_reason',
    ];

    protected function casts(): array
    {
        return [
            'is_eligible' => 'boolean',
            'readiness_score' => 'integer',
            'peak_readiness' => 'integer',
            'readiness_components' => 'array',
            'readiness_version' => 'integer',
            'readiness_computed_at' => 'datetime',
            'qualified_at' => 'datetime',
            'eligible_since' => 'datetime',
            'left_at' => 'datetime',
            'legacy_score_percent' => 'decimal:2',
            'ai_interview_score' => 'decimal:2',
            'ai_interview_scores' => 'array',
            'ai_interview_attempt' => 'integer',
            'ai_interview_qualified_at' => 'datetime',
            'consent_given_at' => 'datetime',
            'consent_withdrawn_at' => 'datetime',
            'hidden_by_staff_at' => 'datetime',
            'hired_at' => 'datetime',
            'ready_notified_at' => 'datetime',
            'sync_sequence' => 'integer',
            'vault_listed_at' => 'datetime',
            'last_synced_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (VaultProfile $profile) {
            $profile->public_id ??= (string) Str::ulid();
        });
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function hiredByCompany(): BelongsTo
    {
        return $this->belongsTo(Company::class, 'hired_by_company_id');
    }

    public function hiddenByStaff(): BelongsTo
    {
        return $this->belongsTo(User::class, 'hidden_by_staff_id');
    }

    public function inquiries(): HasMany
    {
        return $this->hasMany(VaultInquiry::class);
    }

    public function interviewQualifications(): HasMany
    {
        return $this->hasMany(VaultInterviewQualification::class, 'user_id', 'user_id');
    }

    /** The only profiles a hiring partner's browse listing ever includes. */
    public function scopeBrowsable(Builder $query): Builder
    {
        return $query->where('vault_profiles.visibility_status', self::STATUS_VISIBLE);
    }

    public function isBrowsable(): bool
    {
        return $this->visibility_status === self::STATUS_VISIBLE;
    }

    public function isHired(): bool
    {
        return $this->visibility_status === self::STATUS_HIRED;
    }

    /** Standing consent: given, and not withdrawn since. */
    public function hasConsent(): bool
    {
        return $this->consent_given_at !== null
            && ($this->consent_withdrawn_at === null || $this->consent_withdrawn_at->lt($this->consent_given_at));
    }

    /**
     * THE rule for who is visible. A pure function of the primitives on this row
     * (and of whether the account is blocked) — so it can be re-run at any time,
     * from anywhere, and always lands on the same answer.
     *
     * Order matters: a hire outranks everything (a hired student is never
     * re-listed); a staff hide outranks the student's own choice; an account that
     * is blocked is treated as hidden by staff; then the score decides whether the
     * student is ready at all; then the plan decides whether being listed is part
     * of what they have (a lapsed Expert plan takes a live student off, and
     * their consent is remembered for when they return); and only then does the
     * student's consent decide between waiting / withdrawn / live.
     */
    public function resolveStatus(bool $accountBlocked = false, bool $hasPlanAccess = true): string
    {
        return match (true) {
            $this->hired_at !== null => self::STATUS_HIRED,
            $this->hidden_by_staff_at !== null || $accountBlocked => self::STATUS_HIDDEN_BY_MELLOW,
            ! $this->is_eligible => self::STATUS_NOT_READY,
            ! $hasPlanAccess => self::STATUS_UPGRADE_REQUIRED,
            $this->consent_given_at === null => self::STATUS_PENDING_CONSENT,
            ! $this->hasConsent() => self::STATUS_HIDDEN_BY_CANDIDATE,
            default => self::STATUS_VISIBLE,
        };
    }

    public static function statusLabel(string $status): string
    {
        return match ($status) {
            self::STATUS_NOT_READY => 'Not Vault-ready yet',
            self::STATUS_UPGRADE_REQUIRED => 'Ready — upgrade to be hired',
            self::STATUS_PENDING_CONSENT => 'Ready — awaiting your consent',
            self::STATUS_VISIBLE => 'Live in the Vault',
            self::STATUS_HIDDEN_BY_CANDIDATE => 'Hidden (your choice)',
            self::STATUS_HIDDEN_BY_MELLOW => 'Under Mellow review',
            self::STATUS_HIRED => 'Hired',
            default => $status,
        };
    }
}
