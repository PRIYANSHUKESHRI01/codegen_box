<?php

namespace App\Services;

use App\Models\User;
use App\Models\VocabularyAnswer;
use App\Models\VocabularyAttempt;
use App\Models\VocabularyWord;
use App\Models\VocabularyWordProgress;
use App\Support\VocabularyDecks;
use Illuminate\Support\Collection;
use RuntimeException;

/**
 * Decides what a practice session contains and builds its questions.
 *
 * A daily sprint is a short, bounded mix:
 *   - words that are DUE for review (oldest first — the ones closest to being
 *     forgotten), then
 *   - a few NEW words, fewer when there's a big review backlog so a student
 *     who skipped a week isn't buried.
 * Each new word is asked twice (a different angle the second time, later in the
 * session), which is how a word actually sticks on day one.
 *
 * plan() is pure selection with no side effects, so the home page can preview
 * "4 new words · 6 reviews" with exactly the logic that start() will use.
 */
class VocabularySessionService
{
    public const MAX_QUESTIONS = 12;

    public const WEAK_MAX_WORDS = 10;

    public const PRACTICE_MAX_WORDS = 10;

    /** An unfinished session younger than this is resumed instead of starting a duplicate. */
    public const RESUME_WINDOW_HOURS = 12;

    /**
     * What a session of this kind would contain right now.
     *
     * @param  Collection<int, VocabularyWord>  $pool  every word visible to the student
     * @param  Collection<int, VocabularyWordProgress>  $progress  the student's progress rows, keyed by word id
     * @return array{new: Collection<int, VocabularyWord>, review: Collection<int, VocabularyWord>, practice: bool}
     */
    public function plan(string $kind, ?string $deck, Collection $pool, Collection $progress, ?string $focusDeck = null, ?array $onlyWordIds = null): array
    {
        if ($kind === VocabularyAttempt::KIND_WEAK) {
            $weak = $pool
                ->filter(function (VocabularyWord $word) use ($progress, $onlyWordIds) {
                    if ($onlyWordIds !== null) {
                        return in_array($word->id, $onlyWordIds, true);
                    }

                    return $progress->has($word->id) && $progress[$word->id]->isWeak();
                })
                ->sortBy(fn (VocabularyWord $w) => [$this->accuracy($progress->get($w->id)), $progress->get($w->id)?->box ?? 0])
                ->take(self::WEAK_MAX_WORDS)
                ->values();

            return ['new' => collect(), 'review' => $weak, 'practice' => false];
        }

        $scope = $kind === VocabularyAttempt::KIND_DECK ? $pool->where('deck', $deck)->values() : $pool;

        $due = $scope
            ->filter(fn (VocabularyWord $w) => $progress->has($w->id) && $progress[$w->id]->isDue())
            ->sortBy(fn (VocabularyWord $w) => [
                $progress[$w->id]->due_on?->toDateString() ?? '0000-00-00',
                $progress[$w->id]->box,
                $w->id,
            ])
            ->values();

        $unseen = $scope
            ->filter(fn (VocabularyWord $w) => $w->user_id === null && ! $progress->has($w->id))
            ->sortBy(fn (VocabularyWord $w) => [
                $kind === VocabularyAttempt::KIND_DECK ? 0 : ($w->deck === $focusDeck ? 0 : 1),
                VocabularyDecks::position($w->deck),
                $w->sort_order,
                $w->id,
            ])
            ->values();

        $newTarget = $due->count() >= 10 ? 2 : ($due->count() >= 6 ? 3 : 4);
        $new = $unseen->take($newTarget)->values();
        $review = $due->take(max(0, self::MAX_QUESTIONS - 2 * $new->count()))->values();

        if ($new->isEmpty() && $review->isEmpty()) {
            // Nothing due and nothing new: offer free practice on what the student already has, weakest first.
            // Early practice never moves a word up a box (see VocabularySrsService), so this is safe, just not "progress".
            $practice = $scope
                ->filter(fn (VocabularyWord $w) => $progress->has($w->id))
                ->sortBy(fn (VocabularyWord $w) => [$progress[$w->id]->box, $progress[$w->id]->last_seen_at?->timestamp ?? 0])
                ->take(self::PRACTICE_MAX_WORDS)
                ->values();

            return ['new' => collect(), 'review' => $practice, 'practice' => $practice->isNotEmpty()];
        }

        return ['new' => $new, 'review' => $review, 'practice' => false];
    }

