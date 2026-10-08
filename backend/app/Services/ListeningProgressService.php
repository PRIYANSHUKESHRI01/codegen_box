<?php

namespace App\Services;

use App\Models\ListeningAttempt;
use App\Models\ListeningLesson;
use Illuminate\Support\Collection;

/**
 * Everything the Listening Lab shows about a student's progress, computed from
 * their attempts in one place so the lesson list, the post-attempt "up next"
 * card and the Learning Centre hub can never disagree.
 *
 * Totals and level progress count the shared LIBRARY only — a student's own
 * generated lessons are practice extras, and counting them would let anyone
 * inflate "lessons passed" by generating easy ones. Their skill profile, on
 * the other hand, uses every attempt: a skill is a skill wherever it was
 * trained.
 */
class ListeningProgressService
{
    /** A skill needs at least this many answered questions before it can be called someone's weakest. */
    private const MIN_QUESTIONS_FOR_WEAKEST = 4;

    /** A skill at or above this accuracy is not worth recommending extra work on. */
    private const STRONG_SKILL_PCT = 70;

    /** The skill profile reads the most recent attempts, so it tracks how the student listens now, not months ago. */
    private const PROFILE_ATTEMPT_WINDOW = 200;

    /**
     * @return array{
     *   lessons_total:int, lessons_passed:int, average_best_score:?int, attempts_total:int,
     *   current_level:string, levels: array<string, array{total:int, passed:int}>,
     *   skills: list<array{skill:string, label:string, correct:int, total:int, pct:int}>,
     *   weakest_skill: ?array{skill:string, label:string, pct:int},
     *   recommended: ?array{lesson_id:int, title:string, difficulty:string, format:string, reason:string}
     * }
     */
    public function summary(int $userId, ?int $excludeLessonId = null): array
    {
        $lessons = ListeningLesson::visibleTo($userId)->where('is_active', true)->orderBy('display_order')->orderBy('id')->get();
        $library = $lessons->whereNull('user_id');

        $stats = ListeningAttempt::where('user_id', $userId)
            ->selectRaw('listening_lesson_id, COUNT(*) as attempt_count, MAX(score) as best_score, MAX(passed) as any_passed')
            ->groupBy('listening_lesson_id')
            ->get()
            ->keyBy('listening_lesson_id');

        $passed = fn (ListeningLesson $l): bool => (bool) ($stats->get($l->id)?->any_passed ?? false);

        $levels = [];
        foreach (ListeningLesson::DIFFICULTIES as $difficulty) {
            $inLevel = $library->where('difficulty', $difficulty);
            $levels[$difficulty] = ['total' => $inLevel->count(), 'passed' => $inLevel->filter($passed)->count()];
        }

        $libraryAttempted = $library->filter(fn (ListeningLesson $l) => $stats->has($l->id));
        $average = $libraryAttempted->isEmpty()
            ? null
            : (int) round($libraryAttempted->avg(fn (ListeningLesson $l) => (int) $stats->get($l->id)->best_score));

        $skills = $this->skillProfile($userId);
        $weakest = $this->weakestSkill($skills);

        return [
            'lessons_total' => $library->count(),
            'lessons_passed' => $library->filter($passed)->count(),
            'average_best_score' => $average,
            'attempts_total' => (int) $stats->sum('attempt_count'),
            'current_level' => $this->currentLevel($library, $passed),
            'levels' => $levels,
            'skills' => $skills,
            'weakest_skill' => $weakest,
            'recommended' => $this->recommend($lessons, $stats, $passed, $weakest, $excludeLessonId),
        ];
    }

    /**
     * Just the two numbers the Learning Centre hub card needs — two cheap
     * queries instead of the full summary() it would otherwise pay for on
     * every hub load. Library lessons only, same as summary().
     *
     * @return array{total:int, passed:int}
     */
    public function counts(int $userId): array
    {
        $libraryIds = ListeningLesson::whereNull('user_id')->where('is_active', true)->pluck('id');

        $passed = $libraryIds->isEmpty() ? 0 : ListeningAttempt::where('user_id', $userId)
            ->whereIn('listening_lesson_id', $libraryIds)
            ->where('passed', true)
            ->distinct()
            ->count('listening_lesson_id');

        return ['total' => $libraryIds->count(), 'passed' => $passed];
    }

    /** The first level that still has an unpassed library lesson — where the student should be working now. */
    private function currentLevel(Collection $library, callable $passed): string
    {
        foreach (ListeningLesson::DIFFICULTIES as $difficulty) {
            if ($library->where('difficulty', $difficulty)->contains(fn (ListeningLesson $l) => ! $passed($l))) {
                return $difficulty;
            }
        }

        return ListeningLesson::DIFFICULTY_ADVANCED;
    }

