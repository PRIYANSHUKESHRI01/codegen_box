<?php

namespace App\Services\Activity;

use App\Models\ActivityPageView;
use App\Models\ActivityVisit;
use App\Models\AuthEvent;
use App\Models\College;
use App\Models\ContestSubmission;
use App\Models\CorePracticeAnswer;
use App\Models\InterviewSession;
use App\Models\ListeningAttempt;
use App\Models\SpeakingAttempt;
use App\Models\Submission;
use App\Models\User;
use App\Models\UserActivityDay;
use App\Models\VocabularyAttempt;
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

    public const FEATURE_CATALOG = [
        ['section' => 'Practice Arena', 'category' => 'Coding & Problem Solving', 'color' => '#10b981'],
        ['section' => 'Core Prep · Practice', 'category' => 'Core Technical Prep', 'color' => '#3b82f6'],
        ['section' => 'Core Prep · Tests', 'category' => 'Core Technical Prep', 'color' => '#6366f1'],
        ['section' => 'Mock AI Interview', 'category' => 'AI Mock Interviews', 'color' => '#8b5cf6'],
        ['section' => 'Vault AI Interview', 'category' => 'AI Mock Interviews', 'color' => '#a855f7'],
        ['section' => 'Skill Drills', 'category' => 'Core Technical Prep', 'color' => '#06b6d4'],
        ['section' => 'Contests', 'category' => 'Coding & Contests', 'color' => '#f59e0b'],
        ['section' => 'Learning Centre · Speaking', 'category' => 'Communication & Voice', 'color' => '#ec4899'],
        ['section' => 'Learning Centre · Listening', 'category' => 'Communication & Voice', 'color' => '#f43f5e'],
        ['section' => 'Learning Centre · Vocabulary', 'category' => 'Communication & Voice', 'color' => '#e11d48'],
        ['section' => 'Soft Skills', 'category' => 'Aptitude & Soft Skills', 'color' => '#14b8a6'],
        ['section' => 'Project Lab', 'category' => 'Project Engineering', 'color' => '#84cc16'],
        ['section' => 'Hack Arena', 'category' => 'Hackathons & Projects', 'color' => '#d946ef'],
        ['section' => 'Company PYQs', 'category' => 'Company Prep & Placement', 'color' => '#f97316'],
        ['section' => 'Upcoming Drives', 'category' => 'Company Prep & Placement', 'color' => '#fb923c'],
        ['section' => 'Leaderboard', 'category' => 'Gamification & Rewards', 'color' => '#eab308'],
        ['section' => 'Student Overview', 'category' => 'Dashboard & Navigation', 'color' => '#64748b'],
    ];

    /**
     * Detailed platform feature and module usage: ranks features from most used down to least used,
     * category distribution, time engagement, and daily practice trends without any schema changes.
     *
     * @return array<string, mixed>
     */
    public function detailedFeatureUsage(int $days = 30, ?string $role = null, ?int $collegeId = null): array
    {
        $days = max(1, min($days, 90));
        $since = Carbon::now()->subDays($days);
        $tz = $this->timezone();

        // 1. Query ActivityPageViews by section
        $viewsQuery = ActivityPageView::query()
            ->join('activity_visits as v', 'v.id', '=', 'activity_page_views.visit_id')
            ->where('activity_page_views.entered_at', '>=', $since)
            ->when($collegeId !== null, fn ($q) => $q->where('activity_page_views.college_id', $collegeId));

        $pageViewsBySection = $this->roleScope($viewsQuery, $role, 'v.role')
            ->selectRaw('activity_page_views.section as section, COUNT(*) as views, COUNT(DISTINCT activity_page_views.user_id) as users, SUM(activity_page_views.active_seconds) as total_seconds, AVG(activity_page_views.active_seconds) as avg_seconds, AVG(activity_page_views.max_scroll) as avg_scroll, MAX(activity_page_views.entered_at) as last_at')
            ->groupBy('activity_page_views.section')
            ->get()
            ->keyBy('section');

        // 2. Direct Practice counts over period
        $practiceCounts = [
            'coding_submissions' => Submission::where('created_at', '>=', $since)->count(),
            'core_answers' => CorePracticeAnswer::where('created_at', '>=', $since)->count(),
            'speaking_attempts' => SpeakingAttempt::where('created_at', '>=', $since)->count(),
            'listening_attempts' => ListeningAttempt::where('created_at', '>=', $since)->count(),
            'vocabulary_attempts' => VocabularyAttempt::where('created_at', '>=', $since)->count(),
            'contest_submissions' => ContestSubmission::where('created_at', '>=', $since)->count(),
        ];
        $totalPracticeActions = array_sum($practiceCounts);

        // 3. Category Map
        $categoryMap = [];
        $colorMap = [];
        foreach (self::FEATURE_CATALOG as $item) {
            $categoryMap[$item['section']] = $item['category'];
            $colorMap[$item['section']] = $item['color'];
        }

        // 4. Combine all features from catalog and any additional ones in DB
        $allSections = array_unique(array_merge(
            array_column(self::FEATURE_CATALOG, 'section'),
            $pageViewsBySection->keys()->all()
        ));

        // Skip internal/auth non-feature screens
        $excludedFromRanking = ['Login', 'Register', 'Forgot Password', 'Reset Password'];
        $allSections = array_diff($allSections, $excludedFromRanking);

        $featureItems = [];
        $totalTrackedViews = 0;
        $totalTrackedSeconds = 0;

        foreach ($allSections as $section) {
            $row = $pageViewsBySection->get($section);
            $views = (int) ($row->views ?? 0);
            $users = (int) ($row->users ?? 0);
            $seconds = (int) ($row->total_seconds ?? 0);
            $avgSec = (int) round((float) ($row->avg_seconds ?? 0));
            $avgScroll = (int) round((float) ($row->avg_scroll ?? 0));
            $lastAt = $row?->last_at ? Carbon::parse($row->last_at)->toIso8601String() : null;

            $category = $categoryMap[$section] ?? 'Other Platform Modules';
            $color = $colorMap[$section] ?? '#94a3b8';

            // Connect direct practice count if applicable
            $directCount = 0;
            if (str_contains($section, 'Practice Arena')) $directCount = $practiceCounts['coding_submissions'];
            elseif (str_contains($section, 'Core Prep')) $directCount = $practiceCounts['core_answers'];
            elseif (str_contains($section, 'Speaking')) $directCount = $practiceCounts['speaking_attempts'];
            elseif (str_contains($section, 'Listening')) $directCount = $practiceCounts['listening_attempts'];
            elseif (str_contains($section, 'Vocabulary')) $directCount = $practiceCounts['vocabulary_attempts'];
            elseif (str_contains($section, 'Contests')) $directCount = $practiceCounts['contest_submissions'];

            // Effective engagement score: views + direct practice actions
            $engagementScore = $views + ($directCount * 2);

            $totalTrackedViews += $views;
            $totalTrackedSeconds += $seconds;

            $featureItems[] = [
                'section' => $section,
                'category' => $category,
                'color' => $color,
                'views' => $views,
                'users' => $users,
                'total_seconds' => $seconds,
                'total_minutes' => round($seconds / 60, 1),
                'avg_seconds' => $avgSec,
                'avg_minutes' => round($avgSec / 60, 1),
                'avg_scroll' => $avgScroll,
                'direct_attempts' => $directCount,
                'engagement_score' => $engagementScore,
                'last_at' => $lastAt,
            ];
        }

        // Sort by engagement score descending (most used first)
        usort($featureItems, fn ($a, $b) => $b['engagement_score'] <=> $a['engagement_score'] ?: $b['views'] <=> $a['views']);

        $totalPlatformActions = max(1, $totalTrackedViews + $totalPracticeActions);

        $rank = 1;
        $ranked = [];

        foreach ($featureItems as $item) {
            $totalEngagements = $item['views'] + $item['direct_attempts'];
            $share = round(($totalEngagements / $totalPlatformActions) * 100, 1);
            $tier = match (true) {
                $rank <= 3 => 'most_popular',
                $rank <= 7 => 'high_engagement',
                $rank <= 11 => 'moderate',
                default => 'least_used',
            };

            $item['rank'] = $rank;
            $item['total_engagements'] = $totalEngagements;
            $item['share_percentage'] = $share;
            $item['usage_tier'] = $tier;
            $ranked[] = $item;
            $rank++;
        }

        // Most used (top 4) and Least used (bottom 4)
        $mostUsed = array_slice($ranked, 0, 4);
        $leastUsed = array_reverse(array_slice($ranked, -4));

        // Group by category
        $categoryGroups = [];
        foreach ($ranked as $f) {
            $cat = $f['category'];
            if (! isset($categoryGroups[$cat])) {
                $categoryGroups[$cat] = [
                    'category' => $cat,
                    'color' => $f['color'],
                    'views' => 0,
                    'direct_attempts' => 0,
                    'engagements' => 0,
                    'users' => 0,
                    'minutes' => 0,
                    'features_count' => 0,
                ];
            }
            $categoryGroups[$cat]['views'] += $f['views'];
            $categoryGroups[$cat]['direct_attempts'] += $f['direct_attempts'];
            $categoryGroups[$cat]['engagements'] += $f['total_engagements'];
            $categoryGroups[$cat]['users'] = max($categoryGroups[$cat]['users'], $f['users']);
            $categoryGroups[$cat]['minutes'] += $f['total_minutes'];
            $categoryGroups[$cat]['features_count']++;
        }

        $categories = array_values($categoryGroups);
        usort($categories, fn ($a, $b) => $b['engagements'] <=> $a['engagements'] ?: $b['views'] <=> $a['views']);
        foreach ($categories as &$cat) {
            $cat['share_percentage'] = round(($cat['engagements'] / $totalPlatformActions) * 100, 1);
        }
        unset($cat);

        // Daily trend over period
        $trendQuery = ActivityPageView::query()
            ->join('activity_visits as v', 'v.id', '=', 'activity_page_views.visit_id')
            ->where('activity_page_views.entered_at', '>=', $since)
            ->when($collegeId !== null, fn ($q) => $q->where('activity_page_views.college_id', $collegeId));

        $dailyStats = $this->roleScope($trendQuery, $role, 'v.role')
            ->selectRaw('DATE(activity_page_views.entered_at) as day, COUNT(*) as views, COUNT(DISTINCT activity_page_views.user_id) as users, SUM(activity_page_views.active_seconds) as seconds')
            ->groupBy('day')
            ->get()
            ->keyBy('day');

        $dailyTrend = [];
        $checkDays = min($days, 30);
        for ($i = $checkDays - 1; $i >= 0; $i--) {
            $d = Carbon::now($tz)->subDays($i);
            $dateStr = $d->toDateString();
            $stat = $dailyStats->get($dateStr);
            $dailyTrend[] = [
                'day' => $dateStr,
                'label' => $d->format('M j'),
                'views' => (int) ($stat->views ?? 0),
                'users' => (int) ($stat->users ?? 0),
                'minutes' => (int) round(((int) ($stat->seconds ?? 0)) / 60),
            ];
        }

        $topName = $mostUsed[0]['section'] ?? 'None';
        $bottomName = $leastUsed[0]['section'] ?? 'None';

        return [
            'period_days' => $days,
            'summary' => [
                'total_views' => $totalTrackedViews,
                'total_minutes' => round($totalTrackedSeconds / 60, 1),
                'total_practice_actions' => $totalPracticeActions,
                'total_features_tracked' => count($ranked),
                'top_feature' => $topName,
                'least_feature' => $bottomName,
                'top_category' => $categories[0]['category'] ?? 'None',
            ],
            'ranked_features' => $ranked,
            'most_used' => $mostUsed,
            'least_used' => $leastUsed,
            'categories' => $categories,
            'daily_trend' => $dailyTrend,
            'practice_totals' => $practiceCounts,
        ];
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

    /**
     * Authentic platform usage timeline for Superadmin:
     * - period: 'today', 'yesterday', 'this_week', 'this_month', or 'day' (with custom $customDate)
     * - Strictly excludes superadmin users from all metrics.
     * - Returns hourly breakdown for single-day periods (today, yesterday, specific date)
     * - Returns daily breakdown for multi-day periods (this_week, this_month)
     * - Authentic KPIs: Unique active users, total sessions/visits, total usage time (minutes/hours),
     *   average time per user, interviews completed, code submissions, logins, and peak usage.
     *
     * @return array<string, mixed>
     */
    public function usageTimeline(string $period = 'today', ?string $customDate = null): array
    {
        $superadminIds = User::where('role', User::ROLE_SUPERADMIN)->pluck('id')->all();
        $tz = $this->timezone();
        $now = Carbon::now($tz);

        // Earliest activity date in DB for date picker constraints
        $minDate = UserActivityDay::min('day') ?: (InterviewSession::min('created_at') ?: $now->copy()->subDays(60)->toDateString());
        $minDateStr = Carbon::parse($minDate)->toDateString();
        $maxDateStr = $now->toDateString();

        $mode = 'hourly';
        $targetDate = $now->toDateString();
        $startDate = $targetDate;
        $endDate = $targetDate;

        if ($period === 'yesterday') {
            $targetDate = $now->copy()->subDay()->toDateString();
            $startDate = $targetDate;
            $endDate = $targetDate;
            $mode = 'hourly';
        } elseif ($period === 'day' && $customDate && preg_match('/^\d{4}-\d{2}-\d{2}$/', $customDate)) {
            $targetDate = $customDate;
            $startDate = $targetDate;
            $endDate = $targetDate;
            $mode = 'hourly';
        } elseif ($period === 'this_week') {
            $startDate = $now->copy()->startOfWeek(Carbon::MONDAY)->toDateString();
            $endDate = $now->copy()->startOfWeek(Carbon::MONDAY)->addDays(6)->toDateString();
            $mode = 'daily';
        } elseif ($period === 'this_month') {
            $startDate = $now->copy()->startOfMonth()->toDateString();
            $endDate = $now->copy()->endOfMonth()->toDateString();
            $mode = 'daily';
        } else {
            $period = 'today';
            $targetDate = $now->toDateString();
            $startDate = $targetDate;
            $endDate = $targetDate;
            $mode = 'hourly';
        }

        if ($mode === 'hourly') {
            return $this->buildHourlyUsageTimeline($targetDate, $period, $superadminIds, $tz, $minDateStr, $maxDateStr);
        }

        return $this->buildDailyUsageTimeline($startDate, $endDate, $period, $superadminIds, $tz, $minDateStr, $maxDateStr);
    }

    /**
     * Builds 24-hour breakdown for a single date.
     */
    protected function buildHourlyUsageTimeline(
        string $targetDate,
        string $period,
        array $superadminIds,
        string $tz,
        string $minDateStr,
        string $maxDateStr
    ): array {
        $dayStart = Carbon::parse($targetDate, $tz)->startOfDay()->setTimezone(config('app.timezone'));
        $dayEnd = Carbon::parse($targetDate, $tz)->endOfDay()->setTimezone(config('app.timezone'));

        // Query authentic non-superadmin activity records
        $visits = ActivityVisit::whereNotIn('user_id', $superadminIds)
            ->where('started_at', '<=', $dayEnd)
            ->where('last_seen_at', '>=', $dayStart)
            ->get(['id', 'user_id', 'started_at', 'last_seen_at', 'active_seconds']);

        $interviews = InterviewSession::whereNotIn('user_id', $superadminIds)
            ->whereBetween('created_at', [$dayStart, $dayEnd])
            ->get(['id', 'user_id', 'created_at', 'status']);

        $submissions = Submission::whereNotIn('user_id', $superadminIds)
            ->whereBetween('created_at', [$dayStart, $dayEnd])
            ->get(['id', 'user_id', 'created_at']);

        $logins = AuthEvent::whereNotIn('user_id', $superadminIds)
            ->where('event', AuthEvent::LOGIN)
            ->whereBetween('created_at', [$dayStart, $dayEnd])
            ->get(['id', 'user_id', 'created_at']);

        $userActivityDays = UserActivityDay::whereNotIn('user_id', $superadminIds)
            ->where('day', $targetDate)
            ->get();

        // Unique users across all activity types on this day
        $allUniqueUsers = array_unique(array_filter([
            ...$visits->pluck('user_id')->all(),
            ...$interviews->pluck('user_id')->all(),
            ...$submissions->pluck('user_id')->all(),
            ...$logins->pluck('user_id')->all(),
            ...$userActivityDays->pluck('user_id')->all(),
        ]));

        $totalUniqueUsers = count($allUniqueUsers);
        $totalVisits = max($visits->count(), (int) $userActivityDays->sum('visits'));
        $totalSeconds = (int) ($visits->sum('active_seconds') ?: $userActivityDays->sum('active_seconds'));
        $totalMinutes = (int) round($totalSeconds / 60);
        $interviewsCompleted = $interviews->where('status', InterviewSession::STATUS_COMPLETED)->count();
        $interviewsTotal = $interviews->count();
        $submissionsTotal = $submissions->count();
        $loginsTotal = $logins->count();

        $graph = [];
        $peakHourUsers = 0;
        $peakHourLabel = null;

        for ($h = 0; $h < 24; $h++) {
            $hStartLocal = Carbon::parse($targetDate, $tz)->addHours($h);
            $hEndLocal = $hStartLocal->copy()->addHour();

            $slotStart = $hStartLocal->copy()->setTimezone(config('app.timezone'));
            $slotEnd = $hEndLocal->copy()->setTimezone(config('app.timezone'));

            $hourVisits = $visits->filter(fn ($v) => $v->started_at < $slotEnd && $v->last_seen_at >= $slotStart);
            $hourInterviews = $interviews->filter(fn ($i) => $i->created_at >= $slotStart && $i->created_at < $slotEnd);
            $hourSubmissions = $submissions->filter(fn ($s) => $s->created_at >= $slotStart && $s->created_at < $slotEnd);
            $hourLogins = $logins->filter(fn ($l) => $l->created_at >= $slotStart && $l->created_at < $slotEnd);

            $hourUniqueUsers = count(array_unique(array_filter([
                ...$hourVisits->pluck('user_id')->all(),
                ...$hourInterviews->pluck('user_id')->all(),
                ...$hourSubmissions->pluck('user_id')->all(),
                ...$hourLogins->pluck('user_id')->all(),
            ])));

            // Estimate minutes spent during this hour
            $hourSeconds = 0;
            foreach ($hourVisits as $v) {
                $overlapStart = max($v->started_at->getTimestamp(), $slotStart->getTimestamp());
                $overlapEnd = min($v->last_seen_at->getTimestamp(), $slotEnd->getTimestamp());
                if ($overlapEnd > $overlapStart) {
                    $hourSeconds += min(3600, $overlapEnd - $overlapStart);
                }
            }
            $hourMinutes = (int) round($hourSeconds / 60);
            $hourActions = $hourInterviews->count() + $hourSubmissions->count();

            $label = $h === 0 ? '12 AM' : ($h < 12 ? "{$h} AM" : ($h === 12 ? '12 PM' : ($h - 12) . ' PM'));
            $nextH = ($h + 1) % 24;
            $nextLabel = $nextH === 0 ? '12 AM' : ($nextH < 12 ? "{$nextH} AM" : ($nextH === 12 ? '12 PM' : ($nextH - 12) . ' PM'));

            if ($hourUniqueUsers > $peakHourUsers) {
                $peakHourUsers = $hourUniqueUsers;
                $peakHourLabel = "{$label} ({$hourUniqueUsers} active users)";
            }

            $graph[] = [
                'time_key' => $hStartLocal->format('Y-m-d H:i'),
                'label' => $label,
                'full_label' => "{$label} - {$nextLabel}",
                'users' => $hourUniqueUsers,
                'visits' => $hourVisits->count(),
                'minutes' => $hourMinutes,
                'actions' => $hourActions,
                'interviews' => $hourInterviews->count(),
                'submissions' => $hourSubmissions->count(),
                'sign_ins' => $hourLogins->count(),
            ];
        }

        $formattedDate = Carbon::parse($targetDate, $tz)->format('l, d M Y');

        return [
            'period' => $period,
            'selected_date' => $targetDate,
            'date_formatted' => $formattedDate,
            'timezone' => $tz,
            'view_mode' => 'hourly',
            'kpis' => [
                'unique_users' => $totalUniqueUsers,
                'total_visits' => $totalVisits,
                'total_minutes' => $totalMinutes,
                'total_hours' => round($totalMinutes / 60, 1),
                'avg_minutes_per_user' => $totalUniqueUsers > 0 ? round($totalMinutes / $totalUniqueUsers, 1) : 0,
                'interviews_completed' => $interviewsCompleted,
                'interviews_total' => $interviewsTotal,
                'submissions_total' => $submissionsTotal,
                'sign_ins_total' => $loginsTotal,
                'peak_metric_label' => $peakHourLabel ? "Peak: {$peakHourLabel}" : 'No user activity recorded on this day',
            ],
            'graph' => $graph,
            'available_range' => [
                'min_date' => $minDateStr,
                'max_date' => $maxDateStr,
            ],
        ];
    }

    /**
     * Builds day-by-day breakdown for a date range (e.g. this_week, this_month).
     */
    protected function buildDailyUsageTimeline(
        string $startDate,
        string $endDate,
        string $period,
        array $superadminIds,
        string $tz,
        string $minDateStr,
        string $maxDateStr
    ): array {
        $rangeStart = Carbon::parse($startDate, $tz)->startOfDay()->setTimezone(config('app.timezone'));
        $rangeEnd = Carbon::parse($endDate, $tz)->endOfDay()->setTimezone(config('app.timezone'));

        $userActivityDays = UserActivityDay::whereNotIn('user_id', $superadminIds)
            ->whereBetween('day', [$startDate, $endDate])
            ->get();

        $interviews = InterviewSession::whereNotIn('user_id', $superadminIds)
            ->whereBetween('created_at', [$rangeStart, $rangeEnd])
            ->get(['id', 'user_id', 'created_at', 'status']);

        $submissions = Submission::whereNotIn('user_id', $superadminIds)
            ->whereBetween('created_at', [$rangeStart, $rangeEnd])
            ->get(['id', 'user_id', 'created_at']);

        $logins = AuthEvent::whereNotIn('user_id', $superadminIds)
            ->where('event', AuthEvent::LOGIN)
            ->whereBetween('created_at', [$rangeStart, $rangeEnd])
            ->get(['id', 'user_id', 'created_at']);

        $periodUniqueUsers = array_unique(array_filter([
            ...$userActivityDays->pluck('user_id')->all(),
            ...$interviews->pluck('user_id')->all(),
            ...$submissions->pluck('user_id')->all(),
            ...$logins->pluck('user_id')->all(),
        ]));

        $totalUniqueUsers = count($periodUniqueUsers);
        $totalVisits = (int) $userActivityDays->sum('visits');
        $totalSeconds = (int) $userActivityDays->sum('active_seconds');
        $totalMinutes = (int) round($totalSeconds / 60);
        $interviewsCompleted = $interviews->where('status', InterviewSession::STATUS_COMPLETED)->count();
        $interviewsTotal = $interviews->count();
        $submissionsTotal = $submissions->count();
        $loginsTotal = $logins->count();

        $graph = [];
        $peakDayUsers = 0;
        $peakDayLabel = null;

        $startCal = Carbon::parse($startDate, $tz);
        $endCal = Carbon::parse($endDate, $tz);
        $diffDays = $startCal->diffInDays($endCal);

        for ($i = 0; $i <= $diffDays; $i++) {
            $curDate = $startCal->copy()->addDays($i);
            $curDateStr = $curDate->toDateString();

            $dayStart = $curDate->copy()->startOfDay()->setTimezone(config('app.timezone'));
            $dayEnd = $curDate->copy()->endOfDay()->setTimezone(config('app.timezone'));

            $dayActRows = $userActivityDays->filter(fn ($row) => Carbon::parse($row->day)->toDateString() === $curDateStr);
            $dayInterviews = $interviews->filter(fn ($item) => $item->created_at >= $dayStart && $item->created_at <= $dayEnd);
            $daySubmissions = $submissions->filter(fn ($item) => $item->created_at >= $dayStart && $item->created_at <= $dayEnd);
            $dayLogins = $logins->filter(fn ($item) => $item->created_at >= $dayStart && $item->created_at <= $dayEnd);

            $dayUsersList = array_unique(array_filter([
                ...$dayActRows->pluck('user_id')->all(),
                ...$dayInterviews->pluck('user_id')->all(),
                ...$daySubmissions->pluck('user_id')->all(),
                ...$dayLogins->pluck('user_id')->all(),
            ]));

            $dayUsersCount = count($dayUsersList);
            $dayVisitsCount = max((int) $dayActRows->sum('visits'), count($dayUsersList));
            $trackedMinutes = (int) round($dayActRows->sum('active_seconds') / 60);
            $activityMinutes = ($dayInterviews->count() * 15) + ($daySubmissions->count() * 5);
            $dayMinutes = max($trackedMinutes, $activityMinutes);
            $dayActions = $dayInterviews->count() + $daySubmissions->count();

            $shortLabel = $curDate->format('D j');
            $fullLabel = $curDate->format('l, d M Y');

            if ($dayUsersCount > $peakDayUsers) {
                $peakDayUsers = $dayUsersCount;
                $peakDayLabel = "{$curDate->format('D, d M')} ({$dayUsersCount} active users)";
            }

            $graph[] = [
                'time_key' => $curDateStr,
                'label' => $shortLabel,
                'full_label' => $fullLabel,
                'users' => $dayUsersCount,
                'visits' => $dayVisitsCount,
                'minutes' => $dayMinutes,
                'actions' => $dayActions,
                'interviews' => $dayInterviews->count(),
                'submissions' => $daySubmissions->count(),
                'sign_ins' => $dayLogins->count(),
            ];
        }

        $sumMinutes = (int) collect($graph)->sum('minutes');
        $sumVisits = (int) collect($graph)->sum('visits');
        $finalMinutes = max($totalMinutes, $sumMinutes);
        $finalVisits = max($totalVisits, $sumVisits);

        $formattedStart = Carbon::parse($startDate, $tz)->format('d M');
        $formattedEnd = Carbon::parse($endDate, $tz)->format('d M Y');

        return [
            'period' => $period,
            'selected_date' => $endDate,
            'date_formatted' => "{$formattedStart} – {$formattedEnd}",
            'timezone' => $tz,
            'view_mode' => 'daily',
            'kpis' => [
                'unique_users' => $totalUniqueUsers,
                'total_visits' => $finalVisits,
                'total_minutes' => $finalMinutes,
                'total_hours' => round($finalMinutes / 60, 1),
                'avg_minutes_per_user' => $totalUniqueUsers > 0 ? round($finalMinutes / $totalUniqueUsers, 1) : 0,
                'interviews_completed' => $interviewsCompleted,
                'interviews_total' => $interviewsTotal,
                'submissions_total' => $submissionsTotal,
                'sign_ins_total' => $loginsTotal,
                'peak_metric_label' => $peakDayLabel ? "Peak: {$peakDayLabel}" : 'No user activity recorded in this period',
            ],
            'graph' => $graph,
            'available_range' => [
                'min_date' => $minDateStr,
                'max_date' => $maxDateStr,
            ],
        ];
    }
}
