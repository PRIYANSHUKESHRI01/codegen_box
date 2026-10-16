<?php

namespace App\Services;

use App\Models\DriveCollegeMapping;
use App\Models\PlacementDrive;
use App\Models\Submission;
use App\Models\User;
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
        $activity = $this->activityFor($ids);
        $coding = $this->languages->forStudents($students);

        return $students
            ->map(fn (User $student) => $this->row($student, $activeMappings, $activity[$student->id] ?? $this->emptyActivity(), $coding[$student->id]))
            ->all();
    }

    private function row(User $student, Collection $activeMappings, array $activity, array $coding): array
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
            'section' => $student->section,
            'phone' => $student->phone,
            'parent_phone' => $student->parent_phone,
            'cgpa' => $student->cgpa,
            'backlogs' => $student->backlogs,
            'is_blocked' => $student->is_blocked,
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
     * @param  array<int, int>  $ids
     * @return array<int, array{solved: array<string, int>, last_practice_at: ?Carbon, active_days_30: int}>
     */
    private function activityFor(array $ids): array
    {
        $activity = [];

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

            foreach ($chunk as $id) {
                $byDifficulty = ($solved->get($id) ?? collect())->pluck('solved_count', 'difficulty');
                $easy = (int) ($byDifficulty['easy'] ?? 0);
                $medium = (int) ($byDifficulty['medium'] ?? 0);
                $hard = (int) ($byDifficulty['hard'] ?? 0);

                $times = array_filter([$lastPractice[$id] ?? null, $lastContest[$id] ?? null]);
                $last = $times === [] ? null : Carbon::parse(max($times));

                $activity[$id] = [
                    'solved' => ['total' => $easy + $medium + $hard, 'easy' => $easy, 'medium' => $medium, 'hard' => $hard],
                    'last_practice_at' => $last,
                    'active_days_30' => (int) ($activeDays[$id] ?? 0),
                ];
            }
        }

        return $activity;
    }
}
