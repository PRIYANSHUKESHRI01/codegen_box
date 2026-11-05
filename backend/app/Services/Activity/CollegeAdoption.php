<?php

namespace App\Services\Activity;

use App\Models\ActivityPageView;
use App\Models\AuthEvent;
use App\Models\College;
use App\Models\Subscription;
use App\Models\User;
use App\Models\UserActivityDay;
use Carbon\Carbon;
use Illuminate\Support\Collection;

/**
 * "Did the college we gave a demo login to actually use it?" — answered per college, per account, and per person.
 *
 *   directory()   every college with where its TPO login stands (AccountStates), its students' funnel and who is online now
 *   college()     one college in full: each staff account's road from issued login to daily use, the student funnel, the screens
 *                 used, the daily curve and the latest things that happened
 *   person()      one account: its sign-ins and every visit with the pages opened, for how long, scrolled how far
 */
class CollegeAdoption
{
    public function __construct(private readonly AccountStates $states, private readonly ActivityAnalytics $analytics) {}

    /** The accounts that run a college's side of AptRun: its TPO(s) and section coordinators. */
    private const STAFF = [User::ROLE_ADMIN_TPO, User::ROLE_SECTION_COORDINATOR];

    // --------------------------------------------------------------- directory

    /**
     * @param  array{q?: ?string, status?: ?string, sort?: ?string}  $filters
     * @return array{total: int, page: int, per_page: int, counts: array<string, int>, rows: list<array<string, mixed>>}
     */
    public function directory(array $filters = [], int $page = 1, int $perPage = 25): array
    {
        $search = trim((string) ($filters['q'] ?? ''));
        $colleges = College::query()
            ->when($search !== '', function ($q) use ($search) {
                $like = '%'.str_replace(['%', '_'], ['\%', '\_'], $search).'%';
                $q->where(fn ($w) => $w->where('name', 'like', $like)->orWhere('city', 'like', $like)->orWhere('short_code', 'like', $like));
            })
            ->orderBy('name')
            ->get(['id', 'name', 'short_code', 'city', 'state', 'is_active']);

        $ids = $colleges->pluck('id')->all();
        $tpos = $this->staffByCollege($ids, [User::ROLE_ADMIN_TPO]);
        $stateOf = $this->states->resolve($tpos->flatten(1));
        $students = $this->studentFunnel($ids);
        $online = $this->onlineByCollege($ids);
        $plans = $this->plansByCollege($ids);
        $lastActivity = $this->lastActivityByCollege($ids);

        $rows = $colleges->map(function (College $college) use ($tpos, $stateOf, $students, $online, $plans, $lastActivity) {
            $accounts = $tpos->get($college->id, collect());
            $best = AccountStates::best($accounts->map(fn (User $u) => $stateOf[$u->id]['state']));

            return [
                'id' => $college->id,
                'name' => $college->name,
                'code' => $college->short_code,
                'city' => $college->city,
                'is_active' => (bool) $college->is_active,
                'status' => $best ?? 'no_tpo',
                'status_label' => $best ? AccountStates::LABELS[$best] : 'No TPO account yet',
                'plan' => $plans[$college->id] ?? null,
                'tpos' => $accounts->map(fn (User $u) => [
                    'id' => $u->id,
                    'name' => $u->name,
                    'email' => $u->email,
                    'state' => $stateOf[$u->id]['state'],
                    'state_label' => $stateOf[$u->id]['state_label'],
                    'issued_at' => $u->created_at,
                    'last_seen_at' => $stateOf[$u->id]['last_seen_at'],
                ])->values()->all(),
                'students' => $students[$college->id] ?? ['total' => 0, 'activated' => 0, 'ever_seen' => 0, 'active_7d' => 0],
                'online_now' => $online[$college->id] ?? 0,
                'last_activity_at' => $lastActivity[$college->id] ?? null,
            ];
        });

        $counts = $rows->countBy('status')->all();

        if (($filters['status'] ?? '') !== '' && $filters['status'] !== 'all') {
            $rows = $rows->where('status', $filters['status']);
        }

        $rows = match ($filters['sort'] ?? 'attention') {
            'name' => $rows->sortBy('name', SORT_NATURAL | SORT_FLAG_CASE),
            'recent' => $rows->sortByDesc(fn ($r) => $r['last_activity_at']?->timestamp ?? 0),
            'students' => $rows->sortByDesc(fn ($r) => $r['students']['total']),
            // Needs-a-call first: logins nobody has opened, then those stuck half-way, then the quiet ones; the active last.
            default => $rows->sortBy(fn ($r) => [array_search($r['status'], ['not_opened', 'tried', 'password_set', 'dormant', 'active', 'no_tpo'], true), $r['name']]),
        };

        $perPage = max(10, min($perPage, 100));

        return [
            'total' => $rows->count(),
            'page' => max(1, $page),
            'per_page' => $perPage,
            'counts' => $counts,
            'rows' => $rows->forPage(max(1, $page), $perPage)->values()->all(),
        ];
    }

