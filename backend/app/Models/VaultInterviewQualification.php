<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Tracks a student's technical interview qualification progression for the Mellow Vault.
 *
 * Each qualification track is tied to a specific tech stack (e.g., laravel, react_nextjs).
 * Candidates must complete a 3-set assessment series. The average score across all 3 sets
 * must meet or exceed 60% (PASSING_THRESHOLD).
 *
 * If the average is below 60%, the student is given a new distinct series of 3 sets for their
 * next attempt (up to 3 attempts total).
 *
 * If all 3 attempts fail, the candidate enters a 45-day cooldown period during which they are
 * directed to practice on AptRun's problem bank, drills, and practice labs before re-qualifying.
 */
class VaultInterviewQualification extends Model
{
    public const STATUS_IN_PROGRESS = 'in_progress';
    public const STATUS_QUALIFIED = 'qualified';
    public const STATUS_COOLING_DOWN = 'cooling_down';

    public const PASSING_THRESHOLD = 60.0;
    public const MAX_ATTEMPTS = 3;
    public const COOLDOWN_DAYS = 45;

    protected $fillable = [
        'user_id',
        'stack_key',
        'role_key',
        'current_attempt',
        'max_attempts',
        'status',
        'active_series_id',
        'series_scores',
        'series_average',
        'attempt_history',
        'admin_log',
        'attempt_offset',
        'cycle_start',
        'qualified_at',
        'qualified_by_admin_id',
        'cooldown_until',
    ];

    protected $casts = [
        'current_attempt' => 'integer',
        'max_attempts' => 'integer',
        'series_scores' => 'array',
        'series_average' => 'float',
        'attempt_history' => 'array',
        'admin_log' => 'array',
        'attempt_offset' => 'integer',
        'cycle_start' => 'integer',
        'qualified_at' => 'datetime',
        'cooldown_until' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Determine if candidate is currently cooling down.
     * If the cooldown has naturally expired, returns false and can transition.
     */
    public function isCoolingDown(): bool
    {
        if ($this->status !== self::STATUS_COOLING_DOWN || ! $this->cooldown_until) {
            return false;
        }

        return Carbon::now()->lt($this->cooldown_until);
    }

    /**
     * Determine if candidate has achieved qualified status.
     */
    public function isQualified(): bool
    {
        return $this->status === self::STATUS_QUALIFIED;
    }

    /**
     * Get remaining days until cooldown ends (0 if not in cooldown or expired).
     */
    public function getRemainingCooldownDays(): int
    {
        if (! $this->isCoolingDown()) {
            return 0;
        }

        return (int) Carbon::now()->diffInDays($this->cooldown_until, false);
    }

    /**
     * Get remaining hours until cooldown ends.
     */
    public function getRemainingCooldownHours(): int
    {
        if (! $this->isCoolingDown()) {
            return 0;
        }

        return (int) Carbon::now()->diffInHours($this->cooldown_until, false);
    }
}

