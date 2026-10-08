<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * One practice session. `questions` holds the full answer key from the moment
 * the session is created — the browser only ever receives
 * questionsWithoutAnswers(), and learns a question's answer only by committing
 * its own answer (VocabularyAnswerService).
 *
 * kind: daily (smart mix of due reviews and new words) · deck (one deck) ·
 * weak (words the student keeps missing) · custom (the AI quiz on any topic).
 * Rows from before the word bank existed were all AI quizzes, which is why
 * 'custom' is the column default.
 *
 * `answers` is only used by the original batch submit() endpoint; the
 * per-question flow records answers in vocabulary_answers instead.
 */
class VocabularyAttempt extends Model
{
    public const PASS_THRESHOLD = 60;

    public const KIND_DAILY = 'daily';

    public const KIND_DECK = 'deck';

    public const KIND_WEAK = 'weak';

    public const KIND_CUSTOM = 'custom';

    public const KINDS = [self::KIND_DAILY, self::KIND_DECK, self::KIND_WEAK, self::KIND_CUSTOM];

    protected $fillable = [
        'user_id',
        'kind',
        'deck',
        'topic',
        'difficulty',
        'questions',
        'meta',
        'answers',
        'score',
        'passed',
        'submitted_at',
    ];

    protected function casts(): array
    {
        return [
            'questions' => 'array',
            'meta' => 'array',
            'answers' => 'array',
            'score' => 'integer',
            'passed' => 'boolean',
            'submitted_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function answerRecords(): HasMany
    {
        return $this->hasMany(VocabularyAnswer::class);
    }

    public function isSubmitted(): bool
    {
        return $this->submitted_at !== null;
    }

    public function questionCount(): int
    {
        return count($this->questions ?? []);
    }

    /**
     * What the browser is allowed to see before answering. The word itself is
     * shown only when it IS the question (the meaning question); every other
     * type would be given away by it. correct_index, answer, meaning, example
     * and explanation never leave the server until the question is answered.
     */
    public function questionsWithoutAnswers(): array
    {
        return collect($this->questions ?? [])
            ->map(fn (array $q, int $i) => self::publicQuestion($q, $i))
            ->values()
            ->all();
    }

    public static function publicQuestion(array $q, int $index): array
    {
        $type = $q['type'] ?? 'cloze';

        $public = [
            'index' => $index,
            'type' => $type,
            'prompt' => $q['prompt'] ?? 'Choose the word that fits the sentence.',
            'part_of_speech' => $q['part_of_speech'] ?? null,
            'is_echo' => (bool) ($q['is_echo'] ?? false),
        ];

        if ($type === 'meaning') {
            $public['word'] = $q['word'];
        }
        if (isset($q['sentence'])) {
            $public['sentence'] = $q['sentence'];
        }
        if (isset($q['options'])) {
            $public['options'] = $q['options'];
        }
        if ($type === 'recall') {
            $public['hint'] = $q['hint'] ?? '';
            $public['letters'] = (int) ($q['letters'] ?? 0);
            $public['word_count'] = (int) ($q['word_count'] ?? 1);
        }

        return $public;
    }
}
