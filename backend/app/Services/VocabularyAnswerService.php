<?php

namespace App\Services;

use App\Models\User;
use App\Models\VocabularyAnswer;
use App\Models\VocabularyAttempt;
use App\Models\VocabularyWord;
use App\Models\VocabularyWordProgress;
use App\Support\VocabularyText;
use Illuminate\Support\Facades\DB;

/**
 * Grades ONE question at a time and tells the student the answer only after
 * they have committed to theirs. Each answer is recorded immediately, so:
 *
 *  - progress is never lost if the student leaves mid-session,
 *  - the same question can't be answered twice (a repeat returns the stored
 *    result, which also makes a retried request after a network blip safe),
 *  - the answer key never reaches the browser ahead of time.
 *
 * It also owns the two side effects that make the trainer remember: moving the
 * word through the spaced-repetition boxes, and keeping a word the student
 * missed in an AI quiz so it comes back for review.
 */
class VocabularyAnswerService
{
    /** A student can hold at most this many private (AI-quiz) words. */
    public const MAX_PRIVATE_WORDS = 300;

    public function __construct(
        private readonly VocabularySrsService $srs,
        private readonly VocabularyProgressService $progress,
    ) {}

    /** @return array<string, mixed> the result of this answer, plus `complete` (and `summary`) when it was the last question */
    public function answer(User $user, VocabularyAttempt $attempt, int $index, mixed $response, ?int $responseMs = null): array
    {
        return DB::transaction(function () use ($user, $attempt, $index, $response, $responseMs) {
            $locked = VocabularyAttempt::whereKey($attempt->id)->lockForUpdate()->firstOrFail();
            $questions = $locked->questions ?? [];

            abort_unless(isset($questions[$index]), 422, 'That question does not exist.');
            $question = $questions[$index];

            $existing = VocabularyAnswer::where('vocabulary_attempt_id', $locked->id)->where('question_index', $index)->first();
            if ($existing) {
                return $this->envelope($locked, $question, $existing, null);
            }

            [$isCorrect, , $stored] = $this->grade($question, $response);

            $wordId = $question['word_id'] ?? null;
            $change = null;

            if ($wordId === null && ! $isCorrect && $locked->kind === VocabularyAttempt::KIND_CUSTOM) {
                // A word missed in an AI quiz: keep it, so it comes back for review.
                $wordId = $this->rememberAiWord($user, $locked, $question);
            }
            if ($wordId !== null && VocabularyWord::whereKey($wordId)->exists()) {
                $change = $this->srs->record($user->id, $wordId, $isCorrect, primary: ! ($question['is_echo'] ?? false));
            } else {
                $wordId = null;
            }

            $answer = VocabularyAnswer::create([
                'user_id' => $user->id,
                'vocabulary_attempt_id' => $locked->id,
                'question_index' => $index,
                'vocabulary_word_id' => $wordId,
                'type' => $question['type'] ?? 'cloze',
                'response' => $stored,
                'is_correct' => $isCorrect,
                'box_before' => $change['box_before'] ?? null,
                'box_after' => $change ? $change['box_after'] : null,
                'response_ms' => $responseMs !== null ? max(0, min($responseMs, 600000)) : null,
            ]);

            $this->finishIfComplete($locked, count($questions));

            return $this->envelope($locked->refresh(), $question, $answer, $change['progress'] ?? null);
        });
    }

    /**
     * The session as the browser needs it to start, or to pick up where the
     * student left off: public questions, results for those already answered,
     * and — for a session that hasn't started — the "meet the word" cards.
     *
     * @return array<string, mixed>
     */
    public function present(VocabularyAttempt $attempt): array
    {
        $questions = $attempt->questions ?? [];
        $answers = $attempt->answerRecords()->orderBy('question_index')->get()->keyBy('question_index');
        $progressByWord = VocabularyWordProgress::where('user_id', $attempt->user_id)
            ->whereIn('vocabulary_word_id', $answers->pluck('vocabulary_word_id')->filter()->unique())
            ->get()->keyBy('vocabulary_word_id');

        $results = $answers->map(fn (VocabularyAnswer $a) => $this->result(
            $questions[$a->question_index],
            $a,
            $progressByWord->get($a->vocabulary_word_id)
        ))->values()->all();

        $meta = $attempt->meta ?? [];
        $complete = $attempt->isSubmitted();

        return [
            'attempt_id' => $attempt->id,
            'kind' => $attempt->kind,
            'deck' => $attempt->deck,
            'title' => $meta['title'] ?? $attempt->topic,
            'topic' => $attempt->topic,
            'difficulty' => $attempt->difficulty,
            'total' => count($questions),
            'new_count' => (int) ($meta['new_count'] ?? 0),
            'review_count' => (int) ($meta['review_count'] ?? 0),
            'practice' => (bool) ($meta['practice'] ?? false),
            'retry' => (bool) ($meta['retry'] ?? false),
            'cards' => $answers->isEmpty() ? $this->introCards($questions) : [],
            'questions' => $attempt->questionsWithoutAnswers(),
            'results' => $results,
            'answered' => count($results),
            'complete' => $complete,
            'summary' => $complete ? $this->summary($attempt) : null,
        ];
    }

