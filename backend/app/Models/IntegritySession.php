<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * One proctored attempt, as the integrity layer sees it. The surface's own proctoring record (ProctoringSession,
 * SoftSkillProctoringSession, …) still owns the strike count and the lock; this row owns everything the server learned
 * about HOW the attempt went — liveness, device/address binding, the risk score, the evidence and the hash-chained log.
 * See App\Services\Integrity\IntegrityService.
 */
class IntegritySession extends Model
{
    public const SURFACE_CONTEST = 'contest';

    public const SURFACE_INTERVIEW = 'interview';

    public const SURFACE_SOFT_SKILL = 'soft_skill';

    public const SURFACE_CORE_TEST = 'core_test';

    public const SURFACE_STUDY = 'study';

    public const SURFACES = [
        self::SURFACE_CONTEST, self::SURFACE_INTERVIEW, self::SURFACE_SOFT_SKILL, self::SURFACE_CORE_TEST, self::SURFACE_STUDY,
    ];

    public const STATUS_ACTIVE = 'active';

    public const STATUS_LOCKED = 'locked';

    public const STATUS_ENDED = 'ended';

    public const ASSURANCE_WEB = 'web';

    public const ASSURANCE_GUARDIAN = 'guardian';

    protected $fillable = [
        'uuid', 'user_id', 'surface', 'surface_id', 'profile', 'status', 'assurance', 'context',
        'client_instance', 'device_fp', 'device_id', 'bound_ip', 'last_ip', 'bound_ua', 'ips', 'clock_offset_ms',
        'last_batch_id', 'nonce', 'nonce_prev', 'started_at', 'last_beat_at', 'ended_at', 'gap_seconds', 'gap_count',
        'page_state', 'last_incident_at',
        'guardian_link_id', 'guardian_first_at', 'guardian_last_at', 'guardian_gap_seconds',
        'risk_score', 'risk_level', 'flags', 'event_count', 'chain_head',
    ];

    /** The nonces are server-side secrets that must never reach a response by accident. */
    protected $hidden = ['nonce', 'nonce_prev'];

    protected function casts(): array
    {
        return [
            'user_id' => 'integer',
            'surface_id' => 'integer',
            'context' => 'array',
            'ips' => 'array',
            'page_state' => 'array',
            'flags' => 'array',
            'clock_offset_ms' => 'integer',
            'last_batch_id' => 'integer',
            'gap_seconds' => 'integer',
            'gap_count' => 'integer',
            'guardian_gap_seconds' => 'integer',
            'risk_score' => 'integer',
            'event_count' => 'integer',
            'started_at' => 'datetime',
            'last_beat_at' => 'datetime',
            'ended_at' => 'datetime',
            'last_incident_at' => 'datetime',
            'guardian_first_at' => 'datetime',
            'guardian_last_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function events(): HasMany
    {
        return $this->hasMany(IntegrityEvent::class)->orderBy('seq');
    }

    public function evidence(): HasMany
    {
        return $this->hasMany(IntegrityEvidence::class)->orderBy('captured_at');
    }

    public function isActive(): bool
    {
        return $this->status === self::STATUS_ACTIVE;
    }

    public function isLocked(): bool
    {
        return $this->status === self::STATUS_LOCKED;
    }

    public function isEnded(): bool
    {
        return $this->status === self::STATUS_ENDED;
    }
}
