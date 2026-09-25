<?php

namespace App\Models;

use App\Models\Concerns\HasSubscription;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Dual-purpose: every row is at minimum a passive catalog entry Mellow staff
 * curates for campus placement drives (the original shape). A row may
 * additionally be a self-serve hiring tenant (`account_type =
 * ACCOUNT_TYPE_HIRING_TENANT`) with its own admin_company login and
 * subscription — set only via AdminController::storeCompanyTenant(), which
 * deliberately upgrades an existing catalog row in place (matched by slug)
 * rather than creating a duplicate, so a company already known to the
 * platform through campus drives doesn't end up as two disconnected records.
 */
class Company extends Model
{
    use HasFactory, HasSubscription;

    /** Every row today — Mellow-curated, read-only to TPOs, no login of its own. */
    public const ACCOUNT_TYPE_CATALOG_ONLY = 'catalog_only';

    /** Ops-onboarded self-serve hiring tenant — has its own admin_company account(s) and subscription. */
    public const ACCOUNT_TYPE_HIRING_TENANT = 'hiring_tenant';

    protected $fillable = [
        'name',
        'slug',
        'logo',
        'website_url',
        'industry',
        'overview',
        'hiring_process',
        'is_active',
        'account_type',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'hiring_process' => 'array',
            'is_active' => 'boolean',
        ];
    }

    public function isHiringTenant(): bool
    {
        return $this->account_type === self::ACCOUNT_TYPE_HIRING_TENANT;
    }

    /** Every account tied to this tenant — mirrors College::users(), and is the same extension point that later let section_coordinator bolt onto admin_tpo without touching College itself. */
    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    /** This tenant's admin_company account(s) — mirrors College::tpoAdmins(); one by onboarding convention, not DB-enforced. */
    public function admins(): HasMany
    {
        return $this->hasMany(User::class)->where('role', User::ROLE_ADMIN_COMPANY);
    }

    /** Job openings this tenant posted directly — distinct from placementDrives(), which also includes any catalog/TPO-authored drive that happens to reference this same Company row. */
    public function hiringDrives(): HasMany
    {
        return $this->placementDrives()->where('source', PlacementDrive::SOURCE_COMPANY_DIRECT);
    }

    public function placementDrives(): HasMany
    {
        return $this->hasMany(PlacementDrive::class);
    }

    public function prepQuestions(): HasMany
    {
        return $this->hasMany(CompanyPrepQuestion::class);
    }

    public function recommendedProblems(): HasMany
    {
        return $this->hasMany(CompanyRecommendedProblem::class);
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /** This tenant's own Talent Pool engagements (interest/interview/hire) — see App\Models\TalentPoolInquiry. */
    public function talentPoolInquiries(): HasMany
    {
        return $this->hasMany(TalentPoolInquiry::class);
    }
}
