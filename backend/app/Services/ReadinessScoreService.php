<?php

namespace App\Services;

use App\Models\Contest;
use App\Models\Hackathon;
use App\Models\Interview;
use App\Models\Problem;
use App\Models\SoftSkillAssessment;
use App\Models\Submission;
use App\Models\User;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use LogicException;

/**
 * Readiness Score v3 — one number, the same rules, for every student on AptRun.
 *
 * Earlier versions blended CGPA, a practice streak and a handful of signals,
 * and ignored most of the platform (Learning Centre, soft skills, hackathons,
 * Project Lab, every contest that was not rated). A college student also had an
 * academic component an independent student could never earn, so "the same
 * score" meant two different things. v3 measures only what a student does on
 * AptRun and counts all of it:
 *
 *   AI interviews 20 · Coding practice 15 · Learning Centre 15 · Soft skills 10
 *   · Contests 15 · Participation 10 · Consistency 15        (config/readiness.php)
 *
 * Everything a student takes part in that someone scheduled for them —
 * Mellow, the platform, or their TPO — counts. Whatever a hiring partner posted
 * (their own hiring contests, interviews, tests and hackathons) never does; that
 * rule lives once, in each model's `countsTowardReadiness` scope, and this class
 * reaches those tables only through them.
 *
 * ONE code path. scoring a student is scoring a roster of one: breakdown() and
 * prime() both call compute(), which reads every input for a whole chunk of
 * students in a fixed handful of queries. There is no separate "single student"
 * implementation to drift from the bulk one. Any new input must be added to
 * compute() in bulk, never fetched per student.
 *
 * A component with no underlying data scores 0 rather than being renormalised
 * away — an honest "not yet shown", paired with a next step.
 */
class ReadinessScoreService
{
    /**
     * @return array{score: int, tier: string, components: array, next_steps: array<int, string>, vault: array{threshold: int, qualifies: bool, points_needed: int}}
     */
    public function breakdown(User $user): array
    {
        return $this->compute([$user])[$user->id]['breakdown'];
    }

    /**
     * Scores a whole set of students in a handful of queries and seeds each
     * User's own readiness caches (see User::primeReadiness()), so a caller
     * looping over a cohort — the TPO roster, the placement reports, the weekly
     * at-risk email — reads `readinessScore()` for free instead of paying a
     * dozen queries per student.
     *
     * @param  iterable<int, User>  $students
     */
    public function prime(iterable $students): void
    {
        $byId = collect($students)->filter(fn ($s) => $s instanceof User && $s->exists)->keyBy('id');

        foreach ($this->compute($byId->values()) as $userId => $result) {
            $byId[$userId]->primeReadiness($result['breakdown'], $result['practice_score']);
        }
    }

    /**
     * The one scoring routine.
     *
     * @param  iterable<int, User>  $students
     * @return array<int, array{breakdown: array, practice_score: int}> keyed by student id
     */
    public function compute(iterable $students): array
    {
        $students = collect($students)->filter(fn ($s) => $s instanceof User && $s->exists)->values();

        if ($students->isEmpty()) {
            return [];
        }

        $weights = $this->weights();
        $catalog = $this->catalog();
        $results = [];

        // Chunked so a 5,000-student college never holds every student's rows in memory at once.
        foreach ($students->chunk((int) config('readiness.chunk', 250)) as $chunk) {
            $ids = $chunk->pluck('id')->all();

            $inputs = [
                'interviews' => $this->recentInterviewScores($ids),
                'soft_skills' => $this->recentSoftSkillScores($ids),
                'speaking' => $this->recentLearningScores($ids, 'speaking_attempts', 'overall_score', 'created_at', fn (QueryBuilder $q) => $q->whereNotNull('scored_at')),
                'listening' => $this->recentLearningScores($ids, 'listening_attempts', 'score', 'created_at'),
                'vocabulary' => $this->recentLearningScores($ids, 'vocabulary_attempts', 'score', 'submitted_at', fn (QueryBuilder $q) => $q->whereNotNull('submitted_at')),
                'contests' => $this->recentContestResults($ids),
                'solved' => $this->solvedProfilesFor($ids, $catalog),
                'participation' => $this->participationFor($ids),
                'active_days' => $this->activeDaysFor($ids),
            ];
            $practiceScores = $this->practiceScoresFor($ids);

            foreach ($chunk as $student) {
                $results[$student->id] = [
                    'breakdown' => $this->assemble($student, $weights, $catalog, $inputs),
                    'practice_score' => $practiceScores[$student->id] ?? 0,
                ];
            }
        }

        return $results;
    }

