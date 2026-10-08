<?php

namespace App\Services;

use App\Models\User;
use App\Models\VocabularyAnswer;
use App\Models\VocabularyAttempt;
use App\Models\VocabularyWord;
use App\Models\VocabularyWordProgress;
use App\Support\ActivityStreak;
use App\Support\VocabularyDecks;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/**
 * Everything the Vocabulary Sprint home page and Word Bank show about a
 * student's standing — computed fresh from words + progress + the answer log,
 * so there is no cached "mastered" counter that can drift out of step with the
 * real per-word boxes.
 *
 * Totals and deck progress count LIBRARY words only (same rule as the Listening
 * Lab): words a student picked up from their own AI quizzes are theirs to
 * review, but they never inflate "X of 160 words".
 */
class VocabularyProgressService
{
    /** Questions answered per day that count as "goal reached". */
    public const DAILY_GOAL = 10;

    /** Rough seconds a student spends per question, for the "about N min" estimate. */
    private const SECONDS_PER_QUESTION = 20;

    public const WORDS_PER_PAGE = 40;

    public function __construct(private readonly VocabularySessionService $sessions) {}

    public function overview(User $user): array
    {
        $userId = $user->id;

        $pool = VocabularyWord::visibleTo($userId)->get();
        $poolById = $pool->keyBy('id');
        $progress = VocabularyWordProgress::where('user_id', $userId)->get()
            ->filter(fn (VocabularyWordProgress $p) => $poolById->has($p->vocabulary_word_id))
            ->keyBy('vocabulary_word_id');

        $library = $pool->filter(fn (VocabularyWord $w) => $w->user_id === null);
        $mine = $pool->filter(fn (VocabularyWord $w) => $w->user_id !== null);

        $totals = ['library_words' => $library->count()] + $this->statusCounts($library, $progress);
        $totals['due_today'] = $progress->filter(fn (VocabularyWordProgress $p) => $p->isDue())->count();
        $totals['weak'] = $progress->filter(fn (VocabularyWordProgress $p) => $p->isWeak())->count();
        $totals['my_words'] = $mine->count();
        $totals['mastered_this_week'] = $progress->filter(
            fn (VocabularyWordProgress $p) => $p->mastered_at !== null && $p->mastered_at->gte(now()->startOfWeek())
        )->count();

        return [
            'totals' => $totals,
            'today' => $this->today($userId),
            'next_sprint' => $this->nextSprint($userId, $pool, $progress),
            'resume' => $this->resume($userId),
            'word_of_the_day' => $this->wordOfTheDay($library, $progress),
            'decks' => $this->decks($library, $progress),
        ];
    }

    /**
     * The Word Bank listing, filtered and paged.
     *
     * @param  array{status?: ?string, deck?: ?string, q?: ?string, page?: ?int}  $filters
     */
    public function words(User $user, array $filters): array
    {
        $userId = $user->id;
        $pool = VocabularyWord::visibleTo($userId)->get();
        $progress = VocabularyWordProgress::where('user_id', $userId)->get()->keyBy('vocabulary_word_id');

        $deck = $filters['deck'] ?? null;
        $query = mb_strtolower(trim((string) ($filters['q'] ?? '')));
        $status = $filters['status'] ?? 'all';
        $page = max(1, (int) ($filters['page'] ?? 1));

        $scoped = $pool
            ->filter(fn (VocabularyWord $w) => match (true) {
                $deck === 'mine' => $w->user_id !== null,
                VocabularyDecks::exists($deck) => $w->deck === $deck,
                default => true,
            })
            ->filter(fn (VocabularyWord $w) => $query === ''
                || str_contains(mb_strtolower($w->word), $query)
                || str_contains(mb_strtolower($w->meaning), $query))
            ->values();

        $statusOf = fn (VocabularyWord $w): string => VocabularyWordProgress::statusForBox($progress->get($w->id)?->box);

        $counts = [
            'all' => $scoped->count(),
            VocabularyWordProgress::STATUS_NEW => $scoped->filter(fn ($w) => $statusOf($w) === VocabularyWordProgress::STATUS_NEW)->count(),
            VocabularyWordProgress::STATUS_LEARNING => $scoped->filter(fn ($w) => $statusOf($w) === VocabularyWordProgress::STATUS_LEARNING)->count(),
            VocabularyWordProgress::STATUS_FAMILIAR => $scoped->filter(fn ($w) => $statusOf($w) === VocabularyWordProgress::STATUS_FAMILIAR)->count(),
            VocabularyWordProgress::STATUS_MASTERED => $scoped->filter(fn ($w) => $statusOf($w) === VocabularyWordProgress::STATUS_MASTERED)->count(),
            'weak' => $scoped->filter(fn ($w) => $progress->get($w->id)?->isWeak() === true)->count(),
        ];

        $filtered = $scoped->filter(fn (VocabularyWord $w) => match ($status) {
            'weak' => $progress->get($w->id)?->isWeak() === true,
            VocabularyWordProgress::STATUS_NEW,
            VocabularyWordProgress::STATUS_LEARNING,
            VocabularyWordProgress::STATUS_FAMILIAR,
            VocabularyWordProgress::STATUS_MASTERED => $statusOf($w) === $status,
            default => true,
        });

        $sorted = $filtered->sortBy(fn (VocabularyWord $w) => $w->user_id === null
            ? [0, VocabularyDecks::position($w->deck), $w->sort_order, $w->id]
            : [1, 0, 0, -$w->id])->values();

        $total = $sorted->count();
        $slice = $sorted->slice(($page - 1) * self::WORDS_PER_PAGE, self::WORDS_PER_PAGE)->values();

        return [
            'counts' => $counts,
            'words' => $slice->map(function (VocabularyWord $w) use ($progress) {
                $p = $progress->get($w->id);

                return $w->card() + [
                    'status' => VocabularyWordProgress::statusForBox($p?->box),
                    'box' => $p?->box,
                    'seen_count' => $p?->seen_count ?? 0,
                    'correct_count' => $p?->correct_count ?? 0,
                    'is_weak' => $p?->isWeak() ?? false,
                    'next_review' => $p ? VocabularySrsService::describeDue($p->due_on) : null,
                ];
            })->all(),
            'page' => $page,
            'per_page' => self::WORDS_PER_PAGE,
            'total' => $total,
            'has_more' => $page * self::WORDS_PER_PAGE < $total,
        ];
    }

