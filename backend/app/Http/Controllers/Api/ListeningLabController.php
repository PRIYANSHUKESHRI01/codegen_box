<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\EnforcesLearningCentreAiLimit;
use App\Http\Controllers\Controller;
use App\Models\ListeningAttempt;
use App\Models\ListeningLesson;
use App\Services\GeminiListeningLessonService;
use App\Services\GeminiSpeakingPassageService;
use App\Services\ListeningProgressService;
use App\Support\SpeechAlignment;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use RuntimeException;

/**
 * Student-facing Listening Lab: browse lessons (the shared library plus ones
 * generated for this student), hear one (client-side text-to-speech, one
 * sentence at a time — no audio is stored here), answer, and learn from the
 * result.
 *
 * Grading is deterministic and server-side, never a model's opinion:
 *  - comprehension / conversation: exact match against the lesson's own
 *    `questions` key (correct_index).
 *  - dictation: word-level alignment of what the student typed against the
 *    sentence that was spoken (App\Support\SpeechAlignment — the same grader
 *    Speaking Practice uses for accuracy).
 *
 * show() deliberately strips correct_index / explanation / skill / evidence
 * before the student has answered; only submit() (which re-loads the real
 * lesson row itself and never trusts anything the client claims is "correct")
 * reveals them. Only generate() costs a Gemini call, so only it is gated by the
 * daily Learning Centre AI limit.
 */
class ListeningLabController extends Controller
{
    use EnforcesLearningCentreAiLimit;

    /** A dictation sentence at or above this accuracy counts as "caught" in the skill breakdown. */
    private const DICTATION_CAUGHT_PCT = 80;

    public function __construct(
        private readonly ListeningProgressService $progress,
        private readonly GeminiListeningLessonService $lessonWriter,
    ) {}

    public function index(Request $request)
    {
        $userId = $request->user()->id;

        $lessons = ListeningLesson::visibleTo($userId)
            ->where('is_active', true)
            // CASE rather than MySQL's FIELD() so the same query runs on the SQLite the tests use.
            ->orderByRaw("CASE difficulty WHEN 'beginner' THEN 0 WHEN 'intermediate' THEN 1 ELSE 2 END")
            ->orderBy('display_order')
            ->orderBy('id')
            ->get();

        // One aggregate query instead of loading every attempt the student has ever made.
        $stats = ListeningAttempt::where('user_id', $userId)
            ->whereIn('listening_lesson_id', $lessons->pluck('id'))
            ->selectRaw('listening_lesson_id, COUNT(*) as attempt_count, MAX(score) as best_score, MAX(passed) as any_passed, MAX(created_at) as last_attempt_at')
            ->groupBy('listening_lesson_id')
            ->get()
            ->keyBy('listening_lesson_id');

        $summaries = $lessons->map(fn (ListeningLesson $lesson) => $this->lessonSummary($lesson, $stats->get($lesson->id)));

        return response()->json([
            'lessons' => $summaries->where('is_mine', false)->values(),
            // Newest first, so a lesson generated a moment ago is the first thing they see.
            'my_lessons' => $lessons->where('user_id', $userId)->sortByDesc('id')->map(fn (ListeningLesson $l) => $summaries->firstWhere('id', $l->id))->values(),
            'summary' => $this->progress->summary($userId),
        ]);
    }

    public function show(Request $request, ListeningLesson $listeningLesson)
    {
        abort_unless($listeningLesson->is_active && $listeningLesson->isVisibleTo($request->user()->id), 404);

        $history = ListeningAttempt::where('user_id', $request->user()->id)
            ->where('listening_lesson_id', $listeningLesson->id)
            ->orderByDesc('id')
            ->get(['score', 'passed', 'created_at']);

        return response()->json([
            'lesson' => [
                'id' => $listeningLesson->id,
                'title' => $listeningLesson->title,
                'passage_text' => $listeningLesson->passage_text,
                'category' => $listeningLesson->category,
                'difficulty' => $listeningLesson->difficulty,
                'format' => $listeningLesson->format,
                'source' => $listeningLesson->source,
                'interest' => $listeningLesson->interest,
                'is_mine' => $listeningLesson->user_id !== null,
                'speakers' => $listeningLesson->speakers,
                // The one agreed sentence split — what the player speaks and what `evidence` indexes into.
                'sentences' => $listeningLesson->sentences(),
                'estimated_seconds' => $listeningLesson->estimatedSeconds(),
                'item_count' => $listeningLesson->itemCount(),
                // The skills this lesson trains, as a whole — the same coarse hint the lesson list shows. Which question trains which skill stays hidden until after answering.
                'skills' => $listeningLesson->skills(),
                // Answer-stripped — see class docblock. A dictation has no questions: its sentences are the items.
                'questions' => $listeningLesson->isDictation() ? [] : $listeningLesson->questionsWithoutAnswers(),
            ],
            'history' => [
                'attempt_count' => $history->count(),
                'best_score' => $history->isEmpty() ? null : (int) $history->max('score'),
                'last_score' => $history->first()?->score,
                'passed' => $history->contains(fn (ListeningAttempt $a) => $a->passed),
            ],
        ]);
    }