    // ----------------------------------------------------------------- college

    /** @return array<string, mixed> */
    public function college(College $college, ?string $role = null, int $days = 30): array
    {
        $staff = User::query()->where('college_id', $college->id)->whereIn('role', self::STAFF)->orderBy('role')->orderBy('name')->get();
        $facts = $this->states->resolve($staff);
        $lastVisit = $this->lastVisitByUser($staff->pluck('id')->all());

        $accounts = $staff->map(fn (User $u) => ['user' => $this->userRow($u)] + $facts[$u->id] + [
            'device' => $lastVisit[$u->id]['device'] ?? null,
            'browser' => $lastVisit[$u->id]['browser'] ?? null,
            'os' => $lastVisit[$u->id]['os'] ?? null,
        ])->values();

        $tpoStates = $accounts->where('user.role', User::ROLE_ADMIN_TPO)->pluck('state');
        $best = AccountStates::best($tpoStates);

        return [
            'college' => [
                'id' => $college->id,
                'name' => $college->name,
                'code' => $college->short_code,
                'city' => $college->city,
                'state' => $college->state,
                'is_active' => (bool) $college->is_active,
                'plan' => $this->plansByCollege([$college->id])[$college->id] ?? null,
            ],
            'status' => $best ?? 'no_tpo',
            'status_label' => $best ? AccountStates::LABELS[$best] : 'No TPO account yet',
            'accounts' => $accounts->all(),
            'students' => $this->studentFunnel([$college->id])[$college->id] ?? ['total' => 0, 'activated' => 0, 'ever_seen' => 0, 'active_7d' => 0],
            'online_now' => $this->onlineByCollege([$college->id])[$college->id] ?? 0,
            'daily' => $this->analytics->daily($days, $role, $college->id),
            'sections' => $this->analytics->sections($days, $role, $college->id),
            'recent' => $this->recent($college->id),
            'days' => $days,
        ];
    }

    /**
     * The people of a college (staff and students) with where each stands, for the drill-down list.
     *
     * @return array{total: int, page: int, per_page: int, rows: list<array<string, mixed>>}
     */
    public function people(College $college, ?string $role = null, ?string $search = null, ?string $state = null, int $page = 1, int $perPage = 25): array
    {
        $query = User::query()->where('college_id', $college->id)
            ->when($role !== null && $role !== '' && $role !== 'all', fn ($q) => $q->where('role', $role))
            ->when($search !== null && $search !== '', function ($q) use ($search) {
                $like = '%'.str_replace(['%', '_'], ['\%', '\_'], $search).'%';
                $q->where(fn ($w) => $w->where('name', 'like', $like)->orWhere('email', 'like', $like)->orWhere('roll_number', 'like', $like));
            })
            // Staff first, then whoever was seen most recently.
            ->orderByRaw("CASE role WHEN 'admin_tpo' THEN 0 WHEN 'section_coordinator' THEN 1 ELSE 2 END")
            ->orderByRaw('last_seen_at IS NULL')
            ->orderByDesc('last_seen_at')
            ->orderBy('name');

        $perPage = max(10, min($perPage, 100));
        $total = (clone $query)->count();
        $users = $query->forPage(max(1, $page), $perPage)->get();
        $facts = $this->states->resolve($users);

        return [
            'total' => $total,
            'page' => max(1, $page),
            'per_page' => $perPage,
            'rows' => $users->map(fn (User $u) => ['user' => $this->userRow($u)] + $facts[$u->id])->all(),
        ];
    }

    // ------------------------------------------------------------------ person

