<?php

namespace App\Services;

use App\Models\Submission;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Which programming language each student actually solves problems in, how
 * well it goes in each, and where they should improve — the language half of
 * "track students' progress". One grouped query over BOTH practice
 * (`submissions`) and contest (`contest_submissions`) attempts feeds every
 * caller: the student's own Language Focus card, the TPO/coordinator/admin
 * student report, and the per-student language columns on the Student Cohort
 * roster. Same "one computation, reused by every caller" convention as
 * StudentCohortService.
 *
 * What the numbers mean (so nobody over-reads them):
 *  - A practice row is one Submit per (student, problem, calendar day) whose
 *    verdict is the day's latest — the table cannot tell how many tries a
 *    single day took. A contest row is every individual attempt. An
 *    "attempt" here is one such row, and `acceptance_rate` is the share whose
 *    verdict was Accepted. It is a reliable comparison BETWEEN a student's
 *    languages (same bias in each), not an absolute pass-rate.
 *  - `solved` is distinct problems Accepted in that language (practice and
 *    contest together). The same problem solved in two languages counts once
 *    in each, which is exactly "how much have I solved in this language".
 *  - No verdict is given from a thin sample: below MIN_ATTEMPTS_FOR_VERDICT
 *    submissions a language is "getting_started", never "needs_work".
 */
class LanguageInsightsService
{
    /** Fewer submissions than this in a language and we say nothing about how well it is going. */
    public const MIN_ATTEMPTS_FOR_VERDICT = 5;

    /** At or above this acceptance rate (with enough submissions) a language is a strength. */
    public const STRONG_ACCEPTANCE_PERCENT = 70;

    /** Below this acceptance rate (with enough submissions) a language needs work. */
    public const WEAK_ACCEPTANCE_PERCENT = 40;

    /** A language where this share of submissions fail to compile / crash gets its own flag even if acceptance is fine. */
    public const ERROR_SHARE_FLAG_PERCENT = 30;

    public const PROFICIENCY_GETTING_STARTED = 'getting_started';

    public const PROFICIENCY_STEADY = 'steady';

    public const PROFICIENCY_STRONG = 'strong';

    public const PROFICIENCY_NEEDS_WORK = 'needs_work';

    public const INSIGHT_LOW_ACCEPTANCE = 'low_acceptance';

    public const INSIGHT_COMPILE_ERRORS = 'compile_errors';

    public const INSIGHT_RUNTIME_ERRORS = 'runtime_errors';

    public const INSIGHT_PREFERRED_NOT_PRACTICED = 'preferred_not_practiced';

    /** Ids per query — keeps the IN (...) list far under every driver's bind-parameter limit. */
    private const ID_CHUNK = 500;

    /**
     * The raw per-(student, language) aggregate for these students, keyed by
     * student id. Students with no submissions at all are simply absent.
     *
     * @param  array<int, int>  $userIds
     * @return Collection<int, Collection<int, object>>
     */
    public function aggregate(array $userIds): Collection
    {
        $rows = collect();

        foreach (array_chunk(array_values(array_unique($userIds)), self::ID_CHUNK) as $chunk) {
            $practice = DB::table('submissions')
                ->whereIn('user_id', $chunk)
                ->select('user_id', 'language', 'status', 'problem_id')
                ->selectRaw('updated_at as attempted_at');

            $contest = DB::table('contest_submissions as cs')
                ->join('contest_problems as cp', 'cp.id', '=', 'cs.contest_problem_id')
                ->whereIn('cs.user_id', $chunk)
                ->select('cs.user_id', 'cs.language', 'cs.status', 'cp.problem_id')
                ->selectRaw('cs.submitted_at as attempted_at');

            $rows = $rows->concat(
                DB::query()
                    ->fromSub($practice->unionAll($contest), 'attempts')
                    ->select('user_id', 'language')
                    ->selectRaw('COUNT(*) as attempts')
                    ->selectRaw("SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) as accepted")
                    ->selectRaw("SUM(CASE WHEN status = 'wrong_answer' THEN 1 ELSE 0 END) as wrong_answers")
                    ->selectRaw("SUM(CASE WHEN status = 'runtime_error' THEN 1 ELSE 0 END) as runtime_errors")
                    ->selectRaw("SUM(CASE WHEN status = 'compile_error' THEN 1 ELSE 0 END) as compile_errors")
                    ->selectRaw("COUNT(DISTINCT CASE WHEN status = 'accepted' THEN problem_id END) as solved")
                    ->selectRaw('MAX(attempted_at) as last_used_at')
                    ->groupBy('user_id', 'language')
                    ->get()
            );
        }

        return $rows->groupBy('user_id');
    }