    /** @return list<array{skill:string, label:string, correct:int, total:int, pct:int}> only skills the student has actually been tested on */
    private function skillProfile(int $userId): array
    {
        $tally = [];

        ListeningAttempt::where('user_id', $userId)
            ->whereNotNull('skill_breakdown')
            ->orderByDesc('id')
            ->limit(self::PROFILE_ATTEMPT_WINDOW)
            ->get(['skill_breakdown'])
            ->each(function (ListeningAttempt $attempt) use (&$tally) {
                foreach ($attempt->skill_breakdown ?? [] as $row) {
                    $skill = $row['skill'] ?? null;
                    if (! in_array($skill, ListeningLesson::SKILLS, true)) {
                        continue;
                    }
                    $tally[$skill]['correct'] = ($tally[$skill]['correct'] ?? 0) + (int) ($row['correct'] ?? 0);
                    $tally[$skill]['total'] = ($tally[$skill]['total'] ?? 0) + (int) ($row['total'] ?? 0);
                }
            });

        $profile = [];
        foreach (ListeningLesson::SKILLS as $skill) {
            $total = $tally[$skill]['total'] ?? 0;
            if ($total <= 0) {
                continue;
            }
            $correct = min($total, $tally[$skill]['correct'] ?? 0);
            $profile[] = [
                'skill' => $skill,
                'label' => ListeningLesson::SKILL_LABELS[$skill],
                'correct' => $correct,
                'total' => $total,
                'pct' => (int) round(100 * $correct / $total),
            ];
        }

        return $profile;
    }

    /** @param  list<array{skill:string, label:string, correct:int, total:int, pct:int}>  $skills */
    private function weakestSkill(array $skills): ?array
    {
        $eligible = array_filter($skills, fn (array $s) => $s['total'] >= self::MIN_QUESTIONS_FOR_WEAKEST && $s['pct'] < self::STRONG_SKILL_PCT);
        if ($eligible === []) {
            return null;
        }

        usort($eligible, fn (array $a, array $b) => [$a['pct'], $b['total']] <=> [$b['pct'], $a['total']]);
        $weakest = $eligible[0];

        return ['skill' => $weakest['skill'], 'label' => $weakest['label'], 'pct' => $weakest['pct']];
    }

    /**
     * What to do next, in order of usefulness: practise the skill they are
     * weakest at, otherwise the next lesson at their level, otherwise beat
     * their lowest best score.
     *
     * @param  Collection<int, ListeningLesson>  $lessons  everything visible to this student, in display order
     */
    private function recommend(Collection $lessons, Collection $stats, callable $passed, ?array $weakest, ?int $excludeLessonId): ?array
    {
        $candidates = $lessons->reject(fn (ListeningLesson $l) => $l->id === $excludeLessonId)->values();
        $unpassed = $candidates->reject($passed)->values();

        $level = $this->currentLevel($lessons->whereNull('user_id'), $passed);
        $levelOrder = array_flip(ListeningLesson::DIFFICULTIES);

        $pick = null;
        $reason = null;

        if ($weakest !== null) {
            $pick = $unpassed
                ->filter(fn (ListeningLesson $l) => in_array($weakest['skill'], $l->skills(), true))
                ->sortBy(fn (ListeningLesson $l) => [abs($levelOrder[$l->difficulty] - $levelOrder[$level]), $l->display_order])
                ->first();
            if ($pick) {
                $reason = "Sharpen your {$weakest['label']} — you're at {$weakest['pct']}% there.";
            }
        }

        if (! $pick) {
            $pick = $unpassed->first(fn (ListeningLesson $l) => $l->difficulty === $level && $l->user_id === null)
                ?? $unpassed->first(fn (ListeningLesson $l) => $l->user_id === null)
                ?? $unpassed->first();
            if ($pick) {
                $attempted = $stats->isNotEmpty();
                $reason = $attempted
                    ? 'Next up at '.ucfirst($pick->difficulty).' level.'
                    : 'A gentle first lesson to tune your ear.';
            }
        }

        if (! $pick) {
            $pick = $candidates
                ->filter(fn (ListeningLesson $l) => (int) ($stats->get($l->id)?->best_score ?? 100) < 100)
                ->sortBy(fn (ListeningLesson $l) => (int) ($stats->get($l->id)?->best_score ?? 100))
                ->first();
            if ($pick) {
                $reason = 'Beat your best of '.(int) $stats->get($pick->id)->best_score.'%.';
            }
        }

        return $pick ? [
            'lesson_id' => $pick->id,
            'title' => $pick->title,
            'difficulty' => $pick->difficulty,
            'format' => $pick->format,
            'reason' => $reason,
        ] : null;
    }
}
