<?php

namespace App\Services;

use App\Models\CoreSubject;
use App\Models\DriveCollegeMapping;
use App\Models\PlacementDrive;
use App\Models\Submission;
use App\Models\User;
use App\Services\Core\CoreAccess;
use App\Services\Core\CoreMasteryService;
use App\Support\DepartmentCapabilities;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * The one place a student's cohort-table row (readiness score/tier, 7-day
 * practice consistency, real cross-drive eligibility, coding activity and
 * language profile) gets built — extracted out of TpoStudentController so the
 * Section Coordinator's narrower, section-scoped roster view can reuse the
 * exact same computation instead of a second, driftable copy. Same "one rule,
 * reused everywhere" convention as EligibilityService itself.
 *
 * Built for a whole roster at once: payloads() scores every student with a
 * fixed handful of grouped queries (readiness, activity, languages) rather
 * than a few dozen per student, so a college with thousands of students opens
 * the cohort page in the same number of queries as one with ten. payload()
 * (one student — add / block responses) runs the very same path.
 */
class StudentCohortService
{
    /** Practised within this many days → "active". */
    public const ACTIVE_WITHIN_DAYS = 7;

    /** Practised within this many days (but not the active window) → "slipping"; older → "dormant". */
    public const SLIPPING_WITHIN_DAYS = 21;

    public const ENGAGEMENT_PENDING_ACTIVATION = 'pending_activation';

    public const ENGAGEMENT_NOT_STARTED = 'not_started';

    public const ENGAGEMENT_ACTIVE = 'active';

    public const ENGAGEMENT_SLIPPING = 'slipping';

    public const ENGAGEMENT_DORMANT = 'dormant';

    /** Ids per activity query — far under every driver's bind-parameter limit. */
    private const ID_CHUNK = 500;

    public function __construct(
        private readonly ReadinessScoreService $readiness,
        private readonly LanguageInsightsService $languages,
    ) {}

    /** Every currently published drive actively mapped to a college — the pool a student's eligibility is measured against. */
    public function activeMappingsFor(int $collegeId): Collection
    {
        return DriveCollegeMapping::with('placementDrive')
            ->where('college_id', $collegeId)
            ->where('is_active', true)
            ->whereHas('placementDrive', function ($query) {
                $query->where('status', PlacementDrive::STATUS_PUBLISHED);
            })
            ->get();
    }

    /** One student's row — same shape and same code path as payloads(), for the add / block responses. */
    public function payload(User $student, Collection $activeMappings): array
    {
        return $this->payloads(collect([$student]), $activeMappings)[0];
    }

    /**
     * A whole roster's rows, in the order given. Shared by every caller so a
     * cohort table's row shape can never drift between callers or between a
     * full load and a just-added/just-edited student.
     *
     * @param  Collection<int, User>  $students
     * @return array<int, array>
     */
    public function payloads(Collection $students, Collection $activeMappings): array
    {
        $students = $students->values();

        if ($students->isEmpty()) {
            return [];
        }

        $this->readiness->prime($students);

        $ids = $students->pluck('id')->all();

        // Students of a branch whose Core Prep is live: their practice is Core Prep as much as coding, so it counts as
        // activity, and their row carries a Core block. Empty for a roster with none, which then pays for nothing extra.
        $access = app(CoreAccess::class);
        $coreIds = $students->filter(fn (User $s) => $access->liveFamily($s->getAttributes()['discipline'] ?? null))->pluck('id')->all();

        // Students whose department has no coding practice (Commerce, Arts, Management …): "practice" for them is everything they do on the
        // platform, not code submissions they cannot make — otherwise the whole department would read as "never started".
        $broadIds = $students->filter(fn (User $s) => ! (DepartmentCapabilities::forUser($s)['coding_practice'] ?? true))->pluck('id')->all();

        $activity = $this->activityFor($ids, $coreIds, $broadIds);
        $coding = $this->languages->forStudents($students);
        $core = $this->coreFor($coreIds);

        // Who placed each block — one query, and none at all when nobody is blocked (the common case).
        $blockerIds = $students->filter(fn (User $s) => $s->is_blocked && $s->blocked_by !== null)->pluck('blocked_by')->unique()->values()->all();
        $blockerRoles = $blockerIds === [] ? [] : User::whereIn('id', $blockerIds)->pluck('role', 'id')->all();

        return $students
            ->map(fn (User $student) => $this->row($student, $activeMappings, $activity[$student->id] ?? $this->emptyActivity(), $coding[$student->id], $core[$student->id] ?? null, $blockerRoles))
            ->all();
    }