    /**
     * Start (or resume) a session. Throws RuntimeException with a student-facing
     * message when there is nothing to practise.
     */
    public function start(User $user, string $kind, ?string $deck = null, ?VocabularyAttempt $fromAttempt = null, ?int $seed = null): VocabularyAttempt
    {
        if ($kind === VocabularyAttempt::KIND_DECK && ! VocabularyDecks::exists($deck)) {
            throw new RuntimeException('That word deck does not exist.');
        }

        $deck = $kind === VocabularyAttempt::KIND_DECK ? $deck : null;

        if ($fromAttempt === null && ($resumable = $this->resumable($user->id, $kind, $deck))) {
            return $resumable;
        }

        $pool = VocabularyWord::visibleTo($user->id)->get();
        $progress = VocabularyWordProgress::where('user_id', $user->id)->get()->keyBy('vocabulary_word_id');

        $onlyWordIds = null;
        if ($fromAttempt !== null) {
            $onlyWordIds = VocabularyAnswer::where('vocabulary_attempt_id', $fromAttempt->id)
                ->where('is_correct', false)
                ->whereNotNull('vocabulary_word_id')
                ->pluck('vocabulary_word_id')
                ->unique()
                ->values()
                ->all();
        }

        $plan = $this->plan($kind, $deck, $pool, $progress, $this->focusDeck($user->id, $pool, $progress), $onlyWordIds);

        if ($plan['new']->isEmpty() && $plan['review']->isEmpty()) {
            throw new RuntimeException(match (true) {
                $kind === VocabularyAttempt::KIND_WEAK => "No weak words right now \u{2014} nice work.",
                $pool->isEmpty() => 'The word library is not ready yet. Please check back soon.',
                default => 'There is nothing to practise here yet.',
            });
        }

        $factory = new VocabularyQuestionFactory($seed);
        $questions = $this->buildQuestions($factory, $plan, $pool, $progress);

        if ($questions === []) {
            throw new RuntimeException('We could not put a session together just now. Please try again.');
        }

        $title = match (true) {
            $plan['practice'] => 'Free practice',
            $fromAttempt !== null => 'Practise your missed words',
            $kind === VocabularyAttempt::KIND_WEAK => 'Fix your weak words',
            $kind === VocabularyAttempt::KIND_DECK => VocabularyDecks::title($deck) ?? 'Deck sprint',
            default => "Today\u{2019}s sprint",
        };

        return VocabularyAttempt::create([
            'user_id' => $user->id,
            'kind' => $kind,
            'deck' => $deck,
            'topic' => $title,
            'difficulty' => 'mixed',
            'questions' => $questions,
            'meta' => [
                'title' => $title,
                'new_count' => $plan['new']->count(),
                'review_count' => $plan['review']->count(),
                'practice' => $plan['practice'],
                'retry' => $fromAttempt !== null,
            ],
        ]);
    }

