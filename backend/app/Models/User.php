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
use App\Support\AcademicYear;
use App\Support\BranchAudience;
use App\Support\BranchCatalog;
use App\Support\BranchNormalizer;
use App\Support\DepartmentCapabilities;
use App\Support\StudentPreferences;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\HasApiTokens;
use Laravel\Sanctum\PersonalAccessToken;

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
     * The tabs on the public /login page ("portals") and which accounts each one admits — what the visitor picked
     * is a promise about who they are, so the server holds them to it (see AuthController::login). A section
     * coordinator is college staff the TPO provisions, so they sign in through the College TPO tab. The 'staff'
     * portal is the unlisted /mellow-internal page: it admits nobody of its own beyond the platform staff below.
     */
    public const LOGIN_PORTALS = [
        'user' => [self::ROLE_USER],
        'admin_tpo' => [self::ROLE_ADMIN_TPO, self::ROLE_SECTION_COORDINATOR],
        'admin_company' => [self::ROLE_ADMIN_COMPANY],
        'staff' => [],
    ];

    /** Mellow's own people: they may sign in through any portal (they support every kind of customer). */
    public const PLATFORM_STAFF_ROLES = [
        self::ROLE_SUPERADMIN,
        self::ROLE_ADMIN_INTERNAL,
        self::ROLE_ADMIN_MARKETING,
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

    /** Oversee the Vault — the students who are ready to be hired, and their hand-off to Mellow Vault. See App\Models\VaultProfile. */
    public const PERM_VAULT = 'vault';

    /** Author Mellow-curated (general) Soft Skills tests and manage the shared question bank — see App\Models\SoftSkillAssessment. */
    public const PERM_SOFT_SKILLS = 'soft_skills';

    /** Author Project Lab topics and SOWs, and review student project submissions — see App\Models\ProjectTopic. */
    public const PERM_PROJECT_LAB = 'project_lab';

    /** Host and judge hackathons in the Hack Arena — see App\Models\Hackathon. */
    public const PERM_HACKATHONS = 'hackathons';

    /** Author Core Prep (branch technical) questions, review and import them — see App\Models\CoreQuestion. */
    public const PERM_CORE_PREP = 'core_prep';

    public const PERMISSIONS_INTERNAL = [
        self::PERM_COLLEGES,
        self::PERM_PLATFORM_USERS,
        self::PERM_PROBLEM_BANK,
        self::PERM_PLACEMENTS,
        self::PERM_CONTESTS,
        self::PERM_INTERVIEWS,
        self::PERM_CUSTOMERS,
        self::PERM_ARTICLES,
        self::PERM_VAULT,
        self::PERM_SOFT_SKILLS,
        self::PERM_PROJECT_LAB,
        self::PERM_HACKATHONS,
        self::PERM_CORE_PREP,
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
     * The department a roster import / manual add is writing this student into, for the NEXT save only (never stored as such).
     * It decides ambiguous branch labels ("Finance") and fills `department` when the label is missing or not recognised.
     * Plain property, not an attribute: it must not be mass-assignable or serialized.
     */
    public ?string $departmentHint = null;

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
        // CompanyVaultController's resume route).
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
    protected $appends = ['avatar_url', 'has_resume', 'onboarding_pending', 'branch_pending', 'core_enabled', 'capabilities', 'study_year'];

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
            // Which branches of its section a Section Coordinator looks after ({disciplines, branches}); null = the whole
            // section. forceFill-only, like is_blocked: only SectionCoordinatorService writes it.
            'coordinator_scope' => 'array',
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
            // Onboarding answers — cast but deliberately NOT in $fillable,
            // same as is_blocked: only StudentPreferencesController writes
            // them, via forceFill(), after validating against
            // App\Support\StudentPreferences.
            'onboarding_completed_at' => 'datetime',
            'onboarding_skipped_at' => 'datetime',
            // Stamped by AuthController (login + throttled /me) — never mass-assigned.
            'last_seen_at' => 'datetime',
            // The year a college student passes out (their year of study is derived from it - see AcademicYear). Set only by the
            // college's staff (roster import, add student, "set year"), so deliberately NOT in $fillable: a student cannot move
            // themselves up a year to reach the Vault AI Interview sooner.
            'graduation_year' => 'integer',
            // First real sign-in (starts the Vault AI Interview's wait) and the kept unlock — AuthController / VaultAiAccessService only.
            'first_login_at' => 'datetime',
            'vault_ai_unlocked_at' => 'datetime',
            // The two scores kept on the student for filtering and ranking - written only by ScoreLedger, never mass-assigned.
            'readiness_score' => 'integer',
            'readiness_scored_at' => 'datetime',
            'vault_ai_score' => 'float',
            'vault_ai_scored_at' => 'datetime',
            // Set by the unsubscribe link in a nudge e-mail (EmailPreferenceController) — never mass-assigned.
            'email_nudges_opt_out_at' => 'datetime',
            // What the person MUTED in Settings → Notifications ({"muted": ["hackathons"]}) — written only by NotificationService.
            'notification_prefs' => 'array',
            'preferred_languages' => 'array',
            'focus_areas' => 'array',
            // Branch resolution (see BranchAssignmentService / the `saving` hook below) — written
            // directly by the server, never mass-assigned.
            'branch_confirmed_at' => 'datetime',
            'branch_disputed_at' => 'datetime',
            'branch_prompt_skipped_at' => 'datetime',
            'core_interests' => 'array',
            // Written by the server only (roster import, branch resolution, the student's own Settings toggle) — never mass-assigned.
            'coding_opt_in' => 'boolean',
        ];
    }

    protected static function booted(): void
    {
        // Whoever writes `branch` (TPO import, manual add, superadmin edit) is a staff/college
        // actor — students cannot set it — so a changed label is resolved here, once, for every
        // path, rather than in each controller.
        static::saving(function (User $user) {
            if ($user->role !== self::ROLE_USER) {
                return;
            }

            // A roster import / manual add into a department: it is the department even when the label says nothing.
            if ($user->departmentHint !== null && $user->department === null && self::hasDepartmentColumn()) {
                $user->department = $user->departmentHint;
            }

            $selfDeclared = $user->isDirty('branch_source') && $user->branch_source === 'self';
            $labelChanged = $user->isDirty('branch') || ($user->exists && $user->isDirty('college_id'));

            if ($selfDeclared || ! $labelChanged) {
                return;
            }

            $user->resolveBranchFromLabel();
        });
    }

    /** Whether the departments migration has run (a deploy may ship code before `migrate`); only a positive answer is remembered. */
    private static function hasDepartmentColumn(): bool
    {
        static $present = false;

        return $present || ($present = Schema::hasColumn('users', 'department'));
    }

    /**
     * Resolves the raw `branch` text the college provided into branch_code /
     * discipline (using that college's own mappings first). Fails soft: a
     * missing catalogue or column must never stop a student from being saved.
     */
    public function resolveBranchFromLabel(): void
    {
        // Only a positive answer is remembered: before `php artisan migrate` has run the column is
        // missing and we must keep checking (and skipping), never cache "no" for the process.
        static $columns = false;

        if (! $columns && ! ($columns = Schema::hasColumn('users', 'branch_code'))) {
            return;
        }

        $raw = trim((string) $this->branch);

        if ($raw === '') {
            // A label was removed. Only clear what the college itself had provided.
            if ($this->branch_source === 'college') {
                // The department stays: it is what the college onboarded this student as, with or without a branch label.
                $this->branch_key = $this->branch_code = $this->discipline = $this->branch_source = null;
            }

            return;
        }

        try {
            $catalog = app(BranchCatalog::class);
            $hint = $this->departmentHint ?? $this->department;
            $code = $catalog->resolve($raw, $this->college_id, $hint);

            $this->branch_key = BranchNormalizer::key($raw);
            $this->branch_code = $code;
            $this->discipline = $catalog->disciplineOf($code);
            $this->branch_source = 'college';

            if (self::hasDepartmentColumn()) {
                // A recognised branch decides the department; an unrecognised one keeps the department we were told (or already had).
                $this->department = $catalog->departmentOf($code) ?? $hint ?? $this->department;
            }
        } catch (\Throwable $e) {
            report($e);
        }
    }

    /**
     * A person's name always starts every word with a capital, whatever they typed at sign-up ("alex chen" -> "Alex Chen").
     *
     * Applied both ways on purpose: when a name is SET it is stored tidied, so new accounts (sign-up, roster import, add-student)
     * are right at the source; and when it is READ it is tidied again, so accounts written before this rule existed read correctly
     * everywhere (the dashboard, e-mails, reports, the hand-off to Mellow Vault) without rewriting anyone's stored data.
     */
    protected function name(): Attribute
    {
        return Attribute::make(
            get: fn (?string $value) => self::properName($value),
            set: fn (?string $value) => self::properName($value),
        );
    }

    /**
     * Capitalises the first letter of each word of a name (and of a hyphenated part: "anne-marie" -> "Anne-Marie"), collapses runs of
     * spaces and trims. It only ever RAISES a lowercase letter that opens a word: nothing else is touched, so "McDonald", "DSouza",
     * "O'Brien" and an all-capitals "AKASH" are left exactly as typed rather than "corrected" into something wrong.
     */
    public static function properName(?string $name): ?string
    {
        if ($name === null) {
            return null;
        }

        $name = trim((string) preg_replace('/\s+/u', ' ', $name));

        return (string) preg_replace_callback('/(^|[\s\-])(\p{Ll})/u', fn (array $m) => $m[1].mb_strtoupper($m[2]), $name);
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

    /**
     * True when this student should be shown the first-login onboarding
     * wizard now: they are a student, have never completed it, and either
     * never skipped it or skipped it long enough ago (see
     * StudentPreferences::SKIP_COOLDOWN_DAYS) to be worth asking again. The
     * rule lives here, on the server, so every client agrees on it.
     */
    public function needsOnboarding(): bool
    {
        if (! $this->isStudent() || $this->onboarding_completed_at !== null) {
            return false;
        }

        return $this->onboarding_skipped_at === null
            || $this->onboarding_skipped_at->lte(now()->subDays(StudentPreferences::SKIP_COOLDOWN_DAYS));
    }

    /**
     * True when this student should be asked about their branch now: we don't know it yet (the college
     * gave none or one we don't recognise, and they haven't said), or — once Core Prep is live for their
     * family — they haven't chosen what to lead with. Skippable with the same cool-off as the wizard.
     *
     * Deliberately QUERY-FREE (it is serialized on every user in every roster): the only lookup is the
     * in-memory branch catalogue. Fails closed to "don't ask" if the catalogue is unavailable.
     */
    public function needsBranchConfirmation(): bool
    {
        if (! $this->isStudent()) {
            return false;
        }

        if ($this->branch_prompt_skipped_at !== null
            && $this->branch_prompt_skipped_at->gt(now()->subDays(StudentPreferences::SKIP_COOLDOWN_DAYS))) {
            return false;
        }

        if ($this->branch_code === null) {
            // A student who wrote their own branch ("my branch isn't listed") has answered; there is nothing more to ask
            // until their TPO maps it to a listed one.
            return ! ($this->branch_source === 'self' && trim((string) $this->branch) !== '');
        }

        if ($this->track_focus !== null || ! $this->hasDomainPrepFamily()) {
            return false;
        }

        // "Lead with your branch, or with IT roles?" only means something where the programme codes at all. A Commerce, Management
        // or Arts student has no IT track to weigh it against — asking them would be a blocking dialog with nothing to answer.
        if (! (DepartmentCapabilities::forUser($this)['coding_practice'] ?? true)) {
            return false;
        }

        try {
            return BranchCatalog::instance()->coreEnabledFor($this->discipline, $this->college_id);
        } catch (\Throwable) {
            return false;
        }
    }

    /**
     * Whether this student's department / discipline / branch has Domain Prep (Core Prep, Management Prep …) at all — the
     * capability, not whether it is switched on for their college (that is coreEnabledFor) or has questions (CoreAccess).
     * Query-free.
     */
    public function hasDomainPrepFamily(): bool
    {
        return $this->discipline !== null && DepartmentCapabilities::forUser($this)['domain_prep'];
    }

    /**
     * Serialized as `capabilities`: which modules this student sees (see App\Support\DepartmentCapabilities). Null for every
     * account that is not a student. Not memoised: a save can move the student to another department mid-request, and the
     * resolution is a few array merges over the memoised catalogue.
     */
    protected function capabilities(): Attribute
    {
        return Attribute::make(
            get: function () {
                if (! $this->isStudent()) {
                    return null;
                }

                try {
                    return DepartmentCapabilities::forUser($this);
                } catch (\Throwable) {
                    return null;
                }
            },
        );
    }

    /** Serialized as `branch_pending` — the frontend never re-derives the cool-off or the "Core Prep is live" rule. */
    protected function branchPending(): Attribute
    {
        return Attribute::make(
            get: fn () => $this->needsBranchConfirmation(),
        );
    }

    /**
     * Serialized as `core_enabled`: Core Prep is switched on for this student's branch family at their college (live for
     * everyone, or their college is a pilot). Query-free like `branch_pending`; it says nothing about whether any
     * questions exist. The onboarding wizard uses it to decide whether to ask the Core/IT track question.
     */
    protected function coreEnabled(): Attribute
    {
        return Attribute::make(
            get: function () {
                if (! $this->isStudent() || ! $this->hasDomainPrepFamily()) {
                    return false;
                }

                try {
                    return BranchCatalog::instance()->coreEnabledFor($this->discipline, $this->college_id);
                } catch (\Throwable) {
                    return false;
                }
            },
        );
    }

    /** Serialized as `onboarding_pending` so the frontend never re-derives the skip cool-off itself. */
    protected function onboardingPending(): Attribute
    {
        return Attribute::make(
            get: fn () => $this->needsOnboarding(),
        );
    }

    /**
     * The year of study (1..4) a college student is in right now, derived from their passing-out year; above 4 once they have passed
     * out. Null when no year is on file (and always for anyone who is not a student of a college).
     */
    protected function studyYear(): Attribute
    {
        return Attribute::make(
            get: fn () => $this->role === self::ROLE_USER && $this->college_id !== null
                ? AcademicYear::studyYearOf(isset($this->attributes['graduation_year']) ? (int) $this->attributes['graduation_year'] : null)
                : null,
        );
    }

    /** Whether the years migration has run (a deploy may ship code before `migrate`); only a positive answer is remembered. */
    public static function hasYearColumn(): bool
    {
        static $present = false;

        return $present || ($present = Schema::hasColumn('users', 'graduation_year'));
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

    /** This student's place in the Vault, if they have ever been ready or said they want in — see App\Models\VaultProfile. Null for everyone else (staff/TPO/company accounts never have one). */
    public function vaultProfile(): HasOne
    {
        return $this->hasOne(VaultProfile::class);
    }

    /** Every lifecycle e-mail sent to this user — see App\Models\LifecycleEmailLog. */
    public function lifecycleEmails(): HasMany
    {
        return $this->hasMany(LifecycleEmailLog::class);
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

    /** A marketing employee's own book of "Talk to Our Team" contact requests — a separate, independently load-balanced queue from assignedLeads() above (see LeadAssignmentService). */
    public function assignedContactRequests(): HasMany
    {
        return $this->hasMany(ContactRequest::class, 'assigned_marketing_id');
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

    /**
     * THE definition of "the students this Section Coordinator looks after": students (never staff) of the coordinator's
     * own college, in their own section, and — when the coordinator was given a branch scope — of those branches. Every place
     * a coordinator reads or acts on a student (the roster, reports, notifications, blocking, notes, proctoring, the
     * violation e-mail) goes through this one query, so what the list shows and what an id-guess is allowed to reach can
     * never disagree.
     *
     * Sections are compared trimmed and case-insensitively IN SQL, so "a " and "A" are one section on every database (MySQL
     * already folded case, SQLite did not — the roster and the single-student checks used to disagree on that).
     * A coordinator with no college or no section sees nobody rather than every unsectioned student.
     * A branch-scoped coordinator never sees a student whose branch is unknown: that student belongs to the TPO until their
     * branch is mapped.
     */
    public function scopeCoordinatedBy(Builder $query, User $coordinator): Builder
    {
        $query->where('users.role', self::ROLE_USER);

        $section = trim((string) $coordinator->section);

        if ($coordinator->role !== self::ROLE_SECTION_COORDINATOR || $coordinator->college_id === null || $section === '') {
            return $query->whereRaw('1 = 0');
        }

        $query->where('users.college_id', $coordinator->college_id)
            ->whereRaw('LOWER(TRIM(users.section)) = ?', [mb_strtolower($section)]);

        $scope = BranchAudience::normalize($coordinator->coordinator_scope);

        if ($scope !== null) {
            $query->where(function (Builder $either) use ($scope) {
                // Any of: a whole department, a whole branch family, or one specific branch.
                if (($scope['departments'] ?? []) !== []) {
                    $either->orWhereIn('users.department', $scope['departments']);
                }
                if ($scope['disciplines'] !== []) {
                    $either->orWhereIn('users.discipline', $scope['disciplines']);
                }
                if ($scope['branches'] !== []) {
                    $either->orWhereIn('users.branch_code', $scope['branches']);
                }
            });
        }

        return $query;
    }

    /** In-memory twin of scopeCoordinatedBy() for a student already loaded (a parity test pins the two together). */
    public function coordinates(User $student): bool
    {
        $section = mb_strtolower(trim((string) $this->section));

        if ($this->role !== self::ROLE_SECTION_COORDINATOR || $this->college_id === null || $section === ''
            || $student->role !== self::ROLE_USER || (int) $student->college_id !== (int) $this->college_id
            || mb_strtolower(trim((string) $student->section)) !== $section) {
            return false;
        }

        $scope = BranchAudience::normalize($this->coordinator_scope);

        return $scope === null
            || ($student->department !== null && in_array($student->department, $scope['departments'] ?? [], true))
            || ($student->discipline !== null && in_array($student->discipline, $scope['disciplines'], true))
            || ($student->branch_code !== null && in_array($student->branch_code, $scope['branches'], true));
    }

    /**
     * Narrow to the students of one department. A student with no department recorded yet counts as the fallback department
     * (engineering) — the product's one department until this existed — so filtering "Engineering" never loses anybody that was
     * simply never classified, and filtering any other department never shows them.
     */
    public function scopeInDepartment(Builder $query, ?string $department): Builder
    {
        if ($department === null || $department === '') {
            return $query;
        }

        return $query->where(function (Builder $q) use ($department) {
            $q->where('users.department', $department);

            if ($department === (string) config('departments.fallback', Department::ENGINEERING)) {
                $q->orWhereNull('users.department');
            }
        });
    }

    /**
     * Narrow to the students in one year of study (1..4). `0` means "no year on file"; a year above the programme means "passed out".
     * Works on the stored passing-out year, so the answer moves on by itself every July.
     */
    public function scopeInStudyYear(Builder $query, int $studyYear): Builder
    {
        if ($studyYear === 0) {
            return $query->whereNull('users.graduation_year');
        }

        if ($studyYear > AcademicYear::programmeYears()) {
            return $query->where('users.graduation_year', '<', AcademicYear::graduationYearFor(AcademicYear::programmeYears()));
        }

        return $query->where('users.graduation_year', AcademicYear::graduationYearFor($studyYear));
    }

    public function isCompanyAdmin(): bool
    {
        return $this->role === self::ROLE_ADMIN_COMPANY;
    }

    /** A student who belongs to a college (as opposed to a direct AptRun user): the people the year-wise rules apply to. */
    public function isCollegeStudent(): bool
    {
        return $this->role === self::ROLE_USER && $this->college_id !== null;
    }

    public function isStudent(): bool
    {
        return $this->role === self::ROLE_USER;
    }

    public function isMellowMarketing(): bool
    {
        return $this->role === self::ROLE_ADMIN_MARKETING;
    }

    /** Whether this account may sign in through the given /login portal (a key of LOGIN_PORTALS). Platform staff may use any. */
    public function canSignInThrough(string $portal): bool
    {
        return in_array($this->role, self::PLATFORM_STAFF_ROLES, true)
            || in_array($this->role, self::LOGIN_PORTALS[$portal] ?? [], true);
    }

    /** The /login portal this account belongs to — the tab it signs in through; null for platform staff, who belong to none. */
    public function ownLoginPortal(): ?string
    {
        foreach (self::LOGIN_PORTALS as $portal => $roles) {
            if (in_array($this->role, $roles, true)) {
                return $portal;
            }
        }

        return null;
    }

    public function isPhoneVerified(): bool
    {
        return $this->phone_verified_at !== null;
    }

    /** Prefix of the Sanctum token name a superadmin's "view as" session carries; the rest is the superadmin's id. */
    public const IMPERSONATION_TOKEN_PREFIX = 'impersonation:';

    /** The one ability such a token carries — never '*', so it can be told apart from a real login. */
    public const IMPERSONATION_ABILITY = 'impersonated';

    /**
     * True when THIS request is a superadmin looking at the account through
     * "view as" rather than the account's own owner signed in. Judged from the
     * token the request arrived with, so it cannot be spoofed by anything the
     * client sends; false for a first-party/transient token (and in tests that
     * act as a user without a real token).
     */
    public function isBeingImpersonated(): bool
    {
        $token = $this->currentAccessToken();

        return $token instanceof PersonalAccessToken
            && in_array(self::IMPERSONATION_ABILITY, $token->abilities ?? [], true);
    }

    /** The superadmin behind a "view as" session, or null when this is not one. */
    public function impersonatorId(): ?int
    {
        $token = $this->currentAccessToken();

        if (! $token instanceof PersonalAccessToken || ! $this->isBeingImpersonated()) {
            return null;
        }

        $id = substr((string) $token->name, strlen(self::IMPERSONATION_TOKEN_PREFIX));

        return ctype_digit($id) ? (int) $id : null;
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
     * resume upload/delete) so CompanyVaultController can `ORDER BY` it
     * directly in SQL to rank more-complete profiles first in search.
     *
     * NOT the same thing as readinessScore() below — that is what a student
     * has done on the platform; this is entirely different fields
     * (bio/links/skills/resume/avatar/phone), self-edited on the Settings
     * page, and recruiter-facing.
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
     * The explainable form of readinessScore() — one score, one set of rules,
     * for every student whether or not they belong to a college. See
     * App\Services\ReadinessScoreService for the weighting (AI interviews,
     * coding practice, Learning Centre, soft skills, contests, participation,
     * consistency) and config/readiness.php for the numbers.
     *
     * Computed once per instance: readinessScore()/readinessTier() read from
     * here instead of each re-deriving it, and the 7-day practice score the
     * roster shows beside it is seeded in the same pass so practiceScore() is
     * free afterwards.
     *
     * @return array{score: int, tier: string, components: array, next_steps: array<int, string>, vault: array{threshold: int, qualifies: bool, points_needed: int}}
     */
    public function readinessBreakdown(): array
    {
        if ($this->readinessBreakdownCache === null) {
            $result = app(ReadinessScoreService::class)->compute([$this])[$this->id];
            $this->primeReadiness($result['breakdown'], $result['practice_score']);
        }

        return $this->readinessBreakdownCache;
    }

    /**
     * Seeds the per-instance caches above from a bulk computation — see
     * ReadinessScoreService::prime(), which scores a whole cohort in a handful
     * of queries. Callers that loop over many students prime first;
     * readinessScore()/practiceScore() then never query.
     *
     * @param  array{score: int, tier: string, components: array, next_steps: array<int, string>, vault: array}  $breakdown
     */
    public function primeReadiness(array $breakdown, int $practiceScore): void
    {
        $this->readinessBreakdownCache = $breakdown;
        $this->practiceScoreCache = $practiceScore;
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
     * @return array{source: string, subscription: ?Subscription, plan: ?Plan, days_remaining: ?int, is_trial: bool}
     */
    public function subscriptionCoverage(): array
    {
        $subscription = $this->effectiveSubscription();

        if ($subscription === null) {
            return ['source' => 'none', 'subscription' => null, 'plan' => null, 'days_remaining' => null, 'is_trial' => false];
        }

        $source = $subscription->subscriber_type === self::class ? 'individual' : 'institution';

        return [
            'source' => $source,
            'subscription' => $subscription,
            'plan' => $subscription->plan,
            'days_remaining' => $subscription->isActive() ? $subscription->daysRemaining() : 0,
            'is_trial' => $subscription->is_trial,
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
     * hackathon_access / vault_access / feature_trial_uses are the plan's
     * feature switches and free-trial allowance — see PlanGate, which is what
     * actually enforces them.
     *
     * @return array{max_practice_problems_per_day: ?int, max_mock_interviews_per_day: ?int, max_learning_centre_ai_attempts_per_day: ?int, feature_trial_uses: ?int, drive_access: bool, hackathon_access: bool, vault_access: bool}
     */
    public function effectiveEntitlements(): array
    {
        $subscription = $this->effectiveSubscription();

        // A paid plan past its end date grants nothing, the moment the date passes — not whenever
        // `subscriptions:expire` next flips its status (daily, and only if the host's cron runs at
        // all). Judging the date here is what makes "paid features only while the plan is paid" hold.
        $plan = $subscription !== null && $subscription->isActive() ? $subscription->plan : null;

        if ($plan === null) {
            $plan = Plan::where('audience', Plan::AUDIENCE_INDIVIDUAL)->where('list_price', 0)->first();
        }

        return [
            'max_practice_problems_per_day' => $plan?->max_practice_problems_per_day,
            'max_mock_interviews_per_day' => $plan?->max_mock_interviews_per_day,
            'max_learning_centre_ai_attempts_per_day' => $plan?->max_learning_centre_ai_attempts_per_day,
            'feature_trial_uses' => $plan?->feature_trial_uses,
            'drive_access' => $plan?->drive_access ?? true,
            'hackathon_access' => $plan?->hackathon_access ?? true,
            'vault_access' => $plan?->vault_access ?? true,
            // Core Prep (branch technical practice and tests): null = unlimited practice; tests are a switch.
            'max_core_practice_per_day' => $plan?->max_core_practice_per_day,
            'core_tests_access' => $plan?->core_tests_access ?? true,
        ];
    }

    /**
     * Where this student's Project Lab access comes from, resolved in one
     * place so every gate (API, sidebar, workspace start, reaper) reads the
     * same answer. Precedence:
     *   1. their own in-date Project Lab add-on — carries its own hour and
     *      active-project limits, and its period is what "hours used" is
     *      counted against;
     *   2. the plan that governs them (their college's, else their own base
     *      plan) when that plan sets project_lab_access — a college can later
     *      be granted Lab without every student buying it. Hours then count
     *      per calendar month. Expert and Grandmaster set the flag, and so can a college plan.
     *
     * @return array{access: bool, source: 'addon'|'plan'|'institution'|'none', plan: ?Plan, subscription: ?Subscription, period_started_at: ?\Illuminate\Support\Carbon, period_ends_at: ?\Illuminate\Support\Carbon, days_remaining: ?int, max_workspace_hours_per_month: ?int, max_active_projects: ?int}
     */
    public function projectLabCoverage(): array
    {
        $none = [
            'access' => false,
            'source' => 'none',
            'plan' => null,
            'subscription' => null,
            'period_started_at' => null,
            'period_ends_at' => null,
            'days_remaining' => null,
            'max_workspace_hours_per_month' => null,
            'max_active_projects' => null,
        ];

        $addon = $this->activeAddonSubscriptions()->first(fn (Subscription $s) => $s->plan?->project_lab_access);

        if ($addon !== null) {
            return [
                'access' => true,
                'source' => 'addon',
                'plan' => $addon->plan,
                'subscription' => $addon,
                'period_started_at' => $addon->started_at,
                'period_ends_at' => $addon->current_period_end,
                'days_remaining' => $addon->daysRemaining(),
                'max_workspace_hours_per_month' => $addon->plan->max_workspace_hours_per_month,
                'max_active_projects' => $addon->plan->max_active_projects,
            ];
        }

        $effective = $this->effectiveSubscription();

        if ($effective !== null && $effective->isActive() && $effective->plan?->project_lab_access) {
            return [
                'access' => true,
                'source' => $effective->subscriber_type === self::class ? 'plan' : 'institution',
                'plan' => $effective->plan,
                'subscription' => $effective,
                'period_started_at' => now()->startOfMonth(),
                'period_ends_at' => $effective->current_period_end,
                'days_remaining' => $effective->daysRemaining(),
                'max_workspace_hours_per_month' => $effective->plan->max_workspace_hours_per_month,
                'max_active_projects' => $effective->plan->max_active_projects,
            ];
        }

        return $none;
    }

    public function hasProjectLabAccess(): bool
    {
        return $this->projectLabCoverage()['access'];
    }

    /** The tier label the TPO cohort UI filters/displays by — see ReadinessScoreService::tierFor() for the actual bands. */
    public function readinessTier(): string
    {
        return $this->readinessBreakdown()['tier'];
    }
}
