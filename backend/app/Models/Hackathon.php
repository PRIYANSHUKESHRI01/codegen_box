<?php

namespace App\Models;

use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * One hackathon in the Hack Arena.
 *
 * Hosted either by the platform (Mellow Ops, `host_type = platform`) or by a
 * hiring partner (`host_type = company`, scoped to that Company). TPOs cannot
 * host. See AdminHackathonController / CompanyHackathonController for who may
 * touch what, and HackathonArenaController for the student-facing side.
 *
 * `status` only records the host's decision (draft → published → cancelled).
 * Where the event is in its life — opening soon, live, being judged, done — is
 * derived from the timestamps by phase(), never stored, so it can never be
 * stale and there is no scheduler job to forget to run.
 *
 *   registration_opens_at ─ registration_closes_at   (can overlap the event: late sign-ups)
 *   starts_at ───────────── ends_at                   ends_at is the submission deadline
 *   ends_at ─────────────── results_published_at      the judging window
 */
class Hackathon extends Model
{
    public const STATUS_DRAFT = 'draft';

    public const STATUS_PUBLISHED = 'published';

    public const STATUS_CANCELLED = 'cancelled';

    public const STATUSES = [self::STATUS_DRAFT, self::STATUS_PUBLISHED, self::STATUS_CANCELLED];

    /** Every student on the platform, including those who belong to no college. */
    public const AUDIENCE_ALL = 'all';

    /** Only students of the colleges mapped in `hackathon_colleges`. */
    public const AUDIENCE_COLLEGES = 'colleges';

    public const AUDIENCES = [self::AUDIENCE_ALL, self::AUDIENCE_COLLEGES];

    public const HOST_PLATFORM = 'platform';

    public const HOST_COMPANY = 'company';

    public const MODE_ONLINE = 'online';

    public const MODE_IN_PERSON = 'in_person';

    public const MODE_HYBRID = 'hybrid';

    public const MODES = [self::MODE_ONLINE, self::MODE_IN_PERSON, self::MODE_HYBRID];

    /** Colour families the frontend knows how to paint a cover and a page in. */
    public const ACCENTS = ['indigo', 'violet', 'fuchsia', 'rose', 'amber', 'emerald', 'teal', 'sky'];

    public const PHASE_DRAFT = 'draft';

    public const PHASE_CANCELLED = 'cancelled';

    /** Published, registration has not opened yet. */
    public const PHASE_UPCOMING = 'upcoming';

    public const PHASE_REGISTRATION_OPEN = 'registration_open';

    /** Registration has closed but the event has not started. */
    public const PHASE_STARTING_SOON = 'starting_soon';

    public const PHASE_LIVE = 'live';

    /** The deadline has passed; the host is scoring. */
    public const PHASE_JUDGING = 'judging';

    public const PHASE_COMPLETED = 'completed';

    /** Judging criteria used when a host does not write their own. Weights sum to 100. */
    public const DEFAULT_CRITERIA = [
        ['name' => 'Innovation', 'weight' => 30, 'description' => 'How original and well-chosen is the idea?'],
        ['name' => 'Technical depth', 'weight' => 30, 'description' => 'Quality of the build, architecture and engineering choices.'],
        ['name' => 'Impact', 'weight' => 25, 'description' => 'Does it solve a real problem for real people?'],
        ['name' => 'Presentation', 'weight' => 15, 'description' => 'Clarity of the write-up, demo and storytelling.'],
    ];

    /** Slugs that would collide with a frontend route segment. */
    private const RESERVED_SLUGS = ['new', 'edit', 'manage', 'my', 'mine', 'hackathon'];

    protected $fillable = [
        'slug',
        'title',
        'tagline',
        'description',
        'cover_image',
        'accent',
        'themes',
        'mode',
        'location',
        'host_type',
        'company_id',
        'created_by',
        'status',
        'audience',
        'registration_opens_at',
        'registration_closes_at',
        'starts_at',
        'ends_at',
        'results_expected_at',
        'results_published_at',
        'published_at',
        'cancelled_at',
        'cancelled_reason',
        'min_team_size',
        'max_team_size',
        'max_participants',
        'prize_pool_amount',
        'currency',
        'prizes',
        'tracks',
        'criteria',
        'rules',
        'eligibility',
        'faqs',
        'resources',
        'is_featured',
    ];