    /**
     * What a core-branch student's row says about Core Prep: how much they answered lately and where they are weakest.
     * Grouped queries over the whole set, never per student.
     *
     * @param  array<int, int>  $coreIds
     * @return array<int, array{answered_30d: int, weakest_subject: ?string, weakest_accuracy: ?int}>
     */
    private function coreFor(array $coreIds): array
    {
        if ($coreIds === []) {
            return [];
        }

        $stats = app(CoreMasteryService::class)->subjectStatsFor($coreIds);
        $names = CoreSubject::query()->pluck('name', 'id');
        $minAttempts = (int) config('core_prep.mastery.weak_min_attempts', 3);
        $out = [];

        foreach ($coreIds as $id) {
            $weakest = null;
            $weakestAccuracy = null;
            $answered = 0;

            foreach ($stats[$id] ?? [] as $subjectId => $s) {
                $answered += $s['attempts'];
                if ($s['attempts'] < $minAttempts) {
                    continue;
                }
                $accuracy = (int) round($s['correct'] / $s['attempts'] * 100);
                if ($weakestAccuracy === null || $accuracy < $weakestAccuracy) {
                    $weakestAccuracy = $accuracy;
                    $weakest = $names[$subjectId] ?? null;
                }
            }

            $out[$id] = ['answered_30d' => $answered, 'weakest_subject' => $weakest, 'weakest_accuracy' => $weakest === null ? null : $weakestAccuracy];
        }

        return $out;
    }