    /**
     * @param  array<string, int>  $weights
     * @param  array<string, mixed>  $inputs
     */
    private function assemble(User $user, array $weights, array $catalog, array $inputs): array
    {
        $id = $user->id;
        $none = collect();

        $learning = $this->learningComponent(
            $inputs['speaking'][$id] ?? $none,
            $inputs['listening'][$id] ?? $none,
            $inputs['vocabulary'][$id] ?? $none,
            $weights['learning_centre'],
        );

        $components = [
            $this->interviewComponent($inputs['interviews'][$id] ?? $none, $weights['ai_interview']),
            $this->codingComponent($inputs['solved'][$id] ?? ['easy' => 0, 'medium' => 0, 'hard' => 0, 'tags' => 0], $catalog, $weights['coding_practice']),
            $learning['component'],
            $this->softSkillsComponent($inputs['soft_skills'][$id] ?? $none, $weights['soft_skills']),
            $this->contestComponent($user, $inputs['contests'][$id] ?? $none, $weights['contests']),
            $this->participationComponent($inputs['participation'][$id] ?? [], $weights['participation']),
            $this->consistencyComponent($inputs['active_days'][$id] ?? 0, $weights['consistency']),
        ];

        $score = (int) round(array_sum(array_column($components, 'contribution')));
        $threshold = (int) config('vault.enter_score', 60);

        return [
            'score' => $score,
            'tier' => $this->tierFor($score),
            'components' => $components,
            'next_steps' => $this->nextSteps($components, $learning['missing']),
            'vault' => [
                'threshold' => $threshold,
                'qualifies' => $score >= $threshold,
                'points_needed' => max(0, $threshold - $score),
            ],
        ];
    }

    // ───────────────────────────── configuration ─────────────────────────────

    /**
     * @return array<string, int>
     *
     * @throws LogicException a score above 100 is always a bug, so a bad edit to the config fails loudly, once, here
     */
    private function weights(): array
    {
        $weights = (array) config('readiness.weights');

        if (array_sum($weights) !== 100) {
            throw new LogicException('config/readiness.php: component weights must add up to 100, they add up to '.array_sum($weights).'.');
        }

        return $weights;
    }

    private function recentSince(): string
    {
        return now()->subDays((int) config('readiness.recent_days', 180))->toDateTimeString();
    }

    // ───────────────────────────── reading the platform ─────────────────────────────

    /**
     * The problem catalogue, read once per compute() call: how many problems each
     * difficulty has, and which tags (topics) each problem carries.
     *
     * @return array{totals: array<string, int>, difficulty: array<int, string>, tags: array<int, array<int, string>>, tag_count: int}
     */
    private function catalog(): array
    {
        $problems = Problem::all(['id', 'difficulty', 'tags']);

        return [
            'totals' => $problems->groupBy('difficulty')->map->count()->all(),
            'difficulty' => $problems->pluck('difficulty', 'id')->all(),
            'tags' => $problems->mapWithKeys(fn (Problem $p) => [$p->id => $p->tags ?? []])->all(),
            'tag_count' => $problems->flatMap(fn (Problem $p) => $p->tags ?? [])->unique()->count(),
        ];
    }