    protected function casts(): array
    {
        return [
            'themes' => 'array',
            'registration_opens_at' => 'datetime',
            'registration_closes_at' => 'datetime',
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
            'results_expected_at' => 'datetime',
            'results_published_at' => 'datetime',
            'published_at' => 'datetime',
            'cancelled_at' => 'datetime',
            'min_team_size' => 'integer',
            'max_team_size' => 'integer',
            'max_participants' => 'integer',
            'prize_pool_amount' => 'integer',
            'prizes' => 'array',
            'tracks' => 'array',
            'criteria' => 'array',
            'faqs' => 'array',
            'resources' => 'array',
            'is_featured' => 'boolean',
        ];
    }

    // ───────────────────────────── relations ─────────────────────────────

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /** The colleges this hackathon is mapped to. Only meaningful when `audience` is 'colleges'. */
    public function colleges(): BelongsToMany
    {
        return $this->belongsToMany(College::class, 'hackathon_colleges')->withTimestamps();
    }

    public function teams(): HasMany
    {
        return $this->hasMany(HackathonTeam::class);
    }

    public function participants(): HasMany
    {
        return $this->hasMany(HackathonParticipant::class);
    }

    public function submissions(): HasMany
    {
        return $this->hasMany(HackathonSubmission::class);
    }

    public function announcements(): HasMany
    {
        return $this->hasMany(HackathonAnnouncement::class)->latest();
    }

    // ───────────────────────────── scopes ─────────────────────────────

