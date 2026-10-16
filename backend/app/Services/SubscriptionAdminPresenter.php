<?php

namespace App\Services;

use App\Models\College;
use App\Models\Company;
use App\Models\Subscription;
use App\Models\User;

/**
 * How a subscription is described to the superadmin: one row of the global
 * Subscriptions list and one line of a user's plan history. Built in one place
 * so the two screens can never disagree about what "active", "complimentary" or
 * "who gave it" means.
 *
 * Expects `plan` and `subscriber` to be loaded (the callers eager-load them), so
 * describing a page of rows costs no query per row.
 */
class SubscriptionAdminPresenter
{
    /** @return array<string, mixed> */
    public function row(Subscription $subscription): array
    {
        $meta = $subscription->meta ?? [];
        $plan = $subscription->plan;
        $state = $subscription->state();
        $source = $subscription->source();
        $paid = $subscription->pricePaid();

        return [
            'id' => $subscription->id,
            'state' => $state,
            'plan' => $plan ? [
                'code' => $plan->code,
                'name' => $plan->name,
                'audience' => $plan->audience,
                'kind' => $plan->kind,
                'is_free' => $plan->isFree() && $plan->audience === 'individual',
            ] : null,
            'subscriber' => $this->subscriber($subscription),
            'source' => $source,
            'is_trial' => (bool) $subscription->is_trial,
            'started_at' => $subscription->started_at,
            'current_period_end' => $subscription->current_period_end,
            'days_remaining' => $state === Subscription::STATUS_ACTIVE ? $subscription->daysRemaining() : 0,
            'canceled_at' => $subscription->canceled_at,
            'price_paid' => $paid,
            // Free of charge to the subscriber: given by hand with nothing received.
            'complimentary' => $source === Subscription::SOURCE_ADMIN_GRANT && ($paid === null || $paid === 0),
            'paid_through_gateway' => ! empty($meta['gateway_payment_id']),
            'payment_reference' => $meta['payment_reference'] ?? null,
            'granted_by' => $meta['granted_by_name'] ?? null,
            'reason' => $meta['reason'] ?? null,
            'canceled_by' => $meta['canceled_by_name'] ?? null,
            'cancel_reason' => $meta['cancel_reason'] ?? null,
            'extensions' => count($meta['extensions'] ?? []),
            // Only a running plan that has an end date can be extended; only a running one can be cancelled.
            'can_extend' => $state === Subscription::STATUS_ACTIVE && $subscription->current_period_end !== null,
            'can_cancel' => $subscription->status === Subscription::STATUS_ACTIVE && ! $this->isFreeDefault($subscription),
        ];
    }

    /**
     * The free Coder row every student starts on. It is the floor, not something
     * to cancel — cancelling it would just put the same row back.
     */
    private function isFreeDefault(Subscription $subscription): bool
    {
        return $subscription->subscriber_type === User::class
            && $subscription->plan?->isFree() === true
            && $subscription->plan?->kind === 'base';
    }

    /** @return array{type: string, id: int|null, name: string, email: ?string, detail: ?string} */
    private function subscriber(Subscription $subscription): array
    {
        $subscriber = $subscription->subscriber;

        return match (true) {
            $subscriber instanceof User => [
                'type' => 'user',
                'id' => $subscriber->id,
                'name' => $subscriber->name,
                'email' => $subscriber->email,
                'detail' => $subscriber->college?->name,
            ],
            $subscriber instanceof College => [
                'type' => 'college',
                'id' => $subscriber->id,
                'name' => $subscriber->name,
                'email' => null,
                'detail' => $subscriber->short_code,
            ],
            $subscriber instanceof Company => [
                'type' => 'company',
                'id' => $subscriber->id,
                'name' => $subscriber->name,
                'email' => null,
                'detail' => $subscriber->industry,
            ],
            // The subscriber was deleted but its history row remains (polymorphic: no foreign key to cascade).
            default => ['type' => 'deleted', 'id' => null, 'name' => 'Deleted account', 'email' => null, 'detail' => null],
        };
    }
}
