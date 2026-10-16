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
            ->where('list_price', 0)
            ->first();

        if ($freePlan === null) {
            return null;
        }

        return $this->activate($user, $freePlan);
    }

    /**
     * Hands over what a student has PAID for: a base plan, add-ons, or both,
     * priced by PurchaseQuoteService (pass its result in — never a price from
     * the request). Each line becomes its own subscription row, so each
     * add-on has its own period and can be renewed or lapse independently;
     * `meta` records what was actually charged per line plus a shared
     * `purchase_ref`.
     *
     * This is the fulfilment step only and charges nothing: its one production
     * caller is Payments\CheckoutService, which calls it after Razorpay has
     * confirmed the money (the browser callback, the webhook and the reconcile
     * job all converge there, exactly once per order). `$payment` carries that
     * order's identifiers so every subscription row can be traced to the
     * payment behind it: `reference` (our order's public id — it becomes the
     * purchase_ref), `payment_order_id`, `gateway`, `gateway_payment_id`.
     * Tests that only need a student on a plan call it without `$payment`.
     *
     * Renewing the plan a student already holds stacks the new term onto the
     * days they have left, so paying early never forfeits paid time. Moving to
     * a different plan starts a fresh term from today.
     *
     * The buyer row is locked for the duration so two simultaneous
     * fulfilments cannot create overlapping subscriptions for one student.
     *
     * @param  array{lines: list<array{code: string, kind: string, list_price: int, discount: int, price: int}>, total: int}  $quote
     * @param  array{reference?: string, payment_order_id?: int, gateway?: string, gateway_payment_id?: string}  $payment
     * @return list<Subscription>
     */
    public function purchase(User $user, array $quote, array $payment = []): array
    {
        $reference = $payment['reference'] ?? (string) Str::uuid();

        $subscriptions = DB::transaction(function () use ($user, $quote, $reference, $payment) {
            User::whereKey($user->id)->lockForUpdate()->first();

            $created = [];

            foreach ($quote['lines'] as $line) {
                $plan = Plan::where('code', $line['code'])->firstOrFail();

                $created[] = $this->activate($user, $plan, null, array_filter([
                    'purchase_ref' => $reference,
                    'list_price' => $line['list_price'],
                    'discount' => $line['discount'],
                    'price_paid' => $line['price'],
                    'quote_total' => $quote['total'],
                    'payment_order_id' => $payment['payment_order_id'] ?? null,
                    'gateway' => $payment['gateway'] ?? null,
                    'gateway_payment_id' => $payment['gateway_payment_id'] ?? null,
                ], fn ($value) => $value !== null), stackRenewal: true);

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
        // the lead-to-customer conversion moment (see LeadAssignmentService::convertLead()).
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

    /** Longest term a superadmin may hand out by hand, in days — five years. A guard against a typo, not a business rule. */
    public const MAX_GRANT_DAYS = 1825;

    /**
     * A superadmin gives a student a paid plan by hand: a complimentary one (a
     * demo, a scholarship, a goodwill gesture) or one paid for outside the
     * gateway (bank transfer, cash). It replaces the plan they hold now and is
     * effective immediately — every limit and lock reads the subscription row on
     * the next request.
     *
     * What this never does is pretend money came in through Razorpay: the row is
     * marked `admin_grant` and `price_paid` is 0 for a complimentary plan (so the
     * overview's recurring-revenue figure leaves it out) or the amount actually
     * received for an offline payment. Only a real payment converts a Mellow
     * Direct lead into a customer; a free gift does not.
     *
     * @param  array{days: int, kind: 'complimentary'|'offline_payment', amount?: ?int, reference?: ?string, reason: string}  $terms
     */
    public function grantIndividualPlan(User $user, Plan $plan, User $actor, array $terms): Subscription
    {
        if ($user->role !== User::ROLE_USER) {
            throw ValidationException::withMessages(['user' => ['Only student accounts hold a personal plan.']]);
        }

        if ($plan->audience !== Plan::AUDIENCE_INDIVIDUAL || $plan->isAddon() || $plan->isFree() || ! $plan->is_active) {
            throw ValidationException::withMessages(['plan_code' => ["{$plan->name} is not a paid plan that can be given to a student."]]);
        }

        $days = (int) $terms['days'];

        if ($days < 1 || $days > self::MAX_GRANT_DAYS) {
            throw ValidationException::withMessages(['days' => ['Choose a term between 1 and '.self::MAX_GRANT_DAYS.' days.']]);
        }

        $offline = $terms['kind'] === 'offline_payment';
        $amount = $offline ? (int) ($terms['amount'] ?? 0) : 0;

        if ($offline && $amount < 1) {
            throw ValidationException::withMessages(['amount' => ['Enter the amount you received, in rupees.']]);
        }

        $replaced = null;

        $subscription = DB::transaction(function () use ($user, $plan, $actor, $terms, $days, $offline, $amount, &$replaced) {
            User::whereKey($user->id)->lockForUpdate()->first();

            $current = $user->activeSubscription();
            $replaced = $current?->plan?->name;

            // Handing out the plan they already hold for a shorter term than they have left would take
            // paid time away. That is an extension, not a grant — and it is never what was meant.
            if ($current !== null
                && $current->isActive()
                && (int) $current->plan_id === (int) $plan->id
                && $current->current_period_end !== null
                && $current->current_period_end->gt(now()->addDays($days))) {
                throw ValidationException::withMessages([
                    'days' => ["They already have {$current->daysRemaining()} days of {$plan->name} left. Use Extend to add time, or choose a longer term."],
                ]);
            }

            return $this->activate($user, $plan, null, array_filter([
                'source' => Subscription::SOURCE_ADMIN_GRANT,
                'complimentary' => ! $offline,
                'price_paid' => $amount,
                'list_price' => $plan->listPrice(),
                'payment_reference' => $offline ? ($terms['reference'] ?? null) : null,
                'granted_by' => $actor->id,
                'granted_by_name' => $actor->name,
                'reason' => $terms['reason'],
                'term_days' => $days,
            ], fn ($value) => $value !== null), termDays: $days);
        });

        ActivityLog::record(
            $actor,
            $offline ? 'Granted a plan against an offline payment' : 'Granted a complimentary plan',
            'User',
            $user->name,
            array_filter([
                'user_id' => $user->id,
                'plan_code' => $plan->code,
                'days' => $days,
                'amount' => $offline ? $amount : null,
                'payment_reference' => $offline ? ($terms['reference'] ?? null) : null,
                'replaced_plan' => $replaced,
                'reason' => $terms['reason'],
            ], fn ($value) => $value !== null)
        );

        if ($offline && $user->isMellowDirectLead()) {
            $this->leadAssignment->convertLead($user);
        }

        app(LifecycleMailService::class)->planGranted($user, $subscription, $days, complimentary: ! $offline);

        return $subscription;
    }

    /**
     * Adds days to a subscription that is still running — a student's, a
     * college's or a company's. It only ever moves the end date later and never
     * touches the plan, price or start, so it is safe to repeat. A plan that has
     * already ended is not revived by this: it has to be granted again, because
     * "extend" on a lapsed row would silently back-date access.
     */
    public function extend(Subscription $subscription, int $days, User $actor, string $reason): Subscription
    {
        if ($days < 1 || $days > self::MAX_GRANT_DAYS) {
            throw ValidationException::withMessages(['days' => ['Choose between 1 and '.self::MAX_GRANT_DAYS.' days.']]);
        }

        $subscription = DB::transaction(function () use ($subscription, $days, $actor, $reason) {
            $locked = Subscription::whereKey($subscription->id)->lockForUpdate()->firstOrFail();

            if ($locked->current_period_end === null) {
                throw ValidationException::withMessages(['subscription' => ['This plan never expires, so there is nothing to extend.']]);
            }

            if (! $locked->isActive()) {
                throw ValidationException::withMessages(['subscription' => ['This plan has already ended. Assign it again instead of extending it.']]);
            }

            $previousEnd = $locked->current_period_end;
            $meta = $locked->meta ?? [];
            $meta['extensions'] = array_merge($meta['extensions'] ?? [], [[
                'days' => $days,
                'by' => $actor->id,
                'by_name' => $actor->name,
                'reason' => $reason,
                'at' => now()->toIso8601String(),
                'from' => $previousEnd->toIso8601String(),
            ]]);

            $locked->forceFill(['current_period_end' => $previousEnd->copy()->addDays($days), 'meta' => $meta])->save();

            return $locked;
        });

        [$type, $label, $context] = $this->describeSubscriber($subscription);

        ActivityLog::record($actor, "Extended a {$type} plan", $type, $label, $context + [
            'plan_code' => $subscription->plan?->code,
            'days' => $days,
            'new_end' => $subscription->current_period_end?->toDateString(),
            'reason' => $reason,
        ]);

        app(LifecycleMailService::class)->planExtended($subscription, $days);

        return $subscription->fresh('plan');
    }

    /**
     * Ends a subscription now, whoever holds it. A student drops to the free
     * Coder plan at once (and keeps nothing paid); a college's students lose its
     * coverage and fall back to whatever they hold themselves; a company loses
     * its hiring plan. Nothing is deleted — the row stays in the history with who
     * ended it and why.
     *
     * Cancelling does NOT refund anything: money taken through Razorpay is
     * refunded from the Razorpay Dashboard, which the refund webhook then mirrors.
     */
    public function cancel(Subscription $subscription, User $actor, string $reason): Subscription
    {
        $subscription = DB::transaction(function () use ($subscription, $actor, $reason) {
            $locked = Subscription::whereKey($subscription->id)->lockForUpdate()->firstOrFail();

            if ($locked->status !== Subscription::STATUS_ACTIVE) {
                throw ValidationException::withMessages(['subscription' => ['This plan has already ended.']]);
            }

            $meta = $locked->meta ?? [];
            $meta['canceled_by'] = $actor->id;
            $meta['canceled_by_name'] = $actor->name;
            $meta['cancel_reason'] = $reason;

            $locked->forceFill([
                'status' => Subscription::STATUS_CANCELED,
                'canceled_at' => now(),
                'meta' => $meta,
            ])->save();

            // "Every student has a plan" stays true: a student whose paid plan is cancelled lands on Coder.
            $subscriber = $locked->subscriber;
            if ($subscriber instanceof User && $locked->plan?->kind === Plan::KIND_BASE) {
                $this->ensureDefaultIndividualPlan($subscriber);
            }

            return $locked;
        });

        [$type, $label, $context] = $this->describeSubscriber($subscription);

        ActivityLog::record($actor, "Cancelled a {$type} plan", $type, $label, $context + [
            'plan_code' => $subscription->plan?->code,
            'was_paid_through_gateway' => ! empty($subscription->meta['gateway_payment_id']),
            'reason' => $reason,
        ]);

        app(LifecycleMailService::class)->planEnded($subscription);

        return $subscription->fresh('plan');
    }

    /**
     * Who a subscription belongs to, as the audit log words it.
     *
     * @return array{0: string, 1: string, 2: array<string, int>}  [target type, label, ids for the log's meta]
     */
    private function describeSubscriber(Subscription $subscription): array
    {
        $subscriber = $subscription->subscriber;

        return match (true) {
            $subscriber instanceof College => ['College', $subscriber->name, ['college_id' => $subscriber->id]],
            $subscriber instanceof Company => ['Company', $subscriber->name, ['company_id' => $subscriber->id]],
            $subscriber instanceof User => ['User', $subscriber->name, ['user_id' => $subscriber->id]],
            default => ['Subscription', "#{$subscription->id}", []],
        };
    }

    /**
     * Takes back what one payment bought, when that payment is refunded in full
     * (Payments\CheckoutService::applyRefund). Cancels the still-active rows it
     * created — a row a later purchase already superseded is left alone, so
     * refunding an old order never reaches into the plan the student holds now —
     * and, if that leaves them with no plan at all, puts them back on the free
     * one, so "every student has a plan" stays true.
     *
     * @param  list<int>  $subscriptionIds
     * @return int how many subscriptions were cancelled
     */
    public function revokePurchase(User $user, array $subscriptionIds): int
    {
        $cancelled = $subscriptionIds === [] ? 0 : Subscription::whereKey($subscriptionIds)
            ->where('subscriber_type', User::class)
            ->where('subscriber_id', $user->id)
            ->where('status', Subscription::STATUS_ACTIVE)
            ->update(['status' => Subscription::STATUS_CANCELED, 'canceled_at' => now()]);

        $this->ensureDefaultIndividualPlan($user);

        try {
            app(\App\Services\Vault\VaultService::class)->accountStateChanged($user->fresh());
        } catch (\Throwable $e) {
            report($e);
        }

        return $cancelled;
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
                    'hackathon_access' => $currentPlan->hackathon_access,
                    'vault_access' => $currentPlan->vault_access,
                    'feature_trial_uses' => $currentPlan->feature_trial_uses,
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
     *
     * $termDays is a hand-chosen term for a superadmin grant (see
     * grantIndividualPlan()): it replaces the plan's own length WITHOUT
     * marking the row a trial, which $trialDays would.
     */
    private function activate(Model $subscriber, Plan $plan, ?int $trialDays = null, array $meta = [], bool $stackRenewal = false, ?int $termDays = null): Subscription
    {
        return DB::transaction(function () use ($subscriber, $plan, $trialDays, $meta, $stackRenewal, $termDays) {
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
            // for: the new period stacks on the old end. A base plan does the
            // same when a student renews the plan they already hold
            // ($stackRenewal — set only by the self-serve purchase path); a
            // plan CHANGE, and every admin-assigned institution/company plan,
            // keeps the long-standing behaviour: a fresh period from today.
            $renewsSamePlan = $stackRenewal && $previous->contains(fn (Subscription $s) => (int) $s->plan_id === (int) $plan->id);
            $periodStart = now();
            if (($plan->isAddon() || $renewsSamePlan) && $trialDays === null) {
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
                    : ($termDays !== null
                        ? $periodStart->copy()->addDays($termDays)
                        : ($plan->duration_days !== null ? $periodStart->copy()->addDays($plan->duration_days) : null)),
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
        $due = Subscription::where('status', Subscription::STATUS_ACTIVE)
            ->whereNotNull('current_period_end')
            ->where('current_period_end', '<', now());

        // A bulk update raises no model events, so the students whose plan just ended are noted first and then
        // taken off the Vault list if the plan was what listed them.
        $students = (clone $due)->where('subscriber_type', User::class)->pluck('subscriber_id')->unique()->all();

        // The paid personal plans that just ended, noted before the bulk update flips them, so each student can be
        // told. Only ones that ended recently: the first run after this was introduced must not announce plans that
        // lapsed months ago.
        $toAnnounce = (clone $due)
            ->with('plan')
            ->where('subscriber_type', User::class)
            ->where('current_period_end', '>=', now()->subDays(7))
            ->whereHas('plan', fn ($q) => $q->where('kind', Plan::KIND_BASE)->paidTier())
            ->get();

        $expired = $due->update(['status' => Subscription::STATUS_EXPIRED]);

        foreach ($toAnnounce as $subscription) {
            app(LifecycleMailService::class)->planExpired($subscription);
        }

        foreach (User::whereIn('id', $students)->get() as $student) {
            try {
                app(\App\Services\Vault\VaultService::class)->accountStateChanged($student);
            } catch (\Throwable $e) {
                report($e);
            }
        }

        return $expired;
    }
}
