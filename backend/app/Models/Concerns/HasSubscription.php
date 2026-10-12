<?php

namespace App\Models\Concerns;

use App\Models\Plan;
use App\Models\Subscription;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Relations\MorphMany;

/**
 * Shared by User (individual/self-serve plans) and College (institutional,
 * admin-assigned plans) — both are "subscribers" against the same
 * polymorphic subscriptions table, and both need the exact same "what's my
 * current plan" lookup.
 *
 * A subscriber holds at most ONE active *base* subscription (their plan) and,
 * separately, at most one active row per *add-on* (Plan::KIND_ADDON, e.g.
 * Project Lab). activeSubscription() is deliberately base-only: it is read by
 * ~16 call sites that mean "which plan governs this account", and an add-on
 * row quietly answering that question would change the practice limits,
 * seat caps and drive access of every student who buys one.
 */
trait HasSubscription
{
    public function subscriptions(): MorphMany
    {
        return $this->morphMany(Subscription::class, 'subscriber');
    }

    /**
     * The most recent BASE subscription still in the `active` status, with
     * its plan eager-loaded. Does not itself check current_period_end —
     * callers that need "is it actually still in date" should use
     * Subscription::isActive()/daysRemaining() on the result.
     */
    public function activeSubscription(): ?Subscription
    {
        return $this->subscriptions()
            ->where('status', Subscription::STATUS_ACTIVE)
            ->whereHas('plan', fn ($q) => $q->where('kind', Plan::KIND_BASE))
            ->latest('started_at')
            ->latest('id')
            ->with('plan')
            ->first();
    }

    /**
     * Add-on subscriptions that are active AND still in date, newest first.
     * Unlike activeSubscription() this does check the period end, because an
     * add-on grants a paid feature outright — an expired-but-not-yet-swept
     * row (subscriptions:expire runs daily) must not keep it unlocked.
     *
     * @return Collection<int, Subscription>
     */
    public function activeAddonSubscriptions(): Collection
    {
        return $this->subscriptions()
            ->where('status', Subscription::STATUS_ACTIVE)
            ->whereHas('plan', fn ($q) => $q->where('kind', Plan::KIND_ADDON))
            ->latest('started_at')
            ->latest('id')
            ->with('plan')
            ->get()
            ->filter(fn (Subscription $s) => $s->isActive())
            ->values();
    }

    public function activeAddonSubscription(string $planCode): ?Subscription
    {
        return $this->activeAddonSubscriptions()->first(fn (Subscription $s) => $s->plan?->code === $planCode);
    }
}
