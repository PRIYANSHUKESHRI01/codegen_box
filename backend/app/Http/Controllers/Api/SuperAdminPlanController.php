<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Superadmin → Plans & Pricing: read the individual plans and change what a
 * paid plan costs and how much it is discounted. The change is live the moment
 * it is saved — the public pricing page and the checkout both read the same
 * rows (PublicPlanController, PurchaseQuoteService) — so there is no
 * "publish" step to forget.
 *
 * Price: `list_price` (the "real" price that is shown struck through) and
 * `discount_percent` (what actually gets charged is list minus this). Coder stays
 * ₹0 and the retired Project Lab add-on / college plans are not priced here at all.
 *
 * What a plan INCLUDES — daily limits, the free plan's one-time tries, access to
 * the Hack Arena / the Vault / Project Lab — is editable too
 * (updateEntitlements()). Those columns are exactly what the server enforces, so
 * a change applies to everyone already on the plan on their next request, and the
 * pricing page's numbers and comparison table are generated from them. The
 * hand-written marketing bullets on the plan cards are not (see data/pricing.ts).
 *
 * A discount of 100% makes the plan a free offer: its card says "Free", the Buy
 * button becomes "Redeem offer", and the student gets the plan with one click and
 * no payment (OfferRedemptionService). That is never saved by accident — the editor
 * must send `confirm_free_offer` — and turning it on or off is flagged in the audit log.
 *
 * Subscriptions already running are never repriced; a new price applies to
 * whoever buys or renews after it is saved. Every change is written to the
 * audit log with the before and after values.
 */
class SuperAdminPlanController extends Controller
{
    /** The plan columns that decide what a student on the plan may do — what updateEntitlements() edits. */
    private const LIMIT_FIELDS = [
        'max_practice_problems_per_day',
        'max_mock_interviews_per_day',
        'max_learning_centre_ai_attempts_per_day',
        'feature_trial_uses',
        'drive_access',
        'hackathon_access',
        'vault_access',
        'project_lab_access',
        'max_workspace_hours_per_month',
        'max_active_projects',
        'max_core_practice_per_day',
        'core_tests_access',
    ];

    public function index(): JsonResponse
    {
        $plans = Plan::individualBase()->orderBy('sort_order')->with('pricingUpdatedBy:id,name')->get();

        $subscribers = Subscription::query()
            ->where('status', Subscription::STATUS_ACTIVE)
            ->where(fn ($q) => $q->whereNull('current_period_end')->orWhere('current_period_end', '>', now()))
            ->whereIn('plan_id', $plans->pluck('id'))
            ->select('plan_id', DB::raw('count(*) as total'))
            ->groupBy('plan_id')
            ->pluck('total', 'plan_id');

        $redeemed = Subscription::query()
            ->where('meta->source', Subscription::SOURCE_OFFER_REDEEMED)
            ->whereIn('plan_id', $plans->pluck('id'))
            ->select('plan_id', DB::raw('count(*) as total'))
            ->groupBy('plan_id')
            ->pluck('total', 'plan_id');

        return response()->json([
            'currency' => config('billing.currency', 'INR'),
            'limits' => [
                'max_list_price' => Plan::MAX_LIST_PRICE,
                'max_discount_percent' => Plan::MAX_DISCOUNT_PERCENT,
            ],
            'plans' => $plans->map(fn (Plan $plan) => $this->payload($plan, (int) ($subscribers[$plan->id] ?? 0), (int) ($redeemed[$plan->id] ?? 0)))->values(),
        ]);
    }

