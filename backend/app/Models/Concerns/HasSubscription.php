<?php

namespace App\Models\Concerns;

use App\Models\Subscription;
use Illuminate\Database\Eloquent\Relations\MorphMany;

/**
 * Shared by User (individual/self-serve plans) and College (institutional,
 * admin-assigned plans) — both are "subscribers" against the same
 * polymorphic subscriptions table, and both need the exact same "what's my
 * current plan" lookup.
 */
trait HasSubscription
{
    public function subscriptions(): MorphMany
    {
        return $this->morphMany(Subscription::class, 'subscriber');
    }

    /**
     * The most recent subscription still in the `active` status, with its
     * plan eager-loaded. Does not itself check current_period_end — callers
     * that need "is it actually still in date" should use
     * Subscription::isActive()/daysRemaining() on the result.
     */
    public function activeSubscription(): ?Subscription
    {
        return $this->subscriptions()
            ->where('status', Subscription::STATUS_ACTIVE)
            ->latest('started_at')
            ->with('plan')
            ->first();
    }
}