    /**
     * For each student, their newest `recent_attempts` rows (within the recent
     * window) from a query — one query for the whole chunk, using a window
     * function so no student's rows are ever loaded past the limit.
     *
     * @param  array<string, string>  $columns  alias => SQL expression to select
     * @return array<int, Collection<int, object>> keyed by student id, newest first
     */
    private function newestPerStudent(QueryBuilder $source, string $userColumn, string $orderExpression, string $tieColumn, array $columns): array
    {
        foreach ($columns as $alias => $expression) {
            $source->selectRaw("{$expression} as {$alias}");
        }

        $source->selectRaw("{$userColumn} as uid")
            ->selectRaw("ROW_NUMBER() OVER (PARTITION BY {$userColumn} ORDER BY {$orderExpression} DESC, {$tieColumn} DESC) as rn");

        return DB::query()
            ->fromSub($source, 'ranked')
            ->where('rn', '<=', (int) config('readiness.recent_attempts', 5))
            ->orderBy('uid')
            ->orderBy('rn')
            ->get()
            ->groupBy('uid')
            ->all();
    }

    /** @return array<int, Collection<int, float>> scores, newest first */
    private function recentInterviewScores(array $ids): array
    {
        $source = DB::table('interview_sessions')
            ->whereIn('user_id', $ids)
            ->whereNotNull('composite_score_percent')
            ->whereRaw('COALESCE(completed_at, created_at) >= ?', [$this->recentSince()])
            ->whereIn('interview_id', Interview::query()->countsTowardReadiness()->select('interviews.id'));

        return $this->scores($this->newestPerStudent($source, 'user_id', 'COALESCE(completed_at, created_at)', 'id', ['score' => 'composite_score_percent']));
    }

    /** @return array<int, Collection<int, float>> */
    private function recentSoftSkillScores(array $ids): array
    {
        $source = DB::table('soft_skill_sessions')
            ->whereIn('user_id', $ids)
            ->where('status', 'completed')
            ->whereNotNull('score_percent')
            ->whereRaw('COALESCE(completed_at, created_at) >= ?', [$this->recentSince()])
            ->whereIn('soft_skill_assessment_id', SoftSkillAssessment::query()->countsTowardReadiness()->select('soft_skill_assessments.id'));

        return $this->scores($this->newestPerStudent($source, 'user_id', 'COALESCE(completed_at, created_at)', 'id', ['score' => 'score_percent']));
    }

    /**
     * One Learning Centre module's recent scores. Every module is a self-paced
     * exercise the platform puts in front of a student, so all of it counts.
     *
     * @return array<int, Collection<int, float>>
     */
    private function recentLearningScores(array $ids, string $table, string $scoreColumn, string $dateColumn, ?callable $narrow = null): array
    {
        $source = DB::table($table)
            ->whereIn('user_id', $ids)
            ->whereNotNull($scoreColumn)
            ->where($dateColumn, '>=', $this->recentSince());

        if ($narrow !== null) {
            $narrow($source);
        }

        return $this->scores($this->newestPerStudent($source, 'user_id', $dateColumn, 'id', ['score' => $scoreColumn]));
    }

    /**
     * Each finished contest the student actually took part in (ranked ⇒ they
     * submitted), as the share of that contest's total points they scored.
     *
     * @return array<int, Collection<int, float>> percent of points scored, newest contest first
     */
    private function recentContestResults(array $ids): array
    {
        $totals = DB::table('contest_problems')->select('contest_id')->selectRaw('SUM(points) as total_points')->groupBy('contest_id');

        $source = DB::table('contest_participants as cp')
            ->join('contests as c', 'c.id', '=', 'cp.contest_id')
            ->joinSub($totals, 't', 't.contest_id', '=', 'cp.contest_id')
            ->whereIn('cp.user_id', $ids)
            ->whereNotNull('cp.rank')
            ->whereNotNull('c.finalized_at')
            ->where('t.total_points', '>', 0)
            ->where('c.start_at', '>=', $this->recentSince())
            ->whereIn('cp.contest_id', Contest::query()->countsTowardReadiness()->select('contests.id'));

        $rows = $this->newestPerStudent($source, 'cp.user_id', 'c.start_at', 'cp.id', [
            'points' => 'cp.score',
            'total' => 't.total_points',
        ]);

        return array_map(
            fn (Collection $contests) => $contests->map(fn ($r) => min(100.0, max(0.0, (float) $r->points / (float) $r->total * 100)))->values(),
            $rows
        );
    }