    public function update(Request $request, Plan $plan): JsonResponse
    {
        if (! $plan->isPriceEditable()) {
            throw ValidationException::withMessages(['plan' => ["The price of the {$plan->name} plan can't be changed here."]]);
        }

        $validated = $request->validate([
            'list_price' => ['required', 'integer', 'min:1', 'max:'.Plan::MAX_LIST_PRICE],
            'discount_percent' => ['required', 'integer', 'min:0', 'max:'.Plan::MAX_DISCOUNT_PERCENT],
            // Making a plan free hands it to every student with one click, so it is never done by a stray keystroke:
            // the editor sends this only after the superadmin has ticked the warning (see below).
            'confirm_free_offer' => ['nullable', 'boolean'],
            // The `version` this editor loaded (the price it started from): refuses to overwrite a
            // change another superadmin saved in the meantime, instead of silently discarding it.
            'version' => ['nullable', 'string', 'max:40'],
        ]);

        $actor = $request->user();

        $plan = DB::transaction(function () use ($plan, $validated, $actor, $request) {
            $locked = Plan::whereKey($plan->id)->lockForUpdate()->firstOrFail();

            if (isset($validated['version']) && $validated['version'] !== $this->version($locked)) {
                throw ValidationException::withMessages([
                    'version' => ["The {$locked->name} plan was changed by someone else while you were editing. Reload to see the latest price."],
                ]);
            }

            $before = ['list_price' => $locked->listPrice(), 'discount_percent' => (int) $locked->discount_percent];
            $after = ['list_price' => (int) $validated['list_price'], 'discount_percent' => (int) $validated['discount_percent']];

            if ($before === $after) {
                return $locked;
            }

            $wasFree = $locked->isRedeemable();

            $locked->fill($after + [
                'pricing_updated_by' => $actor->id,
                'pricing_updated_at' => now(),
            ]);

            // Judged on the resulting price, not on "100": a ₹1 plan at 99% also rounds to ₹0. Only a change INTO free needs the
            // confirmation — adjusting the list price of a plan that is already free changes nothing for anyone.
            $nowFree = $locked->isRedeemable();

            if ($nowFree && ! $wasFree && ! $request->boolean('confirm_free_offer')) {
                throw ValidationException::withMessages([
                    'confirm_free_offer' => ["This makes {$locked->name} free: every student will be able to redeem it without paying. Confirm that you mean to do this."],
                ]);
            }

            $locked->save();

            ActivityLog::record(
                $actor,
                'Changed plan pricing',
                'Plan',
                $locked->name,
                [
                    'plan_code' => $locked->code,
                    'from' => $before + ['sale_price' => $before['list_price'] - Plan::discountFor($before['list_price'], $before['discount_percent'])],
                    'to' => $after + ['sale_price' => $locked->salePrice()],
                ] + ($nowFree !== $wasFree ? ['free_offer' => $nowFree ? 'turned_on' : 'turned_off'] : [])
            );

            return $locked;
        });

        return response()->json(['plan' => $this->payload($plan->load('pricingUpdatedBy:id,name'), $this->activeSubscribers($plan), $this->redemptions($plan))]);
    }

