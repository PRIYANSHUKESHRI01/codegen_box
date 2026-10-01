<?php

namespace App\Services;

use App\Models\Problem;
use App\Models\Submission;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Every number here is a real query against `submissions`/`problems` — the
 * replacement for STUDENT_PROFILE/studentAnalytics.ts's hardcoded mock
 * dashboard data. Deliberately does NOT fabricate anything this data can't
 * honestly support: no "trend" arrow on topic mastery (no historical
 * baseline exists), no 4-way readiness sub-breakdown beyond the one real
 * overall score (3 of the 4 sub-scores have no instrumentation anywhere in
 * this schema).
 */
class StudentStatsService
{
    /** Difficulty-weighted score used for the leaderboard/badge before a student has ever entered a rated contest. */
    private const DIFFICULTY_POINTS = ['easy' => 10, 'medium' => 25, 'hard' => 50];

    /** A configured goal, not a claimed fact about the user — legitimate to be a fixed default. */
    private const WEEKLY_SOLVED_TARGET = 20;

    private const WEEKLY_HARD_TARGET = 5;

    public function solvedByDifficulty(User $user): array
    {
        $solvedByDifficulty = DB::table('submissions')
            ->join('problems', 'problems.id', '=', 'submissions.problem_id')
            ->where('submissions.user_id', $user->id)
            ->where('submissions.status', Submission::STATUS_ACCEPTED)
            ->select('problems.difficulty')
            ->selectRaw('COUNT(DISTINCT submissions.problem_id) as count')
            ->groupBy('problems.difficulty')
            ->get()
            ->mapWithKeys(fn ($row) => [$row->difficulty => (int) $row->count]);

        $catalogTotals = Problem::select('difficulty')
            ->get()
            ->groupBy('difficulty')
            ->map->count();

        $shape = fn (string $difficulty) => [
            'solved' => $solvedByDifficulty[$difficulty] ?? 0,
            'total' => $catalogTotals[$difficulty] ?? 0,
        ];

        return [
            'total_solved' => array_sum($solvedByDifficulty->toArray()),
            'easy' => $shape('easy'),
            'medium' => $shape('medium'),
            'hard' => $shape('hard'),
        ];
    }

    /**
     * Difficulty-weighted score from real distinct-solved counts — feeds
     * the leaderboard/badge for any student who hasn't entered a rated
     * contest yet (see User::displayRating()).
     */
    public function solvedScore(User $user): int
    {
        $solved = $this->solvedByDifficulty($user);

        return $solved['easy']['solved'] * self::DIFFICULTY_POINTS['easy']
            + $solved['medium']['solved'] * self::DIFFICULTY_POINTS['medium']
            + $solved['hard']['solved'] * self::DIFFICULTY_POINTS['hard'];
    }

    /**
     * Current streak only counts if the most recent accepted day is today
     * or yesterday — otherwise it's broken, not "paused." Max streak is the
     * longest run ever, independent of whether it's still active.
     */
    public function streak(User $user): array
    {
        $dates = Submission::where('user_id', $user->id)
            ->where('status', Submission::STATUS_ACCEPTED)
            ->select('submitted_on')
            ->distinct()
            ->orderBy('submitted_on')
            ->pluck('submitted_on')
            ->map(fn ($d) => $d->toDateString())
            ->all();

        $max = 0;
        $run = 0;
        $prev = null;

        foreach ($dates as $date) {
            $run = ($prev !== null && Carbon::parse($prev)->addDay()->toDateString() === $date) ? $run + 1 : 1;
            $max = max($max, $run);
            $prev = $date;
        }

        $today = now()->toDateString();
        $yesterday = now()->subDay()->toDateString();
        $current = ($prev === $today || $prev === $yesterday) ? $run : 0;

        return ['current' => $current, 'max' => $max];
    }

    public function verdictBreakdown(User $user): array
    {
        return Submission::where('user_id', $user->id)
            ->select('status')
            ->selectRaw('count(*) as count')
            ->groupBy('status')
            ->get()
            ->map(fn ($row) => ['status' => $row->status, 'count' => (int) $row->count])
            ->all();
    }

    public function languageUsage(User $user): array
    {
        return Submission::where('user_id', $user->id)
            ->select('language')
            ->selectRaw('count(*) as count')
            ->groupBy('language')
            ->orderByDesc('count')
            ->get()
            ->map(fn ($row) => ['language' => $row->language, 'count' => (int) $row->count])
            ->all();
    }

