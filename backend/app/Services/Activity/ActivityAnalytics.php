<?php

namespace App\Services\Activity;

use App\Models\ActivityPageView;
use App\Models\ActivityVisit;
use App\Models\AuthEvent;
use App\Models\College;
use App\Models\User;
use App\Models\UserActivityDay;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;

/**
 * The platform-wide numbers behind Superadmin → Live Activity: who is on right now, how many came today / this week / this month, how
 * the day looks hour by hour, which screens are being used, and the sign-in log.
 *
 * "Online now" is a visit the browser has reported from within `activity.online_window_seconds`. Counts of people over days are read from
 * the one-row-per-person-per-day roll-up (user_activity_days), never from page views, so they stay cheap as the data grows. Days are
 * India days (config activity.timezone), the same cut the weekly leaderboard uses.
 */
class ActivityAnalytics
{
    /** Roles shown as "staff" in one lump: they are Mellow's own people, not customers. */
    public const STAFF_ROLES = [User::ROLE_ADMIN_INTERNAL, User::ROLE_ADMIN_MARKETING];

    public function timezone(): string
    {
        return ActivityRecorder::timezone();
    }

    /** Start of the given India day, as an instant in the app's own timezone, ready to compare with stored datetimes. */
    public function dayStart(?Carbon $at = null): Carbon
    {
        return ($at ?? Carbon::now())->copy()->setTimezone($this->timezone())->startOfDay()->setTimezone(config('app.timezone'));
    }

    public function today(): string
    {
        return Carbon::now($this->timezone())->toDateString();
    }

    private function onlineSince(): Carbon
    {
        return Carbon::now()->subSeconds(max(30, (int) config('activity.online_window_seconds', 150)));
    }

    /** Narrows a query on a table that has a `role` column to one group: a role, "staff", or everyone. */
    private function roleScope($query, ?string $role, string $column = 'role')
    {
        return match (true) {
            $role === null || $role === '' || $role === 'all' => $query,
            $role === 'staff' => $query->whereIn($column, self::STAFF_ROLES),
            default => $query->where($column, $role),
        };
    }

    // ------------------------------------------------------------------- pulse

    /**
     * The headline strip: online now, today, this week, this month, sign-ins and what is being looked at this minute.
     *
     * @return array<string, mixed>
     */
    public function pulse(?string $role = null): array
    {
        $now = Carbon::now();
        $today = $this->today();
        $tz = $this->timezone();
        $todayStart = $this->dayStart();

        $online = $this->roleScope(ActivityVisit::query()->where('last_seen_at', '>=', $this->onlineSince()), $role);
        $onlineByRole = (clone $online)->selectRaw('role, COUNT(DISTINCT user_id) as n')->groupBy('role')->pluck('n', 'role')->map(fn ($n) => (int) $n)->all();

        $distinctDays = fn (string $from, ?string $to = null) => $this->roleScope(UserActivityDay::query()->where('day', '>=', $from), $role)
            ->when($to !== null, fn ($q) => $q->where('day', '<=', $to))
            ->distinct()->count('user_id');

        $monday = Carbon::now($tz)->startOfWeek(Carbon::MONDAY)->toDateString();
        $yesterday = Carbon::now($tz)->subDay()->toDateString();

        $events = fn (string $event) => AuthEvent::query()->where('event', $event)->where('created_at', '>=', $todayStart);
        $sessionsToday = $this->roleScope(ActivityVisit::query()->where('started_at', '>=', $todayStart), $role);

        $sections = (clone $online)->whereNotNull('current_section')
            ->selectRaw('current_section as section, COUNT(DISTINCT user_id) as n')->groupBy('current_section')->orderByDesc('n')->limit(8)->get()
            ->map(fn ($r) => ['section' => $r->section, 'users' => (int) $r->n])->all();

        $colleges = (clone $online)->whereNotNull('college_id')
            ->selectRaw('college_id, COUNT(DISTINCT user_id) as n')->groupBy('college_id')->orderByDesc('n')->limit(6)->get();
        $names = College::whereIn('id', $colleges->pluck('college_id'))->pluck('name', 'id');

        return [
            'as_of' => $now,
            'timezone' => $tz,
            'online' => [
                'total' => array_sum($onlineByRole),
                'by_role' => $onlineByRole,
                'window_seconds' => (int) config('activity.online_window_seconds', 150),
            ],
            'active' => [
                'last_15_minutes' => $this->roleScope(ActivityVisit::query()->where('last_seen_at', '>=', $now->copy()->subMinutes(15)), $role)->distinct()->count('user_id'),
                'today' => $distinctDays($today, $today),
                'yesterday' => $distinctDays($yesterday, $yesterday),
                'this_week' => $distinctDays($monday),
                'last_7_days' => $distinctDays(Carbon::now($tz)->subDays(6)->toDateString()),
                'last_30_days' => $distinctDays(Carbon::now($tz)->subDays(29)->toDateString()),
            ],
            'today' => [
                'sessions' => (clone $sessionsToday)->count(),
                'avg_minutes' => round((float) ((clone $sessionsToday)->avg('active_seconds') ?? 0) / 60, 1),
                'sign_ins' => $this->roleScope($events(AuthEvent::LOGIN), $role)->count(),
                'failed_sign_ins' => $this->roleScope($events(AuthEvent::LOGIN_FAILED), $role)->count(),
                'accounts_activated' => $this->roleScope($events(AuthEvent::PASSWORD_SET), $role)->count(),
                'demo_logins_opened' => $this->roleScope($events(AuthEvent::TEMP_PASSWORD), $role)->count(),
            ],
            'sections_now' => $sections,
            'colleges_now' => $colleges->map(fn ($r) => ['id' => (int) $r->college_id, 'name' => $names[$r->college_id] ?? 'College', 'users' => (int) $r->n])->all(),
        ];
    }