    /**
     * The deck a "daily" sprint should draw new words from: wherever the
     * student last practised if it still has unseen words, otherwise the first
     * deck on the learning path that does.
     *
     * @param  Collection<int, VocabularyWord>  $pool
     * @param  Collection<int, VocabularyWordProgress>  $progress
     */
    public function focusDeck(int $userId, Collection $pool, Collection $progress): ?string
    {
        $withUnseen = $pool
            ->filter(fn (VocabularyWord $w) => $w->user_id === null && $w->deck !== null && ! $progress->has($w->id))
            ->pluck('deck')
            ->unique();

        if ($withUnseen->isEmpty()) {
            return null;
        }

        $lastWordId = VocabularyAnswer::where('user_id', $userId)->whereNotNull('vocabulary_word_id')->latest('id')->value('vocabulary_word_id');
        $lastDeck = $lastWordId ? $pool->firstWhere('id', $lastWordId)?->deck : null;

        if ($lastDeck !== null && $withUnseen->contains($lastDeck)) {
            return $lastDeck;
        }

        return $withUnseen->sortBy(fn (string $slug) => VocabularyDecks::position($slug))->first();
    }

    /** An unfinished session of the same kind started recently, so tapping "Start" twice never splits one sprint in two. */
    public function resumable(int $userId, string $kind, ?string $deck): ?VocabularyAttempt
    {
        return VocabularyAttempt::where('user_id', $userId)
            ->where('kind', $kind)
            ->when($deck !== null, fn ($q) => $q->where('deck', $deck), fn ($q) => $q->whereNull('deck'))
            ->whereNull('submitted_at')
            ->where('created_at', '>=', now()->subHours(self::RESUME_WINDOW_HOURS))
            ->latest('id')
            ->first();
    }

    /**
     * @param  array{new: Collection<int, VocabularyWord>, review: Collection<int, VocabularyWord>, practice: bool}  $plan
     * @param  Collection<int, VocabularyWord>  $pool
     * @param  Collection<int, VocabularyWordProgress>  $progress
     * @return array<int, array<string, mixed>>
     */
    private function buildQuestions(VocabularyQuestionFactory $factory, array $plan, Collection $pool, Collection $progress): array
    {
        $main = [];
        $echoes = [];

        foreach ($plan['review'] as $word) {
            $question = $this->buildAny($factory, $word, $factory->typeFor($progress->get($word->id), $word), $pool, false, false, allowRecall: true);
            if ($question !== null) {
                $main[] = $question;
            }
        }

        foreach ($plan['new'] as $position => $word) {
            $question = $this->buildAny($factory, $word, VocabularyQuestionFactory::TYPE_MEANING, $pool, true, false, allowRecall: false);
            if ($question === null) {
                continue;
            }
            // The questions are shuffled, but the "meet the word" cards keep the deck's own order.
            $question['intro_order'] = $position;
            $main[] = $question;

            $echo = $this->buildAny($factory, $word, $factory->echoTypeFor($word, $question['type']), $pool, false, true, allowRecall: false);
            if ($echo !== null && $echo['type'] !== $question['type']) {
                $echoes[] = $echo;
            }
        }

        return array_merge($factory->shuffle($main), $factory->shuffle($echoes));
    }

    /**
     * Build the preferred type; if the word can't support it, step down to one
     * it can. Recall (typing) is only used as a last resort for a word the
     * student already knows — never for a word they have yet to meet.
     */
    private function buildAny(VocabularyQuestionFactory $factory, VocabularyWord $word, string $preferred, Collection $pool, bool $isNew, bool $isEcho, bool $allowRecall): ?array
    {
        $order = array_values(array_unique(array_merge(
            [$preferred],
            [VocabularyQuestionFactory::TYPE_WORD, VocabularyQuestionFactory::TYPE_MEANING],
            $allowRecall ? [VocabularyQuestionFactory::TYPE_RECALL] : []
        )));

        foreach ($order as $type) {
            $question = $factory->build($word, $type, $pool, $isNew, $isEcho);
            if ($question !== null) {
                return $question;
            }
        }

        return null;
    }

    /** Fraction right, with never-answered words sorting as 0 (weakest). */
    private function accuracy(?VocabularyWordProgress $progress): float
    {
        return $progress && $progress->seen_count > 0 ? $progress->correct_count / $progress->seen_count : 0.0;
    }
}