    /** One student's full language picture — what the student report and the student's own Language Focus card render. */
    public function forStudent(User $student): array
    {
        return $this->build($student, $this->aggregate([$student->id])->get($student->id, collect()));
    }

    /**
     * The same picture for many students, in the same couple of queries — for
     * the cohort roster, where a per-student call would be one query each.
     *
     * @param  iterable<int, User>  $students
     * @return array<int, array> keyed by student id
     */
    public function forStudents(iterable $students): array
    {
        $students = collect($students)->values();
        $aggregate = $this->aggregate($students->pluck('id')->all());

        return $students
            ->mapWithKeys(fn (User $student) => [$student->id => $this->build($student, $aggregate->get($student->id, collect()))])
            ->all();
    }

    /**
     * @param  Collection<int, object>  $rows  this student's per-language aggregate rows
     */
    private function build(User $student, Collection $rows): array
    {
        $totalAttempts = (int) $rows->sum('attempts');

        $languages = $rows
            ->map(fn (object $row) => $this->languageRow($row, $totalAttempts))
            ->sort(fn (array $a, array $b) => [$b['solved'], $b['accepted'], $b['attempts'], (string) $b['last_used_at'], $a['language']]
                <=> [$a['solved'], $a['accepted'], $a['attempts'], (string) $a['last_used_at'], $b['language']])
            ->values()
            ->all();

        $actualPrimary = $languages[0]['language'] ?? null;
        $statedPrimary = $student->primary_language;

        return [
            'stated' => [
                'primary_language' => $statedPrimary,
                'preferred_languages' => $student->preferred_languages ?? [],
                'skill_level' => $student->skill_level,
                'career_goal' => $student->career_goal,
                'focus_areas' => $student->focus_areas ?? [],
                'weekly_pace' => $student->weekly_pace,
                'onboarded' => $student->onboarding_completed_at !== null,
            ],
            'actual_primary_language' => $actualPrimary,
            'totals' => [
                'attempts' => $totalAttempts,
                'accepted' => (int) $rows->sum('accepted'),
                'languages_used' => count($languages),
            ],
            'languages' => $languages,
            'improve' => $this->improvementAreas($languages, $statedPrimary, $totalAttempts),
            // "Says Java, writes Python" — only worth flagging once there is enough
            // activity that the difference is real and not just a student who has
            // barely started.
            'mismatch' => $statedPrimary !== null
                && $actualPrimary !== null
                && $statedPrimary !== $actualPrimary
                && $totalAttempts >= self::MIN_ATTEMPTS_FOR_VERDICT,
        ];
    }

    private function languageRow(object $row, int $totalAttempts): array
    {
        $attempts = (int) $row->attempts;
        $accepted = (int) $row->accepted;
        $acceptance = $attempts > 0 ? (int) round($accepted / $attempts * 100) : 0;

        return [
            'language' => $row->language,
            'attempts' => $attempts,
            'accepted' => $accepted,
            'solved' => (int) $row->solved,
            'wrong_answers' => (int) $row->wrong_answers,
            'runtime_errors' => (int) $row->runtime_errors,
            'compile_errors' => (int) $row->compile_errors,
            'acceptance_rate' => $acceptance,
            'share_percent' => $totalAttempts > 0 ? (int) round($attempts / $totalAttempts * 100) : 0,
            'last_used_at' => $row->last_used_at ? Carbon::parse($row->last_used_at)->toIso8601String() : null,
            'proficiency' => $this->proficiency($attempts, $acceptance),
        ];
    }

