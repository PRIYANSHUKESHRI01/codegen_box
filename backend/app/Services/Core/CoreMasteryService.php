<?php

namespace App\Services\Core;

use App\Models\CorePracticeAnswer;
use App\Models\CoreQuestion;
use App\Models\CoreSubject;
use App\Models\CoreTestResponse;
use App\Models\CoreTestSession;
use App\Models\CoreTopic;

/**
 * What a student actually knows, measured from what they actually answered — practice and timed tests
 * together, over a recent window (an answer from two years ago says little about today).
 *
 * Everything here is aggregated in SQL (one grouped query per source), never per question or per topic, so
 * the same numbers can later be produced for a whole roster by passing many user ids.
 */
class CoreMasteryService
{
    /** Window, in days, an answer counts for. */
    public function windowDays(): int
    {
        return (int) config('core_prep.mastery.window_days', 180);
    }

    /**
     * Attempts and correct answers per subject and topic.
     *
     * @return array{topics: array<int, array{subject_id: int, attempts: int, correct: int}>, subjects: array<int, array{attempts: int, correct: int}>}
     */
    public function accuracyFor(int $userId): array
    {
        $since = now()->subDays($this->windowDays());

        $practice = CorePracticeAnswer::query()
            ->where('user_id', $userId)->where('created_at', '>=', $since)
            ->selectRaw('subject_id, topic_id, count(*) as attempts, sum(case when is_correct then 1 else 0 end) as correct')
            ->groupBy('subject_id', 'topic_id')->get();

        $tests = CoreTestResponse::query()
            ->join('core_test_sessions', 'core_test_sessions.id', '=', 'core_test_responses.core_test_session_id')
            ->join('core_questions', 'core_questions.id', '=', 'core_test_responses.core_question_id')
            ->where('core_test_sessions.user_id', $userId)
            ->where('core_test_sessions.status', CoreTestSession::STATUS_COMPLETED)
            ->where('core_test_sessions.completed_at', '>=', $since)
            ->whereNotNull('core_test_responses.is_correct')
            ->selectRaw('core_questions.subject_id as subject_id, core_questions.topic_id as topic_id, count(*) as attempts, sum(case when core_test_responses.is_correct then 1 else 0 end) as correct')
            ->groupBy('core_questions.subject_id', 'core_questions.topic_id')->get();

        $topics = [];
        $subjects = [];

        foreach ($practice->concat($tests) as $row) {
            $subjectId = (int) $row->subject_id;
            $subjects[$subjectId]['attempts'] = ($subjects[$subjectId]['attempts'] ?? 0) + (int) $row->attempts;
            $subjects[$subjectId]['correct'] = ($subjects[$subjectId]['correct'] ?? 0) + (int) $row->correct;

            if ($row->topic_id !== null) {
                $topicId = (int) $row->topic_id;
                $topics[$topicId] ??= ['subject_id' => $subjectId, 'attempts' => 0, 'correct' => 0];
                $topics[$topicId]['attempts'] += (int) $row->attempts;
                $topics[$topicId]['correct'] += (int) $row->correct;
            }
        }

        return ['topics' => $topics, 'subjects' => $subjects];
    }