    /** @return array<string, mixed> */
    public function person(User $user): array
    {
        $facts = $this->states->resolve(collect([$user]))[$user->id];

        $events = AuthEvent::where('user_id', $user->id)->orderByDesc('id')->limit(40)->get()->map(fn (AuthEvent $e) => [
            'event' => $e->event,
            'reason' => $e->reason,
            'portal' => $e->portal,
            'device' => $e->device,
            'browser' => $e->browser,
            'os' => $e->os,
            'ip' => $e->ip,
            'at' => $e->created_at,
        ])->all();

        $visits = $this->analytics->visitsOf($user)->map(fn ($v) => [
            'id' => $v->id,
            'started_at' => $v->started_at,
            'last_seen_at' => $v->last_seen_at,
            'active_minutes' => (int) round($v->active_seconds / 60),
            'pages' => $v->pages,
            'device' => $v->device,
            'browser' => $v->browser,
            'os' => $v->os,
            'ip' => $v->ip,
            'views' => $v->pageViews->map(fn ($p) => [
                'section' => $p->section,
                'path' => $p->path,
                'at' => $p->entered_at,
                'seconds' => $p->active_seconds,
                'scroll' => $p->max_scroll,
            ])->all(),
        ])->all();

        $sections = ActivityPageView::where('user_id', $user->id)
            ->selectRaw('section, COUNT(*) as views, SUM(active_seconds) as seconds, AVG(max_scroll) as avg_scroll, MAX(entered_at) as last_at')
            ->groupBy('section')->orderByDesc('views')->limit(20)->get()
            ->map(fn ($r) => [
                'section' => $r->section,
                'views' => (int) $r->views,
                'seconds' => (int) $r->seconds,
                'avg_scroll' => (int) round((float) $r->avg_scroll),
                'last_at' => Carbon::parse($r->last_at),
            ])->all();

        $user->loadMissing('college:id,name');

        return [
            'user' => $this->userRow($user) + ['college' => $user->college?->name, 'is_blocked' => (bool) $user->is_blocked],
            'facts' => $facts,
            'online_now' => $this->analytics->isOnline($user),
            'events' => $events,
            'visits' => $visits,
            'sections' => $sections,
        ];
    }

    // ----------------------------------------------------------------- helpers

    private function userRow(User $u): array
    {
        return [
            'id' => $u->id,
            'name' => $u->name,
            'email' => $u->email,
            'role' => $u->role,
            'roll_number' => $u->roll_number,
        ];
    }

    /** @return Collection<int, Collection<int, User>> college id => accounts */
    private function staffByCollege(array $collegeIds, array $roles): Collection
    {
        if ($collegeIds === []) {
            return collect();
        }

        return collect(array_chunk($collegeIds, 500))->flatMap(
            fn (array $chunk) => User::query()->whereIn('college_id', $chunk)->whereIn('role', $roles)->get(['id', 'name', 'email', 'role', 'college_id', 'must_change_password', 'created_at', 'last_seen_at'])
        )->groupBy('college_id');
    }

    /**
     * Each college's students: how many, how many chose their password, how many ever came in, how many came in the last 7 days.
     *
     * @return array<int, array{total: int, activated: int, ever_seen: int, active_7d: int}>
     */
    private function studentFunnel(array $collegeIds): array
    {
        if ($collegeIds === []) {
            return [];
        }

        $since = Carbon::now($this->analytics->timezone())->subDays(6)->toDateString();
        $out = [];

        foreach (array_chunk($collegeIds, 500) as $chunk) {
            User::query()->where('role', User::ROLE_USER)->whereIn('college_id', $chunk)
                ->selectRaw('college_id, COUNT(*) as total, SUM(CASE WHEN must_change_password = 0 THEN 1 ELSE 0 END) as activated, SUM(CASE WHEN last_seen_at IS NOT NULL THEN 1 ELSE 0 END) as ever_seen')
                ->groupBy('college_id')->get()
                ->each(function ($r) use (&$out) {
                    $out[(int) $r->college_id] = ['total' => (int) $r->total, 'activated' => (int) $r->activated, 'ever_seen' => (int) $r->ever_seen, 'active_7d' => 0];
                });

            UserActivityDay::query()->where('role', User::ROLE_USER)->whereIn('college_id', $chunk)->where('day', '>=', $since)
                ->selectRaw('college_id, COUNT(DISTINCT user_id) as n')->groupBy('college_id')->get()
                ->each(function ($r) use (&$out) {
                    if (isset($out[(int) $r->college_id])) {
                        $out[(int) $r->college_id]['active_7d'] = (int) $r->n;
                    }
                });
        }

        return $out;
    }