    private function proficiency(int $attempts, int $acceptanceRate): string
    {
        return match (true) {
            $attempts < self::MIN_ATTEMPTS_FOR_VERDICT => self::PROFICIENCY_GETTING_STARTED,
            $acceptanceRate >= self::STRONG_ACCEPTANCE_PERCENT => self::PROFICIENCY_STRONG,
            $acceptanceRate < self::WEAK_ACCEPTANCE_PERCENT => self::PROFICIENCY_NEEDS_WORK,
            default => self::PROFICIENCY_STEADY,
        };
    }

    /**
     * Where this student should improve, most pressing first. Structured, not
     * sentences — the frontend words them with the same language labels the
     * editor shows, so "Python3" never reads as "python" in one place and
     * "Python 3" in another. One finding per language at most (the most
     * severe one), plus a nudge when the language they named as their main one
     * is untouched.
     *
     * @param  array<int, array>  $languages
     * @return array<int, array<string, mixed>>
     */
    private function improvementAreas(array $languages, ?string $statedPrimary, int $totalAttempts): array
    {
        $best = collect($languages)
            ->filter(fn (array $l) => $l['attempts'] >= self::MIN_ATTEMPTS_FOR_VERDICT)
            ->sortByDesc('acceptance_rate')
            ->first();

        $findings = [];

        foreach ($languages as $language) {
            if ($language['attempts'] < self::MIN_ATTEMPTS_FOR_VERDICT) {
                continue;
            }

            $attempts = $language['attempts'];
            $compileShare = (int) round($language['compile_errors'] / $attempts * 100);
            $runtimeShare = (int) round($language['runtime_errors'] / $attempts * 100);

            $kind = match (true) {
                $language['acceptance_rate'] < self::WEAK_ACCEPTANCE_PERCENT => self::INSIGHT_LOW_ACCEPTANCE,
                $compileShare >= self::ERROR_SHARE_FLAG_PERCENT => self::INSIGHT_COMPILE_ERRORS,
                $runtimeShare >= self::ERROR_SHARE_FLAG_PERCENT => self::INSIGHT_RUNTIME_ERRORS,
                default => null,
            };

            if ($kind === null) {
                continue;
            }

            $findings[] = [
                'kind' => $kind,
                'severity' => $kind === self::INSIGHT_LOW_ACCEPTANCE && $language['acceptance_rate'] < 25 ? 'high' : 'medium',
                'language' => $language['language'],
                'attempts' => $attempts,
                'acceptance_rate' => $language['acceptance_rate'],
                'compile_error_share' => $compileShare,
                'runtime_error_share' => $runtimeShare,
                'dominant_failure' => $this->dominantFailure($language),
                // Only worth quoting a stronger language when it is clearly stronger.
                'stronger_language' => ($best !== null
                    && $best['language'] !== $language['language']
                    && $best['acceptance_rate'] - $language['acceptance_rate'] >= 20)
                    ? ['language' => $best['language'], 'acceptance_rate' => $best['acceptance_rate']]
                    : null,
            ];
        }

        if ($statedPrimary !== null
            && $totalAttempts >= self::MIN_ATTEMPTS_FOR_VERDICT
            && ! collect($languages)->contains(fn (array $l) => $l['language'] === $statedPrimary)) {
            $findings[] = [
                'kind' => self::INSIGHT_PREFERRED_NOT_PRACTICED,
                'severity' => 'medium',
                'language' => $statedPrimary,
                'attempts' => 0,
                'acceptance_rate' => 0,
                'compile_error_share' => 0,
                'runtime_error_share' => 0,
                'dominant_failure' => null,
                'stronger_language' => null,
            ];
        }

        usort($findings, fn (array $a, array $b) => [$a['severity'] === 'high' ? 0 : 1, $a['acceptance_rate']]
            <=> [$b['severity'] === 'high' ? 0 : 1, $b['acceptance_rate']]);

        return $findings;
    }

    /** What most of this language's non-accepted submissions died of — null when there are none. */
    private function dominantFailure(array $language): ?string
    {
        $failures = [
            Submission::STATUS_WRONG_ANSWER => $language['wrong_answers'],
            Submission::STATUS_RUNTIME_ERROR => $language['runtime_errors'],
            Submission::STATUS_COMPILE_ERROR => $language['compile_errors'],
        ];

        arsort($failures);
        $top = array_key_first($failures);

        return $failures[$top] > 0 ? $top : null;
    }
}