    /**
     * No fake trend arrow — there's no historical snapshot to compare
     * against, so it's simply omitted rather than invented. `accuracy` is an
     * honest approximation given this schema's limits: submissions is
     * latest-status-per-day, not a full attempt log, so this is "% of a
     * tag's submission-days that were accepted," not true per-attempt accuracy.
     */
    public function topicMastery(User $user): array
    {
        $problems = Problem::all(['id', 'tags']);
        $tagsByProblem = $problems->mapWithKeys(fn (Problem $p) => [$p->id => $p->tags ?? []]);

        $tagTotals = [];
        foreach ($problems as $problem) {
            foreach ($problem->tags ?? [] as $tag) {
                $tagTotals[$tag] = ($tagTotals[$tag] ?? 0) + 1;
            }
        }

        $submissions = Submission::where('user_id', $user->id)->get(['problem_id', 'status']);
        $tagAttempts = [];
        $tagAccepted = [];
        $tagSolvedIds = [];

        foreach ($submissions as $submission) {
            foreach ($tagsByProblem[$submission->problem_id] ?? [] as $tag) {
                $tagAttempts[$tag] = ($tagAttempts[$tag] ?? 0) + 1;
                if ($submission->status === Submission::STATUS_ACCEPTED) {
                    $tagAccepted[$tag] = ($tagAccepted[$tag] ?? 0) + 1;
                    $tagSolvedIds[$tag][$submission->problem_id] = true;
                }
            }
        }

        $result = [];
        foreach ($tagTotals as $tag => $total) {
            $attempts = $tagAttempts[$tag] ?? 0;
            $result[] = [
                'topic' => $tag,
                'solved' => isset($tagSolvedIds[$tag]) ? count($tagSolvedIds[$tag]) : 0,
                'total' => $total,
                'accuracy' => $attempts > 0 ? (int) round((($tagAccepted[$tag] ?? 0) / $attempts) * 100) : 0,
            ];
        }

        return $result;
    }

    public function recentSubmissions(User $user, int $limit = 15): array
    {
        return Submission::where('user_id', $user->id)
            ->with('problem:id,slug,title,difficulty')
            ->orderByDesc('updated_at')
            ->limit($limit)
            ->get()
            ->map(fn (Submission $s) => [
                // Lets a caller with permission to see this student's code
                // (StudentReportController and friends) fetch it by id via
                // GET .../submissions/{submission} — `code` itself stays out
                // of this listing (see Submission::$hidden) since this can
                // return up to 30 rows at once.
                'id' => $s->id,
                'problem_title' => $s->problem->title,
                'problem_slug' => $s->problem->slug,
                'difficulty' => $s->problem->difficulty,
                'language' => $s->language,
                'status' => $s->status,
                'runtime_ms' => $s->runtime_ms,
                'memory_kb' => $s->memory_kb,
                'submitted_at' => $s->updated_at,
            ])
            ->all();
    }

    public function activityHeatmap(User $user, int $days = 365): array
    {
        $counts = Submission::where('user_id', $user->id)
            ->where('submitted_on', '>=', now()->subDays($days)->toDateString())
            ->select('submitted_on')
            ->selectRaw('count(*) as count')
            ->groupBy('submitted_on')
            ->get()
            ->keyBy(fn ($row) => $row->submitted_on->toDateString());

        return $counts->map(fn ($row, $date) => [
            'date' => $date,
            'count' => (int) $row->count,
            'level' => $this->heatLevel((int) $row->count),
        ])->values()->all();
    }

    public function weeklyGoalsProgress(User $user): array
    {
        $weekStart = now()->startOfWeek()->toDateString();

        $solvedThisWeek = DB::table('submissions')
            ->join('problems', 'problems.id', '=', 'submissions.problem_id')
            ->where('submissions.user_id', $user->id)
            ->where('submissions.status', Submission::STATUS_ACCEPTED)
            ->where('submissions.submitted_on', '>=', $weekStart)
            ->select('problems.id', 'problems.difficulty')
            ->distinct()
            ->get();

        return [
            'solved_this_week' => ['current' => $solvedThisWeek->count(), 'target' => self::WEEKLY_SOLVED_TARGET],
            'hard_solved_this_week' => [
                'current' => $solvedThisWeek->where('difficulty', 'hard')->count(),
                'target' => self::WEEKLY_HARD_TARGET,
            ],
        ];
    }

    private function heatLevel(int $count): int
    {
        return match (true) {
            $count === 0 => 0,
            $count <= 2 => 1,
            $count <= 4 => 2,
            $count <= 7 => 3,
            default => 4,
        };
    }
}
