<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ListeningAttempt;
use App\Models\ListeningLesson;
use Illuminate\Http\Request;

/**
 * Student-facing Listening Lab: browse lessons, hear the passage (client-side
 * TTS via the existing VoiceEngine — no audio stored here), answer a
 * comprehension quiz. Graded deterministically server-side against the
 * lesson's own `questions` column — never a Gemini call. show() deliberately
 * strips correct_index/explanation before the student has answered; only
 * submit() (which re-loads the real lesson row itself, never trusting
 * client-supplied answers as "correct") reveals them.
 */
class ListeningLabController extends Controller
{
    public function index(Request $request)
    {
        $lessons = ListeningLesson::where('is_active', true)
            ->orderByRaw("FIELD(difficulty, 'beginner', 'intermediate', 'advanced')")
            ->orderBy('display_order')
            ->get();

        $bestByLesson = ListeningAttempt::where('user_id', $request->user()->id)
            ->whereIn('listening_lesson_id', $lessons->pluck('id'))
            ->get()
            ->groupBy('listening_lesson_id')
            ->map(fn ($attempts) => (int) $attempts->max('score'));

        return response()->json([
            'lessons' => $lessons->map(fn (ListeningLesson $lesson) => [
                'id' => $lesson->id,
                'title' => $lesson->title,
                'category' => $lesson->category,
                'difficulty' => $lesson->difficulty,
                'question_count' => count($lesson->questions),
                'best_score' => $bestByLesson->get($lesson->id),
            ]),
        ]);
    }

    public function show(Request $request, ListeningLesson $listeningLesson)
    {
        abort_unless($listeningLesson->is_active, 404);

        return response()->json([
            'lesson' => [
                'id' => $listeningLesson->id,
                'title' => $listeningLesson->title,
                'passage_text' => $listeningLesson->passage_text,
                'category' => $listeningLesson->category,
                'difficulty' => $listeningLesson->difficulty,
                // Answer-stripped — see class docblock.
                'questions' => $listeningLesson->questionsWithoutAnswers(),
            ],
        ]);
    }

    public function submit(Request $request, ListeningLesson $listeningLesson)
    {
        abort_unless($listeningLesson->is_active, 404);

        $questions = $listeningLesson->questions;

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
                'question' => $question['question'],
                'options' => $question['options'],
                'selected_index' => $selected,
                'correct_index' => (int) $question['correct_index'],
                'is_correct' => $isCorrect,
                'explanation' => $question['explanation'],
            ];
        }

        $score = (int) round(($correctCount / max(1, count($questions))) * 100);

        $attemptNumber = ListeningAttempt::where('user_id', $request->user()->id)
            ->where('listening_lesson_id', $listeningLesson->id)
            ->count() + 1;

        $attempt = ListeningAttempt::create([
            'user_id' => $request->user()->id,
            'listening_lesson_id' => $listeningLesson->id,
            'attempt_number' => $attemptNumber,
            'answers' => $validated['answers'],
            'score' => $score,
            'passed' => $score >= ListeningAttempt::PASS_THRESHOLD,
        ]);

        return response()->json([
            'attempt' => [
                'id' => $attempt->id,
                'attempt_number' => $attempt->attempt_number,
                'score' => $attempt->score,
                'passed' => $attempt->passed,
            ],
            'results' => $results,
        ]);
    }
}