    /**
     * Per student: distinct problems Accepted by difficulty, and how many
     * distinct topics those problems cover — what coding depth is built from.
     *
     * @return array<int, array{easy: int, medium: int, hard: int, tags: int}>
     */
    private function solvedProfilesFor(array $ids, array $catalog): array
    {
        $profiles = [];

        DB::table('submissions')
            ->whereIn('user_id', $ids)
            ->where('status', Submission::STATUS_ACCEPTED)
            ->select('user_id', 'problem_id')
            ->distinct()
            ->get()
            ->groupBy('user_id')
            ->each(function (Collection $rows, $userId) use (&$profiles, $catalog) {
                $byDifficulty = ['easy' => 0, 'medium' => 0, 'hard' => 0];
                $topics = [];

                foreach ($rows as $row) {
                    $difficulty = $catalog['difficulty'][$row->problem_id] ?? null;

                    if ($difficulty !== null && isset($byDifficulty[$difficulty])) {
                        $byDifficulty[$difficulty]++;
                    }

                    foreach ($catalog['tags'][$row->problem_id] ?? [] as $tag) {
                        $topics[$tag] = true;
                    }
                }

                $profiles[(int) $userId] = $byDifficulty + ['tags' => count($topics)];
            });

        return $profiles;
    }

    /**
     * The share of the last 7 calendar days (today inclusive) with at least 3
     * distinct problems Accepted — the "practice score" the TPO roster and the
     * weekly report show next to readiness. Same rule as User::practiceScore().
     *
     * @return array<int, int> keyed by student id
     */
    private function practiceScoresFor(array $ids): array
    {
        return DB::table('submissions')
            ->whereIn('user_id', $ids)
            ->where('status', Submission::STATUS_ACCEPTED)
            ->where('submitted_on', '>=', now()->subDays(6)->toDateString())
            ->select('user_id', 'submitted_on')
            ->groupBy('user_id', 'submitted_on')
            ->havingRaw('count(*) >= 3')
            ->get()
            ->countBy('user_id')
            ->map(fn (int $days) => (int) round(($days / 7) * 100))
            ->all();
    }

