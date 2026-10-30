<?php

namespace App\Services\Interviews;

use App\Models\StudyAttempt;
use App\Models\User;
use App\Services\Mock\MockInterviewCatalog;
use Illuminate\Support\Collection;

/**
 * What the student has scored on every set they have sat, from the permanent attempt ledger (study_attempts): the numbers behind "your history on
 * this set", the progress page, and the card on each set. Reads only; StudyAttemptRecorder is the writer.
 */
class StudyHistory
{
    public function __construct(private readonly MockInterviewCatalog $catalog) {}

    /**
     * Where one sitting stands among the student's sittings of the same set.
     *
     * @return array<string, mixed>
     */
    public function summaryFor(StudyAttempt $attempt): array
    {
        $history = $this->ofSet($attempt->user_id, $attempt->round_id);
        $index = $history->search(fn (StudyAttempt $a) => $a->id === $attempt->id);
        $index = $index === false ? $history->count() - 1 : $index;
        $earlier = $history->take($index);
        $previous = $earlier->last();

        return [
            'id' => $attempt->id,
            'number' => $index + 1,
            'attempts' => $history->count(),
            'previous_score' => $previous?->score,
            'delta' => $previous !== null ? $attempt->score - $previous->score : null,
            'best_score' => (int) $history->max('score'),
            // The best so far, this one included: a first sitting is "your best" only in a trivial sense, so it is not announced as a record.
            'is_personal_best' => $earlier->isNotEmpty() && $attempt->score > (int) $earlier->max('score'),
            'history' => $history->map(fn (StudyAttempt $a) => $this->point($a))->values()->all(),
        ];
    }

    /**
     * Every exam the student has sat, set by set, with the newest sittings first inside each.
     *
     * @return array<string, mixed>
     */
    public function overview(User $user): array
    {
        $attempts = StudyAttempt::where('user_id', $user->id)
            ->orderBy('completed_at')->orderBy('id')
            ->get(['id', 'stack_key', 'exam_name', 'round_id', 'set_number', 'set_title', 'score', 'question_count', 'answered_count', 'green_count', 'yellow_count', 'red_count', 'duration_seconds', 'completed_at']);

        $exams = [];

        foreach ($attempts->groupBy('stack_key') as $stackKey => $ofExam) {
            $sets = [];

            foreach ($ofExam->groupBy('round_id') as $roundId => $ofSet) {
                /** @var StudyAttempt $last */
                $last = $ofSet->last();
                $previous = $ofSet->count() > 1 ? $ofSet[$ofSet->count() - 2] : null;

                $sets[] = [
                    'round_id' => (string) $roundId,
                    'set_number' => $last->set_number,
                    'title' => $last->set_title,
                    'attempts' => $ofSet->count(),
                    'best_score' => (int) $ofSet->max('score'),
                    'last_score' => $last->score,
                    'previous_score' => $previous?->score,
                    'delta' => $previous !== null ? $last->score - $previous->score : null,
                    'last_at' => $last->completed_at?->toIso8601String(),
                    'history' => $ofSet->map(fn (StudyAttempt $a) => $this->point($a))->values()->all(),
                ];
            }

            usort($sets, fn ($a, $b) => $a['set_number'] <=> $b['set_number']);
            $latest = array_column($sets, 'last_score');

            $exams[] = [
                'stack_key' => (string) $stackKey,
                'name' => $ofExam->last()->exam_name,
                'sets_practised' => count($sets),
                'sets_total' => $this->setsTotal((string) $stackKey),
                'attempts' => $ofExam->count(),
                // The mean of each set's latest score: where the student stands now, not dragged down by how they started.
                'average_latest' => $latest === [] ? null : (int) round(array_sum($latest) / count($latest)),
                'best_score' => (int) $ofExam->max('score'),
                'last_at' => $ofExam->last()->completed_at?->toIso8601String(),
                'sets' => $sets,
            ];
        }

        usort($exams, fn ($a, $b) => strcmp((string) $b['last_at'], (string) $a['last_at']));

        return [
            'totals' => [
                'attempts' => $attempts->count(),
                'sets_practised' => array_sum(array_column($exams, 'sets_practised')),
                'questions_answered' => (int) $attempts->sum('answered_count'),
                'seconds' => (int) $attempts->sum('duration_seconds'),
            ],
            'exams' => $exams,
        ];
    }

    /** The newest sitting of every set a student has sat, keyed by round id: what the card on each set shows. @return array<string, array<string, mixed>> */
    public function byRound(User $user): array
    {
        $out = [];

        foreach (StudyAttempt::where('user_id', $user->id)->orderBy('completed_at')->orderBy('id')->get(['round_id', 'score', 'completed_at']) as $a) {
            $row = $out[$a->round_id] ?? ['attempts' => 0, 'best_score' => 0, 'last_score' => null, 'previous_score' => null];
            $row['previous_score'] = $row['last_score'];
            $row['last_score'] = $a->score;
            $row['attempts']++;
            $row['best_score'] = max($row['best_score'], $a->score);
            $out[$a->round_id] = $row;
        }

        return $out;
    }

    /** @return Collection<int, StudyAttempt> oldest first */
    private function ofSet(int $userId, string $roundId): Collection
    {
        return StudyAttempt::where('user_id', $userId)->where('round_id', $roundId)
            ->orderBy('completed_at')->orderBy('id')
            ->get(['id', 'user_id', 'score', 'completed_at', 'answered_count', 'question_count']);
    }

    /** @return array<string, mixed> */
    private function point(StudyAttempt $a): array
    {
        return [
            'id' => $a->id,
            'score' => $a->score,
            'completed_at' => $a->completed_at?->toIso8601String(),
            'partial' => $a->answered_count < $a->question_count,
            'answered' => $a->answered_count,
            'total' => $a->question_count,
            'duration_seconds' => $a->duration_seconds,
        ];
    }

    private function setsTotal(string $stackKey): ?int
    {
        $found = $this->catalog->stack($stackKey);

        return $found === null ? null : count($found['stack']['rounds'] ?? []);
    }
}
