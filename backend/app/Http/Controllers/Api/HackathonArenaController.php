<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Hackathon;
use App\Models\HackathonParticipant;
use App\Models\HackathonSubmission;
use App\Models\User;
use App\Services\Hackathons\HackathonPresenter;
use App\Services\Hackathons\HackathonRegistrationService;
use App\Services\Hackathons\HackathonRuleException;
use App\Services\Hackathons\HackathonSubmissionService;
use App\Services\PlanGate;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Validation\Rule;

/**
 * The Hack Arena, as students see it.
 *
 * Reads are open to a student and — as a read-only preview — to the hosting
 * roles (Ops, hiring partners, superadmin), so a host can see exactly what
 * students see; writes (register, team, submit) are student-only and gated in
 * the routes. A college TPO has no route in here at all.
 *
 * Taking part is an Expert feature (Plan::$hackathon_access): browsing the
 * lobby, a hackathon's page, its gallery and results stays open to every
 * student — that is the shop window, and it shows what a plan unlocks — but
 * registering and saving or submitting a project are refused with a 402
 * (PlanGate::requireHackathonAccess) on any plan that does not include it.
 * Leaving a hackathon is never refused: nobody should be stuck in a team.
 *
 * A hackathon that is not published is invisible (404) to everyone except
 * someone who may manage it, who sees it as a preview. Private data never
 * leaves this class un-filtered: scores, ranks and feedback are withheld until
 * the host publishes results, and the project gallery opens only after the
 * deadline (see HackathonPresenter).
 */
class HackathonArenaController extends Controller
{
    private const PER_PAGE = 12;

    public function __construct(
        private readonly HackathonPresenter $presenter,
        private readonly HackathonRegistrationService $registration,
        private readonly HackathonSubmissionService $submissions,
        private readonly PlanGate $planGate,
    ) {}

    // ───────────────────────────── lobby ─────────────────────────────

    /** Everything the lobby shows above the full list: the student's stats, a featured event, what is live, what is next, and who just won. */
    public function home(Request $request)
    {
        $user = $request->user();
        $now = now();

        $base = fn (): Builder => Hackathon::published()->availableTo($user)->with('company')->withCount(['participants', 'teams']);

        $live = $base()->where('starts_at', '<=', $now)->where('ends_at', '>', $now)->orderBy('ends_at')->limit(6)->get();
        $upcoming = $base()->where('starts_at', '>', $now)->orderBy('starts_at')->limit(8)->get();
        $recent = $base()->whereNotNull('results_published_at')->orderByDesc('results_published_at')->limit(3)->get();

        $featured = $live->concat($upcoming)->firstWhere('is_featured', true) ?? $live->first() ?? $upcoming->first();

        $mine = $this->participationMap($user, $live->concat($upcoming)->concat($recent)->pluck('id'));

        return response()->json([
            'stats' => $user->isStudent() ? $this->stats($user) : null,
            'featured' => $featured ? $this->presenter->card($featured, $mine->get($featured->id)) : null,
            'live' => $live->map(fn (Hackathon $h) => $this->presenter->card($h, $mine->get($h->id)))->values(),
            'upcoming' => $upcoming->map(fn (Hackathon $h) => $this->presenter->card($h, $mine->get($h->id)))->values(),
            'recent_results' => $recent->map(function (Hackathon $h) use ($mine) {
                $winner = $h->submissions()
                    ->where('status', HackathonSubmission::STATUS_SUBMITTED)
                    ->where('is_disqualified', false)
                    ->where('rank', 1)
                    ->with('team.participants.user')
                    ->first();

                return [
                    'hackathon' => $this->presenter->card($h, $mine->get($h->id)),
                    'winner' => $winner ? $this->presenter->publicProject($h, $winner) : null,
                ];
            })->values(),
            'totals' => [
                'live' => Hackathon::published()->availableTo($user)->where('starts_at', '<=', $now)->where('ends_at', '>', $now)->count(),
                'upcoming' => Hackathon::published()->availableTo($user)->where('starts_at', '>', $now)->count(),
                'past' => Hackathon::published()->availableTo($user)->where('ends_at', '<=', $now)->count(),
            ],
        ]);
    }