    /**
     * Everything a student showed up for in the participation window, one row per
     * distinct thing: a contest they submitted to, a hackathon they joined (and,
     * separately, one their team handed something in for), an interview or a soft
     * skills test they finished, a Project Lab project they submitted.
     *
     * @return array<int, array<string, int>> student id => [kind => distinct count]
     */
    private function participationFor(array $ids): array
    {
        $since = now()->subDays((int) config('readiness.participation_days', 90))->toDateTimeString();

        $contests = DB::table('contest_submissions')
            ->select('user_id')->selectRaw("'contest' as kind")->selectRaw('contest_id as ref')
            ->whereIn('user_id', $ids)
            ->where('submitted_at', '>=', $since)
            ->whereIn('contest_id', Contest::query()->countsTowardReadiness()->select('contests.id'))
            ->distinct();

        $hackathonsJoined = DB::table('hackathon_participants')
            ->select('user_id')->selectRaw("'hackathon_registered' as kind")->selectRaw('hackathon_id as ref')
            ->whereIn('user_id', $ids)
            ->where('registered_at', '>=', $since)
            ->whereIn('hackathon_id', Hackathon::query()->countsTowardReadiness()->select('hackathons.id'));

        $hackathonsSubmitted = DB::table('hackathon_participants as hp')
            ->join('hackathon_submissions as hs', 'hs.hackathon_team_id', '=', 'hp.hackathon_team_id')
            ->select('hp.user_id')->selectRaw("'hackathon_submitted' as kind")->selectRaw('hp.hackathon_id as ref')
            ->whereIn('hp.user_id', $ids)
            ->where('hs.status', 'submitted')
            ->where('hs.is_disqualified', false)
            ->where('hs.submitted_at', '>=', $since)
            ->whereIn('hp.hackathon_id', Hackathon::query()->countsTowardReadiness()->select('hackathons.id'));

        $interviews = DB::table('interview_sessions')
            ->select('user_id')->selectRaw("'interview' as kind")->selectRaw('interview_id as ref')
            ->whereIn('user_id', $ids)
            ->where('status', 'completed')
            ->whereRaw('COALESCE(completed_at, created_at) >= ?', [$since])
            ->whereIn('interview_id', Interview::query()->countsTowardReadiness()->select('interviews.id'));

        $softSkills = DB::table('soft_skill_sessions')
            ->select('user_id')->selectRaw("'soft_skill' as kind")->selectRaw('soft_skill_assessment_id as ref')
            ->whereIn('user_id', $ids)
            ->where('status', 'completed')
            ->whereRaw('COALESCE(completed_at, created_at) >= ?', [$since])
            ->whereIn('soft_skill_assessment_id', SoftSkillAssessment::query()->countsTowardReadiness()->select('soft_skill_assessments.id'));

        $projects = DB::table('project_submissions')
            ->select('user_id')->selectRaw("'project_submitted' as kind")->selectRaw('project_enrollment_id as ref')
            ->whereIn('user_id', $ids)
            ->where('submitted_at', '>=', $since);

        $union = $contests->unionAll($hackathonsJoined)->unionAll($hackathonsSubmitted)->unionAll($interviews)->unionAll($softSkills)->unionAll($projects);

        $participation = [];

        foreach (DB::query()->fromSub($union, 'p')->get() as $row) {
            $participation[(int) $row->user_id][$row->kind][$row->ref] = true;
        }

        return array_map(fn (array $kinds) => array_map('count', $kinds), $participation);
    }

    /**
     * How many distinct days, in the consistency window, each student did
     * anything at all on the platform. "Anything" is every module a student can
     * work in — practice, contests, interviews, soft skills, the three Learning
     * Centre labs, articles, Project Lab — minus whatever a hiring partner posted.
     *
     * @return array<int, int> keyed by student id
     */
    private function activeDaysFor(array $ids): array
    {
        $since = now()->subDays((int) config('readiness.consistency_days', 28));
        $sinceDate = $since->toDateString();
        $sinceTime = $since->startOfDay()->toDateTimeString();

        $selects = [
            DB::table('submissions')->select('user_id')->selectRaw('DATE(submitted_on) as d')
                ->whereIn('user_id', $ids)->where('submitted_on', '>=', $sinceDate),

            DB::table('contest_submissions')->select('user_id')->selectRaw('DATE(submitted_at) as d')
                ->whereIn('user_id', $ids)->where('submitted_at', '>=', $sinceTime)
                ->whereIn('contest_id', Contest::query()->countsTowardReadiness()->select('contests.id')),

            DB::table('interview_sessions')->select('user_id')->selectRaw('DATE(COALESCE(completed_at, started_at, created_at)) as d')
                ->whereIn('user_id', $ids)->whereRaw('COALESCE(completed_at, started_at, created_at) >= ?', [$sinceTime])
                ->whereIn('interview_id', Interview::query()->countsTowardReadiness()->select('interviews.id')),

            DB::table('soft_skill_sessions')->select('user_id')->selectRaw('DATE(COALESCE(completed_at, started_at, created_at)) as d')
                ->whereIn('user_id', $ids)->whereRaw('COALESCE(completed_at, started_at, created_at) >= ?', [$sinceTime])
                ->whereIn('soft_skill_assessment_id', SoftSkillAssessment::query()->countsTowardReadiness()->select('soft_skill_assessments.id')),

            DB::table('speaking_attempts')->select('user_id')->selectRaw('DATE(created_at) as d')
                ->whereIn('user_id', $ids)->where('created_at', '>=', $sinceTime),

            DB::table('listening_attempts')->select('user_id')->selectRaw('DATE(created_at) as d')
                ->whereIn('user_id', $ids)->where('created_at', '>=', $sinceTime),

            // Vocabulary Sprint records every answered question, so a day of word practice shows up even before a quiz is finished.
            DB::table('vocabulary_answers')->select('user_id')->selectRaw('DATE(created_at) as d')
                ->whereIn('user_id', $ids)->where('created_at', '>=', $sinceTime),

            DB::table('article_reads')->select('user_id')->selectRaw('DATE(read_at) as d')
                ->whereIn('user_id', $ids)->where('read_at', '>=', $sinceTime),

            DB::table('project_workspace_sessions')->select('user_id')->selectRaw('DATE(started_at) as d')
                ->whereIn('user_id', $ids)->where('started_at', '>=', $sinceTime),
        ];

        $union = array_shift($selects);
        foreach ($selects as $select) {
            $union->unionAll($select);
        }

        return DB::query()
            ->fromSub($union, 'a')
            ->select('user_id')
            ->selectRaw('COUNT(DISTINCT d) as days')
            ->groupBy('user_id')
            ->pluck('days', 'user_id')
            ->map(fn ($days) => (int) $days)
            ->all();
    }

