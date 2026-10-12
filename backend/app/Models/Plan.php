<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Plan extends Model
{
    public const AUDIENCE_INDIVIDUAL = 'individual';

    public const AUDIENCE_INSTITUTION = 'institution';

    /** A company hiring tenant's plan — kept distinct from AUDIENCE_INSTITUTION even though the subscription mechanics are identical, since hiring tiers will eventually need their own feature/seat caps (e.g. active job openings) rather than a college's per-student coverage. */
    public const AUDIENCE_COMPANY = 'company';

    /** A plan someone holds as THEIR plan: at most one active per subscriber. Everything that existed before add-ons. */
    public const KIND_BASE = 'base';

    /** An optional module bought on top of (or without) a base plan, e.g. Project Lab. A subscriber can hold one active row per add-on. */
    public const KIND_ADDON = 'addon';

    /** The add-on that unlocks Project Lab. Referenced by the seeder, the quote service and the entitlement check. */
    public const CODE_PROJECT_LAB = 'project-lab';

    protected $fillable = [
        'code',
        'name',
        'audience',
        'kind',
        'monthly_price',
        'annual_price',
        'duration_days',
        'is_active',
        'sort_order',
        'max_practice_problems_per_day',
        'max_mock_interviews_per_day',
        'max_learning_centre_ai_attempts_per_day',
        'drive_access',
        'max_students',
        'project_lab_access',
        'max_workspace_hours_per_month',
        'max_active_projects',
    ];

    protected function casts(): array
    {
        return [
            'monthly_price' => 'integer',
            'annual_price' => 'integer',
            'duration_days' => 'integer',
            'is_active' => 'boolean',
            'sort_order' => 'integer',
            'max_practice_problems_per_day' => 'integer',
            'max_mock_interviews_per_day' => 'integer',
            'max_learning_centre_ai_attempts_per_day' => 'integer',
            'drive_access' => 'boolean',
            'max_students' => 'integer',
            'project_lab_access' => 'boolean',
            'max_workspace_hours_per_month' => 'integer',
            'max_active_projects' => 'integer',
        ];
    }

    public function subscriptions(): HasMany
    {
        return $this->hasMany(Subscription::class);
    }

    public function isAddon(): bool
    {
        return $this->kind === self::KIND_ADDON;
    }

    public function scopeBase(Builder $query): Builder
    {
        return $query->where('kind', self::KIND_BASE);
    }

    public function scopeAddon(Builder $query): Builder
    {
        return $query->where('kind', self::KIND_ADDON);
    }

    /**
     * Individual audience only ever has one free plan (see
     * SubscriptionService::ensureDefaultIndividualPlan) — used to tell a
     * real purchase apart from a self-serve downgrade back to free, e.g.
     * for lead-conversion tracking (LeadAssignmentService::convertLead).
     */
    public function isFree(): bool
    {
        return (int) $this->monthly_price === 0;
    }
}
