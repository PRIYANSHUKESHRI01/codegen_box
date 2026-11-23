<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityPageView;
use App\Models\ActivityVisit;
use App\Models\College;
use App\Models\User;
use App\Services\Activity\ActivityAnalytics;
use App\Services\Activity\AttentionService;
use App\Services\Activity\CollegeAdoption;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Superadmin → Live Activity: who is on AptRun right now, how many came today / this week / this month, which screens are used, and —
 * per college and per person — whether a login that was handed out was ever opened, whether the password was set, and what was done
 * after. Read-only; the data is written by ActivityTrackController (the browser) and AuthEventRecorder (sign-ins).
 */
class SuperAdminActivityController extends Controller
{
    public function __construct(
        private readonly ActivityAnalytics $analytics,
        private readonly CollegeAdoption $adoption,
        private readonly AttentionService $attention,
    ) {}

    private function role(Request $request): ?string
    {
        $role = $request->query('role');

        return in_array($role, ['all', 'staff', ...User::ROLES], true) ? $role : null;
    }

    /** The live view: headline numbers, who is online, and the curves. `role` narrows everything to one kind of account. */
    public function live(Request $request): JsonResponse
    {
        $role = $this->role($request);

        return response()->json([
            'pulse' => $this->analytics->pulse($role),
            'hourly' => $this->analytics->hourly($role),
            'daily' => $this->analytics->daily(30, $role),
            'weekly' => $this->analytics->weekly(8, $role),
            'online' => $this->analytics->online($role, $request->integer('college_id') ?: null, $request->query('q')),
        ]);
    }

    /** Just the quick-changing part (the poll): the strip and the online list. */
    public function pulse(Request $request): JsonResponse
    {
        $role = $this->role($request);

        return response()->json([
            'pulse' => $this->analytics->pulse($role),
            'online' => $this->analytics->online($role, $request->integer('college_id') ?: null, $request->query('q')),
        ]);
    }

    public function patterns(Request $request): JsonResponse
    {
        $role = $this->role($request);

        return response()->json([
            'heatmap' => $this->analytics->heatmap($role),
            'sections' => $this->analytics->sections($request->integer('days', 14), $role),
        ]);
    }

    /** Detailed ranking of platform features: most used, least used, and practice trends. */
    public function featureUsage(Request $request): JsonResponse
    {
        $days = $request->integer('days', 30);
        $role = $this->role($request);
        $collegeId = $request->integer('college_id') ?: null;

        return response()->json($this->analytics->detailedFeatureUsage($days, $role, $collegeId));
    }

    /** Authentic platform usage timeline (hourly for today/yesterday/any-day, daily for week/month) excluding superadmin. */
    public function usageTimeline(Request $request): JsonResponse
    {
        $period = $request->query('period', 'today');
        $date = $request->query('date');

        return response()->json($this->analytics->usageTimeline((string) $period, $date ? (string) $date : null));
    }

    public function glance(): JsonResponse
    {
        return response()->json($this->analytics->glance());
    }

    public function attention(): JsonResponse
    {
        return response()->json(['items' => $this->attention->items()]);
    }

    public function colleges(Request $request): JsonResponse
    {
        return response()->json($this->adoption->directory(
            ['q' => $request->query('q'), 'status' => $request->query('status'), 'sort' => $request->query('sort')],
            $request->integer('page', 1),
            $request->integer('per_page', 25),
        ));
    }

    public function college(Request $request, College $college): JsonResponse
    {
        $role = $this->role($request);

        return response()->json($this->adoption->college($college, $role, max(7, min($request->integer('days', 30), 90))));
    }

    public function people(Request $request, College $college): JsonResponse
    {
        return response()->json($this->adoption->people(
            $college,
            $request->query('role'),
            $request->query('q'),
            $request->query('state'),
            $request->integer('page', 1),
            $request->integer('per_page', 25),
        ));
    }