    /** The filterable catalogue. Live first, then what is coming up soonest, then the archive (newest first). */
    public function index(Request $request)
    {
        $data = $request->validate([
            'phase' => ['nullable', Rule::in(['all', 'live', 'upcoming', 'open', 'past'])],
            'mode' => ['nullable', Rule::in(Hackathon::MODES)],
            'host' => ['nullable', Rule::in([Hackathon::HOST_PLATFORM, Hackathon::HOST_COMPANY])],
            'theme' => ['nullable', 'string', 'max:30'],
            'q' => ['nullable', 'string', 'max:100'],
            'page' => ['nullable', 'integer', 'min:1', 'max:1000'],
        ]);

        $user = $request->user();
        $now = now();
        $stamp = $now->toDateTimeString();

        $query = Hackathon::published()->availableTo($user)->with('company')->withCount(['participants', 'teams']);

        match ($data['phase'] ?? 'all') {
            'live' => $query->where('starts_at', '<=', $now)->where('ends_at', '>', $now),
            'upcoming' => $query->where('starts_at', '>', $now),
            'open' => $query->where('registration_opens_at', '<=', $now)->where('registration_closes_at', '>=', $now)->where('ends_at', '>', $now),
            'past' => $query->where('ends_at', '<=', $now),
            default => null,
        };

        if (! empty($data['mode'])) {
            $query->where('mode', $data['mode']);
        }

        if (! empty($data['host'])) {
            $query->where('host_type', $data['host']);
        }

        if (! empty($data['theme'])) {
            $query->whereJsonContains('themes', $data['theme']);
        }

        if (isset($data['q']) && trim($data['q']) !== '') {
            $like = '%'.str_replace(['%', '_'], ['\%', '\_'], trim($data['q'])).'%';
            $query->where(fn (Builder $q) => $q->where('title', 'like', $like)->orWhere('tagline', 'like', $like));
        }

        $page = $query
            ->orderByRaw('CASE WHEN starts_at <= ? AND ends_at > ? THEN 0 WHEN ends_at > ? THEN 1 ELSE 2 END', [$stamp, $stamp, $stamp])
            ->orderByRaw('CASE WHEN ends_at > ? THEN starts_at END ASC', [$stamp])
            ->orderByDesc('ends_at')
            ->paginate(self::PER_PAGE, ['*'], 'page', (int) ($data['page'] ?? 1));

        $mine = $this->participationMap($user, collect($page->items())->pluck('id'));

        return response()->json([
            'hackathons' => collect($page->items())->map(fn (Hackathon $h) => $this->presenter->card($h, $mine->get($h->id)))->values(),
            'meta' => [
                'page' => $page->currentPage(),
                'per_page' => $page->perPage(),
                'total' => $page->total(),
                'last_page' => $page->lastPage(),
            ],
            'themes' => $this->availableThemes($user),
        ]);
    }

    /** The student's own hackathons — everything they registered for, with outcomes — and their stats. */
    public function mine(Request $request)
    {
        $user = $request->user();

        $participations = HackathonParticipant::where('user_id', $user->id)
            ->with(['hackathon' => fn ($q) => $q->with('company')->withCount(['participants', 'teams']), 'team.submission'])
            ->get()
            ->filter(fn (HackathonParticipant $p) => $p->hackathon !== null && $p->hackathon->isPublished())
            ->sortByDesc(fn (HackathonParticipant $p) => $p->hackathon->starts_at->getTimestamp())
            ->values();

        return response()->json([
            'stats' => $user->isStudent() ? $this->stats($user) : null,
            'hackathons' => $participations->map(fn (HackathonParticipant $p) => $this->presenter->card($p->hackathon, $p))->values(),
        ]);
    }

    // ───────────────────────────── one hackathon ─────────────────────────────

    public function show(Request $request, Hackathon $hackathon)
    {
        $canManage = $this->visibleOrFail($request, $hackathon);

        return response()->json(['hackathon' => $this->detail($request->user(), $hackathon, $canManage)]);
    }