    // ------------------------------------------------------------------ series

    /**
     * People on the platform in each of the last 24 hours (a visit counts in every hour it was open).
     *
     * @return list<array{hour: string, label: string, users: int}>
     */
    public function hourly(?string $role = null): array
    {
        $tz = $this->timezone();
        $end = Carbon::now($tz)->startOfHour()->addHour();
        $start = $end->copy()->subHours(24);

        $visits = $this->roleScope(ActivityVisit::query()->where('last_seen_at', '>=', $start->copy()->setTimezone(config('app.timezone'))), $role)
            ->limit(30000)->get(['user_id', 'started_at', 'last_seen_at']);

        $out = [];
        for ($i = 0; $i < 24; $i++) {
            $from = $start->copy()->addHours($i);
            $to = $from->copy()->addHour();
            $users = $visits->filter(fn ($v) => $v->started_at->lt($to) && $v->last_seen_at->gte($from))->pluck('user_id')->unique()->count();
            $out[] = ['hour' => $from->toIso8601String(), 'label' => $from->format('ga'), 'users' => $users];
        }

        return $out;
    }

    /**
     * People active per day for the last `$days` days, split into students and everyone else, with active minutes.
     *
     * @return list<array<string, mixed>>
     */
    public function daily(int $days = 30, ?string $role = null, ?int $collegeId = null): array
    {
        $days = max(1, min($days, 120));
        $from = Carbon::now($this->timezone())->subDays($days - 1)->toDateString();

        $rows = $this->roleScope(UserActivityDay::query()->where('day', '>=', $from), $role)
            ->when($collegeId !== null, fn ($q) => $q->where('college_id', $collegeId))
            ->selectRaw("day, COUNT(*) as users, SUM(CASE WHEN role = 'user' THEN 1 ELSE 0 END) as students, SUM(visits) as visits, SUM(active_seconds) as seconds")
            ->groupBy('day')->get()->keyBy(fn ($r) => Carbon::parse($r->day)->toDateString());

        $out = [];
        for ($i = $days - 1; $i >= 0; $i--) {
            $date = Carbon::now($this->timezone())->subDays($i)->toDateString();
            $row = $rows->get($date);
            $out[] = [
                'day' => $date,
                'users' => (int) ($row->users ?? 0),
                'students' => (int) ($row->students ?? 0),
                'visits' => (int) ($row->visits ?? 0),
                'minutes' => (int) round(((int) ($row->seconds ?? 0)) / 60),
            ];
        }

        return $out;
    }