    /** @param  array{answered_30d: int, weakest_subject: ?string, weakest_accuracy: ?int}|null  $core */
    private function row(User $student, Collection $activeMappings, array $activity, array $coding, ?array $core = null, array $blockerRoles = []): array
    {
        // A plain "eligible for at least one active drive" boolean goes
        // silently misleading the moment any one mapped drive has no real
        // requirements (open to all branches, no CGPA floor, no backlog cap)
        // — that single drive alone then marks every student "Eligible",
        // making an Eligible Only filter look broken even though it's doing
        // exactly what it's told. Surfacing the actual count (and the total
        // active drives it's out of) lets the cohort table show real
        // signal — "Eligible for 2 of 3 drives" — instead of a badge that
        // can't explain itself.
        $eligibleDriveCount = $activeMappings->filter(function (DriveCollegeMapping $mapping) use ($student) {
            return EligibilityService::evaluate($student, $mapping->effectiveEligibility())['status'] === 'eligible';
        })->count();

        $activated = ! $student->must_change_password;

        return [
            'id' => $student->id,
            'name' => $student->name,
            'email' => $student->email,
            'roll_number' => $student->roll_number,
            'branch' => $student->branch,
            // What the college's label resolved to (null = not recognised yet) — filters and
            // branch-wise reports run on these, 'branch' stays the college's own wording.
            'branch_code' => $student->branch_code,
            'discipline' => $student->discipline,
            'branch_source' => $student->branch_source,
            // The department the student belongs to (Engineering, Commerce …): null = not known yet, which the roster reads as engineering.
            'department' => $student->department,
            'track_focus' => $student->track_focus,
            'section' => $student->section,
            'phone' => $student->phone,
            'parent_phone' => $student->parent_phone,
            'cgpa' => $student->cgpa,
            'backlogs' => $student->backlogs,
            'is_blocked' => $student->is_blocked,
            // Why and by whom, so a TPO can see what a coordinator did: null while the account is active.
            'blocked' => $student->is_blocked ? [
                'reason' => $student->blocked_reason,
                'at' => $student->blocked_at?->toIso8601String(),
                'by_coordinator' => ($blockerRoles[$student->blocked_by] ?? null) === User::ROLE_SECTION_COORDINATOR,
            ] : null,
            'readiness_score' => $student->readinessScore(),
            'readiness_tier' => $student->readinessTier(),
            'practice_score' => $student->practiceScore(),
            'eligible_for_active_drive' => $activeMappings->isEmpty() ? null : $eligibleDriveCount > 0,
            'eligible_drive_count' => $eligibleDriveCount,
            'active_drive_count' => $activeMappings->count(),
            'created_at' => $student->created_at,
            'activated' => $activated,
            'onboarded' => $student->onboarding_completed_at !== null,
            'solved' => $activity['solved'],
            // Null for everyone whose branch has no live Core Prep — a CSE row is the row it has always been, plus this one null.
            'core' => $core === null ? null : $core + [
                'profile' => $student->readinessBreakdown()['profile'] ?? 'software',
                'readiness' => collect($student->readinessBreakdown()['components'])->firstWhere('key', 'core_technical')['score'] ?? null,
            ],
            'activity' => [
                'engagement' => $this->engagement($activated, $activity['last_practice_at']),
                'last_practice_at' => $activity['last_practice_at']?->toIso8601String(),
                'days_since_practice' => $activity['last_practice_at'] === null
                    ? null
                    : $this->daysSince($activity['last_practice_at']),
                'last_seen_at' => $student->last_seen_at?->toIso8601String(),
                'active_days_30' => $activity['active_days_30'],
            ],
            'coding' => [
                'primary_language' => $coding['actual_primary_language'],
                'stated_language' => $coding['stated']['primary_language'],
                'mismatch' => $coding['mismatch'],
                'languages' => array_map(fn (array $l) => [
                    'language' => $l['language'],
                    'attempts' => $l['attempts'],
                    'accepted' => $l['accepted'],
                    'solved' => $l['solved'],
                    'acceptance_rate' => $l['acceptance_rate'],
                    'proficiency' => $l['proficiency'],
                ], $coding['languages']),
                'needs_work' => array_values(array_unique(array_column(
                    array_filter($coding['improve'], fn (array $i) => $i['kind'] !== LanguageInsightsService::INSIGHT_PREFERRED_NOT_PRACTICED),
                    'language'
                ))),
            ],
        ];
    }

    /**
     * Where a student stands on practice, in one word. Judged on coding
     * practice (a Submit, practice or contest) because that is what a placement
     * cell is trying to move — someone who logs in daily but never solves
     * anything is not "active".
     */
    private function engagement(bool $activated, ?Carbon $lastPracticeAt): string
    {
        if (! $activated) {
            return self::ENGAGEMENT_PENDING_ACTIVATION;
        }

        if ($lastPracticeAt === null) {
            return self::ENGAGEMENT_NOT_STARTED;
        }

        $days = $this->daysSince($lastPracticeAt);

        return match (true) {
            $days <= self::ACTIVE_WITHIN_DAYS => self::ENGAGEMENT_ACTIVE,
            $days <= self::SLIPPING_WITHIN_DAYS => self::ENGAGEMENT_SLIPPING,
            default => self::ENGAGEMENT_DORMANT,
        };
    }

    /** Whole calendar days between that moment and today — never negative, even with a clock a little ahead of the database's. */
    private function daysSince(Carbon $moment): int
    {
        return max(0, (int) $moment->copy()->startOfDay()->diffInDays(now()->startOfDay()));
    }

    /** @return array{solved: array<string, int>, last_practice_at: ?Carbon, active_days_30: int} */
    private function emptyActivity(): array
    {
        return ['solved' => ['total' => 0, 'easy' => 0, 'medium' => 0, 'hard' => 0], 'last_practice_at' => null, 'active_days_30' => 0];
    }

