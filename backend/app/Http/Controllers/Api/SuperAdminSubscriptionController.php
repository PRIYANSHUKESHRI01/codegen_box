<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\ConfirmsSuperadminPassword;
use App\Http\Controllers\Controller;
use App\Models\College;
use App\Models\Company;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use App\Services\SubscriptionAdminPresenter;
use App\Services\SubscriptionPresenter;
use App\Services\SubscriptionService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Superadmin → Subscriptions: every plan anyone holds, and the hand tools to
 * change them — give a student a plan, add days to a plan, end a plan.
 *
 * Every change is effective on the next request the affected people make (all
 * limits and locks read the subscription row, nothing is cached), and the
 * student's open screen picks it up on its next plan check
 * (GET /me/plan-signal). Each one is written to the audit log with who did it
 * and why; a reason is required because "why does this student have
 * Grandmaster?" is exactly the question someone will ask in a month.
 *
 * Money is never invented here. A complimentary grant records ₹0, so it is not
 * counted as revenue; an offline payment records what was actually received.
 * Cancelling does not refund (refunds are issued in the Razorpay Dashboard).
 */
class SuperAdminSubscriptionController extends Controller
{
    use ConfirmsSuperadminPassword;

    private const PER_PAGE = 25;

    public function __construct(
        private readonly SubscriptionService $subscriptions,
        private readonly SubscriptionAdminPresenter $presenter,
    ) {}