    /**
     * How a finished session went — the end-of-sprint screen.
     *
     * @return array<string, mixed>
     */
    public function summary(VocabularyAttempt $attempt): array
    {
        $questions = $attempt->questions ?? [];
        $answers = $attempt->answerRecords()->orderBy('question_index')->get();
        $isEcho = fn (VocabularyAnswer $a): bool => (bool) ($questions[$a->question_index]['is_echo'] ?? false);

        $primary = $answers->reject($isEcho);
        $correct = $answers->where('is_correct', true)->count();
        $total = max(1, count($questions));

        $milliseconds = $answers->sum('response_ms');

        $missed = $answers->where('is_correct', false)
            ->map(fn (VocabularyAnswer $a) => $this->card($questions[$a->question_index]))
            ->unique('word')
            ->values()
            ->all();

        $movedUp = $primary->filter(fn (VocabularyAnswer $a) => $a->is_correct && $a->box_after !== null && $a->box_after > ($a->box_before ?? 0));
        $masteredNow = $primary->filter(fn (VocabularyAnswer $a) => $a->box_after !== null && ($a->box_before ?? 0) < VocabularyWordProgress::MASTERED_BOX && $a->box_after >= VocabularyWordProgress::MASTERED_BOX);

        $answeredToday = $this->progress->answeredToday($attempt->user_id);

        return [
            'score' => (int) round(100 * $correct / $total),
            'correct' => $correct,
            'total' => count($questions),
            'duration_seconds' => $milliseconds > 0 ? (int) round($milliseconds / 1000) : null,
            'new_words_met' => collect($questions)->filter(fn ($q) => ($q['is_new'] ?? false) && ! ($q['is_echo'] ?? false))->count(),
            'words_moved_up' => $movedUp->count(),
            'mastered_now' => $masteredNow->map(fn (VocabularyAnswer $a) => $this->card($questions[$a->question_index]))->values()->all(),
            'missed' => $missed,
            'daily_goal' => [
                'answered' => $answeredToday,
                'goal' => VocabularyProgressService::DAILY_GOAL,
                'reached' => $answeredToday >= VocabularyProgressService::DAILY_GOAL,
            ],
            'streak_days' => $this->progress->streakDays($attempt->user_id),
            'can_retry_missed' => $attempt->kind !== VocabularyAttempt::KIND_CUSTOM && collect($missed)->isNotEmpty(),
        ];
    }

    /**
     * What the student sees after answering one question.
     *
     * @return array<string, mixed>
     */
    public function result(array $question, VocabularyAnswer $answer, ?VocabularyWordProgress $progress = null): array
    {
        $type = $question['type'] ?? 'cloze';
        $isRecall = $type === 'recall';
        $isEcho = (bool) ($question['is_echo'] ?? false);
        $close = $isRecall && ! $answer->is_correct && VocabularyText::compare((string) $answer->response, $question['answer']) === 'close';

        $boxAfter = $answer->box_after;
        $boxBefore = $answer->box_before;

        return [
            'index' => $answer->question_index,
            'type' => $type,
            'is_correct' => $answer->is_correct,
            'close' => $close,
            'selected_index' => $isRecall ? null : (int) $answer->response,
            'response' => $isRecall ? $answer->response : null,
            'correct_index' => $isRecall ? null : (int) $question['correct_index'],
            'correct_answer' => $question['answer'] ?? ($question['options'][$question['correct_index']] ?? null),
            'explanation' => $question['explanation'] ?? '',
            'card' => $this->card($question),
            'progress' => $boxAfter === null ? null : [
                'box_before' => $boxBefore,
                'box_after' => $boxAfter,
                'status' => VocabularyWordProgress::statusForBox($boxAfter),
                'moved_up' => ! $isEcho && $answer->is_correct && $boxAfter > ($boxBefore ?? 0),
                'became_mastered' => ! $isEcho && ($boxBefore ?? 0) < VocabularyWordProgress::MASTERED_BOX && $boxAfter >= VocabularyWordProgress::MASTERED_BOX,
                'next_review' => $progress ? VocabularySrsService::describeDue($progress->due_on) : null,
            ],
        ];
    }

    /** The word-card part of a stored question — what the "meet the word" step and the feedback panel show. */
    private function card(array $question): array
    {
        return [
            'word_id' => $question['word_id'] ?? null,
            'word' => $question['word'],
            'part_of_speech' => $question['part_of_speech'] ?? null,
            'meaning' => $question['meaning'] ?? '',
            'example' => $question['example'] ?? '',
            'synonyms' => array_values($question['synonyms'] ?? []),
            'note' => $question['note'] ?? null,
        ];
    }

