<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use App\Models\Concerns\HasSubscription;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use App\Services\ReadinessScoreService;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, HasSubscription, Notifiable;

    public const ROLE_USER = 'user';

    public const ROLE_ADMIN_INTERNAL = 'admin_internal';

    public const ROLE_ADMIN_TPO = 'admin_tpo';

    public const ROLE_ADMIN_MARKETING = 'admin_marketing';

    public const ROLE_SUPERADMIN = 'superadmin';

    /**
     * TPO-provisioned, scoped to exactly one section of the TPO's own
     * college (see `section` below) — never self-registered, never created
     * by Mellow staff/superadmin, same as how only a TPO creates students.
     */
    public const ROLE_SECTION_COORDINATOR = 'section_coordinator';

    /**
     * A company hiring tenant's own admin account — Ops-onboarded (see
     * AdminController::storeCompanyTenant()), scoped to exactly one Company
     * row via `company_id`, symmetric to how admin_tpo is scoped to one
     * College via college_id.
     */
    public const ROLE_ADMIN_COMPANY = 'admin_company';

    public const ROLES = [
        self::ROLE_USER,
        self::ROLE_ADMIN_INTERNAL,
        self::ROLE_ADMIN_TPO,
        self::ROLE_ADMIN_MARKETING,
        self::ROLE_SUPERADMIN,
        self::ROLE_SECTION_COORDINATOR,
        self::ROLE_ADMIN_COMPANY,
    ];

    /**
     * Granular capabilities within the two internal staff roles — a
     * superadmin creating (or later editing) an admin_internal/
     * admin_marketing account picks a subset of the list matching that
     * role, rather than the role alone deciding what they can reach. Each
     * key maps 1:1 to a real dashboard section, enforced server-side by the
     * `permission:` route middleware (see EnsureUserHasPermission) — never
     * just a frontend show/hide.
     */
    public const PERM_COLLEGES = 'colleges';

    public const PERM_PLATFORM_USERS = 'platform_users';

    public const PERM_PROBLEM_BANK = 'problem_bank';

    public const PERM_PLACEMENTS = 'placements';

    public const PERM_CONTESTS = 'contests';

    public const PERM_INTERVIEWS = 'interviews';

    public const PERM_CUSTOMERS = 'customers';

    public const PERM_ARTICLES = 'articles';

    /** Author Talent Pool scouting assessments and oversee the shared candidate marketplace — see App\Models\TalentPoolCandidate. */
    public const PERM_TALENT_POOL = 'talent_pool';

    public const PERMISSIONS_INTERNAL = [
        self::PERM_COLLEGES,
        self::PERM_PLATFORM_USERS,
        self::PERM_PROBLEM_BANK,
        self::PERM_PLACEMENTS,
        self::PERM_CONTESTS,
        self::PERM_INTERVIEWS,
        self::PERM_CUSTOMERS,
        self::PERM_ARTICLES,
        self::PERM_TALENT_POOL,
    ];

    public const PERM_LEADS = 'leads';

    public const PERM_LEAD_OUTREACH = 'lead_outreach';

    public const PERMISSIONS_MARKETING = [
        self::PERM_LEADS,
        self::PERM_LEAD_OUTREACH,
    ];

    /** A college-less student is a business lead ("Mellow Direct") the marketing team owns — this is the one place that definition lives. */
    public const LEAD_STATUS_NEW = 'new';

    public const LEAD_STATUS_CONTACTED = 'contacted';

    public const LEAD_STATUS_ENGAGED = 'engaged';

    public const LEAD_STATUS_CONVERTED = 'converted';

    public const LEAD_STATUS_LOST = 'lost';

    public const LEAD_STATUSES = [
        self::LEAD_STATUS_NEW,
        self::LEAD_STATUS_CONTACTED,
        self::LEAD_STATUS_ENGAGED,
        self::LEAD_STATUS_CONVERTED,
        self::LEAD_STATUS_LOST,
    ];

    /** Per-instance memoization for readinessBreakdown()/practiceScore() — see those methods' docblocks. */
    private ?array $readinessBreakdownCache = null;

    private ?int $practiceScoreCache = null;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'must_change_password',
        'role',
        'permissions',
        'handle',
        'college_id',
        'company_id',
        'invited_by_company_id',
        'roll_number',
        'branch',
        'section',
        'cgpa',
        'backlogs',
        'phone',
        'parent_phone',
        'credentials_email_sent_at',
        'bio',
        'linkedin_url',
        'github_url',
        'skills',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
        // Raw storage path, never handed to the frontend directly — the
        // computed avatar_url accessor below is what every consumer uses.
        'avatar_path',
        // Same reasoning as avatar_path — a resume lives on the PRIVATE
        // `local` disk (unlike the public avatar), so there is no public URL
        // to append at all; only has_resume (a boolean) is ever serialized,
        // and the actual file is only reachable through an authenticated,
        // ownership-checked download route (StudentProfileController::downloadOwnResume(),
        // CompanyTalentPoolController's resume route).
        'resume_path',
    ];

    /**
     * Always included in every serialized user (both the curated
     * per-controller payloads and the raw model dumps /me and /login
     * return) — a photo is identity chrome every surface may want to show,
     * not something worth threading through each payload builder by hand.
     * has_resume follows the same "always cheap to include" reasoning.
     *
     * @var list<string>
     */
    protected $appends = ['avatar_url', 'has_resume'];

    /**
     * The attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'must_change_password' => 'boolean',
            'permissions' => 'array',
            'is_blocked' => 'boolean',
            'blocked_at' => 'datetime',
            'cgpa' => 'decimal:2',
            'backlogs' => 'integer',
            'credentials_email_sent_at' => 'datetime',
            // Cast but deliberately NOT in $fillable, same as is_blocked —
            // only PhoneVerificationController may set this, via
            // forceFill(), after a real Firebase OTP round-trip.
            'phone_verified_at' => 'datetime',
            // Cast but deliberately NOT in $fillable, same as is_blocked —
            // only ContestFinalizeService may set these, via forceFill().
            'current_rating' => 'integer',
            'rated_contests_count' => 'integer',
            // Same forceFill-only convention — only LeadAssignmentService
            // writes these (lead_status is the exception, also written by
            // MarketingLeadService's manual status-change endpoint).
            'converted_at' => 'datetime',
            'skills' => 'array',
            // Cast but deliberately NOT in $fillable, same as is_blocked —
            // only StudentProfileController's upload/delete methods may set
            // these, via forceFill().
            'resume_uploaded_at' => 'datetime',
            'profile_completion_percent' => 'integer',
        ];
    }

    /**
     * Only ever set via AuthController::updateAvatar()'s forceFill() — same
     * "cast but deliberately not in $fillable" convention as is_blocked/
     * current_rating above. Null (no photo uploaded yet) resolves to null,
     * not a broken URL, so every consumer falls back to an initials avatar.
     */
    protected function avatarUrl(): Attribute
    {
        return Attribute::make(
            get: fn () => $this->avatar_path ? Storage::disk('public')->url($this->avatar_path) : null,
        );
    }

    /** Whether a resume has ever been uploaded — the only resume-related fact ever serialized (see $hidden/$appends above); the actual file is reached only through an authenticated download route. */
    protected function hasResume(): Attribute
    {
        return Attribute::make(
            get: fn () => $this->resume_path !== null,
        );
    }

    public function college(): BelongsTo
    {
        return $this->belongsTo(College::class);
    }

    /** The company hiring tenant this account belongs to — set for an admin_company user, always null for everyone else. */
    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    /** Which company's invite/bulk-import first created this account, if any — see the migration that added this column for why it's distinct from `company()`. */
    public function invitedByCompany(): BelongsTo
    {
        return $this->belongsTo(Company::class, 'invited_by_company_id');
    }

    public function submissions(): HasMany
    {
        return $this->hasMany(Submission::class);
    }

    public function contestParticipations(): HasMany
    {
        return $this->hasMany(ContestParticipant::class);
    }

    public function articleReads(): HasMany
    {
        return $this->hasMany(ArticleRead::class);
    }

    /** This student's Talent Pool standing, if they've ever qualified — see App\Models\TalentPoolCandidate. Null for everyone else (staff/TPO/company accounts never have one). */
    public function talentPoolCandidate(): HasOne
    {
        return $this->hasOne(TalentPoolCandidate::class);
    }

    /** Notes the marketing team has logged about this lead — meaningless (and expected to stay empty) for anyone who isn't one. */
    public function leadNotes(): HasMany
    {
        return $this->hasMany(LeadNote::class)->orderByDesc('created_at');
    }

    /** The Mellow Marketing employee this lead is assigned to — see App\Services\LeadAssignmentService. Null until assigned (or if no marketing employee exists yet). */
    public function assignedMarketing(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_marketing_id');
    }

    /** Inverse of assignedMarketing() — a marketing employee's own book of leads. Meaningless for any other role. */
    public function assignedLeads(): HasMany
    {
        return $this->hasMany(User::class, 'assigned_marketing_id');
    }

    /**
     * The Mellow Internal (Ops) employee who owns this lead now that it has
     * converted — see LeadAssignmentService::assignInternalOwner(). Null
     * until conversion (or if no internal employee exists yet to assign to).
     */
    public function assignedInternal(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_internal_id');
    }

    /** Inverse of assignedInternal() — an internal employee's own book of paying customers handed off from Marketing. */
    public function assignedCustomers(): HasMany
    {
        return $this->hasMany(User::class, 'assigned_internal_id');
    }

    /**
     * "Unrated" until a student has actually competed at least once — the
     * default 1200 every user starts at must never be displayed as if it
     * were earned. Once rated, this real contest rating is what the
     * dashboard/leaderboard badges show instead of a solved-count score.
     */
    public function displayRating(): string
    {
        return $this->rated_contests_count > 0 ? (string) $this->current_rating : 'Unrated';
    }

    public function blockedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'blocked_by');
    }

    public function isSuperAdmin(): bool
    {
        return $this->role === self::ROLE_SUPERADMIN;
    }

    public function isMellowStaff(): bool
    {
        return $this->role === self::ROLE_ADMIN_INTERNAL;
    }

    public function isCollegeTpo(): bool
    {
        return $this->role === self::ROLE_ADMIN_TPO;
    }

    public function isSectionCoordinator(): bool
    {
        return $this->role === self::ROLE_SECTION_COORDINATOR;
    }

    public function isCompanyAdmin(): bool
    {
        return $this->role === self::ROLE_ADMIN_COMPANY;
    }

    public function isStudent(): bool
    {
        return $this->role === self::ROLE_USER;
    }

    public function isMellowMarketing(): bool
    {
        return $this->role === self::ROLE_ADMIN_MARKETING;
    }

    public function isPhoneVerified(): bool
    {
        return $this->phone_verified_at !== null;
    }

    /** The full permission catalog available to a given role — what a superadmin is allowed to pick from when hiring/editing that role. Empty for any role with no granular permissions of its own. */
    public static function permissionCatalogForRole(string $role): array
    {
        return match ($role) {
            self::ROLE_ADMIN_INTERNAL => self::PERMISSIONS_INTERNAL,
            self::ROLE_ADMIN_MARKETING => self::PERMISSIONS_MARKETING,
            default => [],
        };
    }

    /**
     * Superadmin always passes, regardless of what's actually stored in
     * `permissions` — the granular system exists to scope down
     * admin_internal/admin_marketing, never to restrict the trust tier
     * above them. Every other role (student, TPO) has no permission keys
     * at all and never needs this check; their access is role-gated only.
     */
    public function hasPermission(string $key): bool
    {
        if ($this->isSuperAdmin()) {
            return true;
        }

        return in_array($key, $this->permissions ?? [], true);
    }

    /**
     * A "Mellow Direct" self-registered user — a business lead the
     * marketing team owns, as opposed to a student a college brought onto
     * the platform. One definition, reused everywhere "is this a lead"
     * needs answering (the marketing dashboard's queries, notify scoping).
     */
    public function isMellowDirectLead(): bool
    {
        return $this->role === self::ROLE_USER
            && $this->college_id === null
            && $this->invited_by_company_id === null;
    }

    /**
     * The query-builder equivalent of isMellowDirectLead() — every "Mellow
     * Direct leads" list (Marketing's own queue, the superadmin overview's
     * `leads` segment, converted-customer/unassigned-lead counts) filters
     * through this one scope rather than re-deriving `role=user AND
     * college_id IS NULL` by hand, which would otherwise silently start
     * including company-invited candidates (also college_id-less, but never
     * a lead) the moment that concept existed. Kept in exact lockstep with
     * isMellowDirectLead() above — same one-definition intent, just usable
     * inside a WHERE clause instead of only on an already-loaded model.
     */
    public function scopeMellowDirectLeads(Builder $query): Builder
    {
        return $query->where('role', self::ROLE_USER)
            ->whereNull('college_id')
            ->whereNull('invited_by_company_id');
    }

    /**
     * A "Mellow Direct" lead that has bought a paid plan — from this point
     * on it's Mellow Internal (not Marketing) that owns servicing the
     * account, via assigned_internal_id. See
     * LeadAssignmentService::convertLead().
     */
    public function isConvertedCustomer(): bool
    {
        return $this->isMellowDirectLead() && $this->lead_status === self::LEAD_STATUS_CONVERTED;
    }

    /**
     * Mellow staff and superadmins operate the platform internally and may
     * supervise/manage every college's TPO portal.
     */
    public function canManageColleges(): bool
    {
        return $this->isMellowStaff() || $this->isSuperAdmin();
    }

    /**
     * A 0-100 "recruiter-ready profile" completion score — see
     * StudentProfileController, which recomputes and persists this into
     * `profile_completion_percent` after every write (bio/links/skills save,
     * resume upload/delete) so CompanyTalentPoolController can `ORDER BY` it
     * directly in SQL to rank more-complete profiles first in search.
     *
     * NOT the same thing as readinessScore() below — that's academic CGPA +
     * daily-practice consistency for the TPO cohort view; this is entirely
     * different fields (bio/links/skills/resume/avatar/phone), self-edited
     * on the Settings page, and recruiter-facing rather than TPO-facing.
     * Deliberately only weighs fields the student can personally act on from
     * that page — nothing TPO-imported (roll_number/branch/cgpa/backlogs)
     * counts here, since a student has no way to fix those themselves.
     *
     * Weights (sum to 100): phone verified 15, avatar 10, bio (>=40 chars)
     * 10, LinkedIn URL 15, GitHub URL 10, resume uploaded 25 (heaviest — it's
     * what a recruiter actually opens), 3+ skills 15.
     */
    public function computeProfileCompletion(): int
    {
        $score = 0;
        $score += $this->isPhoneVerified() ? 15 : 0;
        $score += $this->avatar_path !== null ? 10 : 0;
        $score += ($this->bio !== null && mb_strlen(trim($this->bio)) >= 40) ? 10 : 0;
        $score += $this->linkedin_url !== null ? 15 : 0;
        $score += $this->github_url !== null ? 10 : 0;
        $score += $this->resume_path !== null ? 25 : 0;
        $score += count($this->skills ?? []) >= 3 ? 15 : 0;

        return $score;
    }

    /**
     * The explainable form of readinessScore() — see
     * App\Services\ReadinessScoreService for the actual weighting (Interview
     * Performance 35%, Contest Rating 20%, Practice Depth & Breadth 20%,
     * Consistency 15%, Academic Standing 10%) and its docblock for why the
     * balance shifted away from CGPA toward demonstrated skill. Cached on
     * the instance so a single request never recomputes this more than
     * once — readinessScore()/readinessTier() both read from here instead
     * of each re-deriving it, and practiceScore() below is cached
     * separately for the same reason (it's read both by this breakdown's
     * consistency component and directly by callers like
     * StudentStatsController).
     *
     * @return array{score: int, tier: string, components: array, next_steps: array<int, string>}
     */
    public function readinessBreakdown(): array
    {
        return $this->readinessBreakdownCache ??= app(ReadinessScoreService::class)->breakdown($this);
    }

    public function readinessScore(): int
    {
        return $this->readinessBreakdown()['score'];
    }

    /**
     * 0-100: the share of the last 7 calendar days (today inclusive) on
     * which this student solved (an Accepted "Submit", never just "Run") at
     * least 3 *distinct* problems. The submissions table has a unique
     * (user_id, problem_id, submitted_on) constraint, so one row per
     * problem per day already IS one distinct problem — no separate
     * dedup step needed, resubmitting an already-solved problem the same
     * day can never inflate that day's count.
     */
    public function practiceScore(): int
    {
        if ($this->practiceScoreCache !== null) {
            return $this->practiceScoreCache;
        }

        $since = now()->subDays(6)->toDateString();

        $daysMeetingTarget = $this->submissions()
            ->where('status', Submission::STATUS_ACCEPTED)
            ->where('submitted_on', '>=', $since)
            ->selectRaw('submitted_on, count(*) as solved_count')
            ->groupBy('submitted_on')
            ->havingRaw('count(*) >= 3')
            ->get()
            ->count();

        return $this->practiceScoreCache = (int) round(($daysMeetingTarget / 7) * 100);
    }

    /**
     * A college's subscription covers every one of its students for free —
     * only a student with no college pays individually. So "what plan is
     * this student actually on" checks the college first and only falls
     * back to the student's own subscription (defaults to the free Coder
     * plan — see SubscriptionService::ensureDefaultIndividualPlan) when
     * there's no college, or the college has no active plan.
     */
    public function effectiveSubscription(): ?Subscription
    {
        if ($this->college_id !== null) {
            $collegeSubscription = $this->college?->activeSubscription();

            if ($collegeSubscription !== null && $collegeSubscription->isActive()) {
                return $collegeSubscription;
            }
        }

        return $this->activeSubscription();
    }

    /**
     * The single source of truth every subscription-aware UI/API surface
     * reads from, so the "college pays for its students" rule lives in one
     * place rather than being re-derived per caller.
     *
     * @return array{source: string, subscription: ?Subscription, plan: ?Plan, days_remaining: ?int}
     */
    public function subscriptionCoverage(): array
    {
        $subscription = $this->effectiveSubscription();

        if ($subscription === null) {
            return ['source' => 'none', 'subscription' => null, 'plan' => null, 'days_remaining' => null];
        }

        $source = $subscription->subscriber_type === self::class ? 'individual' : 'institution';

        return [
            'source' => $source,
            'subscription' => $subscription,
            'plan' => $subscription->plan,
            'days_remaining' => $subscription->isActive() ? $subscription->daysRemaining() : 0,
        ];
    }

    /**
     * The actual practice/mock-interview/drive limits governing this
     * account right now — resolved from effectiveSubscription()'s plan
     * (college's plan first, own individual plan as fallback, exactly the
     * same precedence used for everything else subscription-related), so
     * a college-affiliated student is governed by their COLLEGE's tier, not
     * whatever individual plan they personally happen to be on. Falls back
     * to Coder's own values in the defensive case of no resolvable
     * subscription at all (shouldn't happen — every student gets one via
     * SubscriptionService::ensureDefaultIndividualPlan() on creation).
     *
     * @return array{max_practice_problems_per_day: ?int, max_mock_interviews_per_day: ?int, drive_access: bool}
     */
    public function effectiveEntitlements(): array
    {
        $plan = $this->effectiveSubscription()?->plan;

        if ($plan === null) {
            $plan = Plan::where('audience', Plan::AUDIENCE_INDIVIDUAL)->where('monthly_price', 0)->first();
        }

        return [
            'max_practice_problems_per_day' => $plan?->max_practice_problems_per_day,
            'max_mock_interviews_per_day' => $plan?->max_mock_interviews_per_day,
            'drive_access' => $plan?->drive_access ?? true,
        ];
    }

    /** The tier label the TPO cohort UI filters/displays by — see ReadinessScoreService::tierFor() for the actual bands. */
    public function readinessTier(): string
    {
        return $this->readinessBreakdown()['tier'];
    }
}