    /**
     * @param  array<int, Collection<int, object>>  $rows
     * @return array<int, Collection<int, float>>
     */
    private function scores(array $rows): array
    {
        return array_map(fn (Collection $r) => $r->map(fn ($row) => (float) $row->score)->values(), $rows);
    }

    // ───────────────────────────── the components ─────────────────────────────

    /**
     * Quality over a handful of recent attempts, scaled by how many there are —
     * see config('readiness.full_credit_at'). One attempt earns half the credit,
     * so a single great result is a start rather than a finished component.
     */
    private function qualityScore(Collection $scores, int $fullCreditAt): int
    {
        if ($scores->isEmpty()) {
            return 0;
        }

        $depth = $fullCreditAt <= 1 ? 1.0 : 0.5 + 0.5 * min(1.0, ($scores->count() - 1) / ($fullCreditAt - 1));

        return (int) round((float) $scores->avg() * $depth);
    }

    private function fullCreditAt(string $component): int
    {
        return (int) config("readiness.full_credit_at.{$component}", 3);
    }

    private function interviewComponent(Collection $scores, int $weight): array
    {
        $needed = $this->fullCreditAt('ai_interview');
        $detail = $scores->isEmpty()
            ? 'No scored interview in the last '.config('readiness.recent_days').' days'
            : $this->plural($scores->count(), 'recent interview').' · average '.round((float) $scores->avg()).'%'
                .($scores->count() < $needed ? " · full credit at {$needed}" : '');

        return $this->component('interview_performance', 'AI Interviews', $this->qualityScore($scores, $needed), $weight, $detail);
    }

    /**
     * Catalogue-relative rather than a fixed point ceiling — self-calibrates as
     * the problem set grows, and weights Hard coverage above Easy so farming easy
     * problems alone can't max this out.
     *
     * @param  array{easy: int, medium: int, hard: int, tags: int}  $solved
     */
    private function codingComponent(array $solved, array $catalog, int $weight): array
    {
        $coverage = fn (string $difficulty) => ($catalog['totals'][$difficulty] ?? 0) > 0
            ? $solved[$difficulty] / $catalog['totals'][$difficulty]
            : 0.0;

        $volume = $coverage('easy') * 20 + $coverage('medium') * 40 + $coverage('hard') * 40;
        $breadth = $catalog['tag_count'] > 0 ? ($solved['tags'] / $catalog['tag_count']) * 100 : 0.0;
        $total = $solved['easy'] + $solved['medium'] + $solved['hard'];

        return $this->component(
            'practice_depth',
            'Coding Practice',
            (int) round(($volume + $breadth) / 2),
            $weight,
            $total === 0 ? 'No problems solved yet' : "{$total} solved · {$solved['hard']} hard · {$solved['tags']} topics",
        );
    }

