<?php

namespace App\Services;

use App\Models\Contest;
use App\Models\CoreQuestion;
use App\Models\CoreTest;
use App\Models\Hackathon;
use App\Models\Interview;
use App\Models\Problem;
use App\Models\SoftSkillAssessment;
use App\Models\Submission;
use App\Models\User;
use App\Services\Core\CoreAccess;
use App\Services\Core\CoreMasteryService;
use App\Support\BranchCatalog;
use App\Support\DepartmentCapabilities;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
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
 *
 * v4 adds weighting PROFILES. A student of ECE, EEE, Mechanical or Civil whose branch's Core Prep is live, and who
 * chose to lead with it, is scored by the "core" (or "balanced") profile — technical test scores and syllabus
 * coverage in place of coding and contest points, which a non-coder can never earn. Everyone else is scored by the
 * unchanged software weights above; the golden test pins that a CSE student's breakdown is identical to v3's.
 * A student moved onto a core profile is scored by the better of the two for a grace period (config
 * readiness.core.grace_days), so going live never costs anyone their place.
 *
 * v5 adds the daily habit: the components add up to an EARNED score (`base_score`), and every complete day in the last
 * `decay.window_days` with no activity takes `decay.points_per_missed_day` off it. The penalty is a pure function of the
 * student's activity dates (the same ones Consistency counts) and of when they were first tracked — see decayFor() and
 * config/readiness.php. Recording that score day by day is ReadinessHistoryService's job, not this class's.
 */
class ReadinessScoreService
{
    /** @var array<string, true> profiles already reported as mis-configured */
    private array $reportedProfiles = [];

    private bool $reportedMissingSnapshots = false;

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
        $this->ensureBranchAttributes($students);
        $live = $this->liveCoreDisciplines($students);
        $mastery = app(CoreMasteryService::class);
        $results = [];

        // Chunked so a 5,000-student college never holds every student's rows in memory at once.
        foreach ($students->chunk((int) config('readiness.chunk', 250)) as $chunk) {
            $ids = $chunk->pluck('id')->all();

            // $coreIds: Core Prep is live for these students, so they CAN have core activity. $profiledIds: the ones scored
            // by a core profile. Both are empty for a roster with no live-branch student, which then runs exactly the
            // queries it always did.
            $coreIds = [];
            $profiles = [];
            foreach ($chunk as $student) {
                $discipline = $this->disciplineOf($student);
                if ($discipline !== null && isset($live[$discipline])) {
                    $coreIds[] = $student->id;
                }
                $profiles[$student->id] = $this->profileFor($student, $live);
            }
            // Only the core / balanced profiles read Core Prep results; `general` (no coding practice) and software never do.
            $profiledIds = array_keys(array_filter($profiles, fn (string $p) => in_array($p, ['core', 'balanced'], true)));

            $inputs = [
                'interviews' => $this->recentInterviewScores($ids),
                'soft_skills' => $this->recentSoftSkillScores($ids),
                'speaking' => $this->recentLearningScores($ids, 'speaking_attempts', 'overall_score', 'created_at', fn (QueryBuilder $q) => $q->whereNotNull('scored_at')),
                'listening' => $this->recentLearningScores($ids, 'listening_attempts', 'score', 'created_at'),
                'vocabulary' => $this->recentLearningScores($ids, 'vocabulary_attempts', 'score', 'submitted_at', fn (QueryBuilder $q) => $q->whereNotNull('submitted_at')),
                'contests' => $this->recentContestResults($ids),
                'solved' => $this->solvedProfilesFor($ids, $catalog),
                'participation' => $this->participationFor($ids, $coreIds),
                'active_dates' => $this->activeDatesFor($ids, $coreIds),
                'tracked_since' => $this->trackedSinceFor($ids),
                'core_tests' => $this->recentCoreTestScores($profiledIds),
                'core_mastered' => $mastery->masteredTopicCounts($profiledIds),
            ];
            $practiceScores = $this->practiceScoresFor($ids);

            foreach ($chunk as $student) {
                $discipline = $this->disciplineOf($student);

                $results[$student->id] = [
                    'breakdown' => $this->assemble($student, $weights, $catalog, $inputs, $profiles[$student->id], $discipline !== null ? ($live[$discipline] ?? null) : null),
                    'practice_score' => $practiceScores[$student->id] ?? 0,
                ];
            }
        }