    /**
     * How many topics each of these students has mastered — the bulk form of accuracyFor()/isMastered(), for the
     * readiness score of a whole roster: two grouped queries however many students there are.
     *
     * @param  array<int, int>  $userIds
     * @return array<int, int> student id => topics mastered (only students with at least one)
     */
    public function masteredTopicCounts(array $userIds): array
    {
        if ($userIds === []) {
            return [];
        }

        $since = now()->subDays($this->windowDays());

        $practice = CorePracticeAnswer::query()
            ->whereIn('user_id', $userIds)->where('created_at', '>=', $since)->whereNotNull('topic_id')
            ->selectRaw('user_id, topic_id, count(*) as attempts, sum(case when is_correct then 1 else 0 end) as correct')
            ->groupBy('user_id', 'topic_id')->get();

        $tests = CoreTestResponse::query()
            ->join('core_test_sessions', 'core_test_sessions.id', '=', 'core_test_responses.core_test_session_id')
            ->join('core_questions', 'core_questions.id', '=', 'core_test_responses.core_question_id')
            ->whereIn('core_test_sessions.user_id', $userIds)
            ->where('core_test_sessions.status', CoreTestSession::STATUS_COMPLETED)
            ->where('core_test_sessions.completed_at', '>=', $since)
            ->whereNotNull('core_test_responses.is_correct')->whereNotNull('core_questions.topic_id')
            ->selectRaw('core_test_sessions.user_id as user_id, core_questions.topic_id as topic_id, count(*) as attempts, sum(case when core_test_responses.is_correct then 1 else 0 end) as correct')
            ->groupBy('core_test_sessions.user_id', 'core_questions.topic_id')->get();

        $byTopic = [];
        foreach ($practice->concat($tests) as $row) {
            $cell = &$byTopic[(int) $row->user_id][(int) $row->topic_id];
            $cell['attempts'] = ($cell['attempts'] ?? 0) + (int) $row->attempts;
            $cell['correct'] = ($cell['correct'] ?? 0) + (int) $row->correct;
            unset($cell);
        }

        $mastered = [];
        foreach ($byTopic as $userId => $topics) {
            $count = count(array_filter($topics, fn (array $t) => $this->isMastered($t['attempts'], $t['correct'])));
            if ($count > 0) {
                $mastered[$userId] = $count;
            }
        }

        return $mastered;
    }

    /**
     * Attempts and correct answers per student per subject — the bulk form behind a roster's "weakest subject".
     * Two grouped queries however many students.
     *
     * @param  array<int, int>  $userIds
     * @return array<int, array<int, array{attempts: int, correct: int}>> student id => subject id => stats
     */
    public function subjectStatsFor(array $userIds): array
    {
        if ($userIds === []) {
            return [];
        }

        $since = now()->subDays($this->windowDays());

        $practice = CorePracticeAnswer::query()
            ->whereIn('user_id', $userIds)->where('created_at', '>=', $since)
            ->selectRaw('user_id, subject_id, count(*) as attempts, sum(case when is_correct then 1 else 0 end) as correct')
            ->groupBy('user_id', 'subject_id')->get();

        $tests = CoreTestResponse::query()
            ->join('core_test_sessions', 'core_test_sessions.id', '=', 'core_test_responses.core_test_session_id')
            ->join('core_questions', 'core_questions.id', '=', 'core_test_responses.core_question_id')
            ->whereIn('core_test_sessions.user_id', $userIds)
            ->where('core_test_sessions.status', CoreTestSession::STATUS_COMPLETED)
            ->where('core_test_sessions.completed_at', '>=', $since)
            ->whereNotNull('core_test_responses.is_correct')
            ->selectRaw('core_test_sessions.user_id as user_id, core_questions.subject_id as subject_id, count(*) as attempts, sum(case when core_test_responses.is_correct then 1 else 0 end) as correct')
            ->groupBy('core_test_sessions.user_id', 'core_questions.subject_id')->get();

        $stats = [];
        foreach ($practice->concat($tests) as $row) {
            $cell = &$stats[(int) $row->user_id][(int) $row->subject_id];
            $cell['attempts'] = ($cell['attempts'] ?? 0) + (int) $row->attempts;
            $cell['correct'] = ($cell['correct'] ?? 0) + (int) $row->correct;
            unset($cell);
        }

        return $stats;
    }

    /**
     * Topics that have at least one published practice question, per branch family — what "covering the syllabus"
     * is measured against (a topic nobody has written questions for yet cannot be held against a student).
     *
     * @param  array<int, string>  $disciplines
     * @return array<string, int>
     */
    public function publishedTopicCounts(array $disciplines): array
    {
        if ($disciplines === []) {
            return [];
        }

        return CoreQuestion::query()->forPractice()->whereIn('discipline_code', $disciplines)->whereNotNull('topic_id')
            ->selectRaw('discipline_code, count(distinct topic_id) as n')->groupBy('discipline_code')
            ->pluck('n', 'discipline_code')->map(fn ($n) => (int) $n)->all();
    }

    /** Whether a topic counts as "known": enough attempts, and a good enough share right. */
    public function isMastered(int $attempts, int $correct): bool
    {
        $rules = config('core_prep.mastery');

        return $attempts >= $rules['min_attempts'] && ($correct / max(1, $attempts)) * 100 >= $rules['accuracy_percent'];
    }