    /**
     * @param  Collection<int, float>  $speaking
     * @param  Collection<int, float>  $listening
     * @param  Collection<int, float>  $vocabulary
     * @return array{component: array, missing: array<int, string>}
     */
    private function learningComponent(Collection $speaking, Collection $listening, Collection $vocabulary, int $weight): array
    {
        $needed = $this->fullCreditAt('learning_module');
        $shares = (array) config('readiness.learning_modules');
        $labels = ['speaking' => 'Speaking', 'listening' => 'Listening', 'vocabulary' => 'Vocabulary'];
        $byModule = ['speaking' => $speaking, 'listening' => $listening, 'vocabulary' => $vocabulary];

        $score = 0.0;
        $parts = [];
        $missing = [];

        foreach ($byModule as $module => $scores) {
            $moduleScore = $this->qualityScore($scores, $needed);
            $score += $moduleScore * ($shares[$module] ?? 0) / 100;
            $parts[] = $labels[$module].' '.($scores->isEmpty() ? '—' : "{$moduleScore}%");

            if ($scores->isEmpty()) {
                $missing[] = $module;
            }
        }

        return [
            'component' => $this->component('learning_centre', 'Learning Centre', (int) round($score), $weight, implode(' · ', $parts)),
            'missing' => $missing,
        ];
    }

    private function softSkillsComponent(Collection $scores, int $weight): array
    {
        $needed = $this->fullCreditAt('soft_skills');
        $detail = $scores->isEmpty()
            ? 'No soft-skills test taken yet'
            : $this->plural($scores->count(), 'recent test').' · average '.round((float) $scores->avg()).'%'
                .($scores->count() < $needed ? " · full credit at {$needed}" : '');

        return $this->component('soft_skills', 'Soft Skills', $this->qualityScore($scores, $needed), $weight, $detail);
    }

    /**
     * Scoring well in the contests that were scheduled for the student — the
     * daily contest, a TPO's mock contest, Mellow's — judged by the share of the
     * contest's points they scored. A rated student's contest rating is a floor
     * under this (the old formula's contest component), so a high rating is
     * never undersold by a few unlucky recent rounds.
     */
    private function contestComponent(User $user, Collection $percents, int $weight): array
    {
        $needed = $this->fullCreditAt('contests');
        $fromResults = $this->qualityScore($percents, $needed);

        $fromRating = 0;
        if ($user->rated_contests_count > 0) {
            $floor = (int) config('readiness.rating_floor', 1200);
            $ceiling = (int) config('readiness.rating_ceiling', 2200);
            $fromRating = (int) round(max(0.0, min(100.0, ($user->current_rating - $floor) / ($ceiling - $floor) * 100)));
        }

        if ($percents->isEmpty() && $fromRating === 0) {
            $detail = 'No contest scored yet';
        } else {
            $detail = $this->plural($percents->count(), 'recent contest').($percents->isEmpty() ? '' : ' · average '.round((float) $percents->avg()).'% of points')
                .($fromRating > 0 ? " · rating {$user->current_rating}" : '');
        }

        return $this->component('contests', 'Contests', max($fromResults, $fromRating), $weight, $detail);
    }

    /** @param  array<string, int>  $counts  kind => how many distinct things */
    private function participationComponent(array $counts, int $weight): array
    {
        $values = (array) config('readiness.participation_points');
        $target = max(1, (int) config('readiness.participation_target_points', 6));

        $points = 0;
        $things = 0;
        foreach ($counts as $kind => $count) {
            $points += ($values[$kind] ?? 0) * $count;
            // A hackathon a team submitted for is one event, not two.
            $things += $kind === 'hackathon_submitted' ? 0 : $count;
        }

        $days = (int) config('readiness.participation_days', 90);
        $detail = $things === 0
            ? "Nothing joined in the last {$days} days"
            : $this->plural($things, 'event or project')." in the last {$days} days · ".min($points, $target)." of {$target} points";

        return $this->component('participation', 'Events & Projects', (int) round(min(100.0, $points / $target * 100)), $weight, $detail);
    }

