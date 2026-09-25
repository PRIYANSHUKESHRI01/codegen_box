<?php

namespace App\Services;

use App\Models\ActivityLog;
use App\Models\College;
use App\Models\Company;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

/**
 * The one write path for subscription state, mirroring ActivityLog::record()
 * being the one write path for audit rows — every activation, renewal or
 * plan change (individual or institutional) goes through here so "how a
 * subscription gets created" is never duplicated across controllers.
 */
class SubscriptionService
{
    public function __construct(private LeadAssignmentService $leadAssignment) {}

    /**
     * Every student gets a non-expiring free plan the moment their account
     * exists, regardless of how it was created (self-registration, admin
     * storeUser, bulk CSV import, seeders) — see the User::created listener
     * in AppServiceProvider::boot(). Idempotent: a user who already has one
     * is left untouched.
     */
    public function ensureDefaultIndividualPlan(User $user): ?Subscription
    {
        if ($user->activeSubscription() !== null) {
            return null;
        }

        $freePlan = Plan::where('audience', Plan::AUDIENCE_INDIVIDUAL)
            ->where('monthly_price', 0)
            ->first();

        if ($freePlan === null) {
            return null;
        }

        return $this->activate($user, $freePlan);
    }

    /**
     * Self-serve individual activation — the instant "checkout" stand-in
     * used by POST /me/subscription until a real payment gateway exists.
     *
     * A Mellow Direct lead (see User::isMellowDirectLead()) buying a real
     * paid plan — never the free plan, so a self-serve downgrade-back-to-free
     * never counts — is the lead-to-customer conversion moment: it flips
     * lead_status to "converted" and hands servicing ownership off from
     * Marketing to Mellow Internal. See LeadAssignmentService::convertLead().
     */
    public function subscribeIndividual(User $user, Plan $plan): Subscription
    {
        $subscription = $this->activate($user, $plan);

        ActivityLog::record(
            $user,
            'Subscribed to a plan',
            'Plan',
            $plan->name,
            ['plan_code' => $plan->code]
        );

        if ($user->isMellowDirectLead() && ! $plan->isFree()) {
            $wasAlreadyConverted = $user->lead_status === User::LEAD_STATUS_CONVERTED;

            $this->leadAssignment->convertLead($user);

            if (! $wasAlreadyConverted) {
                ActivityLog::record(
                    $user,
                    'Converted from lead to paying customer',
                    'User',
                    $user->name,
                    ['plan_code' => $plan->code]
                );
            }
        }

        return $subscription;
    }

    /**
     * Admin-assigned institutional purchase/renewal/change — a college
     * "buys the whole sandbox" through a sales conversation, so this is
     * only ever called by Mellow staff (AdminController), never self-serve.
     * Also syncs College::tier so every existing UI that already reads
     * college->tier keeps showing the right label.
     */
    public function assignInstitutionPlan(College $college, Plan $plan, User $actor): Subscription
    {
        $subscription = $this->activate($college, $plan);

        if ($college->tier !== $plan->name) {
            $college->tier = $plan->name;
            $college->save();
        }

        ActivityLog::record(
            $actor,
            'Assigned an institution plan',
            'College',
            $college->name,
            ['plan_code' => $plan->code]
        );

        return $subscription;
    }

    /**
     * Admin-assigned company hiring-tenant purchase/renewal/change —
     * mirrors assignInstitutionPlan(), Ops-only, never self-serve. No
     * `tier` sync (Company has no tier field the way College does).
     */
    public function assignCompanyPlan(Company $company, Plan $plan, User $actor): Subscription
    {
        $subscription = $this->activate($company, $plan);

        ActivityLog::record(
            $actor,
            'Assigned a company hiring plan',
            'Company',
            $company->name,
            ['plan_code' => $plan->code]
        );

        return $subscription;
    }

    /**
     * Supersedes any existing active subscription for this subscriber and
     * creates the new one. Shared by both the individual and institutional
     * paths above — a college and a user are activated identically, they
     * just differ in who is allowed to call it and what happens alongside.
     */
    private function activate(Model $subscriber, Plan $plan): Subscription
    {
        return DB::transaction(function () use ($subscriber, $plan) {
            $subscriber->subscriptions()
                ->where('status', Subscription::STATUS_ACTIVE)
                ->update(['status' => Subscription::STATUS_CANCELED, 'canceled_at' => now()]);

            return $subscriber->subscriptions()->create([
                'plan_id' => $plan->id,
                'status' => Subscription::STATUS_ACTIVE,
                'started_at' => now(),
                'current_period_end' => $plan->duration_days !== null ? now()->addDays($plan->duration_days) : null,
            ]);
        });
    }

    /**
     * Flips past-due active subscriptions to expired. The days-remaining
     * countdown shown to users is computed live from dates regardless of
     * this — it exists for eventual access-gating, run daily via the
     * subscriptions:expire artisan command.
     */
    public function expireDue(): int
    {
        return Subscription::where('status', Subscription::STATUS_ACTIVE)
            ->whereNotNull('current_period_end')
            ->where('current_period_end', '<', now())
            ->update(['status' => Subscription::STATUS_EXPIRED]);
    }
}