    /**
     * Distinct people per week (Monday to Sunday) for the last `$weeks` weeks, the current one included (so far).
     *
     * @return list<array{week: string, users: int, current: bool}>
     */
    public function weekly(int $weeks = 8, ?string $role = null): array
    {
        $tz = $this->timezone();
        $out = [];

        for ($i = $weeks - 1; $i >= 0; $i--) {
            $monday = Carbon::now($tz)->startOfWeek(Carbon::MONDAY)->subWeeks($i);
            $out[] = [
                'week' => $monday->toDateString(),
                'users' => $this->roleScope(UserActivityDay::query()->where('day', '>=', $monday->toDateString())->where('day', '<=', $monday->copy()->addDays(6)->toDateString()), $role)->distinct()->count('user_id'),
                'current' => $i === 0,
            ];
        }

        return $out;
    }

    /**
     * When people visit: visits started in the last 4 weeks by weekday and hour (India time). Cached for ten minutes: it reads a lot of
     * rows and a pattern over weeks does not need to be live.
     *
     * @return array{cells: list<list<int>>, max: int, visits: int}  cells[weekday 0=Mon .. 6][hour 0..23]
     */
    public function heatmap(?string $role = null): array
    {
        return Cache::remember('activity:heatmap:'.($role ?: 'all'), 600, function () use ($role) {
            $since = Carbon::now()->subDays(28);
            $cells = array_fill(0, 7, array_fill(0, 24, 0));
            $count = 0;

            $this->roleScope(ActivityVisit::query()->where('started_at', '>=', $since), $role)
                ->select('id', 'started_at')
                ->chunkById(5000, function ($rows) use (&$cells, &$count) {
                    foreach ($rows as $row) {
                        $local = $row->started_at->copy()->setTimezone($this->timezone());
                        $cells[$local->dayOfWeekIso - 1][(int) $local->format('G')]++;
                        $count++;
                    }

                    // A safety stop for a very large platform: a pattern over 200,000 visits is as good as one over every visit.
                    return $count < 200000;
                });

            return ['cells' => $cells, 'max' => max(1, ...array_map('max', $cells)), 'visits' => $count];
        });
    }

    /**
     * Which screens are used: views, people, average time and scroll depth, over the last `$days` days.
     *
     * @return list<array<string, mixed>>
     */
    public function sections(int $days = 14, ?string $role = null, ?int $collegeId = null, int $limit = 25): array
    {
        $query = ActivityPageView::query()
            ->join('activity_visits as v', 'v.id', '=', 'activity_page_views.visit_id')
            ->where('activity_page_views.entered_at', '>=', Carbon::now()->subDays(max(1, min($days, 90))))
            ->when($collegeId !== null, fn ($q) => $q->where('activity_page_views.college_id', $collegeId));

        return $this->roleScope($query, $role, 'v.role')
            ->selectRaw('activity_page_views.section as section, COUNT(*) as views, COUNT(DISTINCT activity_page_views.user_id) as users, AVG(activity_page_views.active_seconds) as avg_seconds, AVG(activity_page_views.max_scroll) as avg_scroll, MAX(activity_page_views.entered_at) as last_at')
            ->groupBy('activity_page_views.section')
            ->orderByDesc('views')
            ->limit($limit)
            ->get()
            ->map(fn ($r) => [
                'section' => $r->section,
                'views' => (int) $r->views,
                'users' => (int) $r->users,
                'avg_seconds' => (int) round((float) $r->avg_seconds),
                'avg_scroll' => (int) round((float) $r->avg_scroll),
                'last_at' => Carbon::parse($r->last_at),
            ])->all();
    }

    // ------------------------------------------------------------------ online