    private function consistencyComponent(int $activeDays, int $weight): array
    {
        $window = (int) config('readiness.consistency_days', 28);
        $target = max(1, (int) config('readiness.consistency_target_days', 12));

        return $this->component(
            'consistency',
            'Consistency',
            (int) round(min(100.0, $activeDays / $target * 100)),
            $weight,
            "Active on {$activeDays} of the last {$window} days".($activeDays < $target ? " · {$target} days is full marks" : ''),
        );
    }

    /** @return array{key: string, label: string, score: int, weight_percent: int, contribution: float, detail: string} */
    private function component(string $key, string $label, int $score, int $weight, string $detail): array
    {
        $clamped = max(0, min(100, $score));

        return [
            'key' => $key,
            'label' => $label,
            'score' => $clamped,
            'weight_percent' => $weight,
            'contribution' => round($clamped / 100 * $weight, 2),
            'detail' => $detail,
        ];
    }

    private function plural(int $n, string $noun): string
    {
        return $n === 1 ? "1 {$noun}" : "{$n} {$noun}s";
    }

    private function tierFor(int $score): string
    {
        return match (true) {
            $score >= (int) config('readiness.tiers.placement_ready', 75) => 'Placement Ready',
            $score >= (int) config('readiness.tiers.in_progress', 45) => 'In Progress',
            default => 'Needs Training',
        };
    }

    /**
     * Up to 3 nudges, ranked by weight × headroom — "which component, if
     * improved, would move the overall score the most" — the same prioritisation
     * credit-score apps use for "factors hurting your score most", rather than
     * listing every imperfect factor.
     *
     * @param  array<int, array{key: string, score: int, weight_percent: int}>  $components
     * @param  array<int, string>  $missingLearningModules
     * @return array<int, string>
     */
    private function nextSteps(array $components, array $missingLearningModules): array
    {
        $moduleNames = ['speaking' => 'Speaking Lab', 'listening' => 'Listening Lab', 'vocabulary' => 'Vocabulary Sprint'];

        $copy = [
            'interview_performance' => fn (array $c) => $c['score'] === 0
                ? "Take your first AI mock interview — it's the biggest single part of your readiness score."
                : 'Take another AI mock interview — your recent ones are worth '.$c['score'].'% and a few more builds a stronger record.',
            'practice_depth' => fn (array $c) => 'Solve problems across more topics and difficulties, especially Hard ones, to round out your coverage.',
            'learning_centre' => fn (array $c) => $missingLearningModules !== []
                ? 'Try the '.$moduleNames[$missingLearningModules[0]].' in the Learning Centre — you have no score there yet.'
                : 'Keep practising in the Learning Centre — your recent Speaking, Listening and Vocabulary scores still have room to grow.',
            'soft_skills' => fn (array $c) => $c['score'] === 0
                ? 'Take a Soft Skills assessment — aptitude, reasoning and English are screened in most placement drives.'
                : 'Take another Soft Skills assessment to strengthen your aptitude and reasoning record.',
            'contests' => fn (array $c) => $c['score'] === 0
                ? "Enter today's contest, or one your placement cell scheduled, and solve at least one problem."
                : 'Keep entering contests and solving more of each — your share of the points is what moves this.',
            'participation' => fn (array $c) => 'Take part in more of what is scheduled for you — contests, hackathons, interviews, tests and Project Lab projects all count.',
            'consistency' => fn (array $c) => 'Show up on more days. A little each day beats a long gap — '.$c['detail'].'.',
        ];

        $eligible = array_filter($components, fn (array $c) => isset($copy[$c['key']]) && $c['score'] < 100);

        usort($eligible, fn (array $a, array $b) => ($b['weight_percent'] * (100 - $b['score'])) <=> ($a['weight_percent'] * (100 - $a['score'])));

        return array_map(fn (array $c) => $copy[$c['key']]($c), array_slice($eligible, 0, 3));
    }
}