    public function register(Request $request, Hackathon $hackathon)
    {
        $this->visibleOrFail($request, $hackathon);
        $this->planGate->requireHackathonAccess($request->user());

        $data = $request->validate([
            'mode' => ['required', Rule::in(HackathonRegistrationService::MODES)],
            'team_name' => ['nullable', 'string', 'max:60'],
            'invite_code' => ['nullable', 'string', 'max:12'],
        ]);

        $this->registration->register($hackathon, $request->user(), $data['mode'], $data['team_name'] ?? null, $data['invite_code'] ?? null);

        return response()->json(['hackathon' => $this->detail($request->user(), $hackathon, false)], 201);
    }

    public function withdraw(Request $request, Hackathon $hackathon)
    {
        $this->visibleOrFail($request, $hackathon);

        $this->registration->withdraw($hackathon, $request->user());

        return response()->json(['hackathon' => $this->detail($request->user(), $hackathon, false)]);
    }

    public function removeMember(Request $request, Hackathon $hackathon, User $user)
    {
        $this->visibleOrFail($request, $hackathon);

        $this->registration->removeMember($hackathon, $request->user(), $user);

        return response()->json(['hackathon' => $this->detail($request->user(), $hackathon, false)]);
    }

    /** Save the team's project as a draft, or — with `submit` — hand it in for judging. */
    public function saveSubmission(Request $request, Hackathon $hackathon)
    {
        $this->visibleOrFail($request, $hackathon);
        $this->planGate->requireHackathonAccess($request->user());

        $data = $request->validate([
            'title' => ['required', 'string', 'min:3', 'max:120'],
            'tagline' => ['nullable', 'string', 'max:200'],
            'description' => ['nullable', 'string', 'max:5000'],
            'track' => ['nullable', 'string', 'max:80'],
            'repo_url' => ['nullable', 'url:http,https', 'max:300'],
            'demo_url' => ['nullable', 'url:http,https', 'max:300'],
            'video_url' => ['nullable', 'url:http,https', 'max:300'],
            'tech_stack' => ['nullable', 'array', 'max:15'],
            'tech_stack.*' => ['string', 'min:1', 'max:30'],
            'submit' => ['nullable', 'boolean'],
        ]);

        $this->submissions->save($hackathon, $request->user(), $data, (bool) ($data['submit'] ?? false));

        return response()->json(['hackathon' => $this->detail($request->user(), $hackathon, false)]);
    }

    /** The public project gallery — opens after the deadline, never lists drafts or disqualified entries. */
    public function gallery(Request $request, Hackathon $hackathon)
    {
        $canManage = $this->visibleOrFail($request, $hackathon);

        if (! $this->presenter->galleryIsOpen($hackathon) && ! $canManage) {
            throw new HackathonRuleException('Projects become public once the submission deadline has passed.', 'gallery_closed', 403);
        }

        $data = $request->validate([
            'track' => ['nullable', 'string', 'max:80'],
            'q' => ['nullable', 'string', 'max:100'],
            'page' => ['nullable', 'integer', 'min:1', 'max:1000'],
        ]);

        $query = $hackathon->submissions()
            ->where('status', HackathonSubmission::STATUS_SUBMITTED)
            ->where('is_disqualified', false)
            ->with('team.participants.user');

        if (! empty($data['track'])) {
            $query->where('track', $data['track']);
        }

        if (isset($data['q']) && trim($data['q']) !== '') {
            $like = '%'.str_replace(['%', '_'], ['\%', '\_'], trim($data['q'])).'%';
            $query->where(fn (Builder $q) => $q->where('title', 'like', $like)->orWhere('tagline', 'like', $like));
        }

        // Once results are out the gallery is a leaderboard; before that, newest work first.
        if ($hackathon->resultsArePublished()) {
            $query->bestRankFirst()->orderBy('submitted_at');
        } else {
            $query->orderByDesc('submitted_at');
        }

        $page = $query->paginate(self::PER_PAGE, ['*'], 'page', (int) ($data['page'] ?? 1));

        return response()->json([
            'projects' => collect($page->items())->map(fn (HackathonSubmission $s) => $this->presenter->publicProject($hackathon, $s))->values(),
            'meta' => ['page' => $page->currentPage(), 'per_page' => $page->perPage(), 'total' => $page->total(), 'last_page' => $page->lastPage()],
            'results_published' => $hackathon->resultsArePublished(),
        ]);
    }