    /**
     * Everyone online right now, one row per person (their latest visit), most recently heard from first.
     *
     * @return array{total: int, rows: list<array<string, mixed>>}
     */
    public function online(?string $role = null, ?int $collegeId = null, ?string $search = null, int $limit = 100): array
    {
        $query = ActivityVisit::query()
            ->join('users as u', 'u.id', '=', 'activity_visits.user_id')
            ->leftJoin('colleges as c', 'c.id', '=', 'activity_visits.college_id')
            ->where('activity_visits.last_seen_at', '>=', $this->onlineSince())
            ->when($collegeId !== null, fn ($q) => $q->where('activity_visits.college_id', $collegeId))
            ->when($search !== null && $search !== '', function ($q) use ($search) {
                $like = '%'.str_replace(['%', '_'], ['\%', '\_'], $search).'%';
                $q->where(fn ($w) => $w->where('u.name', 'like', $like)->orWhere('u.email', 'like', $like)->orWhere('c.name', 'like', $like));
            });

        $rows = $this->roleScope($query, $role, 'activity_visits.role')
            ->orderByDesc('activity_visits.last_seen_at')
            ->limit(500)
            ->get(['activity_visits.*', 'u.name as user_name', 'u.email as user_email', 'c.name as college_name'])
            ->unique('user_id')
            ->values();

        return [
            'total' => $rows->count(),
            'rows' => $rows->take($limit)->map(fn ($v) => [
                'user_id' => $v->user_id,
                'name' => $v->user_name,
                'email' => $v->user_email,
                'role' => $v->role,
                'college_id' => $v->college_id,
                'college' => $v->college_name,
                'section' => $v->current_section,
                'path' => $v->current_path,
                'since' => $v->started_at,
                'last_seen_at' => $v->last_seen_at,
                'active_minutes' => (int) round($v->active_seconds / 60),
                'pages' => $v->pages,
                'device' => $v->device,
                'browser' => $v->browser,
                'os' => $v->os,
            ])->all(),
        ];
    }

    // --------------------------------------------------------------- sign-ins

    /**
     * The sign-in log, newest first.
     *
     * @return array{total: int, page: int, per_page: int, rows: list<array<string, mixed>>}
     */
    public function signIns(?string $event = null, ?int $collegeId = null, ?string $search = null, int $page = 1, int $perPage = 40): array
    {
        $query = AuthEvent::query()
            ->leftJoin('users as u', 'u.id', '=', 'auth_events.user_id')
            ->leftJoin('colleges as c', 'c.id', '=', 'auth_events.college_id')
            ->when($event !== null && $event !== '' && $event !== 'all', fn ($q) => $q->where('auth_events.event', $event))
            ->when($collegeId !== null, fn ($q) => $q->where('auth_events.college_id', $collegeId))
            ->when($search !== null && $search !== '', function ($q) use ($search) {
                $like = '%'.str_replace(['%', '_'], ['\%', '\_'], $search).'%';
                $q->where(fn ($w) => $w->where('u.name', 'like', $like)->orWhere('auth_events.email', 'like', $like)->orWhere('c.name', 'like', $like));
            });

        $total = (clone $query)->count();
        $perPage = max(10, min($perPage, 100));

        $rows = $query->orderByDesc('auth_events.id')
            ->forPage(max(1, $page), $perPage)
            ->get(['auth_events.*', 'u.name as user_name', 'c.name as college_name'])
            ->map(fn ($e) => [
                'id' => $e->id,
                'event' => $e->event,
                'reason' => $e->reason,
                'user_id' => $e->user_id,
                'name' => $e->user_name,
                'email' => $e->email,
                'role' => $e->role,
                'college_id' => $e->college_id,
                'college' => $e->college_name,
                'portal' => $e->portal,
                'device' => $e->device,
                'browser' => $e->browser,
                'os' => $e->os,
                'ip' => $e->ip,
                'at' => $e->created_at,
            ])->all();

        return ['total' => $total, 'page' => max(1, $page), 'per_page' => $perPage, 'rows' => $rows];
    }

    public function isOnline(User $user): bool
    {
        return ActivityVisit::where('user_id', $user->id)->where('last_seen_at', '>=', $this->onlineSince())->exists();
    }

    /** A little of everything for the home strip of the Overview: online, today, this week. */
    public function glance(): array
    {
        $pulse = $this->pulse();

        return [
            'online' => $pulse['online']['total'],
            'today' => $pulse['active']['today'],
            'last_7_days' => $pulse['active']['last_7_days'],
            'sign_ins_today' => $pulse['today']['sign_ins'],
            'tracking' => (bool) config('activity.enabled', true),
        ];
    }

    /** Every visit and page view of a person, newest visit first (used by the user drill-down). */
    public function visitsOf(User $user, int $limit = 15): Collection
    {
        return ActivityVisit::where('user_id', $user->id)
            ->with(['pageViews' => fn ($q) => $q->orderBy('entered_at')->limit(60)])
            ->orderByDesc('started_at')
            ->limit($limit)
            ->get();
    }
}
