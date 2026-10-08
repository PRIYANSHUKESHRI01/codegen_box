<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\EnforcesLearningCentreAiLimit;
use App\Http\Controllers\Controller;
use App\Models\VocabularyAttempt;
use App\Models\VocabularyWord;
use App\Services\GeminiVocabularyQuizService;
use App\Services\VocabularyAnswerService;
use App\Services\VocabularyProgressService;
use App\Services\VocabularyQuestionFactory;
use App\Services\VocabularySessionService;
use App\Support\VocabularyDecks;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use RuntimeException;

/**
 * Student-facing Vocabulary Sprint.
 *
 *  - start()    builds a practice session from the word bank (daily / deck /
 *               weak words) — no AI call, so no daily AI quota is spent.
 *  - generate() is the quick quiz on any topic: it does call Gemini and counts
 *               toward the daily Learning Centre AI limit.
 *  - show()     returns a session so a student can pick up where they left off.
 *  - answer()   commits ONE answer and reveals that question's answer.
 *  - submit()   is the original all-at-once endpoint, kept so a frontend
 *               deployed before this upgrade keeps working.
 *
 * The answer key is held server-side on the vocabulary_attempts row and only
 * ever revealed question by question, after the student has answered it. See
 * VocabularyAnswerService.
 */
class VocabularyController extends Controller
{
    use EnforcesLearningCentreAiLimit;

    public function __construct(
        private readonly GeminiVocabularyQuizService $generator,
        private readonly VocabularySessionService $sessions,
        private readonly VocabularyAnswerService $answers,
        private readonly VocabularyProgressService $progress,
        private readonly VocabularyQuestionFactory $factory,
    ) {}

    public function start(Request $request)
    {
        $validated = $request->validate([
            'kind' => ['required', Rule::in([VocabularyAttempt::KIND_DAILY, VocabularyAttempt::KIND_DECK, VocabularyAttempt::KIND_WEAK])],
            'deck' => ['required_if:kind,'.VocabularyAttempt::KIND_DECK, 'nullable', 'string', Rule::in(VocabularyDecks::slugs())],
            'from_attempt' => ['nullable', 'integer'],
        ]);

        $from = null;
        if (! empty($validated['from_attempt'])) {
            abort_unless($validated['kind'] === VocabularyAttempt::KIND_WEAK, 422, 'Missed words can only be practised as a weak-words session.');
            $from = VocabularyAttempt::where('user_id', $request->user()->id)
                ->where('kind', '!=', VocabularyAttempt::KIND_CUSTOM)
                ->findOrFail($validated['from_attempt']);
        }

        try {
            $attempt = $this->sessions->start($request->user(), $validated['kind'], $validated['deck'] ?? null, $from);
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json($this->answers->present($attempt), $attempt->wasRecentlyCreated ? 201 : 200);
    }

    public function show(Request $request, VocabularyAttempt $vocabularyAttempt)
    {
        abort_unless($vocabularyAttempt->user_id === $request->user()->id, 404);

        return response()->json($this->answers->present($vocabularyAttempt));
    }

    public function answer(Request $request, VocabularyAttempt $vocabularyAttempt)
    {
        abort_unless($vocabularyAttempt->user_id === $request->user()->id, 404);

        $validated = $request->validate([
            'index' => ['required', 'integer', 'min:0', 'max:49'],
            'answer' => ['required'],
            'response_ms' => ['nullable', 'integer', 'min:0'],
        ]);

        $answer = $validated['answer'];
        abort_unless(is_int($answer) || (is_string($answer) && mb_strlen($answer) <= 120), 422, 'That answer is not valid.');

        return response()->json($this->answers->answer(
            $request->user(),
            $vocabularyAttempt,
            (int) $validated['index'],
            $answer,
            isset($validated['response_ms']) ? (int) $validated['response_ms'] : null,
        ));
    }

    public function generate(Request $request)
    {
        $this->assertWithinDailyLearningCentreAiLimit($request);

        $validated = $request->validate([
            'topic' => ['required', 'string', 'max:80'],
            'difficulty' => ['required', 'string', 'in:beginner,intermediate,advanced'],
        ]);

        $userId = $request->user()->id;

        try {
            $items = $this->generator->generate($validated['topic'], $validated['difficulty'], $this->recentWords($userId));
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        // A word that is also in the library shares that word's memory, so a quiz can't "reset" what the student already knows.
        $library = VocabularyWord::visibleTo($userId)->get()->keyBy(fn (VocabularyWord $w) => mb_strtolower($w->word));
        $questions = array_map(
            fn (array $item) => $this->factory->fromAiItem($item, $library->get(mb_strtolower($item['word']))?->id),
            $items
        );

        $attempt = VocabularyAttempt::create([
            'user_id' => $userId,
            'kind' => VocabularyAttempt::KIND_CUSTOM,
            'topic' => $validated['topic'],
            'difficulty' => $validated['difficulty'],
            'questions' => $questions,
            'meta' => ['title' => $validated['topic'], 'new_count' => 0, 'review_count' => 0, 'practice' => false],
        ]);

        return response()->json($this->answers->present($attempt), 201);
    }

    /** Original batch submit — grades every answer in one request. Kept for older frontends; new ones use answer(). */
    public function submit(Request $request, VocabularyAttempt $vocabularyAttempt)
    {
        abort_unless($vocabularyAttempt->user_id === $request->user()->id, 404);
        abort_if($vocabularyAttempt->isSubmitted(), 422, 'This quiz has already been submitted.');
        abort_unless($vocabularyAttempt->kind === VocabularyAttempt::KIND_CUSTOM, 422, 'This session is answered one question at a time.');

        $questions = $vocabularyAttempt->questions;

        $validated = $request->validate([
            'answers' => ['required', 'array', 'size:'.count($questions)],
            'answers.*' => ['required', 'integer', 'min:0', 'max:3'],
        ]);

        $results = [];
        foreach ($questions as $i => $question) {
            $outcome = $this->answers->answer($request->user(), $vocabularyAttempt, $i, (int) $validated['answers'][$i]);

            $results[] = [
                'word' => $question['word'],
                'sentence' => $question['sentence'],
                'options' => $question['options'],
                'selected_index' => $outcome['selected_index'],
                'correct_index' => $outcome['correct_index'],
                'is_correct' => $outcome['is_correct'],
                'explanation' => $question['explanation'],
            ];
        }

        $vocabularyAttempt->refresh();
        $vocabularyAttempt->update(['answers' => array_map('intval', $validated['answers'])]);

        return response()->json([
            'attempt' => [
                'id' => $vocabularyAttempt->id,
                'score' => $vocabularyAttempt->score,
                'passed' => $vocabularyAttempt->passed,
            ],
            'results' => $results,
        ]);
    }

    /** Words from the student's last few AI quizzes and their own saved words — so a new quiz brings new words. */
    private function recentWords(int $userId): array
    {
        $fromQuizzes = VocabularyAttempt::where('user_id', $userId)
            ->where('kind', VocabularyAttempt::KIND_CUSTOM)
            ->latest('id')
            ->limit(5)
            ->get(['questions'])
            ->flatMap(fn (VocabularyAttempt $a) => collect($a->questions)->pluck('word'));

        $saved = VocabularyWord::where('user_id', $userId)->where('source', VocabularyWord::SOURCE_AI)->latest('id')->limit(20)->pluck('word');

        return $fromQuizzes->concat($saved)->filter()->unique(fn ($w) => mb_strtolower($w))->take(40)->values()->all();
    }
}
