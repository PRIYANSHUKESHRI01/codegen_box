<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
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

    /** The paid individual plan the Vault, the Hack Arena and Project Lab are sold through — what every locked-feature prompt points at. */
    public const CODE_EXPERT = 'expert';

    /** The Mellow Academy tier: every AptRun feature for three years, arranged with the team (`contact_only`) and never bought at checkout. */
    public const CODE_GRANDMASTER = 'grandmaster';

    /** The superadmin may not discount a plan past this: a typo (400 for 40) must not give a year of access away. */
    public const MAX_DISCOUNT_PERCENT = 90;

    /** Ceiling for a list price entered by hand (INR). A guard against a stray extra zero, not a business rule. */
    public const MAX_LIST_PRICE = 500000;

    protected $fillable = [
        'code',
        'name',
        'audience',
        'kind',
        'list_price',
        'annual_price',
        'discount_percent',
        'pricing_updated_by',
        'pricing_updated_at',
        'duration_days',
        'is_active',
        'contact_only',
        'sort_order',
        'max_practice_problems_per_day',
        'max_mock_interviews_per_day',
        'max_learning_centre_ai_attempts_per_day',
        'feature_trial_uses',
        'drive_access',
        'hackathon_access',
        'vault_access',
        'max_students',
        'project_lab_access',
        'max_workspace_hours_per_month',
        'max_active_projects',
    ];

    protected function casts(): array
    {
        return [
            'list_price' => 'integer',
            'annual_price' => 'integer',
            'discount_percent' => 'integer',
            'pricing_updated_at' => 'datetime',
            'duration_days' => 'integer',
            'is_active' => 'boolean',
            'contact_only' => 'boolean',
            'sort_order' => 'integer',
            'max_practice_problems_per_day' => 'integer',
            'max_mock_interviews_per_day' => 'integer',
            'max_learning_centre_ai_attempts_per_day' => 'integer',
            'feature_trial_uses' => 'integer',
            'drive_access' => 'boolean',
            'hackathon_access' => 'boolean',
            'max_students' => 'integer',
            'vault_access' => 'boolean',
            'project_lab_access' => 'boolean',
            'max_workspace_hours_per_month' => 'integer',
            'max_active_projects' => 'integer',
        ];
    }

    public function subscriptions(): HasMany
    {
        return $this->hasMany(Subscription::class);
    }

    /** The superadmin who last changed this plan's list price or discount. */
    public function pricingUpdatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'pricing_updated_by');
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
     * Judged on the LIST price: a discount never turns a paid plan into "the
     * free plan" (and the superadmin editor caps it well below 100%).
     */
    public function isFree(): bool
    {
        // A plan with no online price is "arranged with the team", not "free": a missing price must never read as ₹0.
        return ! $this->isContactOnly() && $this->listPrice() === 0;
    }

    /** A plan sold by the team rather than at checkout (Grandmaster / Mellow Academy): no online price, can't be bought here, granted by the superadmin. */
    public function isContactOnly(): bool
    {
        return (bool) $this->contact_only;
    }

    /** Plans somebody pays for, however they pay: a priced plan, or one the team sells. What "a paid plan" means in lists and filters. */
    public function scopePaidTier(Builder $query): Builder
    {
        return $query->where(fn (Builder $q) => $q->where('list_price', '>', 0)->orWhere('contact_only', true));
    }

    /** What one billing term costs before any discount, in whole rupees. 0 for a free plan and for plans sold by Ops (they use annual_price). */
    public function listPrice(): int
    {
        return (int) $this->list_price;
    }

    /** Rupees taken off list_price by discount_percent, rounded to a whole rupee. 4999 at 40% off → 2000. */
    public function discountAmount(): int
    {
        return self::discountFor($this->listPrice(), (int) $this->discount_percent);
    }

    /** The one place a discount is rounded: what `$percent`% off `$listPrice` takes off, in whole rupees. */
    public static function discountFor(int $listPrice, int $percent): int
    {
        $percent = max(0, min(100, $percent));

        return $percent === 0 || $listPrice <= 0 ? 0 : $listPrice - (int) round($listPrice * (100 - $percent) / 100);
    }

    /** What a student actually pays for one billing term: list price minus the discount. 4999 at 40% off → 2999. */
    public function salePrice(): int
    {
        return $this->listPrice() - $this->discountAmount();
    }

    public function hasDiscount(): bool
    {
        return $this->discountAmount() > 0;
    }

    /** Billing term as a word for "per ___" — year for a 365-day plan, month for 30, "3 years" for 1,095 days, otherwise the day count. Null for a plan that never expires. */
    public function termUnit(): ?string
    {
        $days = $this->duration_days === null ? null : (int) $this->duration_days;

        return match (true) {
            $days === null => null,
            $days === 365 => 'year',
            $days === 30 => 'month',
            $days > 365 && $days % 365 === 0 => ($days / 365).' years',
            default => $days.' days',
        };
    }

    /**
     * The price block every surface renders — the public pricing page, the
     * superadmin editor, the "upgrade to Expert" prompts — so "was ₹4,999,
     * now ₹2,999, 40% off, per year" is assembled in exactly one place and can
     * never disagree between them.
     *
     * A `contact_only` plan has no price to show: its figures are zero and
     * `contact_only` is true, so a surface that forgets to check the flag shows
     * nothing alarming, and the one that checks it says "talk to the team".
     *
     * @return array{code: string, name: string, list_price: int, discount_percent: int, discount_amount: int, sale_price: int, term_days: ?int, term_unit: ?string, is_free: bool, contact_only: bool}
     */
    public function pricing(): array
    {
        return [
            'code' => $this->code,
            'name' => $this->name,
            'list_price' => $this->listPrice(),
            'discount_percent' => $this->hasDiscount() ? (int) $this->discount_percent : 0,
            'discount_amount' => $this->discountAmount(),
            'sale_price' => $this->salePrice(),
            'term_days' => $this->duration_days === null ? null : (int) $this->duration_days,
            'term_unit' => $this->termUnit(),
            'is_free' => $this->isFree(),
            'contact_only' => $this->isContactOnly(),
        ];
    }

    /**
     * What a plan includes, in the shape the pricing page and the comparison
     * table read — straight from the columns that actually enforce it, so the
     * page cannot promise something the plan does not do. null on a *_per_day /
     * *_per_month figure means unlimited.
     *
     * @return array{practice_problems_per_day: ?int, mock_interviews_per_day: ?int, free_trial_uses: ?int, drive_access: bool, hackathon_access: bool, vault_access: bool, project_lab_access: bool, workspace_hours_per_month: ?int, active_projects: ?int}
     */
    public function entitlementSummary(): array
    {
        return [
            'practice_problems_per_day' => $this->max_practice_problems_per_day,
            'mock_interviews_per_day' => $this->max_mock_interviews_per_day,
            'free_trial_uses' => $this->feature_trial_uses,
            'drive_access' => (bool) $this->drive_access,
            'hackathon_access' => (bool) $this->hackathon_access,
            'vault_access' => (bool) $this->vault_access,
            'project_lab_access' => (bool) $this->project_lab_access,
            'workspace_hours_per_month' => $this->max_workspace_hours_per_month,
            'active_projects' => $this->max_active_projects,
        ];
    }

    /** The plans the Plans & Pricing editor and the public pricing page show: paid-or-free individual base plans, never add-ons or custom college plans. */
    public function scopeIndividualBase(Builder $query): Builder
    {
        return $query->where('audience', self::AUDIENCE_INDIVIDUAL)->where('kind', self::KIND_BASE);
    }

    /** A plan whose list price and discount the superadmin may edit: a priced individual base plan. (Coder stays ₹0; add-ons, college plans and the team-sold Grandmaster aren't priced here.) */
    public function isPriceEditable(): bool
    {
        return $this->audience === self::AUDIENCE_INDIVIDUAL
            && $this->kind === self::KIND_BASE
            && ! $this->isContactOnly()
            && $this->listPrice() > 0;
    }
}