    public function generate(Request $request)
    {
        $this->assertWithinDailyLearningCentreAiLimit($request);

        $validated = $request->validate([
            'topic' => ['required', 'string', 'min:3', 'max:80'],
            'difficulty' => ['required', Rule::in(ListeningLesson::DIFFICULTIES)],
            'kind' => ['nullable', Rule::in(array_keys(GeminiListeningLessonService::KINDS))],
        ]);

        try {
            $written = $this->lessonWriter->generate($validated['topic'], $validated['difficulty'], $validated['kind'] ?? 'passage');
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        $lesson = ListeningLesson::create([
            'user_id' => $request->user()->id,
            'title' => $written['title'],
            'passage_text' => $written['passage_text'],
            'category' => $written['category'],
            'difficulty' => $validated['difficulty'],
            'format' => $written['format'],
            'source' => ListeningLesson::SOURCE_AI,
            'interest' => GeminiSpeakingPassageService::cleanTopic($validated['topic']),
            'questions' => $written['questions'],
            'speakers' => $written['speakers'],
            'script' => $written['script'],
            'is_active' => true,
            'display_order' => 0,
        ]);

        // Keep a student's list tidy: archive (never delete — their attempts reference it) beyond the cap.
        $stale = ListeningLesson::where('user_id', $request->user()->id)
            ->where('source', ListeningLesson::SOURCE_AI)
            ->where('is_active', true)
            ->orderByDesc('id')
            ->skip(ListeningLesson::MAX_ACTIVE_AI_PER_USER)
            ->limit(1000)
            ->pluck('id');
        if ($stale->isNotEmpty()) {
            ListeningLesson::whereIn('id', $stale)->update(['is_active' => false]);
        }

        return response()->json(['lesson' => $this->lessonSummary($lesson->refresh(), null)], 201);
    }

    public function submit(Request $request, ListeningLesson $listeningLesson)
    {
        abort_unless($listeningLesson->is_active && $listeningLesson->isVisibleTo($request->user()->id), 404);

        $userId = $request->user()->id;

        $meta = $request->validate([
            'mode' => ['nullable', Rule::in(ListeningAttempt::MODES)],
            'plays_used' => ['nullable', 'integer', 'min:0', 'max:50'],
        ]);

        $graded = $listeningLesson->isDictation()
            ? $this->gradeDictation($request, $listeningLesson)
            : $this->gradeQuestions($request, $listeningLesson);

        $priorBest = ListeningAttempt::where('user_id', $userId)->where('listening_lesson_id', $listeningLesson->id)->max('score');
        $attemptNumber = ListeningAttempt::where('user_id', $userId)->where('listening_lesson_id', $listeningLesson->id)->count() + 1;

        $attempt = ListeningAttempt::create([
            'user_id' => $userId,
            'listening_lesson_id' => $listeningLesson->id,
            'attempt_number' => $attemptNumber,
            'mode' => $meta['mode'] ?? ListeningAttempt::MODE_PRACTICE,
            'plays_used' => $meta['plays_used'] ?? null,
            'answers' => $graded['answers'],
            'score' => $graded['score'],
            'passed' => $graded['score'] >= ListeningAttempt::PASS_THRESHOLD,
            'skill_breakdown' => $graded['skill_breakdown'],
        ]);

        return response()->json([
            'attempt' => [
                'id' => $attempt->id,
                'attempt_number' => $attempt->attempt_number,
                'score' => $attempt->score,
                'passed' => $attempt->passed,
                'mode' => $attempt->mode,
                // A first attempt is not a "new best" — there was nothing to beat.
                'is_new_best' => $priorBest !== null && $attempt->score > (int) $priorBest,
                'previous_best' => $priorBest !== null ? (int) $priorBest : null,
            ],
            'format' => $listeningLesson->format,
            'results' => $graded['results'],
            'skill_breakdown' => array_map(fn (array $row) => [...$row, 'label' => ListeningLesson::SKILL_LABELS[$row['skill']] ?? $row['skill']], $graded['skill_breakdown']),
            // The honest next step, computed after this attempt so it already reflects it.
            'next' => $this->progress->summary($userId, $listeningLesson->id)['recommended'],
        ]);
    }

    /** Comprehension / conversation: exact-match multiple choice against the lesson's own answer key. */
    private function gradeQuestions(Request $request, ListeningLesson $lesson): array
    {
        $questions = $lesson->questions;

        $validated = $request->validate([
            'answers' => ['required', 'array', 'size:'.count($questions)],
            'answers.*' => ['required', 'integer', 'min:0', 'max:3'],
        ]);

        $correctCount = 0;
        $results = [];
        $tally = [];

        foreach ($questions as $i => $question) {
            $selected = (int) $validated['answers'][$i];
            $isCorrect = $selected === (int) $question['correct_index'];
            $correctCount += $isCorrect ? 1 : 0;

            $skill = $question['skill'] ?? null;
            if ($skill !== null) {
                $tally[$skill]['correct'] = ($tally[$skill]['correct'] ?? 0) + ($isCorrect ? 1 : 0);
                $tally[$skill]['total'] = ($tally[$skill]['total'] ?? 0) + 1;
            }

            $results[] = [
                'question' => $question['question'],
                'options' => $question['options'],
                'selected_index' => $selected,
                'correct_index' => (int) $question['correct_index'],
                'is_correct' => $isCorrect,
                'explanation' => $question['explanation'],
                'skill' => $skill,
                // Index of the sentence that holds the answer, for the transcript highlight (null when unknown).
                'evidence' => isset($question['evidence']) ? (int) $question['evidence'] : null,
            ];
        }

        return [
            'answers' => $validated['answers'],
            'score' => (int) round(($correctCount / max(1, count($questions))) * 100),
            'results' => $results,
            'skill_breakdown' => $this->breakdownRows($tally),
        ];
    }

    /** Dictation: each typed sentence is aligned word by word against the sentence that was spoken. */
    private function gradeDictation(Request $request, ListeningLesson $lesson): array
    {
        $sentences = $lesson->sentences();

        $validated = $request->validate([
            'answers' => ['required', 'array', 'size:'.count($sentences)],
            'answers.*' => ['nullable', 'string', 'max:400'],
        ]);

        $results = [];
        $answers = [];
        $accuracySum = 0;
        $caught = 0;

        foreach ($sentences as $i => $sentence) {
            $typed = trim((string) ($validated['answers'][$i] ?? ''));
            $answers[] = $typed;

            $alignment = $typed === '' ? null : SpeechAlignment::align($sentence['text'], $typed);
            $accuracy = $alignment['accuracy'] ?? 0;
            $accuracySum += $accuracy;
            $isCaught = $accuracy >= self::DICTATION_CAUGHT_PCT;
            $caught += $isCaught ? 1 : 0;

            $results[] = [
                'index' => $i,
                'target' => $sentence['text'],
                'typed' => $typed,
                'accuracy' => $accuracy,
                'is_correct' => $isCaught,
                // Per spoken word: ok / close (a likely typo) / wrong / missed — empty when nothing was typed.
                'words' => $alignment['words'] ?? array_map(fn (string $w) => ['word' => $w, 'status' => 'missed', 'heard' => null], preg_split('/\s+/u', $sentence['text'], -1, PREG_SPLIT_NO_EMPTY) ?: []),
            ];
        }

        return [
            'answers' => $answers,
            'score' => (int) round($accuracySum / max(1, count($sentences))),
            'results' => $results,
            'skill_breakdown' => [['skill' => ListeningLesson::SKILL_DICTATION, 'correct' => $caught, 'total' => count($sentences)]],
        ];
    }

    /** @return list<array{skill:string, correct:int, total:int}> in the canonical skill order */
    private function breakdownRows(array $tally): array
    {
        $rows = [];
        foreach (ListeningLesson::SKILLS as $skill) {
            if (isset($tally[$skill])) {
                $rows[] = ['skill' => $skill, 'correct' => $tally[$skill]['correct'], 'total' => $tally[$skill]['total']];
            }
        }

        return $rows;
    }

    /** @param  object|null  $stat  one row of the per-lesson attempt aggregate, or null when never attempted */
    private function lessonSummary(ListeningLesson $lesson, ?object $stat): array
    {
        return [
            'id' => $lesson->id,
            'title' => $lesson->title,
            'category' => $lesson->category,
            'difficulty' => $lesson->difficulty,
            'format' => $lesson->format,
            'question_count' => $lesson->itemCount(),
            'estimated_seconds' => $lesson->estimatedSeconds(),
            'skills' => $lesson->skills(),
            'speaker_count' => $lesson->format === ListeningLesson::FORMAT_CONVERSATION ? count($lesson->speakers ?? []) : 1,
            'best_score' => $stat?->best_score !== null ? (int) $stat->best_score : null,
            'attempt_count' => (int) ($stat->attempt_count ?? 0),
            'passed' => (bool) ($stat->any_passed ?? false),
            'last_attempt_at' => $stat?->last_attempt_at,
            'source' => $lesson->source,
            'interest' => $lesson->interest,
            'is_mine' => $lesson->user_id !== null,
        ];
    }
}