    /**
     * What a plan includes. The editor sends the COMPLETE set every time (`present`,
     * nullable where null means "unlimited"), so an omitted field can never be
     * mistaken for "make this unlimited". Applies live to everyone on the plan: each
     * limit is read from the plan row on the request that enforces it.
     */
    public function updateEntitlements(Request $request, Plan $plan): JsonResponse
    {
        if ($plan->audience !== Plan::AUDIENCE_INDIVIDUAL || $plan->kind !== Plan::KIND_BASE) {
            throw ValidationException::withMessages(['plan' => ["What the {$plan->name} plan includes can't be changed here."]]);
        }

        $validated = $request->validate([
            'max_practice_problems_per_day' => ['present', 'nullable', 'integer', 'min:1', 'max:1000'],
            'max_mock_interviews_per_day' => ['present', 'nullable', 'integer', 'min:0', 'max:100'],
            'max_learning_centre_ai_attempts_per_day' => ['present', 'nullable', 'integer', 'min:0', 'max:500'],
            'feature_trial_uses' => ['present', 'nullable', 'integer', 'min:0', 'max:20'],
            'drive_access' => ['present', 'boolean'],
            'hackathon_access' => ['present', 'boolean'],
            'vault_access' => ['present', 'boolean'],
            'project_lab_access' => ['present', 'boolean'],
            'max_workspace_hours_per_month' => ['present', 'nullable', 'integer', 'min:0', 'max:744'],
            'max_active_projects' => ['present', 'nullable', 'integer', 'min:0', 'max:50'],
            // Added after the editor shipped: `sometimes`, so an older open editor that doesn't send them keeps working and leaves them as they are.
            'max_core_practice_per_day' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:1000'],
            'core_tests_access' => ['sometimes', 'boolean'],
            'version' => ['nullable', 'string', 'max:64'],
        ]);

        $actor = $request->user();

        $plan = DB::transaction(function () use ($plan, $validated, $actor) {
            $locked = Plan::whereKey($plan->id)->lockForUpdate()->firstOrFail();

            if (isset($validated['version']) && $validated['version'] !== $this->limitsVersion($locked)) {
                throw ValidationException::withMessages([
                    'version' => ["The {$locked->name} plan was changed by someone else while you were editing. Reload to see the latest."],
                ]);
            }

            $before = $this->limits($locked);

            // Through the model's casts, so "1" and true (or "5" and 5) are the same value, not a change.
            $locked->fill(collect(self::LIMIT_FIELDS)->filter(fn (string $field) => array_key_exists($field, $validated))->mapWithKeys(fn (string $field) => [$field => $validated[$field]])->all());

            if (! $locked->isDirty()) {
                return $locked;
            }

            $locked->save();

            $after = $this->limits($locked);

            ActivityLog::record($actor, 'Changed what a plan includes', 'Plan', $locked->name, [
                'plan_code' => $locked->code,
                'changes' => collect($after)
                    ->filter(fn ($value, string $field) => $before[$field] !== $value)
                    ->map(fn ($value, string $field) => ['from' => $before[$field], 'to' => $value])
                    ->all(),
            ]);

            return $locked;
        });

        return response()->json(['plan' => $this->payload($plan->load('pricingUpdatedBy:id,name'), $this->activeSubscribers($plan), $this->redemptions($plan))]);
    }

    /** @return array<string, mixed> */
    private function payload(Plan $plan, int $activeSubscribers, int $redemptions): array
    {
        return $plan->pricing() + [
            'id' => $plan->id,
            'is_editable' => $plan->isPriceEditable(),
            'is_active' => (bool) $plan->is_active,
            'entitlements' => $plan->entitlementSummary(),
            // The raw columns the entitlements editor edits (null = unlimited), and the token it must send back.
            'limits' => $this->limits($plan),
            'limits_version' => $this->limitsVersion($plan),
            'active_subscribers' => $activeSubscribers,
            // Every time a student has taken this plan through the free offer (ever, not just the ones still running).
            'redemptions' => $redemptions,
            'pricing_updated_by_name' => $plan->pricingUpdatedBy?->name,
            'pricing_updated_at' => $plan->pricing_updated_at?->toIso8601String(),
            'version' => $this->version($plan),
        ];
    }

    /** The token an edit must present to prove it started from the current price: the two editable numbers themselves. */
    private function version(Plan $plan): string
    {
        return $plan->listPrice().'-'.(int) $plan->discount_percent;
    }

    /** @return array<string, int|bool|null> */
    private function limits(Plan $plan): array
    {
        return collect(self::LIMIT_FIELDS)->mapWithKeys(fn (string $field) => [$field => $plan->{$field}])->all();
    }

    /** The token an entitlements edit must present to prove it started from the current limits. */
    private function limitsVersion(Plan $plan): string
    {
        return substr(sha1(json_encode($this->limits($plan))), 0, 16);
    }

    private function redemptions(Plan $plan): int
    {
        return Subscription::where('plan_id', $plan->id)->where('meta->source', Subscription::SOURCE_OFFER_REDEEMED)->count();
    }

    private function activeSubscribers(Plan $plan): int
    {
        return Subscription::where('plan_id', $plan->id)
            ->where('status', Subscription::STATUS_ACTIVE)
            ->where(fn ($q) => $q->whereNull('current_period_end')->orWhere('current_period_end', '>', now()))
            ->count();
    }
}
