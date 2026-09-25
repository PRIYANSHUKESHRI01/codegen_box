<?php

namespace App\Services;

use App\Models\InterviewSession;
use App\Models\User;

/**
 * Readiness Score v2 — replaces the old CGPA-dominated formula with a
 * skill-first blend: AI-scored interview performance and contest rating
 * (both previously ignored entirely) now carry more weight than academic
 * record, matching how CodeSignal/HackerRank/Triplebyte-style platforms lean
 * on demonstrated skill over credentials. See User::readinessBreakdown()
 * for the public entry point — this service is the "real query, nothing
 * fabricated" implementation, same convention as StudentStatsService.
 *
 * Weights (sum to 100): Interview Performance 35, Contest Rating 20,
 * Practice Depth & Breadth 20, Consistency 15, Academic Standing 10. A
 * component with no underlying data (never interviewed, never rated) scores
 * 0 rather than being renormalized away — an honest "not yet assessed"
 * signal, paired with an actionable next step rather than a silent zero.
 */
class ReadinessScoreService
{
    private const WEIGHT_INTERVIEW = 35;

    private const WEIGHT_RATING = 20;

    private const WEIGHT_PRACTICE_DEPTH = 20;

    private const WEIGHT_CONSISTENCY = 15;

    private const WEIGHT_ACADEMIC = 10;

    /** The DB default for current_rating (see add_rating_fields_to_users_table) — "0% of the way to elite" for a never-rated student. */
    private const RATING_FLOOR = 1200;

    /** The 6★ "elite" band already shown to students via frontend rating.ts tiers — reaching it is treated as maxing out this component. */
    private const RATING_CEILING = 2200;

    /** Recent form, not lifetime average — mirrors how a contest rating itself is a "current skill" signal, not a lifetime one. */
    private const INTERVIEW_SESSIONS_CONSIDERED = 5;

    public function __construct(private StudentStatsService $studentStats)
    {
    }

    /**
     * @return array{score: int, tier: string, components: array, next_steps: array<int, string>}
     */
    public function breakdown(User $user): array
    {
        $components = [
            $this->interviewComponent($user),
            $this->ratingComponent($user),
            $this->practiceDepthComponent($user),
            $this->consistencyComponent($user),
            $this->academicComponent($user),
        ];

        $score = (int) round(array_sum(array_column($components, 'contribution')));

        return [
            'score' => $score,
            'tier' => $this->tierFor($score),
            'components' => $components,
            'next_steps' => $this->nextSteps($components),
        ];
    }

    private function interviewComponent(User $user): array
    {
        $scores = InterviewSession::where('user_id', $user->id)
            ->whereNotNull('composite_score_percent')
            ->orderByDesc('completed_at')
            ->limit(self::INTERVIEW_SESSIONS_CONSIDERED)
            ->pluck('composite_score_percent');

        $score = $scores->isEmpty() ? 0 : (int) round((float) $scores->avg());

        return $this->component('interview_performance', 'Interview Performance', $score, self::WEIGHT_INTERVIEW);
    }

    private function ratingComponent(User $user): array
    {
        $score = 0;

        if ($user->rated_contests_count > 0) {
            $percent = ($user->current_rating - self::RATING_FLOOR) / (self::RATING_CEILING - self::RATING_FLOOR) * 100;
            $score = (int) round(max(0.0, min(100.0, $percent)));
        }

        return $this->component('contest_rating', 'Contest Rating', $score, self::WEIGHT_RATING);
    }

    /**
     * Catalog-relative rather than a fixed point ceiling — self-calibrates
     * as the problem set grows, and weights Hard coverage 2x Easy so
     * farming easy problems alone can't max this out.
     */
    private function practiceDepthComponent(User $user): array
    {
        $solved = $this->studentStats->solvedByDifficulty($user);

        $coverage = fn (string $difficulty) => $solved[$difficulty]['total'] > 0
            ? $solved[$difficulty]['solved'] / $solved[$difficulty]['total']
            : 0.0;

        $volumeScore = $coverage('easy') * 20 + $coverage('medium') * 40 + $coverage('hard') * 40;

        $topics = $this->studentStats->topicMastery($user);
        $breadthScore = count($topics) > 0
            ? (count(array_filter($topics, fn (array $t) => $t['solved'] > 0)) / count($topics)) * 100
            : 0.0;

        $score = (int) round(($volumeScore + $breadthScore) / 2);

        return $this->component('practice_depth', 'Practice Depth & Breadth', $score, self::WEIGHT_PRACTICE_DEPTH);
    }

    private function consistencyComponent(User $user): array
    {
        return $this->component('consistency', 'Consistency', $user->practiceScore(), self::WEIGHT_CONSISTENCY);
    }

    /**
     * Same CGPA/backlog formula as the old readinessScore(), rescaled from
     * its previous 50% down to 10% — still real (colleges/recruiters do
     * apply CGPA cutoffs) but no longer allowed to dominate a technical
     * readiness score the way it used to.
     */
    private function academicComponent(User $user): array
    {
        $cgpaScore = $user->cgpa !== null ? min(1.0, (float) $user->cgpa / 10) * 60 : 0.0;
        $backlogScore = $user->backlogs !== null ? max(0, 1 - min($user->backlogs, 3) / 3) * 40 : 0.0;

        $score = (int) round($cgpaScore + $backlogScore);

        return $this->component('academic_standing', 'Academic Standing', $score, self::WEIGHT_ACADEMIC);
    }

    private function component(string $key, string $label, int $score, int $weight): array
    {
        $clamped = max(0, min(100, $score));

        return [
            'key' => $key,
            'label' => $label,
            'score' => $clamped,
            'weight_percent' => $weight,
            'contribution' => round($clamped / 100 * $weight, 2),
        ];
    }

    private function tierFor(int $score): string
    {
        return match (true) {
            $score >= 75 => 'Placement Ready',
            $score >= 45 => 'In Progress',
            default => 'Needs Training',
        };
    }

    /**
     * Up to 2 nudges, ranked by weight × headroom — "which component, if
     * improved, would move the overall score the most" — same prioritization
     * credit-score apps use for "factors hurting your score most" rather
     * than listing every imperfect factor. Academic standing is never
     * suggested — it isn't something a student can act on from this app.
     *
     * @param  array<int, array{key: string, score: int, weight_percent: int}>  $components
     * @return array<int, string>
     */
    private function nextSteps(array $components): array
    {
        $copy = [
            'interview_performance' => fn (array $c) => $c['score'] === 0
                ? "Take your first AI mock interview — it's the single biggest factor in your readiness score."
                : "Your recent interviews averaged {$c['score']}%. Take another mock interview to push this higher.",
            'contest_rating' => fn (array $c) => $c['score'] === 0
                ? 'Enter a rated contest to establish your competitive rating.'
                : 'Keep entering rated contests — your rating still has room to climb.',
            'practice_depth' => fn (array $c) => 'Solve problems across more topics and difficulties, especially Hard problems, to round out your coverage.',
            'consistency' => fn (array $c) => 'Solve at least 3 problems today to build back your daily practice streak.',
        ];

        $eligible = array_filter($components, fn (array $c) => isset($copy[$c['key']]) && $c['score'] < 100);

        usort($eligible, fn (array $a, array $b) => ($b['weight_percent'] * (100 - $b['score'])) <=> ($a['weight_percent'] * (100 - $a['score'])));

        return array_map(fn (array $c) => $copy[$c['key']]($c), array_slice($eligible, 0, 2));
    }
}