    /**
     * The student's picture for their Core Prep home: per-subject coverage and accuracy, weakest topics,
     * mastery counts.
     *
     * @return array<string, mixed>
     */
    public function overview(int $userId, string $discipline, ?string $branchCode = null, bool $forBranch = false): array
    {
        $accuracy = $this->accuracyFor($userId);

        // `$forBranch`: a student's own view, narrowed to the subjects their programme is offered (shared + their specialisations).
        $visible = $forBranch ? CoreSubject::idsVisibleTo($discipline, $branchCode) : null;

        $published = CoreQuestion::query()->forPractice()->where('discipline_code', $discipline)
            ->when($visible !== null, fn ($q) => $q->whereIn('subject_id', $visible))
            ->selectRaw('subject_id, count(*) as n')->groupBy('subject_id')->pluck('n', 'subject_id');

        $topicsBySubject = CoreTopic::query()->join('core_subjects', 'core_subjects.id', '=', 'core_topics.subject_id')
            ->where('core_subjects.discipline_code', $discipline)->where('core_topics.is_active', true)
            ->when($visible !== null, fn ($q) => $q->whereIn('core_subjects.id', $visible))
            ->get(['core_topics.id', 'core_topics.subject_id', 'core_topics.name'])->groupBy('subject_id');

        $subjects = [];
        $mastered = 0;
        $topicTotal = 0;

        foreach (CoreSubject::query()->where('discipline_code', $discipline)->where('is_active', true)->when($visible !== null, fn ($q) => $q->whereIn('id', $visible))->orderBy('sort')->get() as $subject) {
            $stats = $accuracy['subjects'][$subject->id] ?? ['attempts' => 0, 'correct' => 0];
            $topics = $topicsBySubject[$subject->id] ?? collect();
            $subjectMastered = $topics->filter(fn ($t) => isset($accuracy['topics'][$t->id]) && $this->isMastered($accuracy['topics'][$t->id]['attempts'], $accuracy['topics'][$t->id]['correct']))->count();

            $mastered += $subjectMastered;
            $topicTotal += $topics->count();

            // A subject nobody has written practice questions for yet is not offered.
            if (($published[$subject->id] ?? 0) === 0) {
                continue;
            }

            $subjects[] = [
                'id' => $subject->id, 'code' => $subject->code, 'name' => $subject->name,
                'questions' => (int) $published[$subject->id],
                'attempts' => $stats['attempts'],
                'accuracy' => $stats['attempts'] > 0 ? round($stats['correct'] / $stats['attempts'] * 100) : null,
                'topics_total' => $topics->count(),
                'topics_mastered' => $subjectMastered,
            ];
        }

        $weak = [];
        $minAttempts = (int) config('core_prep.mastery.weak_min_attempts', 3);
        foreach ($accuracy['topics'] as $topicId => $stats) {
            if ($stats['attempts'] >= $minAttempts && $stats['correct'] / $stats['attempts'] < 0.6) {
                $weak[$topicId] = $stats;
            }
        }
        uasort($weak, fn ($a, $b) => ($a['correct'] / $a['attempts']) <=> ($b['correct'] / $b['attempts']));
        $weak = array_slice($weak, 0, 5, true);

        $names = CoreTopic::query()->whereIn('core_topics.id', array_keys($weak))->join('core_subjects', 'core_subjects.id', '=', 'core_topics.subject_id')
            ->get(['core_topics.id', 'core_topics.name', 'core_subjects.name as subject_name', 'core_topics.subject_id'])->keyBy('id');

        $attempts = array_sum(array_column($accuracy['subjects'], 'attempts'));
        $correct = array_sum(array_column($accuracy['subjects'], 'correct'));

        return [
            'summary' => [
                'answered' => $attempts,
                'accuracy' => $attempts > 0 ? round($correct / $attempts * 100) : null,
                'topics_mastered' => $mastered,
                'topics_total' => $topicTotal,
            ],
            'subjects' => $subjects,
            'weakest_topics' => collect($weak)->map(fn ($stats, $topicId) => [
                'topic_id' => (int) $topicId, 'topic' => $names[$topicId]->name ?? '', 'subject_id' => $stats['subject_id'], 'subject' => $names[$topicId]->subject_name ?? '',
                'attempts' => $stats['attempts'], 'accuracy' => round($stats['correct'] / $stats['attempts'] * 100),
            ])->values()->all(),
        ];
    }
}
