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
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

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
     * Self-serve checkout for one cart: a base plan, add-ons, or both,
     * priced by PurchaseQuoteService (pass its result in — never a price from
     * the request). Each line becomes its own subscription row, so each
     * add-on has its own period and can be renewed or lapse independently;
     * `meta` records what was actually charged per line plus a shared
     * `purchase_ref`, which is the reconciliation key until a payment
     * gateway supplies its own order id.
     *
     * The buyer row is locked for the duration so a double-click or two
     * tabs cannot create two overlapping checkouts for the same student.
     * Still the instant "checkout" stand-in — no money moves yet.
     *
     * @param  array{lines: list<array{code: string, kind: string, list_price: int, discount: int, price: int}>, total: int}  $quote
     * @return list<Subscription>
     */
    public function purchase(User $user, array $quote): array
    {
        $reference = (string) Str::uuid();

        $subscriptions = DB::transaction(function () use ($user, $quote, $reference) {
            User::whereKey($user->id)->lockForUpdate()->first();

            $created = [];

            foreach ($quote['lines'] as $line) {
                $plan = Plan::where('code', $line['code'])->firstOrFail();

                $created[] = $this->activate($user, $plan, null, [
                    'purchase_ref' => $reference,
                    'list_price' => $line['list_price'],
                    'discount' => $line['discount'],
                    'price_paid' => $line['price'],
                    'quote_total' => $quote['total'],
                ]);

                ActivityLog::record(
                    $user,
                    $plan->isAddon() ? 'Purchased an add-on' : 'Subscribed to a plan',
                    $plan->isAddon() ? 'Add-on' : 'Plan',
                    $plan->name,
                    ['plan_code' => $plan->code, 'price_paid' => $line['price'], 'discount' => $line['discount'], 'purchase_ref' => $reference]
                );
            }

            return $created;
        });

        // A lead that pays for anything — a plan or Project Lab alone — is
        // the lead-to-customer conversion moment (see subscribeIndividual).
        if ($quote['total'] > 0 && $user->isMellowDirectLead()) {
            $wasAlreadyConverted = $user->lead_status === User::LEAD_STATUS_CONVERTED;

            $this->leadAssignment->convertLead($user);

            if (! $wasAlreadyConverted) {
                ActivityLog::record(
                    $user,
                    'Converted from lead to paying customer',
                    'User',
                    $user->name,
                    ['purchase_ref' => $reference, 'total' => $quote['total']]
                );
            }
        }

        return $subscriptions;
    }

    /**
     * Admin-assigned institutional purchase/renewal/change — a college
     * "buys the whole sandbox" through a sales conversation, so this is
     * only ever called by Mellow staff (AdminController), never self-serve.
     * Also syncs College::tier so every existing UI that already reads
     * college->tier keeps showing the right label.
     *
     * $trialDays, when given, overrides the plan's own `duration_days` with
     * a superadmin-chosen demo length and flags the resulting subscription
     * `is_trial` — see SubscriptionService::activate(). Omit it (the
     * default) for a normal paid/renewed assignment.
     */
    public function assignInstitutionPlan(College $college, Plan $plan, User $actor, ?int $trialDays = null): Subscription
    {
        $subscription = $this->activate($college, $plan, $trialDays);

        if ($college->tier !== $plan->name) {
            $college->tier = $plan->name;
            $college->save();
        }

        ActivityLog::record(
            $actor,
            $trialDays !== null ? 'Started a demo subscription' : 'Assigned an institution plan',
            'College',
            $college->name,
            $trialDays !== null
                ? ['plan_code' => $plan->code, 'trial_days' => $trialDays]
                : ['plan_code' => $plan->code]
        );

        return $subscription;
    }

    /**
     * A negotiated, college-specific seat count that doesn't match any of
     * the three fixed catalog tiers (Standard/Pro Campus/Academic
     * Enterprise) — the "talk to sales, we agreed on 845 seats" case.
     * Still just a Plan row under the hood (every enforcement point already
     * reads College::studentLimit() -> activePlan()->max_students, so
     * nothing downstream needs to know this plan is "custom"), but one
     * dedicated row per college via updateOrCreate rather than a fresh row
     * every time — re-adjusting a college's custom seat count later reuses
     * the same plan instead of leaving orphaned rows behind.
     *
     * See assignInstitutionPlan() for what $trialDays does.
     */
    public function assignCustomInstitutionPlan(College $college, int $maxStudents, ?int $annualPrice, User $actor, ?int $trialDays = null): Subscription
    {
        $plan = Plan::updateOrCreate(
            ['code' => "custom-college-{$college->id}"],
            [
                'name' => 'Custom',
                'audience' => Plan::AUDIENCE_INSTITUTION,
                'annual_price' => $annualPrice,
                'duration_days' => 365,
                'is_active' => true,
                'max_students' => $maxStudents,
                'drive_access' => true,
            ]
        );

        return $this->assignInstitutionPlan($college, $plan, $actor, $trialDays);
    }

    /**
     * Live-adjusts ONLY a college's seat cap — does not call activate(), so
     * it never touches started_at/current_period_end/is_trial. A superadmin
     * nudging a seat count up or down from the dashboard should never reset
     * someone's renewal date or quietly cancel a running demo countdown,
     * which is exactly what assignCustomInstitutionPlan()/activate() would
     * do if reused here.
     *
     * Converts the college onto its own dedicated custom plan row (same
     * "custom-college-{id}" convention as assignCustomInstitutionPlan),
     * cloning every entitlement field off whatever plan currently governs
     * the college — not hardcoded — so only max_students actually changes.
     */
    public function adjustSeatLimit(College $college, int $maxStudents, User $actor): Subscription
    {
        return DB::transaction(function () use ($college, $maxStudents, $actor) {
            $subscription = $college->activeSubscription();

            if ($subscription === null || ! $subscription->isActive()) {
                throw ValidationException::withMessages([
                    'max_students' => ["{$college->name} has no active subscription to adjust. Assign a plan first."],
                ]);
            }

            $currentPlan = $subscription->plan;
            $previousMax = $currentPlan->max_students;

            $plan = Plan::updateOrCreate(
                ['code' => "custom-college-{$college->id}"],
                [
                    'name' => 'Custom',
                    'audience' => Plan::AUDIENCE_INSTITUTION,
                    'annual_price' => $currentPlan->annual_price,
                    'duration_days' => $currentPlan->duration_days,
                    'is_active' => true,
                    'max_students' => $maxStudents,
                    'drive_access' => $currentPlan->drive_access,
                    'max_practice_problems_per_day' => $currentPlan->max_practice_problems_per_day,
                    'max_mock_interviews_per_day' => $currentPlan->max_mock_interviews_per_day,
                    'max_learning_centre_ai_attempts_per_day' => $currentPlan->max_learning_centre_ai_attempts_per_day,
                    'project_lab_access' => $currentPlan->project_lab_access,
                    'max_workspace_hours_per_month' => $currentPlan->max_workspace_hours_per_month,
                    'max_active_projects' => $currentPlan->max_active_projects,
                ]
            );

            $subscription->update(['plan_id' => $plan->id]);

            if ($college->tier !== 'Custom') {
                $college->tier = 'Custom';
                $college->save();
            }

            ActivityLog::record(
                $actor,
                "Adjusted a college's seat limit",
                'College',
                $college->name,
                ['previous_max_students' => $previousMax, 'max_students' => $maxStudents]
            );

            return $subscription->fresh('plan');
        });
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
     *
     * $trialDays overrides the plan's own `duration_days` with a shorter,
     * superadmin-chosen window and flags the row `is_trial` — used for demo
     * college onboarding (AdminController::storeCollege). Null (the
     * default) keeps the existing behavior exactly: period end derived from
     * the plan, not flagged as a trial.
     */
    private function activate(Model $subscriber, Plan $plan, ?int $trialDays = null, array $meta = []): Subscription
    {
        return DB::transaction(function () use ($subscriber, $plan, $trialDays, $meta) {
            // Supersede only what this activation actually replaces: a plan
            // change replaces the current BASE plan (and must never cancel a
            // Project Lab add-on the student also paid for); renewing an
            // add-on replaces only that same add-on.
            $previous = $subscriber->subscriptions()
                ->where('status', Subscription::STATUS_ACTIVE)
                ->whereHas('plan', fn ($q) => $plan->isAddon()
                    ? $q->where('id', $plan->id)
                    : $q->where('kind', Plan::KIND_BASE))
                ->get();

            if ($previous->isNotEmpty()) {
                $subscriber->subscriptions()
                    ->whereKey($previous->modelKeys())
                    ->update(['status' => Subscription::STATUS_CANCELED, 'canceled_at' => now()]);
            }

            // Renewing an add-on early must not forfeit days already paid
            // for: the new period stacks on the old end. (A base plan keeps
            // its long-standing behaviour — a fresh period from today.)
            $periodStart = now();
            if ($plan->isAddon() && $trialDays === null) {
                $stillPaidUntil = $previous
                    ->map(fn (Subscription $s) => $s->current_period_end)
                    ->filter(fn ($end) => $end !== null && $end->isFuture())
                    ->max();

                if ($stillPaidUntil !== null) {
                    $periodStart = $stillPaidUntil;
                }
            }

            return $subscriber->subscriptions()->create([
                'plan_id' => $plan->id,
                'status' => Subscription::STATUS_ACTIVE,
                'started_at' => now(),
                'current_period_end' => $trialDays !== null
                    ? now()->addDays($trialDays)
                    : ($plan->duration_days !== null ? $periodStart->copy()->addDays($plan->duration_days) : null),
                'is_trial' => $trialDays !== null,
                'meta' => $meta ?: null,
            ]);
        });
    }

    /**
     * Flips past-due active subscriptions to expired. The days-remaining
     * countdown shown to users is computed live from dates regardless of
     * this. Enforcement itself (blocking new student creation once a
     * college has no active subscription) reads `Subscription::isActive()`
     * directly — see College::hasActiveSubscription() and its call
     * sites — so it takes effect immediately on the date, not only once
     * this daily job flips the status row; this command exists to keep
     * `status`/admin reporting accurate, not as the enforcement mechanism
     * itself.
     */
    public function expireDue(): int
    {
        return Subscription::where('status', Subscription::STATUS_ACTIVE)
            ->whereNotNull('current_period_end')
            ->where('current_period_end', '<', now())
            ->update(['status' => Subscription::STATUS_EXPIRED]);
    }
}