    /** The ranked results, once the host has published them. */
    public function results(Request $request, Hackathon $hackathon)
    {
        $this->visibleOrFail($request, $hackathon);

        if (! $hackathon->resultsArePublished()) {
            throw new HackathonRuleException('Results have not been published yet.', 'results_pending', 403);
        }

        $rows = $hackathon->submissions()
            ->where('status', HackathonSubmission::STATUS_SUBMITTED)
            ->where('is_disqualified', false)
            ->whereNotNull('rank')
            ->orderBy('rank')
            ->limit(200)
            ->with('team.participants.user')
            ->get();

        return response()->json([
            'results' => $rows->map(fn (HackathonSubmission $s) => $this->presenter->publicProject($hackathon, $s))->values(),
            'criteria' => $hackathon->effectiveCriteria(),
        ]);
    }

    // ───────────────────────────── helpers ─────────────────────────────

    /**
     * Resolve visibility: a published hackathon is visible to everyone allowed into the arena; anything
     * else only to someone who may manage it (as a preview). Returns whether the caller can manage it.
     */
    private function visibleOrFail(Request $request, Hackathon $hackathon): bool
    {
        $user = $request->user();
        $canManage = $hackathon->isManagedBy($user);

        if (! $canManage) {
            abort_unless($hackathon->isPublished(), 404);

            // Mapped to other colleges: not here for this student. (Someone already registered keeps their
            // access — the host cannot drop a college that still has registered students, but never lock a
            // participant out of their own project.)
            if (! $hackathon->isAvailableTo($user)) {
                abort_unless(
                    $user->isStudent() && HackathonParticipant::where('hackathon_id', $hackathon->id)->where('user_id', $user->id)->exists(),
                    404
                );
            }
        }

        return $canManage;
    }

    private function detail(User $user, Hackathon $hackathon, bool $canManage): array
    {
        $hackathon->load('company')->loadCount(['participants', 'teams']);

        $mine = $user->isStudent()
            ? HackathonParticipant::where('hackathon_id', $hackathon->id)
                ->where('user_id', $user->id)
                ->with(['team.participants.user', 'team.submission'])
                ->first()
            : null;

        return $this->presenter->detail($hackathon, $user, $mine, $canManage || $hackathon->isManagedBy($user));
    }

    /**
     * The viewer's registration (with team + submission) for each of the given hackathons, keyed by hackathon id — one query for a whole page of cards.
     *
     * @param  Collection<int, int>  $hackathonIds
     * @return Collection<int, HackathonParticipant>
     */
    private function participationMap(User $user, Collection $hackathonIds): Collection
    {
        if (! $user->isStudent() || $hackathonIds->isEmpty()) {
            return collect();
        }

        return HackathonParticipant::where('user_id', $user->id)
            ->whereIn('hackathon_id', $hackathonIds)
            ->with('team.submission')
            ->get()
            ->keyBy('hackathon_id');
    }

    /** @return array{joined: int, submitted: int, wins: int, podiums: int, active: int} */
    private function stats(User $user): array
    {
        $participations = HackathonParticipant::where('user_id', $user->id)
            ->with(['hackathon:id,status,ends_at,results_published_at', 'team.submission'])
            ->get()
            ->filter(fn (HackathonParticipant $p) => $p->hackathon?->isPublished());

        $placed = $participations->filter(function (HackathonParticipant $p) {
            $s = $p->team?->submission;

            return $p->hackathon->resultsArePublished() && $s && ! $s->is_disqualified && $s->rank !== null;
        });

        return [
            'joined' => $participations->count(),
            'submitted' => $participations->filter(fn (HackathonParticipant $p) => $p->team?->submission?->isSubmitted())->count(),
            'wins' => $placed->filter(fn (HackathonParticipant $p) => $p->team->submission->rank === 1)->count(),
            'podiums' => $placed->filter(fn (HackathonParticipant $p) => $p->team->submission->rank <= 3)->count(),
            'active' => $participations->filter(fn (HackathonParticipant $p) => ! $p->hackathon->hasEnded())->count(),
        ];
    }

    /** @return list<string> every theme used by a published hackathon, for the filter chips. */
    private function availableThemes(User $user): array
    {
        return Hackathon::published()
            ->availableTo($user)
            ->pluck('themes')
            ->flatten()
            ->filter()
            ->unique()
            ->sort()
            ->values()
            ->all();
    }
}