    /**
     * Practice activity for a set of students in a few grouped queries: how
     * many distinct problems each has solved (by difficulty), when they last
     * submitted anything, and on how many of the last 30 days they practised.
     *
     * For students of a branch whose Core Prep is live (`$coreIds`), Core practice and Core tests count as practice too:
     * they move "last practice" and add active days. Everyone else is measured exactly as before.
     *
     * For students of a department without coding practice (`$broadIds`), "practice" is any learning activity — interviews, soft
     * skills, the Learning Centre labs, articles, Domain Prep — see broadActivityFor().
     *
     * @param  array<int, int>  $ids
     * @param  array<int, int>  $coreIds
     * @param  array<int, int>  $broadIds
     * @return array<int, array{solved: array<string, int>, last_practice_at: ?Carbon, active_days_30: int}>
     */
    private function activityFor(array $ids, array $coreIds = [], array $broadIds = []): array
    {
        $activity = [];
        $core = $coreIds === [] ? [] : array_flip($coreIds);
        $broad = $broadIds === [] ? [] : $this->broadActivityFor($broadIds);

        foreach (array_chunk($ids, self::ID_CHUNK) as $chunk) {
            $solved = DB::table('submissions')
                ->join('problems', 'problems.id', '=', 'submissions.problem_id')
                ->whereIn('submissions.user_id', $chunk)
                ->where('submissions.status', Submission::STATUS_ACCEPTED)
                ->select('submissions.user_id', 'problems.difficulty')
                ->selectRaw('COUNT(DISTINCT submissions.problem_id) as solved_count')
                ->groupBy('submissions.user_id', 'problems.difficulty')
                ->get()
                ->groupBy('user_id');

            $lastPractice = DB::table('submissions')
                ->whereIn('user_id', $chunk)
                ->select('user_id')
                ->selectRaw('MAX(updated_at) as last_at')
                ->groupBy('user_id')
                ->pluck('last_at', 'user_id');

            $lastContest = DB::table('contest_submissions')
                ->whereIn('user_id', $chunk)
                ->select('user_id')
                ->selectRaw('MAX(submitted_at) as last_at')
                ->groupBy('user_id')
                ->pluck('last_at', 'user_id');

            $activeDays = DB::table('submissions')
                ->whereIn('user_id', $chunk)
                ->where('submitted_on', '>=', now()->subDays(29)->toDateString())
                ->select('user_id')
                ->selectRaw('COUNT(DISTINCT submitted_on) as active_days')
                ->groupBy('user_id')
                ->pluck('active_days', 'user_id');

            // Only for the core students in this chunk: their latest Core activity, and the distinct days they did anything
            // (coding or Core) in the last 30.
            $chunkCore = array_values(array_filter($chunk, fn ($id) => isset($core[$id])));
            $lastCore = collect();
            $coreDays = collect();
            if ($chunkCore !== []) {
                $sinceDay = now()->subDays(29)->startOfDay();

                $lastCore = DB::query()->fromSub(
                    DB::table('core_practice_answers')->select('user_id')->selectRaw('MAX(created_at) as last_at')->whereIn('user_id', $chunkCore)->groupBy('user_id')
                        ->unionAll(DB::table('core_test_sessions')->select('user_id')->selectRaw('MAX(COALESCE(completed_at, started_at)) as last_at')->whereIn('user_id', $chunkCore)->groupBy('user_id')),
                    'c'
                )->select('user_id')->selectRaw('MAX(last_at) as last_at')->groupBy('user_id')->pluck('last_at', 'user_id');

                $days = DB::table('submissions')->select('user_id')->selectRaw('DATE(submitted_on) as d')->whereIn('user_id', $chunkCore)->where('submitted_on', '>=', $sinceDay->toDateString())
                    ->unionAll(DB::table('core_practice_answers')->select('user_id')->selectRaw('DATE(created_at) as d')->whereIn('user_id', $chunkCore)->where('created_at', '>=', $sinceDay->toDateTimeString()))
                    ->unionAll(DB::table('core_test_sessions')->select('user_id')->selectRaw('DATE(COALESCE(completed_at, started_at)) as d')->whereIn('user_id', $chunkCore)->whereRaw('COALESCE(completed_at, started_at) >= ?', [$sinceDay->toDateTimeString()]));

                $coreDays = DB::query()->fromSub($days, 'dd')->select('user_id')->selectRaw('COUNT(DISTINCT d) as days')->groupBy('user_id')->pluck('days', 'user_id');
            }

            foreach ($chunk as $id) {
                $byDifficulty = ($solved->get($id) ?? collect())->pluck('solved_count', 'difficulty');
                $easy = (int) ($byDifficulty['easy'] ?? 0);
                $medium = (int) ($byDifficulty['medium'] ?? 0);
                $hard = (int) ($byDifficulty['hard'] ?? 0);

                $times = array_filter([$lastPractice[$id] ?? null, $lastContest[$id] ?? null, $lastCore[$id] ?? null]);
                $last = $times === [] ? null : Carbon::parse(max($times));

                $activity[$id] = [
                    'solved' => ['total' => $easy + $medium + $hard, 'easy' => $easy, 'medium' => $medium, 'hard' => $hard],
                    'last_practice_at' => $last,
                    'active_days_30' => (int) ($coreDays[$id] ?? $activeDays[$id] ?? 0),
                ];

                if (isset($broad[$id])) {
                    $later = array_filter([$last, $broad[$id]['last']]);
                    $activity[$id]['last_practice_at'] = $later === [] ? null : max($later);
                    $activity[$id]['active_days_30'] = max($activity[$id]['active_days_30'], $broad[$id]['days']);
                }
            }
        }

        return $activity;
    }