    public function visitors(Request $request): JsonResponse
    {
        $period = $request->query('period', 'today');
        $role = $this->role($request);
        $search = $request->query('q');
        $collegeId = $request->query('college_id');
        $page = max(1, $request->integer('page', 1));
        $perPage = max(10, min($request->integer('per_page', 25), 100));

        $tz = $this->analytics->timezone();
        $now = Carbon::now();
        $until = null;

        switch ($period) {
            case '15m':
            case 'last_15_minutes':
                $since = $now->copy()->subMinutes(15);
                $periodLabel = 'Last 15 minutes';
                break;
            case 'online':
                $since = Carbon::now()->subSeconds(max(30, (int) config('activity.online_window_seconds', 150)));
                $periodLabel = 'Online right now';
                break;
            case 'yesterday':
                $yesterday = Carbon::now($tz)->subDay();
                $since = $yesterday->copy()->startOfDay()->setTimezone(config('app.timezone'));
                $until = $yesterday->copy()->endOfDay()->setTimezone(config('app.timezone'));
                $periodLabel = 'Yesterday ('.$yesterday->format('M d, Y').')';
                break;
            case 'this_week':
                $monday = Carbon::now($tz)->startOfWeek(Carbon::MONDAY);
                $since = $monday->startOfDay()->setTimezone(config('app.timezone'));
                $periodLabel = 'This week (since '.$monday->format('M d').')';
                break;
            case 'last_7d':
            case 'last_7_days':
                $since = Carbon::now($tz)->subDays(6)->startOfDay()->setTimezone(config('app.timezone'));
                $periodLabel = 'Last 7 days';
                break;
            case 'last_30d':
            case 'last_30_days':
                $since = Carbon::now($tz)->subDays(29)->startOfDay()->setTimezone(config('app.timezone'));
                $periodLabel = 'Last 30 days';
                break;
            case 'today':
            default:
                $period = 'today';
                $since = $this->analytics->dayStart();
                $periodLabel = 'Today ('.Carbon::now($tz)->format('M d, Y').')';
                break;
        }

        $query = ActivityVisit::query()
            ->join('users as u', 'u.id', '=', 'activity_visits.user_id')
            ->leftJoin('colleges as c', 'c.id', '=', 'activity_visits.college_id')
            ->where('activity_visits.last_seen_at', '>=', $since)
            ->when($until !== null, fn ($q) => $q->where('activity_visits.started_at', '<=', $until));

        if ($collegeId === 'none') {
            $query->whereNull('activity_visits.college_id');
        } elseif ($collegeId !== null && $collegeId !== '' && ctype_digit((string) $collegeId)) {
            $query->where('activity_visits.college_id', (int) $collegeId);
        }

        if ($search !== null && $search !== '') {
            $like = '%'.str_replace(['%', '_'], ['\%', '\_'], $search).'%';
            $query->where(function ($w) use ($like) {
                $w->where('u.name', 'like', $like)
                    ->orWhere('u.email', 'like', $like)
                    ->orWhere('c.name', 'like', $like);
            });
        }

        if ($role === 'staff') {
            $query->whereIn('activity_visits.role', ActivityAnalytics::STAFF_ROLES);
        } elseif ($role !== null && $role !== '' && $role !== 'all') {
            $query->where('activity_visits.role', $role);
        }

        $totalUsers = (clone $query)->distinct()->count('activity_visits.user_id');

        if ($totalUsers === 0) {
            return response()->json([
                'period' => $period,
                'label' => $periodLabel,
                'total' => 0,
                'page' => $page,
                'per_page' => $perPage,
                'last_page' => 1,
                'rows' => [],
            ]);
        }

        $userAggregates = (clone $query)
            ->selectRaw('
                activity_visits.user_id,
                COUNT(activity_visits.id) as visits_count,
                SUM(activity_visits.active_seconds) as total_seconds,
                SUM(activity_visits.pages) as total_pages,
                MIN(activity_visits.started_at) as first_seen_at,
                MAX(activity_visits.last_seen_at) as last_seen_at,
                MAX(activity_visits.device) as latest_device,
                MAX(activity_visits.browser) as latest_browser,
                MAX(activity_visits.os) as latest_os,
                MAX(activity_visits.ip) as latest_ip,
                MAX(activity_visits.current_section) as latest_section,
                MAX(activity_visits.current_path) as latest_path
            ')
            ->groupBy('activity_visits.user_id')
            ->orderByDesc('last_seen_at')
            ->forPage($page, $perPage)
            ->get();

        $userIds = $userAggregates->pluck('user_id')->all();

        $users = User::with('college:id,name')->whereIn('id', $userIds)->get()->keyBy('id');

        $sectionViews = ActivityPageView::query()
            ->whereIn('user_id', $userIds)
            ->where('entered_at', '>=', $since)
            ->when($until !== null, fn ($q) => $q->where('entered_at', '<=', $until))
            ->selectRaw('user_id, section, COUNT(*) as views, SUM(active_seconds) as seconds, MAX(entered_at) as last_entered_at')
            ->groupBy('user_id', 'section')
            ->orderByDesc('seconds')
            ->get()
            ->groupBy('user_id');

        $onlineThreshold = Carbon::now()->subSeconds(max(30, (int) config('activity.online_window_seconds', 150)));

        $rows = $userAggregates->map(function ($agg) use ($users, $sectionViews, $onlineThreshold) {
            $u = $users->get($agg->user_id);
            if (! $u) {
                return null;
            }

            $userSections = ($sectionViews->get($agg->user_id) ?? collect())->map(fn ($s) => [
                'section' => $s->section ?: 'General',
                'views' => (int) $s->views,
                'active_minutes' => (int) round($s->seconds / 60),
                'active_seconds' => (int) $s->seconds,
            ])->values()->all();

            $lastSeen = Carbon::parse($agg->last_seen_at);
            $isOnline = $lastSeen->gte($onlineThreshold);

            return [
                'user' => [
                    'id' => $u->id,
                    'name' => $u->name,
                    'email' => $u->email,
                    'role' => $u->role,
                    'roll_number' => $u->roll_number,
                    'college_id' => $u->college_id,
                    'college' => $u->college?->name ?? 'Direct / Independent',
                    'is_independent' => $u->role === User::ROLE_USER && $u->college_id === null,
                ],
                'visits_count' => (int) $agg->visits_count,
                'active_minutes' => (int) round($agg->total_seconds / 60),
                'active_seconds' => (int) $agg->total_seconds,
                'pages_count' => (int) $agg->total_pages,
                'first_seen_at' => $agg->first_seen_at,
                'last_seen_at' => $agg->last_seen_at,
                'is_online' => $isOnline,
                'device' => $agg->latest_device,
                'browser' => $agg->latest_browser,
                'os' => $agg->latest_os,
                'ip' => $agg->latest_ip,
                'current_section' => $agg->latest_section,
                'current_path' => $agg->latest_path,
                'sections' => $userSections,
            ];
        })->filter()->values();

        return response()->json([
            'period' => $period,
            'label' => $periodLabel,
            'total' => $totalUsers,
            'page' => $page,
            'per_page' => $perPage,
            'last_page' => (int) ceil($totalUsers / $perPage),
            'rows' => $rows,
        ]);
    }

    public function person(User $user): JsonResponse
    {
        abort_if($user->role === User::ROLE_SUPERADMIN, 404);

        return response()->json($this->adoption->person($user));
    }

    public function signIns(Request $request): JsonResponse
    {
        return response()->json($this->analytics->signIns(
            $request->query('event'),
            $request->integer('college_id') ?: null,
            $request->query('q'),
            $request->integer('page', 1),
            $request->integer('per_page', 40),
        ));
    }
}