    /**
     * Cards for the words this session introduces, in the order the deck lists
     * them (the questions themselves are shuffled).
     *
     * @return array<int, array<string, mixed>>
     */
    private function introCards(array $questions): array
    {
        return collect($questions)
            ->filter(fn (array $q) => ($q['is_new'] ?? false) && ! ($q['is_echo'] ?? false))
            ->sortBy(fn (array $q) => $q['intro_order'] ?? 0)
            ->map(fn (array $q) => $this->card($q))
            ->values()
            ->all();
    }

    /**
     * @return array{0: bool, 1: bool, 2: string} [is correct, is a near-miss typo, what to store as the response]
     */
    private function grade(array $question, mixed $response): array
    {
        if (($question['type'] ?? 'cloze') === 'recall') {
            $typed = is_string($response) ? trim($response) : '';
            abort_if($typed === '', 422, 'Type your answer first.');

            $comparison = VocabularyText::compare($typed, $question['answer']);

            return [$comparison === 'exact', $comparison === 'close', mb_substr($typed, 0, 120)];
        }

        $isIndex = is_int($response) || (is_string($response) && ctype_digit($response));
        abort_unless($isIndex, 422, 'Choose one of the answers.');

        $selected = (int) $response;
        abort_unless($selected >= 0 && $selected < count($question['options'] ?? []), 422, 'Choose one of the answers.');

        return [$selected === (int) $question['correct_index'], false, (string) $selected];
    }

    private function envelope(VocabularyAttempt $attempt, array $question, VocabularyAnswer $answer, ?VocabularyWordProgress $progress): array
    {
        if ($progress === null && $answer->vocabulary_word_id !== null) {
            $progress = VocabularyWordProgress::where('user_id', $attempt->user_id)->where('vocabulary_word_id', $answer->vocabulary_word_id)->first();
        }

        $complete = $attempt->isSubmitted();

        return $this->result($question, $answer, $progress) + [
            'answered' => $attempt->answerRecords()->count(),
            'total' => $attempt->questionCount(),
            'complete' => $complete,
            'summary' => $complete ? $this->summary($attempt) : null,
        ];
    }

    private function finishIfComplete(VocabularyAttempt $attempt, int $total): void
    {
        $answers = VocabularyAnswer::where('vocabulary_attempt_id', $attempt->id)->get(['is_correct']);
        if ($answers->count() < $total || $attempt->isSubmitted()) {
            return;
        }

        $score = (int) round(100 * $answers->where('is_correct', true)->count() / max(1, $total));

        $attempt->update([
            'score' => $score,
            'passed' => $score >= VocabularyAttempt::PASS_THRESHOLD,
            'submitted_at' => now(),
        ]);
    }

    /**
     * Keep a word the student missed in an AI quiz as one of their private
     * words. If the word is already in the library (or already theirs) that
     * one is reused instead — never a duplicate.
     */
    private function rememberAiWord(User $user, VocabularyAttempt $attempt, array $question): ?int
    {
        $text = trim((string) ($question['word'] ?? ''));
        if ($text === '' || mb_strlen($text) > 80) {
            return null;
        }

        $existing = VocabularyWord::visibleTo($user->id)->whereRaw('lower(word) = ?', [mb_strtolower($text)])->first();
        if ($existing) {
            return $existing->id;
        }

        if (VocabularyWord::where('user_id', $user->id)->where('source', VocabularyWord::SOURCE_AI)->count() >= self::MAX_PRIVATE_WORDS) {
            return null;
        }

        // A quiz stored before words carried a meaning and an example has neither: fall back to what it does have.
        $meaning = trim((string) ($question['meaning'] ?? $question['explanation'] ?? ''));
        $example = trim((string) ($question['example'] ?? ''));
        if ($example === '' && isset($question['sentence'])) {
            $example = str_replace(VocabularyText::BLANK, $text, (string) $question['sentence']);
        }
        if ($meaning === '' || $example === '') {
            return null;
        }

        $level = in_array($attempt->difficulty, ['beginner', 'intermediate', 'advanced'], true) ? $attempt->difficulty : 'intermediate';

        return VocabularyWord::create([
            'user_id' => $user->id,
            'source' => VocabularyWord::SOURCE_AI,
            'deck' => null,
            'word' => $text,
            'part_of_speech' => mb_substr((string) (($question['part_of_speech'] ?? '') ?: 'word'), 0, 24),
            'level' => $level,
            'meaning' => mb_substr($meaning, 0, 255),
            'example' => mb_substr($example, 0, 300),
            'synonyms' => [],
            'is_active' => true,
        ])->id;
    }
}
