<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

/**
 * AI Interview — structural sibling of Contest (see that model's docblock
 * for the shared reasoning), sharing its 4-way ownership pattern
 * (general/company/tpo_mock/company_hiring) but async/self-paced rather
 * than a timed live event: no start_at/end_at, no rating, no finalize step.
 * A candidate answers each attached question by voice (or a text fallback
 * — see frontend VoiceEngine).
 *
 * For a STANDALONE interview (interview_track_id null), nothing here scores
 * an answer — a human reviews the transcript/recording and manually moves
 * the linked DriveApplication.stage, exactly like technical_interview/hr_round
 * already work today. For a TRACK ROUND (interview_track_id set — see
 * App\Models\InterviewTrack), that changes: a human still reviews it, but
 * now assigns each InterviewResponse a 0-100 score, and
 * InterviewTrackAdvancementService computes a category-weighted composite
 * (using this row's own snapshotted category_weights) against
 * qualifying_score_percent to decide whether the candidate's next round
 * auto-unlocks. See Interview::isVisibleToUser()'s track branch for how
 * round 2/3 stay invite-only regardless of interview_type.
 */
class Interview extends Model
{
    public const STATUS_DRAFT = 'draft';

    public const STATUS_PUBLISHED = 'published';

    public const STATUS_CANCELLED = 'cancelled';

    public const STATUSES = [self::STATUS_DRAFT, self::STATUS_PUBLISHED, self::STATUS_CANCELLED];

    /** Mellow-staff-curated, platform-wide. */
    public const INTERVIEW_TYPE_GENERAL = 'general';

    /** Mellow-staff-curated, tied to one company/drive — visible only to colleges that drive is mapped+approved to. */
    public const INTERVIEW_TYPE_COMPANY = 'company';

    /** A college TPO's own private practice interview for their own students only. */
    public const INTERVIEW_TYPE_TPO_MOCK = 'tpo_mock';

    /** A company hiring tenant's own interview, tied to one of their job openings. Always invite-only — see isVisibleToUser(). */
    public const INTERVIEW_TYPE_COMPANY_HIRING = 'company_hiring';

    /** Mellow-staff-curated, NOT tied to any company/drive — the optional second stage of a Talent Pool scouting assessment, alongside CONTEST_TYPE_TALENT_POOL. Targeted the same way (audience_scope). */
    public const INTERVIEW_TYPE_TALENT_POOL = 'talent_pool';

    public const INTERVIEW_TYPES = [
        self::INTERVIEW_TYPE_GENERAL,
        self::INTERVIEW_TYPE_COMPANY,
        self::INTERVIEW_TYPE_TPO_MOCK,
        self::INTERVIEW_TYPE_COMPANY_HIRING,
        self::INTERVIEW_TYPE_TALENT_POOL,
    ];

    public const AUDIENCE_SCOPE_ALL = 'all';

    public const AUDIENCE_SCOPE_COLLEGE = 'college';

    public const AUDIENCE_SCOPE_DIRECT = 'direct';

    public const AUDIENCE_SCOPES = [
        self::AUDIENCE_SCOPE_ALL,
        self::AUDIENCE_SCOPE_COLLEGE,
        self::AUDIENCE_SCOPE_DIRECT,
    ];

    protected $fillable = [
        'title',
        'slug',
        'description',
        'status',
        'interview_type',
        'is_mock',
        'company_id',
        'placement_drive_id',
        'owning_college_id',
        'owning_company_id',
        'created_by',
        'audience_scope',
        'interview_track_id',
        'round_number',
        'round_name',
        'category_weights',
        'qualifying_score_percent',
    ];

    protected function casts(): array
    {
        return [
            'is_mock' => 'boolean',
            'round_number' => 'integer',
            'category_weights' => 'array',
            'qualifying_score_percent' => 'decimal:2',
        ];
    }

    public function getRouteKeyName(): string
    {
        return 'slug';
    }

    public function interviewQuestions(): HasMany
    {
        return $this->hasMany(InterviewQuestion::class);
    }

    public function sessions(): HasMany
    {
        return $this->hasMany(InterviewSession::class);
    }

    /** Null for every standalone (non-track) interview — see InterviewTrack's docblock. */
    public function track(): BelongsTo
    {
        return $this->belongsTo(InterviewTrack::class, 'interview_track_id');
    }

    public function isTrackRound(): bool
    {
        return $this->interview_track_id !== null;
    }

