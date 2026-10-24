<?php

namespace App\Services\Core;

use App\Models\CorePracticeAnswer;
use App\Models\CoreQuestion;
use App\Models\CoreSubject;
use App\Models\User;
use App\Services\PlanGate;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Untimed Core Prep practice: serve a question, take the answer, show the key and the worked solution.
 *
 * Practice only ever serves PUBLISHED questions whose `usage` allows it, from the student's own branch
 * family — so a test-only question can never be revealed by practising. The question is sent WITHOUT its
 * key or explanation; both come back only in the answer response.
 */
class CorePracticeService
{
    public function __construct(private readonly PlanGate $gate, private readonly CoreMasteryService $mastery) {}

    /**
     * The next question for a student.
     *
     *  new    — something they have not answered yet (falls back to the least recently seen when they have done them all)
     *  weak   — from the topics they get wrong most often
     *  review — a question they last got wrong
     *
     * @param  array{mode?: string, subject_id?: int|null, topic_id?: int|null, difficulty?: string|null, exclude?: int|null}  $filters
     */
    public function next(User $user, array $filters = []): ?CoreQuestion
    {
        $base = CoreQuestion::query()->forPractice()
            ->where('discipline_code', $user->discipline)
            // Only the subjects this student's own programme is offered (a BA English student is never served Sanskrit grammar).
            ->whereIn('subject_id', CoreSubject::idsVisibleTo((string) $user->discipline, $user->branch_code))
            ->when($filters['subject_id'] ?? null, fn ($q, $v) => $q->where('subject_id', $v))
            ->when($filters['topic_id'] ?? null, fn ($q, $v) => $q->where('topic_id', $v))
            ->when($filters['difficulty'] ?? null, fn ($q, $v) => $q->where('difficulty', $v))
            ->when($filters['exclude'] ?? null, fn ($q, $v) => $q->where('core_questions.id', '!=', $v))
            ->with(['subject:id,name', 'topic:id,name']);

        $mode = $filters['mode'] ?? 'new';

        if ($mode === 'review') {
            // Last answer to the question was wrong: nothing answered it correctly since.
            $wrong = (clone $base)->whereExists(function ($q) use ($user) {
                $q->select(DB::raw(1))->from('core_practice_answers as a')
                    ->whereColumn('a.core_question_id', 'core_questions.id')->where('a.user_id', $user->id)->where('a.is_correct', false)
                    ->whereNotExists(fn ($later) => $later->select(DB::raw(1))->from('core_practice_answers as b')
                        ->whereColumn('b.core_question_id', 'a.core_question_id')->where('b.user_id', $user->id)->whereColumn('b.id', '>', 'a.id'));
            })->inRandomOrder()->first();

            return $wrong;
        }

        if ($mode === 'weak') {
            $weak = $this->weakTopicIds($user);

            if ($weak !== []) {
                $picked = $this->unseenFirst((clone $base)->whereIn('topic_id', $weak), $user);

                if ($picked !== null) {
                    return $picked;
                }
            }
        }

        return $this->unseenFirst($base, $user);
    }

    /**
     * Records a practice answer and returns the verdict WITH the key and explanation.
     *
     * @param  mixed  $selected
     * @return array<string, mixed>
     */
    public function answer(User $user, CoreQuestion $question, mixed $selected, mixed $numeric, ?int $timeTaken, ?int $sittingId = null): array
    {
        if (! $question->isPublished()
            || ! in_array($question->usage, [CoreQuestion::USAGE_PRACTICE, CoreQuestion::USAGE_BOTH], true)
            || $question->discipline_code !== $user->discipline
            || ! in_array((int) $question->subject_id, CoreSubject::idsVisibleTo((string) $user->discipline, $user->branch_code), true)) {
            abort(404);
        }

        $this->gate->assertCorePracticeWithinLimit($user);

        [$chosen, $value] = CoreGrader::sanitise($question, $selected, $numeric);
        $verdict = CoreGrader::evaluate($question, $chosen, $value);

        if (! $verdict['answered']) {
            throw ValidationException::withMessages(['answer' => [$question->isNumeric() ? 'Enter a number.' : 'Choose an answer.']]);
        }

        DB::transaction(function () use ($user, $question, $chosen, $value, $verdict, $timeTaken, $sittingId) {
            CorePracticeAnswer::create([
                'user_id' => $user->id, 'core_question_id' => $question->id, 'subject_id' => $question->subject_id, 'topic_id' => $question->topic_id,
                'selected' => $chosen, 'numeric_value' => $value, 'is_correct' => $verdict['correct'],
                'time_taken_seconds' => $timeTaken !== null ? min(max($timeTaken, 0), 7200) : null,
                'study_sitting_id' => $sittingId,
            ]);
            // The key locks as soon as anyone answers (see CoreQuestion::isKeyLocked).
            CoreQuestion::whereKey($question->id)->increment('attempts_count');
        });

        return [
            'correct' => $verdict['correct'],
            'key' => $question->isNumeric()
                ? ['min' => $question->numeric_min, 'max' => $question->numeric_max, 'unit' => $question->numeric_unit]
                : ['correct' => $question->correct],
            'explanation' => $question->explanation,
            'selected' => $chosen,
            'numeric_value' => $value,
        ];
    }

    /** Student-safe view of a question: everything needed to answer it, nothing that gives the answer away. @return array<string, mixed> */
    public function present(CoreQuestion $question, bool $shuffle = true): array
    {
        $options = $question->options ?? [];
        if ($shuffle && $options !== []) {
            shuffle($options);
        }

        return [
            'id' => $question->id,
            'type' => $question->type,
            'stem' => $question->stem,
            'image_url' => $question->imageUrl(),
            'options' => array_map(fn (array $o) => ['id' => $o['id'], 'text' => $o['text']], $options),
            'numeric_unit' => $question->numeric_unit,
            'marks' => $question->marks,
            'difficulty' => $question->difficulty,
            'subject' => $question->relationLoaded('subject') ? $question->subject?->name : null,
            'topic' => $question->relationLoaded('topic') ? $question->topic?->name : null,
        ];
    }

    /** @return array<int, int> topic ids the student gets wrong most often */
    private function weakTopicIds(User $user): array
    {
        $accuracy = $this->mastery->accuracyFor($user->id)['topics'];
        $min = (int) config('core_prep.mastery.weak_min_attempts', 3);

        $weak = array_filter($accuracy, fn ($s) => $s['attempts'] >= $min && $s['correct'] / $s['attempts'] < 0.6);
        uasort($weak, fn ($a, $b) => ($a['correct'] / $a['attempts']) <=> ($b['correct'] / $b['attempts']));

        return array_slice(array_keys($weak), 0, 5);
    }

    /** A question not answered yet, at random; when everything has been seen, the one seen longest ago. */
    private function unseenFirst($query, User $user): ?CoreQuestion
    {
        $unseen = (clone $query)->whereNotExists(fn ($q) => $q->select(DB::raw(1))->from('core_practice_answers as a')
            ->whereColumn('a.core_question_id', 'core_questions.id')->where('a.user_id', $user->id))
            ->inRandomOrder()->first();

        if ($unseen !== null) {
            return $unseen;
        }

        return (clone $query)
            ->leftJoin(DB::raw("(select core_question_id, max(created_at) as seen_at from core_practice_answers where user_id = {$user->id} group by core_question_id) as seen"), 'seen.core_question_id', '=', 'core_questions.id')
            ->orderBy('seen.seen_at')->select('core_questions.*')->first();
    }
}