    /** @return array<int, int> college id => people online now */
    private function onlineByCollege(array $collegeIds): array
    {
        if ($collegeIds === []) {
            return [];
        }

        $since = Carbon::now()->subSeconds(max(30, (int) config('activity.online_window_seconds', 150)));
        $out = [];

        foreach (array_chunk($collegeIds, 500) as $chunk) {
            \App\Models\ActivityVisit::query()->whereIn('college_id', $chunk)->where('last_seen_at', '>=', $since)
                ->selectRaw('college_id, COUNT(DISTINCT user_id) as n')->groupBy('college_id')->get()
                ->each(function ($r) use (&$out) {
                    $out[(int) $r->college_id] = (int) $r->n;
                });
        }

        return $out;
    }

    /** @return array<int, Carbon> college id => when anyone from it was last seen */
    private function lastActivityByCollege(array $collegeIds): array
    {
        if ($collegeIds === []) {
            return [];
        }

        $out = [];

        foreach (array_chunk($collegeIds, 500) as $chunk) {
            User::query()->whereIn('college_id', $chunk)->whereNotNull('last_seen_at')
                ->selectRaw('college_id, MAX(last_seen_at) as last_at')->groupBy('college_id')->get()
                ->each(function ($r) use (&$out) {
                    $out[(int) $r->college_id] = Carbon::parse($r->last_at);
                });
        }

        return $out;
    }

    /**
     * The plan each college is on, and whether it is a demo and when it ends.
     *
     * @return array<int, array{name: string, is_demo: bool, ends_at: ?Carbon, days_left: ?int}>
     */
    private function plansByCollege(array $collegeIds): array
    {
        if ($collegeIds === []) {
            return [];
        }

        $out = [];

        Subscription::query()
            ->where('subscriber_type', College::class)
            ->whereIn('subscriber_id', $collegeIds)
            ->where('status', Subscription::STATUS_ACTIVE)
            ->with('plan:id,name')
            ->orderBy('id')
            ->get()
            ->each(function (Subscription $s) use (&$out) {
                $ends = $s->current_period_end;
                $out[(int) $s->subscriber_id] = [
                    'name' => $s->plan?->name ?? 'Plan',
                    'is_demo' => (bool) ($s->is_trial || ! empty($s->meta['is_demo'])),
                    'ends_at' => $ends,
                    'days_left' => $ends ? (int) ceil(Carbon::now()->floatDiffInDays($ends, false)) : null,
                ];
            });

        return $out;
    }

    /** @return array<int, array{device: ?string, browser: ?string, os: ?string}> user id => their latest visit's device */
    private function lastVisitByUser(array $userIds): array
    {
        $out = [];

        foreach (array_chunk($userIds, 500) as $chunk) {
            \App\Models\ActivityVisit::query()->whereIn('user_id', $chunk)->orderByDesc('id')->get(['user_id', 'device', 'browser', 'os'])
                ->unique('user_id')->each(function ($v) use (&$out) {
                    $out[$v->user_id] = ['device' => $v->device, 'browser' => $v->browser, 'os' => $v->os];
                });
        }

        return $out;
    }

    /**
     * The latest things that happened at a college: pages opened and sign-ins, newest first, in one list.
     *
     * @return list<array<string, mixed>>
     */
    private function recent(int $collegeId, int $limit = 40): array
    {
        $views = ActivityPageView::query()
            ->join('users as u', 'u.id', '=', 'activity_page_views.user_id')
            ->where('activity_page_views.college_id', $collegeId)
            ->orderByDesc('activity_page_views.id')->limit($limit)
            ->get(['activity_page_views.section', 'activity_page_views.entered_at', 'activity_page_views.active_seconds', 'activity_page_views.max_scroll', 'u.id as user_id', 'u.name', 'u.role'])
            ->map(fn ($v) => ['kind' => 'page', 'user_id' => $v->user_id, 'name' => $v->name, 'role' => $v->role, 'what' => $v->section, 'seconds' => $v->active_seconds, 'scroll' => $v->max_scroll, 'at' => $v->entered_at]);

        $events = AuthEvent::query()
            ->leftJoin('users as u', 'u.id', '=', 'auth_events.user_id')
            ->where('auth_events.college_id', $collegeId)
            ->orderByDesc('auth_events.id')->limit($limit)
            ->get(['auth_events.event', 'auth_events.reason', 'auth_events.created_at', 'u.id as user_id', 'u.name', 'u.role'])
            ->map(fn ($e) => ['kind' => 'auth', 'user_id' => $e->user_id, 'name' => $e->name, 'role' => $e->role, 'what' => $e->event, 'reason' => $e->reason, 'at' => $e->created_at]);

        return $views->concat($events)->sortByDesc(fn ($r) => $r['at']->timestamp)->take($limit)->values()->all();
    }
}