    /**
     * For students who cannot practise code: when they last did anything on the platform, and on how many of the last 30 days.
     * The same modules the readiness score counts as activity (interviews, soft skills, Speaking / Listening / Vocabulary,
     * articles) plus Domain Prep practice and tests — one grouped union for the whole set, never a query per student.
     *
     * @param  array<int, int>  $ids
     * @return array<int, array{last: ?Carbon, days: int}>
     */
    private function broadActivityFor(array $ids): array
    {
        $since = now()->subDays(29)->startOfDay()->toDateTimeString();
        $out = [];

        foreach (array_chunk($ids, self::ID_CHUNK) as $chunk) {
            // A fresh union per query (a query builder is mutated by unionAll).
            $union = fn () => collect([
                DB::table('interview_sessions')->select('user_id')->selectRaw('COALESCE(completed_at, started_at, created_at) as at')->whereIn('user_id', $chunk),
                DB::table('soft_skill_sessions')->select('user_id')->selectRaw('COALESCE(completed_at, started_at, created_at) as at')->whereIn('user_id', $chunk),
                DB::table('speaking_attempts')->select('user_id')->selectRaw('created_at as at')->whereIn('user_id', $chunk),
                DB::table('listening_attempts')->select('user_id')->selectRaw('created_at as at')->whereIn('user_id', $chunk),
                DB::table('vocabulary_answers')->select('user_id')->selectRaw('created_at as at')->whereIn('user_id', $chunk),
                DB::table('article_reads')->select('user_id')->selectRaw('read_at as at')->whereIn('user_id', $chunk),
                DB::table('core_practice_answers')->select('user_id')->selectRaw('created_at as at')->whereIn('user_id', $chunk),
                DB::table('core_test_sessions')->select('user_id')->selectRaw('COALESCE(completed_at, started_at, created_at) as at')->whereIn('user_id', $chunk),
            ])->reduce(fn ($carry, $select) => $carry === null ? $select : $carry->unionAll($select));

            $last = DB::query()->fromSub($union(), 'a')->whereNotNull('at')->select('user_id')->selectRaw('MAX(at) as last_at')->groupBy('user_id')->pluck('last_at', 'user_id');

            $days = DB::query()->fromSub($union(), 'a')->where('at', '>=', $since)->select('user_id')->selectRaw('COUNT(DISTINCT DATE(at)) as days')->groupBy('user_id')->pluck('days', 'user_id');

            foreach ($last as $userId => $at) {
                $out[(int) $userId] = ['last' => Carbon::parse($at), 'days' => (int) ($days[$userId] ?? 0)];
            }
        }

        return $out;
    }
}