    /**
     * The global list. By default only PAID and institutional/company plans: every
     * student has a free Coder row from the day they join, and thousands of those
     * would bury the handful of rows anyone is actually looking for.
     */
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'state' => ['nullable', Rule::in(['active', 'expired', 'canceled', 'all'])],
            'audience' => ['nullable', Rule::in([Plan::AUDIENCE_INDIVIDUAL, Plan::AUDIENCE_INSTITUTION, Plan::AUDIENCE_COMPANY])],
            'plan' => ['nullable', 'string', 'max:64'],
            'source' => ['nullable', Rule::in([Subscription::SOURCE_PURCHASE, Subscription::SOURCE_ADMIN_GRANT])],
            'ending_within' => ['nullable', 'integer', 'min:1', 'max:365'],
            'include_free' => ['nullable', 'boolean'],
            'q' => ['nullable', 'string', 'max:100'],
        ]);

        $query = Subscription::query()
            ->with(['plan', 'subscriber' => fn (MorphTo $morph) => $morph->morphWith([User::class => ['college:id,name']])])
            ->latest('started_at')
            ->latest('id');

        $this->applyState($query, $validated['state'] ?? 'active');

        if (! $request->boolean('include_free')) {
            $query->whereHas('plan', fn ($p) => $p->where(fn ($w) => $w->where('audience', '!=', Plan::AUDIENCE_INDIVIDUAL)->orWhere(fn ($paid) => $paid->paidTier())));
        }

        if (! empty($validated['audience'])) {
            $query->whereHas('plan', fn ($p) => $p->where('audience', $validated['audience']));
        }

        if (! empty($validated['plan'])) {
            $query->whereHas('plan', fn ($p) => $p->where('code', $validated['plan']));
        }

        match ($validated['source'] ?? null) {
            Subscription::SOURCE_ADMIN_GRANT => $query->where('meta->source', Subscription::SOURCE_ADMIN_GRANT),
            Subscription::SOURCE_PURCHASE => $query->whereNotNull('meta->purchase_ref'),
            default => null,
        };

        if (! empty($validated['ending_within'])) {
            $query->where('status', Subscription::STATUS_ACTIVE)
                ->whereNotNull('current_period_end')
                ->whereBetween('current_period_end', [now(), now()->addDays((int) $validated['ending_within'])])
                ->tap($this->holderStillExists(...));
        }

        if (! empty($validated['q'])) {
            $like = '%'.str_replace(['%', '_'], ['\%', '\_'], $validated['q']).'%';

            $query->whereHasMorph('subscriber', [User::class, College::class, Company::class], function (Builder $q, string $type) use ($like) {
                $q->where(fn ($w) => $type === User::class
                    ? $w->where('name', 'like', $like)->orWhere('email', 'like', $like)->orWhere('handle', 'like', $like)
                    : $w->where('name', 'like', $like));
            });
        }

        $page = $query->paginate(self::PER_PAGE);

        return response()->json([
            'summary' => $this->summary(),
            'subscriptions' => $page->getCollection()->map(fn (Subscription $s) => $this->presenter->row($s))->values(),
            'pagination' => [
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'total' => $page->total(),
            ],
        ]);
    }

    /**
     * Give a student a paid plan (complimentary, or against an offline payment) —
     * see SubscriptionService::grantIndividualPlan() for the rules. Takes effect now.
     */
    public function grant(Request $request, User $user): JsonResponse
    {
        $validated = $request->validate([
            'plan_code' => ['required', 'string', 'exists:plans,code'],
            'days' => ['nullable', 'integer', 'min:1', 'max:'.SubscriptionService::MAX_GRANT_DAYS],
            'kind' => ['required', Rule::in(['complimentary', 'offline_payment'])],
            'amount' => ['required_if:kind,offline_payment', 'nullable', 'integer', 'min:1', 'max:'.(Plan::MAX_LIST_PRICE * 10)],
            'reference' => ['nullable', 'string', 'max:120'],
            'reason' => ['required', 'string', 'min:3', 'max:300'],
        ]);

        $plan = Plan::where('code', $validated['plan_code'])->firstOrFail();

        $subscription = $this->subscriptions->grantIndividualPlan($user, $plan, $request->user(), [
            'days' => $validated['days'] ?? (int) ($plan->duration_days ?? 365),
            'kind' => $validated['kind'],
            'amount' => $validated['amount'] ?? null,
            'reference' => $validated['reference'] ?? null,
            'reason' => $validated['reason'],
        ]);

        return response()->json($this->changed($user->fresh(), $subscription), 201);
    }

    public function extend(Request $request, Subscription $subscription): JsonResponse
    {
        $validated = $request->validate([
            'days' => ['required', 'integer', 'min:1', 'max:'.SubscriptionService::MAX_GRANT_DAYS],
            'reason' => ['required', 'string', 'min:3', 'max:300'],
        ]);

        $subscription = $this->subscriptions->extend($subscription, (int) $validated['days'], $request->user(), $validated['reason']);

        return response()->json($this->changed($this->ownerOf($subscription), $subscription));
    }

    /**
     * End a plan now. Ending a COLLEGE's plan switches off coverage for every one of
     * its students at once, so that one — and a company's — also asks for the
     * superadmin's own password; a single student's plan does not (it is routine
     * support work and one grant undoes it).
     */
    public function cancel(Request $request, Subscription $subscription): JsonResponse
    {
        $validated = $request->validate([
            'reason' => ['required', 'string', 'min:3', 'max:300'],
            'password' => [$subscription->subscriber_type === User::class ? 'nullable' : 'required', 'string'],
        ]);

        if ($subscription->subscriber_type !== User::class) {
            $this->confirmSuperadminPassword($request, $validated['password']);
        }

        $subscription = $this->subscriptions->cancel($subscription, $request->user(), $validated['reason']);

        return response()->json($this->changed($this->ownerOf($subscription), $subscription));
    }

    /**
     * Quick student lookup for the "give a plan" dialog: a handful of matches with
     * the plan each one holds, without the heavy per-row enrichment the full
     * directory does.
     */
    public function searchStudents(Request $request): JsonResponse
    {
        $term = trim((string) $request->query('q', ''));

        if (mb_strlen($term) < 2) {
            return response()->json(['students' => []]);
        }

        $like = '%'.str_replace(['%', '_'], ['\%', '\_'], $term).'%';

        $students = User::query()
            ->where('role', User::ROLE_USER)
            ->where(fn ($q) => $q->where('name', 'like', $like)->orWhere('email', 'like', $like)->orWhere('handle', 'like', $like))
            ->with('college:id,name')
            ->orderBy('name')
            ->limit(8)
            ->get();

        return response()->json([
            'students' => $students->map(function (User $u) {
                $coverage = $u->subscriptionCoverage();

                return [
                    'id' => $u->id,
                    'name' => $u->name,
                    'email' => $u->email,
                    'college' => $u->college?->name,
                    'is_blocked' => (bool) $u->is_blocked,
                    'plan_name' => $coverage['plan']?->name,
                    'plan_source' => $coverage['source'],
                    'days_remaining' => $coverage['days_remaining'],
                ];
            })->values(),
        ]);
    }

    /** @param  Builder<Subscription>  $query */
    private function applyState(Builder $query, string $state): void
    {
        $inDate = fn (Builder $q) => $q->where(fn ($w) => $w->whereNull('current_period_end')->orWhere('current_period_end', '>', now()));

        // Running / Ended / Cancelled are about plans that govern (or governed) an account that still exists. A row whose college,
        // company or student has since been deleted is leftover history — it was never swept (there is no foreign key to cascade
        // a polymorphic owner), and listing it as "Running" made a deleted college look like it still had a plan. It stays
        // reachable under All.
        match ($state) {
            'active' => $query->where('status', Subscription::STATUS_ACTIVE)->tap($inDate)->tap($this->holderStillExists(...)),
            'canceled' => $query->where('status', Subscription::STATUS_CANCELED)->tap($this->holderStillExists(...)),
            // Ended on its own: swept by the nightly job, or still marked active but past its date.
            'expired' => $query->where(fn ($w) => $w->where('status', Subscription::STATUS_EXPIRED)
                ->orWhere(fn ($x) => $x->where('status', Subscription::STATUS_ACTIVE)->where('current_period_end', '<=', now())))
                ->tap($this->holderStillExists(...)),
            default => null,
        };
    }

    /** @param  Builder<Subscription>  $query */
    private function holderStillExists(Builder $query): void
    {
        $query->whereHasMorph('subscriber', [User::class, College::class, Company::class]);
    }

    /** @return array<string, int> */
    private function summary(): array
    {
        // Only plans whose holder still exists: the cards must say what the "Running" list shows (a deleted college's leftover row
        // used to be counted as a college "with a running plan").
        $running = fn () => Subscription::query()
            ->where('status', Subscription::STATUS_ACTIVE)
            ->where(fn ($w) => $w->whereNull('current_period_end')->orWhere('current_period_end', '>', now()))
            ->tap($this->holderStillExists(...));

        $paidIndividual = fn () => $running()
            ->where('subscriber_type', User::class)
            ->whereHas('plan', fn ($p) => $p->paidTier());

        return [
            'paid_individual' => $paidIndividual()->count(),
            // Given by hand with nothing received — the ones that bring in no revenue.
            'complimentary' => $paidIndividual()->where('meta->source', Subscription::SOURCE_ADMIN_GRANT)->where('meta->price_paid', 0)->count(),
            'colleges' => $running()->where('subscriber_type', College::class)->count(),
            'companies' => $running()->where('subscriber_type', Company::class)->count(),
            'ending_7_days' => $running()
                ->whereNotNull('current_period_end')
                ->where('current_period_end', '<=', now()->addDays(7))
                ->whereHas('plan', fn ($p) => $p->where(fn ($w) => $w->where('audience', '!=', Plan::AUDIENCE_INDIVIDUAL)->orWhere(fn ($paid) => $paid->paidTier())))
                ->count(),
            'canceled_30_days' => Subscription::where('status', Subscription::STATUS_CANCELED)
                ->where('canceled_at', '>=', now()->subDays(30))
                ->whereHas('plan', fn ($p) => $p->where(fn ($w) => $w->where('audience', '!=', Plan::AUDIENCE_INDIVIDUAL)->orWhere(fn ($paid) => $paid->paidTier())))
                ->count(),
        ];
    }

    /**
     * The answer to every change: the row as it now is, plus — for a student — the plan
     * summary exactly as that student's own screen will read it, so the superadmin sees
     * what the student will see.
     *
     * @return array<string, mixed>
     */
    private function changed(?User $student, Subscription $subscription): array
    {
        $subscription->loadMissing(['plan', 'subscriber']);

        $payload = ['subscription' => $this->presenter->row($subscription)];

        if ($student !== null && $student->role === User::ROLE_USER) {
            $payload['coverage'] = app(SubscriptionPresenter::class)->formatCoverage($student->subscriptionCoverage());

            // A plan of their own does nothing while their college's plan covers them — say so, don't let it look broken.
            $coverage = $student->subscriptionCoverage();
            if ($coverage['source'] === 'institution') {
                $payload['warning'] = "{$student->name} is covered by {$student->college?->name}'s {$coverage['plan']?->name} plan, which takes precedence. A personal plan applies only when that plan ends.";
            }
        }

        return $payload;
    }

    private function ownerOf(Subscription $subscription): ?User
    {
        $owner = $subscription->subscriber;

        return $owner instanceof User ? $owner : null;
    }
}
