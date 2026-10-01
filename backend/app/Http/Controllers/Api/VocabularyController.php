<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\EnforcesLearningCentreAiLimit;
use App\Http\Controllers\Controller;
use App\Models\VocabularyAttempt;
use App\Services\GeminiVocabularyQuizService;
use Illuminate\Http\Request;
use RuntimeException;

/**
 * Student-facing Vocabulary Sprint: generate() calls Gemini for a fresh
 * topic/difficulty quiz and persists the FULL result (with correct_index)
 * immediately on a new vocabulary_attempts row, returning only the
 * answer-stripped questions + attempt_id to the browser. submit() grades
 * against that server-held row — the client's answers are trusted, the
 * "correct" answers never are. See VocabularyAttempt's docblock.
 */
class VocabularyController extends Controller
{
    use EnforcesLearningCentreAiLimit;

    public function __construct(private readonly GeminiVocabularyQuizService $generator) {}

    public function generate(Request $request)
    {
        $this->assertWithinDailyLearningCentreAiLimit($request);

        $validated = $request->validate([
            'topic' => ['required', 'string', 'max:80'],
            'difficulty' => ['required', 'string', 'in:beginner,intermediate,advanced'],
        ]);

        try {
            $questions = $this->generator->generate($validated['topic'], $validated['difficulty']);
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        $attempt = VocabularyAttempt::create([
            'user_id' => $request->user()->id,
            'topic' => $validated['topic'],
            'difficulty' => $validated['difficulty'],
            'questions' => $questions,
        ]);

        return response()->json([
            'attempt_id' => $attempt->id,
            'topic' => $attempt->topic,
            'difficulty' => $attempt->difficulty,
            'questions' => $attempt->questionsWithoutAnswers(),
        ], 201);
    }

    public function submit(Request $request, VocabularyAttempt $vocabularyAttempt)
    {
        abort_unless($vocabularyAttempt->user_id === $request->user()->id, 404);
        abort_if($vocabularyAttempt->isSubmitted(), 422, 'This quiz has already been submitted.');

        $questions = $vocabularyAttempt->questions;

        $validated = $request->validate([
            'answers' => ['required', 'array', 'size:'.count($questions)],
            'answers.*' => ['required', 'integer', 'min:0', 'max:3'],
        ]);

        $correctCount = 0;
        $results = [];
        foreach ($questions as $i => $question) {
            $selected = (int) $validated['answers'][$i];
            $isCorrect = $selected === (int) $question['correct_index'];
            $correctCount += $isCorrect ? 1 : 0;

            $results[] = [
                'word' => $question['word'],
                'sentence' => $question['sentence'],
                'options' => $question['options'],
                'selected_index' => $selected,
                'correct_index' => (int) $question['correct_index'],
                'is_correct' => $isCorrect,
                'explanation' => $question['explanation'],
            ];
        }

        $score = (int) round(($correctCount / max(1, count($questions))) * 100);

        $vocabularyAttempt->update([
            'answers' => $validated['answers'],
            'score' => $score,
            'passed' => $score >= VocabularyAttempt::PASS_THRESHOLD,
            'submitted_at' => now(),
        ]);

        return response()->json([
            'attempt' => [
                'id' => $vocabularyAttempt->id,
                'score' => $score,
                'passed' => $vocabularyAttempt->passed,
            ],
            'results' => $results,
        ]);
    }
}
