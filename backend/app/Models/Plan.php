<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Plan extends Model
{
    public const AUDIENCE_INDIVIDUAL = 'individual';

    public const AUDIENCE_INSTITUTION = 'institution';

    /** A company hiring tenant's plan — kept distinct from AUDIENCE_INSTITUTION even though the subscription mechanics are identical, since hiring tiers will eventually need their own feature/seat caps (e.g. active job openings) rather than a college's per-student coverage. */
    public const AUDIENCE_COMPANY = 'company';

    protected $fillable = [
        'code',
        'name',
        'audience',
        'monthly_price',
        'annual_price',
        'duration_days',
        'is_active',
        'sort_order',
        'max_practice_problems_per_day',
        'max_mock_interviews_per_day',
        'drive_access',
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
            'drive_access' => 'boolean',
        ];
    }

    public function subscriptions(): HasMany
    {
        return $this->hasMany(Subscription::class);
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