        return $results;
    }

    /**
     * One student's breakdown. A student on a core profile during that branch's grace period is scored both ways, from
     * the same inputs, and keeps the better result — see config('readiness.core.grace_days').
     *
     * @param  array<string, int>  $weights  the software weights
     * @param  array<string, mixed>  $inputs
     * @param  array<string, mixed>|null  $live  this student's live branch family, if any
     */
    private function assemble(User $user, array $weights, array $catalog, array $inputs, string $profile, ?array $live): array
    {
        $chosen = $this->build($user, $profile, $this->profileWeights($profile, $weights), $catalog, $inputs, $live);

        if ($profile !== 'software' && $live !== null && $live['grace_until'] !== null && now()->lt($live['grace_until'])) {
            $software = $this->build($user, 'software', $weights, $catalog, $inputs, $live);

            if ($software['score'] > $chosen['score']) {
                $chosen = $software;
            }

            $chosen['grace_until'] = $live['grace_until']->toIso8601String();
        }

        return $chosen;
    }

    /**
     * @param  array<string, int>  $weights  the weights of the profile being built (a key absent here is a component that profile does not have)
     * @param  array<string, mixed>  $inputs
     * @param  array<string, mixed>|null  $live
     */
    private function build(User $user, string $profile, array $weights, array $catalog, array $inputs, ?array $live): array
    {
        $id = $user->id;
        $none = collect();
        $missingModules = [];

        // In the order a software student has always seen them; core_technical sits second, where a profile that has it needs it.
        $make = [
            'ai_interview' => fn (int $w) => $this->interviewComponent($inputs['interviews'][$id] ?? $none, $w),
            'core_technical' => fn (int $w) => $this->coreTechnicalComponent($inputs['core_tests'][$id] ?? $none, (int) ($inputs['core_mastered'][$id] ?? 0), $live, $w),
            'coding_practice' => fn (int $w) => $this->codingComponent($inputs['solved'][$id] ?? ['easy' => 0, 'medium' => 0, 'hard' => 0, 'tags' => 0], $catalog, $w),
            'learning_centre' => function (int $w) use ($inputs, $id, $none, &$missingModules) {
                $learning = $this->learningComponent($inputs['speaking'][$id] ?? $none, $inputs['listening'][$id] ?? $none, $inputs['vocabulary'][$id] ?? $none, $w);
                $missingModules = $learning['missing'];

                return $learning['component'];
            },
            'soft_skills' => fn (int $w) => $this->softSkillsComponent($inputs['soft_skills'][$id] ?? $none, $w),
            'contests' => fn (int $w) => $this->contestComponent($user, $inputs['contests'][$id] ?? $none, $w),
            'participation' => fn (int $w) => $this->participationComponent($inputs['participation'][$id] ?? [], $w),
            'consistency' => fn (int $w) => $this->consistencyComponent($this->activeDaysIn($inputs['active_dates'][$id] ?? []), $w),
        ];

        $components = [];
        foreach ($make as $key => $component) {
            if (array_key_exists($key, $weights)) {
                $components[] = $component((int) $weights[$key]);
            }
        }

        // What the components add up to, then what staying away costs: the score is the difference, never below 0.
        $base = (int) round(array_sum(array_column($components, 'contribution')));
        $decay = $this->decayFor($inputs['active_dates'][$id] ?? [], $inputs['tracked_since'][$id] ?? null, $base);
        $score = max(0, $base - $decay['points']);
        $threshold = (int) config('vault.enter_score', 60);

        return [
            'score' => $score,
            'base_score' => $base,
            'tier' => $this->tierFor($score),
            'profile' => $profile,
            'components' => $components,
            'decay' => $decay,
            'next_steps' => $this->nextSteps($components, $missingModules, $decay),
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

    /**
     * The weights of a non-software profile, or the software ones if that profile is missing or mis-edited (logged, not
     * thrown: a typo in an optional profile must not stop every roster loading).
     *
     * @param  array<string, int>  $software
     * @return array<string, int>
     */
    private function profileWeights(string $profile, array $software): array
    {
        if ($profile === 'software') {
            return $software;
        }

        $weights = config("readiness.profiles.{$profile}");

        // core / balanced exist to score Core Prep, so they must carry it; `general` has no such component.
        $needsCore = in_array($profile, ['core', 'balanced'], true);

        if (! is_array($weights) || array_sum($weights) !== 100 || ($needsCore && ! array_key_exists('core_technical', $weights))) {
            // Once per service instance: a roster of thousands must not write thousands of identical lines.
            if (! isset($this->reportedProfiles[$profile])) {
                $this->reportedProfiles[$profile] = true;
                Log::error("config/readiness.php: the \"{$profile}\" profile must add up to 100 and include core_technical; scoring by the software weights instead.");
            }

            return $software;
        }

        return $weights;
    }

    /**
     * Which weighting describes this student: the core or balanced profile for a non-CS student whose branch's Core Prep
     * is live and who chose to lead with it; software for everyone else — including a student who has not chosen a
     * track and anyone whose branch is unknown. The conservative answer is always the one that has always applied.
     *
     * @param  array<string, array<string, mixed>>  $live  from liveCoreDisciplines()
     */
    private function profileFor(User $user, array $live): string
    {
        // A programme with no coding practice cannot earn coding or contest points; it is scored by the `general` weighting instead
        // of being capped at 70. A mis-edited `general` profile falls back to software (logged once), never takes the roster down.
        $caps = DepartmentCapabilities::forUser($user);

        if (! ($caps['coding_practice'] ?? true) && ! ($caps['contests'] ?? true)) {
            return $this->profileWeights('general', []) === [] ? 'software' : 'general';
        }

        $discipline = $this->disciplineOf($user);

        if ($discipline === null || ! isset($live[$discipline])) {
            return 'software';
        }

        $profile = match ($user->getAttributes()['track_focus'] ?? null) {
            'core_first' => 'core',
            'balanced' => 'balanced',
            default => 'software',
        };

        // A mis-edited profile is reported by profileWeights(); the student is then scored by the software weights, and says so.
        if ($profile !== 'software' && $this->profileWeights($profile, []) === []) {
            return 'software';
        }

        return $profile;
    }

    /** The student's branch family, or null when it is not loaded or not set (read from the raw attributes: never a query). */
    private function disciplineOf(User $user): ?string
    {
        $discipline = $user->getAttributes()['discipline'] ?? null;

        return is_string($discipline) && $discipline !== '' ? $discipline : null;
    }

    /**
     * A caller that loaded students with a column list may have left `discipline` / `track_focus` out; reading that as
     * "no branch" would quietly score a core student by the software weights. Fill them in with one query for exactly
     * those students (and none at all when every model has them, which is every normal load).
     *
     * @param  Collection<int, User>  $students
     */
    private function ensureBranchAttributes(Collection $students): void
    {
        $columns = ['discipline', 'track_focus', 'department', 'branch_code', 'coding_opt_in'];
        $partial = $students->filter(fn (User $s) => array_diff_key(array_flip($columns), $s->getAttributes()) !== []);

        if ($partial->isEmpty()) {
            return;
        }

        $rows = DB::table('users')->whereIn('id', $partial->pluck('id')->all())->get(array_merge(['id'], $columns))->keyBy('id');

        foreach ($partial as $student) {
            $row = $rows[$student->id] ?? null;
            $fill = [];
            foreach ($columns as $column) {
                $fill[$column] = $row->{$column} ?? null;
            }
            // Raw and synced: filling a partial model in must not make it look as though someone changed these fields.
            $student->setRawAttributes($student->getAttributes() + $fill, true);
        }
    }

    /**
     * The branch families whose Core Prep is live AND has published questions (the same test as CoreAccess: a family
     * with nothing to practise is not "live" to a student, so it must not change how they are scored) — and only when
     * some student here belongs to one. A roster with none costs nothing: no query at all.
     *
     * @param  Collection<int, User>  $students
     * @return array<string, array{live_at: ?Carbon, grace_until: ?Carbon, topics: int, has_tests: bool}>
     */
    private function liveCoreDisciplines(Collection $students): array
    {
        // Core Prep does not count towards readiness unless Ops has switched it on (config/readiness.php).
        if (! config('readiness.core.counts_towards_score', false)) {
            return [];
        }

        $wanted = $students->map(fn (User $s) => $this->disciplineOf($s))
            ->filter(fn (?string $d) => $d !== null && in_array($d, CoreAccess::families(), true))->unique()->values()->all();

        if ($wanted === []) {
            return [];
        }

        $catalog = BranchCatalog::instance();
        $wanted = array_values(array_filter($wanted, fn (string $d) => (bool) ($catalog->discipline($d)['is_live'] ?? false)));

        if ($wanted === []) {
            return [];
        }

        $withContent = CoreQuestion::query()->where('status', CoreQuestion::STATUS_PUBLISHED)->whereIn('discipline_code', $wanted)->distinct()->pluck('discipline_code')->all();

        if ($withContent === []) {
            return [];
        }

        $topics = app(CoreMasteryService::class)->publishedTopicCounts($withContent);
        $withTests = CoreTest::query()->where('test_type', CoreTest::TYPE_GENERAL)->where('status', CoreTest::STATUS_PUBLISHED)
            ->whereIn('discipline_code', $withContent)->distinct()->pluck('discipline_code')->all();

        $graceDays = max(0, (int) config('readiness.core.grace_days', 30));
        $live = [];

        foreach ($withContent as $code) {
            $stamp = $catalog->discipline($code)['live_at'] ?? null;
            $liveAt = $stamp ? Carbon::parse($stamp) : null;

            $live[$code] = [
                'live_at' => $liveAt,
                // A branch switched on before go-live was stamped has no date, so no grace: it has been live for a while.
                'grace_until' => $liveAt?->copy()->addDays($graceDays),
                'topics' => $topics[$code] ?? 0,
                'has_tests' => in_array($code, $withTests, true),
            ];
        }

        return $live;
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
     * Each student's newest finished Core tests (Mellow's and their own college's) as a percent score, newest first.
     * Nothing is queried unless there is a student on a core profile to read them for.
     *
     * @param  array<int, int>  $ids
     * @return array<int, Collection<int, float>>
     */
    private function recentCoreTestScores(array $ids): array
    {
        if ($ids === []) {
            return [];
        }

        $source = DB::table('core_test_sessions')
            ->whereIn('user_id', $ids)
            ->where('status', 'completed')
            ->whereNotNull('score_percent')
            ->whereRaw('COALESCE(completed_at, created_at) >= ?', [$this->recentSince()])
            ->whereIn('core_test_id', CoreTest::query()->countsTowardReadiness()->select('core_tests.id'));

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
     * @param  array<int, int>  $coreIds  the students whose branch's Core Prep is live: a timed Core test they finished counts too
     * @return array<int, array<string, int>> student id => [kind => distinct count]
     */
    private function participationFor(array $ids, array $coreIds = []): array
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

        if ($coreIds !== []) {
            $union->unionAll(
                DB::table('core_test_sessions')
                    ->select('user_id')->selectRaw("'core_test' as kind")->selectRaw('core_test_id as ref')
                    ->whereIn('user_id', $coreIds)
                    ->where('status', 'completed')
                    ->whereRaw('COALESCE(completed_at, created_at) >= ?', [$since])
                    ->whereIn('core_test_id', CoreTest::query()->countsTowardReadiness()->select('core_tests.id'))
            );
        }

        $participation = [];

        foreach (DB::query()->fromSub($union, 'p')->get() as $row) {
            $participation[(int) $row->user_id][$row->kind][$row->ref] = true;
        }

        return array_map(fn (array $kinds) => array_map('count', $kinds), $participation);
    }

    /**
     * The distinct days, in the longer of the consistency and inactivity windows, on which each student did anything at
     * all on the platform. "Anything" is every module a student can work in — practice, contests, interviews, soft
     * skills, the three Learning Centre labs, articles, Project Lab — minus whatever a hiring partner posted.
     *
     * Consistency counts these days; the inactivity penalty counts the days in its window that are NOT among them.
     * One query feeds both, so the two can never disagree about whether a student showed up on a given day.
     *
     * @param  array<int, int>  $coreIds  the students whose branch's Core Prep is live: practising or testing there is activity too
     * @return array<int, array<string, true>> student id => [Y-m-d => true]
     */
    private function activeDatesFor(array $ids, array $coreIds = []): array
    {
        $since = now()->subDays(max((int) config('readiness.consistency_days', 28), (int) config('readiness.decay.window_days', 21)));
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

        if ($coreIds !== []) {
            $selects[] = DB::table('core_practice_answers')->select('user_id')->selectRaw('DATE(created_at) as d')
                ->whereIn('user_id', $coreIds)->where('created_at', '>=', $sinceTime);

            $selects[] = DB::table('core_test_sessions')->select('user_id')->selectRaw('DATE(COALESCE(completed_at, started_at, created_at)) as d')
                ->whereIn('user_id', $coreIds)->whereRaw('COALESCE(completed_at, started_at, created_at) >= ?', [$sinceTime])
                ->whereIn('core_test_id', CoreTest::query()->countsTowardReadiness()->select('core_tests.id'));
        }

        $union = array_shift($selects);
        foreach ($selects as $select) {
            $union->unionAll($select);
        }

        $dates = [];

        foreach (DB::query()->fromSub($union, 'a')->select('user_id', 'd')->distinct()->get() as $row) {
            $dates[(int) $row->user_id][(string) $row->d] = true;
        }

        return $dates;
    }

    /**
     * How many of a student's active days fall in the consistency window (today included).
     *
     * @param  array<string, true>  $dates
     */
    private function activeDaysIn(array $dates): int
    {
        $from = now()->subDays((int) config('readiness.consistency_days', 28))->toDateString();

        return count(array_filter(array_keys($dates), fn (string $d) => $d >= $from));
    }

    /**
     * The day each student's tracking began: the date of their first row in readiness_snapshots. A student with none is
     * not tracked yet (a brand-new account, or the refresh has not seen them since this shipped), and is charged for
     * nothing — see config('readiness.decay'). Fails soft: code deployed a moment before `migrate` must not take every
     * score down with it.
     *
     * @param  array<int, int>  $ids
     * @return array<int, string> student id => Y-m-d
     */
    private function trackedSinceFor(array $ids): array
    {
        if (! config('readiness.decay.enabled', true)) {
            return [];
        }

        try {
            return DB::table('readiness_snapshots')
                ->whereIn('user_id', $ids)
                ->groupBy('user_id')
                ->selectRaw('user_id, MIN(snapshot_date) as first_day')
                ->pluck('first_day', 'user_id')
                ->map(fn ($day) => substr((string) $day, 0, 10))
                ->all();
        } catch (\Throwable $e) {
            if (! $this->reportedMissingSnapshots) {
                $this->reportedMissingSnapshots = true;
                report($e);
            }

            return [];
        }
    }

    /**
     * @param  array<string, true>  $activeDates
     */
    private function idleDays(array $activeDates): ?int
    {
        if ($activeDates === []) {
            return null;
        }

        $last = max(array_keys($activeDates));
        $yesterday = now()->subDay()->toDateString();

        return $last >= $yesterday ? 0 : (int) Carbon::parse($last)->diffInDays(Carbon::parse($yesterday), true);
    }

    /**
     * What staying away has cost this student: of the last `window_days` complete days (yesterday and back, no earlier than
     * the day after they were first tracked), every one with no activity costs `points_per_missed_day` — after the first
     * `free_days` of them. Today is never counted against anyone; it is still theirs.
     *
     * The penalty is a pure function of the student's activity dates, so the same data always gives the same score, and a
     * student who comes back sees it stop growing immediately and shrink as the missed days roll out of the window.
     *
     * @param  array<string, true>  $activeDates
     * @return array{enabled: bool, tracking: bool, points: int, missed_days: int, window_days: int, per_day: int, free_days: int, practised_today: bool, last_active: ?string, idle_days: ?int, max_points: int}
     */
    private function decayFor(array $activeDates, ?string $trackedSince, int $base): array
    {
        $window = max(1, (int) config('readiness.decay.window_days', 21));
        $perDay = max(0, (int) config('readiness.decay.points_per_missed_day', 1));
        $free = max(0, (int) config('readiness.decay.free_days', 0));
        $enabled = (bool) config('readiness.decay.enabled', true) && $perDay > 0;
        $today = now()->toDateString();

        $decay = [
            'enabled' => $enabled,
            'tracking' => $trackedSince !== null,
            'points' => 0,
            'missed_days' => 0,
            'window_days' => $window,
            'per_day' => $perDay,
            'free_days' => $free,
            'practised_today' => isset($activeDates[$today]),
            'last_active' => $activeDates === [] ? null : max(array_keys($activeDates)),
            // Complete days since they last did anything (0 when they were here yesterday or today); null when we have not seen them in the window at all.
            'idle_days' => $this->idleDays($activeDates),
            'max_points' => $enabled ? max(0, $window - $free) * $perDay : 0,
        ];

        if (! $enabled || $trackedSince === null || $base <= 0) {
            return $decay;
        }

        $from = max(
            now()->subDays($window)->toDateString(),
            Carbon::parse($trackedSince)->addDay()->toDateString(),
        );
        $to = now()->subDay()->toDateString();

        if ($from > $to) {
            return $decay;
        }

        $missed = 0;
        for ($day = Carbon::parse($from); $day->toDateString() <= $to; $day->addDay()) {
            if (! isset($activeDates[$day->toDateString()])) {
                $missed++;
            }
        }

        $decay['missed_days'] = $missed;
        $decay['points'] = min($base, max(0, $missed - $free) * $perDay);

        return $decay;
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

    /**
     * The branch's technical standing: how well the student does in timed Core tests (recent form, depth-scaled like every
     * quality component) and how much of the branch's syllabus they have mastered in practice and tests. If the branch has
     * no published platform test yet, coverage carries it all — nobody is capped by something that does not exist.
     *
     * @param  Collection<int, float>  $testScores
     * @param  array<string, mixed>|null  $live
     */
    private function coreTechnicalComponent(Collection $testScores, int $mastered, ?array $live, int $weight): array
    {
        $shares = (array) config('readiness.core.shares', ['tests' => 60, 'coverage' => 40]);
        $testShare = ($live['has_tests'] ?? false) ? max(0, (int) ($shares['tests'] ?? 60)) : 0;
        $coverageShare = max(0, (int) ($shares['coverage'] ?? 40));

        if ($testShare + $coverageShare === 0) {
            $coverageShare = 1;
        }

        $topics = (int) ($live['topics'] ?? 0);
        $quality = $this->qualityScore($testScores, $this->fullCreditAt('core_tests'));
        $coverage = $topics > 0 ? (int) round(min(100.0, $mastered / $topics * 100)) : 0;
        $score = (int) round(($quality * $testShare + $coverage * $coverageShare) / ($testShare + $coverageShare));

        $parts = [];
        $parts[] = $testScores->isEmpty()
            ? (($live['has_tests'] ?? false) ? 'No Core test taken yet' : 'No Core tests published yet')
            : $this->plural($testScores->count(), 'recent Core test').' · average '.round((float) $testScores->avg()).'%';
        $parts[] = $topics > 0 ? "{$mastered} of {$topics} topics mastered" : 'Syllabus coverage not yet measurable';

        return $this->component('core_technical', 'Core Technical', $score, $weight, implode(' · ', $parts));
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
     * @param  array<string, mixed>  $decay  see decayFor() — a student losing points to missed days is told so first
     * @return array<int, string>
     */
    private function nextSteps(array $components, array $missingLearningModules, array $decay = []): array
    {
        $moduleNames = ['speaking' => 'Speaking Lab', 'listening' => 'Listening Lab', 'vocabulary' => 'Vocabulary Sprint'];

        $copy = [
            'interview_performance' => fn (array $c) => $c['score'] === 0
                ? "Take your first AI mock interview — it's the biggest single part of your readiness score."
                : 'Take another AI mock interview — your recent ones are worth '.$c['score'].'% and a few more builds a stronger record.',
            'core_technical' => fn (array $c) => $c['score'] === 0
                ? 'Start Core Prep — practise a few questions in each subject, then take a timed Core test; it is the largest part of your readiness score.'
                : 'Take a timed Core test and keep working through your weakest topics in Core Prep — both lift your technical score.',
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

        $steps = array_map(fn (array $c) => $copy[$c['key']]($c), array_slice($eligible, 0, 3));

        if (($decay['points'] ?? 0) > 0) {
            $lost = (int) $decay['points'];
            $days = (int) $decay['missed_days'];
            $window = (int) $decay['window_days'];
            $lead = ($decay['practised_today'] ?? false)
                ? "You're back today — good. "
                : 'Do something on AptRun today — a problem, a lab, an interview, anything. ';

            array_unshift($steps, $lead."You've missed {$days} of the last {$window} days and that has cost you {$lost} ".($lost === 1 ? 'point' : 'points').'. Every day you show up stops it growing, and each missed day drops out of the count after '.$window.' days.');
        }

        return array_slice($steps, 0, 3);
    }
}