    public function nextRound(): ?self
    {
        if (! $this->isTrackRound()) {
            return null;
        }

        return static::where('interview_track_id', $this->interview_track_id)
            ->where('round_number', $this->round_number + 1)
            ->first();
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function placementDrive(): BelongsTo
    {
        return $this->belongsTo(PlacementDrive::class);
    }

    public function owningCollege(): BelongsTo
    {
        return $this->belongsTo(College::class, 'owning_college_id');
    }

    public function owningCompany(): BelongsTo
    {
        return $this->belongsTo(Company::class, 'owning_company_id');
    }

    /** A `company` interview's own explicit college targeting — mirrors Contest::colleges(). */
    public function colleges(): BelongsToMany
    {
        return $this->belongsToMany(College::class, 'interview_colleges');
    }

    public function isPublished(): bool
    {
        return $this->status === self::STATUS_PUBLISHED;
    }

    public function isCompanyInterview(): bool
    {
        return $this->interview_type === self::INTERVIEW_TYPE_COMPANY;
    }

    public function isTpoMock(): bool
    {
        return $this->interview_type === self::INTERVIEW_TYPE_TPO_MOCK;
    }

    public function isCompanyHiring(): bool
    {
        return $this->interview_type === self::INTERVIEW_TYPE_COMPANY_HIRING;
    }

    public function isTalentPool(): bool
    {
        return $this->interview_type === self::INTERVIEW_TYPE_TALENT_POOL;
    }

    /**
     * Byte-identical match arms to Contest::isVisibleToCollege() — see that
     * method's docblock. `general` (and any future platform-wide type) is
     * visible to everyone.
     */
    public function isVisibleToCollege(?int $collegeId): bool
    {
        return match ($this->interview_type) {
            self::INTERVIEW_TYPE_TPO_MOCK => $collegeId !== null && $this->owning_college_id === $collegeId,
            self::INTERVIEW_TYPE_COMPANY => $collegeId !== null && $this->placement_drive_id !== null
                && $this->colleges()->where('colleges.id', $collegeId)->exists()
                && DriveCollegeMapping::query()
                    ->where('placement_drive_id', $this->placement_drive_id)
                    ->where('college_id', $collegeId)
                    ->where('status', DriveCollegeMapping::STATUS_APPROVED)
                    ->where('is_active', true)
                    ->exists(),
            // Mirrors Contest::isVisibleToCollege()'s talent_pool arm — see
            // that method's docblock.
            self::INTERVIEW_TYPE_TALENT_POOL => match ($this->audience_scope) {
                self::AUDIENCE_SCOPE_COLLEGE => $collegeId !== null && $this->colleges()->where('colleges.id', $collegeId)->exists(),
                self::AUDIENCE_SCOPE_DIRECT => $collegeId === null,
                default => true,
            },
            default => true,
        };
    }

    /** Mirrors Contest::visibilityCollegeSummary() — see that method's docblock. */
    public function visibilityCollegeSummary(): ?array
    {
        if (! $this->isCompanyInterview() || $this->placement_drive_id === null) {
            return null;
        }

        $selectedCollegeIds = $this->colleges()->pluck('colleges.id');

        $mappings = DriveCollegeMapping::where('placement_drive_id', $this->placement_drive_id)->get();
        $liveDriveCollegeIds = $mappings
            ->filter(fn (DriveCollegeMapping $m) => $m->status === DriveCollegeMapping::STATUS_APPROVED && $m->is_active)
            ->pluck('college_id');

        return [
            'selected' => $selectedCollegeIds->count(),
            'live' => $selectedCollegeIds->intersect($liveDriveCollegeIds)->count(),
            'pending' => $mappings->where('status', DriveCollegeMapping::STATUS_PENDING)->count(),
        ];
    }

    /**
     * The one deliberate divergence from Contest::isVisibleToUser(): a
     * company_hiring interview is ALWAYS invite-only — no is_open_to_all
     * bypass, no drive-mapping self-start path. Shortlisting who gets
     * interviewed is a deliberate human decision (the recruiter picks who,
     * via CompanyInterviewController::inviteCandidates()), unlike a
     * company_hiring *contest* which may still be opened platform-wide or
     * to a whole approved college. Every other type delegates to
     * isVisibleToCollege() unchanged.
     */
    public function isVisibleToUser(User $user): bool
    {
        // A track round after the first is never self-discoverable — it
        // only gets an InterviewSession once InterviewTrackAdvancementService
        // invites the candidate in after they pass the previous round.
        // Placed before every other check so it applies regardless of
        // interview_type (a track's rounds keep their type's normal round-1
        // visibility rule below, general/company/tpo_mock/company_hiring).
        if ($this->isTrackRound() && $this->round_number > 1) {
            return $this->sessions()->where('user_id', $user->id)->exists();
        }

        if ($this->interview_type === self::INTERVIEW_TYPE_COMPANY_HIRING) {
            return $this->sessions()->where('user_id', $user->id)->exists();
        }

        return $this->isVisibleToCollege($user->college_id);
    }

    /**
     * Its own slug namespace — separate from `contests.slug` — so this
     * can't reuse Contest::uniqueSlug().
     */
    public static function uniqueSlug(string $title): string
    {
        $base = Str::slug($title) ?: 'interview';
        $slug = $base;
        $suffix = 1;

        while (self::where('slug', $slug)->exists()) {
            $suffix++;
            $slug = "{$base}-{$suffix}";
        }

        return $slug;
    }
}
