<?php

namespace App\Services\Mock;

use App\Models\Interview;
use App\Models\InterviewSession;
use App\Models\User;
use App\Services\CuratedInterviewSetService;
use App\Services\PlanGate;
use App\Support\InterviewDiscipline;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * The student's side of the Mock AI Interview: the domain -> tech stack -> round catalog, with how they have done on each round,
 * and one-click start of a round.
 *
 * Starting a round makes an ordinary private practice interview (CuratedInterviewSetService::createInterviewFromTarget), so it is
 * taken, proctored and AI-scored exactly like every other mock - and counts against the plan's mock-interview allowance when the
 * student sits it. Opening a round the student already has waiting (not yet started, or half-done) returns that interview instead
 * of making another, so tapping "Start" twice, or coming back later, costs nothing.
 *
 * A round with more questions than `mock_interviews.questions_per_interview` is sampled each time, preferring questions this
 * student has not been asked in this round before.
 */
class MockInterviewService
{
    public const SOURCE = 'mock_round';

    public function __construct(
        private readonly MockInterviewCatalog $catalog,
        private readonly CuratedInterviewSetService $curated,
        private readonly PlanGate $gate,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function catalog(User $viewer): array
    {
        $mine = $this->progress($viewer);
        $roles = [];
        $stats = ['total_roles' => 0, 'total_stacks' => 0, 'live_stacks' => 0, 'total_questions' => 0];

        foreach ($this->catalog->roles() as $role) {
            $stacks = [];
            $live = 0;

            foreach ($role['stacks'] as $stack) {
                $progress = $this->catalog->progress($stack);
                $rounds = [];

                foreach ($stack['rounds'] as $round) {
                    $count = count($round['questions']);
                    $stats['total_questions'] += $count;

                    $rounds[] = [
                        'id' => $round['id'],
                        'round_number' => $round['round_number'],
                        'title' => $round['title'],
                        'description' => $round['description'],
                        'duration_minutes' => $round['duration_minutes'],
                        'question_count' => $count,
                        // What one sitting asks: a round with 200 questions in its bank still takes ~20 at a time.
                        'sitting_questions' => min($count, $this->sittingLength($stack)),
                        'ready' => $this->catalog->isRoundReady($round),
                        'my' => $mine[$round['id']] ?? ['attempts' => 0, 'best_score' => null, 'scoring' => false, 'open_slug' => null, 'open_status' => null],
                    ];
                }

                $stats['total_stacks']++;
                $stats['live_stacks'] += $progress['live'] ? 1 : 0;
                $live += $progress['live'] ? 1 : 0;

                $stacks[] = [
                    'key' => $stack['key'],
                    'name' => $stack['name'],
                    'blurb' => $stack['blurb'],
                    'icon' => $stack['icon'],
                    'aliases' => $stack['aliases'],
                    'tags' => $stack['tags'],
                    'live' => $progress['live'],
                    // Merchant Navy practice is exam preparation: it never moves the placement-readiness score (Interview::scopeCountsTowardReadiness).
                    'counts_toward_readiness' => ($stack['discipline'] ?? null) !== InterviewDiscipline::MARITIME_KEY,
                    'ready_rounds' => $progress['ready_rounds'],
                    'total_rounds' => $progress['total_rounds'],
                    'rounds' => $rounds,
                ];
            }

            $stats['total_roles']++;

            $roles[] = [
                'key' => $role['key'],
                'title' => $role['title'],
                'blurb' => $role['blurb'],
                'icon' => $role['icon'],
                'badge' => $role['badge'],
                'color' => $role['color'],
                'terms' => $role['terms'] ?? null,
                'stacks_count' => count($stacks),
                'live_stacks_count' => $live,
                'stacks' => $stacks,
            ];
        }

        return ['roles' => $roles, 'stats' => $stats, 'min_questions' => $this->catalog->minQuestions()];
    }

    /**
     * Starts (or resumes) a round. The plan allowance is checked only when a NEW interview is made.
     */
    public function start(User $user, string $roundId): Interview
    {
        $target = $this->catalog->round($roundId);

        if ($target === null) {
            throw new NotFoundHttpException('That mock interview round does not exist.');
        }

        if (! $this->catalog->isRoundReady($target['round'])) {
            throw new ConflictHttpException("This round is still being prepared — questions for {$target['stack']['name']} are on their way.");
        }

        if ($waiting = $this->waitingInterview($user, $roundId)) {
            return $waiting;
        }

        $this->gate->assertMockInterviewAllowed($user);

        $round = $target['round'];
        $picked = array_map($this->forScorer(...), $this->pick($user, $roundId, $round['questions'], $this->sittingLength($target['stack'])));

        return $this->curated->createInterviewFromTarget(
            $user,
            [
                'role' => ['key' => $target['role']['key'], 'title' => $target['role']['title'], 'color' => $target['role']['color'] ?? 'indigo'],
                'stack' => ['key' => $target['stack']['key'], 'name' => $target['stack']['name']],
                // Which branch of knowledge the AI scorer judges the answers by (null = the software default every IT stack has always had).
                'discipline' => $target['stack']['discipline'] ?? null,
                'set' => [
                    'id' => $roundId,
                    'series_number' => 1,
                    'set_number' => $round['round_number'],
                    'title' => $round['title'],
                    'description' => $round['description'],
                    'duration_minutes' => $round['duration_minutes'],
                    'tags' => $round['tags'],
                    'questions' => $picked,
                ],
            ],
            [
                'source' => self::SOURCE,
                'mock_round_id' => $roundId,
                'mock_question_ids' => array_values(array_filter(array_column($picked, 'id'))),
            ]
        );
    }

    /** The student's own interview for this round that they have not finished (never started, or half-done), if any. */
    private function waitingInterview(User $user, string $roundId): ?Interview
    {
        $interviews = $this->interviewsOf($user, $roundId);
        $sessions = InterviewSession::where('user_id', $user->id)->whereIn('interview_id', $interviews->pluck('id'))->get()->keyBy('interview_id');

        return $interviews->first(fn (Interview $i) => ($sessions[$i->id] ?? null)?->status !== InterviewSession::STATUS_COMPLETED);
    }

    /** How many questions one sitting of this stack asks: the stack's own number, else the global one - never below a round's minimum. */
    private function sittingLength(array $stack): int
    {
        return max($this->catalog->minQuestions(), (int) ($stack['questions_per_interview'] ?? config('mock_interviews.questions_per_interview', 10)));
    }

    /**
     * What the AI scorer is given as the question's reference answer. A question whose reference carries a figure still to be checked
     * says so, so a candidate who states a different, commonly accepted figure is not marked wrong for it.
     *
     * @param  array<string, mixed>  $question
     * @return array<string, mixed>
     */
    private function forScorer(array $question): array
    {
        if (! empty($question['needs_review'])) {
            $question['note'] = trim((string) ($question['note'] ?? '').' (The figures in this reference answer are still being checked: judge the concept, and accept any commonly accepted current figure.)');
        }

        return $question;
    }

    /**
     * @param  list<array<string, mixed>>  $questions
     * @return list<array<string, mixed>>
     */
    private function pick(User $user, string $roundId, array $questions, int $cap): array
    {
        if (count($questions) <= $cap) {
            return array_values($questions);
        }

        $seen = $this->interviewsOf($user, $roundId)
            ->flatMap(fn (Interview $i) => (array) ($i->practice_config['mock_question_ids'] ?? []))
            ->flip();

        $fresh = array_values(array_filter($questions, fn ($q) => ! isset($seen[$q['id']])));
        $stale = array_values(array_filter($questions, fn ($q) => isset($seen[$q['id']])));
        shuffle($fresh);
        shuffle($stale);

        // Questions not met before come first; the rest only top the interview up to its length. Within each, a topic-tagged bank is drawn
        // across its topics (see spread()).
        $chosen = $this->spread($fresh, $cap);

        if (count($chosen) < $cap) {
            $chosen = array_merge($chosen, $this->spread($stale, $cap - count($chosen)));
        }

        // Asked in the order staff wrote them (easier first, by convention), whatever was drawn.
        usort($chosen, fn ($a, $b) => $a['id'] <=> $b['id']);

        return $chosen;
    }

    /**
     * Takes `$n` questions from an already shuffled pool, one topic at a time in turn, so a sitting covers the syllabus the way an examiner
     * does instead of ten random questions from one section. A pool with no topics (every IT stack) is one group: simply its first `$n`.
     *
     * @param  list<array<string, mixed>>  $pool
     * @return list<array<string, mixed>>
     */
    private function spread(array $pool, int $n): array
    {
        $byTopic = [];

        foreach ($pool as $question) {
            $byTopic[(string) ($question['topic'] ?? '')][] = $question;
        }

        $order = array_keys($byTopic);
        shuffle($order); // which topics miss out when there are more topics than places is left to chance

        $out = [];

        while (count($out) < $n && $order !== []) {
            foreach ($order as $topic) {
                if (count($out) >= $n) {
                    break;
                }

                $out[] = array_shift($byTopic[$topic]);
            }

            $order = array_values(array_filter($order, fn ($topic) => $byTopic[$topic] !== []));
        }

        return $out;
    }

    /** @return \Illuminate\Support\Collection<int, Interview> the student's interviews of one round, newest first */
    private function interviewsOf(User $user, string $roundId)
    {
        return Interview::query()
            ->where('created_by', $user->id)
            ->where('interview_type', Interview::INTERVIEW_TYPE_PRACTICE)
            ->where('practice_config->source', self::SOURCE)
            ->where('practice_config->mock_round_id', $roundId)
            ->orderByDesc('id')
            ->get(['id', 'slug', 'practice_config']);
    }

    /**
     * How this student has done on every round they have touched.
     *
     * @return array<string, array{attempts: int, best_score: ?int, scoring: bool, open_slug: ?string, open_status: ?string}>
     */
    private function progress(User $user): array
    {
        $interviews = Interview::query()
            ->where('created_by', $user->id)
            ->where('interview_type', Interview::INTERVIEW_TYPE_PRACTICE)
            ->where('practice_config->source', self::SOURCE)
            ->orderByDesc('id')
            ->get(['id', 'slug', 'practice_config']);

        if ($interviews->isEmpty()) {
            return [];
        }

        $sessions = InterviewSession::where('user_id', $user->id)
            ->whereIn('interview_id', $interviews->pluck('id'))
            ->get(['interview_id', 'status', 'composite_score_percent'])
            ->keyBy('interview_id');

        $out = [];

        foreach ($interviews as $interview) {
            $roundId = (string) ($interview->practice_config['mock_round_id'] ?? '');

            if ($roundId === '') {
                continue;
            }

            $out[$roundId] ??= ['attempts' => 0, 'best_score' => null, 'scoring' => false, 'open_slug' => null, 'open_status' => null];
            $session = $sessions[$interview->id] ?? null;

            if ($session?->status === InterviewSession::STATUS_COMPLETED) {
                $out[$roundId]['attempts']++;

                if ($session->composite_score_percent === null) {
                    $out[$roundId]['scoring'] = true;
                } else {
                    $score = (int) round($session->composite_score_percent);
                    $out[$roundId]['best_score'] = max($out[$roundId]['best_score'] ?? 0, $score);
                }
            } elseif ($out[$roundId]['open_slug'] === null) {
                // Newest unfinished one wins (the list is newest first).
                $out[$roundId]['open_slug'] = $interview->slug;
                $out[$roundId]['open_status'] = $session?->status === InterviewSession::STATUS_IN_PROGRESS ? 'in_progress' : 'ready';
            }
        }

        return $out;
    }
}