    /** Distinct days the student answered at least one vocabulary question, newest first. */
    public function streakDays(int $userId): int
    {
        return ActivityStreak::current($this->activityDates($userId));
    }

    /** @return Collection<int, string> */
    public function activityDates(int $userId): Collection
    {
        return VocabularyAnswer::where('user_id', $userId)
            ->pluck('created_at')
            ->filter()
            ->map(fn ($d) => Carbon::parse($d)->toDateString())
            ->unique()
            ->sortDesc()
            ->values();
    }

    public function answeredToday(int $userId): int
    {
        return VocabularyAnswer::where('user_id', $userId)->where('created_at', '>=', today())->count();
    }

    private function today(int $userId): array
    {
        $answered = $this->answeredToday($userId);

        $week = VocabularyAnswer::where('user_id', $userId)->where('created_at', '>=', now()->subDays(7))->get(['is_correct']);

        return [
            'answered' => $answered,
            'goal' => self::DAILY_GOAL,
            'goal_reached' => $answered >= self::DAILY_GOAL,
            'streak_days' => $this->streakDays($userId),
            'accuracy_7d' => $week->count() >= 5 ? (int) round(100 * $week->where('is_correct', true)->count() / $week->count()) : null,
        ];
    }

    /**
     * Preview of the next daily sprint, from the very same plan() that start()
     * uses — so "4 new · 6 to review" on the button is what the student gets.
     */
    private function nextSprint(int $userId, Collection $pool, Collection $progress): array
    {
        $focus = $this->sessions->focusDeck($userId, $pool, $progress);
        $plan = $this->sessions->plan(VocabularyAttempt::KIND_DAILY, null, $pool, $progress, $focus);

        $questions = min(VocabularySessionService::MAX_QUESTIONS, 2 * $plan['new']->count() + $plan['review']->count());

        return [
            'state' => match (true) {
                $plan['practice'] => 'practice',
                $questions === 0 => 'empty',
                default => 'ready',
            },
            'new_words' => $plan['new']->count(),
            'reviews_due' => $plan['practice'] ? 0 : $plan['review']->count(),
            'questions' => $plan['practice'] ? $plan['review']->count() : $questions,
            'minutes' => max(1, (int) round(($plan['practice'] ? $plan['review']->count() : $questions) * self::SECONDS_PER_QUESTION / 60)),
            'focus_deck' => $plan['new']->isNotEmpty() && $focus !== null
                ? ['slug' => $focus, 'title' => VocabularyDecks::title($focus)]
                : null,
        ];
    }

    private function resume(int $userId): ?array
    {
        $attempt = VocabularyAttempt::where('user_id', $userId)
            ->whereNull('submitted_at')
            ->where('created_at', '>=', now()->subHours(VocabularySessionService::RESUME_WINDOW_HOURS))
            ->latest('id')
            ->first();

        if (! $attempt) {
            return null;
        }

        return [
            'attempt_id' => $attempt->id,
            'kind' => $attempt->kind,
            'title' => $attempt->meta['title'] ?? $attempt->topic,
            'answered' => $attempt->answerRecords()->count(),
            'total' => $attempt->questionCount(),
        ];
    }

    /** A different word every calendar day, the same for everyone, no storage needed. */
    private function wordOfTheDay(Collection $library, Collection $progress): ?array
    {
        if ($library->isEmpty()) {
            return null;
        }

        $sorted = $library->sortBy('id')->values();
        $word = $sorted[crc32(today()->toDateString()) % $sorted->count()];

        return $word->card() + ['status' => VocabularyWordProgress::statusForBox($progress->get($word->id)?->box)];
    }

    /** @return array<int, array<string, mixed>> */
    private function decks(Collection $library, Collection $progress): array
    {
        $byDeck = $library->groupBy('deck');

        return collect(VocabularyDecks::all())->map(function (array $deck, string $slug) use ($byDeck, $progress) {
            $words = $byDeck->get($slug, collect());
            $counts = $this->statusCounts($words, $progress);

            return [
                'slug' => $slug,
                'title' => $deck['title'],
                'tagline' => $deck['tagline'],
                'level' => $deck['level'],
                'total' => $words->count(),
                'new' => $counts['new'],
                'learning' => $counts['learning'],
                'familiar' => $counts['familiar'],
                'mastered' => $counts['mastered'],
                'due' => $words->filter(fn (VocabularyWord $w) => $progress->has($w->id) && $progress[$w->id]->isDue())->count(),
            ];
        })->values()->all();
    }

    /**
     * @param  Collection<int, VocabularyWord>  $words
     * @param  Collection<int, VocabularyWordProgress>  $progress
     * @return array{new: int, learning: int, familiar: int, mastered: int}
     */
    private function statusCounts(Collection $words, Collection $progress): array
    {
        $counts = ['new' => 0, 'learning' => 0, 'familiar' => 0, 'mastered' => 0];

        foreach ($words as $word) {
            $counts[VocabularyWordProgress::statusForBox($progress->get($word->id)?->box)]++;
        }

        return $counts;
    }
}