    /** What students may see at all: a draft or cancelled hackathon is invisible to them. */
    public function scopePublished(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_PUBLISHED);
    }

    /**
     * Narrow to what `$user` may see by audience. A student sees hackathons open to everyone plus those
     * mapped to their own college (a student with no college sees only the former). Anyone else — a host
     * previewing — is not narrowed here; their access is decided by isManagedBy().
     */
    public function scopeAvailableTo(Builder $query, User $user): Builder
    {
        if (! $user->isStudent()) {
            return $query;
        }

        return $query->where(function (Builder $q) use ($user) {
            $q->where('audience', self::AUDIENCE_ALL);

            if ($user->college_id !== null) {
                $q->orWhere(fn (Builder $mapped) => $mapped
                    ->where('audience', self::AUDIENCE_COLLEGES)
                    ->whereHas('colleges', fn (Builder $c) => $c->where('colleges.id', $user->college_id)));
            }
        });
    }

    // ───────────────────────────── lifecycle ─────────────────────────────

    public function isPublished(): bool
    {
        return $this->status === self::STATUS_PUBLISHED;
    }

    public function isCancelled(): bool
    {
        return $this->status === self::STATUS_CANCELLED;
    }

    public function isOpenToAll(): bool
    {
        return $this->audience !== self::AUDIENCE_COLLEGES;
    }

    /**
     * Whether this student's college is in the audience. The single check behind every student read and
     * the registration itself, mirroring scopeAvailableTo() for one hackathon.
     */
    public function isAvailableTo(User $user): bool
    {
        if (! $user->isStudent() || $this->isOpenToAll()) {
            return true;
        }

        return $user->college_id !== null && $this->colleges()->where('colleges.id', $user->college_id)->exists();
    }

    public function isHostedByCompany(): bool
    {
        return $this->host_type === self::HOST_COMPANY;
    }

    /**
     * The single definition of who may run (edit, judge, publish) this hackathon:
     *   - superadmin: any hackathon;
     *   - Mellow Ops with the `hackathons` permission: any hackathon (they host the platform's own and
     *     moderate partners');
     *   - a hiring partner: only a hackathon their own company hosts.
     * Everyone else — notably a college TPO — never.
     */
    public function isManagedBy(User $user): bool
    {
        return match ($user->role) {
            User::ROLE_SUPERADMIN => true,
            User::ROLE_ADMIN_INTERNAL => $user->hasPermission(User::PERM_HACKATHONS),
            User::ROLE_ADMIN_COMPANY => $this->isHostedByCompany()
                && $user->company_id !== null
                && $this->company_id === $user->company_id,
            default => false,
        };
    }

    /** Where this hackathon is in its life right now. */
    public function phase(?CarbonInterface $now = null): string
    {
        $now ??= now();

        if ($this->status === self::STATUS_DRAFT) {
            return self::PHASE_DRAFT;
        }

        if ($this->status === self::STATUS_CANCELLED) {
            return self::PHASE_CANCELLED;
        }

        if ($now->gte($this->ends_at)) {
            return $this->results_published_at !== null ? self::PHASE_COMPLETED : self::PHASE_JUDGING;
        }

        if ($now->gte($this->starts_at)) {
            return self::PHASE_LIVE;
        }

        if ($now->gte($this->registration_opens_at)) {
            return $now->lte($this->registration_closes_at) ? self::PHASE_REGISTRATION_OPEN : self::PHASE_STARTING_SOON;
        }

        return self::PHASE_UPCOMING;
    }

    /** Whether students can currently sign up — a time check only; capacity is the registration service's job. */
    public function isRegistrationWindowOpen(?CarbonInterface $now = null): bool
    {
        $now ??= now();

        return $this->isPublished()
            && $now->gte($this->registration_opens_at)
            && $now->lte($this->registration_closes_at)
            && $now->lt($this->ends_at);
    }

    /** Projects can be created and edited from kickoff until the deadline. */
    public function isSubmissionWindowOpen(?CarbonInterface $now = null): bool
    {
        $now ??= now();

        return $this->isPublished() && $now->gte($this->starts_at) && $now->lt($this->ends_at);
    }

    public function hasEnded(?CarbonInterface $now = null): bool
    {
        return ($now ?? now())->gte($this->ends_at);
    }

    public function resultsArePublished(): bool
    {
        return $this->results_published_at !== null;
    }

    /** Whether a student can still change which team they are on. Locked at the deadline. */
    public function isTeamChangeWindowOpen(?CarbonInterface $now = null): bool
    {
        return $this->isPublished() && ! $this->hasEnded($now);
    }

    public function allowsTeams(): bool
    {
        return $this->max_team_size > 1;
    }

    /** @return list<array{name: string, weight: int|float, description: ?string}> */
    public function effectiveCriteria(): array
    {
        $criteria = $this->criteria;

        return is_array($criteria) && $criteria !== [] ? array_values($criteria) : self::DEFAULT_CRITERIA;
    }

    /** @return array{place: int, title: string, reward: ?string, perks: list<string>}|null */
    public function prizeForPlace(int $place): ?array
    {
        foreach ($this->prizes ?? [] as $prize) {
            if ((int) ($prize['place'] ?? 0) === $place) {
                return $prize;
            }
        }

        return null;
    }

    /** The public URL of the cover, wherever it lives; null when the hackathon has none. */
    public function coverUrl(): ?string
    {
        $cover = $this->cover_image;

        if ($cover === null || $cover === '') {
            return null;
        }

        // An absolute URL, or an asset the frontend itself ships under /public.
        if (preg_match('#^(https?:)?//#', $cover) === 1 || str_starts_with($cover, '/')) {
            return $cover;
        }

        return Storage::disk('public')->url($cover);
    }

    /** True when `cover_image` is a file this app stored (and so should delete), not an external or bundled asset. */
    public function hasStoredCover(): bool
    {
        $cover = $this->cover_image;

        return $cover !== null && $cover !== '' && preg_match('#^(https?:)?//#', $cover) !== 1 && ! str_starts_with($cover, '/');
    }

    public static function uniqueSlug(string $title, ?int $ignoreId = null): string
    {
        $base = Str::slug(Str::limit($title, 80, '')) ?: 'hackathon';
        $slug = $base;
        $suffix = 1;

        while (
            in_array($slug, self::RESERVED_SLUGS, true)
            || self::where('slug', $slug)->when($ignoreId, fn ($q) => $q->whereKeyNot($ignoreId))->exists()
        ) {
            $suffix++;
            $slug = "{$base}-{$suffix}";
        }

        return $slug;
    }
}
